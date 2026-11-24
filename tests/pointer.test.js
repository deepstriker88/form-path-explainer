import test from 'node:test';
import assert from 'node:assert/strict';
import {validateForm,pathToPointer} from '../src/index.js';
test('standard fields and array indices map to RFC 6901 pointers',()=>{
 const s={type:'object',properties:{users:{type:'array',items:{type:'object',properties:{email:{type:'string',format:'email'}}}}}};
 const r=validateForm({users:[{email:'not-email'}]},s);
 assert.equal(r.errors[0].path,'$.users[0].email');assert.equal(r.errors[0].pointer,'/users/0/email');
});
test('JSON pointer escapes slash and tilde and preserves punctuation',()=>{
 const keys=['a/b','x~y','name.with.dot','[key]','quote"x'];
 const props=Object.fromEntries(keys.map(k=>[k,{type:'integer'}]));
 const r=validateForm(Object.fromEntries(keys.map(k=>[k,'wrong'])),{type:'object',properties:props});
 assert.deepEqual(r.errors.map(x=>x.pointer),['/a~1b','/x~0y','/name.with.dot','/[key]','/quote"x']);
});
test('schema-level error has an empty root pointer',()=>{
 const r=validateForm({}, {type:'object',unrecognized:true});
 assert.equal(r.errors[0].pointer,'');assert.equal(r.errors[0].code,'UNKNOWN_SCHEMA_RULE');
});
test('malformed paths are rejected by pointer converter',()=>{
 for(const bad of ['', 'email','$.','$.x[abc]','$["bad"'])assert.throws(()=>pathToPointer(bad));
 assert.equal(pathToPointer('$'),'');
});
