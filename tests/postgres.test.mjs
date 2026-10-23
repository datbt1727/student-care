import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';import pg from 'pg';import {S3Client} from '@aws-sdk/client-s3';import {randomBytes} from 'node:crypto';
import {hashPassword,encrypt,decrypt,totpSecret,totp} from '../lib/security.mjs';
const sql=new PGlite();
async function query(text,params=[]){if(!params.length&&text.includes(';')){const r=await sql.exec(text);return {rows:r.at(-1)?.rows||[],rowCount:r.at(-1)?.affectedRows||0};}const r=await sql.query(text,params);return {rows:r.rows,rowCount:r.affectedRows??r.rows.length};}
pg.Pool.prototype.query=query;pg.Pool.prototype.connect=async()=>({query,release(){}});
for(const k of ['DATA_KEY','BACKUP_KEY','RATE_KEY'])process.env[k]=randomBytes(32).toString('base64');
process.env.APP_ORIGIN='https://student.test';process.env.S3_BUCKET='test-only';
const objects=new Map();let rejectS3=false;
S3Client.prototype.send=async function(command){if(rejectS3)throw Error('Simulated storage outage');const x=command.input;if(command.constructor.name==='PutObjectCommand'){objects.set(x.Key,x.Body);return {};}if(command.constructor.name==='GetObjectCommand'){const s=objects.get(x.Key);return {Body:{transformToString:async()=>s}};}throw Error('Unsupported S3 test command');};
const {restoreIntoEmptyDatabase}=await import('../lib/restore.mjs');
const {default:handler}=await import('../api/rpc.mjs');const {backup}=await import('../lib/backup.mjs');
const base={version:2,active:'2026-FALL',terms:{'2026-FALL':{students:[],records:[]}}};let cookie='',csrf='';
async function call(action,p={}){
 const req={method:'POST',headers:{origin:process.env.APP_ORIGIN,'content-type':'application/json','x-sc-request':'1','x-sc-csrf':csrf,cookie},body:{action,p}},res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(v){this.body=v;return this}};
 await handler(req,res);if(res.headers['Set-Cookie'])cookie=res.headers['Set-Cookie'].split(';')[0];if(res.body.data?.csrf)csrf=res.body.data.csrf;return res;
}
test('PostgreSQL engine: first-login, save transaction/idempotency/conflict, encrypted backup and failure',async()=>{
 try{
 await sql.exec(await fs.readFile(new URL('../schema.sql',import.meta.url),'utf8'));
 const secret=totpSecret();
 await query('INSERT INTO sc_users(username,display_name,role,password_hash,totp_cipher) VALUES($1,$2,$3,$4,$5)',['admin','Admin','admin',await hashPassword('Original#Password2026'),encrypt(secret,'totp:admin')]);
 await query('INSERT INTO sc_archive(id,cipher) VALUES(1,$1)',[encrypt(base,'archive')]);
 let r=await call('login',{username:'admin',password:'Original#Password2026',totp:totp(secret)});assert.equal(r.statusCode,200,JSON.stringify(r.body));assert(r.body.data.user.mustChange);
 assert.equal((await call('load')).statusCode,403);
 r=await call('changePassword',{oldPassword:'Original#Password2026',newPassword:'Replacement#Password2026'});assert.equal(r.statusCode,200,JSON.stringify(r.body));
 assert.equal((await query('SELECT * FROM sc_sessions')).rows.length,0);
 r=await call('login',{username:'admin',password:'Replacement#Password2026',totp:totp(secret,Math.floor(Date.now()/30000)+1),remember:true});assert.equal(r.statusCode,200,JSON.stringify(r.body));
 r=await call('load');assert.equal(r.statusCode,200,JSON.stringify(r.body));assert.equal(r.body.data.revision,1);
 const updated=structuredClone(base);updated.terms['2026-FALL'].students=[{id:'TEST01',name:'Sinh viên kiểm thử'}];
 const save={requestId:'save-test-0001',revision:1,json:JSON.stringify(updated)};
 r=await call('save',save);assert.equal(r.statusCode,200,JSON.stringify(r.body));assert.equal(r.body.data.revision,2);
 const encrypted=(await query('SELECT cipher FROM sc_archive')).rows[0].cipher;assert(!encrypted.includes('Sinh viên'));assert.deepEqual(decrypt(encrypted,'archive'),updated);
 assert.equal((await call('save',save)).body.data.revision,2);
 r=await call('save',{...save,requestId:'save-test-0002'});assert.equal(r.statusCode,409,JSON.stringify(r.body));
 assert.equal((await query('SELECT revision FROM sc_archive')).rows[0].revision,2);
 const audit=(await query("SELECT * FROM sc_audit WHERE action='workspace_saved'")).rows;assert.equal(audit.length,1);
 const b=await backup();assert(b.objectKey);assert.equal(objects.size,1);
 const payload=objects.get(b.objectKey);assert(!payload.includes('password_hash'));const snapshot=decrypt(payload,'student-care-backup-v1','BACKUP_KEY');assert.equal(snapshot.tables.sc_users.length,1);assert.deepEqual(decrypt(snapshot.tables.sc_archive[0].cipher,'archive'),updated);
 assert.equal((await query('SELECT status FROM sc_backup_runs')).rows[0].status,'success');
 await query("UPDATE sc_backup_runs SET status='failed',started_at=now()-interval '20 minutes'");rejectS3=true;
 await assert.rejects(()=>backup());assert.equal((await query('SELECT status FROM sc_backup_runs')).rows[0].status,'failed');
 const m=await call('health');assert(m.body.data.backupError);
 const restored=new PGlite();try{
 await restored.exec(await fs.readFile(new URL('../schema.sql',import.meta.url),'utf8'));
 await restoreIntoEmptyDatabase(restored,snapshot);
 const ra=(await restored.query('SELECT * FROM sc_archive')).rows[0];assert.deepEqual(decrypt(ra.cipher,'archive'),updated);assert.equal(ra.revision,3);
 assert.equal((await restored.query('SELECT must_change FROM sc_users')).rows[0].must_change,true);
 assert.equal((await restored.query('SELECT * FROM sc_sessions')).rows.length,0);
 await assert.rejects(()=>restoreIntoEmptyDatabase(restored,snapshot),/no accounts/);
 }finally{await restored.close();}
 await sql.exec('CREATE ROLE studentcare_app LOGIN');
 await sql.exec(await fs.readFile(new URL('../scripts/grants.sql',import.meta.url),'utf8'));
 await sql.exec('SET ROLE studentcare_app');
 assert.equal((await query('SELECT * FROM sc_archive')).rows.length,1);
 await assert.rejects(()=>query('DELETE FROM sc_audit'));
 await assert.rejects(()=>query('CREATE TABLE forbidden_table(id int)'));
 await sql.exec('RESET ROLE');

 console.log('Verified against embedded PostgreSQL SQL engine; S3 transport mocked, no Neon/Vercel credentials used.');
 }finally{await sql.close();}
});
