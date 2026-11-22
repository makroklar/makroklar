-- Run as postgres on a development Supabase database AFTER the ingredients migration.
-- Standalone SQL checks, not pgTAP. All fixtures are removed by ROLLBACK.
begin;

insert into auth.users (id, email) values
  ('f7cc0000-0000-4000-8000-000000000001', 'ingredients-a@example.invalid'),
  ('f7cc0000-0000-4000-8000-000000000002', 'ingredients-b@example.invalid'),
  ('f7cc0000-0000-4000-8000-000000000003', 'ingredients-outsider@example.invalid');

-- Tiny, isolated BLS fixtures: never modify the imported catalog or its active flag.
insert into public.nutrition_datasets
  (id, source, source_version, release_year, content_sha256, file_manifest, source_url, food_count, nutrient_count)
values
  ('f7cc0000-0000-4000-8000-000000000100', 'bls', 'ingredients-check-a', 2025, repeat('2',64), '[]', 'https://example.invalid', 1, 1),
  ('f7cc0000-0000-4000-8000-000000000101', 'bls', 'ingredients-check-b', 2026, repeat('3',64), '[]', 'https://example.invalid', 2, 1);

insert into public.bls_foods (dataset_id, bls_code, name_de, name_en, source_row) values
  ('f7cc0000-0000-4000-8000-000000000100', 'CHECK01', 'Hafer Test A', 'Oats test A', 2),
  ('f7cc0000-0000-4000-8000-000000000101', 'CHECK01', 'Hafer Test B', 'Oats test B', 2),
  ('f7cc0000-0000-4000-8000-000000000101', 'CHECK02', 'Tomate Test B', 'Tomato test B', 3);

set local role authenticated;
set local request.jwt.claim.sub = 'f7cc0000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"f7cc0000-0000-4000-8000-000000000001","role":"authenticated"}';

select set_config('test.ingredients_restaurant_a', public.create_restaurant('Ingredients A')::text, true);
select set_config('test.ingredients_restaurant_a2', public.create_restaurant('Ingredients A second restaurant')::text, true);

with ingredient as (
  insert into public.restaurant_ingredients (restaurant_id, dataset_id, bls_code, name)
  values (current_setting('test.ingredients_restaurant_a')::uuid,
    'f7cc0000-0000-4000-8000-000000000100', 'CHECK01', 'Unser Hafer')
  returning id, created_at
)
select set_config('test.ingredient_a', id::text, true),
  set_config('test.ingredient_a_created_at', created_at::text, true) from ingredient;

-- The same reference is allowed in another restaurant, including one with the same owner.
insert into public.restaurant_ingredients (restaurant_id, dataset_id, bls_code, name)
values (current_setting('test.ingredients_restaurant_a2')::uuid,
  'f7cc0000-0000-4000-8000-000000000100', 'CHECK01', 'Zweiter Hafer');

set local request.jwt.claim.sub = 'f7cc0000-0000-4000-8000-000000000002';
set local request.jwt.claims = '{"sub":"f7cc0000-0000-4000-8000-000000000002","role":"authenticated"}';
select set_config('test.ingredients_restaurant_b', public.create_restaurant('Ingredients B')::text, true);

with ingredient as (
  insert into public.restaurant_ingredients (restaurant_id, dataset_id, bls_code, name)
  values (current_setting('test.ingredients_restaurant_b')::uuid,
    'f7cc0000-0000-4000-8000-000000000100', 'CHECK01', 'Hafer von B')
  returning id
)
select set_config('test.ingredient_b', id::text, true) from ingredient;

do $$
declare affected integer;
begin
  if (select count(*) from public.restaurant_ingredients) <> 1 then
    raise exception 'FAIL: B must see only their own ingredient.';
  end if;
  update public.restaurant_ingredients set name = 'Hijacked'
    where id = current_setting('test.ingredient_a')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: B updated A ingredient.'; end if;
  delete from public.restaurant_ingredients where id = current_setting('test.ingredient_a')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: B deleted A ingredient.'; end if;
  begin
    insert into public.restaurant_ingredients (restaurant_id, dataset_id, bls_code, name)
    values (current_setting('test.ingredients_restaurant_a')::uuid,
      'f7cc0000-0000-4000-8000-000000000101', 'CHECK02', 'Injected');
    raise exception 'FAIL: B inserted into A restaurant.';
  exception when insufficient_privilege then null;
  end;
end;
$$;

set local request.jwt.claim.sub = 'f7cc0000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"f7cc0000-0000-4000-8000-000000000001","role":"authenticated"}';

do $$
declare affected integer;
begin
  if (select count(*) from public.restaurant_ingredients) <> 2 then
    raise exception 'FAIL: A must see ingredients across their two restaurants only.';
  end if;
  if not exists (
    select 1 from public.restaurant_ingredients ingredient
      join public.bls_foods food using (dataset_id, bls_code)
    where ingredient.id = current_setting('test.ingredient_a')::uuid and food.name_de = 'Hafer Test A'
  ) then raise exception 'FAIL: reference must select the pinned BLS version.'; end if;

  begin
    insert into public.restaurant_ingredients (restaurant_id, dataset_id, bls_code, name)
    values (current_setting('test.ingredients_restaurant_a')::uuid,
      'f7cc0000-0000-4000-8000-000000000100', 'CHECK01', 'Duplicate alias');
    raise exception 'FAIL: duplicate restaurant/BLS identity was accepted.';
  exception when unique_violation then null;
  end;
  begin
    insert into public.restaurant_ingredients (restaurant_id, dataset_id, bls_code, name)
    values (current_setting('test.ingredients_restaurant_a')::uuid,
      'f7cc0000-0000-4000-8000-000000000100', 'CHECK02', 'Wrong version');
    raise exception 'FAIL: code from another BLS version was accepted.';
  exception when foreign_key_violation then null;
  end;
  begin
    insert into public.restaurant_ingredients (restaurant_id, dataset_id, bls_code, name)
    values (current_setting('test.ingredients_restaurant_a')::uuid,
      'f7cc0000-0000-4000-8000-000000000101', 'CHECK02', '   ');
    raise exception 'FAIL: blank local name was accepted.';
  exception when check_violation then null;
  end;
  begin
    update public.restaurant_ingredients set name = ' Padded '
    where id = current_setting('test.ingredient_a')::uuid;
    raise exception 'FAIL: padded local name was accepted.';
  exception when check_violation then null;
  end;
  begin
    insert into public.restaurant_ingredients (id, restaurant_id, dataset_id, bls_code, name)
    values (gen_random_uuid(), current_setting('test.ingredients_restaurant_a')::uuid,
      'f7cc0000-0000-4000-8000-000000000101', 'CHECK02', 'Spoofed identity');
    raise exception 'FAIL: client-supplied ingredient identity was accepted.';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.restaurant_ingredients set id = gen_random_uuid()
    where id = current_setting('test.ingredient_a')::uuid;
    raise exception 'FAIL: changing ingredient identity was allowed.';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.restaurant_ingredients set restaurant_id = current_setting('test.ingredients_restaurant_a2')::uuid
    where id = current_setting('test.ingredient_a')::uuid;
    raise exception 'FAIL: moving ingredients between restaurants was allowed.';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.restaurant_ingredients set created_at = now() + interval '1 day'
    where id = current_setting('test.ingredient_a')::uuid;
    raise exception 'FAIL: changing creation time was allowed.';
  exception when insufficient_privilege then null;
  end;

  update public.restaurant_ingredients set name = 'Frische Tomaten',
    dataset_id = 'f7cc0000-0000-4000-8000-000000000101', bls_code = 'CHECK02'
  where id = current_setting('test.ingredient_a')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'FAIL: own name and BLS reference update must succeed.'; end if;

  update public.restaurant_ingredients set name = 'Hijacked'
  where id = current_setting('test.ingredient_b')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: A updated B ingredient.'; end if;
  delete from public.restaurant_ingredients where id = current_setting('test.ingredient_b')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: A deleted B ingredient.'; end if;
  begin
    insert into public.restaurant_ingredients (restaurant_id, dataset_id, bls_code, name)
    values (current_setting('test.ingredients_restaurant_b')::uuid,
      'f7cc0000-0000-4000-8000-000000000101', 'CHECK02', 'Injected by A');
    raise exception 'FAIL: A inserted into B restaurant.';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
do $$
begin
  if not exists (select 1 from public.restaurant_ingredients
    where id = current_setting('test.ingredient_a')::uuid and name = 'Frische Tomaten'
      and dataset_id = 'f7cc0000-0000-4000-8000-000000000101' and bls_code = 'CHECK02'
      and created_at = current_setting('test.ingredient_a_created_at')::timestamptz)
    or (select name from public.restaurant_ingredients where id = current_setting('test.ingredient_b')::uuid)
      is distinct from 'Hafer von B' then
    raise exception 'FAIL: own updates failed or cross-tenant checks changed B data.';
  end if;
  begin
    delete from public.bls_foods
    where dataset_id = 'f7cc0000-0000-4000-8000-000000000100' and bls_code = 'CHECK01';
    raise exception 'FAIL: a referenced BLS food was deleted.';
  exception when foreign_key_violation then null;
  end;
  begin
    delete from public.nutrition_datasets where id = 'f7cc0000-0000-4000-8000-000000000100';
    raise exception 'FAIL: a referenced BLS dataset was deleted.';
  exception when foreign_key_violation then null;
  end;
  begin
    insert into public.restaurant_ingredients (restaurant_id, dataset_id, bls_code, name)
    values ('f7cc0000-0000-4000-8000-000000000999',
      'f7cc0000-0000-4000-8000-000000000100', 'CHECK01', 'Orphan ingredient');
    raise exception 'FAIL: an ingredient without a restaurant was accepted.';
  exception when foreign_key_violation then null;
  end;
end;
$$;

-- An account without any restaurant membership cannot access or create ingredients.
set local role authenticated;
set local request.jwt.claim.sub = 'f7cc0000-0000-4000-8000-000000000003';
set local request.jwt.claims = '{"sub":"f7cc0000-0000-4000-8000-000000000003","role":"authenticated"}';
do $$
begin
  if exists (select 1 from public.restaurant_ingredients) then
    raise exception 'FAIL: an account without membership sees ingredients.';
  end if;
  begin
    insert into public.restaurant_ingredients (restaurant_id, dataset_id, bls_code, name)
    values (current_setting('test.ingredients_restaurant_a')::uuid,
      'f7cc0000-0000-4000-8000-000000000101', 'CHECK02', 'Outsider');
    raise exception 'FAIL: an account without membership inserted ingredients.';
  exception when insufficient_privilege then null;
  end;
end;
$$;

set local request.jwt.claim.sub = '';
set local request.jwt.claims = '{}';
do $$
begin
  if exists (select 1 from public.restaurant_ingredients) then
    raise exception 'FAIL: missing auth.uid() exposes ingredients.';
  end if;
end;
$$;

set local role anon;
do $$
begin
  begin
    perform 1 from public.restaurant_ingredients;
    raise exception 'FAIL: anonymous ingredient reads were allowed.';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.restaurant_ingredients (restaurant_id, dataset_id, bls_code, name)
    values (current_setting('test.ingredients_restaurant_a')::uuid,
      'f7cc0000-0000-4000-8000-000000000101', 'CHECK02', 'Anonymous');
    raise exception 'FAIL: anonymous ingredient writes were allowed.';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- A can delete their own ingredient; the other restaurant and B stay intact.
set local role authenticated;
set local request.jwt.claim.sub = 'f7cc0000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"f7cc0000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
declare affected integer;
begin
  delete from public.restaurant_ingredients where id = current_setting('test.ingredient_a')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 or (select count(*) from public.restaurant_ingredients) <> 1 then
    raise exception 'FAIL: deleting own ingredient must leave the second restaurant ingredient.';
  end if;
end;
$$;

reset role;
do $$
begin
  if (select count(*) from public.restaurant_ingredients
      where restaurant_id = current_setting('test.ingredients_restaurant_b')::uuid) <> 1 then
    raise exception 'FAIL: deleting A ingredient changed B data.';
  end if;
  -- Administrative restaurant deletion also removes its ingredients.
  delete from public.restaurants where id = current_setting('test.ingredients_restaurant_a2')::uuid;
  if exists (select 1 from public.restaurant_ingredients
      where restaurant_id = current_setting('test.ingredients_restaurant_a2')::uuid) then
    raise exception 'FAIL: restaurant deletion left orphan ingredients.';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.restaurant_ingredients'::regclass)
    or (select count(*) from pg_policy where polrelid = 'public.restaurant_ingredients'::regclass) <> 4 then
    raise exception 'FAIL: ingredients require RLS and all four owner policies.';
  end if;
  if not has_table_privilege('service_role', 'public.restaurant_ingredients', 'SELECT')
    or not has_table_privilege('service_role', 'public.restaurant_ingredients', 'INSERT')
    or not has_table_privilege('service_role', 'public.restaurant_ingredients', 'UPDATE')
    or not has_table_privilege('service_role', 'public.restaurant_ingredients', 'DELETE') then
    raise exception 'FAIL: trusted backend privileges missing.';
  end if;
end;
$$;

select 'Restaurant ingredient ownership, CRUD, protected fields, versioned BLS references and constraints passed; rolling back.' as result;
rollback;
