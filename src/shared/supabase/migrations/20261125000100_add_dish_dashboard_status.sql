-- Läuft nach den Basen-Migrationen 20261124000200–20261124000400.
--
-- Status-Felder für den Dashboard-Flow (To-do-Liste, LMIV-Freigabe, Speisekarte):
--   1. Import prüfen      → recipe_confirmed_at / _by
--   2. LMIV-Freigabe      → allergens, additives, allergens_confirmed_at / _by
--   3. Speisekarte        → published_at / _by
--   4. Gericht-Editor     → category, prep_minutes, cooked_weight_g
--
-- Lesen: direkt aus public.dishes (authenticated hat bereits SELECT, RLS dishes_read_own).
-- Schreiben: nur über die Funktionen unten. Für die neuen Spalten gibt es bewusst kein
-- direktes UPDATE-Recht, damit die Regeln (z. B. „veröffentlichen nur mit vollständigen
-- Nährwerten und bestätigten Allergenen“) nicht im Frontend umgangen werden können.
--
-- Rezeptänderungen: Ein Trigger auf dish_ingredients passt nicht, weil das Onboarding-Speichern alle
-- Rezeptzeilen löscht und neu schreibt – auch unveränderte – und damit jede Bestätigung verwerfen würde.
-- Stattdessen ruft das Dashboard reset_dish_confirmations auf, wenn sich Zutaten oder Mengen wirklich
-- ändern. Änderungen über das Onboarding setzen (noch) nichts zurück.
begin;

alter table public.dishes
  add column recipe_confirmed_at timestamptz,
  add column recipe_confirmed_by uuid references auth.users (id) on delete set null,
  -- Codes der 14 Hauptallergene nach LMIV, Anhang II
  add column allergens text[] not null default '{}',
  -- Kennzeichnungspflichtige Zusatzstoffe (Gastronomie)
  add column additives text[] not null default '{}',
  add column allergens_confirmed_at timestamptz,
  add column allergens_confirmed_by uuid references auth.users (id) on delete set null,
  add column published_at timestamptz,
  add column published_by uuid references auth.users (id) on delete set null,
  -- Kategorie der Gastansicht; NULL = noch nicht gewählt
  add column category text,
  add column prep_minutes integer,
  -- Gewicht einer Portion nach dem Kochen
  add column cooked_weight_g numeric,
  add constraint dishes_allergens_known check (allergens <@ array[
    'gluten', 'crustaceans', 'eggs', 'fish', 'peanuts', 'soy', 'milk',
    'nuts', 'celery', 'mustard', 'sesame', 'sulphites', 'lupin', 'molluscs'
  ]::text[]),
  add constraint dishes_additives_known check (additives <@ array[
    'colourings', 'flavour_enhancers', 'preservatives', 'sweeteners', 'antioxidants', 'phosphate'
  ]::text[]),
  add constraint dishes_category_known check (
    category is null or category in ('Vorspeise', 'Salate', 'Hauptspeise', 'Dessert', 'Getränke')
  ),
  add constraint dishes_prep_minutes_valid check (prep_minutes is null or prep_minutes between 1 and 1440),
  add constraint dishes_cooked_weight_valid check (
    cooked_weight_g is null or (cooked_weight_g > 0 and cooked_weight_g <= 1000000)
  ),
  -- Veröffentlicht nur mit bestätigten Allergenen
  add constraint dishes_published_needs_allergens check (published_at is null or allergens_confirmed_at is not null);

-- Gemeinsame Prüfung: Gericht gehört einem Restaurant, dessen Owner der Aufrufer ist.
-- Sperrt die Zeile für die Dauer der Transaktion.
create function makroklar_private.lock_owned_dish(target_dish_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  owner_restaurant uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'Sign-in is required.';
  end if;
  select d.restaurant_id into owner_restaurant
    from public.dishes d
    join public.restaurant_members m on m.restaurant_id = d.restaurant_id
    where d.id = target_dish_id and m.user_id = auth.uid() and m.role = 'owner'
    for update of d;
  if owner_restaurant is null then
    raise exception using errcode = '42501', message = 'Dish access is required.';
  end if;
  return owner_restaurant;
end;
$$;
revoke all on function makroklar_private.lock_owned_dish(uuid) from public, anon, authenticated, service_role;

-- 1. Import prüfen: Rezept (Zutaten und Mengen) bestätigen oder Bestätigung zurücknehmen
create function public.set_dish_recipe_confirmed(target_dish_id uuid, confirmed boolean)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  result timestamptz;
begin
  perform makroklar_private.lock_owned_dish(target_dish_id);
  if confirmed and not exists (select 1 from public.dish_ingredients i where i.dish_id = target_dish_id) then
    raise exception using errcode = '22023', message = 'A recipe without ingredients cannot be confirmed.';
  end if;
  update public.dishes
    set recipe_confirmed_at = case when confirmed then now() end,
        recipe_confirmed_by = case when confirmed then auth.uid() end
    where id = target_dish_id
    returning recipe_confirmed_at into result;
  return result;
end;
$$;

-- 2. LMIV-Freigabe: Allergene und Zusatzstoffe speichern, optional bestätigen.
-- Ohne Bestätigung wird eine frühere Bestätigung und damit auch die Veröffentlichung aufgehoben.
create function public.save_dish_allergens(
  target_dish_id uuid, allergen_codes text[], additive_codes text[], confirm boolean
)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  result timestamptz;
begin
  perform makroklar_private.lock_owned_dish(target_dish_id);
  update public.dishes
    set allergens = (select coalesce(array_agg(distinct code order by code), '{}') from unnest(allergen_codes) code),
        additives = (select coalesce(array_agg(distinct code order by code), '{}') from unnest(additive_codes) code),
        allergens_confirmed_at = case when confirm then now() end,
        allergens_confirmed_by = case when confirm then auth.uid() end,
        published_at = case when confirm then published_at end,
        published_by = case when confirm then published_by end
    where id = target_dish_id
    returning allergens_confirmed_at into result;
  return result;
end;
$$;

-- 3. Speisekarte: veröffentlichen nur mit vollständigen Nährwerten und bestätigten Allergenen
create function public.set_dish_published(target_dish_id uuid, published boolean)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  result timestamptz;
begin
  perform makroklar_private.lock_owned_dish(target_dish_id);
  if published then
    if not exists (select 1 from public.dishes d where d.id = target_dish_id and d.allergens_confirmed_at is not null) then
      raise exception using errcode = '22023', message = 'Allergens must be confirmed before publishing.';
    end if;
    if exists (select 1 from public.get_dish_nutrition(target_dish_id) n where n.status <> 'complete')
      or not exists (select 1 from public.get_dish_nutrition(target_dish_id)) then
      raise exception using errcode = '22023', message = 'Nutrition must be complete before publishing.';
    end if;
  end if;
  update public.dishes
    set published_at = case when published then coalesce(published_at, now()) end,
        published_by = case when published then coalesce(published_by, auth.uid()) end
    where id = target_dish_id
    returning published_at into result;
  return result;
end;
$$;

-- 4. Gericht-Editor: Kategorie, Zubereitungszeit, Gewicht nach dem Kochen (NULL = leeren)
create function public.save_dish_details(
  target_dish_id uuid, dish_category text, dish_prep_minutes integer, dish_cooked_weight_g numeric
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform makroklar_private.lock_owned_dish(target_dish_id);
  update public.dishes
    set category = dish_category,
        prep_minutes = dish_prep_minutes,
        cooked_weight_g = dish_cooked_weight_g
    where id = target_dish_id;
end;
$$;

-- 5. Rezept geändert: Bestätigungen und Veröffentlichung aufheben, Allergen-Auswahl bleibt als Vorschlag.
-- Wird vom Dashboard nach dem Speichern aufgerufen, wenn sich Zutaten oder Mengen wirklich geändert haben.
create function public.reset_dish_confirmations(target_dish_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform makroklar_private.lock_owned_dish(target_dish_id);
  update public.dishes
    set recipe_confirmed_at = null, recipe_confirmed_by = null,
        allergens_confirmed_at = null, allergens_confirmed_by = null,
        published_at = null, published_by = null
    where id = target_dish_id;
end;
$$;

revoke all on function public.reset_dish_confirmations(uuid) from public, anon, service_role;
grant execute on function public.reset_dish_confirmations(uuid) to authenticated;
revoke all on function public.set_dish_recipe_confirmed(uuid, boolean) from public, anon, service_role;
revoke all on function public.save_dish_allergens(uuid, text[], text[], boolean) from public, anon, service_role;
revoke all on function public.set_dish_published(uuid, boolean) from public, anon, service_role;
revoke all on function public.save_dish_details(uuid, text, integer, numeric) from public, anon, service_role;
grant execute on function public.set_dish_recipe_confirmed(uuid, boolean) to authenticated;
grant execute on function public.save_dish_allergens(uuid, text[], text[], boolean) to authenticated;
grant execute on function public.set_dish_published(uuid, boolean) to authenticated;
grant execute on function public.save_dish_details(uuid, text, integer, numeric) to authenticated;

commit;
