-- Registration completion is separate from creating additional restaurants.
begin;

create function makroklar_private.complete_restaurant_registration()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  restaurant_id uuid;
  restaurant_name text;
begin
  if caller_id is null then
    raise exception using errcode = '28000', message = 'Sign-in is required.';
  end if;

  -- Serialize completion requests for this account, including simultaneous retries.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('makroklar:registration:' || caller_id::text, 0)
  );

  select case when pg_catalog.jsonb_typeof(u.raw_user_meta_data -> 'restaurant_name') = 'string'
    then u.raw_user_meta_data ->> 'restaurant_name' end
    into restaurant_name
    from auth.users as u
    where u.id = caller_id and u.email_confirmed_at is not null;
  if not found then
    raise exception using errcode = '28000', message = 'A confirmed email is required.';
  end if;

  -- An existing owner resumes their earliest restaurant; never rename it from metadata.
  select m.restaurant_id into restaurant_id
    from public.restaurant_members as m
    where m.user_id = caller_id and m.role = 'owner'
    order by m.created_at, m.restaurant_id
    limit 1;
  if found then
    return restaurant_id;
  end if;

  if restaurant_name is null or pg_catalog.btrim(restaurant_name) = '' then
    raise exception using errcode = '22023', message = 'Restaurant name must not be blank.';
  end if;

  -- Metadata supplies a display name only. Ownership always comes from auth.uid().
  return makroklar_private.create_restaurant(restaurant_name);
end;
$$;

revoke all on function makroklar_private.complete_restaurant_registration()
  from public, anon, authenticated, service_role;
grant execute on function makroklar_private.complete_restaurant_registration() to authenticated;

create function public.complete_restaurant_registration()
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select makroklar_private.complete_restaurant_registration();
$$;

revoke all on function public.complete_restaurant_registration()
  from public, anon, authenticated, service_role;
grant execute on function public.complete_restaurant_registration() to authenticated;

commit;
