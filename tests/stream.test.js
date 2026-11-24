import test from 'node:test';
import assert from 'node:assert/strict';
import {validateJsonlStream} from '../src/stream.js';
const schema={type:'object',required:['ok'],properties:{ok:{type:'boolean'}}};
async function collect(chunks, options={}) {
 return Array.fromAsync ? Array.fromAsync(validateJsonlStream(chunks,schema,options)) :
  (async()=>{const out=[];for await(const r of validateJsonlStream(chunks,schema,options))out.push(r);return out;})();
}
async function* source(...chunks){for(const chunk of chunks)yield chunk;}
test('validates split UTF8, CRLF and blank lines',async()=>{
 const input=new TextEncoder().encode('{"ok":true}\r\n\n{"ok":false}\n');
 const rows=await collect(source(input.slice(0,4),input.slice(4,13),input.slice(13)));
 assert.deepEqual(rows.map(x=>[x.index,x.line,x.valid]),[[0,1,true],[1,3,true]]);
});
test('returns privacy-safe invalid JSON and field errors',async()=>{
 const rows=await collect(source('{"ok":12}\n{"secret":"private"}\nnot-json\n'));
 assert.deepEqual(rows.map(x=>x.errors[0].code),['TYPE_MISMATCH','REQUIRED','INVALID_JSON']);
 assert.equal(JSON.stringify(rows).includes('private'),false);
});
test('supports BOM and no trailing newline',async()=>{
 const rows=await collect(source(new TextEncoder().encode('\ufeff{"ok":true}')));
 assert.equal(rows[0].valid,true);
});
test('rejects malformed UTF8 and overlong lines',async()=>{
 await assert.rejects(()=>collect(source(Uint8Array.of(0xc3,0x28))),TypeError);
 await assert.rejects(()=>collect(source('{"ok":true}\n{"ok":false}'),{maxLineBytes:5}),RangeError);
});
test('rejects excess records and invalid configuration',async()=>{
 await assert.rejects(()=>collect(source('{}\n{}\n'),{maxRecords:1}),RangeError);
 await assert.rejects(()=>collect(source('{}'),{maxRecords:0}),RangeError);
 await assert.rejects(()=>collect(source(42)),TypeError);
});
test('supports 1000 records without retaining previous results',async()=>{
 let n=0;
 for await(const row of validateJsonlStream(source('{"ok":true}\n'.repeat(1000)),schema)){
   assert.equal(row.valid,true);n++;
 }
 assert.equal(n,1000);
});
test('line byte limit counts UTF8, not JavaScript code units',async()=>{
 const input='{"ok":true,"x":"é"}';
 const bytes=new TextEncoder().encode(input).length;
 assert.equal((await collect(source(input),{maxLineBytes:bytes})).length,1);
 await assert.rejects(()=>collect(source(input),{maxLineBytes:bytes-1}),RangeError);
 assert.equal((await collect(source(input+'\r\n'),{maxLineBytes:bytes})).length,1);
});
test('strict UTF8 rejects incomplete final multibyte sequence',async()=>{
 await assert.rejects(()=>collect(source(Uint8Array.of(0x7b,0xc3))),TypeError);
});
test('schema preflight errors are reported without exposing data',async()=>{
 const rows=[];
 for await(const row of validateJsonlStream(source('{"secret":"x"}\n'),{type:'object',properties:{x:{type:'unsupported'}}}))rows.push(row);
 assert.equal(rows[0].errors[0].code,'UNSUPPORTED_TYPE');
 assert.equal(JSON.stringify(rows).includes('secret'),false);
});

test('mixed string and byte chunks preserve split UTF8 and line boundaries', async()=>{
 const rows=await collect(source('{"ok":true}\n',Uint8Array.of(0x7b,0x22,0x6f,0x6b,0x22,0x3a,0x74,0x72,0x75,0x65,0x7d,0x0a)));
 assert.deepEqual(rows.map(r=>[r.line,r.valid]),[[1,true],[2,true]]);
});
test('mixed chunks cannot silently repair invalid UTF8', async()=>{
 await assert.rejects(()=>collect(source(Uint8Array.of(0xc3),'x')),TypeError);
});
test('split multibyte code point survives byte chunk boundaries', async()=>{
 const rows=await collect(source(Uint8Array.of(0x7b,0x22,0x78,0x22,0x3a,0x22,0xc3),Uint8Array.of(0xa9,0x22,0x2c,0x22,0x6f,0x6b,0x22,0x3a,0x74,0x72,0x75,0x65,0x7d)));
 assert.equal(rows[0].valid,true);
});
