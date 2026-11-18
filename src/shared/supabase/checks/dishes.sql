-- Run as postgres AFTER the dishes migration. All fixtures end in ROLLBACK.
begin;

insert into auth.users (id, email) values
  ('f7dd0000-0000-4000-8000-000000000001', 'dishes-a@example.invalid'),
  ('f7dd0000-0000-4000-8000-000000000002', 'dishes-b@example.invalid'),
  ('f7dd0000-0000-4000-8000-000000000003', 'dishes-outsider@example.invalid');
insert into public.restaurants (id, name) values
  ('f7dd0000-0000-4000-8000-000000000010', 'Dishes check A'),
  ('f7dd0000-0000-4000-8000-000000000011', 'Dishes check A second'),
  ('f7dd0000-0000-4000-8000-000000000012', 'Dishes check B');
insert into public.restaurant_members (restaurant_id, user_id) values
  ('f7dd0000-0000-4000-8000-000000000010', 'f7dd0000-0000-4000-8000-000000000001'),
  ('f7dd0000-0000-4000-8000-000000000011', 'f7dd0000-0000-4000-8000-000000000001'),
  ('f7dd0000-0000-4000-8000-000000000012', 'f7dd0000-0000-4000-8000-000000000002');

insert into public.nutrition_datasets
  (id, source, source_version, release_year, content_sha256, file_manifest, source_url, food_count, nutrient_count)
values ('f7dd0000-0000-4000-8000-000000000200', 'bls', 'dishes-check', 2025,
  repeat('4',64), '[]', 'https://example.invalid', 2, 1);
insert into public.bls_foods (dataset_id, bls_code, name_de, name_en, source_row) values
  ('f7dd0000-0000-4000-8000-000000000200', 'DISH001', 'Hafer Test', 'Oats test', 2),
  ('f7dd0000-0000-4000-8000-000000000200', 'DISH002', 'Tomate Test', 'Tomato test', 3);
insert into public.restaurant_ingredients (id, restaurant_id, dataset_id, bls_code, name) values
  ('f7dd0000-0000-4000-8000-000000000100', 'f7dd0000-0000-4000-8000-000000000010', 'f7dd0000-0000-4000-8000-000000000200', 'DISH001', 'Hafer A'),
  ('f7dd0000-0000-4000-8000-000000000101', 'f7dd0000-0000-4000-8000-000000000010', 'f7dd0000-0000-4000-8000-000000000200', 'DISH002', 'Tomate A'),
  ('f7dd0000-0000-4000-8000-000000000102', 'f7dd0000-0000-4000-8000-000000000011', 'f7dd0000-0000-4000-8000-000000000200', 'DISH001', 'Hafer A second'),
  ('f7dd0000-0000-4000-8000-000000000103', 'f7dd0000-0000-4000-8000-000000000012', 'f7dd0000-0000-4000-8000-000000000200', 'DISH001', 'Hafer B');

set local role authenticated;
set local request.jwt.claim.sub = 'f7dd0000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"f7dd0000-0000-4000-8000-000000000001","role":"authenticated"}';
with dish as (
  insert into public.dishes (restaurant_id, name)
  values ('f7dd0000-0000-4000-8000-000000000010', 'Manuelles Gericht') returning id, created_at
)
select set_config('test.dish_a', id::text, true),
  set_config('test.dish_a_created_at', created_at::text, true) from dish;
with dish as (
  insert into public.dishes (restaurant_id, name, servings, source, source_id)
  values ('f7dd0000-0000-4000-8000-000000000010', 'Importiertes Gericht', 4, 'lightspeed-k-series', '70001') returning id
)
select set_config('test.dish_import_a', id::text, true) from dish;
with dish as (
  insert into public.dishes (restaurant_id, name, source, source_id)
  values ('f7dd0000-0000-4000-8000-000000000011', 'Gleiche Quell-ID, anderer Betrieb', 'lightspeed-k-series', '70001') returning id
)
select set_config('test.dish_a2', id::text, true) from dish;
insert into public.dish_ingredients (restaurant_id, dish_id, ingredient_id, quantity_g) values
  ('f7dd0000-0000-4000-8000-000000000010', current_setting('test.dish_a')::uuid, 'f7dd0000-0000-4000-8000-000000000100', 125.5),
  ('f7dd0000-0000-4000-8000-000000000010', current_setting('test.dish_a')::uuid, 'f7dd0000-0000-4000-8000-000000000101', 50.25),
  ('f7dd0000-0000-4000-8000-000000000011', current_setting('test.dish_a2')::uuid, 'f7dd0000-0000-4000-8000-000000000102', 20);

set local request.jwt.claim.sub = 'f7dd0000-0000-4000-8000-000000000002';
set local request.jwt.claims = '{"sub":"f7dd0000-0000-4000-8000-000000000002","role":"authenticated"}';
with dish as (
  insert into public.dishes (restaurant_id, name, source, source_id)
  values ('f7dd0000-0000-4000-8000-000000000012', 'Gericht B', 'lightspeed-k-series', '70001') returning id
)
select set_config('test.dish_b', id::text, true) from dish;
insert into public.dish_ingredients (restaurant_id, dish_id, ingredient_id, quantity_g)
values ('f7dd0000-0000-4000-8000-000000000012', current_setting('test.dish_b')::uuid, 'f7dd0000-0000-4000-8000-000000000103', 100);

do $$
declare affected integer;
begin
  if (select count(*) from public.dishes) <> 1 or (select count(*) from public.dish_ingredients) <> 1 then
    raise exception 'FAIL: B must see only their own dish and recipe.';
  end if;
  update public.dishes set name = 'Hijacked' where id = current_setting('test.dish_a')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: B updated A dish.'; end if;
  delete from public.dishes where id = current_setting('test.dish_a')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: B deleted A dish.'; end if;
  update public.dish_ingredients set quantity_g = 999 where dish_id = current_setting('test.dish_a')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: B updated A recipe.'; end if;
  delete from public.dish_ingredients where dish_id = current_setting('test.dish_a')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: B deleted A recipe.'; end if;
end;
$$;

set local request.jwt.claim.sub = 'f7dd0000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"f7dd0000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
declare invalid text; command text; affected integer;
begin
  if (select count(*) from public.dishes) <> 3 or (select count(*) from public.dish_ingredients) <> 3 then
    raise exception 'FAIL: A must see both owned restaurants, excluding B.';
  end if;
  if (select servings from public.dishes where id = current_setting('test.dish_a')::uuid) <> 1
    or exists (select 1 from public.dish_ingredients where dish_id = current_setting('test.dish_import_a')::uuid) then
    raise exception 'FAIL: default is one serving; dishes may start without ingredients.';
  end if;
  -- Multiple manual dishes have no external identity and remain distinct.
  insert into public.dishes (restaurant_id, name) values ('f7dd0000-0000-4000-8000-000000000010', 'Zweiter Entwurf');
  delete from public.dishes where name = 'Zweiter Entwurf';
  begin
    insert into public.dishes (restaurant_id, name, source, source_id)
    values ('f7dd0000-0000-4000-8000-000000000010', 'Duplicate', 'lightspeed-k-series', '70001');
    raise exception 'FAIL: duplicate import identity was accepted.';
  exception when unique_violation then null;
  end;
  begin
    insert into public.dish_ingredients (restaurant_id, dish_id, ingredient_id, quantity_g)
    values ('f7dd0000-0000-4000-8000-000000000010', current_setting('test.dish_a')::uuid, 'f7dd0000-0000-4000-8000-000000000100', 1);
    raise exception 'FAIL: duplicate ingredient in a recipe was accepted.';
  exception when unique_violation then null;
  end;

  foreach invalid in array array['0','-1','1.5','NaN','Infinity','-Infinity'] loop
    begin
      update public.dishes set servings = invalid::numeric where id = current_setting('test.dish_a')::uuid;
      raise exception 'FAIL: invalid serving count was accepted: %', invalid;
    exception when check_violation then null;
    end;
  end loop;
  foreach invalid in array array['0','-1','NaN','Infinity','-Infinity'] loop
    begin
      update public.dish_ingredients set quantity_g = invalid::numeric
      where dish_id = current_setting('test.dish_a')::uuid and ingredient_id = 'f7dd0000-0000-4000-8000-000000000100';
      raise exception 'FAIL: invalid quantity was accepted: %', invalid;
    exception when check_violation then null;
    end;
  end loop;
  foreach invalid in array array['','   ',' Padded '] loop
    begin
      update public.dishes set name = invalid where id = current_setting('test.dish_a')::uuid;
      raise exception 'FAIL: invalid dish name was accepted.';
    exception when check_violation then null;
    end;
  end loop;
  foreach command in array array[
    'insert into public.dishes (restaurant_id,name,source) values (''f7dd0000-0000-4000-8000-000000000010'',''Bad source'',''lightspeed-k-series'')',
    'insert into public.dishes (restaurant_id,name,source_id) values (''f7dd0000-0000-4000-8000-000000000010'',''Bad source'',''70002'')',
    'insert into public.dishes (restaurant_id,name,source,source_id) values (''f7dd0000-0000-4000-8000-000000000010'',''Bad source'',''unknown'',''70002'')',
    'insert into public.dishes (restaurant_id,name,source,source_id) values (''f7dd0000-0000-4000-8000-000000000010'',''Bad source'',''lightspeed-k-series'',''  '')'
  ] loop
    begin execute command; raise exception 'FAIL: invalid import identity was accepted.';
    exception when check_violation then null;
    end;
  end loop;

  -- Deny key/ownership/import-identity changes even for rows owned by A.
  foreach command in array array[
    format('update public.dishes set id=gen_random_uuid() where id=%L', current_setting('test.dish_a')),
    format('update public.dishes set restaurant_id=%L where id=%L', 'f7dd0000-0000-4000-8000-000000000011', current_setting('test.dish_a')),
    format('update public.dishes set source_id=%L where id=%L', '70002', current_setting('test.dish_import_a')),
    format('update public.dishes set source=null where id=%L', current_setting('test.dish_import_a')),
    format('update public.dishes set created_at=now() where id=%L', current_setting('test.dish_a')),
    format('update public.dish_ingredients set restaurant_id=%L where dish_id=%L', 'f7dd0000-0000-4000-8000-000000000011', current_setting('test.dish_a')),
    format('update public.dish_ingredients set dish_id=%L where dish_id=%L', current_setting('test.dish_import_a'), current_setting('test.dish_a')),
    format('update public.dish_ingredients set ingredient_id=%L where dish_id=%L', 'f7dd0000-0000-4000-8000-000000000102', current_setting('test.dish_a'))
  ] loop
    begin execute command; raise exception 'FAIL: protected column update was allowed.';
    exception when insufficient_privilege then null;
    end;
  end loop;

  -- Cross-restaurant FKs also apply when A owns BOTH restaurants.
  foreach invalid in array array['f7dd0000-0000-4000-8000-000000000102','f7dd0000-0000-4000-8000-000000000103'] loop
    begin
      insert into public.dish_ingredients (restaurant_id, dish_id, ingredient_id, quantity_g)
      values ('f7dd0000-0000-4000-8000-000000000010', current_setting('test.dish_a')::uuid, invalid::uuid, 10);
      set constraints public.dish_ingredients_own_ingredient immediate;
      raise exception 'FAIL: ingredient from another restaurant was accepted.';
    exception when foreign_key_violation then null;
    end;
  end loop;
  foreach invalid in array array[current_setting('test.dish_a2'),current_setting('test.dish_b')] loop
    begin
      insert into public.dish_ingredients (restaurant_id, dish_id, ingredient_id, quantity_g)
      values ('f7dd0000-0000-4000-8000-000000000010', invalid::uuid, 'f7dd0000-0000-4000-8000-000000000100', 10);
      raise exception 'FAIL: dish from another restaurant was accepted.';
    exception when foreign_key_violation then null;
    end;
  end loop;
  begin
    insert into public.dishes (restaurant_id, name) values ('f7dd0000-0000-4000-8000-000000000012', 'Injected');
    raise exception 'FAIL: A inserted a dish into B restaurant.';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.dish_ingredients (restaurant_id, dish_id, ingredient_id, quantity_g)
    values ('f7dd0000-0000-4000-8000-000000000012', current_setting('test.dish_b')::uuid, 'f7dd0000-0000-4000-8000-000000000103', 10);
    raise exception 'FAIL: A inserted a recipe into B restaurant.';
  exception when insufficient_privilege then null;
  end;

  update public.dishes set name = 'Hafergericht', servings = 4 where id = current_setting('test.dish_a')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'FAIL: own dish update was denied.'; end if;
  update public.dish_ingredients set quantity_g = 150.75
    where dish_id = current_setting('test.dish_a')::uuid and ingredient_id = 'f7dd0000-0000-4000-8000-000000000100';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'FAIL: own quantity update was denied.'; end if;
  begin
    delete from public.restaurant_ingredients where id = 'f7dd0000-0000-4000-8000-000000000100';
    set constraints public.dish_ingredients_own_ingredient immediate;
    raise exception 'FAIL: an ingredient still used by a recipe was deleted.';
  exception when foreign_key_violation then null;
  end;
end;
$$;

-- Neither an unrelated authenticated account nor a missing identity can read rows.
set local request.jwt.claim.sub = 'f7dd0000-0000-4000-8000-000000000003';
set local request.jwt.claims = '{"sub":"f7dd0000-0000-4000-8000-000000000003","role":"authenticated"}';
do $$
begin
  if exists (select 1 from public.dishes) or exists (select 1 from public.dish_ingredients) then
    raise exception 'FAIL: account without membership sees recipe data.';
  end if;
  begin
    insert into public.dishes (restaurant_id, name) values ('f7dd0000-0000-4000-8000-000000000010', 'Outsider');
    raise exception 'FAIL: account without membership created a dish.';
  exception when insufficient_privilege then null;
  end;
end;
$$;
set local request.jwt.claim.sub = '';
set local request.jwt.claims = '{}';
do $$
begin
  if exists (select 1 from public.dishes) or exists (select 1 from public.dish_ingredients) then
    raise exception 'FAIL: missing identity exposes recipe data.';
  end if;
end;
$$;
set local role anon;
do $$
declare table_name text;
begin
  foreach table_name in array array['dishes','dish_ingredients'] loop
    begin execute format('select * from public.%I limit 1', table_name);
      raise exception 'FAIL: anonymous recipe reads allowed.';
    exception when insufficient_privilege then null;
    end;
    begin execute format('insert into public.%I default values', table_name);
      raise exception 'FAIL: anonymous recipe writes allowed.';
    exception when insufficient_privilege then null;
    end;
  end loop;
end;
$$;

set local role authenticated;
set local request.jwt.claim.sub = 'f7dd0000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"f7dd0000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
declare affected integer;
begin
  if not exists (select 1 from public.dishes where id = current_setting('test.dish_a')::uuid
    and servings = 4 and name = 'Hafergericht' and created_at = current_setting('test.dish_a_created_at')::timestamptz)
    or not exists (select 1 from public.dish_ingredients where dish_id = current_setting('test.dish_a')::uuid
      and ingredient_id = 'f7dd0000-0000-4000-8000-000000000100' and quantity_g = 150.75) then
    raise exception 'FAIL: dish and exact decimal quantities were not preserved.';
  end if;
  delete from public.dish_ingredients where dish_id = current_setting('test.dish_a')::uuid
    and ingredient_id = 'f7dd0000-0000-4000-8000-000000000101';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'FAIL: own recipe-row deletion was denied.'; end if;
  delete from public.dishes where id = current_setting('test.dish_a')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 or exists (select 1 from public.dish_ingredients where dish_id = current_setting('test.dish_a')::uuid) then
    raise exception 'FAIL: dish deletion did not cascade to its recipe.';
  end if;
  if not exists (select 1 from public.restaurant_ingredients where id = 'f7dd0000-0000-4000-8000-000000000100') then
    raise exception 'FAIL: deleting a dish deleted a reusable restaurant ingredient.';
  end if;
end;
$$;

reset role;
do $$
declare table_name text;
begin
  if (select name from public.dishes where id = current_setting('test.dish_b')::uuid) is distinct from 'Gericht B'
    or (select quantity_g from public.dish_ingredients where dish_id = current_setting('test.dish_b')::uuid) is distinct from 100 then
    raise exception 'FAIL: cross-tenant operations changed B data.';
  end if;
  -- Also exercise the restaurant cascade while its dish still uses an ingredient.
  delete from public.restaurants where id = 'f7dd0000-0000-4000-8000-000000000011';
  if exists (select 1 from public.dishes where restaurant_id = 'f7dd0000-0000-4000-8000-000000000011')
    or exists (select 1 from public.dish_ingredients where restaurant_id = 'f7dd0000-0000-4000-8000-000000000011')
    or exists (select 1 from public.restaurant_ingredients where restaurant_id = 'f7dd0000-0000-4000-8000-000000000011') then
    raise exception 'FAIL: restaurant cascade left recipe data behind.';
  end if;
  foreach table_name in array array['dishes','dish_ingredients'] loop
    if not (select relrowsecurity from pg_class where oid = ('public.' || table_name)::regclass)
      or (select count(*) from pg_policy where polrelid = ('public.' || table_name)::regclass) <> 4 then
      raise exception 'FAIL: recipe tables require RLS and four owner policies.';
    end if;
    if not has_table_privilege('service_role', 'public.' || table_name, 'SELECT')
      or not has_table_privilege('service_role', 'public.' || table_name, 'INSERT')
      or not has_table_privilege('service_role', 'public.' || table_name, 'UPDATE')
      or not has_table_privilege('service_role', 'public.' || table_name, 'DELETE') then
      raise exception 'FAIL: trusted backend recipe grants missing.';
    end if;
  end loop;
end;
$$;

-- Validate deferred constraints before rolling back instead of committing fixtures.
set constraints all immediate;
select 'Dishes, whole servings, exact gram quantities, import identities, tenant FKs, CRUD, RLS and deletion rules passed; rolling back.' as result;
rollback;
