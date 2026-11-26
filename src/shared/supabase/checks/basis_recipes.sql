-- Run as postgres on a disposable/local database AFTER the basis foundation migration.
-- This checks storage/permissions only, NOT nutrition or application save integration.
-- Every fixture and helper is rolled back. Stop on the first SQL error.
begin;

insert into auth.users(id, email) values
  ('ba512400-0000-4000-8000-000000000001', 'basis-a@example.invalid'),
  ('ba512400-0000-4000-8000-000000000002', 'basis-b@example.invalid'),
  ('ba512400-0000-4000-8000-000000000003', 'basis-outsider@example.invalid');
insert into public.restaurants(id, name) values
  ('ba512400-0000-4000-8000-000000000010', 'Basis checks A'),
  ('ba512400-0000-4000-8000-000000000011', 'Basis checks A second'),
  ('ba512400-0000-4000-8000-000000000012', 'Basis checks B');
insert into public.restaurant_members(restaurant_id, user_id) values
  ('ba512400-0000-4000-8000-000000000010', 'ba512400-0000-4000-8000-000000000001'),
  ('ba512400-0000-4000-8000-000000000011', 'ba512400-0000-4000-8000-000000000001'),
  ('ba512400-0000-4000-8000-000000000012', 'ba512400-0000-4000-8000-000000000002');

-- Synthetic foods for FK tests only; these are not nutrient fixtures or provider data.
insert into public.restaurant_ingredients(id, restaurant_id, name, source_kind, client_key, source_data) values
  ('ba512400-0000-4000-8000-000000000020', 'ba512400-0000-4000-8000-000000000010', 'Test food A', 'off', 'off:00000000', '{"basis":"100g"}'),
  ('ba512400-0000-4000-8000-000000000021', 'ba512400-0000-4000-8000-000000000011', 'Test food A second', 'off', 'off:00000000', '{"basis":"100g"}'),
  ('ba512400-0000-4000-8000-000000000022', 'ba512400-0000-4000-8000-000000000012', 'Test food B', 'off', 'off:00000000', '{"basis":"100ml"}');
insert into public.basis_recipes(id, restaurant_id, client_id, name, output_quantity, output_unit) values
  ('ba512400-0000-4000-8000-000000000030', 'ba512400-0000-4000-8000-000000000010', 'ba512400-0000-4000-8000-000000000050', 'Draft sauce', null, 'g'),
  ('ba512400-0000-4000-8000-000000000031', 'ba512400-0000-4000-8000-000000000011', 'ba512400-0000-4000-8000-000000000050', 'Second sauce', 400, 'g'),
  ('ba512400-0000-4000-8000-000000000032', 'ba512400-0000-4000-8000-000000000012', 'ba512400-0000-4000-8000-000000000050', 'Dressing', 500, 'ml');
insert into public.basis_recipe_ingredients(restaurant_id, basis_recipe_id, ingredient_id, quantity, unit) values
  ('ba512400-0000-4000-8000-000000000010', 'ba512400-0000-4000-8000-000000000030', 'ba512400-0000-4000-8000-000000000020', 125.75, 'g'),
  ('ba512400-0000-4000-8000-000000000011', 'ba512400-0000-4000-8000-000000000031', 'ba512400-0000-4000-8000-000000000021', 300, 'g'),
  ('ba512400-0000-4000-8000-000000000012', 'ba512400-0000-4000-8000-000000000032', 'ba512400-0000-4000-8000-000000000022', 500, 'ml');
insert into public.dishes(id, restaurant_id, name) values
  ('ba512400-0000-4000-8000-000000000040', 'ba512400-0000-4000-8000-000000000010', 'Dish A'),
  ('ba512400-0000-4000-8000-000000000041', 'ba512400-0000-4000-8000-000000000011', 'Dish A second'),
  ('ba512400-0000-4000-8000-000000000042', 'ba512400-0000-4000-8000-000000000012', 'Dish B');
insert into public.dish_basis_recipes(restaurant_id, dish_id, basis_recipe_id, quantity, unit) values
  ('ba512400-0000-4000-8000-000000000010', 'ba512400-0000-4000-8000-000000000040', 'ba512400-0000-4000-8000-000000000030', 80.25, 'g'),
  ('ba512400-0000-4000-8000-000000000011', 'ba512400-0000-4000-8000-000000000041', 'ba512400-0000-4000-8000-000000000031', 100, 'g'),
  ('ba512400-0000-4000-8000-000000000012', 'ba512400-0000-4000-8000-000000000042', 'ba512400-0000-4000-8000-000000000032', 50, 'ml');
-- Existing direct-food and new basis lines can coexist on a dish.
insert into public.dish_ingredients(restaurant_id, dish_id, ingredient_id, quantity_g)
values ('ba512400-0000-4000-8000-000000000010', 'ba512400-0000-4000-8000-000000000040', 'ba512400-0000-4000-8000-000000000020', 10);
set constraints all immediate;

-- An expected failure must roll back its statement. Unexpected success also raises.
create function pg_temp.expect_sqlstate(command text, expected text) returns void
language plpgsql security invoker as $$
declare actual text;
begin
  begin
    execute command;
    set constraints all immediate;
  exception when others then
    get stacked diagnostics actual = returned_sqlstate;
    if actual <> expected then raise exception 'FAIL: expected SQLSTATE %, got % for %', expected, actual, command; end if;
    return;
  end;
  raise exception 'FAIL: command unexpectedly succeeded: %', command;
end;
$$;

do $$
declare value text; table_name text; column_name text;
begin
  if (select output_quantity from public.basis_recipes where id='ba512400-0000-4000-8000-000000000030') is not null then
    raise exception 'FAIL: draft output must remain NULL.';
  end if;
  foreach value in array array['0','-1','1000000.001','NaN','Infinity','-Infinity'] loop
    perform pg_temp.expect_sqlstate(format('update public.basis_recipes set output_quantity=%L::numeric where id=%L', value, 'ba512400-0000-4000-8000-000000000030'), '23514');
    foreach table_name in array array['basis_recipe_ingredients','dish_basis_recipes'] loop
      perform pg_temp.expect_sqlstate(format('update public.%I set quantity=%L::numeric where restaurant_id=%L', table_name, value, 'ba512400-0000-4000-8000-000000000010'), '23514');
    end loop;
  end loop;
  foreach value in array array['', '   ', ' Padded ', repeat('x',501)] loop
    perform pg_temp.expect_sqlstate(format('update public.basis_recipes set name=%L where id=%L', value, 'ba512400-0000-4000-8000-000000000030'), '23514');
  end loop;
  foreach table_name in array array['basis_recipes','basis_recipe_ingredients','dish_basis_recipes'] loop
    column_name := case when table_name='basis_recipes' then 'output_unit' else 'unit' end;
    perform pg_temp.expect_sqlstate(format('update public.%I set %I=''kg'' where restaurant_id=%L', table_name, column_name, 'ba512400-0000-4000-8000-000000000010'), '23514');
    perform pg_temp.expect_sqlstate(format('update public.%I set %I=null where restaurant_id=%L', table_name, column_name, 'ba512400-0000-4000-8000-000000000010'), '23502');
  end loop;
  update public.basis_recipes set output_quantity=800.5 where id='ba512400-0000-4000-8000-000000000030';
  if (select output_quantity from public.basis_recipes where id='ba512400-0000-4000-8000-000000000030') <> 800.5
    or (select quantity from public.basis_recipe_ingredients where basis_recipe_id='ba512400-0000-4000-8000-000000000030') <> 125.75
    or (select quantity from public.dish_basis_recipes where dish_id='ba512400-0000-4000-8000-000000000040') <> 80.25 then
    raise exception 'FAIL: exact decimal quantities changed.';
  end if;
end;
$$;

-- Repeated client IDs are allowed across restaurants, but not within one.
select pg_temp.expect_sqlstate($q$insert into public.basis_recipes(restaurant_id,client_id,name)
  values ('ba512400-0000-4000-8000-000000000010','ba512400-0000-4000-8000-000000000050','Duplicate')$q$, '23505');
select pg_temp.expect_sqlstate($q$insert into public.basis_recipe_ingredients select * from public.basis_recipe_ingredients where basis_recipe_id='ba512400-0000-4000-8000-000000000030'$q$, '23505');
select pg_temp.expect_sqlstate($q$insert into public.dish_basis_recipes select * from public.dish_basis_recipes where dish_id='ba512400-0000-4000-8000-000000000040'$q$, '23505');

-- Composite FKs prevent links across tenants, even when one owner owns both.
do $$
declare other_food text; other_basis text; other_dish text;
begin
  foreach other_food in array array['ba512400-0000-4000-8000-000000000021','ba512400-0000-4000-8000-000000000022',
    'ba512400-0000-4000-8000-000000000030'] loop -- last value is a basis, not a Lebensmittel
    perform pg_temp.expect_sqlstate(format('update public.basis_recipe_ingredients set ingredient_id=%L where basis_recipe_id=%L', other_food, 'ba512400-0000-4000-8000-000000000030'), '23503');
  end loop;
  foreach other_basis in array array['ba512400-0000-4000-8000-000000000031','ba512400-0000-4000-8000-000000000032'] loop
    perform pg_temp.expect_sqlstate(format('update public.basis_recipe_ingredients set basis_recipe_id=%L where basis_recipe_id=%L', other_basis, 'ba512400-0000-4000-8000-000000000030'), '23503');
    perform pg_temp.expect_sqlstate(format('update public.dish_basis_recipes set basis_recipe_id=%L where dish_id=%L', other_basis, 'ba512400-0000-4000-8000-000000000040'), '23503');
  end loop;
  foreach other_dish in array array['ba512400-0000-4000-8000-000000000041','ba512400-0000-4000-8000-000000000042'] loop
    perform pg_temp.expect_sqlstate(format('update public.dish_basis_recipes set dish_id=%L where dish_id=%L', other_dish, 'ba512400-0000-4000-8000-000000000040'), '23503');
  end loop;
end;
$$;
select pg_temp.expect_sqlstate($q$update public.dish_basis_recipes set unit='ml' where dish_id='ba512400-0000-4000-8000-000000000040'$q$, '23503');
select pg_temp.expect_sqlstate($q$update public.basis_recipes set output_unit='ml' where id='ba512400-0000-4000-8000-000000000030'$q$, '23503');
select pg_temp.expect_sqlstate($q$delete from public.basis_recipes where id='ba512400-0000-4000-8000-000000000030'$q$, '23503');
-- Food B is used only by a basis (not by the old dish_ingredients table).
select pg_temp.expect_sqlstate($q$delete from public.restaurant_ingredients where id='ba512400-0000-4000-8000-000000000022'$q$, '23503');

-- Read as each real application role; the helper above is not used under these roles.
set local role authenticated;
set local request.jwt.claim.sub = 'ba512400-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"ba512400-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
declare table_name text; count_rows integer; command text;
begin
  foreach table_name in array array['basis_recipes','basis_recipe_ingredients','dish_basis_recipes'] loop
    execute format('select count(*) from public.%I', table_name) into count_rows;
    if count_rows <> 2 then raise exception 'FAIL: A must see exactly its two restaurants in %.', table_name; end if;
    foreach command in array array[
      format('insert into public.%I default values', table_name),
      format('update public.%I set restaurant_id=restaurant_id', table_name),
      format('delete from public.%I', table_name)
    ] loop
      begin execute command; raise exception 'FAIL: application writes must remain closed for %.', table_name;
      exception when insufficient_privilege then null;
      end;
    end loop;
  end loop;
end;
$$;
set local request.jwt.claim.sub = 'ba512400-0000-4000-8000-000000000002';
set local request.jwt.claims = '{"sub":"ba512400-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
begin
  if (select count(*) from public.basis_recipes) <> 1
    or not exists(select 1 from public.basis_recipes where id='ba512400-0000-4000-8000-000000000032')
    or (select count(*) from public.basis_recipe_ingredients) <> 1
    or (select count(*) from public.dish_basis_recipes) <> 1 then raise exception 'FAIL: B isolation failed.'; end if;
end;
$$;
set local request.jwt.claim.sub = 'ba512400-0000-4000-8000-000000000003';
set local request.jwt.claims = '{"sub":"ba512400-0000-4000-8000-000000000003","role":"authenticated"}';
do $$ begin
  if exists(select 1 from public.basis_recipes) or exists(select 1 from public.basis_recipe_ingredients)
    or exists(select 1 from public.dish_basis_recipes) then raise exception 'FAIL: outsider can read.'; end if;
end; $$;
set local request.jwt.claim.sub = '';
set local request.jwt.claims = '{}';
do $$ begin
  if exists(select 1 from public.basis_recipes) or exists(select 1 from public.basis_recipe_ingredients)
    or exists(select 1 from public.dish_basis_recipes) then raise exception 'FAIL: missing identity can read.'; end if;
end; $$;
set local role anon;
do $$
declare table_name text;
begin
  foreach table_name in array array['basis_recipes','basis_recipe_ingredients','dish_basis_recipes'] loop
    begin execute format('select * from public.%I', table_name); raise exception 'FAIL: anon can read.';
    exception when insufficient_privilege then null;
    end;
  end loop;
end;
$$;
reset role;

do $$
declare table_name text;
begin
  foreach table_name in array array['basis_recipes','basis_recipe_ingredients','dish_basis_recipes'] loop
    if not (select relrowsecurity from pg_class where oid=('public.'||table_name)::regclass)
      or (select count(*) from pg_policy where polrelid=('public.'||table_name)::regclass) <> 1 then
      raise exception 'FAIL: expected RLS and one owner-read policy for %.', table_name;
    end if;
    if has_table_privilege('anon','public.'||table_name,'INSERT,UPDATE,DELETE')
      or has_table_privilege('authenticated','public.'||table_name,'INSERT,UPDATE,DELETE') then
      raise exception 'FAIL: unintended write grants for %.', table_name;
    end if;
    if not has_table_privilege('service_role','public.'||table_name,'SELECT')
      or not has_table_privilege('service_role','public.'||table_name,'INSERT')
      or not has_table_privilege('service_role','public.'||table_name,'UPDATE')
      or not has_table_privilege('service_role','public.'||table_name,'DELETE') then
      raise exception 'FAIL: missing trusted administration grants for %.', table_name;
    end if;
  end loop;
  -- Dish deletion removes its use of the basis, but not the reusable basis/foods.
  delete from public.dishes where id='ba512400-0000-4000-8000-000000000040';
  if exists(select 1 from public.dish_basis_recipes where dish_id='ba512400-0000-4000-8000-000000000040')
    or not exists(select 1 from public.basis_recipes where id='ba512400-0000-4000-8000-000000000030') then
    raise exception 'FAIL: dish deletion damaged the basis or left a link.';
  end if;
  delete from public.basis_recipes where id='ba512400-0000-4000-8000-000000000030';
  if exists(select 1 from public.basis_recipe_ingredients where basis_recipe_id='ba512400-0000-4000-8000-000000000030')
    or not exists(select 1 from public.restaurant_ingredients where id='ba512400-0000-4000-8000-000000000020') then
    raise exception 'FAIL: unused basis deletion damaged foods or left lines.';
  end if;
end;
$$;
set constraints all deferred;
delete from public.restaurants where id='ba512400-0000-4000-8000-000000000011';
set constraints all immediate;
do $$ begin
  if exists(select 1 from public.basis_recipes where restaurant_id='ba512400-0000-4000-8000-000000000011')
    or exists(select 1 from public.basis_recipe_ingredients where restaurant_id='ba512400-0000-4000-8000-000000000011')
    or exists(select 1 from public.dish_basis_recipes where restaurant_id='ba512400-0000-4000-8000-000000000011') then
    raise exception 'FAIL: restaurant cascade left basis data.';
  end if;
  if (select output_quantity from public.basis_recipes where id='ba512400-0000-4000-8000-000000000032') is distinct from 500
    or (select quantity from public.dish_basis_recipes where dish_id='ba512400-0000-4000-8000-000000000042') is distinct from 50 then
    raise exception 'FAIL: B data changed.';
  end if;
end; $$;
select 'Basis storage, drafts, decimal quantities, tenant FKs, g/ml links, RLS and deletion checks passed; rolling back.' as result;
rollback;
