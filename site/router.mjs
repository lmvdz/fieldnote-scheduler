// Public pages are read-only. All application and mutation routes require owner access.
const siteHeaders={
 'X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'same-origin',
 'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
 'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self' https://chatgpt.com; form-action 'self'"
};
function siteEscape(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function siteResponse(body,status=200,headers={}){return new Response(body,{status,headers:{...siteHeaders,'Cache-Control':'no-store',...headers}});}
function siteJson(body,status){return siteResponse(JSON.stringify(body),status,{'Content-Type':'application/json; charset=utf-8'});}
function ownerCookieName(url){return url.protocol==='https:'?'__Host-inkwell_owner':'inkwell_owner';}
function ownerKeyReady(env){return typeof env.SITE_OWNER_KEY==='string'&&/^[a-zA-Z0-9_-]{32,128}$/.test(env.SITE_OWNER_KEY);}
async function ownerSigningKey(secret){return crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
const ownerHex=bytes=>Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');
async function ownerSignedToken(env,expiry=Math.floor(Date.now()/1000)+7200){
 const nonce=crypto.randomUUID().replaceAll('-','');
 const message=SITE_PROJECT.id+':'+expiry+':'+nonce;
 const sig=await crypto.subtle.sign('HMAC',await ownerSigningKey(env.SITE_OWNER_KEY),new TextEncoder().encode(message));
 return expiry+'.'+nonce+'.'+ownerHex(sig);
}
async function ownerAuthorized(request,env){
 if(!ownerKeyReady(env))return false;
 const url=new URL(request.url),name=ownerCookieName(url);
 const cookie=request.headers.get('cookie')||'';
 const token=cookie.split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1);
 if(!token||token.length>160)return false;
 const match=/^(\d{10})\.([a-f0-9]{32})\.([a-f0-9]{64})$/.exec(token);if(!match)return false;
 const expiry=Number(match[1]),now=Math.floor(Date.now()/1000);if(expiry<=now||expiry>now+7200)return false;
 const signature=new Uint8Array(match[3].match(/../g).map(n=>parseInt(n,16)));
 return crypto.subtle.verify('HMAC',await ownerSigningKey(env.SITE_OWNER_KEY),signature,new TextEncoder().encode(SITE_PROJECT.id+':'+match[1]+':'+match[2]));
}
function ownerCookie(request,token,maxAge=7200){const url=new URL(request.url);return ownerCookieName(url)+'='+token+'; HttpOnly; Path=/; SameSite=Lax; Max-Age='+maxAge+(url.protocol==='https:'?'; Secure':'');}
function ownerNext(value){try{const url=new URL(value,'https://internal.invalid');return url.origin==='https://internal.invalid'&&url.pathname==='/app'?url.pathname+url.search:'/app';}catch{return '/app';}}
function ownerSignIn(message='',next='/app',status=200){
 return siteResponse(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Workspace access · ${siteEscape(SITE_PROJECT.name)}</title><link rel="stylesheet" href="/site/site.css"><link rel="icon" href="/site/favicon.svg"></head><body><main class="signin"><div class="eyebrow">${siteEscape(SITE_PROJECT.name)} / PRIVATE WORKSPACE</div><h1>Keep the decision<br>in your hands.</h1><p>This working prototype is for the owner and authorized reviewers. The public project overview is available to everyone.</p>${message?`<p class="error" role="alert">${siteEscape(message)}</p>`:''}<form method="post" action="/owner/login"><input type="hidden" name="next" value="${siteEscape(ownerNext(next))}"><label for="access-key">Workspace access key</label><input id="access-key" name="access_key" type="password" autocomplete="current-password" minlength="32" maxlength="128" required><button class="primary" type="submit">Open workspace</button></form><p>Judge access is supplied privately by the entry owner. You can also run the MIT-licensed source locally.</p><a class="signin-back" href="/">Back to project overview</a></main></body></html>`,status,{'Content-Type':'text/html; charset=utf-8'});
}
async function ownerThrottle(request,env,kind='login',limit=10,period=15*60*1000){
 if(!env.DB)throw Error('Owner access storage is unavailable.');
 // Store an HMAC of the network identifier, never the address itself.
 const address=request.headers.get('cf-connecting-ip')||'local';
 const signature=await crypto.subtle.sign('HMAC',await ownerSigningKey(env.SITE_OWNER_KEY),new TextEncoder().encode(SITE_PROJECT.id+':'+kind+':'+address));
 const id=ownerHex(signature),now=Date.now(),windowEnd=now+period;
 await env.DB.prepare('CREATE TABLE IF NOT EXISTS owner_login_limits (id TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires INTEGER NOT NULL)').bind().run();
 await env.DB.prepare('DELETE FROM owner_login_limits WHERE expires<?').bind(now).run();
 await env.DB.prepare('INSERT INTO owner_login_limits(id,attempts,expires) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET attempts=attempts+1').bind(id,windowEnd).run();
 const row=await env.DB.prepare('SELECT attempts FROM owner_login_limits WHERE id=?').bind(id).first();
 return row&&row.attempts<=limit;
}
async function siteReadBody(request,limit){
 const declared=Number(request.headers.get('content-length')||'0');if(declared>limit)return {tooLarge:true};
 if(!request.body)return {text:''};
 const reader=request.body.getReader(),chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();return {tooLarge:true}}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}return {text:new TextDecoder('utf-8',{fatal:true}).decode(bytes)};}finally{reader.releaseLock();}
}
async function ownerLogin(request,env){
 const url=new URL(request.url);
 if(request.headers.get('origin')!==url.origin)return siteJson({error:'Same-origin request required'},403);
 if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))return siteJson({error:'Form required'},415);
 if(!ownerKeyReady(env))return ownerSignIn('Owner access has not been configured. Contact the entry owner.','/app',503);
 const body=await siteReadBody(request,1024);if(body.tooLarge)return siteJson({error:'Request too large'},413);
 const form=new URLSearchParams(body.text),next=ownerNext(form.get('next'));
 if(!await ownerThrottle(request,env))return ownerSignIn('Too many attempts. Try again in 15 minutes.',next,429);
 const candidate=form.get('access_key')||'';
 // Hash both strings and compare fixed-length bytes, without returning either value.
 const expected=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(env.SITE_OWNER_KEY)));
 const supplied=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(candidate)));
 let mismatch=expected.length^supplied.length;for(let i=0;i<expected.length;i++)mismatch|=expected[i]^supplied[i];
 if(mismatch)return ownerSignIn('That access key was not recognized.',next,401);
 const token=await ownerSignedToken(env);
 return siteResponse(null,303,{Location:next,'Set-Cookie':ownerCookie(request,token)});
}
function siteTextPage(title,content,status=200){return siteResponse(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${siteEscape(title)} · ${siteEscape(SITE_PROJECT.name)}</title><link rel="stylesheet" href="/site/site.css"><link rel="icon" href="/site/favicon.svg"></head><body><main class="signin"><div class="eyebrow">${siteEscape(SITE_PROJECT.name)}</div><h1>${siteEscape(title)}</h1>${content}<a class="signin-back" href="/">Back to project overview</a></main></body></html>`,status,{'Content-Type':'text/html; charset=utf-8'});}
function siteAssetResponse(request,path){const asset=SITE_ASSETS[path];if(!asset)return null;const etag='"'+asset.hash+'"';if(request.headers.get('if-none-match')===etag)return siteResponse(null,304,{ETag:etag,'Cache-Control':'public, max-age=0, must-revalidate'});const body=asset.binary?Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0)):asset.body;return siteResponse(request.method==='HEAD'?null:body,200,{'Content-Type':asset.type,ETag:etag,'Cache-Control':'public, max-age=0, must-revalidate'});}
export {applicationWorker};
export default {async fetch(request,env,ctx){
 const url=new URL(request.url),path=url.pathname;
 try{
  if(path==='/'&&url.searchParams.has('paypal'))return siteResponse(null,302,{Location:'/app'+url.search});
  if((request.method==='GET'||request.method==='HEAD')&&SITE_ASSETS[path])return siteAssetResponse(request,path);
  if(path==='/privacy'&&request.method==='GET')return siteTextPage('Demo privacy','<p>The public overview has no analytics, advertising, or third-party embeds. It uses no application cookies.</p><p>The private workspace uses essential, host-only cookies for owner access and demo session state. Synthetic workflow records persist in this project’s server database. Login protection stores a keyed hash of the network identifier for up to 15 minutes.</p><p>Optional AI requests contain allowlisted fictional fixtures. Optional PayPal requests use sandbox test credentials and test funds. Provider credentials stay on the server.</p><p>Do not enter real customer data. This prototype is a demonstration, and its workspace reset preserves prior audit and completed records. Ask the entry owner to remove server-side demonstration records when needed.</p>');
  if(path==='/robots.txt'&&request.method==='GET')return siteResponse('User-agent: *\nAllow: /\nDisallow: /app\nDisallow: /api/\nDisallow: /owner/\nSitemap: https://'+SITE_PROJECT.slug+'.inkwell.finance/sitemap.xml\n',200,{'Content-Type':'text/plain; charset=utf-8'});
  if(path==='/sitemap.xml'&&request.method==='GET')return siteResponse('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://'+SITE_PROJECT.slug+'.inkwell.finance/</loc></url></urlset>',200,{'Content-Type':'application/xml; charset=utf-8'});
  if(path==='/owner/login'){
   if(request.method==='GET')return ownerSignIn('',ownerNext(url.searchParams.get('next')));
   if(request.method==='POST')return await ownerLogin(request,env);
   return siteJson({error:'Method not allowed'},405);
  }
  if(path==='/owner/logout'){
   if(request.method!=='POST')return siteJson({error:'Method not allowed'},405);
   if(request.headers.get('origin')!==url.origin)return siteJson({error:'Same-origin request required'},403);
   return siteResponse(null,303,{Location:'/','Set-Cookie':ownerCookie(request,'',0)});
  }
  // PayPal must reach its signature-verifying webhook independently of the owner cookie.
  if(path==='/api/paypal/webhook'&&SITE_PROJECT.id==='fieldnote-scheduler'){
   if(request.method!=='POST')return siteJson({error:'Method not allowed'},405);
   if(!request.headers.get('content-type')?.startsWith('application/json'))return siteJson({error:'JSON required'},415);
   const body=await siteReadBody(request,64000);if(body.tooLarge)return siteJson({error:'Webhook too large'},413);
   try{validateWebhookEnvelope(request.headers,JSON.parse(body.text));}catch{return siteJson({error:'Invalid PayPal webhook envelope'},401);}
   if(!ownerKeyReady(env)||!await ownerThrottle(request,env,'webhook',60,60000))return siteJson({error:'Webhook temporarily limited'},429);
   return applicationWorker.fetch(new Request(request.url,{method:'POST',headers:request.headers,body:body.text}),env,ctx);
  }
  if(path==='/app'||path.startsWith('/api/')){
   if(!await ownerAuthorized(request,env))return path.startsWith('/api/')?siteJson({error:'Owner access required'},401):ownerSignIn(ownerKeyReady(env)?'':'Owner access is not configured yet.','/app'+url.search,ownerKeyReady(env)?200:503);
   if(path==='/app'){if(!['GET','HEAD'].includes(request.method))return siteJson({error:'Method not allowed'},405);const target=new URL(request.url);target.pathname='/';const result=await applicationWorker.fetch(new Request(target,request),env,ctx);const headers=new Headers(result.headers);headers.set('Cache-Control','no-store');headers.set('X-Robots-Tag','noindex');return new Response(request.method==='HEAD'?null:result.body,{status:result.status,headers});}
   if(request.method==='POST'&&request.headers.get('origin')!==url.origin)return siteJson({error:'Same-origin request required'},403);
   return applicationWorker.fetch(request,env,ctx);
  }
  // Existing CSS, JS, and icons contain no user state or secrets; keep their paths intact.
  if(['/app.js','/style.css','/favicon.svg'].includes(path)&&['GET','HEAD'].includes(request.method))return applicationWorker.fetch(request,env,ctx);
  return siteTextPage('Page not found','<p>This address does not exist. Return to the project overview to continue.</p>',404);
 }catch{return siteJson({error:'The workspace is temporarily unavailable. Please retry.'},503);}
}};
