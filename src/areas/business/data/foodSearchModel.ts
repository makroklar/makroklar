import { z } from 'zod';
import type { CatalogFood } from '../types/catalogFood';

// Open Food Facts normalizes UPC codes to EAN; keep leading zeros as text.
export function normalizeBarcode(code: string): string {
  const digits = code.replace(/^0+/, '') || '0';
  return digits.padStart(digits.length <= 8 ? 8 : digits.length <= 13 ? 13 : digits.length, '0');
}

export function parseFoodQuery(input: unknown): { kind: 'name' | 'barcode'; value: string } {
  const value = z.string().trim().min(2).max(100).parse(input);
  const digits = value.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(digits)) return { kind: 'name', value };
  if (![8, 12, 13, 14].includes(digits.length)) throw new Error('Invalid barcode length');
  const sum = [...digits].reverse().reduce((total, digit, i) => total + Number(digit) * (i % 2 ? 3 : 1), 0);
  if (sum % 10 !== 0 || /^0+$/.test(digits)) throw new Error('Invalid barcode checksum');
  return { kind: 'barcode', value: normalizeBarcode(digits) };
}

export function literalNamePattern(name: string): string {
  // PostgREST also interprets * as an alias for SQL's % wildcard.
  return `%${name.replace(/[\\%_*]/g, character => `\\${character === '*' ? '%' : character}`)}%`;
}

export function hasCompleteCatalogNutrition(food: CatalogFood): boolean {
  return food.basis !== null && (food.source.kind === 'bls' || food.preparation !== null)
    && [food.energyKcal, food.proteinG, food.fatG, food.carbohydrateG]
      .every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0);
}

export function appendCatalogFood(current: readonly CatalogFood[], food: CatalogFood): CatalogFood[] {
  // Collecting a product is allowed before nutrition is complete; null must remain unknown.
  if (current.some(item => item.id === food.id)) return [...current];
  return [...current, { ...food, source: { ...food.source } }];
}

const nutrientSchema = z.object({
  value: z.number().finite().nonnegative().optional(),
  unit: z.string().optional(), modifier: z.string().optional(), source: z.string().optional(),
});
const offSchema = z.object({
  status: z.enum(['success', 'success_with_warnings']),
  product: z.object({
    code: z.string().regex(/^\d+$/), product_name: z.string().optional(),
    product_name_de: z.string().optional(), brands: z.string().optional(), quantity: z.string().optional(),
    last_modified_t: z.number().int().nonnegative().optional(),
    nutrition: z.object({ aggregated_set: z.object({
      per: z.string().optional(), preparation: z.string().optional(),
      nutrients: z.record(z.string(), z.unknown()).optional(),
    }).optional() }).optional(),
  }),
});

// API v3.6: use the normalized aggregate, never silently substitute computed/estimated values.
export function fromOpenFoodFacts(input: unknown, barcode: string, fetchedAt: string): CatalogFood {
  const { product } = offSchema.parse(input);
  if (normalizeBarcode(product.code) !== barcode) throw new Error('Mismatched barcode');
  const nutrition = product.nutrition?.aggregated_set;
  const basis = nutrition?.per === '100g' || nutrition?.per === '100ml' ? nutrition.per : null;
  const read = (key: string, unit: string) => {
    const parsed = nutrientSchema.safeParse(nutrition?.nutrients?.[key]);
    if (!basis || !parsed.success) return null;
    const nutrient = parsed.data;
    return nutrient.unit === unit && !nutrient.modifier && nutrient.source !== 'estimate'
      ? nutrient.value ?? null : null;
  };
  return {
    id: `off:${barcode}`, name: product.product_name_de?.trim() || product.product_name?.trim() || `Produkt ${barcode}`,
    source: { kind: 'off', barcode, fetchedAt, modifiedAt: product.last_modified_t ?? null },
    detail: [product.brands, product.quantity].filter(Boolean).join(' · '), basis,
    preparation: nutrition?.preparation === 'as_sold' || nutrition?.preparation === 'prepared' ? nutrition.preparation : null,
    energyKcal: read('energy-kcal', 'kcal'), proteinG: read('proteins', 'g'),
    fatG: read('fat', 'g'), carbohydrateG: read('carbohydrates', 'g'),
  };
}

export const blsNutrients = { energyKcal: ['ENERCC', 'kcal'], proteinG: ['PROT625', 'g'], fatG: ['FAT', 'g'], carbohydrateG: ['CHO', 'g'] } as const;

export function fromBls(
  food: { bls_code: string; name_de: string },
  dataset: { id: string; source_version: string },
  values: readonly { bls_code: string; nutrient_code: string; value: number | null; value_kind: string }[],
  definitions: readonly { code: string; unit: string }[],
): CatalogFood {
  const read = (key: keyof typeof blsNutrients) => {
    const [code, unit] = blsNutrients[key];
    const value = values.find(row => row.bls_code === food.bls_code && row.nutrient_code === code);
    return definitions.some(row => row.code === code && row.unit === unit) && value?.value_kind === 'numeric'
      && typeof value.value === 'number' && Number.isFinite(value.value) && value.value >= 0 ? value.value : null;
  };
  return {
    id: `bls:${dataset.id}:${food.bls_code}`, name: food.name_de,
    source: { kind: 'bls', datasetId: dataset.id, code: food.bls_code, version: dataset.source_version },
    detail: `BLS ${dataset.source_version} · ${food.bls_code}`, basis: '100g', preparation: null,
    energyKcal: read('energyKcal'), proteinG: read('proteinG'), fatG: read('fatG'), carbohydrateG: read('carbohydrateG'),
  };
}
