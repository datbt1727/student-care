import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';import pg from 'pg';import {S3Client} from '@aws-sdk/client-s3';import {randomBytes} from 'node:crypto';
import {encrypt,decrypt,digest,totpSecret} from '../lib/security.mjs';
import {validateSnapshot} from '../lib/snapshot.mjs';import {restoreIntoEmptyDatabase} from '../lib/restore.mjs';
const sql=new PGlite();let failAudit=false,failHealth=false,revokeAtWrite=false;
async function query(text,params=[]){if(revokeAtWrite&&text==='SELECT token_hash FROM sc_sessions WHERE token_hash=$1')return {rows:[],rowCount:0};if(failAudit&&text.startsWith('INSERT INTO sc_audit')&&params[1]==='workspace_saved')throw Error('simulated audit write failure');if(failHealth&&text.startsWith('SELECT completed_at,status'))throw Error('simulated health outage');if(!params.length&&text.includes(';')){const r=await sql.exec(text);return {rows:r.at(-1)?.rows||[],rowCount:r.at(-1)?.affectedRows||0}}const r=await sql.query(text,params);return {rows:r.rows,rowCount:r.affectedRows??r.rows.length}}
pg.Pool.prototype.query=query;pg.Pool.prototype.connect=async()=>({query,release(){}});
for(const k of ['DATA_KEY','BACKUP_KEY','RATE_KEY'])process.env[k]=randomBytes(32).toString('base64');process.env.APP_ORIGIN='https://student.test';process.env.S3_BUCKET='test';
const {default:handler}=await import('../api/rpc.mjs');const {backup,backupBoundary}=await import('../lib/backup.mjs');
let stored='',corrupt=false,holdPut=null,enterPut=null,replaceLease=false;
S3Client.prototype.send=async function(c){if(c.constructor.name==='PutObjectCommand'){stored=c.input.Body;if(enterPut)enterPut();if(holdPut)await holdPut;return {}}if(c.constructor.name==='GetObjectCommand'){if(replaceLease)await query("UPDATE sc_backup_runs SET started_at=started_at+interval '1 second'");return {Body:{transformToString:async()=>corrupt?stored+'corrupt':stored}}}throw Error('unsupported S3 command')};
const base={version:2,active:'2026-FALL',terms:{'2026-FALL':{students:[],records:[]}}};
async function call(action,p={}){const res={statusCode:200,setHeader(){},status(n){this.statusCode=n;return this},json(x){this.body=x;return this}};await handler({method:'POST',headers:{origin:process.env.APP_ORIGIN,'content-type':'application/json','x-sc-request':'1','x-sc-csrf':'csrf',cookie:'__Host-sc=test-token'},body:{action,p}},res);return res}
test('transaction failures, exact retry receipts, conflicts and post-commit health failures cannot produce a false save',async()=>{
 await sql.exec(await fs.readFile(new URL('../schema.sql',import.meta.url),'utf8'));
 await query('INSERT INTO sc_users(username,display_name,role,must_change,password_hash,totp_cipher) VALUES($1,$2,$3,false,$4,$5)',['admin','Admin','admin','scrypt$'+'a'.repeat(32)+'$'+'0'.repeat(128),encrypt(totpSecret(),'totp:admin')]);
 await query("INSERT INTO sc_sessions(token_hash,username,csrf,expires_at,pending) VALUES($1,'admin','csrf',now()+interval '1 hour',false)",[digest('test-token')]);
 await query('INSERT INTO sc_archive(id,cipher) VALUES(1,$1)',[encrypt(base,'archive')]);
 const updated=structuredClone(base);updated.terms['2026-FALL'].students=[{id:'SV001',name:'Sinh viên kiểm thử'}];
 const p={requestId:'receipt-test-001',revision:1,json:JSON.stringify(updated)};
 failAudit=true;let r=await call('save',p);assert.equal(r.statusCode,500);assert(!r.body.data?.receipt);failAudit=false;
 assert.equal((await query('SELECT revision FROM sc_archive')).rows[0].revision,1);assert.equal((await query('SELECT * FROM sc_requests')).rows.length,0);
 r=await call('save',p);assert.equal(r.statusCode,200);assert.deepEqual(r.body.data.receipt,{committed:true,requestId:p.requestId,requestHash:digest(JSON.stringify([1,p.json,false,''])),revision:2});
 // A response lost on the wire is safely retried using the same immutable request.
 assert.equal((await call('save',p)).body.data.revision,2);assert.equal((await query("SELECT * FROM sc_audit WHERE action='workspace_saved'")).rows.length,1);
 assert.equal((await call('save',{...p,json:JSON.stringify(base)})).statusCode,409);
 failHealth=true;r=await call('save',{...p,requestId:'receipt-test-002',revision:2});failHealth=false;assert.equal(r.statusCode,200);assert(r.body.data.healthUnavailable);assert(r.body.data.receipt.committed);assert.equal(r.body.data.revision,3);
 assert.equal((await call('job',{requestId:'unknown-request'})).body.data.status,'unknown');assert.equal((await call('job',{requestId:'receipt-test-002'})).body.data.status,'done');
 assert.equal((await call('save',{...p,requestId:'receipt-test-003'})).statusCode,409);assert.equal((await query('SELECT revision FROM sc_archive')).rows[0].revision,3);
 revokeAtWrite=true;assert.equal((await call('save',{...p,requestId:'receipt-revoked-004',revision:3})).statusCode,401);revokeAtWrite=false;assert.equal((await query('SELECT revision FROM sc_archive')).rows[0].revision,3);
});
test('remote read-back corruption, concurrent backup and expired leases never report success; recovery refuses nonempty targets',async()=>{
 corrupt=true;await assert.rejects(()=>backup(),/checksum/);assert.equal((await query('SELECT status FROM sc_backup_runs')).rows[0].status,'failed');
 corrupt=false;await query("UPDATE sc_backup_runs SET started_at=now()-interval '20 minutes'");
 let release;holdPut=new Promise(r=>release=r);const entered=new Promise(r=>enterPut=r);const first=backup();await entered;await assert.rejects(()=>backup(),e=>e.status===409);release();await first;holdPut=null;enterPut=null;
 assert.equal(backupBoundary(new Date('2026-10-24T16:59:59Z')).toISOString(),'2026-10-23T17:00:00.000Z');assert.equal(backupBoundary(new Date('2026-10-24T17:00:00Z')).toISOString(),'2026-10-24T17:00:00.000Z');
 const snapshot=validateSnapshot(decrypt(stored,'student-care-backup-v1','BACKUP_KEY'));assert.equal(snapshot.tables.sc_archive[0].revision,3);assert(!stored.includes('Sinh viên'));
 assert.equal((await backup()).status,'verified');await query("UPDATE sc_backup_runs SET completed_at=$1",[new Date(backupBoundary().getTime()-60000)]);const beforeScheduled=stored;await backup({scheduled:true});assert.notEqual(stored,beforeScheduled,'an earlier manual backup does not skip midnight backup');const prior=stored;assert.equal((await backup({force:true})).status,'verified');assert.notEqual(prior,stored);
 const bad=structuredClone(snapshot);bad.tables.sc_users[0].totp_cipher=encrypt('INVALID','totp:admin');assert.throws(()=>validateSnapshot(bad),/authenticator/);
 const target=new PGlite();try{await target.exec(await fs.readFile(new URL('../schema.sql',import.meta.url),'utf8'));await target.query('INSERT INTO sc_archive(id,cipher) VALUES(1,$1)',[encrypt(base,'archive')]);await assert.rejects(()=>restoreIntoEmptyDatabase(target,snapshot),/no archive/);assert.equal((await target.query('SELECT * FROM sc_users')).rows.length,0)}finally{await target.close()}
 replaceLease=true;await assert.rejects(()=>backup({force:true}),/lease expired/);assert.equal((await query('SELECT status FROM sc_backup_runs')).rows[0].status,'running');replaceLease=false;
 await sql.close();
});
