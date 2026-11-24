import test from 'node:test';
import assert from 'node:assert/strict';
import {inferFormSchema,SchemaInferenceError} from '../src/infer.js';
import {validateBatch,validateForm} from '../src/index.js';
test('infers shape with optional fields across records',()=>{
 const rows=[{name:'Ann',age:32},{name:'Bob',active:true,age:25}];
 const {schema,records}=inferFormSchema(rows);
 assert.equal(records,2);assert.equal(schema.type,'object');
 assert.deepEqual(schema.required,['name','age']);assert.equal(schema.properties.age.type,'integer');
 assert.equal(schema.properties.active.type,'boolean');
 assert.equal(validateBatch(rows,schema).valid,true);
 assert.equal(validateForm({name:'x',age:2,newField:1},schema).valid,true);
});
test('inference can close objects, including nested structures',()=>{
 const rows=[{meta:{enabled:true},items:[{value:1}]}];
 const {schema}=inferFormSchema(rows,{closedObjects:true});
 assert.equal(schema.additionalProperties,false);
 assert.equal(schema.properties.meta.additionalProperties,false);
 assert.equal(schema.properties.items.items.additionalProperties,false);
 assert.equal(validateForm(rows[0],schema).valid,true);
 assert.equal(validateForm({meta:{enabled:true,extra:1},items:[{value:1}]},schema).errors[0].code,'ADDITIONAL_PROPERTY');
});
test('integer and fractional samples merge into numeric schema',()=>{
 const {schema}=inferFormSchema([{n:1},{n:2.5}]);assert.equal(schema.properties.n.type,'number');
 assert.equal(validateForm({n:2.1},schema).valid,true);
});
test('array entries merge optional nested object fields',()=>{
 const rows=[{entries:[{id:1},{id:2,name:'A'}]},{entries:[{id:3}]}];
 const {schema}=inferFormSchema(rows,{closedObjects:true});
 assert.deepEqual(schema.properties.entries.items.required,['id']);
 assert.deepEqual(Object.keys(schema.properties.entries.items.properties),['id','name']);
 assert.equal(validateBatch(rows,schema).valid,true);
});
test('empty arrays do not guess element type',()=>{
 const {schema}=inferFormSchema([{items:[]},{items:[1]}]);
 assert.equal(schema.properties.items.items.type,'integer');
 assert.equal(validateForm({items:[2]},schema).valid,true);
});
test('mixed sample types fail closed',()=>{
 assert.throws(()=>inferFormSchema([{n:'1'},{n:1}]),e=>e instanceof SchemaInferenceError&&e.code==='MIXED_TYPES');
});
test('null undefined function bigint and nonfinite numbers are rejected',()=>{
 for(const x of [null,undefined,()=>0,1n])assert.throws(()=>inferFormSchema([x]),SchemaInferenceError);
 for(const x of [Infinity,-Infinity,NaN])assert.throws(()=>inferFormSchema([{n:x}]),e=>e.code==='NONFINITE_NUMBER');
});
test('unsafe properties and getters are not executed',()=>{
 let calls=0;const row={};Object.defineProperty(row,'secret',{enumerable:true,get(){calls++;throw Error('getter executed')}});
 assert.throws(()=>inferFormSchema([row]),e=>e.code==='UNSAFE_FIELD');assert.equal(calls,0);
 const poison=JSON.parse('{"__proto__":"x"}');
 assert.throws(()=>inferFormSchema([poison]),e=>e.code==='UNSAFE_FIELD');
});
test('cyclic and exotic objects are rejected with reasons',()=>{
 const a={};a.self=a;
 assert.throws(()=>inferFormSchema([a]),e=>e.code==='CYCLIC_SAMPLE');
 assert.throws(()=>inferFormSchema([new Date()]),e=>e.code==='UNSUPPORTED_OBJECT');
});
test('bounded sample sizes and array holes',()=>{
 assert.throws(()=>inferFormSchema([]),e=>e.code==='INVALID_SAMPLES');
 assert.throws(()=>inferFormSchema(Array.from({length:101},()=>({}))),e=>e.code==='INVALID_SAMPLES');
 assert.throws(()=>inferFormSchema(new Array(1)),e=>e.code==='UNSAFE_ARRAY_SLOT');
 assert.throws(()=>inferFormSchema([{tags:new Array(1)}]),e=>e.code==='UNSAFE_ARRAY_SLOT');
 assert.throws(()=>inferFormSchema([{items:Array(101).fill(0)}]),e=>e.code==='TOO_MANY_ITEMS');
});
test('deep object nesting is bounded',()=>{
 let x='value';for(let i=0;i<14;i++)x={child:x};
 assert.throws(()=>inferFormSchema([x]),e=>e.code==='MAX_DEPTH');
});
test('schema inference should never retain sample values',()=>{
 const secret='private-customer-secret';
 const {schema}=inferFormSchema([{password:secret,email:'a@b.com'}]);
 assert.doesNotMatch(JSON.stringify(schema),/private-customer-secret/);
 assert.equal(schema.properties.password.format,undefined);
});
