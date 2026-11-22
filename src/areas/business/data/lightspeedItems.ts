import type {
  LightspeedItemDto,
  LightspeedItemFixtures,
} from '../types/lightspeed';
import type { ImportedMenuItem } from '../types/importedMenuItem';

export function mapLightspeedItem(item: LightspeedItemDto): ImportedMenuItem {
  if (typeof item.id !== 'number' || !Number.isSafeInteger(item.id)) {
    throw new Error('Ein Lightspeed-Artikel hat keine sicher lesbare ID.');
  }
  if (typeof item.name !== 'string' || item.name.trim() === '') {
    throw new Error(`Lightspeed-Artikel ${item.id}: Artikelname fehlt.`);
  }
  if (typeof item.sku !== 'string' || item.sku.trim() === '') {
    throw new Error(`Lightspeed-Artikel ${item.id}: SKU fehlt.`);
  }
  if ((item.priceMode ?? 'AMOUNT') !== 'AMOUNT') {
    throw new Error(
      `Lightspeed-Artikel ${item.id}: Dieser Prototyp unterstützt nur Festpreise (AMOUNT).`,
    );
  }

  const prices = (item.prices ?? []).map((price) => {
    if (
      typeof price.name !== 'string' ||
      typeof price.amount !== 'number' ||
      !Number.isFinite(price.amount) ||
      price.amount < 0
    ) {
      throw new Error(`Lightspeed-Artikel ${item.id}: Ungültiger Festpreis.`);
    }
    return { name: price.name, amount: price.amount };
  });

  return {
    source: 'lightspeed-k-series',
    sourceId: item.id,
    sku: item.sku,
    name: item.name,
    accountingGroup: item.accountingGroup
      ? {
          sourceId: item.accountingGroup.id ?? null,
          name: item.accountingGroup.name ?? null,
        }
      : null,
    prices,
    // Only a single price is unambiguous. Multiple prices require a UI choice.
    selectedPriceIndex: prices.length === 1 ? 0 : null,
  };
}

export async function getItems(): Promise<ImportedMenuItem[]> {
  // Source boundary: replace this local read with a backend request later.
  // First verify the real collection envelope; do not assume an API array.
  const { default: fixture } = await import('../mocks/lightspeed-items.json', {
    with: { type: 'json' },
  });
  const sourceItems = fixture as LightspeedItemFixtures;
  return sourceItems.map(mapLightspeedItem);
}
