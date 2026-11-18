-- Run as postgres after the shared-cache migration. Everything rolls back.
begin;
insert into auth.users(id,email) values
 ('f7170000-0000-4000-8000-000000000001','off-cache-a@example.invalid'),
 ('f7170000-0000-4000-8000-000000000002','off-cache-b@example.invalid'),
 ('f7170000-0000-4000-8000-000000000003','off-cache-no-restaurant@example.invalid');
insert into public.restaurants(id,name) values
 ('f7170000-0000-4000-8000-000000000010','Cache A'),
 ('f7170000-0000-4000-8000-000000000011','Cache B');
insert into public.restaurant_members(restaurant_id,user_id) values
 ('f7170000-0000-4000-8000-000000000010','f7170000-0000-4000-8000-000000000001'),
 ('f7170000-0000-4000-8000-000000000011','f7170000-0000-4000-8000-000000000002');

create temporary table off_cache_fixture(food jsonb, payload jsonb);
insert into off_cache_fixture(food) values (jsonb_build_object(
 'id','off:3017620422003','name','Provider fixture','detail','Test only',
 'basis','100ml','preparation','as_sold','energyKcal',50,'proteinG',0,'fatG',null,'carbohydrateG',10,
 'privateNote','must not be shared','restaurantId','private restaurant',
 'source',jsonb_build_object('kind','off','barcode','3017620422003',
 'fetchedAt',to_char(now() at time zone 'UTC' - interval '2 days','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
 'modifiedAt',null,'confirmedBy','private user')));
update off_cache_fixture set payload = jsonb_build_object('catalogFoods',jsonb_build_array(food),'manualFoods','[]'::jsonb,
 'importedIds','[]'::jsonb,'customDishes','[{"id":"f7170000-0000-4000-8000-000000000030","name":"Private dish","price":null}]'::jsonb,
 'recipes','{"manual-f7170000-0000-4000-8000-000000000030":{"servings":"1","ingredients":[{"foodId":"off:3017620422003","quantity":"200","unit":"ml"}]}}'::jsonb);
grant select,update on off_cache_fixture to authenticated,service_role;

set local role authenticated;
set local request.jwt.claim.sub='f7170000-0000-4000-8000-000000000001';
do $$ begin
 if public.read_shared_off_product('3017620422003') is not null then raise exception 'Unexpected existing test barcode'; end if;
 perform public.save_restaurant_onboarding('f7170000-0000-4000-8000-000000000010',
   (select payload from off_cache_fixture),0,'f7170000-0000-4000-8000-000000000090');
 if public.read_shared_off_product('3017620422003') is not null then raise exception 'User-facing save published untrusted data'; end if;
 begin
  perform public.publish_confirmed_off_products('f7170000-0000-4000-8000-000000000010',
    'f7170000-0000-4000-8000-000000000090',(select jsonb_build_array(food) from off_cache_fixture));
  raise exception 'User published into shared cache';
 exception when insufficient_privilege then null; end;
 begin
  perform 1 from makroklar_private.off_products;
  raise exception 'Private table is exposed';
 exception when insufficient_privilege then null; end;
end $$;

reset role;
set local role service_role;
do $$ begin
 begin
  perform public.publish_confirmed_off_products('f7170000-0000-4000-8000-000000000010',
    'f7170000-0000-4000-8000-000000000099',(select jsonb_build_array(food) from off_cache_fixture));
  raise exception 'Unconfirmed request published';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.publish_confirmed_off_products('f7170000-0000-4000-8000-000000000010',
    'f7170000-0000-4000-8000-000000000090',(select jsonb_build_array(jsonb_set(food,'{energyKcal}','999')) from off_cache_fixture));
  raise exception 'Different product was published';
 exception when invalid_parameter_value then null; end;
 perform public.publish_confirmed_off_products('f7170000-0000-4000-8000-000000000010',
   'f7170000-0000-4000-8000-000000000090',(select jsonb_build_array(food) from off_cache_fixture));
end $$;

reset role;
set local role authenticated;
set local request.jwt.claim.sub='f7170000-0000-4000-8000-000000000002';
do $$ declare shared jsonb; begin
 shared := public.read_shared_off_product('3017620422003');
 if shared is null or shared->>'proteinG' <> '0' or shared->'fatG' <> 'null'::jsonb then raise exception 'Shared values lost zero/null'; end if;
 if shared ? 'restaurantId' or shared ? 'privateNote' or shared->'source' ? 'confirmedBy' then raise exception 'Private fields leaked'; end if;
 if public.read_saved_off_product('3017620422003') is not null
   or public.read_restaurant_onboarding('f7170000-0000-4000-8000-000000000010') is not null
   or exists(select 1 from public.dishes) or exists(select 1 from public.restaurant_ingredients) then
  raise exception 'Restaurant A data leaked to restaurant B'; end if;
 -- B confirms newer provider data; publishing it must not change A's accepted values.
 update off_cache_fixture set food = jsonb_set(jsonb_set(food,'{energyKcal}','75'),'{source,fetchedAt}',
   to_jsonb(to_char(now() at time zone 'UTC' - interval '1 day','YYYY-MM-DD"T"HH24:MI:SS"Z"')));
 update off_cache_fixture set payload = jsonb_set(payload,'{catalogFoods}',jsonb_build_array(food));
 perform public.save_restaurant_onboarding('f7170000-0000-4000-8000-000000000011',
   (select payload from off_cache_fixture),0,'f7170000-0000-4000-8000-000000000091');
end $$;

reset role;
set local role service_role;
-- Publishing a valid product followed by an invalid one must roll back the whole batch.
do $$ begin
 begin
  perform public.publish_confirmed_off_products('f7170000-0000-4000-8000-000000000011',
   'f7170000-0000-4000-8000-000000000091',
   (select jsonb_build_array(food,jsonb_set(food,'{energyKcal}','999')) from off_cache_fixture));
  raise exception 'Invalid batch succeeded';
 exception when invalid_parameter_value then null; end;
end $$;
reset role;
do $$ begin
 if (select product->>'energyKcal' from makroklar_private.off_products where barcode='3017620422003') <> '50' then
  raise exception 'Failed batch partially updated cache'; end if;
end $$;
set local role service_role;
select public.publish_confirmed_off_products('f7170000-0000-4000-8000-000000000011',
 'f7170000-0000-4000-8000-000000000091',(select jsonb_build_array(food) from off_cache_fixture));
reset role;
set local role authenticated;
set local request.jwt.claim.sub='f7170000-0000-4000-8000-000000000001';
do $$ declare dish_id uuid; begin
 if public.read_shared_off_product('3017620422003')->>'energyKcal' <> '75' then raise exception 'Cache not refreshed'; end if;
 if public.read_saved_off_product('3017620422003')->>'energyKcal' <> '50' then raise exception 'Accepted snapshot changed'; end if;
 select id into dish_id from public.dishes where client_id='f7170000-0000-4000-8000-000000000030';
 if (select per_serving from public.get_dish_nutrition(dish_id) where nutrient_code='ENERCC') is distinct from 100::numeric then
  raise exception 'Shared refresh changed a saved recipe'; end if;
end $$;
reset role;
set local role service_role;
-- Late publication of A's older provider data cannot roll back freshness.
select public.publish_confirmed_off_products('f7170000-0000-4000-8000-000000000010',
 'f7170000-0000-4000-8000-000000000090',
 (select jsonb_build_array(source_data) from public.restaurant_ingredients
   where restaurant_id='f7170000-0000-4000-8000-000000000010' and source_kind='off'));
reset role;
do $$ begin
 if (select product->>'energyKcal' from makroklar_private.off_products where barcode='3017620422003') <> '75'
   or (select count(*) from makroklar_private.off_products where barcode='3017620422003') <> 1 then
  raise exception 'Older publication replaced or duplicated the shared product'; end if;
end $$;

set local role authenticated;
set local request.jwt.claim.sub='f7170000-0000-4000-8000-000000000003';
do $$ begin
 if public.read_shared_off_product('3017620422003') is not null then raise exception 'Account without restaurant read cache'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
 begin
  perform public.read_shared_off_product('3017620422003'); raise exception 'Anonymous cache read allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
-- A cache lifetime is independent of restaurant ingredient deletion.
delete from public.dish_ingredients where restaurant_id in ('f7170000-0000-4000-8000-000000000010','f7170000-0000-4000-8000-000000000011');
delete from public.restaurant_ingredients where restaurant_id in ('f7170000-0000-4000-8000-000000000010','f7170000-0000-4000-8000-000000000011');
do $$ begin
 if not exists(select 1 from makroklar_private.off_products where barcode='3017620422003') then raise exception 'Tenant deletion removed shared cache'; end if;
 if has_function_privilege('authenticated','public.publish_confirmed_off_products(uuid,uuid,jsonb)','EXECUTE')
   or has_function_privilege('anon','public.publish_confirmed_off_products(uuid,uuid,jsonb)','EXECUTE')
   or has_table_privilege('service_role','makroklar_private.off_products','INSERT') then raise exception 'Unexpected cache grants'; end if;
end $$;
update makroklar_private.off_products set fetched_at=now()-interval '31 days' where barcode='3017620422003';
set local role authenticated;
set local request.jwt.claim.sub='f7170000-0000-4000-8000-000000000001';
do $$ begin
 if public.read_shared_off_product('3017620422003') is not null then raise exception 'Expired cache returned'; end if;
end $$;
reset role;
rollback;
