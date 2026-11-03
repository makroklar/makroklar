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

Accepted items live in `BusinessDraftProvider`, mounted in `BusinessLayout`.
Business pages can access them through `useBusinessDraft()` across client-side
navigation. The context only knows the internal `ImportedMenuItem` model; it does
not import the JSON fixture, its reader, or the Lightspeed DTO.

Unaccepted edits remain local to the preview. Returning to it restores accepted
names, prices, and selections; loading the catalog adds the other example items
without replacing the accepted values. Reloading the page resets the context.
There is no persistence. `resetDraft()` is available to explicitly clear the draft.

Accepting the reviewed selection opens `/business/onboarding/menu/pos/complete`.
That view deliberately retains the Figma prototype's connection-success copy;
there is no real Lightspeed connection or background import. It returns to POS
selection when the in-memory draft is empty. The next-stage button remains
disabled until the purchases screen is implemented.

Run the fixture/adapter tests from the repository root:
`node --test src/areas/business/data/lightspeedItems.test.mjs`

Draft merge/restore tests:
`node --test src/areas/business/state/businessDraft.test.mjs`
