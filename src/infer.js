// Derive conservative validation rules from trusted sample records without retaining their values.
// This deliberately avoids guessing formats, numeric bounds, or email/domain classification.
const blocked=new Set(['__proto__','constructor','prototype']);
export class SchemaInferenceError extends Error {
 constructor(code,path='$'){super(code+' at '+path);this.name='SchemaInferenceError';this.code=code;this.path=path;}
}
function stepBudget(budget,path){
 if(++budget.nodes>10000)throw new SchemaInferenceError('MAX_NODES',path);
}
function childPath(path,key){return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)?path+'.'+key:path+'['+JSON.stringify(key)+']';}
function infer(value,path,depth,budget,ancestors){
 stepBudget(budget,path);
 if(depth>12)throw new SchemaInferenceError('MAX_DEPTH',path);
 if(value===null||value===undefined)throw new SchemaInferenceError('UNSUPPORTED_NULL',path);
 if(typeof value==='string')return {type:'string'};
 if(typeof value==='boolean')return {type:'boolean'};
 if(typeof value==='number'){
  if(!Number.isFinite(value))throw new SchemaInferenceError('NONFINITE_NUMBER',path);
  return {type:Number.isSafeInteger(value)?'integer':'number'};
 }
 if(typeof value!=='object')throw new SchemaInferenceError('UNSUPPORTED_VALUE',path);
 if(ancestors.has(value))throw new SchemaInferenceError('CYCLIC_SAMPLE',path);
 ancestors.add(value);
 try {
  if(Array.isArray(value)){
   if(value.length>100)throw new SchemaInferenceError('TOO_MANY_ITEMS',path);
   let item;
   for(let i=0;i<value.length;i++){
    const slot=Object.getOwnPropertyDescriptor(value,String(i));
    if(!slot||!Object.hasOwn(slot,'value'))throw new SchemaInferenceError('UNSAFE_ARRAY_SLOT',path+'['+i+']');
    const next=infer(slot.value,path+'['+i+']',depth+1,budget,ancestors);
    item=item?merge(item,next,path+'['+i+']',budget):next;
   }
   return item?{type:'array',items:item}:{type:'array'};
  }
  const proto=Object.getPrototypeOf(value);
  if(proto!==Object.prototype&&proto!==null)throw new SchemaInferenceError('UNSUPPORTED_OBJECT',path);
  const keys=Reflect.ownKeys(value);
  if(keys.length>100)throw new SchemaInferenceError('TOO_MANY_FIELDS',path);
  const properties=Object.create(null),required=[];
  for(const key of keys){
   if(typeof key!=='string'||blocked.has(key)||key.length>128)throw new SchemaInferenceError('UNSAFE_FIELD',path);
   const desc=Object.getOwnPropertyDescriptor(value,key);
   if(!desc||!Object.hasOwn(desc,'value')||!desc.enumerable)throw new SchemaInferenceError('UNSAFE_FIELD',childPath(path,key));
   properties[key]=infer(desc.value,childPath(path,key),depth+1,budget,ancestors);
   required.push(key);
  }
  return {type:'object',required,properties};
 }finally{ancestors.delete(value);}
}
function merge(a,b,path,budget){
 stepBudget(budget,path);
 if(a.type!==b.type){
  if(['integer','number'].includes(a.type)&&['integer','number'].includes(b.type))return {type:'number'};
  throw new SchemaInferenceError('MIXED_TYPES',path);
 }
 if(a.type==='object'){
  const names=new Set([...Object.keys(a.properties),...Object.keys(b.properties)]);
  if(names.size>100)throw new SchemaInferenceError('TOO_MANY_FIELDS',path);
  const properties=Object.create(null);
  for(const key of names){
   const left=Object.getOwnPropertyDescriptor(a.properties,key),right=Object.getOwnPropertyDescriptor(b.properties,key);
   properties[key]=left&&right?merge(left.value,right.value,childPath(path,key),budget):(left??right).value;
  }
  const required=a.required.filter(name=>b.required.includes(name));
  return {type:'object',properties,required};
 }
 if(a.type==='array'){
  if(!a.items)return b;
  if(!b.items)return a;
  return {type:'array',items:merge(a.items,b.items,path+'[0]',budget)};
 }
 return a;
}
function closeObjects(schema){
 if(schema.type==='object'){
  schema.additionalProperties=false;
  for(const name of Object.keys(schema.properties))closeObjects(schema.properties[name]);
 }else if(schema.type==='array'&&schema.items)closeObjects(schema.items);
 return schema;
}
/**
 * @param {unknown[]} samples Real records representative of the accepted structure
 * @param {{closedObjects?:boolean}} options Whether to reject properties absent from samples
 * @returns {{schema:object, records:number}} Conservative schema and record count
 */
export function inferFormSchema(samples,{closedObjects=false}={}){
 if(!Array.isArray(samples)||samples.length<1||samples.length>100)throw new SchemaInferenceError('INVALID_SAMPLES');
 if(typeof closedObjects!=='boolean')throw new SchemaInferenceError('INVALID_OPTIONS');
 const budget={nodes:0},ancestors=new WeakSet();let result;
 try{
  for(let i=0;i<samples.length;i++){
   const slot=Object.getOwnPropertyDescriptor(samples,String(i));
   if(!slot||!Object.hasOwn(slot,'value'))throw new SchemaInferenceError('UNSAFE_ARRAY_SLOT','$['+i+']');
   const next=infer(slot.value,'$['+i+']',0,budget,ancestors);
   result=result?merge(result,next,'$',budget):next;
  }
 }catch(error){
  if(error instanceof SchemaInferenceError)throw error;
  throw new SchemaInferenceError('INSPECTION_FAILED');
 }
 if(closedObjects)closeObjects(result);
 return {schema:result,records:samples.length};
}
