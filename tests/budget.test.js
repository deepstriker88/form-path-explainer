import test from 'node:test';
import assert from 'node:assert/strict';
import {validateForm,createValidator} from '../src/index.js';
test('shared schema DAG is accepted without combinatorial inspection',()=>{
 let s={type:'string'},v='ok';
 for(let i=0;i<6;i++){
  const properties=Object.fromEntries(Array.from({length:20},(_,j)=>['p'+j,s]));
  const fields=Object.fromEntries(Array.from({length:20},(_,j)=>['p'+j,v]));
  s={type:'object',properties};v=fields;
 }
 const result=validateForm(v,s);
 assert.equal(result.valid,false);
 assert.equal(result.errors[0].code,'MAX_NODES');
 assert.equal(createValidator(s)(v).errors[0].code,'MAX_NODES');
});
test('schema traversal budget avoids unbounded independent rules',()=>{
 let s={type:'string'};
 for(let depth=0;depth<3;depth++){
  s={type:'object',properties:Object.fromEntries(Array.from({length:30},(_,i)=>['p'+i,structuredClone(s)]))};
 }
 const r=validateForm({},s);
 assert.equal(r.errors[0].code,'SCHEMA_TOO_LARGE');
});
test('cyclic schema still fails despite shared-node deduplication',()=>{
 const a={type:'object',properties:{}};const b={type:'object',properties:{a}};a.properties.b=b;
 assert.equal(validateForm({},a).errors[0].code,'CYCLIC_SCHEMA');
});
