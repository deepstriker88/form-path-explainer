import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const cli=new URL('../bin/cli.js',import.meta.url).pathname;
function fixture(fn){const dir=mkdtempSync(join(tmpdir(),'fpe-test-'));const schema=join(dir,'schema.json');writeFileSync(schema,JSON.stringify({type:'object',required:['age'],properties:{age:{type:'integer',minimum:18}},additionalProperties:false}));try{return fn(schema,dir);}finally{rmSync(dir,{recursive:true,force:true});}}
function run(schema,args=[],input=''){return spawnSync(process.execPath,[cli,'--schema',schema,...args],{input,encoding:'utf8',timeout:3000});}
test('CLI validates stdin and uses exit code 0',()=>fixture(schema=>{const r=run(schema,[],JSON.stringify({age:20}));assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).valid,true);}));
test('CLI reports validation failure exit code 1 with precise path',()=>fixture(schema=>{const r=run(schema,[],JSON.stringify({age:10}));assert.equal(r.status,1);assert.equal(JSON.parse(r.stdout).errors[0].path,'$.age');}));
test('CLI JSONL batch returns separate records',()=>fixture(schema=>{const r=run(schema,['--jsonl','--format','jsonl'],'{"age":20}\n{"age":15}\n');assert.equal(r.status,1);const rows=r.stdout.trim().split('\n').map(JSON.parse);assert.equal(rows.length,2);assert.equal(rows[1].index,1);assert.equal(rows[1].errors[0].code,'BELOW_MINIMUM');}));
test('CLI CSV report includes machine-readable error codes',()=>fixture(schema=>{const r=run(schema,['--batch','--format','csv'],'[{"age":20},{"age":17}]');assert.equal(r.status,1);assert.match(r.stdout,/"index","valid","path","pointer","code","expected","limit","message"/);assert.match(r.stdout,/"BELOW_MINIMUM"/);}));
test('CLI rejects malformed JSON and unknown arguments',()=>fixture(schema=>{const invalid=run(schema,[],'not json');assert.equal(invalid.status,2);assert.equal(invalid.stdout,'');assert.doesNotMatch(invalid.stderr,/not json/);assert.equal(run(schema,['--bogus'],'{}').status,2);}));
test('CLI enforces 100 record limit',()=>fixture(schema=>{const r=run(schema,['--batch'],JSON.stringify(Array.from({length:101},()=>({age:20}))));assert.equal(r.status,2);}));
test('CLI can read JSON file without network or service',()=>fixture((schema,dir)=>{const input=join(dir,'data.json');writeFileSync(input,'{"age":20}');const r=run(schema,['--input',input]);assert.equal(r.status,0);assert.equal(JSON.parse(r.stdout).valid,true);}));
test('CLI help documents usage without a schema',()=>{const r=spawnSync(process.execPath,[cli,'--help'],{encoding:'utf8'});assert.equal(r.status,0);assert.match(r.stdout,/Usage:/);});
test('CLI CSV localizes minimum rule errors without exposing input',()=>fixture(schema=>{
 const r=run(schema,['--format','csv','--locale','ko'],JSON.stringify({age:10}));
 assert.equal(r.status,1);assert.match(r.stdout,/최솟값/);assert.match(r.stdout,/"18"/);
 assert.doesNotMatch(r.stdout,/"10"/);
}));
test('CLI rejects unsupported locale with input error exit code',()=>fixture(schema=>{
 assert.equal(run(schema,['--locale','fr'],'{"age":20}').status,2);
}));
test('CLI infers a reusable schema from sample records',()=>{
 const rows=[{name:'Alice',age:30},{name:'Bob'}];
 const r=spawnSync(process.execPath,[cli,'--infer'],{input:JSON.stringify(rows),encoding:'utf8',timeout:3000});
 assert.equal(r.status,0,r.stderr);const data=JSON.parse(r.stdout);
 assert.equal(data.records,2);assert.deepEqual(data.schema.required,['name']);
 assert.equal(data.schema.properties.age.type,'integer');
 assert.doesNotMatch(r.stdout,/Alice|Bob/);
});
test('CLI inferred schema can be immediately used for validation',()=>fixture((_,dir)=>{
 const rows=[{name:'Alice',age:30},{name:'Bob',age:20}];
 const inferred=spawnSync(process.execPath,[cli,'--infer','--closed'],{input:JSON.stringify(rows),encoding:'utf8',timeout:3000});
 assert.equal(inferred.status,0,inferred.stderr);
 const generated=join(dir,'generated-schema.json');writeFileSync(generated,JSON.stringify(JSON.parse(inferred.stdout).schema));
 const ok=run(generated,[],JSON.stringify({name:'Zoe',age:21}));assert.equal(ok.status,0,ok.stderr);
 const notOk=run(generated,[],JSON.stringify({name:'Zoe',age:21,extra:'unexpected'}));assert.equal(notOk.status,1);assert.equal(JSON.parse(notOk.stdout).errors[0].code,'ADDITIONAL_PROPERTY');
}));
test('CLI supports NDJSON sample inference',()=>{
 const r=spawnSync(process.execPath,[cli,'--infer','--jsonl'],{input:'{"age":20}\n{"age":21}\n',encoding:'utf8',timeout:3000});
 assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).records,2);
});
test('CLI inference fails without leaking sample values for mixed types',()=>{
 const bad='secret-value-do-not-print';const r=spawnSync(process.execPath,[cli,'--infer'],{input:JSON.stringify([{password:bad},{password:42}]),encoding:'utf8',timeout:3000});
 assert.equal(r.status,2);assert.equal(r.stdout,'');assert.doesNotMatch(r.stderr,/secret-value-do-not-print/);
});
test('CLI --infer rejects --schema and output CSV conflicts',()=>fixture(schema=>{
 assert.equal(run(schema,['--infer'],'[]').status,2);
 const r=spawnSync(process.execPath,[cli,'--infer','--format','csv'],{input:'[]',encoding:'utf8'});assert.equal(r.status,2);
}));
test('CLI empty batch cannot report a false success',()=>fixture(schema=>{
 assert.equal(run(schema,['--batch'],'[]').status,2);
 assert.equal(run(schema,['--jsonl'],'').status,2);
 assert.equal(run(schema,['--batch'],'{}').status,2);
}));
test('CLI summary groups field failures without raw input',()=>fixture(schema=>{
 const rows=[{age:17},{age:15},{age:20}];
 const r=run(schema,['--batch','--summary'],JSON.stringify(rows));
 assert.equal(r.status,1,r.stderr);const report=JSON.parse(r.stdout);
 assert.equal(report.rows,3);assert.equal(report.failed,2);
 assert.equal(report.issues[0].code,'BELOW_MINIMUM');assert.equal(report.issues[0].affectedRows,2);
 assert.equal(report.issues[0].percentOfRows,66.67);assert.deepEqual(report.issues[0].exampleIndices,[0,1]);
 assert.ok(!Object.hasOwn(report,'results'));
}));
test('CLI summary supports JSONL and Korean issue explanations',()=>fixture(schema=>{
 const r=run(schema,['--jsonl','--summary','--locale','ko'],'{"age":10}\n{"age":18}\n');
 assert.equal(r.status,1,r.stderr);assert.match(JSON.parse(r.stdout).issues[0].message,/최솟값/);
}));
test('CLI summary requires batch input and JSON output',()=>fixture(schema=>{
 assert.equal(run(schema,['--summary'],'{"age":10}').status,2);
 assert.equal(run(schema,['--batch','--summary','--format','csv'],'[{"age":10}]').status,2);
}));
test('CLI rejects invalid UTF-8 bytes instead of replacing them',()=>fixture((schema,dir)=>{
 const file=join(dir,'invalid.bin');writeFileSync(file,Buffer.from([0xff,0xfe,0x7b,0x7d]));
 const r=run(schema,['--input',file]);assert.equal(r.status,2);assert.equal(r.stdout,'');
}));
test('CLI accepts UTF-8 BOM in JSON files',()=>fixture((schema,dir)=>{
 const file=join(dir,'bom.json');writeFileSync(file,Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),Buffer.from('{"age":21}')]));
 const r=run(schema,['--input',file]);assert.equal(r.status,0,r.stderr);
}));
test('CLI checks complete schema without requiring form input',()=>fixture((_,dir)=>{
 const file=join(dir,'rules.json');writeFileSync(file,JSON.stringify({type:'object',properties:{missing:{type:'string',minLength:3}}}));
 const r=spawnSync(process.execPath,[cli,'--check-schema','--schema',file],{encoding:'utf8',timeout:3000});
 assert.equal(r.status,0,r.stderr);assert.deepEqual(JSON.parse(r.stdout),{valid:true,errors:[]});
}));
test('CLI schema preflight catches invalid optional nested rules',()=>fixture((_,dir)=>{
 const file=join(dir,'rules.json');writeFileSync(file,JSON.stringify({type:'object',properties:{missing:{type:'string',minLength:-1}}}));
 const r=spawnSync(process.execPath,[cli,'--check-schema','--schema',file],{encoding:'utf8',timeout:3000});
 assert.equal(r.status,1,r.stderr);assert.equal(JSON.parse(r.stdout).errors[0].code,'INVALID_LENGTH_RULE');
}));
test('CLI schema checker cannot be combined with input modes',()=>fixture(schema=>{
 for(const args of [['--input','data.json'],['--batch'],['--jsonl'],['--summary'],['--format','csv']]){
  const r=spawnSync(process.execPath,[cli,'--check-schema','--schema',schema,...args],{encoding:'utf8',timeout:3000});
  assert.equal(r.status,2,JSON.stringify(args));
 }
}));
