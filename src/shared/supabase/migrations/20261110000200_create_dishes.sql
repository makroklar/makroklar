-- Recipe quantities describe the whole recipe; servings defaults to one portion.
begin;

-- Composite identities let foreign keys enforce restaurant boundaries independently of RLS.
alter table public.restaurant_ingredients
  add constraint restaurant_ingredients_restaurant_identity unique (restaurant_id, id);

create table public.dishes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  -- NUMERIC with an integer check rejects fractional input instead of rounding it.
  servings numeric not null default 1,
  source text,
  source_id text,
  created_at timestamptz not null default now(),
  constraint dishes_name_not_blank check (name = btrim(name) and char_length(name) > 0),
  constraint dishes_servings_positive_whole check (
    servings > 0 and servings < 'Infinity'::numeric and servings = trunc(servings)
  ),
  constraint dishes_source_supported check (source is null or source = 'lightspeed-k-series'),
  constraint dishes_source_identity_pair check ((source is null) = (source_id is null)),
  constraint dishes_source_id_not_blank check (
    source_id is null or (source_id = btrim(source_id) and char_length(source_id) > 0)
  ),
  constraint dishes_restaurant_identity unique (restaurant_id, id),
  -- NULL source identities allow multiple manually created dishes.
  constraint dishes_import_identity unique (restaurant_id, source, source_id)
);

create table public.dish_ingredients (
  restaurant_id uuid not null,
  dish_id uuid not null,
  ingredient_id uuid not null,
  quantity_g numeric not null,
  primary key (dish_id, ingredient_id),
  constraint dish_ingredients_quantity_positive check (
    quantity_g > 0 and quantity_g < 'Infinity'::numeric
  ),
  constraint dish_ingredients_own_dish foreign key (restaurant_id, dish_id)
    references public.dishes (restaurant_id, id) on delete cascade,
  -- Checked at commit so restaurant-wide cascades can remove both parent tables
  -- in either order. Committing a recipe with a missing ingredient is forbidden.
  constraint dish_ingredients_own_ingredient foreign key (restaurant_id, ingredient_id)
    references public.restaurant_ingredients (restaurant_id, id)
    on delete no action deferrable initially deferred
);

create index dish_ingredients_restaurant_ingredient
  on public.dish_ingredients (restaurant_id, ingredient_id);

alter table public.dishes enable row level security;
alter table public.dish_ingredients enable row level security;

revoke all on table public.dishes, public.dish_ingredients
  from public, anon, authenticated, service_role;

grant select, delete on table public.dishes, public.dish_ingredients to authenticated;
grant insert (restaurant_id, name, servings, source, source_id) on public.dishes to authenticated;
grant update (name, servings) on public.dishes to authenticated;
grant insert (restaurant_id, dish_id, ingredient_id, quantity_g)
  on public.dish_ingredients to authenticated;
grant update (quantity_g) on public.dish_ingredients to authenticated;
grant select, insert, update, delete on table public.dishes, public.dish_ingredients to service_role;

create policy dishes_read_own on public.dishes
  for select to authenticated using (
    exists (select 1 from public.restaurant_members as member
      where member.restaurant_id = dishes.restaurant_id
        and member.user_id = (select auth.uid()) and member.role = 'owner')
  );
create policy dishes_insert_own on public.dishes
  for insert to authenticated with check (
    exists (select 1 from public.restaurant_members as member
      where member.restaurant_id = dishes.restaurant_id
        and member.user_id = (select auth.uid()) and member.role = 'owner')
  );
create policy dishes_update_own on public.dishes
  for update to authenticated using (
    exists (select 1 from public.restaurant_members as member
      where member.restaurant_id = dishes.restaurant_id
        and member.user_id = (select auth.uid()) and member.role = 'owner')
  ) with check (
    exists (select 1 from public.restaurant_members as member
      where member.restaurant_id = dishes.restaurant_id
        and member.user_id = (select auth.uid()) and member.role = 'owner')
  );
create policy dishes_delete_own on public.dishes
  for delete to authenticated using (
    exists (select 1 from public.restaurant_members as member
      where member.restaurant_id = dishes.restaurant_id
        and member.user_id = (select auth.uid()) and member.role = 'owner')
  );

create policy dish_ingredients_read_own on public.dish_ingredients
  for select to authenticated using (
    exists (select 1 from public.restaurant_members as member
      where member.restaurant_id = dish_ingredients.restaurant_id
        and member.user_id = (select auth.uid()) and member.role = 'owner')
  );
create policy dish_ingredients_insert_own on public.dish_ingredients
  for insert to authenticated with check (
    exists (select 1 from public.restaurant_members as member
      where member.restaurant_id = dish_ingredients.restaurant_id
        and member.user_id = (select auth.uid()) and member.role = 'owner')
  );
create policy dish_ingredients_update_own on public.dish_ingredients
  for update to authenticated using (
    exists (select 1 from public.restaurant_members as member
      where member.restaurant_id = dish_ingredients.restaurant_id
        and member.user_id = (select auth.uid()) and member.role = 'owner')
  ) with check (
    exists (select 1 from public.restaurant_members as member
      where member.restaurant_id = dish_ingredients.restaurant_id
        and member.user_id = (select auth.uid()) and member.role = 'owner')
  );
create policy dish_ingredients_delete_own on public.dish_ingredients
  for delete to authenticated using (
    exists (select 1 from public.restaurant_members as member
      where member.restaurant_id = dish_ingredients.restaurant_id
        and member.user_id = (select auth.uid()) and member.role = 'owner')
  );

commit;
