const blocked = new Set(['__proto__','prototype','constructor']);
const rulesByType={
 object:['required','properties','additionalProperties'],
 array:['items','minItems','maxItems'],
 string:['minLength','maxLength','format'],
 number:['minimum','maximum'],
 integer:['minimum','maximum'],
 boolean:[]
};
const knownRules=new Set(['type','enum',...Object.values(rulesByType).flat()]);
const childPath=(parent,key)=>/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)?parent+'.'+key:parent+'['+JSON.stringify(key)+']';
// RFC 6901 JSON Pointer, independent of human-readable path punctuation.
export function pathToPointer(path){
 if(typeof path!=='string'||!path.startsWith('$'))throw new TypeError('invalid path');
 let i=1;const tokens=[];
 while(i<path.length){
  let part;
  if(path[i]==='.'){
   const start=++i;
   while(i<path.length&&path[i]!=='.'&&path[i]!=='[')i++;
   if(i===start)throw new TypeError('invalid path');
   part=path.slice(start,i);
  }else if(path[i]==='['){
   const start=++i;
   if(path[i]==='"'){
    i++;let escaped=false;
    while(i<path.length){
     if(!escaped&&path[i]==='"')break;
     if(!escaped&&path[i]==='\\')escaped=true;
     else escaped=false;
     i++;
    }
    if(i>=path.length||path[i+1]!==']')throw new TypeError('invalid path');
    part=JSON.parse(path.slice(start,i+1));i+=2;
   }else{
    while(i<path.length&&/[0-9]/.test(path[i]))i++;
    if(start===i||path[i]!==']')throw new TypeError('invalid path');
    part=path.slice(start,i);i++;
   }
  }else throw new TypeError('invalid path');
  tokens.push(String(part).replaceAll('~','~0').replaceAll('/','~1'));
 }
 return tokens.length?'/'+tokens.join('/'):'';
}
const withPointers=errors=>errors.map(e=>({...e,pointer:pathToPointer(e.path)}));
const hostname = s => s.length<=253 && s.split('.').every(label=>label.length>=1&&label.length<=63&&/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label));
const email = s => {
 const at=s.lastIndexOf('@');
 return s.length<=254 && at>0 && at<=64 && !s.slice(0,at).startsWith('.') && !s.slice(0,at).endsWith('.') && !s.slice(0,at).includes('..') && !/\s/.test(s) && !s.slice(0,at).includes('@') && /^[A-Za-z0-9!#$%&'*+\-/=?^_`{|}~.]+$/.test(s.slice(0,at)) && hostname(s.slice(at+1)) && s.slice(at+1).includes('.');
};
const ownRule=(schema,key)=>Object.getOwnPropertyDescriptor(schema,key)?.value;
function walk(value,schema,path,errors,depth,ancestors,budget) {
 if(budget.exhausted||errors.length>=100)return;
 if(++budget.visits>10000){budget.exhausted=true;errors.push({path,code:'MAX_NODES'});return;}
 if(depth>12){errors.push({path,code:'MAX_DEPTH'});return;}
 if(!schema||typeof schema!=='object'||Array.isArray(schema)){errors.push({path,code:'INVALID_SCHEMA'});return;}
 // All schema rules are preflight-validated recursively before this traversal.
 // Runtime traversal checks only the value, not rules already proven valid.
 const type=ownRule(schema,'type');
 if(!['object','array','string','number','integer','boolean'].includes(type)){errors.push({path,code:'UNSUPPORTED_TYPE'});return;}
 const valid=type==='array'?Array.isArray(value):type==='object'?(value!==null&&typeof value==='object'&&!Array.isArray(value)):(type==='integer'?Number.isSafeInteger(value):typeof value===type&&(type!=='number'||Number.isFinite(value)));
 if(!valid){errors.push({path,code:'TYPE_MISMATCH',expected:type});return;}
 if(ownRule(schema,'enum')!==undefined&&!ownRule(schema,'enum').some(item=>Object.is(item,value))){errors.push({path,code:'NOT_IN_ENUM'});return;}
 if(value!==null&&typeof value==='object'){if(ancestors.has(value)){errors.push({path,code:'CYCLIC_VALUE'});return;}ancestors.add(value);}
 try {
 if(type==='string'){
  const minLength=ownRule(schema,'minLength'),maxLength=ownRule(schema,'maxLength'),format=ownRule(schema,'format');
  if(Number.isInteger(minLength)&&value.length<minLength)errors.push({path,code:'TOO_SHORT',limit:minLength});
  if(Number.isInteger(maxLength)&&value.length>maxLength&&errors.length<100)errors.push({path,code:'TOO_LONG',limit:maxLength});
  if(format==='email'&&!email(value)&&errors.length<100)errors.push({path,code:'INVALID_EMAIL'});
  if(format==='hostname'&&!hostname(value)&&errors.length<100)errors.push({path,code:'INVALID_HOSTNAME'});
 } else if(type==='number'||type==='integer'){
  const minimum=ownRule(schema,'minimum'),maximum=ownRule(schema,'maximum');
  if(minimum!==undefined&&value<minimum)errors.push({path,code:'BELOW_MINIMUM',limit:minimum});
  if(maximum!==undefined&&value>maximum&&errors.length<100)errors.push({path,code:'ABOVE_MAXIMUM',limit:maximum});
 } else if(type==='object'){
  const required=ownRule(schema,'required')||[];
  const props=ownRule(schema,'properties')||Object.create(null);
  const additionalProperties=ownRule(schema,'additionalProperties');
  const keys=Object.keys(value);
  if(keys.length>100){errors.push({path,code:'TOO_MANY_FIELDS'});return;}
  for(const key of keys){if(errors.length>=100)break;if(blocked.has(key))errors.push({path:childPath(path,key),code:'UNSAFE_KEY'});else if(!Object.hasOwn(Object.getOwnPropertyDescriptor(value,key),'value'))errors.push({path:childPath(path,key),code:'ACCESSOR_PROPERTY'});}
  for(const key of required){if(!Object.hasOwn(value,key)&&errors.length<100)errors.push({path:childPath(path,key),code:'REQUIRED'});}
  if(additionalProperties===false)for(const key of keys){if(errors.length>=100)break;if(!Object.hasOwn(props,key)&&!blocked.has(key))errors.push({path:childPath(path,key),code:'ADDITIONAL_PROPERTY'});}
  for(const key of Object.keys(props)){if(errors.length>=100)break;if(blocked.has(key)){errors.push({path,code:'UNSAFE_SCHEMA_KEY'});continue;}if(Object.hasOwn(value,key)){const descriptor=Object.getOwnPropertyDescriptor(value,key);if(!descriptor||!Object.hasOwn(descriptor,'value')){errors.push({path:childPath(path,key),code:'ACCESSOR_PROPERTY'});continue;}walk(descriptor.value,props[key],childPath(path,key),errors,depth+1,ancestors,budget);}}
 } else if(type==='array'){
  const items=ownRule(schema,'items'),minItems=ownRule(schema,'minItems'),maxItems=ownRule(schema,'maxItems');
  if(minItems!==undefined&&value.length<minItems)errors.push({path,code:'TOO_FEW_ITEMS',limit:minItems});
  if(maxItems!==undefined&&value.length>maxItems&&errors.length<100)errors.push({path,code:'TOO_MANY_ITEMS_RULE',limit:maxItems});
  if(value.length>100){errors.push({path,code:'TOO_MANY_ITEMS'});return;}
  if(items!==undefined)for(let i=0;i<value.length&&errors.length<100;i++){const descriptor=Object.getOwnPropertyDescriptor(value,String(i));if(descriptor&&!Object.hasOwn(descriptor,'value')){errors.push({path:path+'['+i+']',code:'ACCESSOR_PROPERTY'});continue;}walk(descriptor?.value,items,path+'['+i+']',errors,depth+1,ancestors,budget);}
 }
 } finally { if(value!==null&&typeof value==='object')ancestors.delete(value); }
}
function schemaRuleError(rules,keys){
 const type=rules.type;
 if(!['object','array','string','number','integer','boolean'].includes(type))return 'UNSUPPORTED_TYPE';
 for(const key of keys){
  if(!knownRules.has(key))return 'UNKNOWN_SCHEMA_RULE';
  if(key!=='type'&&key!=='enum'&&!rulesByType[type].includes(key))return 'INVALID_RULE_COMBINATION';
 }
 if(rules.required!==undefined){
  if(!Array.isArray(rules.required)||rules.required.length>100)return 'INVALID_REQUIRED';
  if(rules.required.some(k=>typeof k!=='string'||!k.length||blocked.has(k)))return 'INVALID_REQUIRED_KEY';
  if(new Set(rules.required).size!==rules.required.length)return 'DUPLICATE_REQUIRED';
 }
 if(rules.properties!==undefined){
  if(!rules.properties||typeof rules.properties!=='object'||Array.isArray(rules.properties))return 'INVALID_PROPERTIES';
  if(Reflect.ownKeys(rules.properties).some(k=>typeof k!=='string'||blocked.has(k)))return 'UNSAFE_SCHEMA_KEY';
 }
 if(rules.items!==undefined&&(!rules.items||typeof rules.items!=='object'||Array.isArray(rules.items)))return 'INVALID_SCHEMA';
 for(const k of ['minLength','maxLength','minItems','maxItems']){
  if(rules[k]!==undefined&&(!Number.isSafeInteger(rules[k])||rules[k]<0))return k.endsWith('Length')?'INVALID_LENGTH_RULE':'INVALID_ITEMS_RULE';
 }
 if(rules.minLength!==undefined&&rules.maxLength!==undefined&&rules.minLength>rules.maxLength)return 'INVALID_LENGTH_RULE';
 if(rules.minItems!==undefined&&rules.maxItems!==undefined&&rules.minItems>rules.maxItems)return 'INVALID_ITEMS_RULE';
 if(rules.minItems!==undefined&&rules.minItems>100)return 'INVALID_ITEMS_RULE';
 for(const k of ['minimum','maximum']){
  if(rules[k]!==undefined&&(typeof rules[k]!=='number'||!Number.isFinite(rules[k])))return 'INVALID_NUMBER_RULE';
 }
 if(rules.minimum!==undefined&&rules.maximum!==undefined&&rules.minimum>rules.maximum)return 'INVALID_NUMBER_RULE';
 if(rules.enum!==undefined){
  if(!Array.isArray(rules.enum)||!rules.enum.length||rules.enum.length>100)return 'INVALID_ENUM';
  if(!['string','number','integer','boolean'].includes(type))return 'INVALID_ENUM';
  if(rules.enum.some(v=>type==='integer'?!Number.isSafeInteger(v):type==='number'?typeof v!=='number'||!Number.isFinite(v):typeof v!==type))return 'INVALID_ENUM';
 }
 if(rules.additionalProperties!==undefined&&typeof rules.additionalProperties!=='boolean')return 'INVALID_ADDITIONAL_PROPERTIES';
 if(rules.format!==undefined&&!['email','hostname'].includes(rules.format))return 'UNSUPPORTED_FORMAT';
 return null;
}
function inspectSchema(schema,seen=new WeakSet(),depth=0,validated=new WeakSet(),budget={nodes:0}){
 if(!schema||typeof schema!=='object'||Array.isArray(schema))return 'INVALID_SCHEMA';
 if(depth>24)return 'SCHEMA_TOO_DEEP';
 if(seen.has(schema))return 'CYCLIC_SCHEMA';
 if(validated.has(schema))return null;
 if(++budget.nodes>10000)return 'SCHEMA_TOO_LARGE';
 seen.add(schema);let ok=false;
 try {
  if(Object.getPrototypeOf(schema)!==Object.prototype && Object.getPrototypeOf(schema)!==null)return 'INVALID_SCHEMA';
  const keys=Reflect.ownKeys(schema);
  const rules=Object.create(null);
  if(keys.length>100)return 'TOO_MANY_SCHEMA_FIELDS';
  if(keys.some(key=>typeof key!=='string'))return 'INVALID_SCHEMA';
  for(const key of keys){
   const descriptor=Object.getOwnPropertyDescriptor(schema,key);
   if(!descriptor||!Object.hasOwn(descriptor,'value'))return 'SCHEMA_ACCESSOR';
   rules[key]=descriptor.value;
   if(key==='enum' && Array.isArray(descriptor.value)){
    if(descriptor.value.length>100)return 'INVALID_ENUM';
    for(let i=0;i<descriptor.value.length;i++){
     const entry=Object.getOwnPropertyDescriptor(descriptor.value,String(i));
     if(!entry||!Object.hasOwn(entry,'value'))return 'SCHEMA_ACCESSOR';
    }
   }
   if(key==='required' && Array.isArray(descriptor.value)){
    if(descriptor.value.length>100)return 'INVALID_REQUIRED';
    for(let i=0;i<descriptor.value.length;i++){
     const entry=Object.getOwnPropertyDescriptor(descriptor.value,String(i));
     if(!entry||!Object.hasOwn(entry,'value'))return 'SCHEMA_ACCESSOR';
    }
   }
   if(key==='properties'){
    const props=descriptor.value;
    if(props&&typeof props==='object'&&!Array.isArray(props)){
     if(Object.getPrototypeOf(props)!==Object.prototype && Object.getPrototypeOf(props)!==null)return 'INVALID_PROPERTIES';
     const names=Reflect.ownKeys(props);
     if(names.length>100)return 'TOO_MANY_SCHEMA_FIELDS';
     if(names.some(name=>typeof name!=='string'))return 'INVALID_PROPERTIES';
     for(const name of names){
      const prop=Object.getOwnPropertyDescriptor(props,name);
      if(!prop||!Object.hasOwn(prop,'value'))return 'SCHEMA_ACCESSOR';
      const error=inspectSchema(prop.value,seen,depth+1,validated,budget);
      if(error)return error;
     }
    }
   } else if(key==='items'){
    const error=inspectSchema(descriptor.value,seen,depth+1,validated,budget);
    if(error)return error;
   }
  }
  const ruleError=schemaRuleError(rules,keys);if(ruleError)return ruleError;
  ok=true;return null;
 } finally {seen.delete(schema);if(ok)validated.add(schema);}
}
// A defensive schema snapshot prevents later mutation from silently changing rules.
function snapshotSchema(schema, seen=new WeakMap()) {
 if (!schema || typeof schema!=='object' || Array.isArray(schema)) return schema;
 if (seen.has(schema)) return seen.get(schema);
 const copy=Object.create(null);
 seen.set(schema,copy);
 for (const key of Reflect.ownKeys(schema)) {
  const entry=Object.getOwnPropertyDescriptor(schema,key);
  let value=entry.value;
  if (key==='properties' && value && typeof value==='object' && !Array.isArray(value)) {
   const props=Object.create(null);
   for (const name of Reflect.ownKeys(value)) {
    const prop=Object.getOwnPropertyDescriptor(value,name);
    Object.defineProperty(props,name,{value:snapshotSchema(prop.value,seen),enumerable:true});
   }
   value=Object.freeze(props);
  } else if (key==='items') value=snapshotSchema(value,seen);
  else if ((key==='required'||key==='enum') && Array.isArray(value)) {
   value=Object.freeze(Array.from({length:value.length},(_,i)=>Object.getOwnPropertyDescriptor(value,String(i)).value));
  }
  Object.defineProperty(copy,key,{value,enumerable:true});
 }
 return Object.freeze(copy);
}
function errorResult(code){return {valid:false,errors:[{path:'$',pointer:'',code}]};}
function applyForm(value,schema){
 try {
  const errors=[];
  walk(value,schema,'$',errors,0,new WeakSet(),{visits:0,exhausted:false});
  return {valid:errors.length===0,errors:withPointers(errors.slice(0,100))};
 } catch {return errorResult('INSPECTION_FAILED');}
}
export function inspectFormSchema(schema){
 try{
  const issue=inspectSchema(schema);
  return issue?errorResult(issue):{valid:true,errors:[]};
 }catch{return errorResult('INSPECTION_FAILED');}
}
export function createValidator(schema){
 let snapshot;
 try {
  const unsafe=inspectSchema(schema);
  if (unsafe)return ()=>errorResult(unsafe);
  snapshot=snapshotSchema(schema);
 } catch {return ()=>errorResult('INSPECTION_FAILED');}
 return value=>applyForm(value,snapshot);
}
export function validateForm(value,schema){
 try {
  const unsafe=inspectSchema(schema);
  if(unsafe)return errorResult(unsafe);
  return applyForm(value,schema);
 } catch {return errorResult('INSPECTION_FAILED');}
}
export function validateBatch(values,schema,{maxItems=100}={}){
 if(!Array.isArray(values))throw new TypeError('batch must be an array');
 if(!Number.isSafeInteger(maxItems)||maxItems<1||maxItems>100)throw new RangeError('invalid maxItems');
 if(values.length>maxItems)throw new RangeError('batch too large');
 const validate=createValidator(schema);
 const results=[];let passed=0;
 for(let i=0;i<values.length;i++){
  const entry=Object.getOwnPropertyDescriptor(values,String(i));
  const result=entry&&!Object.hasOwn(entry,'value')?errorResult('ACCESSOR_PROPERTY'):validate(entry?.value);
  if(result.valid)passed++;
  results.push({index:i,...result});
 }
 return {valid:passed===values.length,count:values.length,passed,failed:values.length-passed,results};
}
export function validateJson(valueText,schemaText){
 if(typeof valueText!=='string'||typeof schemaText!=='string'||valueText.length>1048576||schemaText.length>1048576||new TextEncoder().encode(valueText).length>1048576||new TextEncoder().encode(schemaText).length>1048576)throw new RangeError('input too large');
 return validateForm(JSON.parse(valueText),JSON.parse(schemaText));
}

const explanationTable=Object.freeze({
 REQUIRED:['This field is required','필수 입력 항목입니다'],
 TYPE_MISMATCH:['Value has the wrong type','자료형이 올바르지 않습니다'],
 TOO_SHORT:['Text is shorter than the required minimum','문자열이 최소 길이보다 짧습니다'],
 TOO_LONG:['Text exceeds the allowed maximum','문자열이 최대 길이를 초과했습니다'],
 BELOW_MINIMUM:['Number is below the minimum','숫자가 최솟값보다 작습니다'],
 ABOVE_MAXIMUM:['Number exceeds the maximum','숫자가 최댓값보다 큽니다'],
 TOO_FEW_ITEMS:['Array contains too few items','배열 항목 수가 부족합니다'],
 TOO_MANY_ITEMS_RULE:['Array contains too many items','배열 항목 수가 너무 많습니다'],
 NOT_IN_ENUM:['Value is not in the allowed set','허용된 값에 포함되지 않습니다'],
 INVALID_EMAIL:['Email syntax is invalid','이메일 주소 형식이 올바르지 않습니다'],
 INVALID_HOSTNAME:['Hostname syntax is invalid','호스트 이름 형식이 올바르지 않습니다'],
 ACCESSOR_PROPERTY:['Getter-based input cannot be validated safely','getter 속성은 안전하게 검증할 수 없습니다'],
 ADDITIONAL_PROPERTY:['This field is not permitted by the schema','허용되지 않은 추가 항목입니다'],
 UNSAFE_KEY:['Object contains a blocked key','안전하지 않은 객체 키가 있습니다'],
 MAX_DEPTH:['Maximum nesting depth exceeded','중첩 단계 제한을 초과했습니다'],
 MAX_NODES:['Validation visit limit exceeded','검증 노드 수 제한을 초과했습니다'],
 CYCLIC_VALUE:['Cyclic object detected','순환 참조 객체가 발견됐습니다'],
 CYCLIC_SCHEMA:['Cyclic schema detected','검증 규칙에 순환 참조가 있습니다'],
 SCHEMA_TOO_LARGE:['Schema exceeds the inspection budget','검증 규칙이 허용된 검사량을 초과했습니다'],
 UNKNOWN_SCHEMA_RULE:['Schema contains an unsupported rule','지원하지 않는 검사 규칙이 있습니다'],
 INVALID_RULE_COMBINATION:['Rule is not applicable to the selected type','해당 자료형에서 사용할 수 없는 규칙입니다'],
 INSPECTION_FAILED:['Input could not be inspected safely','입력값을 안전하게 검사하지 못했습니다']
});
export function explainError(error,locale='en'){
 if(locale!=='en'&&locale!=='ko')throw new RangeError('unsupported locale');
 const line=explanationTable[error?.code]??['Validation failed; check the rule and field path','검증에 실패했습니다. 규칙과 필드 경로를 확인하세요'];
 const base=line[locale==='ko'?1:0];
 const limit=error?.limit;
 if(typeof limit==='number'&&Number.isFinite(limit))return locale==='ko'?base+' (기준: '+limit+')':base+' (limit: '+limit+')';
 return base;
}
