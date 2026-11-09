import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import ExcelJS from 'exceljs';

const units = new Set(['g', 'mg', 'µg', 'kJ', 'kcal']);
const markers = new Map([
  ['-', 'missing'], ['TR', 'trace'], ['<LOD', 'below_lod'],
  ['<LOQ', 'below_loq'], ['<LOD or <LOQ', 'below_lod_or_loq'],
]);

function text(value, label, optional = false) {
  if (value == null || value === '') {
    if (optional) return null;
    throw new Error(`${label}: required text is missing.`);
  }
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label}: expected non-blank text.`);
  }
  return value;
}

export function parseNutrientValue(raw, label = 'Nutrient value') {
  if (raw == null) return { value: null, raw_value: null, value_kind: 'missing' };
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
    // No rounding or nutritional calculation. Postgres receives a decimal string.
    return { value: String(raw), raw_value: String(raw), value_kind: 'numeric' };
  }
  if (markers.has(raw)) {
    return { value: null, raw_value: raw, value_kind: markers.get(raw) };
  }
  throw new Error(`${label}: unsupported value; refusing to guess or replace it with zero.`);
}

export function mapFoodHeaders(headers, definitions) {
  const first = ['BLS Code', 'Lebensmittelbezeichnung', 'Food name'];
  if (first.some((name, i) => headers[i] !== name)
      || headers.length !== 4 + definitions.length * 3 || headers.at(-1) !== 'Hinweis') {
    throw new Error('Unexpected BLS food column structure.');
  }
  const byCode = new Map(definitions.map((definition) => [definition.code, definition]));
  const seen = new Set();
  const columns = [];
  for (let column = 3; column < headers.length - 1; column += 3) {
    const code = headers[column]?.split(' ')[0];
    const definition = byCode.get(code);
    if (!definition || seen.has(code)
        || !headers[column].endsWith(`[${definition.unit}/100g]`)
        || headers[column + 1] !== `${code} Datenherkunft`
        || headers[column + 2] !== `${code} Referenz`) {
      throw new Error(`Invalid nutrient header or unit at column ${column + 1}.`);
    }
    seen.add(code);
    columns.push({ code, column });
  }
  return columns;
}

function rowValues(row) {
  return Array.from({ length: row.cellCount }, (_, i) => row.getCell(i + 1).value);
}

function blankRow(values) {
  return values.every((value) => value == null || (typeof value === 'string' && !value.trim()));
}

async function readDefinitions(path, expectedCount) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  if (workbook.worksheets.length !== 1) throw new Error('Expected one component worksheet.');
  const sheet = workbook.worksheets[0];
  const headers = [
    'Index', 'Nährstoffcode / Component code', 'Nährstoffbezeichnung', 'Component name',
    'Einheit / Unit', 'Nährstoffgruppe', 'Component group', 'Formeln / Formula',
    'Formelanwendung / Formula application',
  ];
  if (headers.some((header, i) => sheet.getRow(1).getCell(i + 1).value !== header)) {
    throw new Error('Unexpected component definition headers.');
  }
  const definitions = [];
  const codes = new Set();
  const indices = new Set();
  for (let number = 2; number <= sheet.rowCount; number++) {
    const row = rowValues(sheet.getRow(number));
    if (blankRow(row)) continue;
    const [index, code, de, en, unit, groupDe, groupEn, formula, application] = row;
    if (!Number.isInteger(index) || index <= 0 || indices.has(index)
        || typeof code !== 'string' || !/^[A-Z0-9:]+$/.test(code)
        || codes.has(code) || !units.has(unit)) {
      throw new Error(`Invalid or duplicate component definition at row ${number}.`);
    }
    indices.add(index); codes.add(code);
    definitions.push({
      code, sort_index: index, name_de: text(de, code), name_en: text(en, code), unit,
      group_de: text(groupDe, code), group_en: text(groupEn, code),
      formula: text(formula, code, true), formula_application: text(application, code, true),
    });
  }
  if (definitions.length !== expectedCount) throw new Error('Unexpected component count.');
  return definitions;
}

async function sha256(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

export async function openBlsSource(directory, manifestPath) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const roles = new Set(['data', 'components', 'documentation']);
  if (manifest.source !== 'bls' || !manifest.version || !Number.isInteger(manifest.releaseYear)
      || !Number.isInteger(manifest.foodCount) || manifest.foodCount <= 0
      || !Number.isInteger(manifest.nutrientCount) || manifest.nutrientCount <= 0
      || manifest.files?.length !== 3) throw new Error('Invalid BLS source manifest.');
  const paths = {};
  for (const file of manifest.files) {
    if (!roles.delete(file.role) || basename(file.name) !== file.name
        || !/^[0-9a-f]{64}$/.test(file.sha256)) throw new Error('Invalid manifest file entry.');
    paths[file.role] = resolve(directory, file.name);
  }
  const verifyFiles = async () => {
    await Promise.all(manifest.files.map(async (file) => {
      if (await sha256(paths[file.role]) !== file.sha256) {
        throw new Error(`Checksum mismatch: ${file.name}. Source files must match the reviewed release.`);
      }
    }));
  };
  await verifyFiles();
  const definitions = await readDefinitions(paths.components, manifest.nutrientCount);
  const identity = [manifest.source, manifest.version, manifest.releaseYear,
    ...manifest.files.map((file) => `${file.role}:${file.sha256}`).sort()];
  const contentHash = createHash('sha256').update(JSON.stringify(identity)).digest('hex');

  async function* foods() {
    const workbook = new ExcelJS.stream.xlsx.WorkbookReader(paths.data, {
      sharedStrings: 'cache', styles: 'ignore', hyperlinks: 'ignore', worksheets: 'emit',
    });
    let sheets = 0;
    const codes = new Set();
    for await (const sheet of workbook) {
      if (++sheets !== 1) throw new Error('Expected one food worksheet.');
      let columns;
      let width;
      for await (const row of sheet) {
        const values = rowValues(row);
        if (row.number === 1) {
          columns = mapFoodHeaders(values, definitions); width = values.length;
          continue;
        }
        if (blankRow(values)) continue;
        const code = text(values[0], `Food row ${row.number}`);
        if (!columns || codes.has(code)) throw new Error(`Missing headers or duplicate BLS code: ${code}.`);
        codes.add(code);
        yield {
          bls_code: code, name_de: text(values[1], code), name_en: text(values[2], code),
          source_row: row.number, notes: text(values[width - 1], code, true),
          nutrients: columns.map(({ code: nutrientCode, column }) => ({
            nutrient_code: nutrientCode,
            ...parseNutrientValue(values[column], `${code}/${nutrientCode}`),
            origin: text(values[column + 1], code, true),
            reference_text: text(values[column + 2], code, true),
          })),
        };
      }
      if (!columns) throw new Error('Food worksheet has no header row.');
    }
    if (sheets !== 1 || codes.size !== manifest.foodCount) throw new Error('Unexpected BLS food count.');
  }

  const summary = { foods: 0, nutrients: definitions.length, values: 0, valueKinds: {} };
  for await (const food of foods()) {
    summary.foods++;
    for (const value of food.nutrients) {
      summary.values++;
      summary.valueKinds[value.value_kind] = (summary.valueKinds[value.value_kind] ?? 0) + 1;
    }
  }
  if (summary.values !== manifest.foodCount * manifest.nutrientCount) throw new Error('Incomplete nutrient matrix.');
  await verifyFiles();
  return { manifest, definitions, contentHash, summary, foods, verifyFiles };
}
