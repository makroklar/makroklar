export interface CatalogFood {
  id: string;
  name: string;
  source: { kind: 'bls'; datasetId: string; code: string; version: string }
    | { kind: 'off'; barcode: string; fetchedAt: string; modifiedAt: number | null };
  detail: string;
  basis: '100g' | '100ml' | null;
  preparation: 'as_sold' | 'prepared' | null;
  energyKcal: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbohydrateG: number | null;
}

export type FoodSearchResult =
  | { status: 'success'; foods: CatalogFood[]; hasMore: boolean }
  | { status: 'error'; message: string };
