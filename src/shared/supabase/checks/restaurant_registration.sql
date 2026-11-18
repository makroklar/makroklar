-- Run as postgres AFTER 20261110000400. All fixtures/changes roll back; no login credentials.
begin;

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('f7ac0000-0000-4000-8000-000000000001', 'registration-a@example.invalid', now(), '{"restaurant_name":"  Restaurant A  ","role":"admin","restaurant_id":"foreign"}'),
  ('f7ac0000-0000-4000-8000-000000000002', 'registration-b@example.invalid', now(), '{"restaurant_name":"Restaurant B"}'),
  ('f7ac0000-0000-4000-8000-000000000003', 'registration-unconfirmed@example.invalid', null, '{"restaurant_name":"Unconfirmed"}'),
  ('f7ac0000-0000-4000-8000-000000000004', 'registration-unnamed@example.invalid', now(), '{"restaurant_name":42}');

do $$
begin
  if pg_catalog.has_function_privilege('anon', 'public.complete_restaurant_registration()', 'execute')
    or pg_catalog.has_function_privilege('service_role', 'public.complete_restaurant_registration()', 'execute')
    or not pg_catalog.has_function_privilege('authenticated', 'public.complete_restaurant_registration()', 'execute')
    or pg_catalog.has_function_privilege('anon', 'makroklar_private.complete_restaurant_registration()', 'execute') then
    raise exception 'FAIL: registration RPC grants are incorrect.';
  end if;
end;
$$;

set local role authenticated;
set local request.jwt.claim.sub = 'f7ac0000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"f7ac0000-0000-4000-8000-000000000001","role":"authenticated"}';
select set_config('test.registration_a', public.complete_restaurant_registration()::text, true);

do $$
begin
  if public.complete_restaurant_registration()::text <> current_setting('test.registration_a')
    or (select count(*) from public.restaurant_members) <> 1
    or (select count(*) from public.restaurants) <> 1
    or (select name from public.restaurants) <> 'Restaurant A'
    or (select role from public.restaurant_members) <> 'owner' then
    raise exception 'FAIL: completion must create one trimmed restaurant owned by the caller and reuse it.';
  end if;
  if not exists (select 1 from pg_catalog.pg_locks where locktype = 'advisory' and pid = pg_catalog.pg_backend_pid() and granted) then
    raise exception 'FAIL: completion must hold a transaction advisory lock.';
  end if;
end;
$$;

-- Editing a display-name metadatum must never rename or duplicate an existing restaurant.
reset role;
update auth.users set raw_user_meta_data = '{}' where id = 'f7ac0000-0000-4000-8000-000000000001';
update public.restaurant_members set created_at = '2020-01-01T00:00:00Z'
  where user_id = 'f7ac0000-0000-4000-8000-000000000001';
set local role authenticated;
select public.create_restaurant('Additional restaurant');
do $$
begin
  if public.complete_restaurant_registration()::text <> current_setting('test.registration_a')
    or (select count(*) from public.restaurants) <> 2
    or (select name from public.restaurants where id = current_setting('test.registration_a')::uuid) <> 'Restaurant A' then
    raise exception 'FAIL: existing owners must resume their earliest restaurant, even without metadata.';
  end if;
end;
$$;

set local request.jwt.claim.sub = 'f7ac0000-0000-4000-8000-000000000002';
set local request.jwt.claims = '{"sub":"f7ac0000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
declare
  completed_id uuid;
begin
  completed_id := public.complete_restaurant_registration();
  if completed_id::text = current_setting('test.registration_a')
    or (select count(*) from public.restaurants) <> 1
    or (select name from public.restaurants) <> 'Restaurant B' then
    raise exception 'FAIL: another account must receive only its own restaurant.';
  end if;
end;
$$;

set local request.jwt.claim.sub = 'f7ac0000-0000-4000-8000-000000000003';
set local request.jwt.claims = '{"sub":"f7ac0000-0000-4000-8000-000000000003","role":"authenticated"}';
do $$
begin
  begin
    perform public.complete_restaurant_registration();
    raise exception 'FAIL: unconfirmed email must be rejected.';
  exception when invalid_authorization_specification then null;
  end;
  if exists (select 1 from public.restaurant_members) then
    raise exception 'FAIL: rejected completion must leave no membership.';
  end if;
end;
$$;

set local request.jwt.claim.sub = 'f7ac0000-0000-4000-8000-000000000004';
set local request.jwt.claims = '{"sub":"f7ac0000-0000-4000-8000-000000000004","role":"authenticated"}';
do $$
begin
  begin
    perform public.complete_restaurant_registration();
    raise exception 'FAIL: non-text restaurant metadata must be rejected.';
  exception when invalid_parameter_value then null;
  end;
end;
$$;

set local request.jwt.claim.sub = '';
set local request.jwt.claims = '{}';
do $$
begin
  begin
    perform public.complete_restaurant_registration();
    raise exception 'FAIL: a missing identity must be rejected.';
  exception when invalid_authorization_specification then null;
  end;
end;
$$;

reset role;
do $$
begin
  if (select count(*) from public.restaurant_members where user_id in (
    'f7ac0000-0000-4000-8000-000000000001', 'f7ac0000-0000-4000-8000-000000000002'
  )) <> 3 then
    raise exception 'FAIL: retries or rejected requests changed the expected membership count.';
  end if;
  raise notice 'PASS: registration retry, grants, confirmed identity, metadata and tenant-isolation checks.';
end;
$$;
rollback;
