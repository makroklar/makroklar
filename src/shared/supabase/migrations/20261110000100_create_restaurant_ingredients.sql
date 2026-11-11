-- Restaurant-owned names linked to a specific, immutable BLS source identity.
begin;

create table public.restaurant_ingredients (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  dataset_id uuid not null,
  bls_code text not null,
  name text not null,
  created_at timestamptz not null default now(),
  constraint restaurant_ingredients_name_not_blank check (
    name = btrim(name) and char_length(name) > 0
  ),
  constraint restaurant_ingredients_bls_food foreign key (dataset_id, bls_code)
    references public.bls_foods (dataset_id, bls_code) on delete restrict,
  constraint restaurant_ingredients_unique_food unique (restaurant_id, dataset_id, bls_code)
);

-- The unique constraint already indexes restaurant_id for owner-scoped lists.
create index restaurant_ingredients_bls_reference
  on public.restaurant_ingredients (dataset_id, bls_code);

alter table public.restaurant_ingredients enable row level security;

revoke all on table public.restaurant_ingredients
  from public, anon, authenticated, service_role;

grant select, delete on table public.restaurant_ingredients to authenticated;
grant insert (restaurant_id, dataset_id, bls_code, name)
  on public.restaurant_ingredients to authenticated;
grant update (dataset_id, bls_code, name)
  on public.restaurant_ingredients to authenticated;
grant select, insert, update, delete on table public.restaurant_ingredients to service_role;

create policy restaurant_ingredients_read_own on public.restaurant_ingredients
  for select to authenticated
  using (
    exists (
      select 1 from public.restaurant_members as member
      where member.restaurant_id = restaurant_ingredients.restaurant_id
        and member.user_id = (select auth.uid())
        and member.role = 'owner'
    )
  );

create policy restaurant_ingredients_insert_own on public.restaurant_ingredients
  for insert to authenticated
  with check (
    exists (
      select 1 from public.restaurant_members as member
      where member.restaurant_id = restaurant_ingredients.restaurant_id
        and member.user_id = (select auth.uid())
        and member.role = 'owner'
    )
  );

create policy restaurant_ingredients_update_own on public.restaurant_ingredients
  for update to authenticated
  using (
    exists (
      select 1 from public.restaurant_members as member
      where member.restaurant_id = restaurant_ingredients.restaurant_id
        and member.user_id = (select auth.uid())
        and member.role = 'owner'
    )
  )
  with check (
    exists (
      select 1 from public.restaurant_members as member
      where member.restaurant_id = restaurant_ingredients.restaurant_id
        and member.user_id = (select auth.uid())
        and member.role = 'owner'
    )
  );

create policy restaurant_ingredients_delete_own on public.restaurant_ingredients
  for delete to authenticated
  using (
    exists (
      select 1 from public.restaurant_members as member
      where member.restaurant_id = restaurant_ingredients.restaurant_id
        and member.user_id = (select auth.uid())
        and member.role = 'owner'
    )
  );

commit;
