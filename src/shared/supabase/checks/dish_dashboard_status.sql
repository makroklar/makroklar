-- Run as postgres on a disposable database after 20261125000100.
-- Synthetic fixtures only. Checks owner access, publish rules and resets of the dashboard status RPCs.
begin;
insert into auth.users(id,email) values
  ('d5d50000-0000-4000-8000-000000000001','status-owner@example.invalid'),
  ('d5d50000-0000-4000-8000-000000000002','status-other@example.invalid');
insert into public.restaurants(id,name) values
  ('d5d50000-0000-4000-8000-000000000010','Status A'),
  ('d5d50000-0000-4000-8000-000000000011','Status B');
insert into public.restaurant_members(restaurant_id,user_id) values
  ('d5d50000-0000-4000-8000-000000000010','d5d50000-0000-4000-8000-000000000001'),
  ('d5d50000-0000-4000-8000-000000000011','d5d50000-0000-4000-8000-000000000002');
insert into public.restaurant_ingredients(id,restaurant_id,name,source_kind,client_key,source_data) values
  ('d5d50000-0000-4000-8000-000000000100','d5d50000-0000-4000-8000-000000000010','Manual complete','manual','status-complete',
    '{"basis":"100g","preparation":"prepared","energyKcal":100,"proteinG":5,"fatG":2,"carbohydrateG":10}');
insert into public.dishes(id,restaurant_id,name) values
  ('d5d50000-0000-4000-8000-000000000200','d5d50000-0000-4000-8000-000000000010','Empty dish'),
  ('d5d50000-0000-4000-8000-000000000201','d5d50000-0000-4000-8000-000000000010','Complete dish');
insert into public.dish_ingredients(restaurant_id,dish_id,ingredient_id,quantity_g) values
  ('d5d50000-0000-4000-8000-000000000010','d5d50000-0000-4000-8000-000000000201','d5d50000-0000-4000-8000-000000000100',150);

select set_config('request.jwt.claim.sub','d5d50000-0000-4000-8000-000000000001',true);
set local role authenticated;

do $$
declare
  complete_dish constant uuid := 'd5d50000-0000-4000-8000-000000000201';
  empty_dish constant uuid := 'd5d50000-0000-4000-8000-000000000200';
  row public.dishes%rowtype;
begin
  -- Direct writes to the new columns stay closed.
  begin
    update public.dishes set published_at = now() where id = complete_dish;
    raise exception 'direct status update must be denied';
  exception when insufficient_privilege then null;
  end;

  -- Publishing requires confirmed allergens.
  begin
    perform public.set_dish_published(complete_dish, true);
    raise exception 'publish without allergens must fail';
  exception when invalid_parameter_value then null;
  end;

  -- Unknown allergen codes are rejected by the check constraint.
  begin
    perform public.save_dish_allergens(complete_dish, array['unknown'], '{}', true);
    raise exception 'unknown allergen must fail';
  exception when check_violation then null;
  end;

  perform public.save_dish_allergens(complete_dish, array['milk','gluten','milk'], array['preservatives'], true);
  select * into row from public.dishes where id = complete_dish;
  assert row.allergens = array['gluten','milk'], 'allergens are deduplicated and sorted';
  assert row.additives = array['preservatives'], 'additives saved';
  assert row.allergens_confirmed_at is not null and row.allergens_confirmed_by = auth.uid(), 'allergens confirmed';

  perform public.set_dish_published(complete_dish, true);
  select * into row from public.dishes where id = complete_dish;
  assert row.published_at is not null, 'complete dish with confirmed allergens can be published';

  -- Incomplete nutrition blocks publishing even with confirmed allergens.
  perform public.save_dish_allergens(empty_dish, '{}', '{}', true);
  begin
    perform public.set_dish_published(empty_dish, true);
    raise exception 'publish without nutrition must fail';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.set_dish_recipe_confirmed(empty_dish, true);
    raise exception 'confirming an empty recipe must fail';
  exception when invalid_parameter_value then null;
  end;

  -- Saving allergens without confirmation withdraws confirmation and publication.
  perform public.save_dish_allergens(complete_dish, array['milk'], '{}', false);
  select * into row from public.dishes where id = complete_dish;
  assert row.allergens = array['milk'] and row.allergens_confirmed_at is null and row.published_at is null,
    'unconfirmed save withdraws publication';

  -- Recipe change: reset keeps the allergen selection but clears all confirmations.
  perform public.set_dish_recipe_confirmed(complete_dish, true);
  perform public.save_dish_allergens(complete_dish, array['milk'], '{}', true);
  perform public.set_dish_published(complete_dish, true);
  perform public.reset_dish_confirmations(complete_dish);
  select * into row from public.dishes where id = complete_dish;
  assert row.recipe_confirmed_at is null and row.allergens_confirmed_at is null and row.published_at is null,
    'reset clears confirmations';
  assert row.allergens = array['milk'], 'reset keeps the allergen selection';

  perform public.save_dish_details(complete_dish, 'Salate', 15, 320);
  select * into row from public.dishes where id = complete_dish;
  assert row.category = 'Salate' and row.prep_minutes = 15 and row.cooked_weight_g = 320, 'details saved';
  begin
    perform public.save_dish_details(complete_dish, 'Pizza', null, null);
    raise exception 'unknown category must fail';
  exception when check_violation then null;
  end;
end;
$$;

-- Another owner cannot touch the dish.
reset role;
select set_config('request.jwt.claim.sub','d5d50000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$
begin
  begin
    perform public.reset_dish_confirmations('d5d50000-0000-4000-8000-000000000201');
    raise exception 'foreign owner must be denied';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- Anonymous callers have no execute right.
reset role;
set local role anon;
do $$
begin
  begin
    perform public.set_dish_published('d5d50000-0000-4000-8000-000000000201', true);
    raise exception 'anon must be denied';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
rollback;
