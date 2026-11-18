import type { ImportedMenuItem } from '../types/importedMenuItem';

export function getImportedItemKey(item: ImportedMenuItem): string {
  return `${item.source}:${item.sourceId}`;
}

export function mergeImportedItems(
  current: readonly ImportedMenuItem[],
  incoming: readonly ImportedMenuItem[],
): ImportedMenuItem[] {
  const bySourceId = new Map(
    current.map((item) => [getImportedItemKey(item), item]),
  );
  incoming.forEach((item) => {
    bySourceId.set(getImportedItemKey(item), {
      ...item,
      accountingGroup: item.accountingGroup ? { ...item.accountingGroup } : null,
      prices: item.prices.map((price) => ({ ...price })),
    });
  });
  return [...bySourceId.values()];
}
