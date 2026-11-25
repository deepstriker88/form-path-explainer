import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
test('comparison workspace uses actual core and produces actionable redacted reports',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'review-test-'));
 try{
  await writeFile(path.join(dir,'package.json'),'{"type":"module"}');
  const source=await readFile(new URL('../public/review.js',import.meta.url),'utf8');
  await writeFile(path.join(dir,'review.js'),source);
  await writeFile(path.join(dir,'index.js'),await readFile(new URL('../../src/index.js',import.meta.url)));
  await writeFile(path.join(dir,'strict-json.js'),await readFile(new URL('../../src/strict-json.js',import.meta.url)));
  await writeFile(path.join(dir,'regression.js'),await readFile(new URL('../../src/regression.js',import.meta.url)));
  const {check,describe}=await import(pathToFileURL(path.join(dir,'review.js')));
  const before='{"type":"string","minLength":2}',after='{"type":"string","minLength":3}';
  const fixtures='["a","ab","PRIVATE_FIXTURE"]';
  const report=check({before,after,fixtures});
  assert.equal(report.counts.newlyRejected,1);
  assert.equal(describe(report).state,'fail');
  assert.doesNotMatch(JSON.stringify(report),/PRIVATE_FIXTURE/);
  assert.equal(describe(check({before,after:before,fixtures})).state,'pass');
  assert.equal(describe(check({before:after,after:before,fixtures})).state,'fail');
  const schema='{"type":"array","items":{"type":"number"}}';
  assert.equal(describe(check({before:schema,after:schema,fixtures:JSON.stringify([Array(101).fill(1)])})).state,'incomparable');
  assert.throws(()=>check({before,after,fixtures:'x'.repeat(1048577)}),RangeError);
 }finally{await rm(dir,{recursive:true,force:true});}
});
