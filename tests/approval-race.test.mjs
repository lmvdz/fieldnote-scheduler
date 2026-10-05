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
