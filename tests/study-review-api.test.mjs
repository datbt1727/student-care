import test from 'node:test';import assert from 'node:assert/strict';import pg from 'pg';import {randomBytes} from 'node:crypto';import {encrypt,digest} from '../lib/security.mjs';
process.env.DATA_KEY=randomBytes(32).toString('base64');process.env.RATE_KEY=randomBytes(32).toString('base64');process.env.APP_ORIGIN='https://study.test';
let role='admin',sqls=[];
const a={version:2,active:'2026-FALL',terms:{'2026-FALL':{students:[{id:'S',name:'Test'}],records:[{id:'S',subject:'VOG112',group:'G',slots:20,absent:1,date:'2026-11-18',start:'2026-09-01'},{id:'S',subject:'VOG112',group:'G',slots:20,absent:2,date:'2026-11-19',start:'2026-11-01'}]}}};
const cipher=encrypt(a,'archive');
async function query(sql,p=[]){sqls.push(sql);
 if(/^(BEGIN|COMMIT|ROLLBACK|SET TRANSACTION READ ONLY)/.test(sql))return {rows:[]};
 if(sql.includes('INSERT INTO sc_rate'))return {rows:[{n:1}],rowCount:1};
 if(sql.includes('SELECT s.*,u.'))return {rows:[{username:'admin',role,active:true,must_change:false,pending:false,csrf:'csrf'}]};
 if(sql.includes('UPDATE sc_sessions SET last_seen'))return {rows:[],rowCount:1};
 if(sql==='SELECT revision,cipher FROM sc_archive WHERE id=1')return {rows:[{revision:89,cipher}]};
 throw Error('Unexpected query');
}
pg.Pool.prototype.query=query;pg.Pool.prototype.connect=async()=>({query,release(){}});
const {default:handler}=await import('../api/rpc.mjs');
async function call(p={},headers={}){const req={method:'POST',headers:{origin:process.env.APP_ORIGIN,'content-type':'application/json','x-sc-request':'1','x-sc-csrf':'csrf',cookie:'__Host-sc=token',...headers},body:{action:'studyReview',p:{revision:89,termId:'2026-FALL',...p}}},res={statusCode:200,setHeader(){},status(n){this.statusCode=n;return this},json(v){this.body=v;return this}};await handler(req,res);return res;}
test('authenticated admin preview reads exact revision in readonly transaction; no archive write',async()=>{
 sqls=[];role='admin';const r=await call();assert.equal(r.statusCode,200,JSON.stringify(r.body));assert.equal(r.body.data.readOnly,true);assert.equal(r.body.data.totalCases,1);assert(sqls.includes('SET TRANSACTION READ ONLY'));assert(!sqls.some(s=>/UPDATE sc_archive|INSERT INTO sc_audit|DELETE FROM sc_archive/.test(s)));assert(!JSON.stringify(r.body).includes(cipher));
});
test('preview rejects staff, bad CSRF, stale revision, unknown term, invalid paging and write payload',async()=>{
 role='staff';assert.equal((await call()).statusCode,403);role='admin';const csrfError=await call({}, {'x-sc-csrf':'bad'});assert.equal(csrfError.statusCode,403);assert.equal(csrfError.body.code,'CSRF_MISMATCH');assert.equal((await call({}, {'x-sc-csrf':''})).body.code,'CSRF_MISSING');assert.equal((await call({revision:88})).statusCode,409);assert.equal((await call({termId:'missing'})).statusCode,400);assert.equal((await call({limit:101})).statusCode,400);assert.equal((await call({apply:true})).statusCode,400);
});
