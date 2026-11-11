-- Write reviewed menu items and their metadata atomically under the caller's RLS.
begin;

create function public.import_lightspeed_items(
  target_restaurant_id uuid,
  imported_items jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item jsonb;
  group_key text;
  selected_index numeric;
  saved_dish_id uuid;
  item_count integer;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'Sign-in is required.';
  end if;
  if not exists (
    select 1 from public.restaurant_members as member
    where member.restaurant_id = target_restaurant_id
      and member.user_id = auth.uid() and member.role = 'owner'
  ) then
    raise exception using errcode = '42501', message = 'Restaurant access is required.';
  end if;
  if pg_catalog.jsonb_typeof(imported_items) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Reviewed items must be an array.';
  end if;
  item_count := pg_catalog.jsonb_array_length(imported_items);
  if item_count = 0 then
    raise exception using errcode = '22023', message = 'At least one reviewed item is required.';
  end if;

  -- Validate the whole batch before taking the per-restaurant write lock.
  for item in select value from pg_catalog.jsonb_array_elements(imported_items)
  loop
    if pg_catalog.jsonb_typeof(item) is distinct from 'object' then
      raise exception using errcode = '22023', message = 'Each reviewed item must be an object.';
    end if;
    if item - array['source_id', 'name', 'sku', 'accounting_group_source_id',
      'accounting_group_name', 'prices', 'selected_price_index', 'currency'] <> '{}'::jsonb then
      raise exception using errcode = '22023', message = 'Unexpected reviewed item field.';
    end if;
    foreach group_key in array array['source_id', 'name', 'sku'] loop
      if pg_catalog.jsonb_typeof(item -> group_key) is distinct from 'string' then
        raise exception using errcode = '22023', message = 'Item identity, name and SKU must be strings.';
      end if;
      if item ->> group_key = '' or item ->> group_key <> pg_catalog.btrim(item ->> group_key) then
        raise exception using errcode = '22023', message = 'Item identity, name and SKU must be trimmed and nonempty.';
      end if;
    end loop;
    foreach group_key in array array['accounting_group_source_id', 'accounting_group_name'] loop
      if item ? group_key and item -> group_key <> 'null'::jsonb then
        if pg_catalog.jsonb_typeof(item -> group_key) is distinct from 'string' then
          raise exception using errcode = '22023', message = 'Accounting group values must be strings or null.';
        end if;
        if item ->> group_key = '' or item ->> group_key <> pg_catalog.btrim(item ->> group_key) then
          raise exception using errcode = '22023', message = 'Accounting group values must be trimmed and nonempty.';
        end if;
      end if;
    end loop;
    if item -> 'currency' is distinct from '"EUR"'::jsonb then
      raise exception using errcode = '22023', message = 'Reviewed prices require EUR.';
    end if;
    if not makroklar_private.valid_import_prices(item -> 'prices') then
      raise exception using errcode = '22023', message = 'Reviewed prices are invalid.';
    end if;
    if pg_catalog.jsonb_typeof(item -> 'selected_price_index') is distinct from 'number' then
      raise exception using errcode = '22023', message = 'An explicit price selection is required.';
    end if;
    selected_index := (item ->> 'selected_price_index')::numeric;
    if selected_index <> pg_catalog.trunc(selected_index) or selected_index < 0
      or selected_index >= pg_catalog.jsonb_array_length(item -> 'prices') then
      raise exception using errcode = '22023', message = 'Price selection is outside the available options.';
    end if;
  end loop;

  if (select count(distinct value ->> 'source_id')
      from pg_catalog.jsonb_array_elements(imported_items)) <> item_count then
    raise exception using errcode = '22023', message = 'Source identities must be unique within the batch.';
  end if;

  -- Serialize overlapping imports for this restaurant. Other restaurants are independent.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('makroklar:lightspeed-import:' || target_restaurant_id::text, 0)
  );

  for item in select value from pg_catalog.jsonb_array_elements(imported_items)
  loop
    insert into public.dishes (restaurant_id, name, source, source_id)
    values (target_restaurant_id, item ->> 'name', 'lightspeed-k-series', item ->> 'source_id')
    on conflict on constraint dishes_import_identity do update
      set name = excluded.name
    returning id into saved_dish_id;

    insert into public.dish_import_details
      (dish_id, restaurant_id, sku, accounting_group_source_id,
       accounting_group_name, prices, selected_price_index, currency)
    values
      (saved_dish_id, target_restaurant_id, item ->> 'sku',
       item ->> 'accounting_group_source_id', item ->> 'accounting_group_name',
       item -> 'prices', ((item ->> 'selected_price_index')::numeric)::integer, 'EUR')
    on conflict (dish_id) do update set
      sku = excluded.sku,
      accounting_group_source_id = excluded.accounting_group_source_id,
      accounting_group_name = excluded.accounting_group_name,
      prices = excluded.prices,
      selected_price_index = excluded.selected_price_index,
      currency = excluded.currency;
  end loop;

  return item_count;
end;
$$;

revoke all on function public.import_lightspeed_items(uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.import_lightspeed_items(uuid, jsonb) to authenticated;

commit;
