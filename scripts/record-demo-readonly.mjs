// Copy to scripts/record-demo-readonly.mjs in each reviewed repository.
// Manual preview only: no login, new approval, order, capture or refund is allowed.
// The supplied owner cookie is still a full owner bearer credential, not a viewer token.
import {mkdir,writeFile,rm,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join,basename} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile),STOP=code=>{throw new Error('RECORDING_STOP_'+code);};
let recordingStage='BOOT';
function stage(value){recordingStage=value;console.log(JSON.stringify({stage:value,status:'begin'}));}
export function checkoutCommand(directory=process.cwd()){return ['-c','safe.directory='+resolve(directory),'rev-parse','HEAD'];}
export function safeDiagnostic(error){
 const known=new Set(['ENOENT','EACCES','EPERM','ENOTDIR','MODULE_NOT_FOUND','ERR_MODULE_NOT_FOUND','ERR_INVALID_ARG_TYPE','ERR_INVALID_ARG_VALUE','ERR_PACKAGE_PATH_NOT_EXPORTED','ERR_DLOPEN_FAILED']);
 let code='UNVERIFIED_RECORDING';
 if(/^RECORDING_STOP_[A-Z_]+$/.test(error?.message||''))code=error.message;
 else if(known.has(error?.code))code=error.code;
 else if(Number.isInteger(error?.code)&&error.code>=0&&error.code<=255)code='SUBPROCESS_EXIT_'+error.code;
 else if(error?.name==='TimeoutError')code='TIMEOUT';
 return {stage:recordingStage,code}; // Never raw messages, stderr, command, env or headers.
}
const projects={
 merchant:{repo:'merchant-exception-desk',origin:'https://resolution.inkwell.finance',api:'/api/desk',title:'Resolution Desk',audience:'For small online merchants',amount:'34.00'},
 supplypilot:{repo:'supplypilot-procurement',origin:'https://supplypilot.inkwell.finance',api:'/api/workspace',title:'SupplyPilot',audience:'For small-business supply buyers',amount:'201.66'},
 fieldnote:{repo:'fieldnote-scheduler',origin:'https://fieldnote.inkwell.finance',api:'/api/state',title:'Fieldnote',audience:'For independent service businesses',amount:'155.00'}
};
const ID=/^[A-Z0-9-]{1,40}$/,UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export function configuration(env=process.env){
 const project=env.DEMO_PROJECT,cfg=projects[project];if(!cfg)STOP('UNKNOWN_PROJECT');
 if(env.GITHUB_EVENT_NAME&&env.GITHUB_EVENT_NAME!=='workflow_dispatch')STOP('MANUAL_RUN_REQUIRED');
 if(env.GITHUB_REPOSITORY&&env.GITHUB_REPOSITORY!=='lmvdz/'+cfg.repo)STOP('REPOSITORY_SCOPE_MISMATCH');
 const owner=(env.DEMO_OWNER_COOKIE||'').replace(/^__Host-inkwell_owner=/,'');
 const match=/^(\d{10})\.([a-f0-9]{32})\.([a-f0-9]{64})$/.exec(owner);if(!match)STOP('OWNER_COOKIE_REQUIRED');
 const expiry=Number(match[1]),remaining=expiry-Math.floor(Date.now()/1000);if(remaining<240||remaining>1860)STOP('SHORT_FRESH_COOKIE_REQUIRED');
 const field=(env.DEMO_FIELD_SESSION||'').replace(/^fieldnote=/,'');if(project==='fieldnote'&&!UUID.test(field))STOP('BOOKED_FIELD_SESSION_REQUIRED');
 const expected={capture:env.DEMO_EXPECTED_CAPTURE,record:env.DEMO_EXPECTED_RECORD,order:env.DEMO_EXPECTED_ORDER};
 if(!ID.test(expected.capture||'')||!ID.test(expected.record||'')||(project!=='merchant'&&!ID.test(expected.order||'')))STOP('SANITIZED_EXPECTED_IDS_REQUIRED');
 if(!/^[a-f0-9]{40}$/.test(env.DEMO_REVIEWED_SHA||''))STOP('REVIEWED_COMMIT_REQUIRED');
 return {project,cfg,owner,field,expiry,expected,sha:env.DEMO_REVIEWED_SHA};
}
export function completedRecord(project,data,expected){
 if(project==='merchant'){
  const rows=data.operations?.filter(o=>o.case_id==='EX-1042'&&o.mode==='sandbox')||[];const op=rows[0];
  if(rows.length!==1||op.status!=='completed'||op.provider_status!=='COMPLETED'||op.amount!==3400||op.capture_id!==expected.capture||op.refund_id!==expected.record)STOP('MERCHANT_COMPLETED_ROW_MISMATCH');return op;
 }
 if(project==='supplypilot'){
  const receipt=data.state?.receipts?.find(r=>r.id===expected.record);
  if(data.state.order||!receipt||receipt.mode!=='sandbox'||receipt.captureId!==expected.capture||receipt.orderId!==expected.order||receipt.quote?.currency!=='USD'||receipt.quote.total!==20166||data.state.receipts.filter(r=>r.approvalId===receipt.approvalId).length!==1)STOP('SUPPLY_COMPLETED_RECEIPT_MISMATCH');return receipt;
 }
 const s=data.state;
 if(data.mode!=='sandbox'||s?.stage!=='booked'||s.order?.id!==expected.order||s.payment?.mode!=='sandbox'||s.payment.status!=='SANDBOX_COMPLETED'||s.payment.amount!==15500||s.payment.capture!==expected.capture||expected.record!==expected.capture)STOP('FIELD_COMPLETED_BOOKING_MISMATCH');return s;
}
export function allowedPost(project,path,body,record){
 if(project==='merchant'&&path==='/api/desk'&&body.caseId==='EX-1042'){
  if(body.action==='analyze')return true;
  const completed=record?.status==='completed'&&record.mode==='sandbox'&&record.amount===3400;
  if(body.mode==='sandbox'&&body.action==='reconcile')return completed;
  return completed&&body.action==='approve'&&body.mode==='sandbox'&&body.approved===true&&body.amountCents===3400&&!body.injectTimeout;
 }
 if(project==='supplypilot'&&path==='/api/workspace'){
  if(body.action==='explain')return true;
  return false; // The Supply clip never checks out or replays a financial action.
 }
 return false; // Field footage is entirely read-only; its paid booking already exists.
}
function ffText(value){return value.replace(/[\\':,%\[\]]/g,' ');}
export function captionLines(value,limit=115){const words=value.split(/\s+/),lines=[''];for(const word of words){const current=lines.at(-1);if(current&&current.length+1+word.length>limit)lines.push(word);else lines[lines.length-1]=current?(current+' '+word):word;}if(lines.length>2||lines.some(line=>line.length>limit))STOP('CAPTION_EXCEEDS_TWO_READABLE_LINES');return lines;}

export async function record(){
 stage('CONFIGURATION');
 const config=configuration(),{project,cfg,owner,field,expiry,expected,sha}=config;
 // Never pass cookies to dependency installers, Chrome environment or ffmpeg.
 delete process.env.DEMO_OWNER_COOKIE;delete process.env.DEMO_FIELD_SESSION;
 stage('CHECKOUT_VERIFY');
 // Container checkout ownership can differ from the recording UID. Trust only
 // this reviewed working directory for this one read; never set a global wildcard.
 const head=(await run('git',checkoutCommand())).stdout.trim();if(head!==sha)STOP('CHECKOUT_IS_NOT_REVIEWED_COMMIT');
 stage('PLAYWRIGHT_LOAD');
 const require=createRequire(resolve(process.env.DEMO_PLAYWRIGHT_HOME||'.','package.json'));
 const {chromium}=require('playwright');stage('OUTPUT_SETUP');const output=resolve('recording-final'),raw=resolve('recording-private');await mkdir(output,{recursive:true});await mkdir(raw,{recursive:true});
 let browser,context,page,video,aborted=false,pageError=false,deskSession='';const scenes=[];const aiEvidence={attempted:false,engine:null,usedFallback:null};let started=0,posts=0;
 const cleanEnv={...process.env};delete cleanEnv.DEMO_OWNER_COOKIE;delete cleanEnv.DEMO_FIELD_SESSION;
 try{
  stage('BROWSER_START');
  browser=await chromium.launch({headless:true,env:cleanEnv});
  stage('CONTEXT_SETUP');
  context=await browser.newContext({viewport:{width:1280,height:800},locale:'en-US',timezoneId:'UTC',serviceWorkers:'block',recordVideo:{dir:raw,size:{width:1280,height:800}}});
  const hostname=new URL(cfg.origin).hostname;await context.addCookies([{name:'__Host-inkwell_owner',value:owner,domain:hostname,path:'/',secure:true,httpOnly:true,sameSite:'Lax',expires:expiry},...(project==='fieldnote'?[{name:'fieldnote',value:field,domain:hostname,path:'/',secure:true,httpOnly:true,sameSite:'Lax',expires:expiry}]:[])]);
  async function read(){const response=await context.request.get(cfg.origin+cfg.api,{maxRedirects:0,timeout:15000});if(!response.ok())STOP('AUTHENTICATED_PREFLIGHT_FAILED');const data=await response.json();completedRecord(project,data,expected);return data;}
  stage('DEPLOYED_SCENE_VERIFY');
  const remoteScene=await context.request.get(cfg.origin+'/site/scene.js',{maxRedirects:0,timeout:15000});if(!remoteScene.ok())STOP('DEPLOYED_SCENE_UNAVAILABLE');const remoteSceneText=await remoteScene.text(),localSceneText=await readFile('site/scene.js','utf8');const sceneHash=createHash('sha256').update(localSceneText).digest('hex');if(createHash('sha256').update(remoteSceneText).digest('hex')!==sceneHash)STOP('DEPLOYED_SCENE_DOES_NOT_MATCH_REVIEWED_SOURCE');
  stage('COMPLETED_RECORD_PREFLIGHT');
  let snapshot=await read();let target=completedRecord(project,snapshot,expected);
  if(project==='merchant'){
   if(!UUID.test(target.session||''))STOP('ORIGINAL_DESK_SESSION_REQUIRED');
   deskSession=target.session;await context.addCookies([{name:'desk_session',value:deskSession,domain:hostname,path:'/',secure:true,httpOnly:true,sameSite:'Strict',expires:expiry}]);snapshot=await read();
  }
  // Browser guard is separate from operation correctness: no arbitrary full-owner requests.
  await context.route('**/*',async route=>{
   const request=route.request();let url;try{url=new URL(request.url());}catch{aborted=true;return route.abort();}
   if(url.origin!==cfg.origin){aborted=true;return route.abort();}
   if(['GET','HEAD'].includes(request.method())){if(url.pathname.startsWith('/owner/')||url.searchParams.has('paypal')){aborted=true;return route.abort();}return route.continue();}
   if(request.method!=='POST'||posts>=2){aborted=true;return route.abort();}
   let body;try{body=request.postDataJSON();}catch{aborted=true;return route.abort();}
   try{target=completedRecord(project,await read(),expected);}catch{aborted=true;return route.abort();}
   if(!allowedPost(project,url.pathname,body,target)){aborted=true;return route.abort();}
   posts++;return route.continue();
  });
  stage('PAGE_SETUP');page=await context.newPage();video=page.video();started=Date.now();page.on('pageerror',()=>{pageError=true;});page.setDefaultTimeout(15000);
  async function scene(title,detail,seconds=15){
   await page.waitForFunction(()=>document.body.getAttribute('aria-busy')!=='true');
   if(expiry-Math.floor(Date.now()/1000)<seconds+30)STOP('COOKIE_EXPIRES_DURING_RECORDING');
   const body=await page.locator('body').innerText();if(body.includes(owner)||(field&&body.includes(field))||(deskSession&&body.includes(deskSession)))STOP('SESSION_VALUE_VISIBLE');
   captionLines(detail);
   scenes.push({at:(Date.now()-started)/1000,title,detail});await page.waitForTimeout(seconds*1000);
  }
  stage('PUBLIC_SCENE');await page.goto(cfg.origin+'/',{waitUntil:'domcontentloaded',timeout:20000});await page.waitForFunction(version=>document.documentElement.dataset.scene==='ready'&&document.documentElement.dataset.sceneVersion===version,project==='supplypilot'?'mesh-v7p2':'mesh-v7');await scene(cfg.title+' · '+cfg.audience,'Synthetic data · previously verified sandbox outcome · no new payment during this recording',12);
  stage('PRIVATE_SCENE');await page.goto(cfg.origin+'/app',{waitUntil:'networkidle',timeout:20000});if(await page.locator('#access-key').count())STOP('LOGIN_MUST_NOT_BE_RECORDED');
  if(project==='merchant'){
   await scene('An incomplete $198 order','The fulfillment fixture supports a $34 missing-pouch refund. Human approval and server policy retain authority.',24);
   const ai=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/desk'&&r.request().method()==='POST'&&r.request().postDataJSON()?.action==='analyze');
   await page.waitForFunction(()=>document.body.getAttribute('aria-busy')!=='true');await page.locator('[data-action="analyze"]').click();const result=await(await ai).json();if(result.proposal?.amountCents!==3400||!result.explanation?.engine)STOP('EXPLANATION_OR_POLICY_NOT_VERIFIED');
   aiEvidence.attempted=true;aiEvidence.engine=result.explanation.engine;aiEvidence.usedFallback=!result.explanation.engine.includes('OpenRouter');
   await scene(aiEvidence.usedFallback?'A safe local fallback; policy decides':'Actual AI explains; policy decides',aiEvidence.usedFallback?'The live attempt used deterministic fallback. The displayed engine is accurate; model availability cannot change the $34 policy amount.':'This is the live synthetic model response. The model cannot change the amount or authorize a refund.',28);
   await page.locator('#payment-mode').selectOption('sandbox');await page.locator('.proposal.success .resultbox strong').filter({hasText:expected.record}).waitFor();
   await scene('PayPal sandbox refund complete','The recorded $34 refund is shown with its actual receipt. Test funds only; wallet return UX is unverified.',30);
   await page.locator('[data-action="replay"]').click();await page.getByText('Duplicate suppressed. The original refund was reused.',{exact:true}).waitFor();await read();
   await page.locator('.auditpanel').scrollIntoViewIfNeeded();await scene('Replay reuses one operation','The existing completed operation, refund and request ID remain unchanged. No new refund is issued.',30);
  }else if(project==='supplypilot'){
   await scene('A policy-checked purchase','Eight mailer packs. The approved all-in quote is $201.66 USD; budget, stock and seller checks run on the server.',28);
   await page.locator('[data-view="connections"]').first().click();
   if(await page.locator('#explain').count()){
    const ai=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/workspace'&&r.request().method()==='POST'&&r.request().postDataJSON()?.action==='explain');await page.waitForFunction(()=>document.body.getAttribute('aria-busy')!=='true');await page.locator('#explain').click();const result=await(await ai).json();if(!result.aiSource||!result.explanation)STOP('EXPLANATION_NOT_VERIFIED');aiEvidence.attempted=true;aiEvidence.engine=result.aiSource;aiEvidence.usedFallback=!result.aiSource.includes('OpenRouter');
   }else{aiEvidence.engine='Deterministic rules (provider not configured)';aiEvidence.usedFallback=true;}
   await scene(aiEvidence.usedFallback?'Guarded rules remain available':'Actual AI explains fixture options',aiEvidence.usedFallback?'The displayed engine used local deterministic rules. AI availability cannot change the approved price or bypass policy.':'The live explanation is bounded by supplied facts. Exact-quote approval and checkout remain deterministic.',28);
   await page.locator('[data-view="orders"]').first().click();await page.locator('.table-wrap td strong').filter({hasText:expected.record}).waitFor();
   await scene('One actual sandbox capture','The real $201.66 test-funds capture produced this single receipt. No real supplies ship.',30);
   await page.locator('[data-view="audit"]').first().click();await scene('An inspectable decision trail','Prior receipts and audit history are preserved. Duplicate protection was verified separately; no new checkout runs here.',30);
  }else{
   aiEvidence.engine=snapshot.state.engine==='openrouter'?'Stored validated OpenRouter extraction':'Stored deterministic quote rules';aiEvidence.usedFallback=snapshot.state.engine!=='openrouter';
   await page.locator('#quote-heading').scrollIntoViewIfNeeded();await scene('A catalog-priced service quote',aiEvidence.usedFallback?'The recorded scope is three carpet rooms plus pet treatment at $155 USD. The displayed drafting engine is local rules.':'The recorded scope is three carpet rooms plus pet treatment at $155 USD. The stored actual AI engine label is shown.',28);
   await page.locator('#calendar').scrollIntoViewIfNeeded();await scene('Scope, price and time approved together','Fixed UTC windows and synthetic availability. The original approved scope is locked; no calendar integration is claimed.',24);
   await page.locator('#receipt').scrollIntoViewIfNeeded();await page.locator('#receipt-ref').filter({hasText:expected.capture}).waitFor();
   await scene('Payment confirmed before booking','This actual PayPal sandbox capture unlocked the recorded booking. Test funds only; wallet return UX is unverified.',30);
   await page.locator('#activity').scrollIntoViewIfNeeded();await scene('One confirmed commitment','The existing booking and its decision history are shown. A separate ledger check verified one booking and replay safety.',30);
  }
  await read();if(aborted||pageError)STOP('UNEXPECTED_REQUEST_OR_BROWSER_ERROR');
  const ending=project==='merchant'?'Evidence, exact consent and safe recovery':project==='supplypilot'?'Deliberate buying, with an inspectable outcome':'A clear scope, followed by a payment-backed spot';
  await scene(ending,'This is a sandbox preview with synthetic data. No live money, real fulfilment or wallet-return UX is claimed.',Math.max(0,155-(Date.now()-started)/1000));
  stage('VIDEO_FLUSH');await context.close();context=null;const rawPath=await video.path();await browser.close();browser=null;
  const captionFile=join(output,project+'-captions.json');await writeFile(captionFile,JSON.stringify({project,scenes,ai:aiEvidence,source:'actual hosted browser footage',walletReturnUxVerified:false},null,2));
  const filters=['pad=1280:940:0:0:color=0x0b151a'];const font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
  for(let i=0;i<scenes.length;i++){const end=scenes[i+1]?.at||165;filters.push(`drawtext=fontfile=${font}:text='${ffText(scenes[i].title)}':x=34:y=827:fontsize=28:fontcolor=white:enable='between(t,${scenes[i].at.toFixed(2)},${end.toFixed(2)})'`);for(const [line,text]of captionLines(scenes[i].detail).entries())filters.push(`drawtext=fontfile=${font}:text='${ffText(text)}':x=34:y=${line===0?868:896}:fontsize=17:fontcolor=0xc9d7dc:enable='between(t,${scenes[i].at.toFixed(2)},${end.toFixed(2)})'`);}
  stage('VIDEO_ENCODE');const destination=join(output,project+'-demo-preview.mp4');await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',rawPath,'-t','165','-vf',filters.join(','),'-c:v','libx264','-preset','medium','-crf','19','-pix_fmt','yuv420p','-an','-movflags','+faststart',destination],{env:cleanEnv,maxBuffer:1024*1024});
  const probe=JSON.parse((await run('ffprobe',['-v','error','-show_entries','format=duration','-of','json',destination],{env:cleanEnv})).stdout);const duration=Number(probe.format?.duration);if(!Number.isFinite(duration)||duration<=0||duration>=180)STOP('VIDEO_MUST_BE_LESS_THAN_THREE_MINUTES');
  stage('STORYBOARD');const thumbs=[];for(let i=0;i<scenes.length;i++){const at=Math.min(duration-0.1,scenes[i].at+Math.min(5,Math.max(0.1,((scenes[i+1]?.at||duration)-scenes[i].at)/2)));const thumb=join(output,project+'-storyboard-'+String(i+1).padStart(2,'0')+'.png');await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss',String(at),'-i',destination,'-frames:v','1',thumb],{env:cleanEnv,maxBuffer:1024*1024});thumbs.push({file:thumb,at,title:scenes[i].title});}
  await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',destination,'-vf',`fps=1/${Math.max(1,duration/9)},scale=426:-1,tile=3x3`,'-frames:v','1',join(output,project+'-contact-sheet.png')],{env:cleanEnv,maxBuffer:1024*1024});
  await writeFile(join(output,project+'-manifest.json'),JSON.stringify({project,origin:cfg.origin,reviewedCommit:sha,deployedSceneSha256:sceneHash,durationSeconds:duration,ai:aiEvidence,storyboard:thumbs.map(t=>({file:basename(t.file),at:t.at,title:t.title})),expectedCapture:expected.capture,expectedRecord:expected.record,financialMutations:'none; optional prevalidated completed-refund replay only',walletReturnUxVerified:false,previewOnly:true},null,2));
  console.log(JSON.stringify({project,status:'PREVIEW_RECORDED',durationSeconds:duration,previewOnly:true}));
 }finally{await context?.close().catch(()=>{});await browser?.close().catch(()=>{});await rm(raw,{recursive:true,force:true});}
}
export async function selfTest(){
 const assert=(await import('node:assert/strict')).default;const exp={capture:'CAPTURE1',record:'REFUND1'};const op={case_id:'EX-1042',mode:'sandbox',status:'completed',provider_status:'COMPLETED',amount:3400,capture_id:'CAPTURE1',refund_id:'REFUND1'};
 assert.equal(completedRecord('merchant',{operations:[op]},exp),op);assert.throws(()=>completedRecord('merchant',{operations:[{...op,status:'uncertain'}]},exp));
 assert.equal(allowedPost('merchant','/api/desk',{action:'approve',caseId:'EX-1042',mode:'sandbox',amountCents:3400,approved:true},op),true);
 assert.equal(allowedPost('merchant','/api/desk',{action:'approve',caseId:'EX-1043',mode:'sandbox',amountCents:3400,approved:true},op),false);
 assert.equal(allowedPost('supplypilot','/api/paypal',{action:'capture'},{}),false);assert.equal(allowedPost('fieldnote','/api/capture',{version:1},{}),false);
 assert.equal(allowedPost('supplypilot','/api/workspace',{action:'reset'},{}),false);assert.equal(allowedPost('merchant','/owner/login',{access_key:'fixture'},op),false);
 assert.equal(allowedPost('supplypilot','/api/workspace',{action:'checkout',approvalId:'fixture'},{}),false);
 assert.equal(allowedPost('merchant','/api/desk',{action:'approve',caseId:'EX-1042',mode:'sandbox',amountCents:3400,approved:true},{...op,status:'uncertain'}),false);
 const wrapped=captionLines('This is a deliberately long but readable description of the recorded sandbox workflow and its exact completed receipt; its second sentence should wrap to the following caption line without clipping.');assert.equal(wrapped.length,2);assert.ok(wrapped.every(line=>line.length<=115));
 const checkout=checkoutCommand('/reviewed/checkout');assert.deepEqual(checkout,['-c','safe.directory='+resolve('/reviewed/checkout'),'rev-parse','HEAD']);assert.ok(!checkout.some(value=>value==='--global'||value.includes('*')));
 const hidden='PRIVATE_AUTH_SENTINEL';assert.deepEqual(safeDiagnostic({code:128,message:hidden,stderr:hidden}),{stage:'BOOT',code:'SUBPROCESS_EXIT_128'});assert.deepEqual(safeDiagnostic({code:'MODULE_NOT_FOUND',message:hidden}),{stage:'BOOT',code:'MODULE_NOT_FOUND'});assert.ok(!JSON.stringify(safeDiagnostic({message:hidden,command:hidden,headers:{cookie:hidden}})).includes(hidden));
 console.log('Recording guard self-test passed. No browser, cookies, GitHub secrets or network were used.');
}
if(typeof process!=='undefined'&&process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{if(process.argv.includes('--self-test'))await selfTest();else if(process.argv.includes('--execute'))await record();else console.log('Prepared only. --self-test checks guards; --execute requires reviewed commit, short project owner cookie and exact completed-record IDs. No GitHub secret is created or deleted by this script.');}catch(error){console.error(JSON.stringify({status:'RECORDING_STOPPED',...safeDiagnostic(error)}));process.exitCode=1;}}
