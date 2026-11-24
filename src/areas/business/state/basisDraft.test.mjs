import assert from 'node:assert/strict';
import test from 'node:test';
import { basisDraftReducer as reduce, createBasisDraft, basisUsedBy } from './basisDraft.ts';

const id='ba542400-0000-4000-8000-000000000200';
const dish='manual-ba542400-0000-4000-8000-000000000300';
const recipe=()=>({id,name:'Sauce',outputQuantity:'400',outputUnit:'g',ingredients:[{foodId:'off:00000001',quantity:'200',unit:'g'}]});
const lines=()=>[{basisId:id,quantity:'80',unit:'g'}];
const snapshot=()=>({schemaVersion:2,basisRecipes:[recipe()],dishBases:{[dish]:lines()}});
const link=(state,items=lines())=>reduce(state,{type:'setLinks',dishKey:dish,lines:items,knownDishKeys:[dish]});

test('legacy snapshots start empty; v2 restores copies including saved identities and links',()=>{
  assert.deepEqual(createBasisDraft({version:1}),createBasisDraft());
  const source=snapshot();const state=createBasisDraft(source);
  source.basisRecipes[0].ingredients[0].quantity='999';source.dishBases[dish][0].quantity='999';
  assert.equal(state.basisRecipes[0].ingredients[0].quantity,'200');
  assert.equal(state.dishBases[dish][0].quantity,'80');
  assert.deepEqual(state.savedBasisIds,[id]);assert.equal(state.dirty,false);
});
test('adding and editing a basis is immutable and does not duplicate it',()=>{
  const incoming=recipe();const previous=createBasisDraft();
  const added=reduce(previous,{type:'upsert',recipe:incoming});
  incoming.ingredients[0].quantity='999';
  assert.equal(previous.basisRecipes.length,0);assert.equal(added.basisRecipes[0].ingredients[0].quantity,'200');
  const edited=reduce(added,{type:'upsert',recipe:{...recipe(),name:'New sauce'}});
  assert.equal(edited.basisRecipes.length,1);assert.equal(edited.basisRecipes[0].name,'New sauce');
  assert.equal(added.basisRecipes[0].name,'Sauce');assert.equal(edited.dirty,true);
});
test('linked basis cannot be deleted or change unit; changing name/quantity preserves links',()=>{
  const state=createBasisDraft(snapshot());
  assert.deepEqual(basisUsedBy(state,id),[dish]);
  const blocked=reduce(state,{type:'remove',id});
  assert.ok(blocked.error);assert.deepEqual(blocked.basisRecipes,state.basisRecipes);assert.deepEqual(blocked.deletedBasisIds,[]);
  const changedUnit=reduce(state,{type:'upsert',recipe:{...recipe(),outputUnit:'ml'}});
  assert.ok(changedUnit.error);assert.equal(changedUnit.basisRecipes[0].outputUnit,'g');
  const edited=reduce(state,{type:'upsert',recipe:{...recipe(),outputQuantity:'600'}});
  assert.equal(edited.error,null);assert.deepEqual(edited.dishBases,state.dishBases);
});
test('links reject duplicates, missing basis, unknown dish and incompatible unit',()=>{
  const state=createBasisDraft(snapshot());
  for(const action of [
    {type:'setLinks',dishKey:'foreign',knownDishKeys:[dish],lines:lines()},
    {type:'setLinks',dishKey:dish,knownDishKeys:[dish],lines:[...lines(),...lines()]},
    {type:'setLinks',dishKey:dish,knownDishKeys:[dish],lines:[{...lines()[0],basisId:'missing'}]},
    {type:'setLinks',dishKey:dish,knownDishKeys:[dish],lines:[{...lines()[0],unit:'ml'}]},
  ]) {const next=reduce(state,action);assert.ok(next.error);assert.deepEqual(next.dishBases,state.dishBases);}
  const incoming=lines();const next=link(state,incoming);incoming[0].quantity='999';
  assert.equal(next.dishBases[dish][0].quantity,'80');
});
test('explicit unlink allows deletion; only saved bases queue deletion and undo cancels it',()=>{
  const unlinked=link(createBasisDraft(snapshot()),[]);
  assert.deepEqual(unlinked.dishBases[dish],[]); // preserve [] for the eventual SQL payload
  const deleted=reduce(unlinked,{type:'remove',id});
  assert.deepEqual(deleted.deletedBasisIds,[id]);assert.equal(deleted.basisRecipes.length,0);
  assert.deepEqual(reduce(deleted,{type:'remove',id}).deletedBasisIds,[id]);
  const undone=reduce(deleted,{type:'upsert',recipe:recipe()});
  assert.deepEqual(undone.deletedBasisIds,[]);
  const local=reduce(createBasisDraft(),{type:'upsert',recipe:recipe()});
  assert.deepEqual(reduce(local,{type:'remove',id}).deletedBasisIds,[]);
});
test('background restoration cannot overwrite local recipes, cleared links or pending deletions',()=>{
  const server=createBasisDraft(snapshot());
  const edits=[reduce(server,{type:'upsert',recipe:{...recipe(),name:'Unsaved'}}),link(server,[]),
    reduce(link(server,[]),{type:'remove',id})];
  for(const state of edits) assert.strictEqual(reduce(state,{type:'restore',snapshot:snapshot()}),state);
  const refreshed=snapshot();refreshed.basisRecipes[0].name='Server edit';
  assert.equal(reduce(server,{type:'restore',snapshot:refreshed}).basisRecipes[0].name,'Server edit');
});
test('reset is local logout cleanup; errors can be dismissed without discarding data',()=>{
  const blocked=reduce(createBasisDraft(snapshot()),{type:'remove',id});
  const cleared=reduce(blocked,{type:'clearError'});
  assert.equal(cleared.error,null);assert.deepEqual(cleared.basisRecipes,blocked.basisRecipes);
  assert.deepEqual(reduce(blocked,{type:'reset'}),createBasisDraft());
});
test('save acknowledgement retains bases, clears confirmed deletions and allows server restoration',()=>{
  const state=link(reduce(createBasisDraft(),{type:'upsert',recipe:recipe()}));
  const acknowledged=reduce(state,{type:'acknowledge',submitted:structuredClone(state)});
  assert.equal(acknowledged.dirty,false); assert.equal(acknowledged.fromV2,true);
  assert.deepEqual(acknowledged.basisRecipes,state.basisRecipes);
  assert.deepEqual(acknowledged.dishBases,state.dishBases);
  assert.deepEqual(acknowledged.savedBasisIds,[id]);
  const removed=reduce(link(acknowledged,[]),{type:'remove',id});
  assert.deepEqual(removed.deletedBasisIds,[id]);
  const saved=reduce(removed,{type:'acknowledge',submitted:structuredClone(removed)});
  assert.deepEqual(saved.deletedBasisIds,[]); assert.deepEqual(saved.savedBasisIds,[]); assert.equal(saved.dirty,false);
  assert.equal(reduce(saved,{type:'restore',snapshot:snapshot()}).basisRecipes.length,1);
});

test('save response preserves later edits and queues a newly saved basis removed during the request',()=>{
  const sent=reduce(createBasisDraft(),{type:'upsert',recipe:recipe()});
  const later=reduce(sent,{type:'upsert',recipe:{...recipe(),name:'Later edit'}});
  const ack=reduce(later,{type:'acknowledge',submitted:structuredClone(sent)});
  assert.equal(ack.dirty,true); assert.equal(ack.basisRecipes[0].name,'Later edit');
  assert.strictEqual(reduce(ack,{type:'restore',snapshot:snapshot()}),ack);
  const removed=reduce(sent,{type:'remove',id});
  assert.deepEqual(removed.deletedBasisIds,[]);
  const saved=reduce(removed,{type:'acknowledge',submitted:structuredClone(sent)});
  assert.equal(saved.dirty,true); assert.deepEqual(saved.deletedBasisIds,[id]);
  assert.equal(saved.basisRecipes.length,0);
});
