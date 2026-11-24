import test from 'node:test';
import assert from 'node:assert/strict';
import {createFormHttpHandler} from '../src/http.js';
const url='https://api.invalid/validate';
const schema={type:'object',required:['age'],properties:{age:{type:'integer',minimum:18}},additionalProperties:false};
const mk=(body,type='application/json')=>new Request(url,{method:'POST',headers:{'content-type':type},body});
const handler=(extra={})=>createFormHttpHandler({authorize:async()=>true,consumeQuota:async()=>true,...extra});
test('handler requires explicit authorization and quota functions',()=>{
 assert.throws(()=>createFormHttpHandler({authorize:()=>true}),TypeError);
 assert.throws(()=>createFormHttpHandler({consumeQuota:()=>true}),TypeError);
 for(const maxBytes of [NaN,0,1.5,1048577,-2])assert.throws(()=>handler({maxBytes}),RangeError);
});
test('auth denial cannot consume quota or echo payload',async()=>{
 let calls=0;const h=handler({authorize:()=>false,consumeQuota:()=>{calls++;return true;}});
 const r=await h(mk('sensitive secret'));assert.equal(r.status,401);assert.equal(calls,0);
 assert.deepEqual(await r.json(),{error:'UNAUTHORIZED'});
});
test('quota denial happens before reading untrusted data',async()=>{
 const h=handler({consumeQuota:()=>false});
 const r=await h(mk('not-json'));assert.equal(r.status,429);
});
test('value validation returns errors with paths and JSON pointers',async()=>{
 const r=await handler()(mk(JSON.stringify({schema,value:{age:10}})));
 assert.equal(r.status,200);const json=await r.json();assert.equal(json.valid,false);
 assert.equal(json.errors[0].path,'$.age');assert.equal(json.errors[0].pointer,'/age');
 assert.equal(json.errors[0].limit,18);
});
test('valid form returns an empty error list without hosting a server',async()=>{
 const r=await handler()(mk(JSON.stringify({schema,value:{age:20}})));
 assert.equal(r.status,200);assert.deepEqual(await r.json(),{valid:true,errors:[]});
 assert.equal(r.headers.get('cache-control'),'no-store');
 assert.equal(r.headers.get('access-control-allow-origin'),null);
});
test('batch validates multiple submissions and sums outcomes',async()=>{
 const rows=[{age:20},{age:17},{}];
 const r=await handler()(mk(JSON.stringify({schema,values:rows})));
 assert.equal(r.status,200);const result=await r.json();
 assert.deepEqual([result.count,result.passed,result.failed],[3,1,2]);
 assert.equal(result.results[1].errors[0].pointer,'/age');
});
test('invalid request structure is rejected',async()=>{
 for(const body of ['{}','[]','null',JSON.stringify({schema,value:{age:20},values:[]}),JSON.stringify({schema,values:[]})]){
  const r=await handler()(mk(body));assert.equal(r.status,400,body);
 }
});
test('malformed JSON does not echo submitted text',async()=>{
 const secret='"private-value"';
 const r=await handler()(mk('{"schema":'+secret));
 assert.equal(r.status,400);assert.doesNotMatch(await r.text(),/private-value/);
});
test('body limit enforces actual bytes',async()=>{
 const data=JSON.stringify({schema,value:{age:20}});
 const r=await handler({maxBytes:8})(mk(data));
 assert.equal(r.status,413);assert.equal((await r.json()).error,'PAYLOAD_TOO_LARGE');
});
test('unsupported content type is rejected early',async()=>{
 const r=await handler()(mk('{}','text/plain'));assert.equal(r.status,415);
});
test('GET and preflight OPTIONS have strict method and CORS behavior',async()=>{
 for(const method of ['GET','OPTIONS']){
  const r=await handler()(new Request(url,{method}));
  assert.equal(r.status,405);assert.equal(r.headers.get('allow'),'POST');
  assert.equal(r.headers.get('access-control-allow-origin'),null);
 }
});
test('failing authorization and unavailable quota fail closed',async()=>{
 const a=await handler({authorize:()=>{throw Error('secret');}})(mk('{}'));assert.equal(a.status,401);
 const q=await handler({consumeQuota:()=>{throw Error('unavailable');}})(mk('{}'));
 assert.equal(q.status,503);assert.doesNotMatch(await q.text(),/unavailable/);
});
test('content length header mismatch cannot bypass byte limit',async()=>{
 const body=JSON.stringify({schema,value:{age:20}});
 const r=await handler({maxBytes:30})(new Request(url,{method:'POST',headers:{'content-type':'application/json','content-length':'1'},body}));
 assert.equal(r.status,413);
});
