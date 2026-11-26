-- Prepared locally, not applied. Requires 20261124000200.
-- Read-time calculations only; do not enable basis writes before versioned saving,
-- old-client guards and atomic Dashboard summary refresh have been implemented.
begin;

-- One authoritative food contribution path for both dishes and reusable bases.
-- SECURITY INVOKER throughout: invisible ingredients are never silently omitted.
create function makroklar_private.recipe_food_nutrition(
  target_restaurant_id uuid, target_ingredient_id uuid, amount numeric, amount_unit text
) returns table(nutrient_code text, unit text, contribution numeric, issue jsonb)
language sql stable security invoker set search_path = '' as $$
  with macros(code,expected_unit,field,position) as (values
    ('ENERCC','kcal','energyKcal',1),('PROT625','g','proteinG',2),
    ('FAT','g','fatG',3),('CHO','g','carbohydrateG',4)
  ), inputs as (
    select m.*,i.id,i.name,i.dataset_id,i.bls_code,v.value_kind,v.raw_value,n.unit as source_unit,
      case when i.source_kind='bls' then v.value
        when jsonb_typeof(i.source_data->m.field)='number' then (i.source_data->>m.field)::numeric end as value,
      case
        when amount is null or not (amount>0 and amount<'Infinity'::numeric) then 'invalid_quantity'
        when amount_unit is null or amount_unit not in ('g','ml') then 'unit_mismatch'
        when i.source_kind='bls' and amount_unit<>'g' then 'unit_mismatch'
        when i.source_kind='bls' and n.code is null then 'missing_definition'
        when i.source_kind='bls' and n.unit<>m.expected_unit then 'unit_mismatch'
        when i.source_kind='bls' and v.nutrient_code is null then 'missing_value'
        when i.source_kind='bls' and v.value_kind<>'numeric' then v.value_kind
        when i.source_kind='bls' and v.value is null then 'missing_value'
        when i.source_kind<>'bls' and coalesce(i.source_data->>'basis','') not in ('100g','100ml') then 'missing_basis'
        when i.source_kind<>'bls' and coalesce(i.source_data->>'preparation','') not in ('as_sold','prepared') then 'missing_preparation'
        when i.source_kind<>'bls' and ((i.source_data->>'basis'='100g' and amount_unit<>'g')
          or (i.source_data->>'basis'='100ml' and amount_unit<>'ml')) then 'unit_mismatch'
        when i.source_kind<>'bls' and coalesce(jsonb_typeof(i.source_data->m.field),'null')<>'number' then 'missing_value'
        else null end as source_reason
    from public.restaurant_ingredients i cross join macros m
    left join public.nutrients n on n.dataset_id=i.dataset_id and n.code=m.code
    left join public.bls_food_nutrients v on v.dataset_id=i.dataset_id and v.bls_code=i.bls_code and v.nutrient_code=m.code
    where i.restaurant_id=target_restaurant_id and i.id=target_ingredient_id
  ), checked as (
    select x.*,coalesce(x.source_reason,case when x.value is null then 'missing_value'
      when not (x.value>=0 and x.value<'Infinity'::numeric) then 'invalid_value' end) as reason
    from inputs x
  )
  select x.code,x.expected_unit,
    case when x.reason is null then x.value*amount/100 end,
    case when x.reason is not null then jsonb_build_object(
      'ingredient_id',x.id,'ingredient_name',x.name,'dataset_id',x.dataset_id,'bls_code',x.bls_code,
      'reason',x.reason,'value_kind',x.value_kind,'raw_value',x.raw_value,
      'source_unit',x.source_unit,'expected_unit',x.expected_unit) end
  from checked x order by x.position;
$$;
revoke all on function makroklar_private.recipe_food_nutrition(uuid,uuid,numeric,text)
  from public,anon,authenticated,service_role;
grant execute on function makroklar_private.recipe_food_nutrition(uuid,uuid,numeric,text)
  to authenticated,service_role;

create function public.get_basis_recipe_nutrition(target_basis_recipe_id uuid)
returns table(nutrient_code text,unit text,recipe_total numeric,per_100 numeric,
  output_quantity numeric,output_unit text,status text,
  ingredient_count bigint,known_ingredient_count bigint,issues jsonb)
language sql stable security invoker set search_path = '' as $$
  with macros(code,expected_unit,position) as (values
    ('ENERCC','kcal',1),('PROT625','g',2),('FAT','g',3),('CHO','g',4)
  ), inputs as (
    select m.*,b.output_quantity,b.output_unit,l.ingredient_id,n.contribution,
      case when l.ingredient_id is null then null
        when n.nutrient_code is null then jsonb_build_object('ingredient_id',l.ingredient_id,'reason','missing_ingredient')
        else n.issue end as issue
    from public.basis_recipes b cross join macros m
    left join public.basis_recipe_ingredients l on l.restaurant_id=b.restaurant_id and l.basis_recipe_id=b.id
    left join lateral makroklar_private.recipe_food_nutrition(b.restaurant_id,l.ingredient_id,l.quantity,l.unit) n
      on n.nutrient_code=m.code
    where b.id=target_basis_recipe_id
  ), totals as (
    select x.code,x.expected_unit,x.position,x.output_quantity,x.output_unit,
      count(x.ingredient_id) as cnt,
      count(x.ingredient_id) filter(where x.issue is null and x.contribution is not null) as known,
      sum(x.contribution) filter(where x.issue is null) as total,
      coalesce(jsonb_agg(x.issue order by x.ingredient_id) filter(where x.issue is not null),'[]'::jsonb) as problems
    from inputs x group by x.code,x.expected_unit,x.position,x.output_quantity,x.output_unit
  )
  select t.code,t.expected_unit,
    case when t.cnt>0 and t.known=t.cnt and t.output_quantity is not null then t.total end,
    case when t.cnt>0 and t.known=t.cnt then t.total*100/nullif(t.output_quantity,0) end,
    t.output_quantity,t.output_unit,
    case when t.cnt=0 then 'empty_recipe'
      when t.known<t.cnt or t.output_quantity is null then 'incomplete' else 'complete' end,
    t.cnt,t.known,t.problems || case when t.cnt>0 and t.output_quantity is null
      then jsonb_build_array(jsonb_build_object('reason','missing_output_quantity')) else '[]'::jsonb end
  from totals t order by t.position;
$$;
revoke all on function public.get_basis_recipe_nutrition(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_basis_recipe_nutrition(uuid) to authenticated,service_role;

-- Preserve the public dish RPC contract and statuses. A base counts as ONE input
-- line; its own ingredient issues are nested, with no double counting/flattening.
create or replace function public.get_dish_nutrition(target_dish_id uuid)
returns table(nutrient_code text,unit text,recipe_total numeric,per_serving numeric,status text,
  ingredient_count bigint,known_ingredient_count bigint,issues jsonb)
language sql stable security invoker set search_path = '' as $$
  with macros(code,expected_unit,position) as (values
    ('ENERCC','kcal',1),('PROT625','g',2),('FAT','g',3),('CHO','g',4)
  ), dish as (
    select d.* from public.dishes d where d.id=target_dish_id
  ), contributions as (
    select m.code,'food'::text as kind,l.ingredient_id as input_id,n.contribution,
      case when n.nutrient_code is null then jsonb_build_object('ingredient_id',l.ingredient_id,'reason','missing_ingredient')
        else n.issue end as issue
    from dish d join public.dish_ingredients l on l.dish_id=d.id and l.restaurant_id=d.restaurant_id
    cross join macros m
    left join lateral makroklar_private.recipe_food_nutrition(d.restaurant_id,l.ingredient_id,
      coalesce(l.quantity_g,l.quantity_ml),case when l.quantity_g is not null then 'g' else 'ml' end) n on n.nutrient_code=m.code
    union all
    select m.code,'basis',l.basis_recipe_id,
      -- Scale the batch directly, avoiding an extra rounding step via per_100.
      case when n.status='complete' and l.unit=n.output_unit
        then n.recipe_total*l.quantity/nullif(n.output_quantity,0) end,
      case when n.nutrient_code is null then jsonb_build_object('basis_recipe_id',l.basis_recipe_id,'reason','missing_basis_recipe')
        when l.unit<>n.output_unit then jsonb_build_object('basis_recipe_id',l.basis_recipe_id,'reason','unit_mismatch')
        when n.status<>'complete' then jsonb_build_object('basis_recipe_id',l.basis_recipe_id,
          'reason','incomplete_basis_recipe','basis_status',n.status,'issues',n.issues) end
    from dish d join public.dish_basis_recipes l on l.dish_id=d.id and l.restaurant_id=d.restaurant_id
    cross join macros m
    left join public.basis_recipes b on b.id=l.basis_recipe_id and b.restaurant_id=d.restaurant_id
    left join lateral public.get_basis_recipe_nutrition(b.id) n on n.nutrient_code=m.code
  ), totals as (
    select m.code,m.expected_unit,m.position,d.servings,count(c.input_id) as cnt,
      count(c.input_id) filter(where c.issue is null and c.contribution is not null) as known,
      sum(c.contribution) filter(where c.issue is null) as total,
      coalesce(jsonb_agg(c.issue order by c.kind,c.input_id) filter(where c.issue is not null),'[]'::jsonb) as problems
    from dish d cross join macros m left join contributions c on c.code=m.code
    group by m.code,m.expected_unit,m.position,d.servings
  )
  select t.code,t.expected_unit,
    case when t.cnt>0 and t.known=t.cnt then t.total end,
    case when t.cnt>0 and t.known=t.cnt then t.total/t.servings end,
    case when t.cnt=0 then 'empty_recipe' when t.known<t.cnt then 'incomplete' else 'complete' end,
    t.cnt,t.known,t.problems from totals t order by t.position;
$$;
revoke all on function public.get_dish_nutrition(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_dish_nutrition(uuid) to authenticated,service_role;

commit;
