// Compare the supported form-rule subset on actual supplied JSON fixtures.
import {inspectFormSchema,createValidator} from './index.js';
import {strictJson} from './strict-json.js';
const LIMIT=1048576, MAX_FIXTURES=100;
const failures=new Set(['TYPE_MISMATCH','REQUIRED','ADDITIONAL_PROPERTY','TOO_SHORT','TOO_LONG','BELOW_MINIMUM','ABOVE_MAXIMUM','TOO_FEW_ITEMS','TOO_MANY_ITEMS_RULE','NOT_IN_ENUM','INVALID_EMAIL','INVALID_HOSTNAME']);
function parse(text){
 if(typeof text!=='string'||text.length>LIMIT||new TextEncoder().encode(text).length>LIMIT)throw new RangeError('input limit');
 return strictJson(text,{maxBytes:LIMIT});
}
function verdict(result){
 if(result.valid)return 'accepted';
 if(result.errors.length&&result.errors.every(e=>failures.has(e.code)))return 'rejected';
 return 'indeterminate';
}
export function compareFormFixtures(fixturesText,beforeText,afterText){
 const fixtures=parse(fixturesText),before=parse(beforeText),after=parse(afterText);
 if(!Array.isArray(fixtures)||!fixtures.length||fixtures.length>MAX_FIXTURES)throw new RangeError('expected 1 to 100 fixtures');
 if(!inspectFormSchema(before).valid||!inspectFormSchema(after).valid)throw new TypeError('invalid or unsupported schema');
 const oldCheck=createValidator(before),newCheck=createValidator(after);
 const counts={unchangedAccepted:0,unchangedRejected:0,newlyRejected:0,newlyAccepted:0,indeterminate:0};
 const results=[];
 for(let i=0;i<fixtures.length;i++){
  const a=verdict(oldCheck(fixtures[i])),b=verdict(newCheck(fixtures[i]));
  const category=a==='indeterminate'||b==='indeterminate'?'indeterminate':a==='accepted'?(b==='accepted'?'unchangedAccepted':'newlyRejected'):(b==='accepted'?'newlyAccepted':'unchangedRejected');
  counts[category]++;
  results.push({index:i,before:a,after:b,category});
 }
 return {count:fixtures.length,counts,results,comparable:counts.indeterminate===0,hasNewRejections:counts.newlyRejected>0,hasNewAcceptances:counts.newlyAccepted>0};
}
