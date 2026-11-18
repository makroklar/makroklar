-- Global reference data, shared by restaurants; client writes are not permitted.
begin;

create table public.nutrition_datasets (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source = 'bls'),
  source_version text not null check (btrim(source_version) <> ''),
  release_year integer not null check (release_year > 0),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  file_manifest jsonb not null check (jsonb_typeof(file_manifest) = 'array'),
  source_url text not null,
  food_count integer not null check (food_count > 0),
  nutrient_count integer not null check (nutrient_count > 0),
  basis_quantity numeric not null default 100 check (basis_quantity = 100),
  basis_unit text not null default 'g' check (basis_unit = 'g'),
  is_active boolean not null default false,
  imported_at timestamptz not null default now(),
  unique (source, source_version, release_year, content_sha256)
);

create unique index nutrition_datasets_one_active_source
  on public.nutrition_datasets (source) where is_active;

create table public.nutrients (
  dataset_id uuid not null references public.nutrition_datasets (id) on delete cascade,
  code text not null check (btrim(code) <> ''),
  name_de text not null,
  name_en text not null,
  unit text not null check (unit in ('g', 'mg', 'µg', 'kJ', 'kcal')),
  group_de text not null,
  group_en text not null,
  formula text,
  formula_application text,
  sort_index integer not null check (sort_index > 0),
  primary key (dataset_id, code),
  unique (dataset_id, sort_index)
);

create table public.bls_foods (
  dataset_id uuid not null references public.nutrition_datasets (id) on delete cascade,
  bls_code text not null check (btrim(bls_code) <> ''),
  name_de text not null,
  name_en text not null,
  notes text,
  source_row integer not null check (source_row >= 2),
  primary key (dataset_id, bls_code)
);

create table public.bls_food_nutrients (
  dataset_id uuid not null,
  bls_code text not null,
  nutrient_code text not null,
  value numeric,
  raw_value text,
  value_kind text not null,
  origin text,
  reference_text text,
  primary key (dataset_id, bls_code, nutrient_code),
  foreign key (dataset_id, bls_code)
    references public.bls_foods (dataset_id, bls_code) on delete cascade,
  foreign key (dataset_id, nutrient_code)
    references public.nutrients (dataset_id, code) on delete cascade,
  -- No zero substitution for missing data, traces or detection limits.
  constraint bls_food_nutrients_value_state check (
    (value_kind = 'numeric' and value is not null and value >= 0
      and value < 'Infinity'::numeric and raw_value is not null)
    or (value is null and (
      (value_kind = 'missing' and (raw_value is null or raw_value = '-'))
      or (value_kind = 'trace' and raw_value is not distinct from 'TR')
      or (value_kind = 'below_lod' and raw_value is not distinct from '<LOD')
      or (value_kind = 'below_loq' and raw_value is not distinct from '<LOQ')
      or (value_kind = 'below_lod_or_loq' and raw_value is not distinct from '<LOD or <LOQ')
    ))
  )
);

create index bls_food_nutrients_component
  on public.bls_food_nutrients (dataset_id, nutrient_code);

alter table public.nutrition_datasets enable row level security;
alter table public.nutrients enable row level security;
alter table public.bls_foods enable row level security;
alter table public.bls_food_nutrients enable row level security;

revoke all on table public.nutrition_datasets, public.nutrients,
  public.bls_foods, public.bls_food_nutrients
  from public, anon, authenticated, service_role;

grant select on table public.nutrition_datasets, public.nutrients,
  public.bls_foods, public.bls_food_nutrients to authenticated;
grant select, insert, update, delete on table public.nutrition_datasets,
  public.nutrients, public.bls_foods, public.bls_food_nutrients to service_role;

create policy nutrition_datasets_read on public.nutrition_datasets
  for select to authenticated using ((select auth.uid()) is not null);
create policy nutrients_read on public.nutrients
  for select to authenticated using ((select auth.uid()) is not null);
create policy bls_foods_read on public.bls_foods
  for select to authenticated using ((select auth.uid()) is not null);
create policy bls_food_nutrients_read on public.bls_food_nutrients
  for select to authenticated using ((select auth.uid()) is not null);

commit;
