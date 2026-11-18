-- First migration: restaurant accounts, ownership and tenant isolation.
-- Requires Supabase Auth and the anon, authenticated and service_role roles.
begin;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text,
  created_at timestamptz not null default now(),
  constraint profiles_username_not_blank check (
    username is null or (username = btrim(username) and char_length(username) > 0)
  )
);

create unique index profiles_username_unique
  on public.profiles (lower(username));

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  constraint restaurants_name_not_blank check (
    name = btrim(name) and char_length(name) > 0
  )
);

create table public.restaurant_members (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  -- Account deletion must first resolve ownership, rather than orphan a restaurant.
  user_id uuid not null references auth.users (id) on delete restrict,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (restaurant_id, user_id),
  constraint restaurant_members_role check (role = 'owner')
);

-- Additional roles require a later migration; initially every restaurant has one owner.
create unique index restaurant_members_one_owner
  on public.restaurant_members (restaurant_id) where role = 'owner';

create index restaurant_members_user_restaurant
  on public.restaurant_members (user_id, restaurant_id);

alter table public.profiles enable row level security;
alter table public.restaurants enable row level security;
alter table public.restaurant_members enable row level security;

-- Explicit grants also work when automatic Data API exposure is disabled.
revoke all on table public.profiles, public.restaurants, public.restaurant_members
  from public, anon, authenticated, service_role;

grant usage on schema public to authenticated, service_role;
grant select on table public.profiles, public.restaurants, public.restaurant_members
  to authenticated;
grant insert (id, username) on public.profiles to authenticated;
grant update (username) on public.profiles to authenticated;
grant update (name) on public.restaurants to authenticated;

-- Administrative access is for trusted server code, never browser clients.
grant select, insert, update, delete
  on table public.profiles, public.restaurants, public.restaurant_members
  to service_role;

create policy profiles_read_self on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- This policy does not query restaurants, avoiding a recursive policy dependency.
create policy restaurant_members_read_self on public.restaurant_members
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy restaurants_read_own on public.restaurants
  for select to authenticated
  using (
    exists (
      select 1 from public.restaurant_members as member
      where member.restaurant_id = restaurants.id
        and member.user_id = (select auth.uid())
        and member.role = 'owner'
    )
  );

create policy restaurants_update_own on public.restaurants
  for update to authenticated
  using (
    exists (
      select 1 from public.restaurant_members as member
      where member.restaurant_id = restaurants.id
        and member.user_id = (select auth.uid())
        and member.role = 'owner'
    )
  )
  with check (
    exists (
      select 1 from public.restaurant_members as member
      where member.restaurant_id = restaurants.id
        and member.user_id = (select auth.uid())
        and member.role = 'owner'
    )
  );

-- Keep the privileged implementation outside the schemas exposed by the Data API.
create schema makroklar_private;
revoke all on schema makroklar_private from public, anon, authenticated;
grant usage on schema makroklar_private to authenticated;

create function makroklar_private.create_restaurant(restaurant_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  new_restaurant_id uuid;
begin
  if caller_id is null then
    raise exception using errcode = '28000', message = 'Sign-in is required.';
  end if;

  if restaurant_name is null or pg_catalog.btrim(restaurant_name) = '' then
    raise exception using errcode = '22023', message = 'Restaurant name must not be blank.';
  end if;

  insert into public.restaurants (name)
  values (pg_catalog.btrim(restaurant_name))
  returning id into new_restaurant_id;

  insert into public.restaurant_members (restaurant_id, user_id, role)
  values (new_restaurant_id, caller_id, 'owner');

  return new_restaurant_id;
end;
$$;

revoke all on function makroklar_private.create_restaurant(text)
  from public, anon, authenticated, service_role;
grant execute on function makroklar_private.create_restaurant(text) to authenticated;

-- The public RPC uses invoker permissions; the private function checks the caller.
create function public.create_restaurant(restaurant_name text)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select makroklar_private.create_restaurant(restaurant_name);
$$;

revoke all on function public.create_restaurant(text)
  from public, anon, authenticated, service_role;
grant execute on function public.create_restaurant(text) to authenticated;

commit;
