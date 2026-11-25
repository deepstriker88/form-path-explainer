import {strictJson} from './strict-json.js';
import {validateJson, explainError} from './core.js';
const LIMIT=65536;
function bounded(s){if(typeof s!=='string'||s.length>LIMIT||new TextEncoder().encode(s).length>LIMIT)throw new RangeError('Input exceeds 64 KiB');}
export function check({value,schema,mode,format}){
  bounded(value);
  bounded(schema);
  strictJson(value,{maxBytes:LIMIT,maxNodes:20000});strictJson(schema,{maxBytes:LIMIT,maxNodes:20000});
  const report = validateJson(value,schema);
  return {...report, errors:report.errors.map(error=>({...error, explanation:explainError(error)}))};
}
if(typeof document!=='undefined'){
const $=id=>document.getElementById(id);
const resultPanel=$("result-panel"), copyButton=$("copy-result"), copyFeedback=$("copy-feedback");
let safeCopy="";
function clearCopy(){safeCopy="";copyButton.disabled=true;copyFeedback.textContent="";resultPanel.hidden=true;}
function setCopy(text){safeCopy=text;copyFeedback.textContent="";copyButton.disabled=!text;resultPanel.hidden=false;}
copyButton.addEventListener("click",async()=>{
 const captured=safeCopy;if(!captured)return;
 try{await navigator.clipboard.writeText(captured);if(safeCopy===captured)copyFeedback.textContent="Copied.";}
 catch{if(safeCopy===captured)copyFeedback.textContent="Clipboard unavailable. Select the result text to copy manually.";}
});
const value=$('value'),status=$('status'),result=$('result'),summary=$('summary'),technical=$('technical');
const reset=()=>{clearCopy();status.textContent='Ready to check locally';status.dataset.state='idle';summary.textContent='Run a check to see the result.';result.textContent='';technical.open=false;technical.hidden=true;};
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
$('run').addEventListener('click',()=>{try{render(check(options()));}catch{reset();status.textContent='Input could not be checked';status.dataset.state='fail';summary.textContent='Check JSON or CSV syntax, duplicate keys, record count and input limits. No validation result was produced.';resultPanel.hidden=false;} revealResult();});
value.addEventListener('input',reset);
 document.addEventListener('keydown',event=>{if(!event.isComposing&&event.key==='Enter'&&(event.ctrlKey||event.metaKey)&&!$('run').disabled&&['value','schema'].includes(event.target.id)){event.preventDefault();$('run').click();}});
schema.addEventListener('input',reset);
$('example').addEventListener('click',()=>{if(value.value||schema.value){if(!window.confirm('Replace current input with an example?'))return;}example();$("run").click();});
$('clear').addEventListener('click',()=>{clear();reset();value.focus();});
reset();for(const id of ['run','example','clear'])$(id).disabled=false;$('loading').hidden=true;
}
