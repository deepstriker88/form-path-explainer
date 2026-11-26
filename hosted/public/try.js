import {strictJson, locateJsonPointers} from './strict-json.js';
import {validateForm, inspectFormSchema, explainError} from './core.js';
const LIMIT=65536;
function bounded(s){if(typeof s!=='string'||s.length>LIMIT||new TextEncoder().encode(s).length>LIMIT)throw new RangeError('Input exceeds 64 KiB');}
// Suggest a single close declared key only when that target is absent.
// Scope is simple ASCII identifier typos; no automatic mutation or fuzzy guesses.
function oneEdit(a,b){
 if(a===b||Math.abs(a.length-b.length)>1)return false;
 if(a.length===b.length){
  const mismatches=[];for(let i=0;i<a.length;i++)if(a[i]!==b[i])mismatches.push(i);
  return mismatches.length===1||(mismatches.length===2&&mismatches[1]===mismatches[0]+1&&a[mismatches[0]]===b[mismatches[1]]&&a[mismatches[1]]===b[mismatches[0]]);
 }
 if(a.length>b.length)[a,b]=[b,a];
 let i=0;while(i<a.length&&a[i]===b[i])i++;
 return a.slice(i)===b.slice(i+1);
}
const simpleKey=k=>typeof k==="string"&&/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(k)&&!["__proto__","prototype","constructor"].includes(k);
export function suggestUnknownKey(data,rules,pointer){
 if(typeof pointer!=="string"||!pointer.startsWith("/"))return null;
 const parts=pointer.slice(1).split("/").map(s=>s.replaceAll("~1","/").replaceAll("~0","~"));
 const key=parts.pop();if(!simpleKey(key))return null;
 for(const part of parts){
  if(Array.isArray(data)&&rules?.type==="array"&&/^(0|[1-9][0-9]*)$/.test(part)&&Object.hasOwn(data,part)){data=data[Number(part)];rules=rules.items;}
  else if(data&&typeof data==="object"&&!Array.isArray(data)&&rules?.type==="object"&&rules.properties&&Object.hasOwn(data,part)&&Object.hasOwn(rules.properties,part)){data=data[part];rules=rules.properties[part];}
  else return null;
 }
 if(!data||typeof data!=="object"||Array.isArray(data)||rules?.type!=="object"||rules.additionalProperties!==false||!Object.hasOwn(data,key)||!rules.properties||Object.hasOwn(rules.properties,key))return null;
 const candidates=Object.keys(rules.properties).filter(k=>simpleKey(k)&&oneEdit(key,k));
 // Ambiguity includes an already present candidate; never suggest overwriting.
 return candidates.length===1&&!Object.hasOwn(data,candidates[0])?candidates[0]:null;
}
export function check({value,schema,mode,format}){
  bounded(value);
  bounded(schema);
  const budget={maxBytes:LIMIT,maxNodes:20000};
  const parsedValue=strictJson(value,budget), parsedSchema=strictJson(schema,budget);
  const schemaCheck=inspectFormSchema(parsedSchema);
  const report=schemaCheck.valid?validateForm(parsedValue,parsedSchema):schemaCheck;
  // Schema preflight failures are not input-field errors. Never attach a
  // location in the wrong document. Missing keys point to their parent object.
  const target=error=>error.code==='REQUIRED'?error.pointer.slice(0,error.pointer.lastIndexOf('/')):error.pointer;
  const locations=schemaCheck.valid&&report.errors.length?locateJsonPointers(value,report.errors.map(target),budget):new Map();
  return {...report, errors:report.errors.map(error=>{
    const position=locations.get(target(error));
    const suggestion=schemaCheck.valid&&error.code==='ADDITIONAL_PROPERTY'?suggestUnknownKey(parsedValue,parsedSchema,error.pointer):null;
    return {...error, explanation:explainError(error),...(suggestion?{suggestedKey:suggestion}:{}),...(position?{location:{...position,kind:error.code==='REQUIRED'?'parent':'value'}}:{})};
  })};
}
export async function readLocalText(file){
 if(!file||!Number.isInteger(file.size)||file.size<0||file.size>LIMIT)throw new RangeError("File exceeds 64 KiB");
 const bytes=await file.arrayBuffer();
 if(bytes.byteLength!==file.size||bytes.byteLength>LIMIT)throw new RangeError("File size changed or exceeds 64 KiB");
 return new TextDecoder("utf-8",{fatal:true}).decode(bytes);
}
if(typeof document!=='undefined'){
const $=id=>document.getElementById(id);
const resultPanel=$("result-panel"), copyButton=$("copy-result"), copyFeedback=$("copy-feedback");
let safeCopy="";
let inputRevision=0;
function bindFile(field,afterLoad=()=>{}){
 const picker=$(field.id+"-file"),button=$(field.id+"-open"),feedback=$("file-feedback");
 button.addEventListener("click",()=>picker.click());
 picker.addEventListener("change",async()=>{
  const file=picker.files?.[0];picker.value="";
  if(!file)return;
  if(field.value&&!window.confirm("Replace the current field with this local file?"))return;
  const revision=++inputRevision;
  feedback.textContent="Reading locally…";
  try{
   const text=await readLocalText(file);
   if(revision!==inputRevision)return;
   afterLoad(file);
   field.value=text;reset();feedback.textContent="File loaded locally.";
  }catch{
   if(revision===inputRevision)feedback.textContent="File not loaded. Choose valid UTF-8 text no larger than 64 KiB.";
  }
 });
}

function clearCopy(){safeCopy="";copyButton.disabled=true;copyFeedback.textContent="";resultPanel.hidden=true;}
function setCopy(text){safeCopy=text;copyFeedback.textContent="";copyButton.disabled=!text;resultPanel.hidden=false;}
copyButton.addEventListener("click",async()=>{
 const captured=safeCopy;if(!captured)return;
 try{await navigator.clipboard.writeText(captured);if(safeCopy===captured)copyFeedback.textContent="Copied.";}
 catch{if(safeCopy===captured)copyFeedback.textContent="Clipboard unavailable. Select the result text to copy manually.";}
});
const value=$('value'),status=$('status'),result=$('result'),summary=$('summary'),technical=$('technical');
const reset=()=>{inputRevision++;$("file-feedback").textContent="";clearCopy();status.textContent='Ready to check locally';status.dataset.state='idle';summary.textContent='Run a check to see the result.';result.textContent='';technical.open=false;technical.hidden=true;};
const schema=$('schema');
const example=()=>{value.value=JSON.stringify({email:'not-an-email',items:[{quantity:0}]},null,2);schema.value=JSON.stringify({type:'object',required:['email','items'],properties:{email:{type:'string',format:'email'},items:{type:'array',items:{type:'object',required:['quantity'],properties:{quantity:{type:'integer',minimum:1}}}}}},null,2);};
const options=()=>({value:value.value,schema:schema.value});
const clear=()=>{value.value='';schema.value='';};
function render(r){
  const list=Array.isArray(r)?r:null;
  const errors=Array.isArray(r.errors)?r.errors:null;
  const failures=list?list.filter(x=>!x.valid).length:errors?Math.max(errors.length,r.valid===false?1:0):r.valid===false?1:0;
  const passed=list?list.length-failures:null;
  status.textContent=failures?'Issues found':'No reported issues';
  status.dataset.state=failures?'fail':'pass';
  summary.replaceChildren();
  const text=document.createElement('p');
  text.textContent=list?passed+' of '+list.length+' records passed.':errors?(failures?failures+' reported validation issue(s).':'The input satisfies the supported rules.'):(r.explanation||r.code||'Check complete.');
  summary.append(text);
  if(failures&&(list||errors)){
    const ul=document.createElement('ul');
    for(const item of (errors||list.filter(x=>!x.valid)).slice(0,10)){
      const li=document.createElement('li');
      li.textContent=errors?((item.path||'$')+' — '+(item.explanation||item.code)):('Record '+(Number.isInteger(item.index)?item.index+1:'?')+' — '+item.code);
      if(errors&&item.suggestedKey)li.append(document.createTextNode(' · Possible key: '+item.suggestedKey+' (review before changing)'));
      if(errors&&item.location){
        const jump=document.createElement('button');jump.type='button';jump.className='issue-location';
        jump.textContent=(item.location.kind==='parent'?'Parent at line ':'Line ')+item.location.line+', col '+item.location.column;
        jump.addEventListener('click',()=>{
          value.focus();value.setSelectionRange(item.location.offset,item.location.offset);
          const rect=value.getBoundingClientRect();if(rect.top<0||rect.bottom>innerHeight)value.scrollIntoView({block:'nearest',behavior:'instant'});
        });
        li.append(document.createTextNode(' '),jump);
      }
      ul.append(li);
    }
    summary.append(ul);
    if(failures>10){const note=document.createElement('p');note.textContent='More issues in the technical result.';summary.append(note);}
  }
  result.textContent=JSON.stringify(r,null,2);technical.hidden=false;technical.open=false;
  setCopy(status.textContent+"\n"+(list?passed+" of "+list.length+" records passed.":failures?failures+" reported validation issue(s).":"Supported checks completed."));
}
function revealResult(){
 const rect=status.getBoundingClientRect();
 if(rect.top<0||rect.bottom>window.innerHeight){
  status.scrollIntoView({block:"nearest",behavior:"instant"});
 }
}
$('run').addEventListener('click',()=>{inputRevision++;$('file-feedback').textContent='';try{render(check(options()));}catch{reset();status.textContent='Input could not be checked';status.dataset.state='fail';summary.textContent='Check JSON and schema syntax, duplicate keys, nesting and input limits. No validation result was produced.';resultPanel.hidden=false;} revealResult();});
value.addEventListener('input',reset);
 document.addEventListener('keydown',event=>{if(!event.isComposing&&event.key==='Enter'&&(event.ctrlKey||event.metaKey)&&!$('run').disabled&&['value','schema'].includes(event.target.id)){event.preventDefault();$('run').click();}});
schema.addEventListener('input',reset);
$('example').addEventListener('click',()=>{if(value.value||schema.value){if(!window.confirm('Replace current input with an example?'))return;}example();$("run").click();});
$('clear').addEventListener('click',()=>{clear();reset();value.focus();});
reset();for(const id of ['run','example','clear'])$(id).disabled=false;$('loading').hidden=true;
bindFile(value);bindFile(schema);
$("value-open").disabled=false;$("schema-open").disabled=false;

}
