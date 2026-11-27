import {validateJson,explainError} from "/try/core.js";
const schema={type:"object",properties:{email:{type:"string",format:"email"}}};
const qty={type:"object",properties:{items:{type:"array",items:{type:"object",properties:{quantity:{type:"integer",minimum:1}}}}}};
function check(k){const r=validateJson(JSON.stringify(k==="quantity"?{items:[{quantity:0}]}:{email:k==="good"?"user@example.com":"bad"}),JSON.stringify(k==="quantity"?qty:schema));return {ok:r.valid,text:r.valid?"Valid — all supported rules passed.":r.errors.slice(0,2).map(e=>(e.path||"$")+" — "+explainError(e)).join(" • ")};}
const select=document.getElementById("sample-select"),button=document.getElementById("sample-run"),output=document.getElementById("sample-output");
function renderExample(){try{const r=check(select.value);output.textContent=r.text;output.dataset.state=r.ok?"pass":"fail";}catch{output.textContent="Example could not be checked.";output.dataset.state="fail";}}
button.addEventListener("click",renderExample);
select.addEventListener("change",renderExample);
if(matchMedia("(max-width:420px)").matches)document.getElementById("sample-panel").open=false;
button.disabled=false;
