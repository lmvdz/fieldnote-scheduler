import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker from '../dist/server/index.js';
const secret='test-owner-key-0000000000000000000000000000';
const app=JSON.parse(readFileSync('site/project.json','utf8'));
const api=app.id==='merchant-exception-desk'?'/api/desk':app.id==='supplypilot-procurement'?'/api/workspace':'/api/state';
function environment(extra={}){
 const raw=new DatabaseSync(':memory:');for(const name of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort())raw.exec(readFileSync('drizzle/'+name,'utf8'));
 const DB={prepare(sql){return {bind(...args){return {async run(){const r=raw.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}}},async first(){return raw.prepare(sql).get(...args)||null},async all(){return {results:raw.prepare(sql).all(...args)}}}}}},async batch(statements){raw.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());raw.exec('COMMIT');return out}catch(e){raw.exec('ROLLBACK');throw e}}};
 return {DB,SITE_OWNER_KEY:secret,...extra};
}
const request=(path,options={})=>new Request('https://demo.example'+path,options);
async function login(env,key=secret,next='/app',origin='https://demo.example'){
 return worker.fetch(request('/owner/login',{method:'POST',headers:{origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({access_key:key,next})}),env);
}
test('public landing, interactive assets and binary artwork work without owner/provider configuration',async()=>{
 const landing=await worker.fetch(request('/'),{});assert.equal(landing.status,200);const html=await landing.text();assert.match(html,/Explore the flow/);assert.match(html,/data-step="2"/);assert.ok(!html.includes(secret));assert.equal(landing.headers.get('set-cookie'),null);
 for(const path of ['/site/site.css','/site/site.js','/site/favicon.svg','/site/hero.webp']){const result=await worker.fetch(request(path),{});assert.equal(result.status,200,path);assert.ok(result.headers.get('etag'));const cached=await worker.fetch(request(path,{headers:{'if-none-match':result.headers.get('etag')}}),{});assert.equal(cached.status,304);}
 const artwork=await worker.fetch(request('/site/hero.webp'),{});const bytes=new Uint8Array(await artwork.arrayBuffer());assert.equal(new TextDecoder().decode(bytes.slice(0,4)),'RIFF');assert.equal(new TextDecoder().decode(bytes.slice(8,12)),'WEBP');
});
test('unconfigured and anonymous application access fails closed before storage or payment calls',async()=>{
 for(const env of [{},{SITE_OWNER_KEY:secret}]){let calls=0;const previous=globalThis.fetch;globalThis.fetch=()=>{calls++;throw Error('Provider must not run')};try{assert.equal((await worker.fetch(request(api),env)).status,401);assert.equal((await worker.fetch(request(api,{method:'POST',headers:{origin:'https://demo.example','content-type':'application/json'},body:'{}'}),env)).status,401);assert.equal(calls,0)}finally{globalThis.fetch=previous}}
 assert.equal((await worker.fetch(request('/app'),{})).status,503);
});
test('sign-in checks origin, content type, key and rejects external redirect targets',async()=>{
 const env=environment();assert.equal((await login(env,secret,'/app','https://attacker.example')).status,403);assert.equal((await login(env,'wrong')).status,401);
 const success=await login(env,secret,'https://attacker.example/');assert.equal(success.status,303);assert.equal(success.headers.get('location'),'/app');assert.ok(![...success.headers].flat().join(' ').includes(secret));
});
test('signed host-only owner session opens the correct app and API; tampering fails',async()=>{
 const env=environment();const response=await login(env);const cookie=response.headers.get('set-cookie');assert.match(cookie,/^__Host-inkwell_owner=/);assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Lax/);assert.ok(!cookie.includes('Domain='));
 const pair=cookie.split(';')[0];const appResult=await worker.fetch(request('/app',{headers:{cookie:pair}}),env);assert.equal(appResult.status,200);assert.equal(appResult.headers.get('cache-control'),'no-store');assert.equal(appResult.headers.get('x-robots-tag'),'noindex');assert.ok(!(await appResult.text()).includes('Explore the flow'));
 assert.equal((await worker.fetch(request(api,{headers:{cookie:pair}}),env)).status,200);
 const forged=pair.slice(0,-1)+(pair.endsWith('a')?'b':'a');assert.equal((await worker.fetch(request(api,{headers:{cookie:forged}}),env)).status,401);
 const foreign=environment({SITE_OWNER_KEY:'another-key-0000000000000000000000000000'});assert.equal((await worker.fetch(request(api,{headers:{cookie:pair}}),foreign)).status,401);
});
test('owner API writes reject absent or foreign origins and logout clears the host cookie',async()=>{
 const env=environment();const l=await login(env),cookie=l.headers.get('set-cookie').split(';')[0];
 for(const origin of [undefined,'https://attacker.example']){const headers={cookie,'content-type':'application/json'};if(origin)headers.origin=origin;assert.equal((await worker.fetch(request(api,{method:'POST',headers,body:'{}'}),env)).status,403);}
 assert.equal((await worker.fetch(request('/owner/logout'),env)).status,405);
 const result=await worker.fetch(request('/owner/logout',{method:'POST',headers:{origin:'https://demo.example',cookie}}),env);assert.equal(result.status,303);assert.match(result.headers.get('set-cookie'),/Max-Age=0/);
});
test('durable login limits stop brute-force attempts without storing a raw network address',async()=>{
 const env=environment();for(let i=0;i<10;i++)assert.equal((await login(env,'wrong')).status,401);assert.equal((await login(env)).status,429);
});
test('routing handles missing pages, return URLs, and robots without claiming a payment',async()=>{
 assert.equal((await worker.fetch(request('/missing'),{})).status,404);
 const result=await worker.fetch(request('/?paypal=return'),{});assert.equal(result.status,302);assert.equal(result.headers.get('location'),'/app?paypal=return');
 assert.match(await (await worker.fetch(request('/robots.txt'),{})).text(),/Disallow: \/api\//);
});
test('public login rejects an oversized stream before buffering it completely',async()=>{
 let cancelled=false;
 const stream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(1025));},cancel(){cancelled=true;}});
 const result=await worker.fetch(request('/owner/login',{method:'POST',headers:{origin:'https://demo.example','content-type':'application/x-www-form-urlencoded'},body:stream,duplex:'half'}),environment());assert.equal(result.status,413);assert.equal(cancelled,true);
});
