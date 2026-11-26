// Bounded JSON parsing for explicit review inputs; reject ambiguous keys.
function parseStrict(text,{maxBytes=1048576,maxDepth=64,maxNodes=100000}={},target){
  if(typeof text!=="string"||text.length>maxBytes||new TextEncoder().encode(text).length>maxBytes)throw new RangeError("JSON input too large");
  let i=0,nodes=0;
  const ws=()=>{while(i<text.length&&/[\t\n\r ]/.test(text[i]))i++;};
  const invalid=()=>{throw new SyntaxError('Invalid or ambiguous JSON');};
  function string(){
    if(text[i]!=='"')invalid();
    const start=i++;
    while(i<text.length){
      const c=text[i++];
      if(c==='"')return JSON.parse(text.slice(start,i));
      if(c==='\\'){if(i>=text.length)invalid();i++;}
    }
    invalid();
  }
  function value(depth,location){
    if(depth>maxDepth||++nodes>maxNodes)throw new RangeError('JSON structure exceeds limits');
    ws();
    if(location?.pointer!==undefined)location.offset=i;
    const c=text[i];
    if(c==='{'){
      const keys=new Set();i++;ws();
      if(text[i]==='}'){i++;return;}
      for(;;){
        ws();const k=string();
        if(keys.has(k))throw new SyntaxError('Duplicate JSON object key');
        keys.add(k);ws();if(text[i++]!==':')invalid();
        value(depth+1,location?.children.get(k));ws();const end=text[i++];
        if(end==='}')return;if(end!==',')invalid();
      }
    }
    if(c==='['){
      i++;ws();if(text[i]===']'){i++;return;}
      let index=0;
      for(;;){value(depth+1,location?.children.get(String(index++)));ws();const end=text[i++];if(end===']')return;if(end!==',')invalid();}
    }
    if(c==='"'){string();return;}
    const start=i;
    while(i<text.length&&!/[\t\n\r ,}\]]/.test(text[i]))i++;
    if(i===start)invalid();
    const scalar=JSON.parse(text.slice(start,i));
    if(typeof scalar==='number'&&!Number.isFinite(scalar))throw new RangeError('Non-finite JSON number');
    if(scalar!==null&&typeof scalar==='object')invalid();
  }
  value(0,target);ws();if(i!==text.length)invalid();
  return JSON.parse(text);
}

export function strictJson(text,options){return parseStrict(text,options);}

// Map only requested pointers (at most 100) to offsets in the original input.
// Unmatched descendants never allocate paths; no entire source map is retained.
export function locateJsonPointers(text,pointers,options){
 if(!Array.isArray(pointers)||pointers.length>100)throw new RangeError("location target limit");
 const root={children:new Map()},targets=[];
 for(const pointer of new Set(pointers)){
  if(typeof pointer!=="string"||(pointer!==""&&(!pointer.startsWith("/")||/~(?![01])/u.test(pointer))))throw new TypeError("invalid JSON pointer");
  let node=root;
  if(pointer!=="")for(const part of pointer.slice(1).split("/").map(s=>s.replaceAll("~1","/").replaceAll("~0","~"))){
   if(!node.children.has(part))node.children.set(part,{children:new Map()});
   node=node.children.get(part);
  }
  node.pointer=pointer;targets.push(node);
 }
 parseStrict(text,options,root);
 const found=targets.filter(t=>t.offset!==undefined).sort((a,b)=>a.offset-b.offset);
 const result=new Map();
 let offset=0,line=1,column=1;
 for(const item of found){
  while(offset<item.offset){
   const ch=text[offset++];
   if(ch==="\r"){line++;column=1;if(text[offset]==="\n"&&offset<item.offset)offset++;}
   else if(ch==="\n"){line++;column=1;}
   else column++;
  }
  result.set(item.pointer,{line,column,offset:item.offset});
 }
 return result;
}
