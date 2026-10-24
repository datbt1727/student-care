import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import pg from 'pg';import {PGlite} from '@electric-sql/pglite';import {randomBytes} from 'node:crypto';
import {hashPassword,encrypt,totpSecret,totp,digest} from '../lib/security.mjs';
const sql=new PGlite();let reads=0;
async function query(text,p=[]){if(text==='SELECT * FROM sc_archive WHERE id=1')reads++;const r=await sql.query(text,p);return {rows:r.rows,rowCount:r.affectedRows??r.rows.length}}
pg.Pool.prototype.query=query;pg.Pool.prototype.connect=async()=>({query,release(){}});
process.env.DATA_KEY=randomBytes(32).toString('base64');process.env.RATE_KEY=randomBytes(32).toString('base64');process.env.APP_ORIGIN='https://student.test';
const {default:handler}=await import('../api/rpc.mjs');let cookie='',csrf='';
async function call(action,p={}){const req={method:'POST',headers:{origin:process.env.APP_ORIGIN,'x-sc-request':'1','x-sc-csrf':csrf,'content-type':'application/json',cookie},body:{action,p}},res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(v){this.body=v;return this}};await handler(req,res);if(res.headers['Set-Cookie'])cookie=res.headers['Set-Cookie'].split(';')[0];if(res.body.data?.csrf)csrf=res.body.data.csrf;return res}
test('created staff requires own TOTP, first password change and authorized inline workspace; rate cooldown is returned',async()=>{
 try{
 await sql.exec(await fs.readFile(new URL('../schema.sql',import.meta.url),'utf8'));
 const secret=totpSecret();await query('INSERT INTO sc_users(username,display_name,role,password_hash,totp_cipher,must_change) VALUES($1,$2,$3,$4,$5,false)',['admin','Admin','admin',await hashPassword('Administrator#2026'),encrypt(secret,'totp:admin')]);
 const archive={version:2,active:'2026-FALL',terms:{'2026-FALL':{students:[],records:[]}}};await query('INSERT INTO sc_archive(id,cipher) VALUES(1,$1)',[encrypt(archive,'archive')]);
 let r=await call('login',{username:'admin',password:'Administrator#2026',totp:totp(secret),includeWorkspace:true});assert.equal(r.statusCode,200);assert.deepEqual(r.body.data.workspace.archive,archive);assert.equal(reads,1);
 r=await call('createUser',{username:'staff.demo',displayName:'Nhân viên',role:'staff',password:'Temporary#2026'});assert.equal(r.statusCode,200,JSON.stringify(r.body));const staffSecret=r.body.data.message.match(/[A-Z2-7]{32}$/)?.[0];assert(staffSecret);assert.notEqual(staffSecret,secret);
 cookie='';csrf='';const code=totp(staffSecret),wrong=String((Number(code)+1)%1000000).padStart(6,'0');
 r=await call('login',{username:'staff.demo',password:'Temporary#2026',totp:wrong,includeWorkspace:true});assert.equal(r.statusCode,401);assert(!r.body.data);
 r=await call('login',{username:'staff.demo',password:'Temporary#2026',totp:code,includeWorkspace:true});assert.equal(r.statusCode,200);assert(r.body.data.user.mustChange);assert(!r.body.data.workspace);
 assert.equal((await query('SELECT n FROM sc_rate WHERE bucket=$1',['login-user:'+digest('staff.demo')])).rows.length,0);
 r=await call('resume',{includeWorkspace:true});assert.equal(r.statusCode,200);assert(!r.body.data.workspace);assert.equal((await call('load')).statusCode,403);
 r=await call('changePassword',{oldPassword:'Temporary#2026',newPassword:'MyReplacement#2026'});assert.equal(r.statusCode,200);
 r=await call('login',{username:'STAFF.DEMO',password:'MyReplacement#2026',totp:totp(staffSecret,Math.floor(Date.now()/30000)+1),includeWorkspace:true});assert.equal(r.statusCode,200);assert.equal(r.body.data.workspace.user.role,'staff');assert.deepEqual(r.body.data.workspace.archive,archive);
 assert.equal((await call('save',{json:JSON.stringify(archive),revision:1,requestId:'not-allowed-test'})).statusCode,403);
 r=await call('resume',{includeWorkspace:true});assert.equal(r.statusCode,200);assert(r.body.data.workspace);
 await query("INSERT INTO sc_rate VALUES($1,8,now()+interval '40 seconds')",['login-user:'+digest('staff.demo')]);
 r=await call('login',{username:'staff.demo',password:'MyReplacement#2026',totp:totp(staffSecret)});assert.equal(r.statusCode,429);assert(r.body.retryAfter>0&&r.body.retryAfter<=40);assert.equal(r.headers['Retry-After'],String(r.body.retryAfter));
 assert.equal((await call('load',null)).statusCode,400);
 }finally{await sql.close()}
});
