import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import pg from 'pg';
import {encrypt,decrypt,digest} from '../lib/security.mjs';
const sql=new PGlite(),reads=[];
for(const name of ['DATA_KEY','RATE_KEY'])process.env[name]=Buffer.alloc(32,name==='DATA_KEY'?81:82).toString('base64');
process.env.APP_ORIGIN='https://bandwidth.test';
async function query(text,p=[]){const r=await sql.query(text,p);if(/^SELECT/.test(text)&&text.includes('sc_archive'))reads.push({text,bytes:Buffer.byteLength(JSON.stringify(r.rows)),cipher:r.rows.some(x=>typeof x.cipher==='string')});return {rows:r.rows,rowCount:r.affectedRows??r.rows.length}}
pg.Pool.prototype.query=query;pg.Pool.prototype.connect=async()=>({query,release(){}});
const {default:handler}=await import('../api/rpc.mjs');
async function call(action,p={},username='admin'){
 const req={method:'POST',headers:{origin:process.env.APP_ORIGIN,'content-type':'application/json','x-sc-request':'1','x-sc-csrf':'test-csrf',cookie:'__Host-sc='+username+'-token'},body:{action,p}},res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(v){this.body=v;return this}};await handler(req,res);return res;
}
test('real PostgreSQL: unchanged sync does not transfer ciphertext; saves retain CAS, receipts and staff authorization',async()=>{
 try{
 await sql.exec(await fs.readFile(new URL('../schema.sql',import.meta.url),'utf8'));
 const students=Array.from({length:3000},(_,i)=>({id:'SV'+i,name:'Sinh viên kiểm tra '+i})),records=Array.from({length:12000},(_,i)=>({id:'SV'+i%3000,subject:'SUB'+i%10,group:'G1',date:'2026-10-'+(24+Math.floor(i/3000)),absent:2,slots:10}));
 const archive={version:2,active:'2026-FALL',terms:{'2026-FALL':{students,records,notes:{},followAudit:[]}}},cipher=encrypt(archive,'archive');
 await query('INSERT INTO sc_archive(id,cipher) VALUES(1,$1)',[cipher]);
 for(const username of ['admin','staff']){
 await query('INSERT INTO sc_users(username,display_name,role,password_hash,totp_cipher,must_change,permissions) VALUES($1,$1,$2,$3,$4,false,$5)',[username,username==='admin'?'admin':'staff','scrypt$'+'a'.repeat(32)+'$'+'b'.repeat(128),encrypt('A'.repeat(32),'totp:'+username),JSON.stringify(username==='admin'?{}:{editFollow:true})]);
 await query("INSERT INTO sc_sessions(token_hash,username,csrf,expires_at,pending,remember) VALUES($1,$2,'test-csrf',now()+interval '8 hours',false,false)",[digest(username+'-token'),username]);
 }
 reads.length=0;
 for(let i=0;i<20;i++){const r=await call('sync',{revision:1});assert.equal(r.statusCode,200);assert.equal(r.body.data.changed,false);assert(!r.body.data.archive)}
 assert.equal(reads.length,20);assert(reads.every(x=>!x.cipher));const optimized=reads.reduce((n,r)=>n+r.bytes,0),baseline=20*Buffer.byteLength(JSON.stringify([{revision:1,cipher}]));assert(optimized<baseline*.001);
 console.log(JSON.stringify({sampleCipherBytes:Buffer.byteLength(cipher),unchangedPolls:20,legacyArchiveResultBytes:baseline,optimizedArchiveResultBytes:optimized}));
 await query('UPDATE sc_archive SET revision=revision+1 WHERE id=1');reads.length=0;
 const changed=await call('sync',{revision:1});assert.equal(changed.body.data.revision,2);assert.deepEqual(changed.body.data.archive,archive);assert.equal(reads.filter(r=>r.cipher).length,1);
 reads.length=0;const save={requestId:'bandwidth-admin-0001',revision:2,json:JSON.stringify(archive)};
 const saved=await call('save',save);assert.equal(saved.statusCode,200,JSON.stringify(saved.body));assert.equal(saved.body.data.revision,3);assert(saved.body.data.receipt.committed);assert(reads.every(r=>!r.cipher));
 const retried=await call('save',save);assert.equal(retried.body.data.revision,3);assert(reads.every(r=>!r.cipher));
 const stale=await call('save',{...save,requestId:'bandwidth-admin-stale'});assert.equal(stale.statusCode,409);assert(reads.every(r=>!r.cipher));
 const unauthorized=structuredClone(archive);unauthorized.terms['2026-FALL'].students[0].name='Không được sửa';reads.length=0;
 assert.equal((await call('save',{requestId:'bandwidth-staff-denied',revision:3,json:JSON.stringify(unauthorized)},'staff')).statusCode,403);assert.equal(reads.filter(r=>r.cipher).length,1);
 const allowed=structuredClone(archive);allowed.terms['2026-FALL'].notes.SV0=[{text:'Ghi chú được cấp quyền'}];
 const staffSave=await call('save',{requestId:'bandwidth-staff-allowed',revision:3,json:JSON.stringify(allowed)},'staff');assert.equal(staffSave.statusCode,200,JSON.stringify(staffSave.body));assert.equal(staffSave.body.data.revision,4);
 assert.deepEqual(decrypt((await query('SELECT cipher FROM sc_archive WHERE id=1')).rows[0].cipher,'archive'),allowed);
 assert.equal((await call('sync',{revision:4},'not-logged-in')).statusCode,401);
 reads.length=0;
 const malformed=await call('save',{requestId:'malformed-json-0001',revision:4,json:'{broken'});assert.equal(malformed.statusCode,400);assert(!reads.length);
 const rawRes={statusCode:200,setHeader(){},status(n){this.statusCode=n;return this},json(v){this.body=v;return this}};
 await handler({method:'POST',headers:{origin:process.env.APP_ORIGIN,'content-type':'application/json','x-sc-request':'1'},body:'{'},rawRes);assert.equal(rawRes.statusCode,400);
 }finally{await sql.close()}
});
