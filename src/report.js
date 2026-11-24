// Produce a privacy-minimized, deterministic report of form validation failures.
// Only field paths, error codes, counts and bounded sample indices are returned.
import {validateBatch,explainError} from './index.js';
export function summarizeFormBatch(values,schema,{maxItems=100,locale='en'}={}){
 if(!['en','ko'].includes(locale))throw new RangeError('unsupported locale');
 const result=validateBatch(values,schema,{maxItems});
 const grouped=new Map();
 let totalErrors=0;
 for(const row of result.results){
  const seen=new Set();
  for(const issue of row.errors){
   totalErrors++;
   const key=issue.pointer+'\u0000'+issue.code;
   if(seen.has(key))continue;
   seen.add(key);
   let aggregate=grouped.get(key);
   if(!aggregate){
    aggregate={path:issue.path,pointer:issue.pointer,code:issue.code,affectedRows:0,exampleIndices:[],message:explainError(issue,locale)};
    if(issue.limit!==undefined)aggregate.limit=issue.limit;
    if(issue.expected!==undefined)aggregate.expected=issue.expected;
    grouped.set(key,aggregate);
   }
   aggregate.affectedRows++;
   if(aggregate.exampleIndices.length<5)aggregate.exampleIndices.push(row.index);
  }
 }
 const issues=[...grouped.values()].sort((a,b)=>
  b.affectedRows-a.affectedRows ||
  a.pointer.localeCompare(b.pointer,'en') ||
  a.code.localeCompare(b.code,'en')
 );
 for(const issue of issues){
  issue.percentOfRows=result.count?Math.round((issue.affectedRows/result.count)*10000)/100:0;
 }
 return {rows:result.count,passed:result.passed,failed:result.failed,totalErrors,issues};
}
