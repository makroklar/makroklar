-- Run as postgres AFTER the nutrition function migration. All fixtures roll back.
begin;

insert into auth.users (id, email) values
  ('f7ee0000-0000-4000-8000-000000000001', 'nutrition-a@example.invalid'),
  ('f7ee0000-0000-4000-8000-000000000002', 'nutrition-b@example.invalid'),
  ('f7ee0000-0000-4000-8000-000000000003', 'nutrition-outsider@example.invalid');
insert into public.restaurants (id, name) values
  ('f7ee0000-0000-4000-8000-000000000010', 'Nutrition check A'),
  ('f7ee0000-0000-4000-8000-000000000011', 'Nutrition check A second'),
  ('f7ee0000-0000-4000-8000-000000000012', 'Nutrition check B');
insert into public.restaurant_members (restaurant_id, user_id) values
  ('f7ee0000-0000-4000-8000-000000000010', 'f7ee0000-0000-4000-8000-000000000001'),
  ('f7ee0000-0000-4000-8000-000000000011', 'f7ee0000-0000-4000-8000-000000000001'),
  ('f7ee0000-0000-4000-8000-000000000012', 'f7ee0000-0000-4000-8000-000000000002');

-- All fixture versions remain inactive: calculations must follow the ingredient's pinned version.
insert into public.nutrition_datasets
  (id, source, source_version, release_year, content_sha256, file_manifest, source_url, food_count, nutrient_count)
values
  ('f7ee0000-0000-4000-8000-000000000200', 'bls', 'nutrition-check', 2025, repeat('5',64), '[]', 'https://example.invalid', 5, 4),
  ('f7ee0000-0000-4000-8000-000000000201', 'bls', 'nutrition-unit-check', 2025, repeat('6',64), '[]', 'https://example.invalid', 1, 4),
  ('f7ee0000-0000-4000-8000-000000000202', 'bls', 'nutrition-definition-check', 2025, repeat('7',64), '[]', 'https://example.invalid', 1, 3);

insert into public.nutrients (dataset_id, code, name_de, name_en, unit, group_de, group_en, sort_index)
select dataset.id, macro.code, macro.code, macro.code,
  case when dataset.id = 'f7ee0000-0000-4000-8000-000000000201' and macro.code = 'PROT625' then 'mg' else macro.unit end,
  'Test', 'Test', macro.position
from (values ('f7ee0000-0000-4000-8000-000000000200'::uuid),
  ('f7ee0000-0000-4000-8000-000000000201'::uuid), ('f7ee0000-0000-4000-8000-000000000202'::uuid)) as dataset(id)
cross join (values ('ENERCC','kcal',1),('PROT625','g',2),('FAT','g',3),('CHO','g',4)) as macro(code,unit,position)
where not (dataset.id = 'f7ee0000-0000-4000-8000-000000000202' and macro.code = 'PROT625');

insert into public.bls_foods (dataset_id, bls_code, name_de, name_en, source_row)
select 'f7ee0000-0000-4000-8000-000000000200', 'NUT000' || n, 'Test ' || n, 'Test ' || n, n+1 from generate_series(1,5) n;
insert into public.bls_foods (dataset_id, bls_code, name_de, name_en, source_row) values
  ('f7ee0000-0000-4000-8000-000000000201', 'NUT0001', 'Unit test', 'Unit test', 2),
  ('f7ee0000-0000-4000-8000-000000000202', 'NUT0001', 'Definition test', 'Definition test', 2);

-- Energy intentionally differs from 4/4/9: the function must use BLS ENERCC.
insert into public.bls_food_nutrients (dataset_id, bls_code, nutrient_code, value, raw_value, value_kind)
select 'f7ee0000-0000-4000-8000-000000000200', food, code, number,
  case when kind = 'numeric' then number::text else raw end, kind
from (values
  ('NUT0001','ENERCC',100::numeric,null::text,'numeric'),('NUT0001','PROT625',10,null,'numeric'),
  ('NUT0001','FAT',2,null,'numeric'),('NUT0001','CHO',20,null,'numeric'),
  ('NUT0002','ENERCC',200,null,'numeric'),('NUT0002','PROT625',4,null,'numeric'),
  ('NUT0002','FAT',8,null,'numeric'),('NUT0002','CHO',5,null,'numeric'),
  ('NUT0003','ENERCC',50,null,'numeric'),('NUT0003','PROT625',null,'-','missing'),
  ('NUT0003','FAT',null,'TR','trace'),('NUT0003','CHO',null,'<LOD','below_lod'),
  ('NUT0004','ENERCC',null,'<LOQ','below_loq'),('NUT0004','PROT625',null,'<LOD or <LOQ','below_lod_or_loq'),
  ('NUT0004','FAT',null,null,'missing'),
  ('NUT0005','ENERCC',0,null,'numeric'),('NUT0005','PROT625',0,null,'numeric'),
  ('NUT0005','FAT',0,null,'numeric'),('NUT0005','CHO',0,null,'numeric')
) as fixture(food,code,number,raw,kind);
insert into public.bls_food_nutrients (dataset_id, bls_code, nutrient_code, value, raw_value, value_kind)
select definition.dataset_id, 'NUT0001', definition.code, value.number, value.number::text, 'numeric'
from public.nutrients definition
join (values ('ENERCC',100::numeric),('PROT625',10),('FAT',2),('CHO',20)) as value(code,number) on value.code=definition.code
where definition.dataset_id in ('f7ee0000-0000-4000-8000-000000000201','f7ee0000-0000-4000-8000-000000000202');

insert into public.restaurant_ingredients (id, restaurant_id, dataset_id, bls_code, name) values
  ('f7ee0000-0000-4000-8000-000000000100','f7ee0000-0000-4000-8000-000000000010','f7ee0000-0000-4000-8000-000000000200','NUT0001','Numeric A'),
  ('f7ee0000-0000-4000-8000-000000000101','f7ee0000-0000-4000-8000-000000000010','f7ee0000-0000-4000-8000-000000000200','NUT0002','Numeric B'),
  ('f7ee0000-0000-4000-8000-000000000102','f7ee0000-0000-4000-8000-000000000010','f7ee0000-0000-4000-8000-000000000200','NUT0003','Markers'),
  ('f7ee0000-0000-4000-8000-000000000103','f7ee0000-0000-4000-8000-000000000010','f7ee0000-0000-4000-8000-000000000200','NUT0004','Limits'),
  ('f7ee0000-0000-4000-8000-000000000104','f7ee0000-0000-4000-8000-000000000010','f7ee0000-0000-4000-8000-000000000200','NUT0005','Real zero'),
  ('f7ee0000-0000-4000-8000-000000000105','f7ee0000-0000-4000-8000-000000000010','f7ee0000-0000-4000-8000-000000000201','NUT0001','Wrong unit'),
  ('f7ee0000-0000-4000-8000-000000000106','f7ee0000-0000-4000-8000-000000000010','f7ee0000-0000-4000-8000-000000000202','NUT0001','Missing definition'),
  ('f7ee0000-0000-4000-8000-000000000107','f7ee0000-0000-4000-8000-000000000011','f7ee0000-0000-4000-8000-000000000200','NUT0001','Second restaurant'),
  ('f7ee0000-0000-4000-8000-000000000108','f7ee0000-0000-4000-8000-000000000012','f7ee0000-0000-4000-8000-000000000200','NUT0001','Private B ingredient');
insert into public.dishes (id,restaurant_id,name,servings) values
  ('f7ee0000-0000-4000-8000-000000000300','f7ee0000-0000-4000-8000-000000000010','Complete',4),
  ('f7ee0000-0000-4000-8000-000000000301','f7ee0000-0000-4000-8000-000000000010','Empty',1),
  ('f7ee0000-0000-4000-8000-000000000302','f7ee0000-0000-4000-8000-000000000010','Mixed markers',2),
  ('f7ee0000-0000-4000-8000-000000000303','f7ee0000-0000-4000-8000-000000000010','Limits',1),
  ('f7ee0000-0000-4000-8000-000000000304','f7ee0000-0000-4000-8000-000000000010','Zero',3),
  ('f7ee0000-0000-4000-8000-000000000305','f7ee0000-0000-4000-8000-000000000010','Wrong unit',1),
  ('f7ee0000-0000-4000-8000-000000000306','f7ee0000-0000-4000-8000-000000000010','Missing definition',1),
  ('f7ee0000-0000-4000-8000-000000000307','f7ee0000-0000-4000-8000-000000000011','Second restaurant',1),
  ('f7ee0000-0000-4000-8000-000000000308','f7ee0000-0000-4000-8000-000000000012','Private B dish',1);
insert into public.dish_ingredients (restaurant_id,dish_id,ingredient_id,quantity_g) values
  ('f7ee0000-0000-4000-8000-000000000010','f7ee0000-0000-4000-8000-000000000300','f7ee0000-0000-4000-8000-000000000100',200),
  ('f7ee0000-0000-4000-8000-000000000010','f7ee0000-0000-4000-8000-000000000300','f7ee0000-0000-4000-8000-000000000101',50),
  ('f7ee0000-0000-4000-8000-000000000010','f7ee0000-0000-4000-8000-000000000302','f7ee0000-0000-4000-8000-000000000100',100),
  ('f7ee0000-0000-4000-8000-000000000010','f7ee0000-0000-4000-8000-000000000302','f7ee0000-0000-4000-8000-000000000102',100),
  ('f7ee0000-0000-4000-8000-000000000010','f7ee0000-0000-4000-8000-000000000303','f7ee0000-0000-4000-8000-000000000103',100),
  ('f7ee0000-0000-4000-8000-000000000010','f7ee0000-0000-4000-8000-000000000304','f7ee0000-0000-4000-8000-000000000104',12.5),
  ('f7ee0000-0000-4000-8000-000000000010','f7ee0000-0000-4000-8000-000000000305','f7ee0000-0000-4000-8000-000000000105',100),
  ('f7ee0000-0000-4000-8000-000000000010','f7ee0000-0000-4000-8000-000000000306','f7ee0000-0000-4000-8000-000000000106',100),
  ('f7ee0000-0000-4000-8000-000000000011','f7ee0000-0000-4000-8000-000000000307','f7ee0000-0000-4000-8000-000000000107',100),
  ('f7ee0000-0000-4000-8000-000000000012','f7ee0000-0000-4000-8000-000000000308','f7ee0000-0000-4000-8000-000000000108',100);

set local role authenticated;
set local request.jwt.claim.sub='f7ee0000-0000-4000-8000-000000000001';
set local request.jwt.claims='{"sub":"f7ee0000-0000-4000-8000-000000000001","role":"authenticated"}';

do $$
declare actual jsonb; expected record; result record; issue jsonb;
begin
  select jsonb_object_agg(nutrient_code,jsonb_build_array(recipe_total,per_serving,status,ingredient_count,known_ingredient_count,issues))
  into actual from public.get_dish_nutrition('f7ee0000-0000-4000-8000-000000000300');
  if actual is distinct from '{"ENERCC":[300,75,"complete",2,2,[]],"PROT625":[22,5.5,"complete",2,2,[]],"FAT":[8,2,"complete",2,2,[]],"CHO":[42.5,10.625,"complete",2,2,[]]}'::jsonb then
    raise exception 'FAIL: weighted recipe/portion totals, units or numeric coverage are wrong.';
  end if;
  if (select array_agg(unit order by nutrient_code) from public.get_dish_nutrition('f7ee0000-0000-4000-8000-000000000300'))
      is distinct from array['g','kcal','g','g']::text[] then
    raise exception 'FAIL: expected units are kcal and grams.';
  end if;
  if (select count(*) from public.get_dish_nutrition('f7ee0000-0000-4000-8000-000000000307') where status='complete') <> 4
    or exists(select 1 from public.get_dish_nutrition('f7ee0000-0000-4000-8000-000000000308'))
    or exists(select 1 from public.get_dish_nutrition('f7ee0000-0000-4000-8000-000000000999'))
    or exists(select 1 from public.get_dish_nutrition(null)) then
    raise exception 'FAIL: function must respect ownership across restaurants and hide unknown IDs.';
  end if;
  if (select count(*) from public.get_dish_nutrition('f7ee0000-0000-4000-8000-000000000301')) <> 4
    or exists(select 1 from public.get_dish_nutrition('f7ee0000-0000-4000-8000-000000000301')
      where status<>'empty_recipe' or recipe_total is not null or per_serving is not null
        or ingredient_count<>0 or known_ingredient_count<>0 or issues<>'[]'::jsonb) then
    raise exception 'FAIL: empty recipe must remain unknown, not zero.';
  end if;
  if (select count(*) from public.get_dish_nutrition('f7ee0000-0000-4000-8000-000000000304')
      where status='complete' and recipe_total=0 and per_serving=0 and ingredient_count=1 and known_ingredient_count=1 and issues='[]'::jsonb) <> 4 then
    raise exception 'FAIL: real numeric zero was lost.';
  end if;
  if not exists(select 1 from public.get_dish_nutrition('f7ee0000-0000-4000-8000-000000000302')
    where nutrient_code='ENERCC' and status='complete' and recipe_total=150 and per_serving=75
      and ingredient_count=2 and known_ingredient_count=2 and issues='[]'::jsonb) then
    raise exception 'FAIL: missing protein/fat/carbs must not invalidate numeric energy.';
  end if;
  for expected in select * from (values ('PROT625','missing','-'),('FAT','trace','TR'),('CHO','below_lod','<LOD')) as cases(code,kind,raw) loop
    select * into strict result from public.get_dish_nutrition('f7ee0000-0000-4000-8000-000000000302') where nutrient_code=expected.code;
    issue:=result.issues->0;
    if result.status<>'incomplete' or result.recipe_total is not null or result.per_serving is not null
      or result.ingredient_count<>2 or result.known_ingredient_count<>1 or jsonb_array_length(result.issues)<>1
      or issue->>'reason' is distinct from expected.kind or issue->>'raw_value' is distinct from expected.raw
      or issue->>'value_kind' is distinct from expected.kind or issue->>'ingredient_name' is distinct from 'Markers'
      or issue->>'ingredient_id' is distinct from 'f7ee0000-0000-4000-8000-000000000102' then
      raise exception 'FAIL: incomplete marker or its ingredient details were not preserved: %',expected.code;
    end if;
  end loop;
  for expected in select * from (values
    ('ENERCC','below_loq','<LOQ','below_loq'),('PROT625','below_lod_or_loq','<LOD or <LOQ','below_lod_or_loq'),
    ('FAT','missing',null,'missing'),('CHO','missing_value',null,null)
  ) as cases(code,reason,raw,kind) loop
    select * into strict result from public.get_dish_nutrition('f7ee0000-0000-4000-8000-000000000303') where nutrient_code=expected.code;
    issue:=result.issues->0;
    if result.status<>'incomplete' or result.recipe_total is not null or result.per_serving is not null
      or result.ingredient_count<>1 or result.known_ingredient_count<>0 or jsonb_array_length(result.issues)<>1
      or issue->>'reason' is distinct from expected.reason or issue->>'raw_value' is distinct from expected.raw
      or issue->>'value_kind' is distinct from expected.kind then
      raise exception 'FAIL: limits, blank data or absent source row were not preserved: %',expected.code;
    end if;
  end loop;
  for expected in select * from (values
    ('f7ee0000-0000-4000-8000-000000000305'::uuid,'unit_mismatch'),
    ('f7ee0000-0000-4000-8000-000000000306'::uuid,'missing_definition')
  ) as cases(dish_id,reason) loop
    select * into strict result from public.get_dish_nutrition(expected.dish_id) where nutrient_code='PROT625';
    if result.status<>'incomplete' or result.recipe_total is not null or result.per_serving is not null
      or result.issues->0->>'reason' is distinct from expected.reason
      or (select count(*) from public.get_dish_nutrition(expected.dish_id) where status='complete')<>3 then
      raise exception 'FAIL: wrong units or missing definitions must not be guessed.';
    end if;
    if expected.reason='unit_mismatch' and (result.issues->0->>'source_unit' is distinct from 'mg'
      or result.issues->0->>'expected_unit' is distinct from 'g') then
      raise exception 'FAIL: unit mismatch details were lost.';
    end if;
  end loop;
end;
$$;

-- Source quantities and portion edits must be reflected without refreshing a cache.
update public.dishes set servings=2 where id='f7ee0000-0000-4000-8000-000000000300';
update public.dish_ingredients set quantity_g=125.5
where dish_id='f7ee0000-0000-4000-8000-000000000300' and ingredient_id='f7ee0000-0000-4000-8000-000000000100';
do $$
declare actual jsonb;
begin
  select jsonb_object_agg(nutrient_code,jsonb_build_array(recipe_total,per_serving)) into actual
  from public.get_dish_nutrition('f7ee0000-0000-4000-8000-000000000300');
  if actual is distinct from '{"ENERCC":[225.5,112.75],"PROT625":[14.55,7.275],"FAT":[6.51,3.255],"CHO":[27.6,13.8]}'::jsonb then
    raise exception 'FAIL: decimal quantities and serving edits were not recalculated exactly.';
  end if;
end;
$$;

-- While the deferred FK is unresolved, an invisible ingredient must not be skipped or leaked.
insert into public.dish_ingredients (restaurant_id,dish_id,ingredient_id,quantity_g)
values ('f7ee0000-0000-4000-8000-000000000010','f7ee0000-0000-4000-8000-000000000301','f7ee0000-0000-4000-8000-000000000108',100);
do $$
begin
  if (select count(*) from public.get_dish_nutrition('f7ee0000-0000-4000-8000-000000000301'))<>4
    or exists(select 1 from public.get_dish_nutrition('f7ee0000-0000-4000-8000-000000000301')
      where status<>'incomplete' or recipe_total is not null or per_serving is not null
        or ingredient_count<>1 or known_ingredient_count<>0 or jsonb_array_length(issues)<>1
        or issues->0->>'reason' is distinct from 'missing_ingredient'
        or issues->0->>'ingredient_name' is not null or issues->0->>'dataset_id' is not null
        or issues->0->>'bls_code' is not null) then
    raise exception 'FAIL: unresolved/private ingredient was skipped or its details leaked.';
  end if;
end;
$$;
delete from public.dish_ingredients where dish_id='f7ee0000-0000-4000-8000-000000000301';
set constraints all immediate;

set local request.jwt.claim.sub='f7ee0000-0000-4000-8000-000000000002';
set local request.jwt.claims='{"sub":"f7ee0000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
begin
  if exists(select 1 from public.get_dish_nutrition('f7ee0000-0000-4000-8000-000000000300'))
    or (select count(*) from public.get_dish_nutrition('f7ee0000-0000-4000-8000-000000000308') where status='complete')<>4 then
    raise exception 'FAIL: B must calculate only their own dish.';
  end if;
end;
$$;
set local request.jwt.claim.sub='f7ee0000-0000-4000-8000-000000000003';
set local request.jwt.claims='{"sub":"f7ee0000-0000-4000-8000-000000000003","role":"authenticated"}';
do $$ begin
  if exists(select 1 from public.get_dish_nutrition('f7ee0000-0000-4000-8000-000000000300')) then
    raise exception 'FAIL: account without membership read dish nutrition.';
  end if;
end; $$;
set local request.jwt.claim.sub='';
set local request.jwt.claims='{}';
do $$ begin
  if exists(select 1 from public.get_dish_nutrition('f7ee0000-0000-4000-8000-000000000300')) then
    raise exception 'FAIL: missing identity read dish nutrition.';
  end if;
end; $$;
set local role anon;
do $$ begin
  begin
    perform * from public.get_dish_nutrition('f7ee0000-0000-4000-8000-000000000300');
    raise exception 'FAIL: anonymous function execution was allowed.';
  exception when insufficient_privilege then null;
  end;
end; $$;
set local role service_role;
do $$ begin
  if (select count(*) from public.get_dish_nutrition('f7ee0000-0000-4000-8000-000000000308') where status='complete')<>4 then
    raise exception 'FAIL: trusted backend cannot use the function.';
  end if;
end; $$;
reset role;
do $$ begin
  if (select prosecdef from pg_proc where oid='public.get_dish_nutrition(uuid)'::regprocedure)
    or (select provolatile from pg_proc where oid='public.get_dish_nutrition(uuid)'::regprocedure)<>'s'
    or has_function_privilege('anon','public.get_dish_nutrition(uuid)','EXECUTE')
    or not has_function_privilege('authenticated','public.get_dish_nutrition(uuid)','EXECUTE') then
    raise exception 'FAIL: function security or volatility configuration is incorrect.';
  end if;
end; $$;

select 'Dish nutrition: weighted totals, portions, markers, zero, empty recipes, units, pinned versions, live edits and caller isolation passed; rolling back.' as result;
rollback;
