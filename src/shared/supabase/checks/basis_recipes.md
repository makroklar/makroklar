# Basis recipes: foundation review

Status: tested on isolated PostgreSQL 17.12 on 2026-11-24, not applied to Supabase.
The foundation migration adds only the three
tables in `20261124000200_create_basis_recipes.sql`, indexes, grants and read RLS.
It does not modify existing data, RPCs, generated types, onboarding or Dashboard.
The numbering leaves `20261124000100` to the photo-bucket migration on Dashboard;
that migration is not a dependency of this one.

The next prepared migration, `20261124000300_add_basis_nutrition.sql`, adds read-time
nutrition calculations. It remains unapplied to Supabase. It introduces a private common
food contribution function, `get_basis_recipe_nutrition`, and extends the existing
`get_dish_nutrition` without changing its output columns/statuses. Direct dish food
lines and basis lines use the same BLS/OFF/manual validation. No UI/generated types
or save/read onboarding contract has been changed in this calculation batch.

Basis results contain batch totals and `per_100`, with `output_unit` distinguishing
100g from 100ml. A missing measured yield yields `incomplete`, and an empty basis
yields `empty_recipe`. A dish using either is incomplete. Each nutrient is assessed
independently; known numeric zero remains zero, missing values are never zero-filled.
Each basis counts as one dish input; its issues include nested ingredient details.
Dish contribution = basis batch total * quantity used / measured batch output.
No intermediate rounding or automatic g/ml conversion is used. The model assumes
the included nutrient amounts remain in the measured output; it does not invent
cooking-retention factors or subtract unmeasured discarded oil/liquid.

Changing the source quantities/yield changes these RPC read results immediately.
The calculation migration alone does **not refresh the stored Dashboard summary**.
The prepared v2 save migration described below handles that refresh atomically.
Application writes directly to the basis tables remain closed.

## Prepared v2 save/read contract

`20261124000400_save_basis_onboarding.sql` is tested locally, not applied to Supabase. It adds:

- `save_restaurant_onboarding_v2(restaurant_id, payload, base_version, request_id)`
  using the same owner checks, lock order, optimistic version and retry semantics
  as v1. It persists foods, dishes, bases and their links in one transaction, then
  recalculates the stored summary for **every** stored dish (including omitted
  dishes affected by a basis edit). Food counts include retained referenced foods.
- `read_restaurant_onboarding_v2(restaurant_id)` returns the existing snapshot plus
  `schemaVersion: 2`, `basisRecipes` and `dishBases`, under the existing owner RLS.
  Base IDs in JSON are stable client UUIDs, not database row IDs.
- A guarded v1 save: still works for restaurants without bases, but returns SQLSTATE
  `55000` for basis-aware data/accounts. The old implementation moves into the
  private schema with client execution revoked. The guard holds the same locks as
  v2, so an old browser cannot race a new basis save and lose its relationships.

Payload additions (all required, no automatic fallback to v1):

```text
schemaVersion: 2
basisRecipes: [{ id, name, outputQuantity: decimal-string | null,
                 outputUnit: "g" | "ml", ingredients: [{ foodId, quantity, unit }] }]
dishBases: { "manual-<uuid>" | "lightspeed-k-series-<id>":
             [{ basisId, quantity: decimal-string, unit: "g" | "ml" }] }
deletedBasisIds: [client-uuid]
```

The TypeScript contract lives in `areas/business/data/basisOnboardingModel.ts`.
It validates a full client snapshot, keeps the original food/dish checks, rejects
nested/duplicate/lost references and incompatible units, and normalizes comma
decimals on a copy. Missing output is a draft. Basis foods remain in the restaurant
shopping catalog; bases are separate objects, not fabricated OFF/manual foods.

SQL preserves bases omitted from `basisRecipes` and dish links whose key is absent.
An explicit empty array clears a dish's links. Bases are removed only through
`deletedBasisIds`, with referenced deletion rejected before returning success.
Deletion conflicts (same base saved and deleted, duplicate/unknown deletion IDs)
are rejected. Food cleanup retains foods used by either direct or basis recipes.

The Context now has a dedicated basis reducer for add/edit/remove, dish links,
pending deletions and v2 snapshot hydration. Dirty basis state blocks background
snapshot replacement, including the matching onboarding version. Referenced bases
cannot be removed or change units until their links are explicitly cleared. Logout
clears local state without scheduling database deletions. New unsaved bases that
are removed do not create deletion requests; undo cancels a saved basis deletion.

The live reader still calls v1; its snapshot type also accepts v2 for the next
integration step. The Context supplies a temporary `onboardingError` when it has
basis/v2 state so the existing FinishOnboarding cannot silently save only v1 fields.
No new UI or persistence is enabled by this state batch. Navigation within the
mounted provider keeps drafts; unsaved changes still disappear on a full reload.

No Server Action, live read RPC, generated database types or Dashboard adapter has
switched to v2 yet. Before rollout, update **both** writers/readers and the error
message for `55000`. Reuse authoritative OFF verification and cache publication
after the confirmed save in `finishOnboardingAction`; never publish client values.
SQL checks passed in the isolated database described below. The feature is not
deployed, and frontend/Supabase-stack integration remains to be tested.

## Model

- `basis_recipes`: restaurant-owned reusable recipe, stable client UUID and name.
  `output_quantity` / `output_unit` describe the measured finished batch (g or ml),
  not servings. A missing quantity is a draft; there is no duplicated ready flag.
- `basis_recipe_ingredients`: links to that restaurant's Lebensmittel only,
  with positive decimal quantities and g/ml units. No nested bases or cycles.
- `dish_basis_recipes`: measured use of a basis alongside the existing direct
  food links in `dish_ingredients`. Its unit must equal the basis output unit.

Composite foreign keys enforce tenant isolation even when one owner owns two
restaurants. Duplicate food/basis lines are rejected; combine their quantities.
A referenced food or basis cannot be deleted without removing/replacing its uses.
Deleting a dish removes its links, not reusable bases. Deleting an entire restaurant
cascades its rows; deferred reference checks allow that transaction to finish.
Changing a used basis output unit requires explicit conversion and updated links;
this migration never converts mass to volume automatically.

Quantities are exact NUMERIC values, > 0 and <= 1,000,000, rejecting NaN/infinities.
NULL is allowed only for a draft's output quantity. No computed totals are stored.

## Deliberately staged access and integration

Authenticated owners can read only their own rows. They cannot insert, update or
delete these tables directly; anonymous access is denied. Trusted administration
has CRUD grants, but must not populate real basis-linked dishes before calculation
support exists. No client-facing write RPC is added in this foundation batch.

Before enabling the feature:

1. Review/run the prepared authoritative nutrient calculation for bases, scaled by measured output;
   include those contributions in `get_dish_nutrition`. Incomplete values/output
   must stay incomplete, never become zero. Ingredient unit compatibility with
   the BLS/OFF/manual nutrition basis belongs in that validation/calculation path;
   the foundation validates the unit enum and dish-to-basis unit FK only.
2. Review/test the prepared versioned save/read contract. Save food, base and dish changes
   atomically, and recalculate the Dashboard summary in the same transaction.
   Update food-removal logic to retain foods referenced by a basis. Protect recipe
   links from clients still using the old payload; omission must not mean deletion.
3. Preserve the existing optimistic version checks/locks and idempotent request
   behavior. Route Dashboard edits through the same path. No direct client writes
   that bypass summary refresh or version checks.
4. Add TypeScript schemas/state, restore behavior and the optional onboarding step.
   Update Dashboard `basis` reading/editing with Max. Its current `cookedWeight`
   UI assumes g; output should also cover cold dressings and measured ml. Never
   sum mixed g/ml input quantities as grams or assume all recipes lose weight.
5. Test old dish calculations, zero vs missing values, basis changes affecting
   multiple dishes, stale saves, rollback, old clients and tenant isolation.

## Checks

`basis_recipes.sql` is a rollback-only integration check following the existing
project pattern. Run as postgres **after** applying the foundation migration in
a disposable/local database containing the earlier project migrations. Enable
stop-on-error in the SQL runner. The check creates temporary users/restaurants,
uses real authenticated/anonymous roles and rolls back all its fixtures/helpers.

On 2026-11-24, all **13 migrations and 13 SQL check scripts passed** against a fresh
local PostgreSQL 17.12 database using `local-postgres.mjs`. This includes the three
basis checks plus the existing BLS, food, dish, nutrition, import, onboarding,
registration, ownership and shared-cache checks. All SQL fixtures rolled back.
The temporary server was stopped after testing. No shared Supabase data was used
or changed, and no package dependencies or system services were installed.

The portable EDB PostgreSQL Windows ZIP, extracted binaries, data cluster and
random local password are under the already ignored `.temp/basis-pg-test/`.
The instance listens only on `127.0.0.1:55439` and uses SCRAM authentication.
`local-postgres.mjs` never loads `.env`, accepts no external connection string,
verifies the data directory and PostgreSQL major version before writing, and
creates a fresh randomly named database for each run. It stops on the first error.
Test databases are retained locally for diagnosis; it never drops user databases.

The harness supplies minimal `auth.users`, `auth.uid()` and the Supabase database
roles, with real PostgreSQL RLS and privileges. It does not run GoTrue, PostgREST,
Storage or deployment defaults. It tests stale versions/retries sequentially;
it is not a concurrent-client load test or a browser test.

To rerun with the existing approved local runtime, start `postgres.exe` from
`.temp/basis-pg-test/pgsql/bin` with `-D <absolute path to .temp/basis-pg-test/data>
-h 127.0.0.1 -p 55439` (use a hidden process on Windows), then run from repo root:

```powershell
node src/shared/supabase/checks/local-postgres.mjs
```

Afterward stop that instance using `pg_ctl.exe stop -D <same data path> -m fast -w`.
The helper does not download software, start services or change application config.

For the v2 TypeScript model batch, its six tests plus the eleven existing onboarding
tests passed, and `tsc --noEmit --incremental false` passed. These checks do not
validate PL/pgSQL execution or database concurrency.

`basis_nutrition.sql` checks mixed BLS/OFF/manual inputs, measured output, direct
foods plus bases, bases reused in two dishes, dynamic quantity/yield/add/remove
changes, per-metric missing values, genuine zero, incompatible units, unresolved
references, old serving behavior and RPC isolation. It is rollback-only and
**passed locally**. Run it after both new migrations in a disposable/local
database, followed by the existing `dish_nutrition.sql` and `business_onboarding.sql`
checks. Nutrition scripts exercise calculation only, not stale-save handling or
Dashboard summary refresh.

`basis_onboarding.sql` exercises the prepared v1/v2 RPCs: snapshot restoration,
retry/conflict handling, old-client rejection, omitted-data preservation, updating
an omitted dish after a basis edit, supply retention, late-error rollback, explicit
unlink/delete and cross-tenant access. It is rollback-only and **passed locally**.
