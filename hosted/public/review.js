import {compareFormFixtures} from "./regression.js";
const limits={before:1048576,after:1048576,fixtures:1048576};
const sample={before:JSON.stringify({type:"string",minLength:2},null,2),after:JSON.stringify({type:"string",minLength:3},null,2),fixtures:JSON.stringify(["a","ab","abc"],null,2)};
const reportName="form-rule-review.json";
export function check(input){
 for(const [key,cap] of Object.entries(limits)){const v=input[key];if(typeof v!=="string"||!v.length||v.length>cap||new TextEncoder().encode(v).length>cap)throw new RangeError("input limit");}
 return compareFormFixtures(input.fixtures,input.before,input.after);
}
export function describe(r){
 const c=r.counts,changed=r.hasNewRejections||r.hasNewAcceptances;
 return {state:!r.comparable?"incomparable":changed?"fail":"pass",title:!r.comparable?"Not fully comparable":changed?"Acceptance changed":"No acceptance change observed",
 detail:!r.comparable?"At least one result reached a validation limit. Do not treat this review as a pass.":changed?"Review changed fixtures before rollout. A newly accepted input may also be unintended.":"No acceptance change in supplied fixtures; not proof of universal compatibility.",
 metrics:[["Fixtures",r.count],["Newly rejected",c.newlyRejected],["Newly accepted",c.newlyAccepted],["Unchanged accepted",c.unchangedAccepted],["Unchanged rejected",c.unchangedRejected],["Indeterminate",c.indeterminate]],
 groups:[["Changed fixtures",r.results.filter(x=>x.category==="newlyRejected"||x.category==="newlyAccepted").map(x=>"Fixture index "+x.index+" · "+x.before+" → "+x.after)],["Indeterminate fixtures",r.results.filter(x=>x.category==="indeterminate").map(x=>"Fixture index "+x.index+" · "+x.before+" → "+x.after)]]};
}

if(typeof document!=="undefined"){
const $=id=>document.getElementById(id);
const ids=Object.keys(limits);
const inputs=ids.map($);
let report=null,revision=0,pending=0;
const status=$("status"),summary=$("summary"),findings=$("findings"),technical=$("technical"),result=$("result"),fileStatus=$("file-status");
function reset(){
 report=null;revision++;
 status.dataset.state="idle";status.textContent="Ready to compare locally";
 summary.textContent="Load an example or supply three inputs.";
 findings.replaceChildren();result.textContent="";technical.hidden=true;technical.open=false;$("download").disabled=true;
}
function metric(label,value){
 const node=document.createElement("div");node.className="metric";
 const n=document.createElement("strong"),text=document.createElement("span");n.textContent=String(value);text.textContent=label;node.append(n,text);return node;
}
function message(text){const p=document.createElement("p");p.textContent=text;return p;}
function group(title,rows){
 const h=document.createElement("h3");h.textContent=title;
 const ul=document.createElement("ul");
 for(const row of rows){const li=document.createElement("li");li.textContent=row;ul.append(li);}
 findings.append(h,ul);
}
function display(r){
 report=r;summary.replaceChildren();findings.replaceChildren();
 const model=describe(r);status.dataset.state=model.state;status.textContent=model.title;
 summary.append(message(model.detail));
 const metrics=document.createElement("div");metrics.className="metrics";
 for(const [label,value] of model.metrics)metrics.append(metric(label,value));
 summary.append(metrics);
 for(const [title,rows] of model.groups)if(rows.length)group(title,rows);
 result.textContent=JSON.stringify(r,null,2);technical.hidden=false;technical.open=false;$("download").disabled=false;
}
function setBusy(){
 $("run").disabled=pending>0;$("example").disabled=pending>0;
 for(const id of ids)$(id+"-file").disabled=pending>0;
}
for(const input of inputs){
 input.addEventListener("input",()=>{reset();fileStatus.textContent="";});
 const id=input.id,file=$(id+"-file");
 file.addEventListener("change",async()=>{
  const chosen=file.files?.[0];file.value="";
  if(!chosen)return;
  if(input.value&&!window.confirm("Replace this field with the selected file?"))return;
  if(chosen.size>limits[id]){fileStatus.textContent="File exceeds the limit; existing input retained.";return;}
  const token=++revision;pending++;setBusy();
  try{
   const bytes=await chosen.arrayBuffer();
   if(bytes.byteLength>limits[id])throw new RangeError("input limit");
   const text=new TextDecoder("utf-8",{fatal:true}).decode(bytes);
   if(token!==revision)return;
   input.value=text;reset();fileStatus.textContent="Local file loaded. No upload.";
  }catch{if(token===revision)fileStatus.textContent="Could not read a bounded UTF-8 file; existing input retained.";}
  finally{pending--;setBusy();}
 });
}
$("run").addEventListener("click",()=>{
 if(pending)return;
 reset();fileStatus.textContent="";
 try{display(check(Object.fromEntries(inputs.map(i=>[i.id,i.value]))));}
 catch{status.dataset.state="incomparable";status.textContent="Comparison unavailable";summary.textContent="Check all inputs, supported rules, file size and syntax. No report was produced.";}
});
$("example").addEventListener("click",()=>{
 if(pending)return;
 if(inputs.some(i=>i.value)&&!window.confirm("Replace current inputs with the example?"))return;
 for(const input of inputs)input.value=sample[input.id];reset();fileStatus.textContent="";
});
$("clear").addEventListener("click",()=>{
 for(const input of inputs)input.value="";
 reset();fileStatus.textContent="";inputs[0].focus();
});
$("download").addEventListener("click",()=>{
 if(!report)return;
 const blob=new Blob([JSON.stringify(report,null,2)+"\n"],{type:"application/json"});
 const url=URL.createObjectURL(blob);
 try{const a=document.createElement("a");a.href=url;a.download=reportName;document.body.append(a);a.click();a.remove();}
 finally{setTimeout(()=>URL.revokeObjectURL(url),1000);}
});
reset();for(const id of ["run","example","clear"])$(id).disabled=false;setBusy();

}
