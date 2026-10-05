import test from 'node:test';
import assert from 'node:assert/strict';
import {sqliteBinding} from '../scripts/sqlite-adapter.mjs';
import {applicationWorker as worker} from '../dist/server/index.js';
function app(extra={}){const env={DB:sqliteBinding(),...extra};let cookie='',state;async function call(path,body){const response=await worker.fetch(new Request('http://local/api/'+path,{method:body?'POST':'GET',headers:{origin:'http://local',cookie,'content-type':'application/json'},...(body?{body:JSON.stringify({version:state?.version,...body})}:{})}),env);const set=response.headers.get('set-cookie');if(set)cookie=set.split(';')[0];const result=await response.json();if(result.state)state=result.state;return {response,result};}return {env,call,get state(){return state;}};}
async function prepare(a){await a.call('state');const draft=await a.call('draft',{request:'Clean 3 rooms of carpet with pet treatment'});const slot=draft.result.availability.find(a=>a.status==='available').slot;await a.call('edit',{lines:a.state.lines,slot});return slot;}
test('same-session simultaneous approvals preserve the successful reservation',async()=>{
 const a=app();const slot=await prepare(a),version=a.state.version;
 const results=await Promise.all([a.call('approve',{version}),a.call('approve',{version})]);assert.equal(results.filter(r=>r.response.status===200).length,1);
 const row=a.env.DB.raw.prepare('SELECT * FROM slots WHERE slot=?').get(slot);assert.equal(row.state,'held');assert.equal(a.env.DB.raw.prepare('SELECT COUNT(*) n FROM slots').get().n,1);
 await a.call('state');assert.equal(a.state.stage,'approved');const next=await a.call('order',{});assert.equal(next.response.status,200);
});
test('uncertain sandbox creates beyond the safe retry window make no new provider call',async()=>{
 const original=globalThis.fetch,originalNow=Date.now;const a=app({PAYPAL_MODE:'sandbox',PAYPAL_CLIENT_ID:'fixture',PAYPAL_CLIENT_SECRET:'fixture'});let calls=0;
 globalThis.fetch=async(url)=>{if(String(url).includes('oauth2/token'))return Response.json({access_token:'fixture'});calls++;throw Error('Lost provider response');};
 try{await prepare(a);await a.call('approve',{});assert.equal((await a.call('order',{})).response.status,400);assert.equal(calls,1);await a.call('state');const started=a.state.attemptStartedAt;Date.now=()=>started+7*60*60*1000;const retry=await a.call('order',{});assert.equal(retry.response.status,400);assert.match(retry.result.error,/too old to retry safely/);assert.equal(calls,1);}finally{globalThis.fetch=original;Date.now=originalNow;}
});
for(const action of ['reset','cancel'])test('stale '+action+' cannot release a hold after sandbox capture starts',async()=>{
 const original=globalThis.fetch;const a=app({PAYPAL_MODE:'sandbox',PAYPAL_CLIENT_ID:'fixture',PAYPAL_CLIENT_SECRET:'fixture'});
 let unblockCleanup,cleanupReached,unblockCapture,captureReached;
 const cleanupGate=new Promise(r=>unblockCleanup=r),cleanupReady=new Promise(r=>cleanupReached=r),captureGate=new Promise(r=>unblockCapture=r),captureReady=new Promise(r=>captureReached=r);
 let paused=false,armed=false;const originalBatch=a.env.DB.batch.bind(a.env.DB),originalPrepare=a.env.DB.prepare.bind(a.env.DB);
 a.env.DB.batch=async statements=>{if(armed&&!paused&&statements.some(s=>s._sql.startsWith('DELETE FROM slots'))){paused=true;cleanupReached();await cleanupGate;}return originalBatch(statements)};
 a.env.DB.prepare=sql=>{const statement=originalPrepare(sql);const run=statement.run.bind(statement);statement.run=async()=>{if(armed&&!paused&&sql.startsWith('DELETE FROM slots')){paused=true;cleanupReached();await cleanupGate;}return run()};return statement};
 globalThis.fetch=async(url,opt)=>{const path=String(url);if(path.includes('oauth2/token'))return Response.json({access_token:'fixture'});if(path.endsWith('/v2/checkout/orders'))return Response.json({id:'SB-CLEANUP-'+action,links:[{rel:'payer-action',href:'https://www.sandbox.paypal.com/checkoutnow?token=fixture'}]});if(path.endsWith('/capture')){captureReached();await captureGate;const id=a.env.DB.raw.prepare('SELECT id FROM sessions').get().id;return Response.json({id:'SB-CLEANUP-'+action,status:'COMPLETED',purchase_units:[{custom_id:id,payments:{captures:[{id:'SB-CAP-'+action,status:'COMPLETED',amount:{currency_code:'USD',value:'155.00'}}]}}]});}throw Error('Unexpected mocked provider call')};
 try{
  const slot=await prepare(a);await a.call('approve',{});await a.call('order',{});const version=a.state.version;armed=true;
  const cleanup=a.call(action,{version});await cleanupReady;const capture=a.call('capture',{version});await captureReady;
  unblockCleanup();const stale=await cleanup;assert.equal(stale.response.status,400);assert.equal(a.env.DB.raw.prepare('SELECT state FROM slots WHERE slot=?').get(slot)?.state,'held');
  unblockCapture();const paid=await capture;assert.equal(paid.response.status,200,JSON.stringify(paid.result));assert.equal(paid.result.state.stage,'booked');assert.equal(a.env.DB.raw.prepare('SELECT state FROM slots WHERE slot=?').get(slot).state,'booked');
 }finally{unblockCleanup();unblockCapture();globalThis.fetch=original;a.env.DB.raw.close();}
});
test('capture claim rejects a hold reassigned after the earlier availability check before contacting PayPal',async()=>{
 const original=globalThis.fetch;const a=app({PAYPAL_MODE:'sandbox',PAYPAL_CLIENT_ID:'fixture',PAYPAL_CLIENT_SECRET:'fixture'});let captures=0;
 globalThis.fetch=async(url)=>{if(String(url).includes('oauth2/token'))return Response.json({access_token:'fixture'});if(String(url).endsWith('/v2/checkout/orders'))return Response.json({id:'SB-EXPIRED',links:[{rel:'payer-action',href:'https://www.sandbox.paypal.com/checkoutnow?token=fixture'}]});captures++;throw Error('Capture must never be contacted')};
 try{
  const slot=await prepare(a);await a.call('approve',{});await a.call('order',{});const originalBatch=a.env.DB.batch.bind(a.env.DB);let injected=false;
  a.env.DB.batch=async statements=>{if(!injected&&statements.some(s=>s._sql.startsWith('UPDATE sessions')&&s._args[0].includes('"stage":"capturing"'))){injected=true;a.env.DB.raw.prepare("UPDATE slots SET session='other-session',expires=? WHERE slot=?").run(Date.now()+900000,slot);}return originalBatch(statements)};
  const result=await a.call('capture',{});assert.equal(result.response.status,400);assert.match(result.result.error,/hold expired|request changed/);assert.equal(captures,0);assert.equal(a.env.DB.raw.prepare('SELECT session FROM slots WHERE slot=?').get(slot).session,'other-session');await a.call('state');assert.equal(a.state.stage,'awaiting');
 }finally{globalThis.fetch=original;a.env.DB.raw.close();}
});
