-- Foundation only. Not applied; review before deployment.
-- No write RPC or nutrition calculation is added by this migration. Keep application
-- writes closed until basis-aware saving, summaries and old-client guards are ready.
begin;

create table public.basis_recipes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  client_id uuid not null default gen_random_uuid(),
  name text not null,
  -- Measured finished batch, not the sum of ingredient quantities or a portion count.
  -- NULL allows a draft; readiness also depends on its ingredients/nutrient values.
  output_quantity numeric,
  output_unit text not null default 'g',
  created_at timestamptz not null default now(),
  constraint basis_recipes_name_valid check (
    name = btrim(name) and char_length(name) between 1 and 500
  ),
  constraint basis_recipes_output_quantity_valid check (
    output_quantity is null or (output_quantity > 0 and output_quantity <= 1000000)
  ),
  constraint basis_recipes_output_unit_valid check (output_unit in ('g', 'ml')),
  constraint basis_recipes_restaurant_identity unique (restaurant_id, id),
  constraint basis_recipes_client_identity unique (restaurant_id, client_id),
  -- Referenced by dish lines so g/ml mismatches, including later unit changes,
  -- are impossible even for privileged writes. Quantity changes do not alter units.
  constraint basis_recipes_unit_identity unique (restaurant_id, id, output_unit)
);

create table public.basis_recipe_ingredients (
  restaurant_id uuid not null,
  basis_recipe_id uuid not null,
  ingredient_id uuid not null,
  quantity numeric not null,
  unit text not null,
  primary key (basis_recipe_id, ingredient_id),
  constraint basis_recipe_ingredients_quantity_valid check (quantity > 0 and quantity <= 1000000),
  constraint basis_recipe_ingredients_unit_valid check (unit in ('g', 'ml')),
  constraint basis_recipe_ingredients_own_recipe foreign key (restaurant_id, basis_recipe_id)
    references public.basis_recipes(restaurant_id, id) on delete cascade,
  -- Only Lebensmittel, never another Basisrezept: no recursive recipes/cycles.
  constraint basis_recipe_ingredients_own_food foreign key (restaurant_id, ingredient_id)
    references public.restaurant_ingredients(restaurant_id, id)
    on delete no action deferrable initially deferred
);

create index basis_recipe_ingredients_food_reference
  on public.basis_recipe_ingredients(restaurant_id, ingredient_id);

create table public.dish_basis_recipes (
  restaurant_id uuid not null,
  dish_id uuid not null,
  basis_recipe_id uuid not null,
  quantity numeric not null,
  unit text not null,
  primary key (dish_id, basis_recipe_id),
  constraint dish_basis_recipes_quantity_valid check (quantity > 0 and quantity <= 1000000),
  constraint dish_basis_recipes_unit_valid check (unit in ('g', 'ml')),
  constraint dish_basis_recipes_own_dish foreign key (restaurant_id, dish_id)
    references public.dishes(restaurant_id, id) on delete cascade,
  -- Defer deletion checks for restaurant-wide cascades; a referenced basis cannot
  -- be deleted on its own. Used output units cannot be silently changed either.
  constraint dish_basis_recipes_own_basis_unit foreign key (restaurant_id, basis_recipe_id, unit)
    references public.basis_recipes(restaurant_id, id, output_unit)
    on delete no action on update no action deferrable initially deferred
);

create index dish_basis_recipes_basis_reference
  on public.dish_basis_recipes(restaurant_id, basis_recipe_id);

alter table public.basis_recipes enable row level security;
alter table public.basis_recipe_ingredients enable row level security;
alter table public.dish_basis_recipes enable row level security;

revoke all on table public.basis_recipes, public.basis_recipe_ingredients, public.dish_basis_recipes
  from public, anon, authenticated, service_role;
grant select on table public.basis_recipes, public.basis_recipe_ingredients, public.dish_basis_recipes
  to authenticated;
-- Trusted administration only; never use the service key in browser components.
grant select, insert, update, delete
  on table public.basis_recipes, public.basis_recipe_ingredients, public.dish_basis_recipes to service_role;

create policy basis_recipes_read_own on public.basis_recipes
  for select to authenticated using (exists (
    select 1 from public.restaurant_members m
    where m.restaurant_id = basis_recipes.restaurant_id
      and m.user_id = (select auth.uid()) and m.role = 'owner'
  ));
create policy basis_recipe_ingredients_read_own on public.basis_recipe_ingredients
  for select to authenticated using (exists (
    select 1 from public.restaurant_members m
    where m.restaurant_id = basis_recipe_ingredients.restaurant_id
      and m.user_id = (select auth.uid()) and m.role = 'owner'
  ));
create policy dish_basis_recipes_read_own on public.dish_basis_recipes
  for select to authenticated using (exists (
    select 1 from public.restaurant_members m
    where m.restaurant_id = dish_basis_recipes.restaurant_id
      and m.user_id = (select auth.uid()) and m.role = 'owner'
  ));

commit;
