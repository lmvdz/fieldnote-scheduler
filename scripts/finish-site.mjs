import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const project=JSON.parse(await readFile('site/project.json','utf8'));
const types={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',svg:'image/svg+xml',webp:'image/webp',ttf:'font/ttf'};
const assets={};
for(const name of ['index.html','site.css','site.js','favicon.svg','hero.webp','scene.js','three.module.js','three.core.js','manrope.ttf','manrope-bold.ttf']){
 const body=await readFile('site/'+name);const ext=name.split('.').pop(),binary=['webp','ttf'].includes(ext);
 assets[name==='index.html'?'/':'/site/'+name]={body:binary?body.toString('base64'):body.toString('utf8'),type:types[ext],binary,hash:createHash('sha256').update(body).digest('hex')};
}
let code=await readFile('dist/server/index.js','utf8');
if(!code.includes('export default'))throw Error('Worker entrypoint must have one default export.');
code=code.replace('export default','const applicationWorker =');
const router=await readFile('site/router.mjs','utf8');
code+='\nconst SITE_PROJECT='+JSON.stringify(project)+';\nconst SITE_ASSETS='+JSON.stringify(assets)+';\n'+router;
await writeFile('dist/server/index.js',code);
console.log('Added original public landing page and signed owner access.');
