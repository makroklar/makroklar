-- Prepared locally, not applied. Requires basis foundation + calculation migrations.
-- v2 writes are atomic; no frontend rollout in this batch.
begin;

-- Retain the previous implementation behind a non-callable private entry point.
-- The public guard is serialized with v2 and the menu importer.
alter function public.save_restaurant_onboarding(uuid,jsonb,integer,uuid) set schema makroklar_private;
alter function makroklar_private.save_restaurant_onboarding(uuid,jsonb,integer,uuid)
  rename to save_restaurant_onboarding_legacy;
revoke all on function makroklar_private.save_restaurant_onboarding_legacy(uuid,jsonb,integer,uuid)
  from public,anon,authenticated,service_role;

create function public.save_restaurant_onboarding(target_restaurant_id uuid,payload jsonb,base_version integer,request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.restaurant_members m
    where m.restaurant_id=target_restaurant_id and m.user_id=auth.uid() and m.role='owner') then
    raise exception using errcode='42501',message='Restaurant access is required.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('makroklar:onboarding:'||target_restaurant_id::text,0));
  perform pg_advisory_xact_lock(hashtextextended('makroklar:lightspeed-import:'||target_restaurant_id::text,0));
  if exists(select 1 from public.basis_recipes b where b.restaurant_id=target_restaurant_id)
    or payload ?| array['schemaVersion','basisRecipes','dishBases','deletedBasisIds'] then
    raise exception using errcode='55000',message='Basis-aware client required. Reload with the updated application.';
  end if;
  return makroklar_private.save_restaurant_onboarding_legacy(target_restaurant_id,payload,base_version,request_id);
end;
$$;
revoke all on function public.save_restaurant_onboarding(uuid,jsonb,integer,uuid) from public,anon,authenticated,service_role;
grant execute on function public.save_restaurant_onboarding(uuid,jsonb,integer,uuid) to authenticated;

create function public.save_restaurant_onboarding_v2(target_restaurant_id uuid,payload jsonb,base_version integer,request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
<<onboarding_save>>
declare
  current_state public.restaurant_onboarding%rowtype;
  basis jsonb; deleted_id jsonb; basis_id uuid; basis_ids jsonb := '{}'; seen_basis_ids jsonb := '{}';
  output_amount numeric; source_basis text;
  food jsonb; dish jsonb; recipe jsonb; line jsonb; key text; kind text; field text;
  food_id uuid; dish_id uuid; food_ids jsonb := '{}'; dish_ids jsonb := '{}';
  dataset uuid; code text; amount numeric; portions numeric; metrics jsonb; complete boolean;
  result jsonb; results jsonb := '[]'; completed integer := 0; total_dishes integer := 0;
  next_version integer; restaurant_name text; payload_hash text := md5(payload::text);
begin
  if auth.uid() is null or not exists(select 1 from public.restaurant_members m
    where m.restaurant_id=target_restaurant_id and m.user_id=auth.uid() and m.role='owner') then
    raise exception using errcode='42501',message='Restaurant access is required.';
  end if;
  if request_id is null or base_version is null or base_version<0
    or jsonb_typeof(payload) is distinct from 'object'
    or jsonb_typeof(payload->'catalogFoods') is distinct from 'array'
    or jsonb_typeof(payload->'manualFoods') is distinct from 'array'
    or jsonb_typeof(payload->'customDishes') is distinct from 'array'
    or jsonb_typeof(payload->'importedIds') is distinct from 'array'
    or jsonb_typeof(payload->'recipes') is distinct from 'object'
    or payload->'schemaVersion' is distinct from '2'::jsonb
    or jsonb_typeof(payload->'basisRecipes') is distinct from 'array'
    or jsonb_typeof(payload->'dishBases') is distinct from 'object'
    or jsonb_typeof(payload->'deletedBasisIds') is distinct from 'array' then
    raise exception using errcode='22023',message='Invalid onboarding payload.';
  end if;
  if jsonb_array_length(payload->'catalogFoods')+jsonb_array_length(payload->'manualFoods')>1000
    or jsonb_array_length(payload->'customDishes')+jsonb_array_length(payload->'importedIds')>1000
    or jsonb_array_length(payload->'basisRecipes')>1000 or jsonb_array_length(payload->'deletedBasisIds')>1000 then
    raise exception using errcode='22023',message='Too many entries.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('makroklar:onboarding:'||target_restaurant_id::text,0));
  -- Also serialize with the existing menu importer.
  perform pg_advisory_xact_lock(hashtextextended('makroklar:lightspeed-import:'||target_restaurant_id::text,0));
  select * into current_state from public.restaurant_onboarding s where s.restaurant_id=target_restaurant_id;
  if current_state.request_id=request_id then
    if current_state.payload_hash<>payload_hash then raise exception using errcode='22023',message='Request ID was reused with different data.'; end if;
    return current_state.summary;
  end if;
  if coalesce(current_state.version,0)<>base_version then
    raise exception using errcode='40001',message='Onboarding changed in another session.';
  end if;

  for food in select value from jsonb_array_elements((payload->'catalogFoods')||(payload->'manualFoods')) loop
    key := food->>'id'; kind := coalesce(food#>>'{source,kind}','manual');
    if key is null or key='' or food_ids ? key or coalesce(btrim(food->>'name'),'')=''
      or kind not in ('bls','off','manual') then raise exception using errcode='22023',message='Invalid food identity.'; end if;
    if food->'basis' is not null and food->'basis'<>'null'::jsonb and food->>'basis' not in ('100g','100ml') then
      raise exception using errcode='22023',message='Invalid nutrition basis.';
    end if;
    foreach field in array array['energyKcal','proteinG','fatG','carbohydrateG'] loop
      if food->field is not null and food->field<>'null'::jsonb then
        if jsonb_typeof(food->field)<>'number' or (food->>field)::numeric<0 or (food->>field)::numeric>1000000 then
          raise exception using errcode='22023',message='Invalid nutrient value.';
        end if;
      end if;
    end loop;
    dataset := null; code := null;
    if kind='bls' then
      if food->>'basis' is distinct from '100g' then raise exception using errcode='22023',message='BLS requires a 100g basis.'; end if;
      dataset := (food#>>'{source,datasetId}')::uuid; code := food#>>'{source,code}';
      if key is distinct from 'bls:'||dataset::text||':'||code then raise exception using errcode='22023',message='BLS identity mismatch.'; end if;
      insert into public.restaurant_ingredients(restaurant_id,dataset_id,bls_code,name,client_key,source_data)
        values(target_restaurant_id,dataset,code,btrim(food->>'name'),key,food)
        on conflict on constraint restaurant_ingredients_unique_food do update
          set name=excluded.name,client_key=excluded.client_key,source_data=excluded.source_data
        returning id into food_id;
    else
      if kind='off' and (coalesce(food#>>'{source,barcode}','') !~ '^[0-9]{8,14}$'
        or key is distinct from 'off:'||(food#>>'{source,barcode}')) then raise exception using errcode='22023',message='Barcode identity mismatch.'; end if;
      if kind='manual' then
        perform key::uuid;
        if food->>'noticeVersion' is distinct from '2026-11-10.2'
          or coalesce(food->>'sourceKind','') not in ('label','supplier') or coalesce(btrim(food->>'sourceDescription'),'')=''
          or coalesce(food->>'basis','') not in ('100g','100ml')
          or coalesce(food->>'preparation','') not in ('as_sold','prepared') then
          raise exception using errcode='22023',message='Manual food confirmation is required.';
        end if;
        foreach field in array array['energyKcal','proteinG','fatG','carbohydrateG'] loop
          if jsonb_typeof(food->field) is distinct from 'number' then raise exception using errcode='22023',message='Manual nutrition must be complete.'; end if;
        end loop;
      end if;
      insert into public.restaurant_ingredients(restaurant_id,name,source_kind,client_key,source_data,confirmed_by,confirmed_at)
        values(target_restaurant_id,btrim(food->>'name'),kind,key,food,auth.uid(),now())
        on conflict on constraint restaurant_ingredients_client_identity do update
          set name=excluded.name,source_data=excluded.source_data,confirmed_by=excluded.confirmed_by,confirmed_at=excluded.confirmed_at
          where restaurant_ingredients.source_kind=excluded.source_kind
        returning id into food_id;
      if food_id is null then raise exception using errcode='22023',message='Food source changed.'; end if;
    end if;
    food_ids := food_ids||jsonb_build_object(key,food_id);
  end loop;

  for dish in select value from jsonb_array_elements(payload->'importedIds') loop
    key := 'lightspeed-k-series-'||(dish#>>'{}');
    select d.id into dish_id from public.dishes d where d.restaurant_id=target_restaurant_id
      and d.source='lightspeed-k-series' and d.source_id=dish#>>'{}';
    if dish_id is null or dish_ids ? key then raise exception using errcode='22023',message='Imported dish is missing or duplicated.'; end if;
    dish_ids := dish_ids||jsonb_build_object(key,dish_id);
  end loop;
  for dish in select value from jsonb_array_elements(payload->'customDishes') loop
    key := 'manual-'||(dish->>'id');
    if dish_ids ? key or coalesce(btrim(dish->>'name'),'')='' then raise exception using errcode='22023',message='Invalid manual dish.'; end if;
    insert into public.dishes(restaurant_id,name,client_id,manual_price)
      values(target_restaurant_id,btrim(dish->>'name'),(dish->>'id')::uuid,(dish->>'price')::numeric)
      on conflict on constraint dishes_manual_client_identity do update set name=excluded.name,manual_price=excluded.manual_price
      returning id into dish_id;
    dish_ids := dish_ids||jsonb_build_object(key,dish_id);
  end loop;
  for key,recipe in select * from jsonb_each(payload->'recipes') loop
    if not dish_ids ? key or jsonb_typeof(recipe->'ingredients') is distinct from 'array'
      or jsonb_array_length(recipe->'ingredients')>1000 then raise exception using errcode='22023',message='Invalid recipe.'; end if;
    dish_id := (dish_ids->>key)::uuid; portions := (recipe->>'servings')::numeric;
    if portions is null or portions<1 or portions>1000000 or portions<>trunc(portions) then
      raise exception using errcode='22023',message='Invalid servings.';
    end if;
    update public.dishes set servings=portions where id=dish_id and restaurant_id=target_restaurant_id;
    delete from public.dish_ingredients di where di.dish_id=onboarding_save.dish_id and di.restaurant_id=target_restaurant_id;
    for line in select value from jsonb_array_elements(recipe->'ingredients') loop
      food_id := (food_ids->>(line->>'foodId'))::uuid; amount := (line->>'quantity')::numeric;
      if food_id is null or amount is null or amount<=0 or amount>1000000 or coalesce(line->>'unit','') not in ('g','ml') then
        raise exception using errcode='22023',message='Invalid recipe quantity or ingredient.';
      end if;
      select source_data into food from public.restaurant_ingredients i where i.id=food_id and i.restaurant_id=target_restaurant_id;
      if (food->>'basis'='100g' and line->>'unit'<>'g') or (food->>'basis'='100ml' and line->>'unit'<>'ml') then
        raise exception using errcode='22023',message='Mass and volume must not be silently converted.';
      end if;
      insert into public.dish_ingredients(restaurant_id,dish_id,ingredient_id,quantity_g,quantity_ml)
        values(target_restaurant_id,dish_id,food_id,case when line->>'unit'='g' then amount end,case when line->>'unit'='ml' then amount end);
    end loop;
  end loop;

  -- Existing bases remain available when omitted. Client UUIDs are tenant-scoped.
  select coalesce(jsonb_object_agg(b.client_id::text,b.id),'{}'::jsonb) into basis_ids
    from public.basis_recipes b where b.restaurant_id=target_restaurant_id;
  for basis in select value from jsonb_array_elements(payload->'basisRecipes') loop
    key := (basis->>'id')::uuid::text;
    if key is null or seen_basis_ids ? key or coalesce(btrim(basis->>'name'),'')=''
      or char_length(btrim(basis->>'name'))>500
      or jsonb_typeof(basis->'ingredients') is distinct from 'array'
      or jsonb_array_length(basis->'ingredients')>1000
      or coalesce(basis->>'outputUnit','') not in ('g','ml')
      or not (basis ? 'outputQuantity') then
      raise exception using errcode='22023',message='Invalid basis recipe.';
    end if;
    seen_basis_ids := seen_basis_ids||jsonb_build_object(key,true);
    output_amount := null;
    if basis->'outputQuantity'<>'null'::jsonb then
      if jsonb_typeof(basis->'outputQuantity') is distinct from 'string'
        or basis->>'outputQuantity' !~ '^[0-9]+([.][0-9]+)?$' then
        raise exception using errcode='22023',message='Invalid measured output.';
      end if;
      output_amount := (basis->>'outputQuantity')::numeric;
      if not (output_amount>0 and output_amount<=1000000) then
        raise exception using errcode='22023',message='Invalid measured output.';
      end if;
    end if;
    insert into public.basis_recipes(restaurant_id,client_id,name,output_quantity,output_unit)
      values(target_restaurant_id,key::uuid,btrim(basis->>'name'),output_amount,basis->>'outputUnit')
      on conflict on constraint basis_recipes_client_identity do update
        set name=excluded.name,output_quantity=excluded.output_quantity,output_unit=excluded.output_unit
      returning id into basis_id;
    basis_ids := basis_ids||jsonb_build_object(key,basis_id);
    delete from public.basis_recipe_ingredients l where l.restaurant_id=target_restaurant_id
      and l.basis_recipe_id=onboarding_save.basis_id;
    for line in select value from jsonb_array_elements(basis->'ingredients') loop
      food_id := (food_ids->>(line->>'foodId'))::uuid;
      if food_id is null or coalesce(line->>'quantity','') !~ '^[0-9]+([.][0-9]+)?$'
        or coalesce(line->>'unit','') not in ('g','ml') then
        raise exception using errcode='22023',message='Invalid basis ingredient.';
      end if;
      amount := (line->>'quantity')::numeric;
      if not (amount>0 and amount<=1000000) then
        raise exception using errcode='22023',message='Invalid basis quantity.';
      end if;
      select case when i.source_kind='bls' then '100g' else i.source_data->>'basis' end into source_basis
        from public.restaurant_ingredients i where i.id=food_id and i.restaurant_id=target_restaurant_id;
      if (source_basis='100g' and line->>'unit'<>'g') or (source_basis='100ml' and line->>'unit'<>'ml') then
        raise exception using errcode='22023',message='Mass and volume must not be silently converted.';
      end if;
      insert into public.basis_recipe_ingredients(restaurant_id,basis_recipe_id,ingredient_id,quantity,unit)
        values(target_restaurant_id,basis_id,food_id,amount,line->>'unit');
    end loop;
  end loop;

  -- Omitted dish keys preserve links; only an explicit [] clears a dish's bases.
  for key,recipe in select * from jsonb_each(payload->'dishBases') loop
    if not (dish_ids ? key) or jsonb_typeof(recipe) is distinct from 'array'
      or jsonb_array_length(recipe)>1000 then
      raise exception using errcode='22023',message='Invalid dish basis links.';
    end if;
    dish_id := (dish_ids->>key)::uuid;
    delete from public.dish_basis_recipes l where l.restaurant_id=target_restaurant_id
      and l.dish_id=onboarding_save.dish_id;
    for line in select value from jsonb_array_elements(recipe) loop
      basis_id := (basis_ids->>((line->>'basisId')::uuid::text))::uuid;
      if basis_id is null or coalesce(line->>'quantity','') !~ '^[0-9]+([.][0-9]+)?$'
        or coalesce(line->>'unit','') not in ('g','ml') then
        raise exception using errcode='22023',message='Invalid dish basis quantity or identity.';
      end if;
      amount := (line->>'quantity')::numeric;
      if not (amount>0 and amount<=1000000) then
        raise exception using errcode='22023',message='Invalid dish basis quantity.';
      end if;
      insert into public.dish_basis_recipes(restaurant_id,dish_id,basis_recipe_id,quantity,unit)
        values(target_restaurant_id,dish_id,basis_id,amount,line->>'unit');
    end loop;
  end loop;
  for deleted_id in select value from jsonb_array_elements(payload->'deletedBasisIds') loop
    key := (deleted_id#>>'{}')::uuid::text;
    if key is null or not (basis_ids ? key) or seen_basis_ids ? key then
      raise exception using errcode='22023',message='Invalid or conflicting basis deletion.';
    end if;
    delete from public.basis_recipes b where b.restaurant_id=target_restaurant_id and b.id=(basis_ids->>key)::uuid;
    basis_ids := basis_ids-key;
  end loop;
  -- Validate referenced deletions/unit changes before returning any success summary.
  set constraints public.dish_basis_recipes_own_basis_unit immediate;
  set constraints public.dish_basis_recipes_own_basis_unit deferred;

  -- Remove deselected supplies only when no recipe still refers to them.
  -- Recipe foreign keys remain authoritative; no recipe is silently removed.
  delete from public.restaurant_ingredients i where i.restaurant_id=target_restaurant_id
    and not exists(select 1 from jsonb_each_text(food_ids) f where f.value::uuid=i.id)
    and not exists(select 1 from public.dish_ingredients di where di.ingredient_id=i.id)
    and not exists(select 1 from public.basis_recipe_ingredients bi where bi.ingredient_id=i.id);

  -- Refresh ALL stored dishes, including omitted ones affected by a shared basis.
  select coalesce(jsonb_object_agg(case when d.source is null then 'manual-'||d.client_id::text
    else d.source||'-'||d.source_id end,d.id),'{}'::jsonb) into dish_ids
    from public.dishes d where d.restaurant_id=target_restaurant_id
      and (d.source='lightspeed-k-series' or d.client_id is not null);
  for key,dish in select e.key,e.value from jsonb_each(dish_ids) e order by e.key loop
    dish_id := (dish#>>'{}')::uuid;
    select jsonb_agg(to_jsonb(n)),bool_and(n.status='complete') into metrics,complete from public.get_dish_nutrition(dish_id) n;
    total_dishes := total_dishes+1;
    if complete then completed := completed+1; end if;
    results := results||jsonb_build_array(jsonb_build_object('key',key,'complete',coalesce(complete,false),'metrics',metrics));
  end loop;
  next_version := coalesce(current_state.version,0)+1;
  select r.name into restaurant_name from public.restaurants r where r.id=target_restaurant_id;
  result := jsonb_build_object('version',next_version,'restaurantName',restaurant_name,'dishCount',total_dishes,
    'foodCount',(select count(*) from public.restaurant_ingredients i where i.restaurant_id=target_restaurant_id),
    'completeCount',completed,'draftCount',total_dishes-completed,'dishes',results);
  insert into public.restaurant_onboarding(restaurant_id,version,request_id,payload_hash,summary)
    values(target_restaurant_id,next_version,request_id,payload_hash,result)
    on conflict(restaurant_id) do update set version=excluded.version,request_id=excluded.request_id,
      payload_hash=excluded.payload_hash,summary=excluded.summary,updated_at=now();
  return result;
end;
$$;
revoke all on function public.save_restaurant_onboarding_v2(uuid,jsonb,integer,uuid) from public,anon,service_role;
grant execute on function public.save_restaurant_onboarding_v2(uuid,jsonb,integer,uuid) to authenticated;

-- Keep the existing reader contract intact for old clients. v2 explicitly adds
-- reusable recipes and a complete dishBases map (including empty arrays).
create function public.read_restaurant_onboarding_v2(target_restaurant_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select public.read_restaurant_onboarding(target_restaurant_id)||jsonb_build_object(
    'schemaVersion',2,
    'basisRecipes',coalesce((select jsonb_agg(jsonb_build_object(
      'id',b.client_id,'name',b.name,'outputQuantity',b.output_quantity::text,'outputUnit',b.output_unit,
      'ingredients',coalesce((select jsonb_agg(jsonb_build_object(
        'foodId',coalesce(i.client_key,'bls:'||i.dataset_id::text||':'||i.bls_code),'quantity',l.quantity::text,'unit',l.unit)
        order by i.name,i.id) from public.basis_recipe_ingredients l
        join public.restaurant_ingredients i on i.restaurant_id=l.restaurant_id and i.id=l.ingredient_id
        where l.restaurant_id=b.restaurant_id and l.basis_recipe_id=b.id),'[]'::jsonb)) order by b.created_at,b.id)
      from public.basis_recipes b where b.restaurant_id=target_restaurant_id),'[]'::jsonb),
    'dishBases',coalesce((select jsonb_object_agg(
      case when d.source is null then 'manual-'||d.client_id::text else d.source||'-'||d.source_id end,
      coalesce((select jsonb_agg(jsonb_build_object('basisId',b.client_id,'quantity',l.quantity::text,'unit',l.unit)
        order by b.name,b.id) from public.dish_basis_recipes l
        join public.basis_recipes b on b.restaurant_id=l.restaurant_id and b.id=l.basis_recipe_id
        where l.restaurant_id=d.restaurant_id and l.dish_id=d.id),'[]'::jsonb))
      from public.dishes d where d.restaurant_id=target_restaurant_id
        and (d.source='lightspeed-k-series' or d.client_id is not null)),'{}'::jsonb)
  );
$$;
revoke all on function public.read_restaurant_onboarding_v2(uuid) from public,anon,authenticated,service_role;
grant execute on function public.read_restaurant_onboarding_v2(uuid) to authenticated;

commit;
