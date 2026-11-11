-- Read-time recipe totals, following the caller's existing table grants and RLS.
begin;

create function public.get_dish_nutrition(target_dish_id uuid)
returns table (
  nutrient_code text,
  unit text,
  recipe_total numeric,
  per_serving numeric,
  status text,
  ingredient_count bigint,
  known_ingredient_count bigint,
  issues jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  with macros(code, expected_unit, position) as (
    values ('ENERCC', 'kcal', 1), ('PROT625', 'g', 2), ('FAT', 'g', 3), ('CHO', 'g', 4)
  ), inputs as (
    select macro.code, macro.expected_unit, macro.position, dish.servings,
      recipe.ingredient_id, recipe.quantity_g, ingredient.name as ingredient_name,
      ingredient.dataset_id, ingredient.bls_code, definition.unit as source_unit,
      nutrient.value, nutrient.value_kind, nutrient.raw_value,
      case
        when recipe.ingredient_id is null then null
        when ingredient.id is null then 'missing_ingredient'
        when definition.code is null then 'missing_definition'
        when definition.unit <> macro.expected_unit then 'unit_mismatch'
        when nutrient.nutrient_code is null then 'missing_value'
        when nutrient.value_kind <> 'numeric' then nutrient.value_kind
        when nutrient.value is null then 'missing_value'
        else null
      end as issue_reason
    from public.dishes as dish
    cross join macros as macro
    left join public.dish_ingredients as recipe
      on recipe.dish_id = dish.id and recipe.restaurant_id = dish.restaurant_id
    -- Keep unresolved/invisible ingredients in the denominator, never drop them.
    left join public.restaurant_ingredients as ingredient
      on ingredient.id = recipe.ingredient_id and ingredient.restaurant_id = recipe.restaurant_id
    left join public.nutrients as definition
      on definition.dataset_id = ingredient.dataset_id and definition.code = macro.code
    left join public.bls_food_nutrients as nutrient
      on nutrient.dataset_id = ingredient.dataset_id and nutrient.bls_code = ingredient.bls_code
        and nutrient.nutrient_code = macro.code
    where dish.id = target_dish_id
  ), totals as (
    select input.code, input.expected_unit, input.position, input.servings,
      count(input.ingredient_id) as ingredient_count,
      count(input.ingredient_id) filter (where input.issue_reason is null) as known_count,
      -- The BLS catalog schema fixes the basis at 100 g. No early ROUND or float cast.
      sum(input.value * input.quantity_g / 100) filter (where input.issue_reason is null) as known_total,
      coalesce(jsonb_agg(jsonb_build_object(
        'ingredient_id', input.ingredient_id,
        'ingredient_name', input.ingredient_name,
        'dataset_id', input.dataset_id,
        'bls_code', input.bls_code,
        'reason', input.issue_reason,
        'value_kind', input.value_kind,
        'raw_value', input.raw_value,
        'source_unit', input.source_unit,
        'expected_unit', input.expected_unit
      ) order by input.ingredient_id) filter (where input.issue_reason is not null), '[]'::jsonb) as issues
    from inputs as input
    group by input.code, input.expected_unit, input.position, input.servings
  )
  select total.code, total.expected_unit,
    case when total.ingredient_count > 0 and total.known_count = total.ingredient_count
      then total.known_total end as recipe_total,
    case when total.ingredient_count > 0 and total.known_count = total.ingredient_count
      then total.known_total / total.servings end as per_serving,
    case
      when total.ingredient_count = 0 then 'empty_recipe'
      when total.known_count < total.ingredient_count then 'incomplete'
      else 'complete'
    end as status,
    total.ingredient_count, total.known_count, total.issues
  from totals as total
  order by total.position;
$$;

revoke all on function public.get_dish_nutrition(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_dish_nutrition(uuid) to authenticated, service_role;

commit;
