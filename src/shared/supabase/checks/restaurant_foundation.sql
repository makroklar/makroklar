-- Run as postgres on a development Supabase database AFTER the first migration.
-- This is a standalone SQL check, not a pgTAP / `supabase test db` test.
-- Fixtures and all changes are rolled back. No login credentials are created.
begin;

insert into auth.users (id, email) values
  ('f7aa0000-0000-4000-8000-000000000001', 'foundation-a@example.invalid'),
  ('f7aa0000-0000-4000-8000-000000000002', 'foundation-b@example.invalid');

-- Owner A creates only their own profile and restaurant.
set local role authenticated;
set local request.jwt.claim.sub = 'f7aa0000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"f7aa0000-0000-4000-8000-000000000001","role":"authenticated"}';

insert into public.profiles (id, username)
values (auth.uid(), 'foundation_f7aa_a');

select set_config('test.restaurant_a', public.create_restaurant('  Restaurant A  ')::text, true);

do $$
begin
  if (select count(*) from public.restaurants) <> 1
    or (select count(*) from public.restaurant_members) <> 1
    or (select name from public.restaurants) <> 'Restaurant A' then
    raise exception 'FAIL: owner A must see the restaurant and its ownership.';
  end if;

  begin
    insert into public.profiles (id, username)
    values ('f7aa0000-0000-4000-8000-000000000002', 'foundation_f7aa_spoof');
    raise exception 'FAIL: creating another user profile must be denied.';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.restaurants (name) values ('Unowned restaurant');
    raise exception 'FAIL: direct restaurant insertion must be denied.';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.create_restaurant('   ');
    raise exception 'FAIL: an empty restaurant name must be rejected.';
  exception when invalid_parameter_value then null;
  end;

  if (select count(*) from public.restaurants) <> 1 then
    raise exception 'FAIL: rejected creation must not leave another restaurant.';
  end if;
end;
$$;

-- Owner B must not see A's profile, ownership or restaurant.
set local request.jwt.claim.sub = 'f7aa0000-0000-4000-8000-000000000002';
set local request.jwt.claims = '{"sub":"f7aa0000-0000-4000-8000-000000000002","role":"authenticated"}';

insert into public.profiles (id, username)
values (auth.uid(), 'foundation_f7aa_b');

do $$
begin
  if (select count(*) from public.profiles) <> 1
    or exists (select 1 from public.restaurants)
    or exists (select 1 from public.restaurant_members) then
    raise exception 'FAIL: owner B must not see owner A data.';
  end if;
end;
$$;

select set_config('test.restaurant_b', public.create_restaurant('Restaurant B')::text, true);

-- Return to A and verify successful own updates and blocked cross-tenant writes.
set local request.jwt.claim.sub = 'f7aa0000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"f7aa0000-0000-4000-8000-000000000001","role":"authenticated"}';

do $$
declare
  affected integer;
begin
  if (select count(*) from public.profiles) <> 1
    or (select count(*) from public.restaurants) <> 1
    or (select count(*) from public.restaurant_members) <> 1 then
    raise exception 'FAIL: owner A must still see only their own rows.';
  end if;

  update public.profiles set username = 'foundation_f7aa_a_updated' where id = auth.uid();
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'FAIL: own profile update must succeed.'; end if;

  update public.restaurants set name = 'Restaurant A updated'
  where id = current_setting('test.restaurant_a')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'FAIL: own restaurant update must succeed.'; end if;

  update public.profiles set username = 'foundation_f7aa_hijacked'
  where id = 'f7aa0000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: another profile was updated.'; end if;

  update public.restaurants set name = 'Hijacked restaurant'
  where id = current_setting('test.restaurant_b')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: another restaurant was updated.'; end if;

  begin
    insert into public.restaurant_members (restaurant_id, user_id, role)
    values (current_setting('test.restaurant_b')::uuid, auth.uid(), 'owner');
    raise exception 'FAIL: self-enrollment into another restaurant must be denied.';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.restaurant_members set user_id = auth.uid()
    where restaurant_id = current_setting('test.restaurant_b')::uuid;
    raise exception 'FAIL: changing ownership must be denied.';
  exception when insufficient_privilege then null;
  end;

  begin
    delete from public.restaurant_members where user_id = auth.uid();
    raise exception 'FAIL: direct membership deletion must be denied.';
  exception when insufficient_privilege then null;
  end;

  begin
    delete from public.profiles where id = auth.uid();
    raise exception 'FAIL: direct profile deletion must be denied.';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.profiles set id = gen_random_uuid() where id = auth.uid();
    raise exception 'FAIL: a profile identity must not be editable.';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.restaurants set id = gen_random_uuid()
    where id = current_setting('test.restaurant_a')::uuid;
    raise exception 'FAIL: a restaurant identity must not be editable.';
  exception when insufficient_privilege then null;
  end;

  begin
    delete from public.restaurants where id = current_setting('test.restaurant_a')::uuid;
    raise exception 'FAIL: direct restaurant deletion must be denied.';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- A role without a signed-in identity cannot create a restaurant even with RPC access.
set local request.jwt.claim.sub = '';
set local request.jwt.claims = '{}';
do $$
begin
  begin
    perform public.create_restaurant('Missing identity');
    raise exception 'FAIL: creation without an authenticated identity must fail.';
  exception when invalid_authorization_specification then null;
  end;
end;
$$;

-- Public visitors have neither table access nor permission to create restaurants.
set local role anon;
do $$
begin
  begin
    perform 1 from public.profiles;
    raise exception 'FAIL: anon must not read profiles.';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.restaurants;
    raise exception 'FAIL: anon must not read private restaurant records.';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.restaurant_members;
    raise exception 'FAIL: anon must not read ownership records.';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.create_restaurant('Anonymous restaurant');
    raise exception 'FAIL: anon must not invoke restaurant creation.';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- Verify constraints and final values as the administrator, then remove every fixture.
reset role;
do $$
begin
  if (select name from public.restaurants
      where id = current_setting('test.restaurant_b')::uuid) is distinct from 'Restaurant B'
    or (select username from public.profiles
        where id = 'f7aa0000-0000-4000-8000-000000000002') is distinct from 'foundation_f7aa_b' then
    raise exception 'FAIL: owner B data changed during cross-tenant checks.';
  end if;

  begin
    insert into public.restaurant_members (restaurant_id, user_id, role)
    values (current_setting('test.restaurant_a')::uuid,
            'f7aa0000-0000-4000-8000-000000000002', 'owner');
    raise exception 'FAIL: a second owner must be rejected.';
  exception when unique_violation then null;
  end;

  begin
    delete from auth.users where id = 'f7aa0000-0000-4000-8000-000000000001';
    raise exception 'FAIL: account deletion must not orphan a restaurant.';
  exception when foreign_key_violation then null;
  end;

  raise notice 'PASS: restaurant creation, ownership, grants and RLS checks completed.';
end;
$$;

rollback;
