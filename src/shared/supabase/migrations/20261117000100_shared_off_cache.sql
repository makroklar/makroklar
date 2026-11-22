-- Provider-only cache. Restaurant snapshots/recipes remain independent.
begin;

create table makroklar_private.off_products (
  barcode text primary key check (barcode ~ '^[0-9]{8,14}$'),
  product jsonb not null check (jsonb_typeof(product) = 'object'),
  fetched_at timestamptz not null check (isfinite(fetched_at)),
  cached_at timestamptz not null default now(),
  check (product->>'id' = 'off:' || barcode),
  check (product#>>'{source,kind}' = 'off'),
  check (product#>>'{source,barcode}' = barcode)
);
alter table makroklar_private.off_products enable row level security;
revoke all on makroklar_private.off_products from public, anon, authenticated, service_role;

-- Expose a barcode lookup, not a list of who selected which products.
create function public.read_shared_off_product(barcode text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select p.product from makroklar_private.off_products p
  where p.barcode = $1 and p.fetched_at <= now() and p.fetched_at > now() - interval '30 days'
    and exists (select 1 from public.restaurant_members m where m.user_id = (select auth.uid()) and m.role = 'owner');
$$;
revoke all on function public.read_shared_off_product(text) from public, anon, authenticated, service_role;
grant execute on function public.read_shared_off_product(text) to authenticated;

-- Only the backend secret may publish provider-verified data. The user-facing save
-- RPC must NEVER publish to this cache: its payload can be supplied by a client.
create function public.publish_confirmed_off_products(target_restaurant_id uuid, saved_request_id uuid, products jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  saved_id uuid; food jsonb; clean jsonb; field text; code text; fetched timestamptz;
begin
  if jsonb_typeof(products) is distinct from 'array' or jsonb_array_length(products) > 1000 then
    raise exception using errcode = '22023', message = 'Invalid product collection.';
  end if;
  -- Hold the confirmed version stable until publication completes.
  select s.request_id into saved_id from public.restaurant_onboarding s
    where s.restaurant_id = target_restaurant_id for share;
  if saved_request_id is null or saved_id is distinct from saved_request_id then
    raise exception using errcode = '22023', message = 'A confirmed onboarding save is required.';
  end if;
  for food in select value from jsonb_array_elements(products) loop
    code := food#>>'{source,barcode}';
    if food#>>'{source,kind}' is distinct from 'off' or coalesce(code, '') !~ '^[0-9]{8,14}$'
      or food->>'id' is distinct from 'off:' || code then
      raise exception using errcode = '22023', message = 'Invalid provider identity.';
    end if;
    if not exists (select 1 from public.restaurant_ingredients i
      where i.restaurant_id = target_restaurant_id and i.source_kind = 'off'
        and i.client_key = 'off:' || code and i.source_data = food) then
      raise exception using errcode = '22023', message = 'Product was not included in the confirmed save.';
    end if;
    fetched := (food#>>'{source,fetchedAt}')::timestamptz;
    if fetched is null or not isfinite(fetched) or fetched > now() or fetched <= now() - interval '30 days' then
      raise exception using errcode = '22023', message = 'Provider data is not fresh.';
    end if;
    if coalesce(jsonb_typeof(food->'name'), '') <> 'string' or length(btrim(food->>'name')) not between 1 and 500
      or coalesce(jsonb_typeof(food->'detail'), '') <> 'string' or length(food->>'detail') > 2000
      or not (food ? 'basis' and food ? 'preparation')
      or (food->'basis' <> 'null'::jsonb and food->>'basis' not in ('100g', '100ml'))
      or (food->'preparation' <> 'null'::jsonb and food->>'preparation' not in ('as_sold', 'prepared')) then
      raise exception using errcode = '22023', message = 'Invalid provider fields.';
    end if;
    foreach field in array array['energyKcal', 'proteinG', 'fatG', 'carbohydrateG'] loop
      if not food ? field then raise exception using errcode = '22023', message = 'Missing nutrient field.'; end if;
      if food->field <> 'null'::jsonb then
        if jsonb_typeof(food->field) <> 'number' then raise exception using errcode = '22023', message = 'Invalid nutrient type.'; end if;
        if (food->>field)::numeric < 0 or (food->>field)::numeric > 1000000 then
          raise exception using errcode = '22023', message = 'Invalid nutrient value.';
        end if;
      end if;
    end loop;
    -- Explicit allowlist: never retain tenant identifiers, notes or confirmation metadata.
    clean := jsonb_build_object('id', food->'id', 'name', food->'name', 'detail', food->'detail',
      'basis', food->'basis', 'preparation', food->'preparation', 'energyKcal', food->'energyKcal',
      'proteinG', food->'proteinG', 'fatG', food->'fatG', 'carbohydrateG', food->'carbohydrateG',
      'source', jsonb_build_object('kind', 'off', 'barcode', code, 'fetchedAt', food#>'{source,fetchedAt}',
        'modifiedAt', food#>'{source,modifiedAt}'));
    insert into makroklar_private.off_products(barcode, product, fetched_at)
      values (code, clean, fetched)
      on conflict (barcode) do update set product = excluded.product, fetched_at = excluded.fetched_at, cached_at = now()
        where off_products.fetched_at < excluded.fetched_at;
  end loop;
end;
$$;
revoke all on function public.publish_confirmed_off_products(uuid, uuid, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.publish_confirmed_off_products(uuid, uuid, jsonb) to service_role;

-- No backfill from tenant-supplied snapshots, and no trigger touching saved recipes.
commit;
