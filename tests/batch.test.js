import test from 'node:test';
import assert from 'node:assert/strict';
import {createValidator,validateBatch,validateForm} from '../src/index.js';
test('compiled validator uses a stable rules snapshot',()=>{
 const schema={type:'object',properties:{name:{type:'string',minLength:2}}};
 const check=createValidator(schema);
 schema.properties.name.minLength=0;
 assert.equal(check({name:'a'}).errors[0].code,'TOO_SHORT');
 assert.equal(validateForm({name:'a'},schema).valid,true);
});
test('compiled validator reuses nested rules without mutation',()=>{
 const schema={type:'array',items:{type:'integer',minimum:1}};
 const check=createValidator(schema);
 assert.equal(check([1,2]).valid,true);
 assert.equal(check([0]).errors[0].code,'BELOW_MINIMUM');
 assert.equal(check([5]).valid,true);
});
test('batch provides a stable per-record result',()=>{
 const s={type:'object',required:['age'],properties:{age:{type:'integer',minimum:0}}};
 const r=validateBatch([{age:2},{age:-1},{}],s);
 assert.equal(r.valid,false);assert.equal(r.count,3);assert.equal(r.passed,1);assert.equal(r.failed,2);
 assert.deepEqual(r.results.map(x=>x.index),[0,1,2]);
 assert.equal(r.results[1].errors[0].code,'BELOW_MINIMUM');
 assert.equal(r.results[2].errors[0].code,'REQUIRED');
});
test('batch limits and invalid arguments',()=>{
 assert.throws(()=>validateBatch({}, {type:'object'}),TypeError);
 assert.throws(()=>validateBatch(Array(101), {type:'string'}),RangeError);
 for(const n of [0,101,1.2,NaN])assert.throws(()=>validateBatch([], {type:'string'},{maxItems:n}),RangeError);
});
test('batch sparse array and accessor never execute getter',()=>{
 let calls=0;const rows=[0,1];Object.defineProperty(rows,'1',{get(){calls++;throw Error('not called')}});
 const r=validateBatch(rows,{type:'integer'});
 assert.equal(calls,0);assert.equal(r.results[1].errors[0].code,'ACCESSOR_PROPERTY');
 assert.equal(validateBatch(new Array(1),{type:'number'}).results[0].errors[0].code,'TYPE_MISMATCH');
});
test('invalid schema is reported per record without executing schema getter',()=>{
 let calls=0;const s={type:'string'};Object.defineProperty(s,'format',{get(){calls++;throw Error('not called')}});
 const r=validateBatch(['a','b'],s);
 assert.equal(calls,0);assert.deepEqual(r.results.map(x=>x.errors[0].code),['SCHEMA_ACCESSOR','SCHEMA_ACCESSOR']);
});
test('hostile object inspection fails with a structured error',()=>{
 const hostile=new Proxy({}, {ownKeys(){throw Error('not safe')}});
 assert.equal(validateForm(hostile,{type:'object'}).errors[0].code,'INSPECTION_FAILED');
});

test('misplaced schema constraints fail instead of silently passing',()=>{
 for(const s of [{type:'number',minLength:10},{type:'string',minimum:10},{type:'boolean',required:['x']},{type:'array',additionalProperties:false}])assert.equal(validateForm('bad',s).errors[0].code,'INVALID_RULE_COMBINATION');
});
test('unknown schema keyword is rejected rather than ignored',()=>{
 for(const s of [{type:'string',pattern:'^a'},{type:'number',minimumValue:0}])assert.equal(validateForm('abc',s).errors[0].code,'UNKNOWN_SCHEMA_RULE');
});
test('field paths use unambiguous bracket notation for punctuation',()=>{
 const props={'a.b':{type:'integer'},'x/y':{type:'integer'},'space name':{type:'integer'}};
 const result=validateForm({'a.b':'wrong','x/y':'wrong','space name':'wrong'},{type:'object',properties:props});
 assert.deepEqual(result.errors.map(e=>e.path),['$["a.b"]','$["x/y"]','$["space name"]']);
});
test('safe field paths remain backward-compatible for ordinary names',()=>{
 const r=validateForm({contact:{email:'no'}},{type:'object',properties:{contact:{type:'object',properties:{email:{type:'string',format:'email'}}}}});
 assert.equal(r.errors[0].path,'$.contact.email');
});
