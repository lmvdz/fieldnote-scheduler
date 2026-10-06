// Copy to scripts/record-demo-readonly.mjs in each reviewed repository.
// Hosted footage never creates a new approval, order, capture or refund.
// Fieldnote additionally films a fresh isolated local no-money simulator.
// The supplied owner cookie is still a full owner bearer credential, not a viewer token.
import {mkdir,writeFile,rm,readFile,mkdtemp} from 'node:fs/promises';
import {createHash,randomBytes} from 'node:crypto';
import {resolve,join,basename,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {execFile,spawn} from 'node:child_process';
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
 const webhookProof=project==='fieldnote'?verifiedWebhookProof(env.DEMO_FIELD_WEBHOOK_PROOF,expected):null;
 return {project,cfg,owner,field,expiry,expected,sha:env.DEMO_REVIEWED_SHA,webhookProof};
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
 return false; // Hosted Field footage is GET-only; its paid booking already exists.
}
export function verifiedWebhookProof(raw,expected){
 if(typeof raw!=='string'||raw.length>2048)STOP('FIELD_VERIFIED_WEBHOOK_PROOF_REQUIRED');
 let proof;try{proof=JSON.parse(raw);}catch{STOP('FIELD_WEBHOOK_PROOF_INVALID');}
 const keys=['date','eventId','orderId','captureId','currency','amountCents','verifiedWebhookRecorded','orders','bookedSlots'];
 if(!proof||Array.isArray(proof)||Object.keys(proof).length!==keys.length||Object.keys(proof).some(key=>!keys.includes(key))||typeof proof.date!=='string'||!Number.isFinite(Date.parse(proof.date))||!/^WH-[A-Z0-9-]{1,100}$/.test(proof.eventId||'')||proof.orderId!==expected.order||proof.captureId!==expected.capture||proof.currency!=='USD'||proof.amountCents!==15500||proof.verifiedWebhookRecorded!==true||proof.orders!==1||proof.bookedSlots!==1)STOP('FIELD_WEBHOOK_PROOF_INVALID');
 return proof;
}
export function fixtureEnvironment(source,localKey){
 if(!/^[a-f0-9]{64}$/.test(localKey||''))STOP('LOCAL_OWNER_KEY_INVALID');
 const env={};for(const name of ['PATH','Path','SystemRoot','SYSTEMROOT','WINDIR','windir','TEMP','TMP','LANG','LC_ALL'])if(typeof source[name]==='string')env[name]=source[name];
 return {...env,TZ:'UTC',SITE_OWNER_KEY:localKey,AI_MODE:'demo',PAYPAL_MODE:'demo',AI_ALLOW_PAID_FALLBACK:'false',OPENROUTER_API_KEY:'',OPENAI_API_KEY:'',PAYPAL_CLIENT_ID:'',PAYPAL_CLIENT_SECRET:'',PAYPAL_WEBHOOK_ID:''};
}
export function assertDemoState(data){
 const state=data?.state;
 if(data?.mode!=='demo'||data.aiConfigured!==false||data.currency!=='USD'||!state||!Number.isSafeInteger(state.version)||state.engine==='openrouter'||!Array.isArray(state.lines)||!Array.isArray(state.questions)||!Array.isArray(data.availability))STOP('LOCAL_DEMO_STATE_REQUIRED');
 if(state.order&&(state.order.mode!=='demo'||!/^DEMO-[a-f0-9-]{36}$/.test(state.order.id||'')||state.order.approvalUrl))STOP('LOCAL_ORDER_IS_NOT_SIMULATION');
 if(state.payment&&(state.payment.mode!=='demo'||state.payment.status!=='DEMO_COMPLETED'||!/^DEMO-CAP-DEMO-[a-f0-9-]{36}$/.test(state.payment.capture||'')))STOP('LOCAL_PAYMENT_IS_NOT_SIMULATION');
 return state;
}
export function allowedFixturePost(origin,url,method,body,data,posts){
 let parsed;try{parsed=new URL(url);}catch{return false;}
 if(!/^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}$/.test(origin)||parsed.origin!==origin||parsed.search||method!=='POST'||posts>=12||!body||Array.isArray(body))return false;
 let state;try{state=assertDemoState(data);}catch{return false;}
 if(body.version!==state.version)return false;
 const exactKeys=keys=>Object.keys(body).length===keys.length&&Object.keys(body).every(key=>keys.includes(key));
 const total=state.lines.reduce((sum,line)=>sum+line.quantity*line.rate,0);
 if(parsed.pathname==='/api/draft')return exactKeys(['version','request','details'])&&["I'd like 3 rooms of carpet cleaned, with pet treatment. A weekday morning would work well.",'Maybe clean the carpet or the windows. I am not sure how much needs doing.'].includes(body.request)&&body.details&&typeof body.details==='object'&&!Array.isArray(body.details)&&Object.keys(body.details).length===0&&['draft','review'].includes(state.stage);
 if(parsed.pathname==='/api/edit')return exactKeys(['version','lines','slot'])&&['review','approved'].includes(state.stage)&&Array.isArray(body.lines)&&body.lines.length===2&&body.lines.every((line,index)=>line&&Object.keys(line).length===3&&Object.keys(line).every(key=>['description','quantity','rate'].includes(key))&&line.description===(index?'Pet treatment':'Carpet cleaning')&&line.rate===(index?2000:4500)&&(index?line.quantity===1:[3,4].includes(line.quantity)))&&data.availability.some(slot=>slot.slot===body.slot&&['available','yours'].includes(slot.status));
 if(parsed.pathname==='/api/approve')return exactKeys(['version'])&&state.stage==='review'&&state.questions.length===0&&total===15500&&!!state.slot;
 if(parsed.pathname==='/api/order')return exactKeys(['version'])&&state.stage==='approved'&&total===15500&&!!state.approval?.fingerprint;
 if(parsed.pathname==='/api/capture')return exactKeys(['version','outcome'])&&['pending','completed'].includes(body.outcome)&&state.stage==='awaiting'&&state.order?.mode==='demo'&&total===15500;
 return false;
}
// Runtime wrapper around the reviewed built Worker and SQLite adapter. No private
// config loader or inherited application bindings are used. Any server fetch stops.
export function fixtureBootstrap(){return `
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {sqliteBinding} from './scripts/sqlite-adapter.mjs';
if(process.env.PAYPAL_MODE!=='demo'||process.env.AI_MODE!=='demo'||process.env.AI_ALLOW_PAID_FALLBACK!=='false'||['OPENROUTER_API_KEY','OPENAI_API_KEY','PAYPAL_CLIENT_ID','PAYPAL_CLIENT_SECRET','PAYPAL_WEBHOOK_ID'].some(key=>process.env[key]))throw Error('FIXTURE_ENV_UNSAFE');
globalThis.fetch=async()=>{console.log('FIELD_FIXTURE_PROVIDER_BLOCKED');throw Error('FIXTURE_PROVIDER_IO_BLOCKED');};
const source=readFileSync('dist/server/index.js','utf8');
const worker=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;
const env={SITE_OWNER_KEY:process.env.SITE_OWNER_KEY,AI_MODE:'demo',PAYPAL_MODE:'demo',AI_ALLOW_PAID_FALLBACK:'false',OPENROUTER_API_KEY:'',OPENAI_API_KEY:'',PAYPAL_CLIENT_ID:'',PAYPAL_CLIENT_SECRET:'',PAYPAL_WEBHOOK_ID:'',DB:sqliteBinding('.local/fieldnote.sqlite')};
const server=createServer(async(req,res)=>{try{
 const origin='http://127.0.0.1:'+server.address().port;
 if(req.headers.host!==new URL(origin).host){res.writeHead(403);res.end('Local host required');return;}
 const path=new URL(req.url,origin).pathname;
 if(req.method==='POST'&&!['/owner/login','/api/draft','/api/edit','/api/approve','/api/order','/api/capture'].includes(path)){res.writeHead(403);res.end('Fixture action unavailable');return;}
 if(!['GET','HEAD','POST'].includes(req.method)){res.writeHead(405);res.end('Method unavailable');return;}
 const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>20000)throw Error('FIXTURE_BODY_TOO_LARGE');chunks.push(chunk);}
 const request=new Request(origin+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
 const result=await worker.fetch(request,env);res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));
}catch{res.writeHead(500);res.end('Fixture unavailable');}});
server.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({stage:'FIELD_FIXTURE_READY',port:server.address().port})));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
`;}
function ffText(value){return value.replace(/[\\':,%\[\]]/g,' ');}
export function captionLines(value,limit=115){const words=value.split(/\s+/),lines=[''];for(const word of words){const current=lines.at(-1);if(current&&current.length+1+word.length>limit)lines.push(word);else lines[lines.length-1]=current?(current+' '+word):word;}if(lines.length>2||lines.some(line=>line.length>limit))STOP('CAPTION_EXCEEDS_TWO_READABLE_LINES');return lines;}

async function durationOf(path,env){const result=JSON.parse((await run('ffprobe',['-v','error','-show_entries','format=duration','-of','json',path],{env})).stdout);const duration=Number(result.format?.duration);if(!Number.isFinite(duration)||duration<=0)STOP('VIDEO_DURATION_INVALID');return duration;}
export async function stopFixtureChild(child){
 if(!child||child.exitCode!==null||child.signalCode!==null)return;
 await new Promise((resolveStop,rejectStop)=>{
  let forceTimer,exitTimer;
  const done=()=>{clearTimeout(forceTimer);clearTimeout(exitTimer);resolveStop();};child.once('exit',done);
  forceTimer=setTimeout(()=>{child.kill('SIGKILL');exitTimer=setTimeout(()=>rejectStop(Error('RECORDING_STOP_LOCAL_SERVER_DID_NOT_EXIT')),5000);},3000);
  child.kill('SIGTERM'); // Only a confirmed exit permits recursive scratch cleanup.
 });
}

export async function recordFieldJourney({browser,productionContext,config,snapshot,read,output,raw,cleanEnv,sceneHash,hostedGuardFailed,cleanupState}){
 const {cfg,owner,field,expected,sha,expiry,webhookProof}=config;
 let child,localContext,providerBlocked=false,childExited=false,localPage,productionPage;
 const localScenes=[],productionScenes=[],localKey=randomBytes(32).toString('hex');
 const sourceWorker=await readFile('dist/server/index.js');const workerHash=createHash('sha256').update(sourceWorker).digest('hex');
 const fixtureRoot=await mkdtemp(join(raw,'field-fixture-'));
 const productionStateBefore=JSON.stringify(snapshot.state);
 const fixtureProof={isolatedDatabase:true,providerKeysAbsent:true,serverFetchBlocked:true,scopeAmbiguityBlocked:false,approvalRevokedByEdit:false,freshApprovalRequired:false,pendingUnconfirmed:false,demoBookingCompleted:false,localTotalCents:15500};
 let localPosts=0,localCookies=[];
 async function localRead(){
  const response=await localContext.request.get(localOrigin+'/api/state',{maxRedirects:0,timeout:10000});if(!response.ok())STOP('LOCAL_STATE_PREFLIGHT_FAILED');const data=await response.json();assertDemoState(data);return data;
 }
 let localOrigin;
 async function safeFrame(page){
  if(providerBlocked||childExited||hostedGuardFailed())STOP('FIELD_RECORDING_GUARD_FAILED');
  const body=await page.locator('body').innerText();
  if([owner,field,localKey,...localCookies].some(token=>token&&body.includes(token)))STOP('SESSION_VALUE_VISIBLE');
 }
 async function show(page,scenes,started,title,detail,seconds,action,first=false){
  captionLines(detail);scenes.push({at:first?0:(Date.now()-started)/1000,title,detail});
  if(action)await action();await page.waitForFunction(()=>document.body.getAttribute('aria-busy')!=='true');await safeFrame(page);
  if(expiry-Math.floor(Date.now()/1000)<seconds+30)STOP('COOKIE_EXPIRES_DURING_RECORDING');
  await page.waitForTimeout(seconds*1000);
 }
 async function localAction(path,action,check){
  stage('FIELD_SIM_'+path.slice(5).toUpperCase());
  const pending=localPage.waitForResponse(response=>new URL(response.url()).origin===localOrigin&&new URL(response.url()).pathname===path&&response.request().method()==='POST',{timeout:15000});
  await action();const response=await pending;if(!response.ok())STOP('LOCAL_ACTION_FAILED');const data=await response.json();assertDemoState(data);check(data.state,data);await localPage.waitForFunction(()=>document.body.getAttribute('aria-busy')!=='true');return data;
 }
 const assert=(condition,code)=>{if(!condition)STOP(code);};
 try{
  stage('FIELD_ISOLATED_RUNTIME');
  // Copy only reviewed, non-private runtime inputs. A fresh directory has no DB,
  // .dev.vars, .env, owner session, Cloudflare binding or provider configuration.
  for(const name of ['dist/server','scripts','drizzle'])await mkdir(join(fixtureRoot,name),{recursive:true});
  await writeFile(join(fixtureRoot,'dist/server/index.js'),sourceWorker);
  for(const name of ['scripts/sqlite-adapter.mjs','drizzle/0000_fieldnote.sql'])await writeFile(join(fixtureRoot,name),await readFile(name));
  await writeFile(join(fixtureRoot,'fixture-bootstrap.mjs'),fixtureBootstrap());
  child=spawn(process.execPath,['--no-warnings','fixture-bootstrap.mjs'],{cwd:fixtureRoot,env:fixtureEnvironment(cleanEnv,localKey),windowsHide:true,stdio:['ignore','pipe','pipe']});
  child.on('exit',()=>{childExited=true;});child.stderr.on('data',()=>{}); // Never raw child diagnostics.
  const port=await new Promise((resolvePort,reject)=>{
   let buffered='';const timer=setTimeout(()=>reject(Error('RECORDING_STOP_LOCAL_SERVER_NOT_READY')),15000);
   child.once('error',()=>{clearTimeout(timer);reject(Error('RECORDING_STOP_LOCAL_SERVER_START_FAILED'));});
   child.once('exit',()=>{clearTimeout(timer);reject(Error('RECORDING_STOP_LOCAL_SERVER_EXITED'));});
   child.stdout.on('data',chunk=>{
    buffered+=chunk.toString();if(buffered.length>4096){buffered='';clearTimeout(timer);reject(Error('RECORDING_STOP_LOCAL_SERVER_OUTPUT_UNEXPECTED'));return;}
    let newline;while((newline=buffered.indexOf('\n'))!==-1){const line=buffered.slice(0,newline).trim();buffered=buffered.slice(newline+1);if(line==='FIELD_FIXTURE_PROVIDER_BLOCKED'){providerBlocked=true;continue;}let message;try{message=JSON.parse(line);}catch{continue;}if(message.stage==='FIELD_FIXTURE_READY'&&Number.isInteger(message.port)&&message.port>0&&message.port<=65535){clearTimeout(timer);resolvePort(message.port);}}
   });
  });
  localOrigin='http://127.0.0.1:'+port;
  localContext=await browser.newContext({viewport:{width:1280,height:800},locale:'en-US',timezoneId:'UTC',serviceWorkers:'block',recordVideo:{dir:raw,size:{width:1280,height:800}}});
  assert((await localContext.cookies()).length===0,'LOCAL_CONTEXT_MUST_START_EMPTY');
  stage('FIELD_LOCAL_AUTH_OFF_CAMERA');
  const login=await localContext.request.post(localOrigin+'/owner/login',{form:{access_key:localKey,next:'/app'},headers:{Origin:localOrigin},maxRedirects:0,timeout:10000});assert(login.status()===303,'LOCAL_AUTH_FAILED');
  const cookies=await localContext.cookies();assert(cookies.length===1&&cookies[0].name==='inkwell_owner'&&cookies[0].domain==='127.0.0.1'&&cookies[0].value!==owner,'LOCAL_OWNER_COOKIE_SCOPE_INVALID');localCookies=cookies.map(cookie=>cookie.value);
  let data=await localRead();assert(data.state.stage==='draft'&&data.state.lines.length===0&&!data.state.order&&!data.state.payment&&!data.state.approval,'LOCAL_DATABASE_MUST_BE_FRESH');
  localCookies=(await localContext.cookies()).map(cookie=>cookie.value);
  await localContext.route('**/*',async route=>{
   const request=route.request();let url;try{url=new URL(request.url());}catch{providerBlocked=true;return route.abort();}
   if(url.origin!==localOrigin||url.search||url.pathname.startsWith('/owner/')||url.pathname==='/api/paypal/webhook'){providerBlocked=true;return route.abort();}
   if(['GET','HEAD'].includes(request.method()))return route.continue();
   let body,current;try{body=request.postDataJSON();current=await localRead();}catch{providerBlocked=true;return route.abort();}
   if(!allowedFixturePost(localOrigin,request.url(),request.method(),body,current,localPosts)){providerBlocked=true;return route.abort();}
   localPosts++;return route.continue();
  });
  stage('FIELD_SIMULATOR_PAGE');const localStarted=Date.now();localPage=await localContext.newPage();const localVideo=localPage.video();localPage.setDefaultTimeout(15000);localPage.on('pageerror',()=>{providerBlocked=true;});
  await show(localPage,localScenes,localStarted,'A service promise starts with agreement','For independent service businesses: unclear scope and changing prices can create the wrong appointment. Local no-money demonstration.',8,async()=>{await localPage.goto(localOrigin+'/app',{waitUntil:'domcontentloaded',timeout:15000});await localPage.locator('#request').waitFor();},true);
  await show(localPage,localScenes,localStarted,'Unclear requests need a human answer','Local simulator: carpet or windows, with no quantity. Clarification is required; an uncertain request cannot be approved.',8,async()=>{
   await localPage.locator('#request').fill('');await localPage.locator('#request').pressSequentially('Maybe clean the carpet or the windows. I am not sure how much needs doing.',{delay:18});
   await localAction('/api/draft',()=>localPage.locator('#draft').click(),state=>{assert(state.questions.length>0&&state.lines.length===0&&!state.approval,'AMBIGUOUS_SCOPE_NOT_BLOCKED');fixtureProof.scopeAmbiguityBlocked=true;});await localPage.locator('#questions').scrollIntoViewIfNeeded();assert(await localPage.locator('#approve').isDisabled(),'AMBIGUOUS_APPROVAL_CONTROL_ENABLED');
  });
  await show(localPage,localScenes,localStarted,'A clear request becomes an editable $155 quote','Local rules price three carpet rooms at $45 plus $20 pet treatment. The person reviews every line and chooses a UTC window.',10,async()=>{
   await localPage.locator('#request').scrollIntoViewIfNeeded();await localPage.locator('#request').fill('');await localPage.locator('#request').pressSequentially("I'd like 3 rooms of carpet cleaned, with pet treatment. A weekday morning would work well.",{delay:18});
   data=await localAction('/api/draft',()=>localPage.locator('#draft').click(),state=>assert(state.questions.length===0&&state.lines.reduce((sum,line)=>sum+line.quantity*line.rate,0)===15500&&state.engine!=='openrouter','LOCAL_QUOTE_NOT_VERIFIED'));
   const slot=data.availability.find(slot=>slot.status==='available');assert(!!slot,'LOCAL_SLOT_UNAVAILABLE');await localPage.locator('[data-slot="'+slot.slot+'"]').click();await localAction('/api/edit',()=>localPage.locator('#save-quote').click(),state=>assert(state.slot===slot.slot&&!state.approval,'LOCAL_QUOTE_NOT_SAVED'));
  });
  let firstFingerprint,firstApprovalVersion;
  await show(localPage,localScenes,localStarted,'Approve the exact scope, price and time','Local simulator: consent binds this $155 quote and one owned time slot. The model and the browser cannot approve for the person.',8,async()=>{
   await localPage.locator('#approve-check').check();await localAction('/api/approve',()=>localPage.locator('#approve').click(),state=>{assert(state.stage==='approved'&&!!state.approval?.fingerprint,'LOCAL_APPROVAL_FAILED');firstFingerprint=state.approval.fingerprint;firstApprovalVersion=state.version;});await localPage.locator('#approved-box').scrollIntoViewIfNeeded();
  });
  await show(localPage,localScenes,localStarted,'Changing the quote revokes approval','Local simulator: changing three rooms to four raises the quote to $200. Saving removes the old approval; payment cannot start.',10,async()=>{
   await localPage.locator('#qty-0').fill('4');await localAction('/api/edit',()=>localPage.locator('#save-quote').click(),state=>{assert(state.stage==='review'&&!state.approval&&!state.order&&state.lines.reduce((sum,line)=>sum+line.quantity*line.rate,0)===20000,'EDIT_DID_NOT_REVOKE_APPROVAL');fixtureProof.approvalRevokedByEdit=true;});assert(!(await localPage.locator('#create-order').isVisible())&&await localPage.locator('#approve').isDisabled(),'EDIT_PAYMENT_CONTROL_NOT_BLOCKED');
  });
  await show(localPage,localScenes,localStarted,'Agree again before starting payment','Local simulator: return to the three-room $155 scope, save it, and explicitly approve again. Prior consent is never silently reused.',8,async()=>{
   await localPage.locator('#qty-0').fill('3');await localAction('/api/edit',()=>localPage.locator('#save-quote').click(),state=>assert(!state.approval&&state.stage==='review','FRESH_APPROVAL_NOT_REQUIRED'));await localPage.locator('#approve-check').check();
   await localAction('/api/approve',()=>localPage.locator('#approve').click(),state=>{assert(state.stage==='approved'&&state.approval?.fingerprint===firstFingerprint&&state.version>firstApprovalVersion,'LOCAL_REAPPROVAL_FAILED');fixtureProof.freshApprovalRequired=true;});
   await localAction('/api/order',()=>localPage.locator('#create-order').click(),state=>assert(state.stage==='awaiting'&&state.order?.mode==='demo'&&state.order.id.startsWith('DEMO-'),'LOCAL_SIMULATED_ORDER_FAILED'));await localPage.locator('#checkout').scrollIntoViewIfNeeded();
  });
  await show(localPage,localScenes,localStarted,'Pending payment cannot promise a booking','Local no-money simulator: a temporary slot hold is not a confirmed booking. Pending payment leaves the appointment unconfirmed.',10,async()=>{
   await localAction('/api/capture',()=>localPage.locator('#pending').click(),state=>{assert(state.stage==='awaiting'&&!state.payment,'LOCAL_PENDING_CREATED_BOOKING');fixtureProof.pendingUnconfirmed=true;});assert(!(await localPage.locator('#receipt').isVisible()),'LOCAL_PENDING_RECEIPT_VISIBLE');
  });
  await show(localPage,localScenes,localStarted,'Completion creates one simulated commitment','Local no-money simulator: DEMO_COMPLETED creates the receipt and durable slot. This footage is not a PayPal payment.',10,async()=>{
   await localAction('/api/capture',()=>localPage.locator('#capture').click(),state=>{assert(state.stage==='booked'&&state.payment?.status==='DEMO_COMPLETED'&&state.payment.amount===15500,'LOCAL_DEMO_COMPLETION_FAILED');fixtureProof.demoBookingCompleted=true;});await localPage.locator('#receipt').scrollIntoViewIfNeeded();
  });
  await localRead();assert(localPosts===10&&!providerBlocked,'LOCAL_FIXTURE_ACTION_COUNT_CHANGED');await localContext.close();localContext=null;const localRaw=await localVideo.path();const localDuration=await durationOf(localRaw,cleanEnv);
  assert(localDuration<120,'LOCAL_JOURNEY_EXCEEDS_BUDGET');

  stage('FIELD_EXISTING_SANDBOX_FOOTAGE');const productionStarted=Date.now();productionPage=await productionContext.newPage();const productionVideo=productionPage.video();productionPage.setDefaultTimeout(15000);productionPage.on('pageerror',()=>{providerBlocked=true;});
  const ai={attempted:false,engine:snapshot.state.engine==='openrouter'?'Stored validated OpenRouter extraction':'Stored deterministic quote rules',usedFallback:snapshot.state.engine!=='openrouter'};
  await show(productionPage,productionScenes,productionStarted,'Now the previously verified hosted sandbox booking','Hosted sandbox, separate from the simulator: the recorded $155 scope has its stored drafting engine shown. No new payment runs here.',10,async()=>{await productionPage.goto(cfg.origin+'/app',{waitUntil:'domcontentloaded',timeout:20000});await productionPage.locator('#quote-heading').waitFor();await productionPage.waitForFunction(()=>document.body.getAttribute('aria-busy')!=='true');assert(!(await productionPage.locator('#access-key').count()),'LOGIN_MUST_NOT_BE_RECORDED');await productionPage.locator('#quote-heading').scrollIntoViewIfNeeded();await read();},true);
  await show(productionPage,productionScenes,productionStarted,'An actual $155 PayPal sandbox capture backed this booking','Hosted sandbox: this completed test-funds capture produced one verified booking and receipt. Wallet-return UX is unverified.',16,async()=>{await productionPage.locator('#receipt').scrollIntoViewIfNeeded();await productionPage.locator('#receipt-ref').filter({hasText:expected.capture}).waitFor();await read();});
  await show(productionPage,productionScenes,productionStarted,'The existing signed webhook was independently verified','Retained evidence: the same capture event passed signature verification and preserved one order and booking. No resend occurs in this film.',10,async()=>{await productionPage.locator('#activity').scrollIntoViewIfNeeded();await read();});
  await show(productionPage,productionScenes,productionStarted,'One scope, one price, one payment-backed spot','For independent service businesses: agree on the service, approve the exact quote and time, then confirm the payment state.',6,async()=>{await productionPage.goto(cfg.origin+'/',{waitUntil:'domcontentloaded',timeout:20000});await productionPage.waitForFunction(()=>document.documentElement.dataset.scene==='ready'&&document.documentElement.dataset.sceneVersion==='mesh-v7');});
  const elapsed=localDuration+(Date.now()-productionStarted)/1000;assert(elapsed<164,'FIELD_JOURNEY_EXCEEDS_BUDGET');
  await show(productionPage,productionScenes,productionStarted,'Try the working build; inspect the open-source guards','Synthetic service data, UTC windows and test funds only. Real calendar operations, production payments and refunds remain future work.',Math.max(0,165-elapsed));
  const after=await read();assert(JSON.stringify(after.state)===productionStateBefore&&!providerBlocked&&!hostedGuardFailed(),'HOSTED_BOOKING_CHANGED_DURING_RECORDING');await productionContext.close();const productionRaw=await productionVideo.path();const productionDuration=await durationOf(productionRaw,cleanEnv);
  const scenes=[...localScenes.map(scene=>({...scene,segment:'local-simulator'})),...productionScenes.map(scene=>({...scene,at:scene.at+localDuration,segment:'existing-hosted-sandbox'}))];assert(localDuration+productionDuration<176,'FIELD_VIDEO_EXCEEDS_BUDGET');
  const captionFile=join(output,'fieldnote-captions.json');await writeFile(captionFile,JSON.stringify({project:'fieldnote',scenes,ai,source:'actual local simulator and existing hosted sandbox browser footage',walletReturnUxVerified:false},null,2));
  const filters=['pad=1280:940:0:0:color=0x0b151a'];const font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
  for(let index=0;index<scenes.length;index++){const end=scenes[index+1]?.at||179;filters.push(`drawtext=fontfile=${font}:text='${ffText(scenes[index].title)}':x=34:y=827:fontsize=28:fontcolor=white:enable='between(t,${scenes[index].at.toFixed(2)},${end.toFixed(2)})'`);for(const [line,text]of captionLines(scenes[index].detail).entries())filters.push(`drawtext=fontfile=${font}:text='${ffText(text)}':x=34:y=${line===0?868:896}:fontsize=17:fontcolor=0xc9d7dc:enable='between(t,${scenes[index].at.toFixed(2)},${end.toFixed(2)})'`);}
  const concatFile=join(raw,'fieldnote-concat.txt');await writeFile(concatFile,[localRaw,productionRaw].map(path=>"file '"+path.replace(/\\/g,'/').replace(/'/g,"'\\''")+"'").join('\n'));
  stage('FIELD_VIDEO_ENCODE');const destination=join(output,'fieldnote-demo-preview.mp4');await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',concatFile,'-vf',filters.join(','),'-c:v','libx264','-preset','medium','-crf','19','-pix_fmt','yuv420p','-an','-movflags','+faststart',destination],{env:cleanEnv,maxBuffer:1024*1024});const duration=await durationOf(destination,cleanEnv);assert(duration<180,'VIDEO_MUST_BE_LESS_THAN_THREE_MINUTES');
  stage('FIELD_STORYBOARD');const thumbs=[];for(let index=0;index<scenes.length;index++){const at=Math.min(duration-0.1,scenes[index].at+Math.min(5,Math.max(0.1,((scenes[index+1]?.at||duration)-scenes[index].at)/2)));const thumb=join(output,'fieldnote-storyboard-'+String(index+1).padStart(2,'0')+'.png');await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss',String(at),'-i',destination,'-frames:v','1',thumb],{env:cleanEnv,maxBuffer:1024*1024});thumbs.push({file:basename(thumb),at,title:scenes[index].title,segment:scenes[index].segment});}
  await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',destination,'-vf',`fps=1/${Math.max(1,duration/12)},scale=426:-1,tile=3x4`,'-frames:v','1',join(output,'fieldnote-contact-sheet.png')],{env:cleanEnv,maxBuffer:1024*1024});
  await writeFile(join(output,'fieldnote-manifest.json'),JSON.stringify({project:'fieldnote',origin:cfg.origin,reviewedCommit:sha,deployedSceneSha256:sceneHash,localWorkerSha256:workerHash,durationSeconds:duration,ai,storyboard:thumbs,segments:[{source:'fresh isolated local simulator',start:0,end:localDuration,paymentMode:'demo',providers:'disabled and fetch blocked',guardedPostCount:localPosts},{source:'existing hosted completed sandbox booking',start:localDuration,end:duration,paymentMode:'sandbox',operations:'GET only'}],fixtureProof,webhookProof:{...webhookProof,source:'independently verified retained evidence; no event sent during recording'},expectedCapture:expected.capture,expectedRecord:expected.record,financialMutations:'none; local simulator only; hosted GET only',walletReturnUxVerified:false,previewOnly:true},null,2));
  console.log(JSON.stringify({project:'fieldnote',status:'PREVIEW_RECORDED',durationSeconds:duration,previewOnly:true,localSimulatorOnly:true,hostedGetOnly:true}));
 }finally{
  await localContext?.close().catch(()=>{});
  try{await stopFixtureChild(child);}catch(error){cleanupState.safe=false;throw error;}
 }
}

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
 let browser,context,page,video,aborted=false,pageError=false,deskSession='';const scenes=[];const aiEvidence={attempted:false,engine:null,usedFallback:null};let started=0,posts=0;const cleanupState={safe:true};
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
   if(request.method()!=='POST'||posts>=2){aborted=true;return route.abort();}
   let body;try{body=request.postDataJSON();}catch{aborted=true;return route.abort();}
   try{target=completedRecord(project,await read(),expected);}catch{aborted=true;return route.abort();}
   if(!allowedPost(project,url.pathname,body,target)){aborted=true;return route.abort();}
   posts++;return route.continue();
  });
  if(project==='fieldnote'){
   await recordFieldJourney({browser,productionContext:context,config,snapshot,read,output,raw,cleanEnv,sceneHash,hostedGuardFailed:()=>aborted,cleanupState});context=null;await browser.close();browser=null;return;
  }
  stage('PAGE_SETUP');page=await context.newPage();video=page.video();started=Date.now();page.on('pageerror',()=>{pageError=true;});page.setDefaultTimeout(15000);
  async function scene(title,detail,seconds=15){
   await page.waitForFunction(()=>document.body.getAttribute('aria-busy')!=='true');
   if(expiry-Math.floor(Date.now()/1000)<seconds+30)STOP('COOKIE_EXPIRES_DURING_RECORDING');
   const body=await page.locator('body').innerText();if(body.includes(owner)||(field&&body.includes(field))||(deskSession&&body.includes(deskSession)))STOP('SESSION_VALUE_VISIBLE');
   captionLines(detail);
   scenes.push({at:(Date.now()-started)/1000,title,detail});await page.waitForTimeout(seconds*1000);
  }
  async function selectorCounts(label,selectors){const counts={};for(const [name,selector]of Object.entries(selectors))counts[name]=await page.locator(selector).count();console.log(JSON.stringify({stage:label,selectors:counts,busy:await page.locator('body').getAttribute('aria-busy')==='true',pageError}));}
  stage('PUBLIC_SCENE');await page.goto(cfg.origin+'/',{waitUntil:'domcontentloaded',timeout:20000});await page.waitForFunction(version=>document.documentElement.dataset.scene==='ready'&&document.documentElement.dataset.sceneVersion===version,project==='supplypilot'?'mesh-v7p2':'mesh-v7');await scene(cfg.title+' · '+cfg.audience,'Synthetic data · previously verified sandbox outcome · no new payment during this recording',12);
  if(project==='fieldnote'){stage('PRIVATE_SCENE');await page.goto(cfg.origin+'/app',{waitUntil:'networkidle',timeout:20000});}
  else{stage('PRIVATE_NAVIGATE');await page.goto(cfg.origin+'/app',{waitUntil:'domcontentloaded',timeout:20000});stage('PRIVATE_READY');await selectorCounts('PRIVATE_READY',{login:'#access-key',boot:'.boot',app:'#app',merchant_mode:'#payment-mode',connections:'[data-view="connections"]'});await page.waitForFunction(()=>document.body.getAttribute('aria-busy')!=='true');if(project==='merchant')await page.locator('#payment-mode').waitFor({state:'visible'});else await page.getByRole('button',{name:'Connections',exact:true}).waitFor({state:'visible'});}
  if(await page.locator('#access-key').count())STOP('LOGIN_MUST_NOT_BE_RECORDED');
  if(project==='merchant'){
   stage('MERCHANT_SANDBOX_SELECT');await selectorCounts('MERCHANT_SANDBOX_SELECT',{mode:'#payment-mode',recheck:'[data-action="analyze"]',receipt:'.proposal.success .resultbox strong',replay:'[data-action="replay"]'});
   await page.locator('#payment-mode').selectOption('sandbox');await page.locator('.proposal.success .resultbox strong').filter({hasText:expected.record}).waitFor();await read();
   await scene('An incomplete $198 order','The fulfillment fixture supports a $34 missing-pouch refund. Human approval and server policy retain authority.',24);
   stage('MERCHANT_RECHECK');await selectorCounts('MERCHANT_RECHECK',{recheck:'[data-action="analyze"]',receipt:'.proposal.success .resultbox strong'});
   const ai=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/desk'&&r.request().method()==='POST'&&r.request().postDataJSON()?.action==='analyze');
   await page.waitForFunction(()=>document.body.getAttribute('aria-busy')!=='true');await page.locator('[data-action="analyze"]').click();const result=await(await ai).json();if(result.proposal?.amountCents!==3400||!result.explanation?.engine)STOP('EXPLANATION_OR_POLICY_NOT_VERIFIED');
   aiEvidence.attempted=true;aiEvidence.engine=result.explanation.engine;aiEvidence.usedFallback=!result.explanation.engine.includes('OpenRouter');
   await scene(aiEvidence.usedFallback?'A safe local fallback; policy decides':'Actual AI explains; policy decides',aiEvidence.usedFallback?'The live attempt used deterministic fallback. The displayed engine is accurate; model availability cannot change the $34 policy amount.':'This is the live synthetic model response. The model cannot change the amount or authorize a refund.',28);
   stage('MERCHANT_RECEIPT');await page.locator('.proposal.success .resultbox strong').filter({hasText:expected.record}).waitFor();
   await scene('PayPal sandbox refund complete','The recorded $34 refund is shown with its actual receipt. Test funds only; wallet return UX is unverified.',30);
   stage('MERCHANT_REPLAY');await selectorCounts('MERCHANT_REPLAY',{replay:'[data-action="replay"]',audit:'.auditpanel'});await page.locator('[data-action="replay"]').click();await page.getByText('Duplicate suppressed. The original refund was reused.',{exact:true}).waitFor();await read();
   await page.locator('.auditpanel').scrollIntoViewIfNeeded();await scene('Replay reuses one operation','The existing completed operation, refund and request ID remain unchanged. No new refund is issued.',30);
  }else if(project==='supplypilot'){
   await scene('A policy-checked purchase','Eight mailer packs. The approved all-in quote is $201.66 USD; budget, stock and seller checks run on the server.',28);
   stage('SUPPLY_CONNECTIONS_OPEN');await selectorCounts('SUPPLY_CONNECTIONS_OPEN',{connections:'[data-view="connections"]',orders:'[data-view="orders"]',audit:'[data-view="audit"]'});await page.getByRole('button',{name:'Connections',exact:true}).click();
   stage('SUPPLY_AI_EXPLAIN');await selectorCounts('SUPPLY_AI_EXPLAIN',{explain:'#explain',connections:'[data-view="connections"]'});
   if(await page.locator('#explain').count()){
    const ai=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/workspace'&&r.request().method()==='POST'&&r.request().postDataJSON()?.action==='explain');await page.waitForFunction(()=>document.body.getAttribute('aria-busy')!=='true');await page.locator('#explain').click();const result=await(await ai).json();if(!result.aiSource||!result.explanation)STOP('EXPLANATION_NOT_VERIFIED');aiEvidence.attempted=true;aiEvidence.engine=result.aiSource;aiEvidence.usedFallback=!result.aiSource.includes('OpenRouter');
   }else{aiEvidence.engine='Deterministic rules (provider not configured)';aiEvidence.usedFallback=true;}
   await scene(aiEvidence.usedFallback?'Guarded rules remain available':'Actual AI explains fixture options',aiEvidence.usedFallback?'The displayed engine used local deterministic rules. AI availability cannot change the approved price or bypass policy.':'The live explanation is bounded by supplied facts. Exact-quote approval and checkout remain deterministic.',28);
   stage('SUPPLY_ORDERS_OPEN');await selectorCounts('SUPPLY_ORDERS_OPEN',{orders:'[data-view="orders"]',receipt_rows:'.table-wrap td strong'});await page.getByRole('button',{name:'Order history',exact:true}).click();await page.locator('.table-wrap td strong').filter({hasText:expected.record}).waitFor();
   await scene('One actual sandbox capture','The real $201.66 test-funds capture produced this single receipt. No real supplies ship.',30);
   stage('SUPPLY_AUDIT_OPEN');await selectorCounts('SUPPLY_AUDIT_OPEN',{audit:'[data-view="audit"]',receipt_rows:'.table-wrap td strong'});await page.getByRole('button',{name:'Audit trail',exact:true}).click();await scene('An inspectable decision trail','Prior receipts and audit history are preserved. Duplicate protection was verified separately; no new checkout runs here.',30);
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
 }finally{await context?.close().catch(()=>{});await browser?.close().catch(()=>{});if(dirname(raw)!==resolve(process.cwd())||basename(raw)!=='recording-private')STOP('SCRATCH_CLEANUP_SCOPE_INVALID');if(cleanupState.safe)await rm(raw,{recursive:true,force:true});}
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
 const privateSentinel='PRIVATE_CONFIG_SENTINEL';const fixtureEnv=fixtureEnvironment({PATH:'/trusted/bin',OPENROUTER_API_KEY:privateSentinel,PAYPAL_CLIENT_SECRET:privateSentinel,DEMO_OWNER_COOKIE:privateSentinel,DEMO_FIELD_SESSION:privateSentinel,GITHUB_TOKEN:privateSentinel,CLOUDFLARE_API_TOKEN:privateSentinel},'a'.repeat(64));
 assert.equal(fixtureEnv.AI_MODE,'demo');assert.equal(fixtureEnv.PAYPAL_MODE,'demo');assert.equal(fixtureEnv.AI_ALLOW_PAID_FALLBACK,'false');assert.ok(!JSON.stringify(fixtureEnv).includes(privateSentinel));assert.equal(fixtureEnv.PAYPAL_CLIENT_SECRET,'');assert.equal(fixtureEnv.OPENROUTER_API_KEY,'');assert.equal(fixtureEnv.DEMO_OWNER_COOKIE,undefined);assert.equal(fixtureEnv.GITHUB_TOKEN,undefined);
 const localOrigin='http://127.0.0.1:43210',slot='2026-10-06T09:00:00.000Z',local={mode:'demo',aiConfigured:false,currency:'USD',state:{version:1,stage:'review',engine:'rules',questions:[],lines:[{description:'Carpet cleaning',quantity:3,rate:4500},{description:'Pet treatment',quantity:1,rate:2000}],slot,approval:null,order:null,payment:null},availability:[{slot,status:'available'}]};
 assert.equal(allowedFixturePost(localOrigin,localOrigin+'/api/approve','POST',{version:1},local,0),true);
 assert.equal(allowedFixturePost(localOrigin,localOrigin+'/api/approve','POST',{version:0},local,0),false);
 assert.equal(allowedFixturePost(localOrigin,'https://fieldnote.inkwell.finance/api/approve','POST',{version:1},local,0),false);
 assert.equal(allowedFixturePost(localOrigin,localOrigin+'/api/approve','GET',{version:1},local,0),false);
 assert.equal(allowedFixturePost(localOrigin,localOrigin+'/api/approve','POST',{version:1},local,12),false);
 assert.equal(allowedFixturePost(localOrigin,localOrigin+'/api/paypal/webhook','POST',{version:1},local,0),false);
 assert.equal(allowedFixturePost(localOrigin,localOrigin+'/owner/login','POST',{version:1,access_key:'fixture'},local,0),false);
 assert.equal(allowedFixturePost(localOrigin,localOrigin+'/api/approve','POST',{version:1},{...local,mode:'sandbox'},0),false);
 assert.equal(allowedFixturePost(localOrigin,localOrigin+'/api/approve','POST',{version:1},{...local,aiConfigured:true},0),false);
 assert.equal(allowedFixturePost(localOrigin,localOrigin+'/api/order','POST',{version:1},local,0),false);
 assert.equal(allowedFixturePost(localOrigin,localOrigin+'/api/edit','POST',{version:1,lines:local.state.lines.map((line,index)=>index?line:{...line,quantity:4}),slot},local,0),true);
 assert.equal(allowedFixturePost(localOrigin,localOrigin+'/api/edit','POST',{version:1,lines:local.state.lines.map((line,index)=>index?line:{...line,rate:999}),slot},local,0),false);
 assert.equal(allowedFixturePost(localOrigin,localOrigin+'/api/draft','POST',{version:1,request:'Maybe clean the carpet or the windows. I am not sure how much needs doing.',details:{}},local,0),true);
 assert.equal(allowedFixturePost(localOrigin,localOrigin+'/api/draft','POST',{version:1,request:'Private customer input',details:{}},local,0),false);
 const awaiting={...local,state:{...local.state,stage:'awaiting',approval:{fingerprint:'local'},order:{id:'DEMO-12345678-1234-1234-1234-123456789012',mode:'demo'}}};
 assert.equal(allowedFixturePost(localOrigin,localOrigin+'/api/capture','POST',{version:1,outcome:'pending'},awaiting,0),true);
 assert.equal(allowedFixturePost(localOrigin,localOrigin+'/api/capture','POST',{version:1,outcome:'completed'},awaiting,0),true);
 assert.equal(allowedFixturePost(localOrigin,localOrigin+'/api/capture','POST',{version:1,outcome:'completed',paymentMode:'sandbox'},awaiting,0),false);
 assert.equal(allowedFixturePost(localOrigin,localOrigin+'/api/capture','POST',{version:1,outcome:'completed'},{...awaiting,state:{...awaiting.state,order:{id:'REMOTE-ORDER',mode:'sandbox'}}},0),false);
 const proof={date:'2026-10-06T00:06:38.160Z',eventId:'WH-FIXTURE',orderId:'ORDER1',captureId:'CAPTURE1',currency:'USD',amountCents:15500,verifiedWebhookRecorded:true,orders:1,bookedSlots:1};
 assert.deepEqual(verifiedWebhookProof(JSON.stringify(proof),{order:'ORDER1',capture:'CAPTURE1'}),proof);assert.throws(()=>verifiedWebhookProof(JSON.stringify({...proof,verifiedWebhookRecorded:false}),{order:'ORDER1',capture:'CAPTURE1'}));assert.throws(()=>verifiedWebhookProof(JSON.stringify({...proof,captureId:'OTHER'}),{order:'ORDER1',capture:'CAPTURE1'}));assert.throws(()=>verifiedWebhookProof(JSON.stringify({...proof,ownerCookie:privateSentinel}),{order:'ORDER1',capture:'CAPTURE1'}));assert.throws(()=>verifiedWebhookProof('not-json',{}));
 const wrapped=captionLines('This is a deliberately long but readable description of the recorded sandbox workflow and its exact completed receipt; its second sentence should wrap to the following caption line without clipping.');assert.equal(wrapped.length,2);assert.ok(wrapped.every(line=>line.length<=115));
 const recorderSource=await readFile(new URL(import.meta.url),'utf8');let fieldCaptions=0;for(const match of recorderSource.matchAll(/await show\([^,\n]+,[^,\n]+,[^,\n]+,'([^']*)','([^']*)'/g)){captionLines(match[2]);fieldCaptions++;}assert.equal(fieldCaptions,13);
 const checkout=checkoutCommand('/reviewed/checkout');assert.deepEqual(checkout,['-c','safe.directory='+resolve('/reviewed/checkout'),'rev-parse','HEAD']);assert.ok(!checkout.some(value=>value==='--global'||value.includes('*')));
 const hidden='PRIVATE_AUTH_SENTINEL';assert.deepEqual(safeDiagnostic({code:128,message:hidden,stderr:hidden}),{stage:'BOOT',code:'SUBPROCESS_EXIT_128'});assert.deepEqual(safeDiagnostic({code:'MODULE_NOT_FOUND',message:hidden}),{stage:'BOOT',code:'MODULE_NOT_FOUND'});assert.ok(!JSON.stringify(safeDiagnostic({message:hidden,command:hidden,headers:{cookie:hidden}})).includes(hidden));
 console.log('Recording guard self-test passed. No browser, cookies, GitHub secrets or network were used.');
}
if(typeof process!=='undefined'&&process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{if(process.argv.includes('--self-test'))await selfTest();else if(process.argv.includes('--execute'))await record();else console.log('Prepared only. --self-test checks guards; --execute requires reviewed commit, short project owner cookie and exact completed-record IDs. No GitHub secret is created or deleted by this script.');}catch(error){console.error(JSON.stringify({status:'RECORDING_STOPPED',...safeDiagnostic(error)}));process.exitCode=1;}}
