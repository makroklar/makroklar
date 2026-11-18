-- Run as postgres on a development Supabase database AFTER the BLS migration.
-- Standalone SQL checks. All fixtures and changes are rolled back.
begin;

insert into public.nutrition_datasets
  (id, source, source_version, release_year, content_sha256, file_manifest, source_url, food_count, nutrient_count)
values
  ('f7bb0000-0000-4000-8000-000000000001', 'bls', 'check-a', 2025, repeat('0',64), '[]', 'https://example.invalid', 1, 8),
  ('f7bb0000-0000-4000-8000-000000000002', 'bls', 'check-b', 2025, repeat('1',64), '[]', 'https://example.invalid', 1, 1);

insert into public.nutrients (dataset_id, code, name_de, name_en, unit, group_de, group_en, sort_index)
select 'f7bb0000-0000-4000-8000-000000000001', 'CHECK' || n, 'Pruefung', 'Check', 'g', 'Test', 'Test', n
from generate_series(1,8) n;
insert into public.nutrients (dataset_id, code, name_de, name_en, unit, group_de, group_en, sort_index)
values ('f7bb0000-0000-4000-8000-000000000002', 'ONLYB', 'Pruefung', 'Check', 'µg', 'Test', 'Test', 1);

insert into public.bls_foods (dataset_id, bls_code, name_de, name_en, source_row) values
  ('f7bb0000-0000-4000-8000-000000000001', 'TEST001', 'Test A', 'Test A', 2),
  ('f7bb0000-0000-4000-8000-000000000002', 'TEST002', 'Test B', 'Test B', 2);

insert into public.bls_food_nutrients (dataset_id, bls_code, nutrient_code, value, raw_value, value_kind)
select 'f7bb0000-0000-4000-8000-000000000001', 'TEST001', code, value, raw_value, kind
from (values
  ('CHECK1', 0::numeric, '0', 'numeric'),
  ('CHECK2', null, '-', 'missing'),
  ('CHECK3', null, null, 'missing'),
  ('CHECK4', null, 'TR', 'trace'),
  ('CHECK5', null, '<LOD', 'below_lod'),
  ('CHECK6', null, '<LOQ', 'below_loq'),
  ('CHECK7', null, '<LOD or <LOQ', 'below_lod_or_loq'),
  ('CHECK8', 12.375, '12.375', 'numeric')
) as fixture(code, value, raw_value, kind);

do $$
declare
  invalid record;
begin
  for invalid in select * from (values
    ('numeric', null::numeric, null::text), ('numeric', -1, '-1'),
    ('numeric', 'NaN'::numeric, 'NaN'), ('numeric', 'Infinity'::numeric, 'Infinity'),
    ('missing', 0, '-'), ('trace', 0, 'TR'), ('trace', null, null),
    ('below_lod', null, null), ('below_loq', null, 'TR'),
    ('below_lod_or_loq', null, null), ('unknown', null, 'anything')
  ) as cases(kind, number, raw) loop
    begin
      update public.bls_food_nutrients set value_kind = invalid.kind,
        value = invalid.number, raw_value = invalid.raw
      where dataset_id = 'f7bb0000-0000-4000-8000-000000000001' and nutrient_code = 'CHECK1';
      raise exception 'FAIL: invalid nutrient state was accepted: %', invalid.kind;
    exception when check_violation then null;
    end;
  end loop;

  begin
    update public.bls_food_nutrients set nutrient_code = 'ONLYB'
    where dataset_id = 'f7bb0000-0000-4000-8000-000000000001' and nutrient_code = 'CHECK1';
    raise exception 'FAIL: nutrient from another dataset was accepted.';
  exception when foreign_key_violation then null;
  end;
  begin
    update public.bls_food_nutrients set bls_code = 'TEST002'
    where dataset_id = 'f7bb0000-0000-4000-8000-000000000001' and nutrient_code = 'CHECK1';
    raise exception 'FAIL: food from another dataset was accepted.';
  exception when foreign_key_violation then null;
  end;
  begin
    insert into public.bls_foods (dataset_id, bls_code, name_de, name_en, source_row)
    values ('f7bb0000-0000-4000-8000-000000000001', 'TEST001', 'Duplicate', 'Duplicate', 3);
    raise exception 'FAIL: duplicate original food code was accepted.';
  exception when unique_violation then null;
  end;
  begin
    insert into public.nutrition_datasets
      (source, source_version, release_year, content_sha256, file_manifest, source_url, food_count, nutrient_count)
    values ('bls', 'check-a', 2025, repeat('0',64), '[]', 'https://example.invalid', 1, 8);
    raise exception 'FAIL: duplicate source release was accepted.';
  exception when unique_violation then null;
  end;
  begin
    -- The exception rolls back this subtransaction, including any active-flag changes.
    update public.nutrition_datasets set is_active = false where is_active;
    update public.nutrition_datasets set is_active = true
      where id = 'f7bb0000-0000-4000-8000-000000000001';
    update public.nutrition_datasets set is_active = true
      where id = 'f7bb0000-0000-4000-8000-000000000002';
    raise exception 'FAIL: two active BLS releases were accepted.';
  exception when unique_violation then null;
  end;
end;
$$;

-- No credentials or accounts are created. These JWT claims simulate DB roles only.
set local role authenticated;
set local request.jwt.claim.sub = 'f7bb0000-0000-4000-8000-000000000003';
set local request.jwt.claims = '{"sub":"f7bb0000-0000-4000-8000-000000000003","role":"authenticated"}';

do $$
declare
  table_name text;
  key_column text;
  update_column text;
  rows_found bigint;
begin
  foreach table_name in array array['nutrition_datasets','nutrients','bls_foods','bls_food_nutrients'] loop
    key_column := case when table_name = 'nutrition_datasets' then 'id' else 'dataset_id' end;
    execute format('select count(*) from public.%I where %I = $1', table_name, key_column)
      into rows_found using 'f7bb0000-0000-4000-8000-000000000001'::uuid;
    if rows_found = 0 then raise exception 'FAIL: authenticated reference read denied: %', table_name; end if;
    update_column := case table_name when 'nutrition_datasets' then 'source_version'
      when 'nutrients' then 'code' when 'bls_foods' then 'bls_code' else 'nutrient_code' end;
    begin
      execute format('insert into public.%I default values', table_name);
      raise exception 'FAIL: authenticated insert allowed: %', table_name;
    exception when insufficient_privilege then null;
    end;
    begin
      execute format('update public.%I set %I = %I where false', table_name, update_column, update_column);
      raise exception 'FAIL: authenticated update allowed: %', table_name;
    exception when insufficient_privilege then null;
    end;
    begin
      execute format('delete from public.%I where false', table_name);
      raise exception 'FAIL: authenticated delete allowed: %', table_name;
    exception when insufficient_privilege then null;
    end;
  end loop;
end;
$$;

-- A second restaurant account sees the same global reference data.
set local request.jwt.claim.sub = 'f7bb0000-0000-4000-8000-000000000004';
set local request.jwt.claims = '{"sub":"f7bb0000-0000-4000-8000-000000000004","role":"authenticated"}';
do $$
begin
  if (select count(*) from public.bls_food_nutrients
      where dataset_id = 'f7bb0000-0000-4000-8000-000000000001') <> 8 then
    raise exception 'FAIL: reference catalog must be shared between authenticated accounts.';
  end if;
end;
$$;

set local request.jwt.claim.sub = '';
set local request.jwt.claims = '{"role":"authenticated"}';
do $$
declare table_name text; rows_found bigint;
begin
  foreach table_name in array array['nutrition_datasets','nutrients','bls_foods','bls_food_nutrients'] loop
    execute format('select count(*) from public.%I', table_name) into rows_found;
    if rows_found <> 0 then raise exception 'FAIL: missing auth.uid() exposes rows: %', table_name; end if;
  end loop;
end;
$$;

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
do $$
declare table_name text;
begin
  foreach table_name in array array['nutrition_datasets','nutrients','bls_foods','bls_food_nutrients'] loop
    begin
      execute format('select * from public.%I limit 1', table_name);
      raise exception 'FAIL: anonymous catalog access allowed: %', table_name;
    exception when insufficient_privilege then null;
    end;
  end loop;
end;
$$;

reset role;
do $$
declare table_name text;
begin
  foreach table_name in array array['nutrition_datasets','nutrients','bls_foods','bls_food_nutrients'] loop
    if not (select relrowsecurity from pg_class where oid = ('public.' || table_name)::regclass) then
      raise exception 'FAIL: RLS disabled: %', table_name;
    end if;
    if not has_table_privilege('service_role', 'public.' || table_name, 'SELECT')
      or not has_table_privilege('service_role', 'public.' || table_name, 'INSERT')
      or not has_table_privilege('service_role', 'public.' || table_name, 'UPDATE')
      or not has_table_privilege('service_role', 'public.' || table_name, 'DELETE') then
      raise exception 'FAIL: trusted backend privileges missing: %', table_name;
    end if;
  end loop;
end;
$$;

select 'BLS constraints, cross-dataset FKs, shared reads, RLS and write restrictions passed; rolling back.' as result;
rollback;
