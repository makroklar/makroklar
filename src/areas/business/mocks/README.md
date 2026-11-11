# Lightspeed item fixtures

`lightspeed-items.json` contains 70 local examples of the documented K-Series
`items-apiItemDTO`. Its outer array is our fixture collection, not a confirmed
Get All Items API response. The published OpenAPI currently describes that
endpoint's `200 application/json` as a single item object.

Official references (checked 2026-11-03):
- https://api-docs.lsk.lightspeed.app/operation/operation-items-apigetitems
- https://api-docs.lsk.lightspeed.app/source.json

IDs and SKUs are fixed demo values. Accounting groups are consistent. Each item
has one `AMOUNT` price named `Standard`. EUR is a display assumption for this
German restaurant fixture; the documented item DTO has no currency field.

The UI calls `getItems()` in `data/lightspeedItems.ts`. Replace only its local
JSON source with a backend request once the real collection response is verified;
keep `mapLightspeedItem()` and the internal UI model at that boundary.
Multiple prices are retained without automatically selecting one.

Reviewed selections are saved by `data/saveMenuAction.ts`, using the atomic
`import_lightspeed_items` RPC under the signed-in owner's RLS. The restaurant is
resolved on the server; accounts with zero or multiple owned restaurants cannot
save until setup or restaurant selection is resolved. Reimporting updates the
same source identities. Unselected, previously saved items are not deleted.

`data/savedMenu.ts` reads the saved items in `BusinessLayout` and initializes
`BusinessDraftProvider` before its children render, including on a full reload.
Business pages use `useBusinessDraft()` across client-side navigation. The
context only knows the internal `ImportedMenuItem` model. It does not import
the JSON fixture, the Supabase client, or the Lightspeed DTO. Its account and
restaurant key prevents one account's draft from being reused by another.

Unaccepted edits remain local to the preview. Returning to it restores accepted
names, prices, and selections; loading the catalog adds the other example items
without replacing the accepted values. Reloading restores saved selections from
Supabase; unaccepted edits are lost. `resetDraft()` only clears client state and
never deletes saved database rows. Names, all price options and the explicit
price choice are validated at the server boundary in `data/menuStorageModel.ts`.
The current fixture's EUR assumption is stored explicitly. Source IDs are
converted between safe internal numbers and database strings at this boundary.

Only a confirmed save opens `/business/onboarding/menu/pos/complete`. During the
request, editing and resubmission are disabled. Failures keep the review and show
retry feedback, without accepting the selection or navigating. A failed read is
displayed as an error rather than treated as an empty menu.
That view deliberately retains the Figma prototype's connection-success copy;
there is no real Lightspeed connection or background import. It returns to POS
selection when a successfully loaded menu is empty. Its next-stage link opens
`/business/onboarding/purchases` to begin collecting ingredients. The current
increment shows a food table with a primary-green text link underneath it.
The link opens `/business/onboarding/purchases/manual`, where the form is ready
to fill in. The nutrition table explicitly uses 100 g / 100 ml; all four macros,
preparation state and label/supplier provenance are required. An unchecked
acknowledgement sits above `Hinzufügen` and is required by validation as well
as the button state. Successful addition returns to purchases via client-side
navigation; the shared Context supplies the added table row, marked `manuell`.
Cancel/Zurück return without adding. The existing header keeps this route on
step 2 and links back to purchases. Both routes require a signed-in account.
German decimal commas are accepted; absent values never become zero. Liquids
retain their volume basis without an implicit conversion into grams.

New manual entries and their notice version stay in `BusinessDraftProvider`
until final initialization. Unsubmitted input stays local to the manual form.
The prepared final-save RPC validates these fields again and records the notice
version, authenticated owner and server time. The client draft alone is not an
audit record. Reload/logout discards unsaved changes; saved state is restored.
Name searches now read the active BLS dataset through the authenticated Supabase
client in `data/searchFoodsAction.ts`. Results are capped at 20, ordered by German
name/code, and retain their dataset ID and BLS code. Barcodes (EAN-8/13, UPC-A,
GTIN-14 with checksum) query Open Food Facts v3.6 on the server. Neither search
writes to a database. `offProducts.ts` first reads previously confirmed OFF
snapshots under the owner's RLS. A snapshot younger than 30 days is reused;
otherwise OFF is queried. Name search currently covers BLS,
not branded OFF products; use a barcode for those.

`FoodSearch` searches BLS automatically after 500ms without typing, starting at
three letters. Numeric/barcode input never triggers automatic OFF requests;
Suchen/Enter explicitly submits names or barcodes and cancels the pending timer.
`state/foodSearch.ts` ignores superseded responses, shares in-flight requests for
the same normalized query, and clears results when the input changes. Typing
remains enabled during requests. IME composition waits until text is committed.
Successful searches are remembered for five minutes in memory while mounted;
errors are not cached. Leaving the view clears its timer/cache and late replies
cannot update it. Adding a result still requires Hinzufügen. Selected
catalog items share the account-scoped Context with manual entries, survive
client navigation; unsaved changes disappear on reload/logout. Source IDs prevent duplicate
selection. Removing a row affects only this draft. Server calls recheck Auth.
OFF requests use a fixed host, identifying User-Agent, timeout and no automatic
retry. A conservative 12/minute per-process limit is a development safeguard,
not distributed rate limiting; revisit it before scaling to multiple instances.

`foodSearchModel.ts` maps BLS numeric values and OFF's normalized
`nutrition.aggregated_set`. It preserves 100g/100ml without mass/volume conversion.
Missing, qualified, estimated, computed-only or wrong-unit values remain null.
Available carbohydrate is never substituted with US total carbohydrate.
Incomplete results can be added and are marked `Nährwerte unvollständig` in both
search results and the selected list. Missing values remain null, including when
the package has no nutrition table. Collection does not establish suitability for
recipe calculation: the calculator distinguishes unknown from zero and
does not present an incomplete total as complete. No automatic BLS substitution
is made. OFF source links are shown; selected rows keep
their source and fetch timestamp. No guest-facing nutrition calculation is added.

Official references, checked 2026-11-11:
- https://openfoodfacts.github.io/openfoodfacts-server/api/
- https://openfoodfacts.github.io/documentation/docs/Product-Opener/v3/products/get-api-v3-product-code/
- https://openfoodfacts.github.io/openfoodfacts-server/api/ref-barcode-normalization/

Purchases is
optional: Weiter always navigates to `/business/onboarding/dishes`, even with no
selected foods. This protected route displays the accepted/restored menu items
from the existing Context. Step 3 is labelled `Gerichte vervollständigen`.
Selecting an item opens its name, accounting group, SKU, explicitly selected price
and recipe editor; one detail panel is open at a time. Selection uses source + source
ID, so duplicate names cannot open the wrong item. A missing price stays unset;
no alternative is picked. An empty list links to menu import, while load errors
offer a server refresh and never masquerade as an empty menu. No fixtures are
imported directly by the page. The open panel is Context state, not a DB write,
and survives navigating back to purchases to add more ingredients.

`NewDishForm` adds a draft with a stable client UUID and an optional price.
`RecipeEditor` assigns selected foods and amounts for one plated portion.
There is no servings field; the final Server Action fixes `servings` to 1.
The database retains support for multi-portion recipes for future use.
A 100g food requires g; a 100ml food requires ml. An
unknown basis requires an explicit unit but remains nutritionally incomplete.
There is no implicit density, cooking-yield or mass/volume conversion.

`FinishOnboarding` validates the draft and calls `finishOnboardingAction.ts`.
The server resolves the owner, verifies OFF data independently of client values,
and calls one atomic `save_restaurant_onboarding` RPC. BLS calculations always
read the pinned BLS dataset. Missing macro values stay null, never partial totals.
Empty/incomplete recipes are classified as drafts in the stored summary; no
allergen or publication workflow is implemented. Processing UI acknowledges
actual validation/save results, without timed fake intermediate successes.
`Import jetzt prüfen` returns to the editor; `Zum Dashboard` targets the existing
placeholder dashboard. Calculation results are stored in the completion summary
and available through `get_dish_nutrition`; a dish-level results UI is not added yet.

The prepared migration is `20261111000100_complete_business_onboarding.sql`.
It is **not applied yet**: until application, final save reports that storage
is not configured. After application, `readOnboarding.ts` restores saved foods,
custom dishes and recipes in `BusinessLayout`. A failed read blocks final save;
refreshing server data never replaces dirty drafts. Version checks reject stale
saves; retrying the same request is idempotent. No localStorage is used.

OFF query results also have a bounded, per-process five-minute memory cache;
server-verified results can be reused for final save for 30 minutes. Only final
initialization writes confirmed products durably. Persistent snapshots belong
to each restaurant, not a public cross-tenant cache; search never updates them.
Changing the 30-day freshness policy is localized to `offProducts.ts`.

Run the fixture/adapter tests from the repository root:
`node --test src/areas/business/data/lightspeedItems.test.mjs`

Draft merge/restore tests:
`node --test src/areas/business/state/businessDraft.test.mjs`

Storage validation, tenant resolution, RPC and restoration tests (mocked SDK):
`node --test src/areas/business/data/menuStorage.test.mjs`

Manual ingredient field validation:
`node --test src/areas/business/data/manualFood.test.mjs`

Food search mapping, identity, read-only authenticated queries and OFF failures:
`node --test src/areas/business/data/foodSearch.test.mjs`

Automatic search timing, stale responses, request deduplication and cache expiry:
`node --test src/areas/business/state/foodSearch.test.mjs`

Recipe validation, final-save boundary and restoration (mocked SDK):
`node --test src/areas/business/data/onboarding.test.mjs`
