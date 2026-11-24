import test from 'node:test';
import assert from 'node:assert/strict';
import {validateForm,explainError} from '../src/index.js';
test('length and numeric errors expose limits but no submitted data',()=>{
 const s={type:'object',properties:{name:{type:'string',minLength:3},age:{type:'integer',minimum:18}}};
 const r=validateForm({name:'x',age:10},s);
 assert.deepEqual(r.errors.map(e=>e.limit),[3,18]);
 assert.match(explainError(r.errors[0]),/limit: 3/);
 assert.match(explainError(r.errors[1],'ko'),/기준: 18/);
 assert.ok(!JSON.stringify(r.errors).includes('"name":"x"'));
});
test('array max and minimum hints are localized',()=>{
 const r=validateForm([1,2,3],{type:'array',maxItems:2});
 assert.equal(r.errors[0].limit,2);assert.match(explainError(r.errors[0],'ko'),/2/);
});
test('unsupported locale throws; unknown code is generic',()=>{
 assert.throws(()=>explainError({code:'REQUIRED'},'fr'),RangeError);
 assert.match(explainError({code:'UNRECOGNIZED'}),/Validation failed/);
});
