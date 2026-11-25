import test from 'node:test';
import assert from 'node:assert/strict';
import {compareFormFixtures,suggestRequiredWitness} from '../src/regression.js';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const j=JSON.stringify,old=j({type:'string',minLength:2}),next=j({type:'string',minLength:3});
test('detects new rejection and unchanged verdicts',()=>{
 const r=compareFormFixtures(j(['a','ab','abc']),old,next);
 assert.deepEqual(r.counts,{unchangedAccepted:1,unchangedRejected:1,newlyRejected:1,newlyAccepted:0,indeterminate:0});
 assert.equal(r.results[1].category,'newlyRejected');assert.equal(r.comparable,true);
});
test('detects newly accepted values',()=>assert.equal(compareFormFixtures(j(['ab']),next,old).hasNewAcceptances,true));
test('does not echo values or schema field names',()=>{
 const schema=j({type:'object',properties:{PRIVATE_FIELD:{type:'string'}}});
 const r=compareFormFixtures(j([{PRIVATE_FIELD:'PRIVATE_VALUE'}]),schema,schema);
 assert.ok(!j(r).includes('PRIVATE'));
});
test('unsupported schemas fail closed',()=>assert.throws(()=>compareFormFixtures(j(['abc']),old,j({type:'string',pattern:'.*'})),TypeError));
test('validation resource caps are indeterminate',()=>{
 const schema=j({type:'array',items:{type:'number'}});
 const r=compareFormFixtures(j([Array(101).fill(1)]),schema,schema);
 assert.equal(r.comparable,false);assert.equal(r.counts.indeterminate,1);
});
test('fixture count and byte bounds',()=>{
 assert.throws(()=>compareFormFixtures('[]',old,next),RangeError);
 assert.throws(()=>compareFormFixtures(j(Array(101).fill('abc')),old,next),RangeError);
 assert.throws(()=>compareFormFixtures(j(['x'.repeat(1048576)]),old,next),RangeError);
});
test('CLI reports change, same and invalid input without leaking file names',()=>{
 const dir=mkdtempSync(join(tmpdir(),'form-regression-'));
 try{
  const a=join(dir,'PRIVATE_A'),b=join(dir,'PRIVATE_B'),c=join(dir,'PRIVATE_C');
  writeFileSync(a,old);writeFileSync(b,next);writeFileSync(c,j(['ab']));
  const run=(...args)=>spawnSync(process.execPath,['bin/regression.js',...args],{encoding:'utf8'});
  assert.equal(run(a,b,c).status,1);assert.equal(run(a,a,c).status,0);
  const invalid=run(a,b,join(dir,'PRIVATE_MISSING'));assert.equal(invalid.status,2);assert.ok(!invalid.stderr.includes('PRIVATE'));
  writeFileSync(c,Buffer.from([255]));assert.equal(run(a,b,c).status,2);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('regression rejects ambiguous and non-finite fixtures or schemas',()=>{
 assert.throws(()=>compareFormFixtures('[{"x":1,"\\u0078":2}]',old,next),SyntaxError);
 assert.throws(()=>compareFormFixtures('["ab"]','{"type":"string","minLength":2,"minLength":0}',next),SyntaxError);
 assert.throws(()=>compareFormFixtures('[1e999]',j({type:'number'}),j({type:'number'})),RangeError);
 assert.throws(()=>compareFormFixtures('['.repeat(70)+'0'+']'.repeat(70),old,next),RangeError);
});
test('regression preserves valid escaped string content',()=>{
 const r=compareFormFixtures('["a\\u0062"]',old,next);
 assert.equal(r.counts.newlyRejected,1);
});

test('finds a verified required-field counterexample without copying enum values',()=>{
 const before={type:'object',properties:{id:{type:'string'},'new/~key':{type:'integer'}},required:['id'],additionalProperties:false};
 const after={...before,required:['id','new/~key']};
 const w=suggestRequiredWitness(j(before),j(after));
 assert.equal(w.status,'found');assert.equal(w.addedRequiredCount,1);
 assert.equal(j(w.fixture),j({id:''}));
 assert.equal(compareFormFixtures(j([w.fixture]),j(before),j(after)).counts.newlyRejected,1);
 assert.deepEqual(suggestRequiredWitness(j(after),j(before)),{status:'not_proven'});
 assert.deepEqual(suggestRequiredWitness(j({...before,properties:{id:{type:'string',enum:['PRIVATE']}}}),j(after)),{status:'not_proven'});
 assert.deepEqual(suggestRequiredWitness(j({type:'object',required:['id'],additionalProperties:false}),j(after)),{status:'not_proven'});
});
test('never reports unsupported rules or unsuccessful generation as proven',()=>{
 assert.deepEqual(suggestRequiredWitness(old,next),{status:'not_proven'});
 assert.throws(()=>suggestRequiredWitness('{"type":"object","type":"string"}',next),SyntaxError);
 assert.throws(()=>suggestRequiredWitness(old,j({type:'object',pattern:'x'})),TypeError);
});
