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

The preview uses React state only. Provider changes, leaving the page, or a reload
can discard the draft and any temporarily accepted items. There is no persistence.

Run the fixture/adapter tests from the repository root:
`node --test src/areas/business/data/lightspeedItems.test.mjs`
