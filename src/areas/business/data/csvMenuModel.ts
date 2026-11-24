import { newDishSchema } from './recipeDraft';
import type { CustomDishDraft } from '../types/recipe';

export const CSV_MAX_BYTES = 1024 * 1024;
export const CSV_MAX_ROWS = 500;
export const CSV_MAX_COLUMNS = 20;
export const MENU_MAX_CUSTOM_DISHES = 1000;
export const CSV_TEMPLATE = '\uFEFFName;Preis\r\nPizza Margherita;9,50\r\nGemischter Salat;\r\n';

export interface CsvMenuTable {
  headers: string[];
  records: string[][];
}

export interface CsvMenuMapping {
  nameColumn: number | null;
  priceColumn: number | null;
}

export interface CsvMenuRow {
  id: string;
  recordNumber: number;
  name: string;
  price: string;
  selected: boolean;
}

export function validateCsvFile(file: { name: string; size: number }): void {
  if (!file.name.toLowerCase().endsWith('.csv')) throw new Error('Bitte eine CSV-Datei auswählen. PDF und Excel-Dateien werden hier noch nicht unterstützt.');
  if (file.size > CSV_MAX_BYTES) throw new Error('Die Datei ist zu groß. Erlaubt sind maximal 1 MB.');
  if (file.size === 0) throw new Error('Die Datei ist leer. Bitte nutze eine CSV mit Spaltennamen und Gerichten.');
}

export function createCsvTable(cells: string[][]): CsvMenuTable {
  const [header, ...records] = cells;
  if (!header || records.length === 0) throw new Error('Keine Gerichte gefunden. Die erste Zeile muss Spaltennamen enthalten, danach folgen die Gerichte.');
  if (records.length > CSV_MAX_ROWS) throw new Error('Bitte höchstens 500 Gerichte pro Datei importieren. Es wurde nichts übernommen.');
  if (header.length > CSV_MAX_COLUMNS) throw new Error('Bitte eine CSV mit höchstens 20 Spalten verwenden.');
  if (header.every(cell => cell.trim() === '')) throw new Error('Die Spaltennamen in der ersten Zeile fehlen.');
  const mismatch = records.findIndex(row => row.length !== header.length);
  if (mismatch !== -1) throw new Error(`Datensatz ${mismatch + 1} hat eine andere Spaltenanzahl als die Kopfzeile. Bitte Trennzeichen prüfen und Werte mit enthaltenen Trennzeichen in Anführungszeichen setzen.`);
  return { headers: header.map(cell => cell.trim()), records };
}

const normalizedName = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-DE');

export function suggestCsvMapping(headers: readonly string[]): CsvMenuMapping {
  const uniqueMatch = (aliases: string[]) => {
    const indices = headers.flatMap((name, index) => aliases.includes(normalizedName(name)) ? [index] : []);
    return indices.length === 1 ? indices[0] : null;
  };
  return {
    nameColumn: uniqueMatch(['name', 'gericht', 'name des gerichts', 'artikel', 'artikelname', 'bezeichnung']),
    priceColumn: uniqueMatch(['preis', 'preis (€)', 'preis in €', 'verkaufspreis', 'price']),
  };
}

export function createCsvPreview(table: CsvMenuTable, mapping: CsvMenuMapping, newId: () => string): CsvMenuRow[] {
  const validColumn = (index: number | null) => index !== null && Number.isInteger(index) && index >= 0 && index < table.headers.length;
  if (!validColumn(mapping.nameColumn)) throw new Error('Bitte die Spalte für den Gerichtnamen auswählen.');
  if (mapping.priceColumn !== null && (!validColumn(mapping.priceColumn) || mapping.priceColumn === mapping.nameColumn)) {
    throw new Error('Name und Preis müssen unterschiedliche Spalten verwenden.');
  }
  return table.records.map((record, index) => ({
    id: newId(), recordNumber: index + 1, selected: true,
    name: record[mapping.nameColumn!].trim(),
    price: mapping.priceColumn === null ? '' : record[mapping.priceColumn].trim(),
  }));
}

export function csvRowErrors(row: Pick<CsvMenuRow, 'name' | 'price'>): { name?: string; price?: string } {
  const parsed = newDishSchema.safeParse(row);
  if (parsed.success) return {};
  const errors: { name?: string; price?: string } = {};
  for (const issue of parsed.error.issues) {
    if (issue.path[0] === 'name') errors.name = 'Name erforderlich, maximal 200 Zeichen.';
    if (issue.path[0] === 'price') errors.price = 'Preis von 0 bis 999999 mit maximal zwei Nachkommastellen, z. B. 9,50. Oder leer lassen.';
  }
  return errors;
}

// Name matches are warnings, never identity: equal names may be different dishes.
export function duplicateCsvRowIds(rows: readonly CsvMenuRow[], existingNames: readonly string[]): Set<string> {
  const existing = new Set(existingNames.map(normalizedName));
  const counts = new Map<string, number>();
  for (const row of rows.filter(row => row.selected)) {
    const name = normalizedName(row.name);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return new Set(rows.filter(row => row.selected && normalizedName(row.name) !== '' &&
    (existing.has(normalizedName(row.name)) || (counts.get(normalizedName(row.name)) ?? 0) > 1)).map(row => row.id));
}

export function acceptCsvPreview(rows: readonly CsvMenuRow[], existingNames: readonly string[], existingCount: number,
  allowDuplicates: boolean): CustomDishDraft[] {
  const selected = rows.filter(row => row.selected);
  if (selected.length === 0) throw new Error('Bitte mindestens ein Gericht auswählen.');
  if (rows.length > CSV_MAX_ROWS || existingCount + selected.length > MENU_MAX_CUSTOM_DISHES) {
    throw new Error('Die Auswahl überschreitet die Grenze von 500 Gerichten pro Datei oder 1000 manuell erstellten/importierten Gerichten insgesamt.');
  }
  if (!allowDuplicates && duplicateCsvRowIds(rows, existingNames).size > 0) throw new Error('Bitte gleichnamige Gerichte prüfen und ihre Übernahme ausdrücklich bestätigen.');
  return selected.map(row => {
    const parsed = newDishSchema.safeParse(row);
    if (!parsed.success) throw new Error(`Bitte Name und Preis in Datensatz ${row.recordNumber} korrigieren oder den Datensatz abwählen.`);
    return { id: row.id, ...parsed.data };
  });
}
