-- Run as postgres on a disposable database after 20261124000300.
-- Synthetic nutrient numbers are test oracles, NOT food/demo content.
-- Also run dish_nutrition.sql and business_onboarding.sql for existing-contract regression.
begin;
insert into auth.users(id,email) values
  ('ba532400-0000-4000-8000-000000000001','basis-nutrition-a@example.invalid'),
  ('ba532400-0000-4000-8000-000000000002','basis-nutrition-b@example.invalid');
insert into public.restaurants(id,name) values
  ('ba532400-0000-4000-8000-000000000010','Basis nutrition A'),
  ('ba532400-0000-4000-8000-000000000012','Basis nutrition B');
insert into public.restaurant_members(restaurant_id,user_id) values
  ('ba532400-0000-4000-8000-000000000010','ba532400-0000-4000-8000-000000000001'),
  ('ba532400-0000-4000-8000-000000000012','ba532400-0000-4000-8000-000000000002');

insert into public.nutrition_datasets(id,source,source_version,release_year,content_sha256,file_manifest,source_url,food_count,nutrient_count)
values ('ba532400-0000-4000-8000-000000000200','bls','basis-nutrition-check',2025,repeat('b',64),'[]','https://example.invalid',1,4);
insert into public.bls_foods(dataset_id,bls_code,name_de,name_en,source_row)
values ('ba532400-0000-4000-8000-000000000200','BASIS01','Test','Test',2);
insert into public.nutrients(dataset_id,code,name_de,name_en,unit,group_de,group_en,sort_index)
select 'ba532400-0000-4000-8000-000000000200',code,code,code,unit,'Test','Test',pos
from (values ('ENERCC','kcal',1),('PROT625','g',2),('FAT','g',3),('CHO','g',4)) m(code,unit,pos);
insert into public.bls_food_nutrients(dataset_id,bls_code,nutrient_code,value,raw_value,value_kind)
select 'ba532400-0000-4000-8000-000000000200','BASIS01',code,value,value::text,'numeric'
from (values ('ENERCC',100),('PROT625',10),('FAT',2),('CHO',20)) m(code,value);
-- Deliberately forged BLS snapshot: calculations must use pinned catalog values.
insert into public.restaurant_ingredients(id,restaurant_id,name,dataset_id,bls_code,source_data)
values ('ba532400-0000-4000-8000-000000000100','ba532400-0000-4000-8000-000000000010','BLS test',
  'ba532400-0000-4000-8000-000000000200','BASIS01','{"energyKcal":999,"proteinG":999,"fatG":999,"carbohydrateG":999}');
insert into public.restaurant_ingredients(id,restaurant_id,name,source_kind,client_key,source_data) values
  ('ba532400-0000-4000-8000-000000000101','ba532400-0000-4000-8000-000000000010','OFF volume','off','off:00000001',
    '{"basis":"100ml","preparation":"as_sold","energyKcal":200,"proteinG":4,"fatG":8,"carbohydrateG":5}'),
  ('ba532400-0000-4000-8000-000000000102','ba532400-0000-4000-8000-000000000010','Manual zero','manual','test-zero',
    '{"basis":"100g","preparation":"prepared","energyKcal":0,"proteinG":0,"fatG":0,"carbohydrateG":0}'),
  ('ba532400-0000-4000-8000-000000000103','ba532400-0000-4000-8000-000000000010','OFF missing protein','off','off:00000003',
    '{"basis":"100g","preparation":"as_sold","energyKcal":100,"proteinG":null,"fatG":2,"carbohydrateG":20}');

insert into public.basis_recipes(id,restaurant_id,name,output_quantity,output_unit)
select ('ba532400-0000-4000-8000-'||lpad(num::text,12,'0'))::uuid,
  case when num=303 then 'ba532400-0000-4000-8000-000000000012'::uuid else 'ba532400-0000-4000-8000-000000000010'::uuid end,
  name,amount,unit
from (values (300,'Mixed basis',400::numeric,'g'),(301,'Missing output',null,'g'),
  (302,'Empty basis',100,'g'),(303,'Private B basis',100,'g'),(304,'Zero dressing',100,'ml'),
  (305,'Incomplete basis',100,'g'),(306,'Wrong ingredient unit',100,'g')) b(num,name,amount,unit);
insert into public.basis_recipe_ingredients(restaurant_id,basis_recipe_id,ingredient_id,quantity,unit)
select 'ba532400-0000-4000-8000-000000000010',
  ('ba532400-0000-4000-8000-'||lpad(basis::text,12,'0'))::uuid,
  ('ba532400-0000-4000-8000-'||lpad(food::text,12,'0'))::uuid,quantity,unit
from (values (300,100,200::numeric,'g'),(300,101,100,'ml'),(301,100,100,'g'),
  (304,102,100,'g'),(305,103,100,'g'),(306,100,100,'ml')) l(basis,food,quantity,unit);
insert into public.dishes(id,restaurant_id,name)
select ('ba532400-0000-4000-8000-'||lpad(num::text,12,'0'))::uuid,
  case when num=404 then 'ba532400-0000-4000-8000-000000000012'::uuid else 'ba532400-0000-4000-8000-000000000010'::uuid end,
  'Test dish '||num from generate_series(400,410) num;
insert into public.dish_ingredients(restaurant_id,dish_id,ingredient_id,quantity_g)
select 'ba532400-0000-4000-8000-000000000010',('ba532400-0000-4000-8000-'||lpad(num::text,12,'0'))::uuid,
  'ba532400-0000-4000-8000-000000000100',50 from (values (400),(403),(407)) d(num);
insert into public.dish_basis_recipes(restaurant_id,dish_id,basis_recipe_id,quantity,unit)
select case when dish=404 then 'ba532400-0000-4000-8000-000000000012'::uuid else 'ba532400-0000-4000-8000-000000000010'::uuid end,
  ('ba532400-0000-4000-8000-'||lpad(dish::text,12,'0'))::uuid,
  ('ba532400-0000-4000-8000-'||lpad(basis::text,12,'0'))::uuid,quantity,unit
from (values (400,300,80::numeric,'g'),(401,300,200,'g'),(404,303,50,'g'),
  (406,304,50,'ml'),(407,305,50,'g'),(408,302,50,'g'),(409,301,50,'g'),(410,306,50,'g')) l(dish,basis,quantity,unit);

set local role authenticated;
set local request.jwt.claim.sub='ba532400-0000-4000-8000-000000000001';
set local request.jwt.claims='{"sub":"ba532400-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
declare actual jsonb; result record; target uuid;
begin
  select jsonb_object_agg(nutrient_code,jsonb_build_array(recipe_total,per_100,status,ingredient_count,known_ingredient_count,issues))
    into actual from public.get_basis_recipe_nutrition('ba532400-0000-4000-8000-000000000300');
  if actual is distinct from '{"ENERCC":[400,100,"complete",2,2,[]],"PROT625":[24,6,"complete",2,2,[]],"FAT":[12,3,"complete",2,2,[]],"CHO":[45,11.25,"complete",2,2,[]]}'::jsonb then
    raise exception 'FAIL: mixed g/ml food contributions or measured batch scaling are wrong: %',actual;
  end if;
  select jsonb_object_agg(nutrient_code,jsonb_build_array(recipe_total,per_serving,status,ingredient_count,known_ingredient_count,issues))
    into actual from public.get_dish_nutrition('ba532400-0000-4000-8000-000000000400');
  if actual is distinct from '{"ENERCC":[130,130,"complete",2,2,[]],"PROT625":[9.8,9.8,"complete",2,2,[]],"FAT":[3.4,3.4,"complete",2,2,[]],"CHO":[19,19,"complete",2,2,[]]}'::jsonb then
    raise exception 'FAIL: dish must add direct food and basis exactly once: %',actual;
  end if;
  if (select per_serving from public.get_dish_nutrition('ba532400-0000-4000-8000-000000000401') where nutrient_code='ENERCC') is distinct from 200
    or (select per_serving from public.get_dish_nutrition('ba532400-0000-4000-8000-000000000403') where nutrient_code='ENERCC') is distinct from 50 then
    raise exception 'FAIL: basis-only or direct-food-only dish is wrong.';
  end if;
  if (select count(*) from public.get_dish_nutrition('ba532400-0000-4000-8000-000000000402')
    where status='empty_recipe' and recipe_total is null and per_serving is null and ingredient_count=0 and issues='[]'::jsonb) <> 4 then
    raise exception 'FAIL: empty dish is not zero.';
  end if;
  if (select count(*) from public.get_dish_nutrition('ba532400-0000-4000-8000-000000000406')
    where status='complete' and recipe_total=0 and per_serving=0) <> 4 then raise exception 'FAIL: numeric zero lost.'; end if;
  select * into strict result from public.get_dish_nutrition('ba532400-0000-4000-8000-000000000407') where nutrient_code='PROT625';
  if result.status<>'incomplete' or result.per_serving is not null or result.recipe_total is not null
    or result.ingredient_count<>2 or result.known_ingredient_count<>1
    or result.issues#>>'{0,reason}' is distinct from 'incomplete_basis_recipe'
    or result.issues#>>'{0,issues,0,reason}' is distinct from 'missing_value' then
    raise exception 'FAIL: missing protein must propagate with nested details, not partial totals.';
  end if;
  if (select per_serving from public.get_dish_nutrition('ba532400-0000-4000-8000-000000000407') where nutrient_code='ENERCC') is distinct from 100 then
    raise exception 'FAIL: missing protein must not invalidate known energy.';
  end if;
  foreach target in array array['ba532400-0000-4000-8000-000000000408'::uuid,'ba532400-0000-4000-8000-000000000409','ba532400-0000-4000-8000-000000000410'] loop
    if (select count(*) from public.get_dish_nutrition(target) where status='incomplete' and per_serving is null and recipe_total is null) <> 4 then
      raise exception 'FAIL: empty basis, missing output and incompatible ingredient units must invalidate dish: %',target;
    end if;
  end loop;
  if not exists(select 1 from public.get_basis_recipe_nutrition('ba532400-0000-4000-8000-000000000301')
      where issues @> '[{"reason":"missing_output_quantity"}]'::jsonb)
    or not exists(select 1 from public.get_basis_recipe_nutrition('ba532400-0000-4000-8000-000000000306')
      where issues @> '[{"reason":"unit_mismatch"}]'::jsonb) then raise exception 'FAIL: basis issue details lost.'; end if;
  foreach target in array array['ba532400-0000-4000-8000-000000000303'::uuid,'ba532400-0000-4000-8000-000000000999',null] loop
    if exists(select 1 from public.get_basis_recipe_nutrition(target)) then raise exception 'FAIL: unknown/private basis exposed.'; end if;
  end loop;
  if exists(select 1 from public.get_dish_nutrition('ba532400-0000-4000-8000-000000000404'))
    or exists(select 1 from makroklar_private.recipe_food_nutrition('ba532400-0000-4000-8000-000000000012','ba532400-0000-4000-8000-000000000100',100,'g')) then
    raise exception 'FAIL: private dish or mismatched food ownership exposed.';
  end if;
end;
$$;

reset role;
-- Direct fixture changes exercise read-time recalculation; each variation is undone.
savepoint quantity_change;
update public.basis_recipe_ingredients set quantity=400
where basis_recipe_id='ba532400-0000-4000-8000-000000000300' and ingredient_id='ba532400-0000-4000-8000-000000000100';
do $$ begin
  if (select per_serving from public.get_dish_nutrition('ba532400-0000-4000-8000-000000000400') where nutrient_code='ENERCC') is distinct from 170
    or (select per_serving from public.get_dish_nutrition('ba532400-0000-4000-8000-000000000401') where nutrient_code='ENERCC') is distinct from 300 then
    raise exception 'FAIL: changing a base must affect both dishes.';
  end if;
end; $$;
rollback to savepoint quantity_change;
savepoint yield_change;
update public.basis_recipes set output_quantity=800 where id='ba532400-0000-4000-8000-000000000300';
do $$ begin
  if (select per_serving from public.get_dish_nutrition('ba532400-0000-4000-8000-000000000400') where nutrient_code='ENERCC') is distinct from 90 then
    raise exception 'FAIL: measured yield change was ignored.';
  end if;
end; $$;
rollback to savepoint yield_change;
savepoint remove_food;
delete from public.basis_recipe_ingredients where basis_recipe_id='ba532400-0000-4000-8000-000000000300'
  and ingredient_id='ba532400-0000-4000-8000-000000000101';
do $$ begin
  if (select per_serving from public.get_dish_nutrition('ba532400-0000-4000-8000-000000000400') where nutrient_code='ENERCC') is distinct from 90 then
    raise exception 'FAIL: removal did not recalculate.';
  end if;
end; $$;
rollback to savepoint remove_food;
savepoint add_food;
insert into public.basis_recipe_ingredients(restaurant_id,basis_recipe_id,ingredient_id,quantity,unit)
values ('ba532400-0000-4000-8000-000000000010','ba532400-0000-4000-8000-000000000300','ba532400-0000-4000-8000-000000000103',100,'g');
do $$ begin
  if (select per_serving from public.get_dish_nutrition('ba532400-0000-4000-8000-000000000400') where nutrient_code='ENERCC') is distinct from 150
    or (select status from public.get_dish_nutrition('ba532400-0000-4000-8000-000000000401') where nutrient_code='PROT625') is distinct from 'incomplete' then
    raise exception 'FAIL: new food must update totals and propagate missing protein.';
  end if;
end; $$;
rollback to savepoint add_food;
savepoint portion_change;
update public.dishes set servings=2 where id='ba532400-0000-4000-8000-000000000400';
do $$ begin
  if (select per_serving from public.get_dish_nutrition('ba532400-0000-4000-8000-000000000400') where nutrient_code='ENERCC') is distinct from 65 then
    raise exception 'FAIL: legacy servings contract broken.';
  end if;
end; $$;
rollback to savepoint portion_change;

-- Deferred deletion leaves a temporarily unresolved reference: never omit it.
savepoint unresolved_basis;
set constraints public.dish_basis_recipes_own_basis_unit deferred;
delete from public.basis_recipes where id='ba532400-0000-4000-8000-000000000300';
do $$ begin
  if (select count(*) from public.get_dish_nutrition('ba532400-0000-4000-8000-000000000400')
    where status='incomplete' and ingredient_count=2 and known_ingredient_count=1
      and issues @> '[{"reason":"missing_basis_recipe"}]'::jsonb) <> 4 then
    raise exception 'FAIL: unresolved basis was dropped from the denominator.';
  end if;
end; $$;
rollback to savepoint unresolved_basis;

set local role authenticated;
set local request.jwt.claim.sub='';
set local request.jwt.claims='{}';
do $$ begin
  if exists(select 1 from public.get_basis_recipe_nutrition('ba532400-0000-4000-8000-000000000300')) then
    raise exception 'FAIL: missing identity can read basis nutrition.';
  end if;
end; $$;
set local role anon;
do $$ begin
  begin perform * from public.get_basis_recipe_nutrition('ba532400-0000-4000-8000-000000000300');
    raise exception 'FAIL: anonymous basis RPC allowed.';
  exception when insufficient_privilege then null; end;
end; $$;
reset role;
do $$ begin
  if exists(select 1 from pg_proc where oid in (
      'public.get_basis_recipe_nutrition(uuid)'::regprocedure,
      'public.get_dish_nutrition(uuid)'::regprocedure,
      'makroklar_private.recipe_food_nutrition(uuid,uuid,numeric,text)'::regprocedure) and prosecdef) then
    raise exception 'FAIL: calculations must remain security invoker.';
  end if;
end; $$;
set constraints all immediate;
select 'Basis/direct dish arithmetic, units, missing/zero values, dynamic edits and read isolation passed; rolling back.' as result;
rollback;
