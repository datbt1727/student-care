import test from 'node:test';import assert from 'node:assert/strict';import pg from 'pg';
import {randomBytes} from 'node:crypto';
import {hashPassword,encrypt,totpSecret,totp,digest} from '../lib/security.mjs';
process.env.DATA_KEY=randomBytes(32).toString('base64');process.env.RATE_KEY=randomBytes(32).toString('base64');process.env.APP_ORIGIN='https://student.test';
let user,session,archive,revision,deletedSessions;
async function query(sql,p=[]){
 if(/^(BEGIN|COMMIT|ROLLBACK)/.test(sql))return {rows:[],rowCount:0};
 if(sql.includes('DELETE FROM sc_rate'))return {rows:[],rowCount:1};
 if(sql.includes('INSERT INTO sc_rate'))return {rows:[{n:1}],rowCount:1};
 if(sql==='SELECT * FROM sc_users WHERE username=$1')return {rows:p[0]===user.username?[user]:[]};
 if(sql.includes('SELECT s.*,u.'))return {rows:session&&p[0]===session.token_hash?[{...session,...user}]:[]};
 if(sql.includes('UPDATE sc_users SET last_totp_step')){if(user.last_totp_step>=p[1])return {rows:[],rowCount:0};user.last_totp_step=p[1];return {rows:[{username:user.username}],rowCount:1};}
 if(sql.includes('INSERT INTO sc_sessions')){session={token_hash:p[0],username:p[1],csrf:p[2],pending:p[4]};return {rows:[],rowCount:1};}
 if(sql.includes('UPDATE sc_sessions SET last_seen')||sql.includes('INSERT INTO sc_audit'))return {rows:[],rowCount:1};
 if(sql.includes('DELETE FROM sc_sessions')){deletedSessions++;session=null;return {rows:[],rowCount:1};}
 if(sql.includes('UPDATE sc_users SET password_hash')){user.password_hash=p[1];user.must_change=false;return {rows:[],rowCount:1};}
 if(sql.includes('SELECT * FROM sc_archive'))return {rows:[{cipher:archive,revision}]};
 if(sql.includes('SELECT completed_at,status'))return {rows:[]};
 throw Error('Unhandled mocked SQL: '+sql);
}
pg.Pool.prototype.query=query;
pg.Pool.prototype.connect=async()=>({query,release(){}});
const {default:handler}=await import('../api/rpc.mjs');
async function init({pending=false,role='admin'}={}){
 const secret=totpSecret();user={username:'admin',display_name:'Admin',role,active:true,must_change:pending,password_hash:await hashPassword('Original#Password2026'),totp_cipher:encrypt(secret,'totp:admin'),last_totp_step:-1};
 session={token_hash:digest('session-token'),username:'admin',csrf:'csrf-test',pending};deletedSessions=0;revision=1;
 archive=encrypt({version:2,active:'2026-FALL',terms:{'2026-FALL':{students:[],records:[]}}},'archive');return secret;
}
async function call(action,p={},headers={}){
 const req={method:'POST',headers:{origin:process.env.APP_ORIGIN,'content-type':'application/json','x-sc-request':'1','x-sc-csrf':'csrf-test',cookie:'__Host-sc=session-token',...headers},body:{action,p}};
 const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(v){this.body=v;return this}};
 await handler(req,res);return res;
}
test('pending first login cannot access data even using API directly',async()=>{await init({pending:true});const r=await call('load');assert.equal(r.statusCode,403);assert.match(r.body.error,/đổi mật khẩu/);});
test('anonymous and cross-origin requests cannot load data',async()=>{await init();assert.equal((await call('load',{}, {cookie:''})).statusCode,401);assert.equal((await call('load',{}, {origin:'https://evil.test'})).statusCode,403);assert.equal((await call('load',{}, {'x-sc-csrf':'wrong'})).statusCode,403);});
test('staff cannot bypass admin-only document write or admin account APIs',async()=>{await init({role:'staff'});assert.equal((await call('save')).statusCode,403);assert.equal((await call('users')).statusCode,403);assert.equal((await call('load')).statusCode,200);});
test('first password change rejects reuse and revokes all sessions',async()=>{await init({pending:true});assert.equal((await call('changePassword',{oldPassword:'Original#Password2026',newPassword:'Original#Password2026'})).statusCode,400);const r=await call('changePassword',{oldPassword:'Original#Password2026',newPassword:'Replacement#Password2026'});assert.equal(r.statusCode,200);assert.equal(user.must_change,false);assert.equal(deletedSessions,1);assert.match(r.headers['Set-Cookie'],/Max-Age=0/);});
test('login requires TOTP; remember controls HttpOnly persistent cookie; replay blocked',async()=>{const secret=await init();const p={username:'admin',password:'Original#Password2026',totp:totp(secret),remember:true};const r=await call('login',p);assert.equal(r.statusCode,200);assert.match(r.headers['Set-Cookie'],/Secure; HttpOnly; SameSite=Strict; Max-Age=604800/);assert(!r.body.data.user.password_hash);assert(!r.body.data.token.includes('session-token'));assert.equal((await call('login',p)).statusCode,401);const next=await init();const no=await call('login',{...p,totp:totp(next),remember:false});assert.equal(no.statusCode,200);assert(!no.headers['Set-Cookie'].includes('Max-Age'));});
test('newly provisioned account cookie is short lived and stays pending',async()=>{const secret=await init({pending:true});const r=await call('login',{username:'admin',password:'Original#Password2026',totp:totp(secret),remember:true});assert.equal(r.statusCode,200);assert.match(r.headers['Set-Cookie'],/Max-Age=900/);assert.equal(session.pending,true);});
