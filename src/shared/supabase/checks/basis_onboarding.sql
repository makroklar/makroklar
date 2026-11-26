-- Run as postgres on a disposable database after 20261124000400.
-- Integration checks of the actual v1/v2 RPCs, roles, transaction rollback and summaries.
-- Stop on error. All fixtures are discarded by ROLLBACK.
begin;
insert into auth.users(id,email) values
  ('ba542400-0000-4000-8000-000000000001','basis-save-a@example.invalid'),
  ('ba542400-0000-4000-8000-000000000002','basis-save-b@example.invalid');
insert into public.restaurants(id,name) values
  ('ba542400-0000-4000-8000-000000000010','Basis save A'),
  ('ba542400-0000-4000-8000-000000000012','Basis save B');
insert into public.restaurant_members(restaurant_id,user_id) values
  ('ba542400-0000-4000-8000-000000000010','ba542400-0000-4000-8000-000000000001'),
  ('ba542400-0000-4000-8000-000000000012','ba542400-0000-4000-8000-000000000002');
set local role authenticated;
set local request.jwt.claim.sub='ba542400-0000-4000-8000-000000000001';
set local request.jwt.claims='{"sub":"ba542400-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
declare
  rest constant uuid := 'ba542400-0000-4000-8000-000000000010';
  other_rest constant uuid := 'ba542400-0000-4000-8000-000000000012';
  first_key constant text := 'manual-ba542400-0000-4000-8000-000000000300';
  second_key constant text := 'manual-ba542400-0000-4000-8000-000000000301';
  base_client constant text := 'ba542400-0000-4000-8000-000000000200';
  request_id uuid := gen_random_uuid();
  original jsonb; payload jsonb; modified jsonb; summary jsonb; snapshot jsonb; before_failure jsonb; version integer;
begin
  original := '{
    "importedIds":[],"catalogFoods":[],
    "customDishes":[
      {"id":"ba542400-0000-4000-8000-000000000300","name":"First dish","price":12},
      {"id":"ba542400-0000-4000-8000-000000000301","name":"Second dish","price":8}],
    "manualFoods":[{"id":"ba542400-0000-4000-8000-000000000100","name":"Test food","basis":"100g","preparation":"as_sold",
      "energyKcal":100,"proteinG":10,"fatG":2,"carbohydrateG":20,
      "sourceKind":"label","sourceDescription":"Synthetic check","noticeVersion":"2026-11-10.2"}],
    "recipes":{
      "manual-ba542400-0000-4000-8000-000000000300":{"servings":"1","ingredients":[{"foodId":"ba542400-0000-4000-8000-000000000100","quantity":"50","unit":"g"}]},
      "manual-ba542400-0000-4000-8000-000000000301":{"servings":"1","ingredients":[]}}
  }'::jsonb;
  -- Existing accounts without bases still use the original RPC.
  summary := public.save_restaurant_onboarding(rest,original,0,request_id);
  if (summary->>'version')::integer<>1 then raise exception 'FAIL: v1 initial save broken.'; end if;
  payload := original || '{
    "schemaVersion":2,"deletedBasisIds":[],
    "basisRecipes":[{"id":"ba542400-0000-4000-8000-000000000200","name":"Test sauce","outputQuantity":"400","outputUnit":"g",
      "ingredients":[{"foodId":"ba542400-0000-4000-8000-000000000100","quantity":"200","unit":"g"}]}],
    "dishBases":{
      "manual-ba542400-0000-4000-8000-000000000300":[{"basisId":"ba542400-0000-4000-8000-000000000200","quantity":"80","unit":"g"}],
      "manual-ba542400-0000-4000-8000-000000000301":[{"basisId":"ba542400-0000-4000-8000-000000000200","quantity":"200","unit":"g"}]}
  }'::jsonb;
  request_id := gen_random_uuid();
  summary := public.save_restaurant_onboarding_v2(rest,payload,1,request_id);
  snapshot := public.read_restaurant_onboarding_v2(rest);
  if snapshot->'summary' is distinct from summary or snapshot->>'schemaVersion'<>'2'
    or jsonb_array_length(snapshot->'basisRecipes')<>1
    or (snapshot#>>'{basisRecipes,0,outputQuantity}')::numeric<>400
    or snapshot#>>'{basisRecipes,0,id}' is distinct from base_client
    or jsonb_array_length(snapshot->'dishBases'->first_key)<>1
    or (summary->>'completeCount')::integer<>2 then raise exception 'FAIL: v2 read/summary mismatch.'; end if;
  if not exists(select 1 from jsonb_array_elements(summary->'dishes') d, jsonb_array_elements(d->'metrics') m
    where d->>'key'=first_key and m->>'nutrient_code'='ENERCC' and (m->>'per_serving')::numeric=90)
    or not exists(select 1 from jsonb_array_elements(summary->'dishes') d, jsonb_array_elements(d->'metrics') m
    where d->>'key'=second_key and m->>'nutrient_code'='ENERCC' and (m->>'per_serving')::numeric=100) then
    raise exception 'FAIL: v2 did not calculate both dishes.';
  end if;
  if public.save_restaurant_onboarding_v2(rest,payload,1,request_id) is distinct from summary then
    raise exception 'FAIL: retry was not idempotent.';
  end if;
  begin
    perform public.save_restaurant_onboarding_v2(rest,jsonb_set(payload,'{basisRecipes,0,name}','"Other"'),1,request_id);
    raise exception 'FAIL: reused request ID with different data accepted.';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.save_restaurant_onboarding_v2(rest,payload,1,gen_random_uuid());
    raise exception 'FAIL: stale version accepted.';
  exception when sqlstate '40001' then null; end;
  begin
    perform public.save_restaurant_onboarding(rest,original,2,gen_random_uuid());
    raise exception 'FAIL: old client overwrote basis-aware state.';
  exception when sqlstate '55000' then null; end;
  begin
    perform makroklar_private.save_restaurant_onboarding_legacy(rest,original,2,gen_random_uuid());
    raise exception 'FAIL: legacy private bypass callable by client.';
  exception when insufficient_privilege then null; end;
  begin
    perform public.save_restaurant_onboarding_v2(other_rest,payload,0,gen_random_uuid());
    raise exception 'FAIL: cross-tenant save accepted.';
  exception when insufficient_privilege then null; end;
  if public.read_restaurant_onboarding_v2(other_rest) is not null then raise exception 'FAIL: cross-tenant read exposed.'; end if;

  -- Change one base; omit the second dish and all dish links. Both summaries must refresh.
  modified := jsonb_set(payload,'{basisRecipes,0,ingredients,0,quantity}','"300"')
    || jsonb_build_object('customDishes',jsonb_build_array(payload->'customDishes'->0),'recipes','{}'::jsonb,'dishBases','{}'::jsonb);
  summary := public.save_restaurant_onboarding_v2(rest,modified,2,gen_random_uuid());
  if (summary->>'dishCount')::integer<>2 or not exists(
    select 1 from jsonb_array_elements(summary->'dishes') d,jsonb_array_elements(d->'metrics') m
      where d->>'key'=second_key and m->>'nutrient_code'='ENERCC' and (m->>'per_serving')::numeric=150) then
    raise exception 'FAIL: omitted dish summary stayed stale after shared basis edit.';
  end if;

  -- Omitted bases/links must survive. Foods referenced ONLY by a basis must survive cleanup.
  -- First explicitly remove the direct-food line so this tests the new retention condition.
  modified := payload || jsonb_build_object('basisRecipes','[]'::jsonb,'dishBases','{}'::jsonb,
    'recipes',jsonb_build_object(first_key,jsonb_build_object('servings','1','ingredients','[]'::jsonb)));
  summary := public.save_restaurant_onboarding_v2(rest,modified,3,gen_random_uuid());
  modified := payload || '{"basisRecipes":[],"dishBases":{},"recipes":{},"manualFoods":[],"customDishes":[]}'::jsonb;
  summary := public.save_restaurant_onboarding_v2(rest,modified,4,gen_random_uuid());
  snapshot := public.read_restaurant_onboarding_v2(rest);
  if jsonb_array_length(snapshot->'basisRecipes')<>1 or jsonb_array_length(snapshot->'manualFoods')<>1
    or (summary->>'foodCount')::integer<>1 or jsonb_array_length(snapshot->'dishBases'->second_key)<>1 then
    raise exception 'FAIL: omitted basis, links or referenced supplies were removed.';
  end if;
  version := (snapshot->>'version')::integer;
  before_failure := snapshot;

  -- Late FK failure must roll back food, basis, dish, version and summary edits together.
  modified := jsonb_set(payload,'{basisRecipes,0,name}','"Must rollback"');
  modified := jsonb_set(modified,array['dishBases',first_key,'0','unit'],'"ml"');
  begin
    perform public.save_restaurant_onboarding_v2(rest,modified,version,gen_random_uuid());
    raise exception 'FAIL: mismatched basis unit accepted.';
  exception when foreign_key_violation then null; end;
  if public.read_restaurant_onboarding_v2(rest) is distinct from before_failure then raise exception 'FAIL: late failure partially saved.'; end if;
  modified := jsonb_set(payload,'{basisRecipes,0,ingredients,0,unit}','"ml"');
  begin
    perform public.save_restaurant_onboarding_v2(rest,modified,version,gen_random_uuid());
    raise exception 'FAIL: ingredient g/ml conversion accepted.';
  exception when sqlstate '22023' then null; end;
  modified := payload || jsonb_build_object('basisRecipes','[]'::jsonb,'dishBases','{}'::jsonb,'deletedBasisIds',jsonb_build_array(base_client));
  begin
    perform public.save_restaurant_onboarding_v2(rest,modified,version,gen_random_uuid());
    raise exception 'FAIL: referenced basis deletion accepted.';
  exception when foreign_key_violation then null; end;
  if public.read_restaurant_onboarding_v2(rest) is distinct from before_failure then raise exception 'FAIL: rejected deletion changed data.'; end if;

  -- A draft may be linked, but its missing output makes both dishes incomplete.
  modified := jsonb_set(payload,'{basisRecipes,0,outputQuantity}','null');
  summary := public.save_restaurant_onboarding_v2(rest,modified,version,gen_random_uuid());
  if (summary->>'completeCount')::integer<>0 or (summary->>'draftCount')::integer<>2 then
    raise exception 'FAIL: missing basis output did not propagate into summary.';
  end if;
  version := (summary->>'version')::integer;
  -- Explicitly unlink then delete, in one transaction; direct dish food survives.
  modified := payload || jsonb_build_object('basisRecipes','[]'::jsonb,'deletedBasisIds',jsonb_build_array(base_client),
    'dishBases',jsonb_build_object(first_key,'[]'::jsonb,second_key,'[]'::jsonb));
  summary := public.save_restaurant_onboarding_v2(rest,modified,version,gen_random_uuid());
  snapshot := public.read_restaurant_onboarding_v2(rest);
  if snapshot->'basisRecipes'<>'[]'::jsonb or snapshot->'dishBases'->first_key<>'[]'::jsonb
    or jsonb_array_length(snapshot->'manualFoods')<>1 or (summary->>'completeCount')::integer<>1 then
    raise exception 'FAIL: explicit unlink/delete corrupted remaining data.';
  end if;
end;
$$;
reset role;
do $$ begin
  if exists(select 1 from public.basis_recipes where restaurant_id='ba542400-0000-4000-8000-000000000012')
    or exists(select 1 from public.dishes where restaurant_id='ba542400-0000-4000-8000-000000000012')
    or exists(select 1 from public.restaurant_onboarding where restaurant_id='ba542400-0000-4000-8000-000000000012') then
    raise exception 'FAIL: other restaurant changed.';
  end if;
end; $$;
set constraints all immediate;
select 'v2 save/read, full summaries, retry/conflict handling, deletion, rollback and old-client guards passed; rolling back.' as result;
rollback;
