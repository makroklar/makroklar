import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';
registerHooks({ resolve(specifier, context, next) {
  if (specifier === './recipeDraft') return next(specifier + '.ts', context);
  return next(specifier, context);
} });
const { createCsvTable, suggestCsvMapping, createCsvPreview, csvRowErrors, duplicateCsvRowIds,
  acceptCsvPreview, validateCsvFile, CSV_MAX_BYTES } = await import('./csvMenuModel.ts');
const { appendCustomDishes } = await import('../state/customDishes.ts');
const preview = records => createCsvPreview(createCsvTable([['Name','Preis'], ...records]),
  {nameColumn:0,priceColumn:1}, () => crypto.randomUUID());

test('file and table limits fail explicitly without silently truncating dishes', () => {
  validateCsvFile({name:'MENU.CSV',size:CSV_MAX_BYTES});
  for (const file of [{name:'menu.pdf',size:2},{name:'menu.csv',size:0},{name:'menu.csv',size:CSV_MAX_BYTES+1}]) assert.throws(()=>validateCsvFile(file));
  assert.throws(()=>createCsvTable([['Name']]));
  assert.throws(()=>createCsvTable([['Name','Preis'],['Suppe','9','50']]));
  assert.throws(()=>createCsvTable([['Name'],...Array.from({length:501},()=>['Suppe'])]));
  assert.equal(createCsvTable([['Name'],...Array.from({length:500},()=>['Suppe'])]).records.length,500);
  assert.throws(()=>createCsvTable([Array(21).fill('Spalte'),Array(21).fill('Wert')]));
});

test('mapping accepts arbitrary columns by index; ambiguous headers require a choice', () => {
  assert.deepEqual(suggestCsvMapping([' Preis ','Bezeichnung']),{nameColumn:1,priceColumn:0});
  assert.deepEqual(suggestCsvMapping(['Name','Name','Preis']),{nameColumn:null,priceColumn:2});
  const table=createCsvTable([['SKU','My dish','Euro'],['1','Suppe','2,50']]);
  assert.throws(()=>createCsvPreview(table,{nameColumn:null,priceColumn:null},()=>''));
  assert.throws(()=>createCsvPreview(table,{nameColumn:1,priceColumn:1},()=>''));
  const rows=createCsvPreview(table,{nameColumn:1,priceColumn:null},()=>crypto.randomUUID());
  assert.deepEqual(acceptCsvPreview(rows,[],0,false).map(({name,price})=>({name,price})),[{name:'Suppe',price:null}]);
});

test('prices retain empty vs zero, accept decimal commas and reject guesses', () => {
  const rows=preview([[' Suppe ',''],['Wasser','0'],['Pizza','9,50'],['Salat','7.25']]);
  assert.deepEqual(acceptCsvPreview(rows,[],0,false).map(d=>d.price),[null,0,9.5,7.25]);
  assert.equal(acceptCsvPreview(rows,[],0,false)[0].name,'Suppe');
  for(const price of ['-1','1e2','1.234,56','9,555','€ 4','1000000']) assert.ok(csvRowErrors({name:'Suppe',price}).price);
  assert.ok(csvRowErrors({name:' ',price:''}).name);
  assert.ok(csvRowErrors({name:'a'.repeat(201),price:''}).name);
});

test('invalid deselected rows do not block selected dishes and input is never mutated', () => {
  const rows=preview([['Suppe','8'],['','oops']]); rows[1].selected=false;
  const before=structuredClone(rows);
  assert.equal(acceptCsvPreview(rows,[],0,false).length,1);
  assert.deepEqual(rows,before);
  rows[1].selected=true; assert.throws(()=>acceptCsvPreview(rows,[],0,false));
  rows.forEach(row=>row.selected=false); assert.throws(()=>acceptCsvPreview(rows,[],0,false));
});

test('name duplicates including repeated files need confirmation, never auto-merge', () => {
  const rows=preview([['Pizza  Salami','9'],['pizza salami','12'],['Suppe','5']]);
  assert.equal(duplicateCsvRowIds(rows,[' suppe ']).size,3);
  assert.throws(()=>acceptCsvPreview(rows,['Suppe'],1,false));
  assert.equal(acceptCsvPreview(rows,['Suppe'],1,true).length,3);
  rows[1].selected=false; rows[2].selected=false;
  assert.equal(duplicateCsvRowIds(rows,[]).size,0);
});

test('batch acceptance retains IDs, is idempotent by ID, and preserves previous recipes identities', () => {
  const rows=preview([['Suppe','5'],['Salat','']]);
  const accepted=acceptCsvPreview(rows,[],0,false);
  const saved={id:crypto.randomUUID(),name:'Vorhanden',price:7};
  const once=appendCustomDishes([saved],accepted);
  assert.deepEqual(once.map(d=>d.id),[saved.id,...rows.map(r=>r.id)]);
  assert.deepEqual(appendCustomDishes(once,accepted),once);
  accepted[0].price=99; assert.equal(once[1].price,5);
  assert.equal(once[0],saved);
  assert.throws(()=>acceptCsvPreview(rows,[],999,false));
  assert.equal(acceptCsvPreview(rows,[],998,false).length,2);
});
