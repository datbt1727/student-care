import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import pg from 'pg';import {PGlite} from '@electric-sql/pglite';import {randomBytes} from 'node:crypto';
import {hashPassword,encrypt,decrypt,totpSecret,totp} from '../lib/security.mjs';
const db=new PGlite();async function query(sql,p=[]){const r=await db.query(sql,p);return {rows:r.rows,rowCount:r.affectedRows??r.rows.length}}
pg.Pool.prototype.query=query;pg.Pool.prototype.connect=async()=>({query,release(){}});
process.env.DATA_KEY=randomBytes(32).toString('base64');process.env.RATE_KEY=randomBytes(32).toString('base64');process.env.APP_ORIGIN='https://student.test';
const {default:handler}=await import('../api/rpc.mjs');const jars={admin:{},staff:{},manager:{}};let current=jars.admin;
async function call(action,p={}){const req={method:'POST',headers:{origin:process.env.APP_ORIGIN,'x-sc-request':'1','x-sc-csrf':current.csrf||'','content-type':'application/json',cookie:current.cookie||''},body:{action,p}},res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(v){this.body=v;return this}};await handler(req,res);if(res.headers['Set-Cookie'])current.cookie=res.headers['Set-Cookie'].split(';')[0];if(res.body.data?.csrf)current.csrf=res.body.data.csrf;return res}
const ok=r=>{assert.equal(r.statusCode,200,JSON.stringify(r.body));return r.body.data};
test('admin grants/edits/revokes granular staff rights; delegated manager cannot escalate or manage admins',async()=>{
 try{
 await db.exec(await fs.readFile(new URL('../schema.sql',import.meta.url),'utf8'));
 const secret=totpSecret();await query('INSERT INTO sc_users(username,display_name,role,password_hash,totp_cipher,must_change) VALUES($1,$2,$3,$4,$5,false)',['admin','Admin','admin',await hashPassword('Administrator#2026'),encrypt(secret,'totp:admin')]);
 const a={version:2,active:'2026-FALL',terms:{'2026-FALL':{students:[{id:'A',name:'Demo'}],records:[],dailyFollow:{},followAudit:[]}},registry:{version:1,students:{A:{id:'A',name:'Demo'}},events:[],seen:{}},studentServices:{certificates:[],insurance:[],audit:[]}};
 await query('INSERT INTO sc_archive(id,cipher) VALUES(1,$1)',[encrypt(a,'archive')]);ok(await call('login',{username:'admin',password:'Administrator#2026',totp:totp(secret)}));
 const staffResult=ok(await call('createUser',{username:'staff.demo',displayName:'Staff',role:'staff',password:'Temporary#2026',permissions:{editFollow:true}}));const staffSecret=staffResult.message.match(/[A-Z2-7]{32}$/)[0];await query("UPDATE sc_users SET must_change=false WHERE username='staff.demo'");
 current=jars.staff;assert(ok(await call('login',{username:'staff.demo',password:'Temporary#2026',totp:totp(staffSecret)})).user.permissions.editFollow);
 a.terms['2026-FALL'].dailyFollow.one={id:'A',note:'Contacted'};a.terms['2026-FALL'].followAudit.push({id:'A',note:'Contacted'});ok(await call('save',{requestId:'follow-save-001',revision:1,json:JSON.stringify(a)}));
 const forged=structuredClone(a);forged.registry.students.A.name='Unauthorized';assert.equal((await call('save',{requestId:'forged-profile',revision:2,json:JSON.stringify(forged),role:'admin',permissions:{editProfiles:true}})).statusCode,403);
 assert.equal((await call('updateUser',{username:'staff.demo',displayName:'Self',role:'admin',active:true,permissions:{}})).statusCode,403);
 current=jars.admin;const managerResult=ok(await call('createUser',{username:'manager.demo',displayName:'Manager',role:'staff',password:'Temporary#2026',permissions:{manageAccounts:true}}));const managerSecret=managerResult.message.match(/[A-Z2-7]{32}$/)[0];await query("UPDATE sc_users SET must_change=false WHERE username='manager.demo'");
 current=jars.manager;ok(await call('login',{username:'manager.demo',password:'Temporary#2026',totp:totp(managerSecret)}));ok(await call('users'));
 assert.equal((await call('createUser',{username:'new.admin',displayName:'Admin bypass',role:'admin',password:'Temporary#2026'})).statusCode,403);
 assert.equal((await call('updateUser',{username:'staff.demo',displayName:'Staff',role:'staff',active:true,permissions:{editProfiles:true}})).statusCode,403);
 assert.equal((await call('resetUser',{username:'admin',password:'Compromised#2026'})).statusCode,403);
 assert.equal((await call('toggleUser',{username:'admin'})).statusCode,403);
 current=jars.admin;ok(await call('updateUser',{username:'staff.demo',displayName:'Staff updated',role:'staff',active:true,permissions:{editProfiles:true}}));
 assert.equal((await query("SELECT * FROM sc_sessions WHERE username='staff.demo'")).rows.length,0);
 current=jars.staff;assert.equal((await call('load')).statusCode,401);
 const login=ok(await call('login',{username:'staff.demo',password:'Temporary#2026',totp:totp(staffSecret,Math.floor(Date.now()/30000)+1)}));assert.equal(login.user.permissions.editFollow,false);assert.equal(login.user.permissions.editProfiles,true);
 const after=structuredClone(a);after.terms['2026-FALL'].dailyFollow.two={id:'A',note:'Not allowed'};assert.equal((await call('save',{requestId:'revoked-follow',revision:2,json:JSON.stringify(after)})).statusCode,403);
 a.registry.students.A.name='Authorized';a.terms['2026-FALL'].students[0].name='Authorized';ok(await call('save',{requestId:'profile-save-001',revision:2,json:JSON.stringify(a)}));
 current=jars.admin;assert.equal((await call('updateUser',{username:'admin',displayName:'Admin',role:'staff',active:true,permissions:{}})).statusCode,403);
 ok(await call('updateUser',{username:'staff.demo',displayName:'Disabled',role:'staff',active:false,permissions:{}}));current=jars.staff;assert.equal((await call('load')).statusCode,401);
 const account=(await query("SELECT * FROM sc_users WHERE username='staff.demo'")).rows[0];assert.equal(decrypt(account.totp_cipher,'totp:staff.demo'),staffSecret);assert.equal(account.active,false);
 assert((await query("SELECT * FROM sc_audit WHERE action='account_updated'")).rows.length>=2);
 }finally{await db.close()}
});
