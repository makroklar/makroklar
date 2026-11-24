import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';
registerHooks({ resolve(specifier, context, next) {
  if (['./onboardingModel','./recipeDraft','./foodSearchModel'].includes(specifier)) return next(specifier+'.ts',context);
  return next(specifier,context);
} });
const { basisOnboardingPayloadSchema, basisOnboardingSnapshotSchema, normalizeBasisPayload } = await import('./basisOnboardingModel.ts');
const foodId='ba542400-0000-4000-8000-000000000100';
const baseId='ba542400-0000-4000-8000-000000000200';
const dishId='ba542400-0000-4000-8000-000000000300';
const key=`manual-${dishId}`;
const fixture=()=>({
  schemaVersion:2, importedIds:[], customDishes:[{id:dishId,name:'Pizza',price:null}], catalogFoods:[],
  manualFoods:[{id:foodId,name:'Test',basis:'100g',preparation:'as_sold',energyKcal:100,proteinG:10,fatG:2,carbohydrateG:20,
    sourceKind:'label',sourceDescription:'Test label',noticeVersion:'2026-11-10.2'}],
  recipes:{[key]:{servings:'2',ingredients:[]}},
  basisRecipes:[{id:baseId,name:' Sauce ',outputQuantity:'400,50',outputUnit:'g',ingredients:[{foodId,quantity:'200,25',unit:'g'}]}],
  dishBases:{[key]:[{basisId:baseId,quantity:'80,25',unit:'g'}]}, deletedBasisIds:[],
});
test('v2 keeps bases and links, normalizes decimals without mutating caller or inventing totals',()=>{
  const input=fixture(); const before=structuredClone(input); const result=normalizeBasisPayload(input);
  assert.deepEqual(input,before);
  assert.equal(result.basisRecipes[0].name,'Sauce');
  assert.equal(result.basisRecipes[0].outputQuantity,'400.50');
  assert.equal(result.basisRecipes[0].ingredients[0].quantity,'200.25');
  assert.equal(result.dishBases[key][0].quantity,'80.25');
  assert.equal(result.recipes[key].servings,'1');
  assert.equal('energyKcal' in result.basisRecipes[0],false);
});
test('missing output/empty bases remain drafts, while positive quantities and known units are required',()=>{
  const input=fixture(); input.basisRecipes[0].outputQuantity=null; input.basisRecipes[0].ingredients=[];
  assert.equal(basisOnboardingPayloadSchema.safeParse(input).success,true);
  for(const invalid of ['0','-1','1e3','Infinity','NaN','1000001','']) {
    const item=fixture(); item.basisRecipes[0].outputQuantity=invalid;
    assert.equal(basisOnboardingPayloadSchema.safeParse(item).success,false,invalid);
    const link=fixture(); link.dishBases[key][0].quantity=invalid;
    assert.equal(basisOnboardingPayloadSchema.safeParse(link).success,false,invalid);
  }
});
test('requires explicit v2 fields rather than silently dropping unsupported data',()=>{
  for(const field of ['schemaVersion','basisRecipes','dishBases','deletedBasisIds']) {
    const input=fixture(); delete input[field]; assert.equal(basisOnboardingPayloadSchema.safeParse(input).success,false,field);
  }
});
test('rejects lost/duplicate references, nested bases, and g/ml mismatches',()=>{
  const mutations=[
    x=>x.basisRecipes.push(structuredClone(x.basisRecipes[0])),
    x=>x.basisRecipes[0].ingredients.push(structuredClone(x.basisRecipes[0].ingredients[0])),
    x=>x.basisRecipes[0].ingredients[0].foodId=baseId,
    x=>x.basisRecipes[0].ingredients[0]={basisId:baseId,quantity:'10',unit:'g'},
    x=>x.basisRecipes[0].ingredients[0].unit='ml',
    x=>x.dishBases[key][0].unit='ml',
    x=>x.dishBases[key][0].basisId=foodId,
    x=>x.dishBases[key].push(structuredClone(x.dishBases[key][0])),
    x=>x.dishBases.foreign=x.dishBases[key],
    x=>x.recipes.foreign={servings:'1',ingredients:[]}, // original v1 checks are retained
  ];
  for(const mutate of mutations){const input=fixture();mutate(input);assert.equal(basisOnboardingPayloadSchema.safeParse(input).success,false);}
});
test('requires unambiguous explicit deletion, with no remaining references',()=>{
  const input=fixture();input.deletedBasisIds=[baseId];
  assert.equal(basisOnboardingPayloadSchema.safeParse(input).success,false);
  input.basisRecipes=[];
  assert.equal(basisOnboardingPayloadSchema.safeParse(input).success,false);
  input.dishBases[key]=[];
  assert.equal(basisOnboardingPayloadSchema.safeParse(input).success,true);
  input.deletedBasisIds.push(baseId);
  assert.equal(basisOnboardingPayloadSchema.safeParse(input).success,false);
});
test('snapshot restores recipe links and measured output; does not treat them as shopping foods',()=>{
  const input=fixture();const {importedIds,deletedBasisIds,...state}=input;
  const snapshot=basisOnboardingSnapshotSchema.parse({...state,version:1,restaurantName:'Test',summary:null});
  assert.equal(snapshot.basisRecipes.length,1);assert.equal(snapshot.manualFoods.length,1);
  assert.deepEqual(snapshot.dishBases,input.dishBases);
  assert.equal(snapshot.basisRecipes[0].outputQuantity,'400,50');
});
