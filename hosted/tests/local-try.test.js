import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
test('browser module uses original core; no input transport; bounds',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'local-try-'));
 try {
 const tool=await readFile(new URL('../public/try.js',import.meta.url),'utf8');
 assert.doesNotMatch(tool,/\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|localStorage|sessionStorage)\b/);
 await writeFile(path.join(dir,'package.json'),'{"type":"module"}');
 await writeFile(path.join(dir,'tool.js'),tool);
 await writeFile(path.join(dir,'core.js'),await readFile(new URL('../../src/index.js',import.meta.url)));
 await writeFile(path.join(dir,'strict-json.js'),await readFile(new URL('../../src/strict-json.js',import.meta.url)));
 const {check}=await import(pathToFileURL(path.join(dir,'tool.js')));
 assert.equal(check({value:'{"email":"bad"}',schema:'{"type":"object","properties":{"email":{"type":"string","format":"email"}}}'}).valid,false);
  assert.equal(check({value:'{"email":"user@example.com"}',schema:'{"type":"object","properties":{"email":{"type":"string","format":"email"}}}'}).valid,true);
 assert.throws(()=>check({value:'{"x":1,"x":2}',schema:'{"type":"object"}'}),SyntaxError);
 assert.throws(()=>check({value:'{"x":1,"\\u0078":2}',schema:'{"type":"object"}'}),SyntaxError);
 assert.throws(()=>check({value:'1',schema:'{"type":"number","type":"integer"}'}),SyntaxError);
 assert.throws(()=>check({value:'1e999',schema:'{"type":"number"}'}),RangeError);
 assert.throws(()=>check({value:'['.repeat(66)+'0'+']'.repeat(66),schema:'{"type":"array"}'}),RangeError);
 assert.equal(check({value:'{"x":"a\\\\b"}',schema:'{"type":"object","properties":{"x":{"type":"string"}}}'}).valid,true);
 assert.throws(()=>check({value:'x'.repeat(65537),schema:'{}',mode:'single',format:'email'}),RangeError);
 assert.throws(()=>check({value:'한'.repeat(22000),schema:'{}',mode:'single',format:'email'}),RangeError);
 } finally {await rm(dir,{recursive:true,force:true});}
});
