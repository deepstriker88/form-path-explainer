import {chromium} from "playwright";
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const dir=await fs.mkdtemp(path.join(os.tmpdir(),"compact-landing-"));
const port=18787,base="http://127.0.0.1:"+port;
const server=spawn(process.execPath,["hosted/src/server.js"],{env:{PATH:process.env.PATH,HOME:dir,HOST:"127.0.0.1",PORT:String(port),DB_PATH:path.join(dir,"fixture.sqlite"),BASE_URL:base,PADDLE_ENV:"sandbox",PADDLE_CLIENT_TOKEN:"test_fixture",PADDLE_WEBHOOK_SECRET:"fixture",PADDLE_PRICE_PRO:"pri_fixture_pro",PADDLE_PRICE_TEAM:"pri_fixture_team",ENABLE_LIVE_BILLING:"0"},stdio:["ignore","ignore","inherit"]});
let browser;
try{
 for(let i=0;i<80;i++){try{if((await fetch(base+"/healthz")).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true});
 await fs.mkdir("qa-screenshots",{recursive:true});
 const metrics=[];
 for(const [width,height] of [[320,568],[360,740],[390,844],[768,1024],[1024,768],[1280,720],[1440,900],[1920,1080]]){
  const context=await browser.newContext({viewport:{width,height}});
  const external=[],posts=[],errors=[],requests=[];
  await context.route("**/*",route=>{const req=route.request(),url=new URL(req.url());requests.push([req.method(),url.pathname]);if(url.origin!==base){external.push(url.origin);return route.abort();}if(req.method()!=="GET")posts.push(req.method()+" "+url.pathname);return route.continue();});
  await context.grantPermissions(["clipboard-read","clipboard-write"]);
  const page=await context.newPage();page.on("pageerror",e=>errors.push(String(e)));

  await page.goto(base+"/");
  await page.waitForFunction(()=>!document.getElementById("run").disabled);
  const home=await page.evaluate(()=>({
   width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,
   viewportHeight:innerHeight,viewportWidth:innerWidth,
   primaryBottom:document.getElementById("run").getBoundingClientRect().bottom,
   reviewBottom:document.getElementById("primary-review").getBoundingClientRect().bottom,
   buttonHeight:document.getElementById("run").getBoundingClientRect().height,
   inputSize:parseFloat(getComputedStyle(document.getElementById("value")).fontSize),
   planBottom:document.getElementById("api-plans").getBoundingClientRect().bottom
  }));
  assert.ok(home.width<=width&&home.height<=height+1,"direct home overflow "+JSON.stringify(home));
  assert.ok(home.primaryBottom<=height&&home.reviewBottom<=height&&home.planBottom<=height,"home action not visible");
  assert.ok(home.buttonHeight>=44&&home.inputSize>=16);
  const allowedHome=new Set(["/","/try/style.css","/try/tool.js","/try/core.js","/try/strict-json.js","/try/csv.js","/favicon.ico"]);
  assert.ok(requests.every(([method,url])=>method==="GET"&&allowedHome.has(url)),"unexpected home request "+JSON.stringify(requests));
  const footprint=await page.evaluate(()=>[...performance.getEntriesByType("navigation"),...performance.getEntriesByType("resource")].reduce((n,e)=>n+(e.decodedBodySize||0),0));
  assert.ok(footprint>0&&footprint<=49152,"local tool resource budget exceeded: "+footprint);

  assert.ok(await page.locator("#result-panel").isHidden());
  await page.screenshot({path:"qa-screenshots/home-"+width+"x"+height+".png",fullPage:true});
  await page.locator("#example").click();
  assert.ok(await page.locator("#result-panel").isVisible());
  assert.notEqual(await page.locator("#status").getAttribute("data-state"),"idle");
  assert.ok(await page.locator("#copy-result").isEnabled());
  const sourceJump=page.locator(".issue-location").first();
  assert.ok(await sourceJump.isVisible());
  const formReport=JSON.parse(await page.locator("#result").textContent());
  const target=formReport.errors.find(e=>e.location);
  assert.ok(target);await sourceJump.click();
  assert.equal(await page.evaluate(()=>document.activeElement.id),"value");
  assert.equal(await page.locator("#value").evaluate(el=>el.selectionStart),target.location.offset);

  await page.locator("#copy-result").click();
  const copied=await page.evaluate(()=>navigator.clipboard.readText());
  assert.match(copied,/Issues found|No reported issues/);
  assert.doesNotMatch(copied,/@|email|quantity|PRIVATE_TEST_VALUE/);
  if(width===390){
  await page.locator("#clear").click();
  await page.locator("#value-file").setInputFiles({name:"data.json",mimeType:"application/json",buffer:Buffer.from('{"email":"not-an-email"}')});
  await page.waitForFunction(()=>document.getElementById("value").value.includes("not-an-email"));
  await page.locator("#schema-file").setInputFiles({name:"schema.json",mimeType:"application/json",buffer:Buffer.from('{"type":"object","properties":{"email":{"type":"string","format":"email"}}}')});
  await page.waitForFunction(()=>document.getElementById("schema").value.includes("format"));
  await page.locator("#run").click();
  assert.equal(await page.locator("#status").getAttribute("data-state"),"fail");
  const preserved=await page.locator("#value").inputValue();
  page.once("dialog",d=>d.accept());
  await page.locator("#value-file").setInputFiles({name:"too-big.json",mimeType:"application/json",buffer:Buffer.alloc(65537)});
  await page.waitForFunction(()=>document.getElementById("file-feedback").textContent.includes("not loaded"));
  assert.equal(await page.locator("#value").inputValue(),preserved);
  page.once("dialog",d=>d.dismiss());
  await page.locator("#value-file").setInputFiles({name:"replacement.json",mimeType:"application/json",buffer:Buffer.from("[]")});
  assert.equal(await page.locator("#value").inputValue(),preserved);
  }
  await page.locator("#value").fill("PRIVATE_TEST_VALUE");
  assert.ok(await page.locator("#copy-result").isDisabled());
  assert.ok(await page.locator("#result-panel").isHidden());
  assert.equal(posts.length,0);assert.equal(external.length,0);
  await page.locator("#api-plans").click();
  await page.waitForURL("**/api#plans");
  await page.waitForFunction(()=>document.getElementById("plan-status").textContent.includes("no real payment"));
  assert.ok(await page.locator("#plans").evaluate(e=>e.open));
  assert.equal(await page.locator(".buy:disabled").count(),2);
  await page.keyboard.press("Escape");

  await page.goto(base+"/api");await page.locator("#sample-run").waitFor({state:"attached"});await page.waitForFunction(()=>!document.getElementById("sample-run").disabled);
  const box=await page.evaluate(()=>({height:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth,viewportHeight:innerHeight,viewportWidth:innerWidth,primaryBottom:document.getElementById("primary-try").getBoundingClientRect().bottom,reviewBottom:document.getElementById("primary-review").getBoundingClientRect().bottom,footerBottom:document.querySelector("footer").getBoundingClientRect().bottom,buttonHeight:document.getElementById("sample-run").getBoundingClientRect().height,inputSize:parseFloat(getComputedStyle(document.getElementById("sample-select")).fontSize)}));
  assert.equal(box.width,width,"horizontal overflow");
  assert.ok(box.primaryBottom<=height,"free action outside first viewport");
  assert.ok(box.reviewBottom<=height,"review action outside first viewport");
  assert.ok(box.height<=height+1,"initial page requires vertical scroll: "+width+"x"+height+" height "+box.height);
  console.log("initial layout",width,height,JSON.stringify(box));
  await page.screenshot({path:"qa-screenshots/landing-"+width+"x"+height+".png",fullPage:true});
  if(!await page.locator("#sample-panel").evaluate(e=>e.open))await page.locator("#sample-panel summary").click();
  const controls=await page.evaluate(()=>({buttonHeight:document.getElementById("sample-run").getBoundingClientRect().height,inputSize:parseFloat(getComputedStyle(document.getElementById("sample-select")).fontSize)}));
  assert.ok(controls.buttonHeight>=44&&controls.inputSize>=16,"readability/touch sizing: "+JSON.stringify(controls));
  await page.locator("#sample-run").click();assert.equal(await page.locator("#sample-output").getAttribute("data-state"),"fail");assert.notEqual(await page.locator("#sample-output").textContent(),"Example could not be checked.");
  await page.locator("#sample-select").selectOption("good");assert.equal(await page.locator("#sample-output").getAttribute("data-state"),"pass");
  assert.equal(posts.length,0,"local demo transmitted data");assert.equal(external.length,0,"external dependency before plans");
  await page.locator('[data-open="plans"]').first().click();await page.waitForFunction(()=>document.getElementById("plan-status").textContent.includes("no real payment"));
  assert.equal(await page.locator("#plans").evaluate(e=>e.open),true);
  assert.equal(await page.locator(".buy:disabled").count(),2);assert.equal(await page.locator("#checkout-fields").isVisible(),false);
  assert.equal(external.length,0,"sandbox must not load Paddle");assert.equal(posts.length,0);
  await page.keyboard.press("Escape");assert.equal(await page.locator("#plans").evaluate(e=>e.open),false);
  await page.locator('[data-open="more"]').click();assert.equal(await page.locator("#more").evaluate(e=>e.open),true);
  assert.ok((await page.locator("#more").textContent()).includes("npm install"));
  await page.keyboard.press("Escape");
  // The actual task views, not only the promotional first screen.
  for (const route of ["/try","/review"]) {
   await page.goto(base+route);
   await page.waitForFunction(()=>!document.getElementById("run").disabled);
   const layout=await page.evaluate(()=>({
    width:document.documentElement.scrollWidth,
    primaryHeight:document.getElementById("run").getBoundingClientRect().height,
    bodyFont:parseFloat(getComputedStyle(document.body).fontSize),
    inputFont:parseFloat(getComputedStyle(document.querySelector("textarea")).fontSize)
   }));
   assert.ok(layout.width<=width,"private view overflow "+route+" "+JSON.stringify(layout));
   assert.ok(layout.primaryHeight>=44&&layout.bodyFont>=16&&layout.inputFont>=16,"private tool readability");
   await page.locator("#example").click();
   assert.notEqual(await page.locator("#status").getAttribute("data-state"),"idle");
   assert.notEqual(await page.locator("#status").getAttribute("data-state"),"incomparable");
   assert.ok((await page.locator("#result").textContent()).length>2);
   if(width===390||width===1440)await page.screenshot({path:"qa-screenshots/"+route.slice(1)+"-"+width+"x"+height+".png",fullPage:true});
   if(route==="/review"&&width===390){
    const before=JSON.stringify({type:"object",properties:{id:{type:"string"},email:{type:"string"}},required:["id"],additionalProperties:false});
    const after=JSON.stringify({...JSON.parse(before),required:["id","email"]});
    await page.locator("#before").fill(before);await page.locator("#after").fill(after);
    await page.locator("#witness").locator("..").locator("summary").click();
    await page.locator("#fixtures").fill('[{"id":"PRIVATE_FIXTURE"}]');
    page.once("dialog",d=>d.dismiss());await page.locator("#witness").click();
    assert.equal(await page.locator("#fixtures").inputValue(),'[{"id":"PRIVATE_FIXTURE"}]');
    page.once("dialog",d=>d.accept());await page.locator("#witness").click();
    assert.deepEqual(JSON.parse(await page.locator("#fixtures").inputValue()),[{id:""}]);
    assert.equal(await page.locator("#status").getAttribute("data-state"),"fail");
    const witnessReport=JSON.parse(await page.locator("#result").textContent());
    assert.equal(witnessReport.counts.newlyRejected,1);
    assert.doesNotMatch(JSON.stringify(witnessReport),/PRIVATE_FIXTURE|email/);
    await page.locator("#after").fill(before);
    const preserved=await page.locator("#fixtures").inputValue();
    await page.locator("#witness").click();
    assert.equal(await page.locator("#fixtures").inputValue(),preserved);
    assert.match(await page.locator("#file-status").textContent(),/No verified example/);
    await page.locator("#witness").locator("..").locator("summary").click();
   }
   if(route==="/review"&&width===390){
    await page.emulateMedia({colorScheme:"dark"});
    assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).colorScheme),"dark");
    const chooserPromise=page.waitForEvent("filechooser");await page.locator(".file-open").first().click();await chooserPromise;
    assert.ok(await page.locator("#run").evaluate(e=>e.getBoundingClientRect().bottom<=innerHeight));
    await page.screenshot({path:"qa-screenshots/review-dark.png",fullPage:true});
    await page.emulateMedia({colorScheme:"light"});
   }
   const input=page.locator("textarea").first();
   await input.fill("invalid fixture");
   assert.equal(await page.locator("#status").getAttribute("data-state"),"idle");
   page.once("dialog",d=>d.dismiss());await page.locator("#example").click();
   assert.equal(await input.inputValue(),"invalid fixture");
   assert.equal(await page.locator("#status").getAttribute("data-state"),"idle");
   assert.equal(posts.length,0,"private tool transmitted input");
   assert.equal(external.length,0,"private tool made external request");
  }
  assert.equal(errors.length,0,errors.join("\n"));
  metrics.push({viewport:{width,height},...home,decodedBytes:footprint,verticalScroll:Math.max(0,home.height-height),sample:"pass/fail verified",sandboxCheckout:"disabled",externalRequests:external.length,inputPosts:posts.length});
  await context.close();
 }
 await fs.writeFile("qa-screenshots/metrics.json",JSON.stringify(metrics,null,2)+"\n");
 console.log(JSON.stringify(metrics));
}finally{if(browser)await browser.close();server.kill("SIGTERM");await fs.rm(dir,{recursive:true,force:true});}
