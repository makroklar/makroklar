-- Run as postgres AFTER 20261110000600. Everything, including the test trigger, rolls back.
begin;

insert into auth.users (id, email) values
  ('f7df0000-0000-4000-8000-000000000001', 'import-rpc-a@example.invalid'),
  ('f7df0000-0000-4000-8000-000000000002', 'import-rpc-b@example.invalid'),
  ('f7df0000-0000-4000-8000-000000000003', 'import-rpc-outsider@example.invalid');
insert into public.restaurants (id, name) values
  ('f7df0000-0000-4000-8000-000000000010', 'Import RPC A'),
  ('f7df0000-0000-4000-8000-000000000011', 'Import RPC A second'),
  ('f7df0000-0000-4000-8000-000000000012', 'Import RPC B');
insert into public.restaurant_members (restaurant_id, user_id) values
  ('f7df0000-0000-4000-8000-000000000010', 'f7df0000-0000-4000-8000-000000000001'),
  ('f7df0000-0000-4000-8000-000000000011', 'f7df0000-0000-4000-8000-000000000001'),
  ('f7df0000-0000-4000-8000-000000000012', 'f7df0000-0000-4000-8000-000000000002');
insert into public.nutrition_datasets
  (id, source, source_version, release_year, content_sha256, file_manifest, source_url, food_count, nutrient_count)
values ('f7df0000-0000-4000-8000-000000000200', 'bls', 'import-rpc-check', 2025,
  repeat('6',64), '[]', 'https://example.invalid', 1, 1);
insert into public.bls_foods (dataset_id, bls_code, name_de, name_en, source_row)
values ('f7df0000-0000-4000-8000-000000000200', 'IMPORT001', 'Zutat Test', 'Ingredient test', 2);
insert into public.restaurant_ingredients (id, restaurant_id, dataset_id, bls_code, name)
values ('f7df0000-0000-4000-8000-000000000201', 'f7df0000-0000-4000-8000-000000000010',
  'f7df0000-0000-4000-8000-000000000200', 'IMPORT001', 'Bestehende Zutat');
insert into public.dishes (id, restaurant_id, name, servings, source, source_id, created_at) values
  ('f7df0000-0000-4000-8000-000000000100', 'f7df0000-0000-4000-8000-000000000010', 'Alter Name', 4, 'lightspeed-k-series', '70001', '2020-01-01T00:00:00Z'),
  ('f7df0000-0000-4000-8000-000000000101', 'f7df0000-0000-4000-8000-000000000010', 'Nicht ausgewählt', 3, 'lightspeed-k-series', '70003', now()),
  ('f7df0000-0000-4000-8000-000000000102', 'f7df0000-0000-4000-8000-000000000010', 'Manuell', 5, null, null, now()),
  ('f7df0000-0000-4000-8000-000000000103', 'f7df0000-0000-4000-8000-000000000012', 'B unverändert', 2, 'lightspeed-k-series', '70001', now());
insert into public.dish_ingredients (restaurant_id, dish_id, ingredient_id, quantity_g)
values ('f7df0000-0000-4000-8000-000000000010', 'f7df0000-0000-4000-8000-000000000100', 'f7df0000-0000-4000-8000-000000000201', 150.75);
insert into public.dish_import_details (dish_id, restaurant_id, sku, prices, selected_price_index, created_at)
values ('f7df0000-0000-4000-8000-000000000100', 'f7df0000-0000-4000-8000-000000000010', 'OLD', '[{"name":"Old","amount":1}]', 0, '2020-01-01T00:00:00Z'),
  ('f7df0000-0000-4000-8000-000000000103', 'f7df0000-0000-4000-8000-000000000012', 'B-UNCHANGED', '[{"name":"Standard","amount":9}]', 0, now());

select set_config('test.import_item', '{"source_id":"70001","name":"Bearbeiteter Name","sku":"SKU-70001",
  "accounting_group_source_id":"901","accounting_group_name":"Hauptgerichte",
  "prices":[{"name":"Standard","amount":24.90},{"name":"Mittag","amount":19.50}],
  "selected_price_index":1,"currency":"EUR"}', true);

do $$
begin
  if (select prosecdef from pg_catalog.pg_proc where oid = 'public.import_lightspeed_items(uuid,jsonb)'::regprocedure)
    or not pg_catalog.has_function_privilege('authenticated', 'public.import_lightspeed_items(uuid,jsonb)', 'execute')
    or pg_catalog.has_function_privilege('anon', 'public.import_lightspeed_items(uuid,jsonb)', 'execute')
    or pg_catalog.has_function_privilege('service_role', 'public.import_lightspeed_items(uuid,jsonb)', 'execute') then
    raise exception 'FAIL: import must use invoker rights and authenticated-only execution.';
  end if;
end;
$$;

set local role authenticated;
set local request.jwt.claim.sub = 'f7df0000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"f7df0000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
declare
  base jsonb := current_setting('test.import_item')::jsonb;
  batch jsonb;
  saved integer;
  item_count integer;
  invalid_payload jsonb;
  invalid_patch jsonb;
  field_name text;
begin
  batch := pg_catalog.jsonb_build_array(base, base || '{"source_id":"70002","name":"Neu","sku":"SKU-70002","selected_price_index":0}'::jsonb);
  saved := public.import_lightspeed_items('f7df0000-0000-4000-8000-000000000010', batch);
  if saved <> 2 then raise exception 'FAIL: import must report the accepted batch size.'; end if;
  saved := public.import_lightspeed_items('f7df0000-0000-4000-8000-000000000010', batch);
  if saved <> 2 or (select count(*) from public.dishes where restaurant_id = 'f7df0000-0000-4000-8000-000000000010') <> 4
    or (select count(*) from public.dish_import_details where restaurant_id = 'f7df0000-0000-4000-8000-000000000010') <> 2 then
    raise exception 'FAIL: retries must not duplicate accepted items or delete unselected dishes.';
  end if;
  if not exists (select 1 from public.dishes where id = 'f7df0000-0000-4000-8000-000000000100'
      and name = 'Bearbeiteter Name' and servings = 4 and created_at = '2020-01-01T00:00:00Z')
    or not exists (select 1 from public.dish_import_details where dish_id = 'f7df0000-0000-4000-8000-000000000100'
      and sku = 'SKU-70001' and selected_price_index = 1 and prices = base -> 'prices'
      and accounting_group_source_id = '901' and accounting_group_name = 'Hauptgerichte'
      and currency = 'EUR' and created_at = '2020-01-01T00:00:00Z')
    or not exists (select 1 from public.dish_ingredients where dish_id = 'f7df0000-0000-4000-8000-000000000100'
      and ingredient_id = 'f7df0000-0000-4000-8000-000000000201' and quantity_g = 150.75)
    or not exists (select 1 from public.dishes where restaurant_id = 'f7df0000-0000-4000-8000-000000000010' and source_id = '70002' and servings = 1)
    or not exists (select 1 from public.dishes where id = 'f7df0000-0000-4000-8000-000000000101' and name = 'Nicht ausgewählt' and servings = 3)
    or not exists (select 1 from public.dishes where id = 'f7df0000-0000-4000-8000-000000000102' and name = 'Manuell' and servings = 5) then
    raise exception 'FAIL: import must retain identities, choices, timestamps, existing recipes and unselected items.';
  end if;
  if not exists (select 1 from pg_catalog.pg_locks where locktype = 'advisory' and pid = pg_catalog.pg_backend_pid() and granted) then
    raise exception 'FAIL: imports must hold a transaction advisory lock.';
  end if;

  -- Same source ID in a second owned restaurant creates an independent dish.
  saved := public.import_lightspeed_items('f7df0000-0000-4000-8000-000000000011', pg_catalog.jsonb_build_array(base));
  if saved <> 1 or not exists (select 1 from public.dishes where restaurant_id = 'f7df0000-0000-4000-8000-000000000011'
      and source_id = '70001' and id <> 'f7df0000-0000-4000-8000-000000000100') then
    raise exception 'FAIL: source identity must be scoped to the selected owned restaurant.';
  end if;

  for invalid_payload in select value from pg_catalog.jsonb_array_elements('[null,{},"text",[],[null],[1],[[]]]'::jsonb) loop
    begin
      perform public.import_lightspeed_items('f7df0000-0000-4000-8000-000000000010', invalid_payload);
      raise exception 'FAIL: malformed or empty batches must be rejected.';
    exception when invalid_parameter_value then null;
    end;
  end loop;
  foreach field_name in array array['source_id','name','sku','prices','selected_price_index','currency'] loop
    begin
      perform public.import_lightspeed_items('f7df0000-0000-4000-8000-000000000010', pg_catalog.jsonb_build_array(base - field_name));
      raise exception 'FAIL: missing required import fields must be rejected.';
    exception when invalid_parameter_value then null;
    end;
  end loop;
  for invalid_patch in select value from pg_catalog.jsonb_array_elements('[
    {"source_id":1},{"source_id":" 70001"},{"name":" "},{"sku":null},
    {"accounting_group_source_id":901},{"accounting_group_name":" "},
    {"currency":"USD"},{"selected_price_index":null},{"selected_price_index":"1"},
    {"selected_price_index":0.5},{"selected_price_index":-1},{"selected_price_index":2},
    {"prices":[{"name":"Bad","amount":1.001}]},
    {"prices":[{"name":"Bad","amount":-1}]},
    {"servings":1},{"restaurant_id":"foreign"},{"source":"other"},{"calories":123}
  ]'::jsonb) loop
    begin
      perform public.import_lightspeed_items('f7df0000-0000-4000-8000-000000000010', pg_catalog.jsonb_build_array(base || invalid_patch));
      raise exception 'FAIL: invalid or unexpected import fields must be rejected.';
    exception when invalid_parameter_value then null;
    end;
  end loop;
  begin
    perform public.import_lightspeed_items('f7df0000-0000-4000-8000-000000000010', pg_catalog.jsonb_build_array(base, base || '{"name":"Duplicate"}'));
    raise exception 'FAIL: duplicate source IDs within one batch must be rejected.';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.import_lightspeed_items('f7df0000-0000-4000-8000-000000000010', null);
    raise exception 'FAIL: SQL NULL batch must be rejected.';
  exception when invalid_parameter_value then null;
  end;

  -- Integer-valued JSON numbers such as 1.0 are valid, fractional selections are not.
  saved := public.import_lightspeed_items('f7df0000-0000-4000-8000-000000000010', pg_catalog.jsonb_build_array(base || '{"selected_price_index":1.0}'));
  if saved <> 1 then raise exception 'FAIL: an explicit integer-valued selection must work.'; end if;
  select count(*) into item_count from public.dishes where restaurant_id = 'f7df0000-0000-4000-8000-000000000010';
  if item_count <> 4 then raise exception 'FAIL: validation failures must leave the batch unchanged.'; end if;

  begin
    perform public.import_lightspeed_items('f7df0000-0000-4000-8000-000000000012', pg_catalog.jsonb_build_array(base));
    raise exception 'FAIL: another owners restaurant must be denied.';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.import_lightspeed_items('f7df0000-0000-4000-8000-000000000999', pg_catalog.jsonb_build_array(base));
    raise exception 'FAIL: an unknown restaurant must not be usable.';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- Force a late metadata failure after an earlier item has already been updated.
-- This trigger is test-only, invisible outside this uncommitted transaction.
reset role;
create function makroklar_private.reject_import_for_check()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.sku = 'TRIGGER-FAIL' then
    raise exception using errcode = '23514', message = 'Expected synthetic metadata failure.';
  end if;
  return new;
end;
$$;
create trigger import_atomicity_check before insert or update on public.dish_import_details
for each row execute function makroklar_private.reject_import_for_check();
set local role authenticated;
do $$
declare
  before_rows jsonb;
  after_rows jsonb;
  base jsonb := current_setting('test.import_item')::jsonb;
begin
  select pg_catalog.jsonb_build_object('dish', to_jsonb(d), 'details', to_jsonb(i)) into before_rows
  from public.dishes d join public.dish_import_details i on i.dish_id = d.id
  where d.id = 'f7df0000-0000-4000-8000-000000000100';
  begin
    perform public.import_lightspeed_items('f7df0000-0000-4000-8000-000000000010', pg_catalog.jsonb_build_array(
      base || '{"name":"SHOULD ROLL BACK"}', base || '{"source_id":"70004","sku":"TRIGGER-FAIL"}'
    ));
    raise exception 'FAIL: the synthetic late metadata failure did not occur.';
  exception when check_violation then null;
  end;
  select pg_catalog.jsonb_build_object('dish', to_jsonb(d), 'details', to_jsonb(i)) into after_rows
  from public.dishes d join public.dish_import_details i on i.dish_id = d.id
  where d.id = 'f7df0000-0000-4000-8000-000000000100';
  if before_rows is distinct from after_rows
    or exists (select 1 from public.dishes where restaurant_id = 'f7df0000-0000-4000-8000-000000000010' and source_id = '70004') then
    raise exception 'FAIL: a late failure must undo earlier updates, the new dish and its metadata.';
  end if;
end;
$$;

set local request.jwt.claim.sub = 'f7df0000-0000-4000-8000-000000000002';
set local request.jwt.claims = '{"sub":"f7df0000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
begin
  if (select count(*) from public.dishes) <> 1
    or not exists (select 1 from public.dishes where id = 'f7df0000-0000-4000-8000-000000000103' and name = 'B unverändert' and servings = 2)
    or not exists (select 1 from public.dish_import_details where dish_id = 'f7df0000-0000-4000-8000-000000000103' and sku = 'B-UNCHANGED') then
    raise exception 'FAIL: rejected imports changed foreign restaurant data.';
  end if;
end;
$$;
set local request.jwt.claim.sub = 'f7df0000-0000-4000-8000-000000000003';
set local request.jwt.claims = '{"sub":"f7df0000-0000-4000-8000-000000000003","role":"authenticated"}';
do $$
begin
  begin
    perform public.import_lightspeed_items('f7df0000-0000-4000-8000-000000000010', pg_catalog.jsonb_build_array(current_setting('test.import_item')::jsonb));
    raise exception 'FAIL: an account without membership must not import.';
  exception when insufficient_privilege then null;
  end;
end;
$$;
set local request.jwt.claim.sub = '';
set local request.jwt.claims = '{}';
do $$
begin
  begin
    perform public.import_lightspeed_items('f7df0000-0000-4000-8000-000000000010', pg_catalog.jsonb_build_array(current_setting('test.import_item')::jsonb));
    raise exception 'FAIL: a missing identity must not import.';
  exception when invalid_authorization_specification then null;
  end;
end;
$$;
set local role anon;
do $$
begin
  begin
    perform public.import_lightspeed_items('f7df0000-0000-4000-8000-000000000010', '[]');
    raise exception 'FAIL: visitors must not execute the import RPC.';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
set constraints all immediate;
do $$ begin
  raise notice 'PASS: atomic import, retry-safe source IDs, recipe preservation, explicit prices, validation, grants and tenant isolation.';
end; $$;
rollback;
