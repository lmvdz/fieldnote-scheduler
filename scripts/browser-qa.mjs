import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.QA_NODE_MODULES+'/playwright');
const AxeBuilder=require(process.env.QA_NODE_MODULES+'/@axe-core/playwright').default;
const project=JSON.parse(await readFile('site/project.json','utf8'));
const root='evidence/browser';await mkdir(root,{recursive:true});
const port=4400,key=randomBytes(32).toString('hex');
const entry=project.id==='merchant-exception-desk'?'scripts/dev-native.mjs':'scripts/dev.mjs';
const server=spawn(process.execPath,['--experimental-transform-types',entry],{env:{...process.env,PORT:String(port),SITE_OWNER_KEY:key,AI_MODE:'demo',PAYPAL_MODE:'demo',PAYPAL_SANDBOX_ENABLED:'false'},stdio:'inherit'});
const origin='http://127.0.0.1:'+port;
let browser;const report={project:project.name,date:new Date().toISOString(),providerMode:'simulator only',checks:[],violations:[],errors:[]};
const record=(name,value)=>report.checks.push({name,passed:value});
try{
 let ready=false;for(let i=0;i<40;i++){try{ready=(await fetch(origin)).ok}catch{}if(ready)break;await new Promise(r=>setTimeout(r,250));}assert.ok(ready,'Server must be ready');
 browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();
 page.on('pageerror',error=>report.errors.push(error.message));
 for(const viewport of [{width:1440,height:1000,name:'desktop'},{width:390,height:844,name:'mobile'},{width:320,height:740,name:'small-mobile'}]){
  await page.setViewportSize(viewport);await page.goto(origin,{waitUntil:'networkidle'});await page.locator('h1').waitFor();await page.waitForFunction(()=>document.documentElement.dataset.scene==='ready'||document.documentElement.dataset.scene==='fallback',{timeout:20000});record(viewport.name+' 3D scene',await page.locator('html').getAttribute('data-scene')==='ready');await page.screenshot({path:root+'/'+viewport.name+'-opening.png'});
  await page.evaluate(()=>{document.querySelectorAll('.reveal').forEach(el=>el.classList.add('visible'));});
  record(viewport.name+' no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  for(let i=0;i<3;i++){await page.locator('button[data-step="'+i+'"]').click();assert.equal(await page.locator('button[data-step="'+i+'"]').getAttribute('aria-pressed'),'true');}
  record(viewport.name+' no decorative counters or eyebrows',await page.locator('.eyebrow,.num,.card-step').count()===0);
  record(viewport.name+' workflow steps',true);await page.locator('button[data-step="0"]').click();
  const scan=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();report.violations.push(...scan.violations.map(v=>({viewport:viewport.name,id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})));
  await page.screenshot({path:root+'/'+viewport.name+'-workflow.png'});await page.screenshot({path:root+'/'+viewport.name+'.png',fullPage:true});
 }
 const motionContext=await browser.newContext({viewport:{width:1280,height:800},recordVideo:{dir:root+'/motion',size:{width:1280,height:800}}});const tour=await motionContext.newPage();await tour.goto(origin);await tour.waitForTimeout(1000);for(let y=0;y<4800;y+=20){await tour.evaluate(y=>window.scrollTo(0,y),y);await tour.waitForTimeout(25);}await tour.screenshot({path:root+'/sculpture-detail.png'});await motionContext.close();
 await page.setViewportSize({width:720,height:500});await page.goto(origin);record('200 percent zoom equivalent reflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.setViewportSize({width:1440,height:1000});await page.goto(origin);await page.evaluate(()=>{document.activeElement.blur();const loop=document.getElementById('return-scene');document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,loop.offsetTop-100);});await page.waitForTimeout(200);await page.mouse.wheel(0,250);await page.waitForTimeout(500);record('closing scene wraps into opening',await page.evaluate(()=>window.scrollY<1000));await page.screenshot({path:root+'/loop-return.png'});
 await page.setViewportSize({width:1440,height:1000});await page.goto(origin);await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.className),'skip');await page.keyboard.press('Enter');record('keyboard skip link',await page.evaluate(()=>location.hash==='#main'));await page.locator('summary').first().focus();await page.keyboard.press('Enter');record('keyboard FAQ',await page.locator('details').first().getAttribute('open')!==null);
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto(origin);record('reduced motion',await page.locator('#motion-toggle').getAttribute('aria-pressed')==='true');
 await page.goto(origin+'/privacy');record('privacy route',await page.locator('h1').textContent()==='Demo privacy');
 await page.goto(origin+'/app');record('owner gate',await page.locator('#access-key').isVisible());await page.locator('#access-key').fill(key);await page.getByRole('button',{name:'Open workspace',exact:true}).click();await page.waitForURL('**/app');await page.waitForTimeout(1000);record('authenticated app route',true);await page.screenshot({path:root+'/application.png',fullPage:true});
 // Record the complete fixture workflow; real-provider verification is a separate gate.
 if(project.id==='merchant-exception-desk'){
  await page.getByRole('button',{name:'Analyze case',exact:true}).click();await page.getByRole('button',{name:'Review & approve',exact:true}).click();await page.getByRole('button',{name:'Approve $34.00',exact:true}).click();await page.getByRole('button',{name:'Reconcile refund',exact:true}).click();await page.getByText('Simulated refund completed',{exact:true}).waitFor();
 }else if(project.id==='supplypilot-procurement'){
  await page.locator('#review').click();await page.locator('#approval-check').check();await page.locator('#confirm-approval').click();await page.locator('#lose-response').check();await page.locator('#checkout').click();await page.locator('#retry-checkout').click();await page.waitForFunction(()=>document.body.textContent.includes('Demo receipt'));
  const done=await page.evaluate(async()=>await (await fetch('/api/workspace')).json());assert.equal(done.state.receipts.length,1);
 }else{
  await page.getByRole('button',{name:'Build quote',exact:true}).click();await page.locator('[data-slot]:not(:disabled)').first().click();await page.locator('#save-quote').click();await page.locator('#approve-check').check();await page.locator('#approve').click();await page.locator('#create-order').click();await page.locator('#capture').click();await page.locator('#receipt:not(.hidden)').waitFor();
 }
 record('fixture workflow outcome',true);await page.screenshot({path:root+'/outcome.png',fullPage:true});
 const appScan=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();report.violations.push(...appScan.violations.map(v=>({viewport:'application',id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})));
 const noJS=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});const fallback=await noJS.newPage();await fallback.goto(origin);record('no-JS content and navigation',await fallback.locator('h1').isVisible()&&await fallback.getByRole('link',{name:'Explore the flow'}).first().isVisible());await fallback.screenshot({path:root+'/no-javascript.png',fullPage:true});await noJS.close();
 record('no browser runtime errors',report.errors.length===0);
}catch(error){report.errors.push(error.stack||String(error));}finally{if(browser)await browser.close();server.kill();await writeFile(root+'/report.json',JSON.stringify(report,null,2));}
console.log(JSON.stringify({checks:report.checks,violations:report.violations.length,errors:report.errors},null,2));
if(report.errors.length||report.violations.length||report.checks.some(c=>!c.passed))process.exitCode=1;
