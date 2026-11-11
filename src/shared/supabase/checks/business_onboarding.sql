-- Run as postgres after the onboarding migration. No fixtures survive ROLLBACK.
begin;
insert into auth.users(id,email) values
 ('f7110000-0000-4000-8000-000000000001','onboarding-a@example.invalid'),
 ('f7110000-0000-4000-8000-000000000002','onboarding-b@example.invalid');
insert into public.restaurants(id,name) values
 ('f7110000-0000-4000-8000-000000000010','Onboarding A'),
 ('f7110000-0000-4000-8000-000000000011','Onboarding B');
insert into public.restaurant_members(restaurant_id,user_id) values
 ('f7110000-0000-4000-8000-000000000010','f7110000-0000-4000-8000-000000000001'),
 ('f7110000-0000-4000-8000-000000000011','f7110000-0000-4000-8000-000000000002');
insert into public.nutrition_datasets(id,source,source_version,release_year,content_sha256,file_manifest,source_url,food_count,nutrient_count)
 values('f7110000-0000-4000-8000-000000000200','bls','onboarding-check',2025,repeat('a',64),'[]','https://example.invalid',1,4);
insert into public.bls_foods(dataset_id,bls_code,name_de,name_en,source_row)
 values('f7110000-0000-4000-8000-000000000200','CHECK01','Test food','Test food',2);
insert into public.nutrients(dataset_id,code,name_de,name_en,unit,group_de,group_en,sort_index)
 select 'f7110000-0000-4000-8000-000000000200',code,code,code,unit,'Test','Test',pos
 from (values('ENERCC','kcal',1),('PROT625','g',2),('FAT','g',3),('CHO','g',4)) m(code,unit,pos);
insert into public.bls_food_nutrients(dataset_id,bls_code,nutrient_code,value,raw_value,value_kind)
 select 'f7110000-0000-4000-8000-000000000200','CHECK01',code,val,val::text,'numeric'
 from (values('ENERCC',100),('PROT625',10),('FAT',2),('CHO',20)) m(code,val);
insert into public.dishes(id,restaurant_id,name,source,source_id)
 values('f7110000-0000-4000-8000-000000000300','f7110000-0000-4000-8000-000000000010','Imported','lightspeed-k-series','99');

set local role authenticated;
set local request.jwt.claim.sub='f7110000-0000-4000-8000-000000000001';
do $$
declare
 rest constant uuid := 'f7110000-0000-4000-8000-000000000010';
 req constant uuid := 'f7110000-0000-4000-8000-000000000090';
 payload jsonb := '{
  "importedIds":[99],
  "customDishes":[
   {"id":"f7110000-0000-4000-8000-000000000301","name":"Mixed recipe","price":12.5},
   {"id":"f7110000-0000-4000-8000-000000000302","name":"Empty draft","price":null}],
  "catalogFoods":[
   {"id":"bls:f7110000-0000-4000-8000-000000000200:CHECK01","name":"BLS food","detail":"BLS test","basis":"100g","preparation":null,"energyKcal":999,"proteinG":999,"fatG":999,"carbohydrateG":999,"source":{"kind":"bls","datasetId":"f7110000-0000-4000-8000-000000000200","code":"CHECK01","version":"onboarding-check"}},
   {"id":"off:3017620422003","name":"OFF fixture","detail":"Test only","basis":"100ml","preparation":"as_sold","energyKcal":50,"proteinG":0,"fatG":1,"carbohydrateG":10,"source":{"kind":"off","barcode":"3017620422003","fetchedAt":"2026-11-11T10:00:00Z","modifiedAt":null}}],
  "manualFoods":[{"id":"f7110000-0000-4000-8000-000000000100","name":"Manual fixture","basis":"100g","preparation":"as_sold","energyKcal":200,"proteinG":8,"fatG":10,"carbohydrateG":20,"sourceKind":"label","sourceDescription":"Test packaging","noticeVersion":"2026-11-10.2"}],
  "recipes":{"manual-f7110000-0000-4000-8000-000000000301":{"servings":"2","ingredients":[
   {"foodId":"bls:f7110000-0000-4000-8000-000000000200:CHECK01","quantity":"200","unit":"g"},
   {"foodId":"off:3017620422003","quantity":"100","unit":"ml"},
   {"foodId":"f7110000-0000-4000-8000-000000000100","quantity":"50","unit":"g"}]}}
 }';
 result jsonb; snapshot jsonb; bad jsonb; first_id uuid; amount numeric;
begin
 result := public.save_restaurant_onboarding(rest,payload,0,req);
 if result->>'dishCount'<>'3' or result->>'foodCount'<>'3' or result->>'completeCount'<>'1' or result->>'draftCount'<>'2' then
  raise exception 'Summary counts differ: %',result;
 end if;
 select id into first_id from public.dishes where restaurant_id=rest and client_id='f7110000-0000-4000-8000-000000000301';
 select per_serving into amount from public.get_dish_nutrition(first_id) where nutrient_code='ENERCC';
 if amount is distinct from 175 then raise exception 'Mixed g/ml recipe must have 175 kcal per serving, got %',amount; end if;
 select per_serving into amount from public.get_dish_nutrition(first_id) where nutrient_code='PROT625';
 if amount is distinct from 12 then raise exception 'Explicit OFF zero or BLS authority was lost'; end if;
 snapshot := public.read_restaurant_onboarding(rest);
 if snapshot#>>'{recipes,manual-f7110000-0000-4000-8000-000000000301,servings}'<>'2'
  or jsonb_array_length(snapshot->'customDishes')<>2 or jsonb_array_length(snapshot->'manualFoods')<>1 then
  raise exception 'Snapshot did not restore saved state';
 end if;
 if not exists(select 1 from jsonb_array_elements(snapshot->'catalogFoods') f where f#>>'{source,kind}'='bls' and f->>'energyKcal'='100') then
  raise exception 'BLS restoration must read authoritative values, not supplied values';
 end if;
 if public.read_saved_off_product('3017620422003') is distinct from payload#>'{catalogFoods,1}' then raise exception 'Confirmed OFF cache is absent'; end if;
 if not exists(select 1 from public.restaurant_ingredients where restaurant_id=rest and source_kind='manual' and confirmed_by=auth.uid() and confirmed_at is not null) then
  raise exception 'Manual confirmation provenance is missing';
 end if;
 if public.save_restaurant_onboarding(rest,payload,0,req) is distinct from result then raise exception 'Retry must return the original result'; end if;
 if (select count(*) from public.dishes where restaurant_id=rest)<>3 then raise exception 'Retry duplicated dishes'; end if;
 begin
  perform public.save_restaurant_onboarding(rest,jsonb_set(payload,'{customDishes,0,name}','"Changed"'),0,req);
  raise exception 'Changed request unexpectedly accepted';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.save_restaurant_onboarding(rest,payload,0,'f7110000-0000-4000-8000-000000000091');
  raise exception 'Stale version unexpectedly accepted';
 exception when serialization_failure then null; end;
 begin
  perform public.save_restaurant_onboarding('f7110000-0000-4000-8000-000000000011',payload,0,req);
  raise exception 'Cross-restaurant write unexpectedly accepted';
 exception when insufficient_privilege then null; end;
 if public.read_restaurant_onboarding('f7110000-0000-4000-8000-000000000011') is not null then raise exception 'Foreign snapshot leaked'; end if;

 -- A failure late in the function must roll back earlier ingredient/dish updates.
 bad := jsonb_set(payload,'{customDishes,0,name}','"Must roll back"');
 bad := jsonb_set(bad,'{recipes,manual-f7110000-0000-4000-8000-000000000301,ingredients,1,unit}','"g"');
 begin
  perform public.save_restaurant_onboarding(rest,bad,1,'f7110000-0000-4000-8000-000000000092');
  raise exception 'Mass/volume mismatch unexpectedly accepted';
 exception when invalid_parameter_value then null; end;
 if (select name from public.dishes where id=first_id)<>'Mixed recipe' or (public.read_restaurant_onboarding(rest)->>'version')<>'1' then
  raise exception 'Failed save left partial writes';
 end if;
 bad := jsonb_set(payload,'{manualFoods,0,noticeVersion}','"old"');
 begin
  perform public.save_restaurant_onboarding(rest,bad,1,'f7110000-0000-4000-8000-000000000093');
  raise exception 'Missing current consent unexpectedly accepted';
 exception when invalid_parameter_value then null; end;
 payload := jsonb_set(payload,'{catalogFoods,1,fatG}','null');
 result := public.save_restaurant_onboarding(rest,payload,1,'f7110000-0000-4000-8000-000000000094');
 if result->>'completeCount'<>'0' or result->>'draftCount'<>'3' then raise exception 'Missing OFF value must produce a draft'; end if;
 if not exists(select 1 from public.get_dish_nutrition(first_id) where nutrient_code='FAT' and status='incomplete' and recipe_total is null and per_serving is null) then
  raise exception 'Missing values were converted to a partial total';
 end if;
 if not exists(select 1 from public.dishes where id=first_id) then raise exception 'Save changed a stable dish ID'; end if;
 -- Remove the OFF ingredient from both selection and recipe, then save again.
 payload := payload #- '{catalogFoods,1}';
 payload := payload #- '{recipes,manual-f7110000-0000-4000-8000-000000000301,ingredients,1}';
 perform public.save_restaurant_onboarding(rest,payload,2,'f7110000-0000-4000-8000-000000000095');
 if public.read_saved_off_product('3017620422003') is not null then raise exception 'Deselected food reappeared after saving'; end if;
 if has_function_privilege('anon','public.save_restaurant_onboarding(uuid,jsonb,integer,uuid)','EXECUTE')
  or has_table_privilege('authenticated','public.restaurant_onboarding','INSERT') then raise exception 'Unexpected write privileges'; end if;
end $$;

set local request.jwt.claim.sub='f7110000-0000-4000-8000-000000000002';
do $$ begin
 if exists(select 1 from public.restaurant_onboarding) or exists(select 1 from public.restaurant_ingredients)
  or public.read_saved_off_product('3017620422003') is not null then raise exception 'Tenant isolation failed'; end if;
end $$;
reset role;
rollback;
