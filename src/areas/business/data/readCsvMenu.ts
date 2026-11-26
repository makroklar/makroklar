import Papa from 'papaparse';
import { createCsvTable, CSV_MAX_BYTES, CSV_MAX_ROWS, validateCsvFile, type CsvMenuTable } from './csvMenuModel';

export type CsvDelimiter = '' | ';' | ',';

export function parseCsvMenu(text: string, delimiter: CsvDelimiter = ''): CsvMenuTable {
  if (new TextEncoder().encode(text).length > CSV_MAX_BYTES) throw new Error('Die Datei ist zu groß. Erlaubt sind maximal 1 MB.');
  if (text.includes('\0')) throw new Error('Die Datei enthält ungültige Zeichen. Bitte als CSV UTF-8 exportieren.');
  const parsed = Papa.parse<string[]>(text, {
    delimiter, delimitersToGuess: [';', ','], header: false, dynamicTyping: false,
    skipEmptyLines: 'greedy', preview: CSV_MAX_ROWS + 2,
  });
  // Single-column name lists have no delimiter to detect and are valid.
  const onlyOneColumn = parsed.data.every(row => row.length === 1);
  if (parsed.errors.some(error => error.code !== 'UndetectableDelimiter' || !onlyOneColumn)) {
    throw new Error('Die CSV konnte nicht eindeutig gelesen werden. Bitte Trennzeichen und Anführungszeichen prüfen.');
  }
  if (parsed.meta.truncated || parsed.data.length > CSV_MAX_ROWS + 1) {
    throw new Error('Bitte höchstens 500 Gerichte pro Datei importieren. Es wurde nichts übernommen.');
  }
  return createCsvTable(parsed.data);
}

export async function readCsvMenu(file: File): Promise<string> {
  validateCsvFile(file);
  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw new Error('Die Zeichenkodierung ist nicht UTF-8. Bitte die Datei in Excel oder LibreOffice als CSV UTF-8 exportieren.');
  }
}
