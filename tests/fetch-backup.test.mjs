import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {randomBytes} from 'node:crypto';import pg from 'pg';import {S3Client} from '@aws-sdk/client-s3';
import {encrypt,digest,totpSecret} from '../lib/security.mjs';
test('independent B2 recovery download requires no database, verifies both cipher layers and never overwrites files',async()=>{
 for(const k of ['DATA_KEY','BACKUP_KEY'])process.env[k]=randomBytes(32).toString('base64');
 const archive={version:2,active:'2026-FALL',terms:{'2026-FALL':{students:[],records:[]}}};
 const snapshot={format:1,at:new Date().toISOString(),tables:{sc_users:[{username:'admin',display_name:'Admin',role:'admin',active:true,password_hash:'scrypt$'+'a'.repeat(32)+'$'+'0'.repeat(128),totp_cipher:encrypt(totpSecret(),'totp:admin')}],sc_archive:[{id:1,revision:7,cipher:encrypt(archive,'archive')}],sc_audit:[]}};
 const bytes=encrypt(snapshot,'student-care-backup-v1','BACKUP_KEY');let corrupt=false;
 S3Client.prototype.send=async()=>({Metadata:{sha256:digest(bytes)},Body:{transformToString:async()=>corrupt?bytes+'bad':bytes}});
 pg.Pool.prototype.query=async()=>{throw Error('Neon is unavailable')};
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'sc-recovery-test-')),destination=path.join(dir,'backup.json.enc'),oldArgs=process.argv;
 try{process.argv=['node','fetch-backup.mjs','daily/test/backup.json.enc',destination];await import('../scripts/fetch-backup.mjs?success');assert.equal(await fs.readFile(destination,'utf8'),bytes);assert.equal((await fs.stat(destination)).mode&0o777,0o600);await assert.rejects(()=>import('../scripts/fetch-backup.mjs?no-overwrite'),e=>e.code==='EEXIST');process.argv[3]=path.join(dir,'bad.enc');corrupt=true;await assert.rejects(()=>import('../scripts/fetch-backup.mjs?corrupt'),/Checksum/);await assert.rejects(()=>fs.stat(process.argv[3]),e=>e.code==='ENOENT')}finally{process.argv=oldArgs;await fs.rm(dir,{recursive:true,force:true})}
});
