import test,{after} from 'node:test';import assert from 'node:assert/strict';import pg from 'pg';import fs from 'node:fs/promises';import {randomBytes} from 'node:crypto';import {encrypt,decrypt,digest} from '../lib/security.mjs';
process.env.DATA_KEY=randomBytes(32).toString('base64');process.env.RATE_KEY=randomBytes(32).toString('base64');process.env.APP_ORIGIN='https://fixture-4173.app.github.dev';process.env.SC_STUDY_DECISIONS='staging';
const original={version:2,active:'T',terms:{T:{students:[{id:'S',name:'Test'}],records:[{id:'S',subject:'AEG116',group:'OLD',part:1,date:'2026-10-01',slots:40,absent:10},{id:'S',subject:'AEG116',group:'NEW',part:2,date:'2026-11-18',slots:40,absent:2}],notes:{S:'Keep'},dailyFollow:{},importFiles:[]}}};
let revision=89,cipher=encrypt(original,'archive'),requests=new Map(),role='admin',audit=[],updates=0,snapshot;
const fixtureCheckpoints=[];after(async()=>{for(const url of fixtureCheckpoints)await fs.unlink(url);});
async function query(sql,p=[]){
 if(sql==='BEGIN'){snapshot={revision,cipher,requests:new Map(requests),audit:[...audit],updates};return {rows:[]};}
 if(sql==='ROLLBACK'){({revision,cipher,requests,audit,updates}=snapshot);return {rows:[]};}
 if(sql==='COMMIT'||sql==='SET TRANSACTION READ ONLY')return {rows:[]};
 if(sql.includes('INSERT INTO sc_rate'))return {rows:[{n:1}],rowCount:1};
 if(sql.includes('SELECT s.*,u.'))return {rows:[{username:'admin',role,password_hash:'same',active:true,must_change:false,pending:false,csrf:'csrf',permissions:{}}]};
 if(sql.includes('UPDATE sc_sessions SET last_seen'))return {rows:[],rowCount:1};
 if(sql.includes('SELECT username,active,must_change,role,password_hash,permissions'))return {rows:[{username:'admin',role,password_hash:'same',active:true,must_change:false,permissions:{}}]};
 if(sql.includes('SELECT token_hash FROM sc_sessions'))return {rows:[{token_hash:'test'}]};
 if(sql.startsWith('SELECT revision,cipher FROM sc_archive'))return {rows:[{revision,cipher}]};
 if(sql.startsWith('SELECT revision,request_hash FROM sc_requests'))return {rows:requests.has(p[1])?[requests.get(p[1])]:[]};
 if(sql.startsWith('UPDATE sc_archive')){assert.equal(p[1],revision);const url=new URL('../.staging-study-checkpoints/'+revision+'-'+digest(cipher)+'.enc.json',import.meta.url),saved=JSON.parse(await fs.readFile(url,'utf8'));assert.equal(saved.cipher,cipher,'encrypted checkpoint must exist before any archive write');assert.equal((await fs.stat(url)).mode&0o777,0o600);fixtureCheckpoints.push(url);cipher=p[0];revision++;updates++;return {rows:[{revision}],rowCount:1};}
 if(sql.startsWith('INSERT INTO sc_requests')){requests.set(p[1],{revision:p[2],request_hash:p[3]});return {rows:[],rowCount:1};}
 if(sql.startsWith('INSERT INTO sc_audit')){audit.push(p);return {rows:[],rowCount:1};}
 throw Error('Unexpected query: '+sql);
}
pg.Pool.prototype.query=query;pg.Pool.prototype.connect=async()=>({query,release(){}});const {default:handler}=await import('../api/rpc.mjs');
async function call(action,p,csrf='csrf'){const req={method:'POST',headers:{origin:process.env.APP_ORIGIN,'content-type':'application/json','x-sc-request':'1','x-sc-csrf':csrf,cookie:'__Host-sc=token'},body:{action,p}},res={statusCode:200,setHeader(){},status(n){this.statusCode=n;return this},json(v){this.body=v;return this}};await handler(req,res);return res;}
const choice={studentId:'S',subject:'AEG116',kind:'retake',source:{group:'OLD',part:1},target:{group:'NEW',part:2}};
let plan,args;
test('preview readonly and commit with live actor check, CAS, encrypted metadata and receipt',async()=>{
 let r=await call('previewStudyDecision',{revision,termId:'T',decision:choice});assert.equal(r.statusCode,200,JSON.stringify(r.body));plan=r.body.data;assert.equal(updates,0);args={requestId:'request-123',planToken:plan.planToken,confirmation:plan.decisionId};r=await call('commitStudyDecision',args);assert.equal(r.statusCode,200,JSON.stringify(r.body));assert.equal(r.body.data.receipt.committed,true);assert.equal(revision,90);assert.equal(updates,1);const current=decrypt(cipher,'archive');assert.deepEqual(current.terms.T.records,original.terms.T.records);assert.deepEqual(current.terms.T.notes,original.terms.T.notes);assert.equal(current.terms.T.studyDecisions.length,1);assert.equal(audit.length,1);
});
test('lost response retry returns original receipt without another save; stale and reused request IDs fail closed',async()=>{
 const r=await call('commitStudyDecision',args);assert.equal(r.statusCode,200);assert.equal(r.body.data.revision,90);assert.equal(updates,1);assert.equal((await call('commitStudyDecision',{...args,requestId:'request-456'})).statusCode,409);assert.equal((await call('previewStudyDecision',{revision:89,termId:'T',decision:choice})).statusCode,409);assert.equal(updates,1);
});
test('staff, CSRF and production cannot write study decisions',async()=>{
 role='staff';assert.equal((await call('commitStudyDecision',args)).statusCode,403);role='admin';assert.equal((await call('commitStudyDecision',args,'wrong')).statusCode,403);delete process.env.SC_STUDY_DECISIONS;assert.equal((await call('commitStudyDecision',args)).statusCode,403);process.env.SC_STUDY_DECISIONS='staging';assert.equal(updates,1);
});
test('controlled cancellation preserves records and history and is idempotent',async()=>{
 const p={revision:90,termId:'T',decisionId:plan.decisionId,confirmation:plan.decisionId,requestId:'cancel-123'};const r=await call('cancelStudyDecision',p);assert.equal(r.statusCode,200,JSON.stringify(r.body));assert.equal(revision,91);const current=decrypt(cipher,'archive');assert.equal(current.terms.T.studyDecisions[0].status,'cancelled');assert.deepEqual(current.terms.T.records,original.terms.T.records);assert.equal((await call('cancelStudyDecision',p)).statusCode,200);assert.equal(updates,2);
});
