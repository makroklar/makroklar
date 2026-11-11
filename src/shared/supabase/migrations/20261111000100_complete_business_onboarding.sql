-- Prepared locally. Apply only after reviewing the migration and rollback-only checks.
begin;

alter table public.restaurant_ingredients
  alter column dataset_id drop not null,
  alter column bls_code drop not null,
  add column source_kind text not null default 'bls',
  add column client_key text,
  add column source_data jsonb,
  add column confirmed_by uuid references auth.users(id),
  add column confirmed_at timestamptz,
  add constraint restaurant_ingredients_client_identity unique (restaurant_id, client_key),
  add constraint restaurant_ingredients_source_shape check (
    (source_kind = 'bls' and dataset_id is not null and bls_code is not null)
    or (source_kind in ('off', 'manual') and dataset_id is null and bls_code is null
      and client_key is not null and source_data is not null and jsonb_typeof(source_data) = 'object')
  );

alter table public.dishes
  add column client_id uuid,
  add column manual_price numeric,
  add constraint dishes_manual_client_identity unique (restaurant_id, client_id),
  add constraint dishes_manual_client_shape check (client_id is null or source is null),
  add constraint dishes_manual_price_valid check (
    manual_price is null or (source is null and manual_price >= 0
      and manual_price <= 999999 and manual_price = round(manual_price, 2))
  );

update public.dishes set client_id = id where source is null;

alter table public.dish_ingredients
  alter column quantity_g drop not null,
  add column quantity_ml numeric,
  add constraint dish_ingredients_one_quantity check (
    (quantity_g is not null and quantity_ml is null)
    or (quantity_g is null and quantity_ml is not null and quantity_ml > 0 and quantity_ml < 'Infinity'::numeric)
  );

create table public.restaurant_onboarding (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  version integer not null check (version > 0),
  request_id uuid not null,
  payload_hash text not null,
  summary jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.restaurant_onboarding enable row level security;
revoke all on public.restaurant_onboarding from public, anon, authenticated, service_role;
grant select on public.restaurant_onboarding to authenticated;
grant all on public.restaurant_onboarding to service_role;
create policy restaurant_onboarding_read_own on public.restaurant_onboarding
  for select to authenticated using (exists (
    select 1 from public.restaurant_members m where m.restaurant_id = restaurant_onboarding.restaurant_id
      and m.user_id = (select auth.uid()) and m.role = 'owner'
  ));

-- Used to restore existing BLS ingredients, including ones created before onboarding.
create function makroklar_private.bls_food_snapshot(dataset uuid, code text, food_name text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'id', 'bls:' || $1::text || ':' || $2, 'name', $3,
    'source', jsonb_build_object('kind','bls','datasetId',$1,'code',$2,'version',d.source_version),
    'detail', 'BLS ' || d.source_version || ' · ' || $2, 'basis','100g','preparation',null,
    'energyKcal', max(v.value) filter (where v.nutrient_code = 'ENERCC' and n.unit = 'kcal' and v.value_kind = 'numeric'),
    'proteinG', max(v.value) filter (where v.nutrient_code = 'PROT625' and n.unit = 'g' and v.value_kind = 'numeric'),
    'fatG', max(v.value) filter (where v.nutrient_code = 'FAT' and n.unit = 'g' and v.value_kind = 'numeric'),
    'carbohydrateG', max(v.value) filter (where v.nutrient_code = 'CHO' and n.unit = 'g' and v.value_kind = 'numeric')
  ) from public.nutrition_datasets d
  left join public.bls_food_nutrients v on v.dataset_id = d.id and v.bls_code = $2
    and v.nutrient_code in ('ENERCC','PROT625','FAT','CHO')
  left join public.nutrients n on n.dataset_id = v.dataset_id and n.code = v.nutrient_code
  where d.id = $1 group by d.source_version;
$$;
revoke all on function makroklar_private.bls_food_snapshot(uuid,text,text) from public, anon;
grant execute on function makroklar_private.bls_food_snapshot(uuid,text,text) to authenticated;

create function public.read_restaurant_onboarding(target_restaurant_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'version', coalesce(s.version,0), 'restaurantName', r.name, 'summary', s.summary,
    'catalogFoods', coalesce((select jsonb_agg(case when i.source_kind = 'bls'
      then makroklar_private.bls_food_snapshot(i.dataset_id,i.bls_code,i.name) else i.source_data end order by i.created_at,i.id)
      from public.restaurant_ingredients i where i.restaurant_id=r.id and i.source_kind <> 'manual'),'[]'::jsonb),
    'manualFoods', coalesce((select jsonb_agg(i.source_data order by i.created_at,i.id)
      from public.restaurant_ingredients i where i.restaurant_id=r.id and i.source_kind='manual'),'[]'::jsonb),
    'customDishes', coalesce((select jsonb_agg(jsonb_build_object('id',d.client_id,'name',d.name,'price',d.manual_price) order by d.created_at,d.id)
      from public.dishes d where d.restaurant_id=r.id and d.source is null and d.client_id is not null),'[]'::jsonb),
    'recipes', coalesce((select jsonb_object_agg(
      case when d.source is null then 'manual-' || d.client_id::text else d.source || '-' || d.source_id end,
      jsonb_build_object('servings',trunc(d.servings)::text,'ingredients',coalesce((
        select jsonb_agg(jsonb_build_object('foodId',coalesce(i.client_key,'bls:'||i.dataset_id::text||':'||i.bls_code),
          'quantity',coalesce(di.quantity_g,di.quantity_ml)::text,'unit',case when di.quantity_g is not null then 'g' else 'ml' end)
          order by i.name,i.id)
        from public.dish_ingredients di join public.restaurant_ingredients i on i.id=di.ingredient_id and i.restaurant_id=di.restaurant_id
        where di.dish_id=d.id and di.restaurant_id=r.id),'[]'::jsonb)))
      from public.dishes d where d.restaurant_id=r.id and (d.source='lightspeed-k-series' or d.client_id is not null)),'{}'::jsonb)
  ) from public.restaurants r left join public.restaurant_onboarding s on s.restaurant_id=r.id
  where r.id=target_restaurant_id and exists (select 1 from public.restaurant_members m
    where m.restaurant_id=r.id and m.user_id=(select auth.uid()) and m.role='owner');
$$;
revoke all on function public.read_restaurant_onboarding(uuid) from public, anon;
grant execute on function public.read_restaurant_onboarding(uuid) to authenticated;

create function public.read_saved_off_product(barcode text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select i.source_data from public.restaurant_ingredients i
  where i.source_kind='off' and i.client_key='off:'||barcode
  order by i.source_data#>>'{source,fetchedAt}' desc, i.id limit 1;
$$;
revoke all on function public.read_saved_off_product(text) from public,anon;
grant execute on function public.read_saved_off_product(text) to authenticated;

-- Same public contract; BLS still comes from its immutable dataset, not a client snapshot.
create or replace function public.get_dish_nutrition(target_dish_id uuid)
returns table(nutrient_code text,unit text,recipe_total numeric,per_serving numeric,status text,
  ingredient_count bigint,known_ingredient_count bigint,issues jsonb)
language sql stable security invoker set search_path = '' as $$
  with macros(code,expected_unit,field,position) as (values
    ('ENERCC','kcal','energyKcal',1),('PROT625','g','proteinG',2),('FAT','g','fatG',3),('CHO','g','carbohydrateG',4)
  ), inputs as (
    select m.*,d.servings,di.ingredient_id,i.name,coalesce(di.quantity_g,di.quantity_ml) as quantity,
      case when i.source_kind='bls' then v.value
        when jsonb_typeof(i.source_data->m.field)='number' then (i.source_data->>m.field)::numeric end as value,
      case
        when di.ingredient_id is null then null
        when i.id is null then 'missing_ingredient'
        when i.source_kind='bls' and di.quantity_g is null then 'unit_mismatch'
        when i.source_kind='bls' and n.code is null then 'missing_definition'
        when i.source_kind='bls' and n.unit<>m.expected_unit then 'unit_mismatch'
        when i.source_kind='bls' and v.nutrient_code is null then 'missing_value'
        when i.source_kind='bls' and v.value_kind<>'numeric' then v.value_kind
        when i.source_kind='bls' and v.value is null then 'missing_value'
        when i.source_kind<>'bls' and coalesce(i.source_data->>'basis','') not in ('100g','100ml') then 'missing_basis'
        when i.source_kind<>'bls' and coalesce(i.source_data->>'preparation','') not in ('as_sold','prepared') then 'missing_preparation'
        when i.source_kind<>'bls' and ((i.source_data->>'basis'='100g' and di.quantity_g is null)
          or (i.source_data->>'basis'='100ml' and di.quantity_ml is null)) then 'unit_mismatch'
        when i.source_kind<>'bls' and coalesce(jsonb_typeof(i.source_data->m.field),'null')<>'number' then 'missing_value'
        else null end as reason,
      i.dataset_id,i.bls_code,v.value_kind,v.raw_value,n.unit as source_unit
    from public.dishes d cross join macros m
    left join public.dish_ingredients di on di.dish_id=d.id and di.restaurant_id=d.restaurant_id
    left join public.restaurant_ingredients i on i.id=di.ingredient_id and i.restaurant_id=di.restaurant_id
    left join public.nutrients n on n.dataset_id=i.dataset_id and n.code=m.code
    left join public.bls_food_nutrients v on v.dataset_id=i.dataset_id and v.bls_code=i.bls_code and v.nutrient_code=m.code
    where d.id=target_dish_id
  ), totals as (
    select x.code,x.expected_unit,x.position,x.servings,count(x.ingredient_id) as cnt,
      count(x.ingredient_id) filter(where x.reason is null) as known,
      sum(x.value*x.quantity/100) filter(where x.reason is null) as total,
      coalesce(jsonb_agg(jsonb_build_object('ingredient_id',x.ingredient_id,'ingredient_name',x.name,
        'dataset_id',x.dataset_id,'bls_code',x.bls_code,'reason',x.reason,'value_kind',x.value_kind,
        'raw_value',x.raw_value,'source_unit',x.source_unit,'expected_unit',x.expected_unit)
        order by x.ingredient_id) filter(where x.reason is not null),'[]'::jsonb) as problems
    from inputs x group by x.code,x.expected_unit,x.position,x.servings
  ) select t.code,t.expected_unit,
    case when t.cnt>0 and t.known=t.cnt then t.total end,
    case when t.cnt>0 and t.known=t.cnt then t.total/t.servings end,
    case when t.cnt=0 then 'empty_recipe' when t.known<t.cnt then 'incomplete' else 'complete' end,
    t.cnt,t.known,t.problems from totals t order by t.position;
$$;

-- Definer is necessary for the restricted new columns/audit record. Every target
-- is resolved under an explicit owner check and composite restaurant foreign keys.
create function public.save_restaurant_onboarding(target_restaurant_id uuid,payload jsonb,base_version integer,request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
<<onboarding_save>>
declare
  current_state public.restaurant_onboarding%rowtype;
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
    or jsonb_typeof(payload->'recipes') is distinct from 'object' then
    raise exception using errcode='22023',message='Invalid onboarding payload.';
  end if;
  if jsonb_array_length(payload->'catalogFoods')+jsonb_array_length(payload->'manualFoods')>1000
    or jsonb_array_length(payload->'customDishes')+jsonb_array_length(payload->'importedIds')>1000 then
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

  -- Remove deselected supplies only when no recipe still refers to them.
  -- Recipe foreign keys remain authoritative; no recipe is silently removed.
  delete from public.restaurant_ingredients i where i.restaurant_id=target_restaurant_id
    and not exists(select 1 from jsonb_each_text(food_ids) f where f.value::uuid=i.id)
    and not exists(select 1 from public.dish_ingredients di where di.ingredient_id=i.id);

  for key,dish in select * from jsonb_each(dish_ids) loop
    dish_id := (dish#>>'{}')::uuid;
    select jsonb_agg(to_jsonb(n)),bool_and(n.status='complete') into metrics,complete from public.get_dish_nutrition(dish_id) n;
    total_dishes := total_dishes+1;
    if complete then completed := completed+1; end if;
    results := results||jsonb_build_array(jsonb_build_object('key',key,'complete',coalesce(complete,false),'metrics',metrics));
  end loop;
  next_version := coalesce(current_state.version,0)+1;
  select r.name into restaurant_name from public.restaurants r where r.id=target_restaurant_id;
  result := jsonb_build_object('version',next_version,'restaurantName',restaurant_name,'dishCount',total_dishes,
    'foodCount',jsonb_array_length(payload->'catalogFoods')+jsonb_array_length(payload->'manualFoods'),
    'completeCount',completed,'draftCount',total_dishes-completed,'dishes',results);
  insert into public.restaurant_onboarding(restaurant_id,version,request_id,payload_hash,summary)
    values(target_restaurant_id,next_version,request_id,payload_hash,result)
    on conflict(restaurant_id) do update set version=excluded.version,request_id=excluded.request_id,
      payload_hash=excluded.payload_hash,summary=excluded.summary,updated_at=now();
  return result;
end;
$$;
revoke all on function public.save_restaurant_onboarding(uuid,jsonb,integer,uuid) from public,anon,service_role;
grant execute on function public.save_restaurant_onboarding(uuid,jsonb,integer,uuid) to authenticated;

commit;
