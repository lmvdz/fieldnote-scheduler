import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {homedir} from 'node:os';
const deploy=process.argv.includes('--deploy');
if(!deploy&&!process.argv.includes('--check'))throw Error('Choose --check or --deploy.');
const cfg=JSON.parse(await readFile('wrangler.jsonc','utf8'));
const hostname=cfg.routes[0].pattern;
if(!/^((resolution)|(supplypilot)|(fieldnote))\.inkwell\.finance$/.test(hostname)||cfg.name!=='inkwell-'+hostname.split('.')[0])throw Error('Unexpected deployment target.');
let token=process.env.CLOUDFLARE_API_TOKEN;
if(!token){const path=process.env.WRANGLER_OAUTH_FILE||join(process.env.APPDATA||join(homedir(),'.config'),'xdg.config','.wrangler','config','default.toml');const raw=await readFile(path,'utf8');token=/^oauth_token\s*=\s*"([^"]+)"/m.exec(raw)?.[1];}
if(!token)throw Error('Cloudflare login or API token required.');
async function cf(path,method='GET',body){const multipart=body instanceof FormData;const res=await fetch('https://api.cloudflare.com/client/v4'+path,{method,headers:{Authorization:'Bearer '+token,...(body&&!multipart?{'content-type':'application/json'}:{})},body:body?(multipart?body:JSON.stringify(body)):undefined,signal:AbortSignal.timeout(60000)});let json;try{json=await res.json()}catch{throw Error('Cloudflare returned a non-JSON response: '+res.status)}if(!res.ok||!json.success)throw Error('Cloudflare '+method+' '+path+': '+res.status+' codes '+(json.errors||[]).map(e=>e.code).join(','));return json.result;}
const zones=await cf('/zones?name=inkwell.finance');if(zones.length!==1||zones[0].status!=='active')throw Error('One active inkwell.finance zone required.');
const zone=zones[0],account=zone.account.id,base='/accounts/'+account;
const domains=await cf(base+'/workers/domains');const domain=domains.find(d=>d.hostname===hostname);
if(domain&&domain.service!==cfg.name)throw Error('Custom hostname already belongs to another Worker.');
const scripts=await cf(base+'/workers/scripts');const existing=scripts.find(s=>s.id===cfg.name);
let prior;try{prior=JSON.parse(await readFile('evidence/deployment.json','utf8'))}catch{}
if(existing&&(!prior||prior.service!==cfg.name||prior.account!==account))throw Error('Existing Worker has no local deployment provenance; refusing to replace it.');
const databases=await cf(base+'/d1/database?per_page=100');let database=databases.find(d=>d.name===cfg.d1_databases[0].database_name);
if(database&&!prior&&!existing)throw Error('An existing database has no local deployment provenance; refusing to reuse it.');
console.log(JSON.stringify({mode:deploy?'deploy':'check',hostname,service:cfg.name,zone:zone.name,existingDomain:!!domain,existingWorker:!!existing,existingDatabase:!!database}));
if(deploy){
 const privateRaw=await readFile('.dev.vars','utf8');const allowed=new Set(['SITE_OWNER_KEY','AI_MODE','OPENROUTER_API_KEY','AI_BASE_URL','AI_PRIMARY_MODEL','AI_FALLBACK_MODEL','AI_ALLOW_PAID_FALLBACK','AI_FALLBACK_MAX_PROMPT_PRICE','AI_FALLBACK_MAX_COMPLETION_PRICE','PAYPAL_MODE','PAYPAL_CLIENT_ID','PAYPAL_CLIENT_SECRET','PAYPAL_WEBHOOK_ID','PAYPAL_SANDBOX_ENABLED','PAYPAL_SANDBOX_CAPTURE_MAP']);
 const values={...cfg.vars};for(const line of privateRaw.split(/\r?\n/)){const m=/^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());if(m&&allowed.has(m[1])&&m[2]){let value=m[2];if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);values[m[1]]=value;}}
 if(!/^[a-f0-9]{64}$/.test(values.SITE_OWNER_KEY||''))throw Error('A 32-byte owner key is required; run setup-private.');
 if(values.AI_ALLOW_PAID_FALLBACK!=='false')throw Error('This deployment requires paid AI fallback disabled.');
 const secretNames=new Set(['SITE_OWNER_KEY','OPENROUTER_API_KEY','PAYPAL_CLIENT_ID','PAYPAL_CLIENT_SECRET','PAYPAL_WEBHOOK_ID','PAYPAL_SANDBOX_CAPTURE_MAP']);
 const code=await readFile(cfg.main,'utf8');if(!code.includes('ownerAuthorized')||!code.includes('const applicationWorker ='))throw Error('Build must contain the owner access wrapper.');
 if(!database)database=await cf(base+'/d1/database','POST',{name:cfg.d1_databases[0].database_name});
 const evidence={date:new Date().toISOString(),account,zone:zone.id,hostname,service:cfg.name,database:database.uuid,stage:'database-ready',aiConfigured:values.AI_MODE==='openrouter'&&!!values.OPENROUTER_API_KEY,paypalConfigured:!!values.PAYPAL_CLIENT_ID&&!!values.PAYPAL_CLIENT_SECRET};
 await mkdir('evidence',{recursive:true});await writeFile('evidence/deployment.json',JSON.stringify(evidence,null,2));
 const migrationDir=cfg.d1_databases[0].migrations_dir;for(const file of (await readdir(migrationDir)).filter(f=>f.endsWith('.sql')).sort()){let sql=await readFile(join(migrationDir,file),'utf8');if(/\b(DROP|DELETE|TRUNCATE|ALTER)\b/i.test(sql))throw Error('Only additive initial migrations are allowed.');sql=sql.replace(/CREATE TABLE(?! IF NOT EXISTS)/gi,'CREATE TABLE IF NOT EXISTS').replace(/CREATE (UNIQUE )?INDEX(?! IF NOT EXISTS)/gi,(_,unique)=>'CREATE '+(unique||'')+'INDEX IF NOT EXISTS');await cf(base+'/d1/database/'+database.uuid+'/query','POST',{sql});}
 const bindings=[{name:'DB',type:'d1',id:database.uuid},...Object.entries(values).map(([name,text])=>({name,text,type:secretNames.has(name)?'secret_text':'plain_text'}))];
 const form=new FormData();form.append('metadata',new Blob([JSON.stringify({main_module:'index.js',compatibility_date:cfg.compatibility_date,bindings})],{type:'application/json'}));form.append('index.js',new Blob([code],{type:'application/javascript+module'}),'index.js');
 await cf(base+'/workers/scripts/'+cfg.name,'PUT',form);evidence.stage='worker-uploaded';await writeFile('evidence/deployment.json',JSON.stringify(evidence,null,2));
 if(!domain){const origins=[{hostname,zone_id:zone.id}];const changeset=await cf(base+'/workers/scripts/'+cfg.name+'/domains/changeset?replace_state=true','POST',origins);if(changeset.conflicting?.length||changeset.removed?.length||changeset.updated?.some(d=>d.modified))throw Error('Domain plan contains a conflict or an unrelated modification.');await cf(base+'/workers/scripts/'+cfg.name+'/domains/records','PUT',{override_scope:false,override_existing_origin:false,override_existing_dns_record:false,origins});}
 evidence.stage='custom-domain-attached';await writeFile('evidence/deployment.json',JSON.stringify(evidence,null,2));console.log('Deployed https://'+hostname+' with protected workspace and isolated D1.');
}
