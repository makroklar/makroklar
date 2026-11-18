export interface ImportedItemPrice {
  name: string;
  amount: number;
}

export interface ImportedMenuItem {
  source: 'lightspeed-k-series';
  sourceId: number;
  sku: string;
  name: string;
  accountingGroup: { sourceId: number | null; name: string | null } | null;
  prices: ImportedItemPrice[];
  selectedPriceIndex: number | null;
}
