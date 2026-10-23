import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {execFileSync} from 'node:child_process';
test('prepare-env creates private keys once, preserves them, refuses invalid existing key',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'student-care-setup-'));
 try{
 await fs.mkdir(path.join(root,'scripts'));
 await fs.copyFile(new URL('../scripts/prepare-env.mjs',import.meta.url),path.join(root,'scripts/prepare-env.mjs'));
 await fs.copyFile(new URL('../.env.example',import.meta.url),path.join(root,'.env.example'));
 const run=()=>execFileSync(process.execPath,[path.join(root,'scripts/prepare-env.mjs')],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
 const stdout=run(),before=await fs.readFile(path.join(root,'.env'),'utf8');
 for(const name of ['DATA_KEY','BACKUP_KEY','RATE_KEY','CRON_SECRET']){const value=before.match(new RegExp('^'+name+'=(.+)$','m'))[1];assert.equal(Buffer.from(value,'base64').length,32);assert(!stdout.includes(value));}
 assert.equal((await fs.stat(path.join(root,'.env'))).mode&0o777,0o600);
 run();assert.equal(await fs.readFile(path.join(root,'.env'),'utf8'),before);
 const invalid=before.replace(/^DATA_KEY=.*$/m,'DATA_KEY=bad');
 await fs.writeFile(path.join(root,'.env'),invalid);
 assert.throws(()=>run());assert.equal(await fs.readFile(path.join(root,'.env'),'utf8'),invalid);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
