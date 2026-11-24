import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeFormBatch} from '../src/report.js';
const schema={type:'object',required:['email'],properties:{email:{type:'string',format:'email'},age:{type:'integer',minimum:18}}};
test('summarizes invalid fields across multiple records',()=>{
 const rows=[{email:'bad',age:17},{email:'bad',age:20},{email:'good@example.com',age:17},{age:22}];
 const report=summarizeFormBatch(rows,schema);
 assert.deepEqual([report.rows,report.passed,report.failed,report.totalErrors],[4,0,4,5]);
 const email=report.issues.find(x=>x.code==='INVALID_EMAIL');
 const age=report.issues.find(x=>x.code==='BELOW_MINIMUM');
 assert.equal(email.affectedRows,2);assert.equal(email.percentOfRows,50);
 assert.deepEqual(email.exampleIndices,[0,1]);
 assert.equal(age.affectedRows,2);assert.equal(age.limit,18);
 assert.equal(report.issues.find(x=>x.code==='REQUIRED').affectedRows,1);
});
test('summary is private and does not repeat submitted values',()=>{
 const secret='valuable-private-customer-value';
 const report=summarizeFormBatch([{email:secret}],schema);
 assert.doesNotMatch(JSON.stringify(report),new RegExp(secret));
});
test('localized messages are included for per-field issues',()=>{
 const report=summarizeFormBatch([{email:'bad',age:10}],schema,{locale:'ko'});
 const low=report.issues.find(x=>x.code==='BELOW_MINIMUM');
 assert.match(low.message,/최솟값/);assert.match(low.message,/18/);
});
test('valid batch has no issues',()=>{
 const r=summarizeFormBatch([{email:'a@b.com',age:30}],schema);
 assert.equal(r.passed,1);assert.equal(r.issues.length,0);assert.equal(r.totalErrors,0);
});
test('empty batch produces valid zero-record report',()=>{
 const r=summarizeFormBatch([],schema);assert.equal(r.rows,0);assert.equal(r.issues.length,0);
});
test('invalid schema is reported on every record',()=>{
 const r=summarizeFormBatch([{x:1},{x:2}],{type:'object',pattern:'unused'});
 assert.equal(r.issues.length,1);assert.equal(r.issues[0].code,'UNKNOWN_SCHEMA_RULE');
 assert.equal(r.issues[0].affectedRows,2);
});
test('issue report limits example record indices to five',()=>{
 const rows=Array(20).fill(null).map(()=>({email:'invalid'}));
 const r=summarizeFormBatch(rows,schema);
 assert.deepEqual(r.issues[0].exampleIndices,[0,1,2,3,4]);
 assert.equal(r.issues[0].affectedRows,20);
});
test('locale and batch caps are validated',()=>{
 assert.throws(()=>summarizeFormBatch([],schema,{locale:'xx'}),RangeError);
 assert.throws(()=>summarizeFormBatch(Array(101),schema),RangeError);
});
