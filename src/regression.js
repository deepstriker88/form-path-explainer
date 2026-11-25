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

// Produce only a concrete, locally verified counterexample for newly required
// root keys. Never claim compatibility if the small generator finds none.
export function suggestRequiredWitness(beforeText,afterText){
 const before=parse(beforeText),after=parse(afterText);
 if(!inspectFormSchema(before).valid||!inspectFormSchema(after).valid)throw new TypeError('invalid or unsupported schema');
 const none={status:'not_proven'};
 if(before.type!=='object'||after.type!=='object')return none;
 const oldKeys=new Set(before.required||[]);
 const added=(after.required||[]).filter(k=>!oldKeys.has(k));
 if(!added.length)return none;
 const fixture=Object.create(null);
 const samples={string:'',number:0,integer:0,boolean:false,array:[],object:{}};
 for(const key of oldKeys){
  const rule=Object.hasOwn(before.properties||{},key)?before.properties[key]:null;
  // Do not copy enum literals or other potentially sensitive schema values.
  if(rule&&(!Object.hasOwn(samples,rule.type)||Object.keys(rule).length!==1))return none;
  fixture[key]=rule?samples[rule.type]:null;
 }
 const a=createValidator(before)(fixture),b=createValidator(after)(fixture);
 const pointers=new Set(added.map(k=>'/'+k.replaceAll('~','~0').replaceAll('/','~1')));
 if(!a.valid||verdict(b)!=='rejected'||!b.errors.some(e=>e.code==='REQUIRED'&&pointers.has(e.pointer)))return none;
 if(new TextEncoder().encode(JSON.stringify(fixture)).length>65536)return none;
 return {status:'found',fixture,addedRequiredCount:added.length};
}
