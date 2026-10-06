import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sqliteBinding} from '../scripts/sqlite-adapter.mjs';
import {AI_SYNTHETIC_REQUESTS} from '../src/ai.mjs';

const source = readFileSync('dist/server/index.js', 'utf8');
const worker = (await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))).applicationWorker;

test('scheduler API reports actual drafting engine and preserves human approval and payment locks', async () => {
  const env = {DB: sqliteBinding(), AI_MODE: 'openrouter', OPENROUTER_API_KEY: 'mock-key', AI_PRIMARY_MODEL: 'fixture/primary'};
  const original = globalThis.fetch;
  let calls = 0, cookie = '', state;
  globalThis.fetch = async () => { calls++; return Response.json({choices: [{finish_reason: 'stop', message: {
    role: 'assistant', content: JSON.stringify({service: 'carpet', quantity: 3, pet: true, clarified: false})
  }}]}); };
  const call = async (path, body) => {
    const response = await worker.fetch(new Request('http://fixture.test/api/' + path, {
      method: body ? 'POST' : 'GET', headers: {origin: 'http://fixture.test', cookie, 'Content-Type': 'application/json'},
      ...(body ? {body: JSON.stringify({version: state?.version, ...body})} : {})
    }), env);
    if (response.headers.has('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    const data = await response.json();
    if (data.state) state = data.state;
    return {status: response.status, data};
  };
  try {
    await call('state');
    const drafted = await call('draft', {request: AI_SYNTHETIC_REQUESTS[0]});
    assert.equal(drafted.status, 200);
    assert.equal(calls, 1);
    assert.equal(drafted.data.ai, 'OpenRouter extraction');
    assert.equal(state.approval, null);
    assert.equal(state.payment, null);
    assert.equal(state.lines[0].rate, 4500);
    assert.ok(!JSON.stringify(drafted.data).includes('mock-key'));
    assert.equal((await call('order', {})).status, 400);
    const local = await call('draft', {request: 'Private request: clean 4 rooms of carpet'});
    assert.equal(calls, 1);
    assert.equal(local.data.ai, 'Rules-based fallback');
    assert.equal(state.engine, 'rules');
    assert.equal(state.aiModel, null);
    assert.equal(state.aiPaidFallback, false);
    const redrafted = await call('draft', {request: AI_SYNTHETIC_REQUESTS[0]});
    assert.equal(redrafted.data.ai, 'OpenRouter extraction');
    assert.equal(state.aiWarning, null);
    assert.equal(env.DB.raw.prepare('SELECT COUNT(*) c FROM slots').get().c, 0);
    assert.equal(env.DB.raw.prepare('SELECT COUNT(*) c FROM orders').get().c, 0);
  } finally { globalThis.fetch = original; env.DB.raw.close(); }
});

test('scheduler API leaves an AI category conflict unresolved until explicit local human details', async () => {
  const env = {DB:sqliteBinding(),AI_MODE:'openrouter',OPENROUTER_API_KEY:'mock-key',AI_PRIMARY_MODEL:'fixture/primary'};
  const original = globalThis.fetch;
  globalThis.fetch = async (_, options) => {
    assert.deepEqual(JSON.parse(JSON.parse(options.body).messages[1].content),
      {syntheticDemo:true,request:AI_SYNTHETIC_REQUESTS[1]});
    return Response.json({choices:[{finish_reason:'stop',message:{role:'assistant',
      content:JSON.stringify({service:'cleaning',quantity:null,pet:false,clarified:false})}}]});
  };
  let cookie='',state;
  const call=async(path,body)=>{
    const response=await worker.fetch(new Request('http://fixture.test/api/'+path,{
      method:body?'POST':'GET',headers:{origin:'http://fixture.test',cookie,'Content-Type':'application/json'},
      ...(body?{body:JSON.stringify({version:state?.version,...body})}:{})}),env);
    if(response.headers.has('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
    const data=await response.json();if(data.state)state=data.state;return {status:response.status,data};
  };
  try {
    await call('state');
    assert.equal((await call('draft',{request:AI_SYNTHETIC_REQUESTS[1]})).status,200);
    assert.equal(state.service,null);
    assert.deepEqual(state.lines,[]);
    assert.equal(state.questions.length,3);
    assert.equal((await call('approve',{})).status,400);
    assert.equal(env.DB.raw.prepare('SELECT COUNT(*) c FROM orders').get().c,0);
    assert.equal(env.DB.raw.prepare('SELECT COUNT(*) c FROM slots').get().c,0);
    assert.equal((await call('draft',{request:AI_SYNTHETIC_REQUESTS[1],
      details:{service:'window',quantity:4,pet:false,clarified:true}})).status,200);
    assert.equal(state.service,'window');
    assert.equal(state.quantity,4);
    assert.deepEqual(state.questions,[]);
    assert.deepEqual(state.lines,[{description:'Window cleaning',quantity:4,rate:1200}]);
    assert.equal(state.payment,null);
  } finally {globalThis.fetch=original;env.DB.raw.close();}
});
