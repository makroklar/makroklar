# Restaurant demo pilot

Development recipes, not approved for guest publication. This first batch contains
three **additional** dishes per approved restaurant. It was first validated on
`Dönerladen`, then approved for `PizzaLaden` and `test-max`. Existing dishes are not
replaced. Any other restaurant is blocked by an explicit target guard.

| Approved restaurant | `--restaurant-id` |
| --- | --- |
| Dönerladen | `349b07ad-d552-4c0a-b2ff-8a6ca1ff8d00` |
| PizzaLaden | `52bddc5a-2efc-4915-853f-b665dffaef2c` |
| test-max | `55727717-68c6-404e-a0a7-7db1b1653f41` |

Choose one target explicitly per run. The manifest's restaurant fields record the
original pilot account; runtime authorization and name checks use the allowlist
in the tool. Dish client UUIDs are unique per restaurant in the existing schema:
each account receives separate database dish/ingredient rows and recipe links.
Editing one restaurant's copy does not edit another's. Existing ingredients are
reused within that restaurant, preserving its accepted nutrient values.

## Data and calculations

`restaurant-demo-pilot.json` stores stable client UUIDs, source identities and
quantities for one plated portion. It contains **no hardcoded nutrient totals**.
Eleven BLS ingredients are resolved from the installed, pinned BLS 4.0 dataset.
The strawberry Skyr comes from the existing provider-only Open Food Facts cache
(barcode `4337185761577`); it must still be fresh. No OFF request or shared-cache
write is made by this seed. An existing accepted ingredient snapshot takes
precedence and is not overwritten by a newer catalog value.

Chicken/rice amounts refer to cooked weights and the matching cooked BLS foods.
Vegetables are raw, banana is peeled, oats are dry. Oil is the measured dressing
that is eaten, not an assumed amount absorbed during frying. Per-dish notes record
these assumptions. The recipes are realistic test compositions, not a claim of
laboratory accuracy, verified allergens or publication approval.

The tool loads the restaurant's full current payload, adds three manual dishes and
their recipes, and calls the existing `save_restaurant_onboarding` RPC under the
owner's database role/identity. PostgreSQL calculates the four metrics through
`get_dish_nutrition`; it also refreshes the summary used by the Dashboard. Normal
save version/audit fields change. The existing ingredient/recipe values are checked
for preservation, and full row fingerprints of the other restaurants must match.
No Auth account, login session, schema, library or package configuration is added.

`Demo ·` labels and stable UUIDs identify these test dishes. The current schema has
no publication flag; the dashboard branch currently treats complete nutrition as
menu-ready. These fixtures must stay in the development project. Images were
explicitly deferred until the Dashboard's photo storage/read contract is ready.

## Usage

Run from the repository root with the existing Node version and dependencies.
Connection settings use `.env.local`, the linked development project and verified
TLS, like the BLS importer. Never commit or print database credentials.

Default mode runs the actual save, duplicate-request and dynamic-calculation
checks inside a transaction, then **rolls everything back**:

```powershell
node src/shared/supabase/seeds/seed-restaurant-demo.mjs --restaurant-id 349b07ad-d552-4c0a-b2ff-8a6ca1ff8d00
```

After reviewing its result, apply to the approved restaurant:

```powershell
node src/shared/supabase/seeds/seed-restaurant-demo.mjs --restaurant-id 349b07ad-d552-4c0a-b2ff-8a6ca1ff8d00 --apply
```

The dynamic checks temporarily double the chicken quantity, add oats and remove
the chicken from the first dish. Each variation uses the application's SQL save
path and is rolled back to a savepoint; only the original three recipes can be
committed. Both direct nutrition and the saved/restored summary are checked against
an independent ingredient calculation. Existing data failures abort the batch.

Re-running an existing pilot returns `already_present` without saving or resetting
owner edits. A partly missing pilot stops for review. There is no automatic cleanup,
upsert of edited recipes, or copying into accounts outside the approved list.

Unit tests:

```powershell
node --test src/shared/supabase/seeds/restaurant-demo.test.mjs
```

After applying, reload `/business/onboarding/dishes` and search for `Demo`.
In the dashboard branch, the same dishes are available through its existing
onboarding reader. Change a quantity and save to recalculate; live preview before
saving depends on the UI and is not added by this seed. Until the separate dashboard
delete-all-ingredients issue is fixed, remove individual ingredients while leaving
at least one, or use the onboarding editor which sends an explicit empty recipe.
