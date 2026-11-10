import { z } from 'zod';
import type { ImportedMenuItem } from '../types/importedMenuItem';

const label = z.string().trim().min(1);
const sourceId = z.number().refine(Number.isSafeInteger);
const price = z.strictObject({
  name: label,
  amount: z.number().nonnegative().refine(value =>
    Number.isSafeInteger(Math.round(value * 100)) && Number(value.toFixed(2)) === value,
  ),
});
const prices = z.array(price).min(1);
const selectedItem = z.strictObject({
  source: z.literal('lightspeed-k-series'),
  sourceId,
  sku: label,
  name: label,
  accountingGroup: z.strictObject({ sourceId: sourceId.nullable(), name: label.nullable() }).nullable(),
  prices,
  selectedPriceIndex: z.number().int().nonnegative(),
}).refine(item => item.selectedPriceIndex < item.prices.length);

export const acceptedMenuItemsSchema = z.array(selectedItem).min(1).refine(items =>
  new Set(items.map(item => item.sourceId)).size === items.length,
);

export function toImportPayload(items: z.infer<typeof acceptedMenuItemsSchema>) {
  return items.map(item => ({
    source_id: String(item.sourceId),
    name: item.name,
    sku: item.sku,
    accounting_group_source_id: item.accountingGroup?.sourceId == null ? null : String(item.accountingGroup.sourceId),
    accounting_group_name: item.accountingGroup?.name ?? null,
    prices: item.prices.map(option => ({ ...option })),
    selected_price_index: item.selectedPriceIndex,
    currency: 'EUR',
  }));
}

function readSourceId(value: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || String(number) !== value) {
    throw new Error('Unsupported stored source identity.');
  }
  return number;
}

const details = z.object({
  dish_id: z.uuid(),
  restaurant_id: z.uuid(),
  sku: label,
  accounting_group_source_id: z.string().nullable(),
  accounting_group_name: label.nullable(),
  prices,
  selected_price_index: z.number().int().nonnegative(),
  currency: z.literal('EUR'),
});
const storedDish = z.object({
  id: z.uuid(),
  restaurant_id: z.uuid(),
  source: z.literal('lightspeed-k-series'),
  source_id: z.string(),
  name: label,
  // Composite-FK introspection may expose a reverse relation as an array.
  dish_import_details: z.union([details, z.array(details).length(1).transform(rows => rows[0])]),
});

export function fromStoredDish(value: unknown, restaurantId: string): ImportedMenuItem {
  const dish = storedDish.parse(value);
  const metadata = dish.dish_import_details;
  if (dish.restaurant_id !== restaurantId || metadata.restaurant_id !== restaurantId
      || metadata.dish_id !== dish.id || metadata.selected_price_index >= metadata.prices.length) {
    throw new Error('Inconsistent stored menu item.');
  }
  return {
    source: dish.source,
    sourceId: readSourceId(dish.source_id),
    name: dish.name,
    sku: metadata.sku,
    accountingGroup: metadata.accounting_group_source_id === null && metadata.accounting_group_name === null
      ? null : {
        sourceId: metadata.accounting_group_source_id === null ? null : readSourceId(metadata.accounting_group_source_id),
        name: metadata.accounting_group_name,
      },
    prices: metadata.prices,
    selectedPriceIndex: metadata.selected_price_index,
  };
}
