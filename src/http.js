// Optional Request/Response handler: no server, billing, API key, or persistent worker is created.
import {validateForm,validateBatch} from './index.js';
const SAFE_HEADERS={
 'content-type':'application/json; charset=utf-8',
 'cache-control':'no-store',
 'x-content-type-options':'nosniff',
 'referrer-policy':'no-referrer',
 'content-security-policy':"default-src 'none'"
};
const reply=(status,payload,more={})=>new Response(JSON.stringify(payload),{status,headers:{...SAFE_HEADERS,...more}});
async function readBoundedRequest(request,limit){
 const rawLength=request.headers.get('content-length');
 if(rawLength!==null){
  if(!/^\d+$/.test(rawLength))throw new TypeError('invalid content length');
  const claimed=Number(rawLength);
  if(!Number.isSafeInteger(claimed)||claimed<0)throw new TypeError('invalid content length');
  if(claimed>limit)throw new RangeError('too large');
 }
 if(!request.body){if(rawLength!==null&&Number(rawLength)!==0)throw new TypeError('content length mismatch');return '';}
 const reader=request.body.getReader(),chunks=[];let total=0;
 try{
  while(true){
   const {done,value}=await reader.read();if(done)break;
   if(!(value instanceof Uint8Array))throw new TypeError('invalid chunk');
   total+=value.length;
   if(total>limit)throw new RangeError('too large');
   chunks.push(value);
  }
 }catch(e){try{await reader.cancel();}catch{}throw e;}
 finally{reader.releaseLock();}
 if(rawLength!==null&&Number(rawLength)!==total)throw new TypeError('content length mismatch');
 const data=new Uint8Array(total);let offset=0;
 for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
 return new TextDecoder('utf-8',{fatal:true}).decode(data);
}
function checkRequest(text){
 const input=JSON.parse(text);
 if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('expected request object');
 if(!Object.hasOwn(input,'schema'))throw new TypeError('missing schema');
 const single=Object.hasOwn(input,'value'),batch=Object.hasOwn(input,'values');
 if(single===batch)throw new TypeError('expected value or values');
 if(batch){
  if(!Array.isArray(input.values)||input.values.length===0)throw new TypeError('expected nonempty values array');
  return validateBatch(input.values,input.schema);
 }
 return validateForm(input.value,input.schema);
}
export function createFormHttpHandler({authorize,consumeQuota,maxBytes=65536}={}){
 if(typeof authorize!=='function'||typeof consumeQuota!=='function')throw new TypeError('authorization and quota checks required');
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>1048576)throw new RangeError('invalid maximum payload');
 return async request=>{
  if(request.method!=='POST')return reply(405,{error:'METHOD_NOT_ALLOWED'},{allow:'POST'});
  const media=(request.headers.get('content-type')??'').split(';')[0].trim().toLowerCase();
  if(media!=='application/json')return reply(415,{error:'UNSUPPORTED_MEDIA_TYPE'});
  let authorized=false;try{authorized=await authorize(request);}catch{return reply(401,{error:'UNAUTHORIZED'});}
  if(authorized!==true)return reply(401,{error:'UNAUTHORIZED'});
  let quota=false;try{quota=await consumeQuota(request);}catch{return reply(503,{error:'QUOTA_UNAVAILABLE'});}
  if(quota!==true)return reply(429,{error:'RATE_LIMITED'});
  let raw;
  try{raw=await readBoundedRequest(request,maxBytes);}
  catch(e){return reply(e instanceof RangeError?413:400,{error:e instanceof RangeError?'PAYLOAD_TOO_LARGE':'INVALID_INPUT'});}
  try{return reply(200,checkRequest(raw));}catch{return reply(400,{error:'INVALID_INPUT'});}
 };
}
