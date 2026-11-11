-- Persist accepted import metadata separately from recipes and nutrient values.
begin;

-- A CHECK cannot contain a subquery. Validate the small JSON array with a pure,
-- invoker-only function outside the schemas exposed by the Data API.
create function makroklar_private.valid_import_prices(prices jsonb)
returns boolean
language plpgsql
immutable
parallel safe
security invoker
set search_path = ''
as $$
declare
  price jsonb;
  amount numeric;
begin
  if pg_catalog.jsonb_typeof(prices) is distinct from 'array' then
    return false;
  end if;
  if pg_catalog.jsonb_array_length(prices) = 0 then
    return false;
  end if;

  for price in select value from pg_catalog.jsonb_array_elements(prices)
  loop
    if pg_catalog.jsonb_typeof(price) is distinct from 'object' then
      return false;
    end if;
    if pg_catalog.jsonb_typeof(price -> 'name') is distinct from 'string'
      or pg_catalog.jsonb_typeof(price -> 'amount') is distinct from 'number'
      or price - 'name' - 'amount' <> '{}'::jsonb then
      return false;
    end if;
    if price ->> 'name' <> pg_catalog.btrim(price ->> 'name')
      or pg_catalog.btrim(price ->> 'name') = '' then
      return false;
    end if;
    amount := (price ->> 'amount')::numeric;
    if amount < 0 or amount <> pg_catalog.trunc(amount, 2) then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

revoke all on function makroklar_private.valid_import_prices(jsonb)
  from public, anon, authenticated, service_role;
grant usage on schema makroklar_private to service_role;
grant execute on function makroklar_private.valid_import_prices(jsonb)
  to authenticated, service_role;

create table public.dish_import_details (
  dish_id uuid primary key,
  restaurant_id uuid not null,
  sku text not null,
  -- External identifiers are text, matching dishes.source_id; they are not BLS IDs.
  accounting_group_source_id text,
  accounting_group_name text,
  prices jsonb not null,
  -- Zero-based, matching the UI's selectedPriceIndex and the stored array order.
  selected_price_index integer not null,
  currency text not null default 'EUR',
  created_at timestamptz not null default now(),
  constraint dish_import_details_own_dish foreign key (restaurant_id, dish_id)
    references public.dishes (restaurant_id, id) on delete cascade,
  constraint dish_import_details_sku_not_blank check (
    sku = pg_catalog.btrim(sku) and char_length(sku) > 0
  ),
  constraint dish_import_details_group_id_not_blank check (
    accounting_group_source_id is null or (
      accounting_group_source_id = pg_catalog.btrim(accounting_group_source_id)
      and char_length(accounting_group_source_id) > 0
    )
  ),
  constraint dish_import_details_group_name_not_blank check (
    accounting_group_name is null or (
      accounting_group_name = pg_catalog.btrim(accounting_group_name)
      and char_length(accounting_group_name) > 0
    )
  ),
  constraint dish_import_details_prices_valid check (
    makroklar_private.valid_import_prices(prices)
  ),
  constraint dish_import_details_selected_price_valid check (
    case when pg_catalog.jsonb_typeof(prices) = 'array' then
      selected_price_index >= 0
      and selected_price_index < pg_catalog.jsonb_array_length(prices)
    else false end
  ),
  -- The current import UI explicitly displays EUR. Add other currencies only with UI support.
  constraint dish_import_details_currency_supported check (currency = 'EUR')
);

create index dish_import_details_restaurant on public.dish_import_details (restaurant_id);
alter table public.dish_import_details enable row level security;

revoke all on table public.dish_import_details from public, anon, authenticated, service_role;
grant select, delete on table public.dish_import_details to authenticated;
grant insert (dish_id, restaurant_id, sku, accounting_group_source_id,
  accounting_group_name, prices, selected_price_index, currency)
  on public.dish_import_details to authenticated;
grant update (sku, accounting_group_source_id, accounting_group_name,
  prices, selected_price_index, currency)
  on public.dish_import_details to authenticated;
grant select, insert, update, delete on public.dish_import_details to service_role;

create policy dish_import_details_read_own on public.dish_import_details
  for select to authenticated using (
    exists (select 1 from public.restaurant_members as member
      where member.restaurant_id = dish_import_details.restaurant_id
        and member.user_id = (select auth.uid()) and member.role = 'owner')
  );
create policy dish_import_details_insert_own on public.dish_import_details
  for insert to authenticated with check (
    exists (select 1 from public.restaurant_members as member
      where member.restaurant_id = dish_import_details.restaurant_id
        and member.user_id = (select auth.uid()) and member.role = 'owner')
  );
create policy dish_import_details_update_own on public.dish_import_details
  for update to authenticated using (
    exists (select 1 from public.restaurant_members as member
      where member.restaurant_id = dish_import_details.restaurant_id
        and member.user_id = (select auth.uid()) and member.role = 'owner')
  ) with check (
    exists (select 1 from public.restaurant_members as member
      where member.restaurant_id = dish_import_details.restaurant_id
        and member.user_id = (select auth.uid()) and member.role = 'owner')
  );
create policy dish_import_details_delete_own on public.dish_import_details
  for delete to authenticated using (
    exists (select 1 from public.restaurant_members as member
      where member.restaurant_id = dish_import_details.restaurant_id
        and member.user_id = (select auth.uid()) and member.role = 'owner')
  );

commit;
