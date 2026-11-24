#!/usr/bin/env node
import {readFileSync, statSync} from 'node:fs';
import process from 'node:process';
import {createValidator, validateBatch, explainError, inspectFormSchema} from '../src/index.js';
import {inferFormSchema} from '../src/infer.js';
import {summarizeFormBatch} from '../src/report.js';

const LIMIT=1048576;
const decodeUTF8=data=>new TextDecoder('utf-8',{fatal:true}).decode(data);
const USAGE=`Usage: form-path-explainer --schema rules.json [--input data.json] [--batch | --jsonl] [--format json|jsonl|csv] [--locale en|ko] [--summary]\n       form-path-explainer --check-schema --schema rules.json\n       form-path-explainer --infer [--input sample.json] [--jsonl] [--closed]\nReads stdin if --input is omitted. JSON and CSV are written to stdout.\nExit: 0 all valid, 1 validation errors, 2 invalid arguments/input.\n`;
function options(args) {
 const o={format:'json',locale:'en',batch:false,jsonl:false,infer:false,closed:false,summary:false,checkSchema:false};
 const seen=new Set();
 for(let i=0;i<args.length;i++){
  const a=args[i];
  if(a==='--help'||a==='-h')return {help:true};
  if(['--schema','--input','--format','--locale'].includes(a)){
   if(!args[i+1]||args[i+1].startsWith('--'))throw Error('missing '+a+' value');
   const key=a.slice(2);
   if(seen.has(key))throw Error('duplicate '+a);
   seen.add(key);o[key]=args[++i];
  } else if(['--batch','--jsonl','--infer','--closed','--summary','--check-schema'].includes(a)){
   if(o[a.slice(2)])throw Error('duplicate '+a);
   o[a==='--check-schema'?'checkSchema':a.slice(2)]=true;
  } else throw Error('unknown argument '+a);
 }
 if(!o.infer&&!o.schema)throw Error('--schema is required');
 if(o.infer&&o.schema)throw Error('--schema is not accepted with --infer');
 if(o.closed&&!o.infer)throw Error('--closed requires --infer');
 if(o.infer&&(o.batch||o.summary||o.checkSchema||o.format!=='json'))throw Error('--infer requires default JSON output');
 if(o.checkSchema&&(o.infer||o.batch||o.jsonl||o.summary||o.closed||o.input||o.format!=='json'))throw Error('--check-schema requires rules only and JSON output');
 if(o.summary&&(!o.batch&&!o.jsonl||o.format!=='json'))throw Error('--summary requires batch or JSONL with JSON output');
 if(o.batch&&o.jsonl)throw Error('--batch and --jsonl are mutually exclusive');
 if(!['json','jsonl','csv'].includes(o.format))throw Error('unsupported output format');
 if(!['en','ko'].includes(o.locale))throw Error('unsupported locale');
 return o;
}
function readBoundedFile(path){
 if(statSync(path).size>LIMIT)throw new RangeError('input exceeds 1 MiB');
 const data=readFileSync(path);
 if(data.byteLength>LIMIT)throw new RangeError('input exceeds 1 MiB');
 return decodeUTF8(data);
}
async function readStdin(){
 const parts=[];let bytes=0;
 for await(const part of process.stdin){
  const data=typeof part==='string'?Buffer.from(part):part;
  bytes+=data.byteLength;
  if(bytes>LIMIT)throw new RangeError('input exceeds 1 MiB');
  parts.push(data);
 }
 return decodeUTF8(Buffer.concat(parts));
}
function csvCell(x){return '"'+String(x??'').replaceAll('"','""')+'"';}
function output(result, format, locale){
 if(format==='json')return JSON.stringify(result,null,2)+'\n';
 const rows=result.results??[{index:0,...result}];
 if(format==='jsonl')return rows.map(row=>JSON.stringify(row)).join('\n')+(rows.length?'\n':'');
 const entries=[['index','valid','path','pointer','code','expected','limit','message']];
 for(const row of rows){
  if(row.valid){entries.push([row.index,true,'','','','','','']);continue;}
  for(const error of row.errors)entries.push([row.index,false,error.path,error.pointer,error.code,error.expected??'',error.limit??'',explainError(error,locale)]);
 }
 return entries.map(row=>row.map(csvCell).join(',')).join('\n')+'\n';
}
async function main(){
 try {
  const args=options(process.argv.slice(2));
  if(args.help){process.stdout.write(USAGE);return;}
  if(args.checkSchema){
   const inspected=inspectFormSchema(JSON.parse(readBoundedFile(args.schema)));
   process.stdout.write(JSON.stringify(inspected,null,2)+'\n');
   if(!inspected.valid)process.exitCode=1;
   return;
  }
  const input=args.input?readBoundedFile(args.input):await readStdin();
  if(args.infer){
   const samples=args.jsonl?input.split(/\r?\n/).filter(line=>line.trim()).map(line=>JSON.parse(line)):JSON.parse(input);
   process.stdout.write(JSON.stringify(inferFormSchema(samples,{closedObjects:args.closed}),null,2)+'\n');
   return;
  }
  const schema=JSON.parse(readBoundedFile(args.schema));
  const check=createValidator(schema);
  let result;
  if(args.jsonl){
   const lines=input.split(/\r?\n/).filter(line=>line.trim());
   if(lines.length===0)throw new TypeError('empty input');
   if(lines.length>100)throw new RangeError('batch too large');
   const rows=lines.map(line=>JSON.parse(line));
   result=args.summary?summarizeFormBatch(rows,schema,{locale:args.locale}):validateBatch(rows,schema);
  } else {
   const value=JSON.parse(input);
   if(args.batch&&(!Array.isArray(value)||value.length===0))throw new TypeError('expected nonempty array');
   result=args.batch?(args.summary?summarizeFormBatch(value,schema,{locale:args.locale}):validateBatch(value,schema)):check(value);
  }
  process.stdout.write(output(result,args.format,args.locale));
  if(args.summary?result.failed>0:!result.valid)process.exitCode=1;
 }catch(error){
  process.stderr.write('Form Path Explainer: '+(error instanceof SyntaxError?'invalid JSON input':error instanceof RangeError?'input exceeds policy limit':error instanceof TypeError?'invalid data type':error.message)+'\n');
  process.exitCode=2;
 }
}
await main();
