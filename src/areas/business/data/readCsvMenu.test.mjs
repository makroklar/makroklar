import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';
registerHooks({ resolve(specifier, context, next) {
  if (['./recipeDraft','./csvMenuModel'].includes(specifier)) return next(specifier + '.ts', context);
  return next(specifier, context);
} });
const { parseCsvMenu, readCsvMenu } = await import('./readCsvMenu.ts');
const { CSV_TEMPLATE, createCsvPreview, acceptCsvPreview } = await import('./csvMenuModel.ts');

test('download template round-trips UTF-8 BOM, German decimal and absent price', async () => {
  const text=await readCsvMenu(new File([CSV_TEMPLATE],'menu.csv',{type:'text/csv'}));
  const table=parseCsvMenu(text);
  assert.deepEqual(table.headers,['Name','Preis']);
  const rows=createCsvPreview(table,{nameColumn:0,priceColumn:1},()=>crypto.randomUUID());
  assert.deepEqual(acceptCsvPreview(rows,[],0,false).map(d=>d.price),[9.5,null]);
});

test('quotes, embedded delimiters/newlines and escaped quotes stay in their field', () => {
  const text='Name,Preis\r\n"Salat, groß","9,50"\r\n"Pizza ""Haus""",12.00\r\n"Suppe\nmit Brot",\r\n';
  assert.deepEqual(parseCsvMenu(text).records,[['Salat, groß','9,50'],['Pizza "Haus"','12.00'],['Suppe\nmit Brot','']]);
  assert.deepEqual(parseCsvMenu('Name;Preis\n"Salat; groß";9,50').records,[['Salat; groß','9,50']]);
});

test('single-column name lists and blank lines are supported without invented prices', () => {
  assert.deepEqual(parseCsvMenu('Name\nSuppe\n\nSalat\n').records,[['Suppe'],['Salat']]);
  assert.deepEqual(parseCsvMenu('Name;Preis\n\nSuppe;\n;\nSalat;0').records,[['Suppe',''],['Salat','0']]);
});

test('malformed quoting, uneven columns, binary files and empty lists are rejected', () => {
  for(const text of ['Name;Preis\n"Suppe;5','Name;Preis\nSuppe;5;6','Name;Preis','Name\nabc\0def']) assert.throws(()=>parseCsvMenu(text));
  assert.throws(()=>parseCsvMenu('Name,Preis\nSuppe,9,50',','));
});

test('row/byte boundaries do not silently import a truncated menu', () => {
  assert.equal(parseCsvMenu('Name;Preis\n'+Array(500).fill('Suppe;2').join('\n')).records.length,500);
  assert.throws(()=>parseCsvMenu('Name;Preis\n'+Array(501).fill('Suppe;2').join('\n')));
  assert.throws(()=>parseCsvMenu('Name\n'+'ä'.repeat(600000)));
});

test('invalid encoding and non-CSV files fail before preview', async () => {
  await assert.rejects(readCsvMenu(new File([new Uint8Array([0xff,0xfe,0x41])],'menu.csv')),/UTF-8/);
  await assert.rejects(readCsvMenu(new File(['Name\nSuppe'],'menu.pdf')),/CSV/);
  await assert.rejects(readCsvMenu(new File([],'menu.csv')),/leer/);
});

test('formula-like and HTML-like names remain literal text, never evaluated', () => {
  const table=parseCsvMenu('Name;Preis\n=1+2;0\n<script>alert(1)<\/script>;');
  assert.equal(table.records[0][0],'=1+2');
  assert.equal(table.records[1][0],'<script>alert(1)</script>');
});
