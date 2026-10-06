import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
let source;try{source=await readFile('.dev.vars','utf8')}catch(e){if(e.code!=='ENOENT')throw e;source=await readFile('.env.example','utf8');}
const existing=/^SITE_OWNER_KEY=(.*)$/m.exec(source)?.[1];
if(!existing){const key=randomBytes(32).toString('hex');source=source.includes('SITE_OWNER_KEY=')?source.replace(/^SITE_OWNER_KEY=.*$/m,'SITE_OWNER_KEY='+key):source+'\nSITE_OWNER_KEY='+key+'\n';await writeFile('.dev.vars',source,{mode:0o600});}
console.log('Private configuration is ready in .dev.vars. Read the owner key there; keep it out of recordings and source control.');
