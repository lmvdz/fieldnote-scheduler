import {readFile} from 'node:fs/promises';
export async function loadPrivateConfig(){let source;try{source=await readFile('.dev.vars','utf8')}catch(e){if(e.code==='ENOENT')return;throw e}for(const line of source.split(/\r?\n/)){const match=/^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);if(match&&process.env[match[1]]===undefined)process.env[match[1]]=match[2].replace(/^"(.*)"$/,'$1');}}
