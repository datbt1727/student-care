import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import pg from 'pg';import {randomBytes} from 'node:crypto';import {encrypt} from '../lib/security.mjs';
test('detailed review rejects the production endpoint, then only reads the separate TLS target and prints masked results',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'sc-review-')),cwd=process.cwd(),oldConnect=pg.Pool.prototype.connect,oldEnd=pg.Pool.prototype.end,oldLog=console.log,oldError=console.error,oldDb=process.env.DATABASE_URL,oldKey=process.env.DATA_KEY;
 const printed=[],queries=[];let connections=0;
 try{
 await fs.writeFile(path.join(dir,'.env'),'DATABASE_URL=postgresql://owner:PRIVATE_PASSWORD@production.example/db\n');process.chdir(dir);process.env.DATA_KEY=randomBytes(32).toString('base64');
 const cipher=encrypt({registry:{students:{PRIVATE_STUDENT:{name:'PRIVATE_NAME'}}},terms:{T:{students:[],records:[{id:'PRIVATE_STUDENT',subject:'A',group:'G',slots:40,part:1,date:'2026-11-18'}]}}},'archive');
 pg.Pool.prototype.connect=async()=>{connections++;return {connection:{stream:{encrypted:true,authorized:true,getPeerCertificate:()=>({subjectaltname:'DNS:staging.example'})}},query:async sql=>{queries.push(sql);return sql.includes('pg_stat_ssl')?{rows:[{ssl:true}]}:sql.includes('FROM sc_archive')?{rows:[{revision:88,cipher}]}:{rows:[]};},release(){}}};pg.Pool.prototype.end=async()=>{};console.log=v=>printed.push(v);console.error=v=>printed.push(v);
 process.env.DATABASE_URL='postgresql://owner:PRIVATE_PASSWORD@production-pooler.example/db';
 await import('../scripts/review-business-details.mjs?same');assert.equal(connections,0);assert(printed.join('').includes('TARGET_NOT_SEPARATE'));assert.equal(process.exitCode,1);process.exitCode=0;printed.length=0;
 process.env.DATABASE_URL='postgresql://owner:PRIVATE_PASSWORD@staging.example/db';
 await import('../scripts/review-business-details.mjs?different');assert.equal(connections,1);assert(queries.includes('SET TRANSACTION READ ONLY'));assert(!queries.some(q=>q.includes('pg_stat_ssl')));assert(queries.every(q=>/^(BEGIN|COMMIT|ROLLBACK|SET TRANSACTION READ ONLY|SELECT)/.test(q)));assert(!/PRIVATE_PASSWORD|PRIVATE_STUDENT|PRIVATE_NAME|postgresql:/.test(printed.join('')));assert.equal(JSON.parse(printed[0]).revision,88);
 }finally{process.chdir(cwd);pg.Pool.prototype.connect=oldConnect;pg.Pool.prototype.end=oldEnd;console.log=oldLog;console.error=oldError;if(oldDb===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=oldDb;if(oldKey===undefined)delete process.env.DATA_KEY;else process.env.DATA_KEY=oldKey;await fs.rm(dir,{recursive:true,force:true});}
});
