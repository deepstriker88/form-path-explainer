import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectFormSchema,validateForm,createValidator} from '../src/index.js';
test('optional nested property must have valid length limits',()=>{
 const schema={type:'object',properties:{optional:{type:'string',minLength:-1}}};
 assert.equal(inspectFormSchema(schema).errors[0].code,'INVALID_LENGTH_RULE');
 assert.equal(validateForm({},schema).errors[0].code,'INVALID_LENGTH_RULE');
 assert.equal(createValidator(schema)({}).errors[0].code,'INVALID_LENGTH_RULE');
});
test('invalid nested array item is rejected even for empty arrays',()=>{
 const schema={type:'array',items:{type:'integer',minimum:Infinity}};
 assert.equal(inspectFormSchema(schema).errors[0].code,'INVALID_NUMBER_RULE');
 assert.equal(validateForm([],schema).errors[0].code,'INVALID_NUMBER_RULE');
});
test('unknown nested keyword is not silently accepted',()=>{
 const s={type:'object',properties:{unused:{type:'string',regex:'[A-Z]'}}};
 assert.equal(inspectFormSchema(s).errors[0].code,'UNKNOWN_SCHEMA_RULE');
});
test('required syntax and duplicate fields are checked independently of data',()=>{
 const s={type:'array',items:{type:'object',required:['a','a']}};
 assert.equal(inspectFormSchema(s).errors[0].code,'DUPLICATE_REQUIRED');
});
test('schema errors do not depend on the input object type',()=>{
 const schema={type:'object',properties:{x:{type:'bogus'}}};
 assert.equal(validateForm(null,schema).errors[0].code,'UNSUPPORTED_TYPE');
});
test('well-formed nested schema passes independent preflight',()=>{
 const schema={type:'object',required:['items'],properties:{items:{type:'array',minItems:1,items:{type:'integer',minimum:0}}}};
 assert.deepEqual(inspectFormSchema(schema),{valid:true,errors:[]});
});
test('invalid nonobject root fails schema preflight',()=>{
 for(const value of [null,undefined,[],true,5,'object'])assert.equal(inspectFormSchema(value).errors[0].code,'INVALID_SCHEMA');
});
test('preflight never executes a nested rule getter',()=>{
 let count=0;const child={type:'string'};Object.defineProperty(child,'format',{get(){count++;throw Error('invoked')}});
 assert.equal(inspectFormSchema({type:'object',properties:{child}}).errors[0].code,'SCHEMA_ACCESSOR');assert.equal(count,0);
});
test('polluted Object.prototype format getter is never executed',()=>{
 const original=Object.getOwnPropertyDescriptor(Object.prototype,'format');let calls=0;
 try{
  Object.defineProperty(Object.prototype,'format',{configurable:true,get(){calls++;throw Error('inherited getter executed');}});
  const s={type:'string'};
  assert.equal(inspectFormSchema(s).valid,true);
  assert.equal(validateForm('plain',s).valid,true);
  assert.equal(createValidator(s)('plain').valid,true);
  assert.equal(calls,0);
 }finally{
  if(original)Object.defineProperty(Object.prototype,'format',original);
  else delete Object.prototype.format;
 }
});
test('enum values must match the declared primitive type',()=>{
 for(const s of [
  {type:'string',enum:[42]},
  {type:'boolean',enum:['true']},
  {type:'integer',enum:[1.5]},
  {type:'object',enum:['x']},
  {type:'array',enum:[null]},
  {type:'string',enum:[null]}
 ])assert.equal(inspectFormSchema(s).errors[0].code,'INVALID_ENUM');
 assert.equal(inspectFormSchema({type:'string',enum:['a','b']}).valid,true);
 assert.equal(inspectFormSchema({type:'integer',enum:[1,2]}).valid,true);
});
test('array minimum cannot exceed 100-item safety cap',()=>{
 const s={type:'array',minItems:101,items:{type:'number'}};
 assert.equal(inspectFormSchema(s).errors[0].code,'INVALID_ITEMS_RULE');
 assert.equal(validateForm([],s).errors[0].code,'INVALID_ITEMS_RULE');
});
