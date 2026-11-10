-- Run as postgres AFTER 20261110000500. Fixtures have no login credentials and roll back.
begin;

insert into auth.users (id, email) values
  ('f7de0000-0000-4000-8000-000000000001', 'import-details-a@example.invalid'),
  ('f7de0000-0000-4000-8000-000000000002', 'import-details-b@example.invalid'),
  ('f7de0000-0000-4000-8000-000000000003', 'import-details-outsider@example.invalid');
insert into public.restaurants (id, name) values
  ('f7de0000-0000-4000-8000-000000000010', 'Import details A'),
  ('f7de0000-0000-4000-8000-000000000011', 'Import details A second'),
  ('f7de0000-0000-4000-8000-000000000012', 'Import details B');
insert into public.restaurant_members (restaurant_id, user_id) values
  ('f7de0000-0000-4000-8000-000000000010', 'f7de0000-0000-4000-8000-000000000001'),
  ('f7de0000-0000-4000-8000-000000000011', 'f7de0000-0000-4000-8000-000000000001'),
  ('f7de0000-0000-4000-8000-000000000012', 'f7de0000-0000-4000-8000-000000000002');
insert into public.dishes (id, restaurant_id, name, source, source_id) values
  ('f7de0000-0000-4000-8000-000000000100', 'f7de0000-0000-4000-8000-000000000010', 'Gericht A', 'lightspeed-k-series', '70001'),
  ('f7de0000-0000-4000-8000-000000000101', 'f7de0000-0000-4000-8000-000000000011', 'Gericht A second', 'lightspeed-k-series', '70001'),
  ('f7de0000-0000-4000-8000-000000000102', 'f7de0000-0000-4000-8000-000000000012', 'Gericht B', 'lightspeed-k-series', '70001'),
  ('f7de0000-0000-4000-8000-000000000103', 'f7de0000-0000-4000-8000-000000000010', 'Validation target', 'lightspeed-k-series', '70002');
insert into public.dish_import_details (dish_id, restaurant_id, sku, prices, selected_price_index)
values ('f7de0000-0000-4000-8000-000000000102', 'f7de0000-0000-4000-8000-000000000012', 'B-001', '[{"name":"Standard","amount":12.90}]', 0);

do $$
begin
  if not (select relrowsecurity from pg_catalog.pg_class where oid = 'public.dish_import_details'::regclass)
    or (select count(*) from pg_catalog.pg_policy where polrelid = 'public.dish_import_details'::regclass) <> 4 then
    raise exception 'FAIL: import details must have RLS and four owner policies.';
  end if;
  if pg_catalog.has_table_privilege('anon', 'public.dish_import_details', 'select')
    or pg_catalog.has_table_privilege('anon', 'public.dish_import_details', 'delete')
    or pg_catalog.has_any_column_privilege('anon', 'public.dish_import_details', 'insert')
    or pg_catalog.has_any_column_privilege('anon', 'public.dish_import_details', 'update') then
    raise exception 'FAIL: visitors must have no import-detail data privileges.';
  end if;
  if pg_catalog.has_function_privilege('anon', 'makroklar_private.valid_import_prices(jsonb)', 'execute')
    or not pg_catalog.has_function_privilege('authenticated', 'makroklar_private.valid_import_prices(jsonb)', 'execute')
    or not pg_catalog.has_function_privilege('service_role', 'makroklar_private.valid_import_prices(jsonb)', 'execute')
    or pg_catalog.has_function_privilege('service_role', 'makroklar_private.create_restaurant(text)', 'execute') then
    raise exception 'FAIL: validator grants must not expose data or broaden restaurant creation.';
  end if;
end;
$$;

set local role authenticated;
set local request.jwt.claim.sub = 'f7de0000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"f7de0000-0000-4000-8000-000000000001","role":"authenticated"}';

insert into public.dish_import_details
  (dish_id, restaurant_id, sku, accounting_group_source_id, accounting_group_name, prices, selected_price_index)
values ('f7de0000-0000-4000-8000-000000000100', 'f7de0000-0000-4000-8000-000000000010', 'A-001', '901', 'Hauptgerichte',
  '[{"name":"Standard","amount":24.90},{"name":"Mittag","amount":19.50}]', 1),
  ('f7de0000-0000-4000-8000-000000000101', 'f7de0000-0000-4000-8000-000000000011', 'A-001', null, null,
  '[{"name":"Kostenlos","amount":0}]', 0);

do $$
declare
  affected integer;
  invalid_prices jsonb;
  invalid_index integer;
  column_name text;
begin
  if (select count(*) from public.dish_import_details) <> 2
    or (select currency from public.dish_import_details where sku = 'A-001' and accounting_group_source_id = '901') <> 'EUR'
    or (select prices -> selected_price_index ->> 'name' from public.dish_import_details where accounting_group_source_id = '901') <> 'Mittag' then
    raise exception 'FAIL: owner must see both own restaurants with explicit selected price and EUR default.';
  end if;

  update public.dish_import_details
    set prices = '[{"name":"Standard","amount":25.90},{"name":"Mittag","amount":20.50}]', selected_price_index = 0
    where dish_id = 'f7de0000-0000-4000-8000-000000000100';
  if (select prices -> selected_price_index ->> 'amount' from public.dish_import_details
      where dish_id = 'f7de0000-0000-4000-8000-000000000100')::numeric <> 25.90 then
    raise exception 'FAIL: the edited amount and changed selection must be retained together.';
  end if;

  update public.dish_import_details set sku = 'Hijacked' where dish_id = 'f7de0000-0000-4000-8000-000000000102';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: updating foreign import details must affect no rows.'; end if;
  delete from public.dish_import_details where dish_id = 'f7de0000-0000-4000-8000-000000000102';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: deleting foreign import details must affect no rows.'; end if;

  begin
    insert into public.dish_import_details (dish_id, restaurant_id, sku, prices, selected_price_index)
    values ('f7de0000-0000-4000-8000-000000000103', 'f7de0000-0000-4000-8000-000000000012', 'Spoofed', '[{"name":"Standard","amount":1}]', 0);
    raise exception 'FAIL: inserting under a foreign restaurant must be denied.';
  exception when insufficient_privilege then null;
  end;

  -- A fresh details identity proves the composite FK, without a primary-key conflict.
  begin
    insert into public.dish_import_details (dish_id, restaurant_id, sku, prices, selected_price_index)
    values ('f7de0000-0000-4000-8000-000000000103', 'f7de0000-0000-4000-8000-000000000011', 'Mixed fresh', '[{"name":"Standard","amount":1}]', 0);
    raise exception 'FAIL: the tenant/dish composite FK must reject a mixed reference.';
  exception when foreign_key_violation then null;
  end;
  begin
    insert into public.dish_import_details (dish_id, restaurant_id, sku, prices, selected_price_index)
    values ('f7de0000-0000-4000-8000-000000000999', 'f7de0000-0000-4000-8000-000000000010', 'Orphan', '[{"name":"Standard","amount":1}]', 0);
    raise exception 'FAIL: metadata for a nonexistent dish must be rejected.';
  exception when foreign_key_violation then null;
  end;
  begin
    insert into public.dish_import_details (dish_id, restaurant_id, sku, prices, selected_price_index)
    values ('f7de0000-0000-4000-8000-000000000100', 'f7de0000-0000-4000-8000-000000000010', 'Duplicate', '[{"name":"Standard","amount":1}]', 0);
    raise exception 'FAIL: only one details row per dish is allowed.';
  exception when unique_violation then null;
  end;

  foreach column_name in array array['dish_id', 'restaurant_id', 'created_at'] loop
    begin
      execute pg_catalog.format('update public.dish_import_details set %I = %I where dish_id = %L::uuid', column_name, column_name, 'f7de0000-0000-4000-8000-000000000100');
      raise exception 'FAIL: protected import-detail columns must not be directly updated.';
    exception when insufficient_privilege then null;
    end;
  end loop;
  begin
    insert into public.dish_import_details (dish_id, restaurant_id, sku, prices, selected_price_index, created_at)
    values ('f7de0000-0000-4000-8000-000000000103', 'f7de0000-0000-4000-8000-000000000010', 'Timestamp spoof', '[{"name":"Standard","amount":1}]', 0, now());
    raise exception 'FAIL: clients must not supply created_at.';
  exception when insufficient_privilege then null;
  end;

  for invalid_prices in select value from pg_catalog.jsonb_array_elements('[
    null, {}, "text", [], [null], [1], ["price"],
    [{"name":"Standard"}], [{"amount":1}], [{"name":null,"amount":1}],
    [{"name":"","amount":1}], [{"name":" Standard","amount":1}],
    [{"name":5,"amount":1}], [{"name":"Standard","amount":"12.50"}],
    [{"name":"Standard","amount":null}], [{"name":"Standard","amount":"NaN"}],
    [{"name":"Standard","amount":-1}], [{"name":"Standard","amount":1.001}],
    [{"name":"Standard","amount":1,"unexpected":true}],
    [{"name":"Valid","amount":1},{"name":"Other","amount":-1}]
  ]'::jsonb) loop
    begin
      update public.dish_import_details set prices = invalid_prices, selected_price_index = 0
      where dish_id = 'f7de0000-0000-4000-8000-000000000100';
      raise exception 'FAIL: malformed/negative/fractional price options must be rejected.';
    exception when check_violation then null;
    end;
  end loop;
  foreach invalid_index in array array[-1, 2] loop
    begin
      update public.dish_import_details set selected_price_index = invalid_index
      where dish_id = 'f7de0000-0000-4000-8000-000000000100';
      raise exception 'FAIL: a selection outside the price array must be rejected.';
    exception when check_violation then null;
    end;
  end loop;
  begin
    update public.dish_import_details set selected_price_index = null
    where dish_id = 'f7de0000-0000-4000-8000-000000000100';
    raise exception 'FAIL: accepted imports require an explicit selected price.';
  exception when not_null_violation then null;
  end;
  begin
    update public.dish_import_details set prices = null
    where dish_id = 'f7de0000-0000-4000-8000-000000000100';
    raise exception 'FAIL: SQL NULL prices must be rejected.';
  exception when not_null_violation then null;
  end;
  begin
    insert into public.dish_import_details (dish_id, restaurant_id, sku, prices)
    values ('f7de0000-0000-4000-8000-000000000103', 'f7de0000-0000-4000-8000-000000000010', 'No selection', '[{"name":"First","amount":1},{"name":"Second","amount":2}]');
    raise exception 'FAIL: persistence must not silently choose the first price.';
  exception when not_null_violation then null;
  end;
  update public.dish_import_details set selected_price_index = 1
  where dish_id = 'f7de0000-0000-4000-8000-000000000100';
  begin
    update public.dish_import_details set prices = '[{"name":"Only option","amount":1}]'
    where dish_id = 'f7de0000-0000-4000-8000-000000000100';
    raise exception 'FAIL: removing the selected option requires a new valid selection in the same update.';
  exception when check_violation then null;
  end;

  foreach column_name in array array['sku', 'accounting_group_source_id', 'accounting_group_name'] loop
    begin
      execute pg_catalog.format('update public.dish_import_details set %I = %L where dish_id = %L::uuid', column_name, ' ', 'f7de0000-0000-4000-8000-000000000100');
      raise exception 'FAIL: blank import labels/identifiers must be rejected.';
    exception when check_violation then null;
    end;
  end loop;
  begin
    update public.dish_import_details set currency = 'USD'
    where dish_id = 'f7de0000-0000-4000-8000-000000000100';
    raise exception 'FAIL: the EUR-only UI must not silently accept another currency.';
  exception when check_violation then null;
  end;

  -- Removing metadata must leave the recipe intact, and allow a later re-import.
  delete from public.dish_import_details where dish_id = 'f7de0000-0000-4000-8000-000000000101';
  get diagnostics affected = row_count;
  if affected <> 1 or not exists (select 1 from public.dishes where id = 'f7de0000-0000-4000-8000-000000000101') then
    raise exception 'FAIL: deleting metadata must preserve its dish.';
  end if;
  insert into public.dish_import_details (dish_id, restaurant_id, sku, prices, selected_price_index)
  values ('f7de0000-0000-4000-8000-000000000101', 'f7de0000-0000-4000-8000-000000000011', 'A-001', '[{"name":"Kostenlos","amount":0}]', 0);
end;
$$;

set local request.jwt.claim.sub = 'f7de0000-0000-4000-8000-000000000002';
set local request.jwt.claims = '{"sub":"f7de0000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
begin
  if (select count(*) from public.dish_import_details) <> 1
    or (select sku from public.dish_import_details) <> 'B-001' then
    raise exception 'FAIL: owner B must see only unchanged B metadata.';
  end if;
end;
$$;
set local request.jwt.claim.sub = 'f7de0000-0000-4000-8000-000000000003';
set local request.jwt.claims = '{"sub":"f7de0000-0000-4000-8000-000000000003","role":"authenticated"}';
do $$
begin
  if exists (select 1 from public.dish_import_details) then
    raise exception 'FAIL: a non-owner must see no import details.';
  end if;
  begin
    insert into public.dish_import_details (dish_id, restaurant_id, sku, prices, selected_price_index)
    values ('f7de0000-0000-4000-8000-000000000103', 'f7de0000-0000-4000-8000-000000000010', 'Outsider', '[{"name":"Standard","amount":1}]', 0);
    raise exception 'FAIL: a non-owner must not create import details.';
  exception when insufficient_privilege then null;
  end;
end;
$$;

set local role anon;
do $$
begin
  begin
    perform 1 from public.dish_import_details;
    raise exception 'FAIL: visitors must not read import details.';
  exception when insufficient_privilege then null;
  end;
end;
$$;

set local role service_role;
do $$
begin
  if (select count(*) from public.dish_import_details where restaurant_id in (
    'f7de0000-0000-4000-8000-000000000010', 'f7de0000-0000-4000-8000-000000000011', 'f7de0000-0000-4000-8000-000000000012'
  )) <> 3 then
    raise exception 'FAIL: service_role must retain administrative read access.';
  end if;
end;
$$;
insert into public.dish_import_details (dish_id, restaurant_id, sku, prices, selected_price_index)
values ('f7de0000-0000-4000-8000-000000000103', 'f7de0000-0000-4000-8000-000000000010', 'Admin', '[{"name":"Standard","amount":1}]', 0);
delete from public.dish_import_details where dish_id = 'f7de0000-0000-4000-8000-000000000103';

-- Dish deletion cascades to details; restaurant deletion also traverses dishes.
set local role authenticated;
set local request.jwt.claim.sub = 'f7de0000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"f7de0000-0000-4000-8000-000000000001","role":"authenticated"}';
delete from public.dishes where id = 'f7de0000-0000-4000-8000-000000000100';
do $$
begin
  if exists (select 1 from public.dish_import_details where dish_id = 'f7de0000-0000-4000-8000-000000000100') then
    raise exception 'FAIL: dish deletion must remove import metadata.';
  end if;
end;
$$;
reset role;
delete from public.restaurants where id = 'f7de0000-0000-4000-8000-000000000011';
do $$
begin
  if exists (select 1 from public.dish_import_details where dish_id = 'f7de0000-0000-4000-8000-000000000101') then
    raise exception 'FAIL: restaurant deletion must cascade to import details.';
  end if;
  raise notice 'PASS: import metadata ownership, tenant FK, prices, selected index, protected columns, grants and cascades.';
end;
$$;

rollback;
