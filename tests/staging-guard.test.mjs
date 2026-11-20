import test from 'node:test';import assert from 'node:assert/strict';import {stagingConfig,stagingActionAllowed,stagingRequestProblem} from '../lib/staging-guard.mjs';
const base={productionUrl:'postgresql://u:p@prod.example/db?sslmode=require',stagingUrl:'postgresql://u:p@stage.example/db?sslmode=require',codespace:'test-space',domain:'app.github.dev'};
test('staging runner derives private-preview origin and rejects same pooler endpoint, disabled TLS or missing Codespaces',()=>{
 assert.equal(stagingConfig(base).origin,'https://test-space-4173.app.github.dev');
 for(const patch of [{stagingUrl:'postgresql://u:p@prod-pooler.example/db?sslmode=require'},{stagingUrl:'postgresql://u:p@stage.example/db?sslmode=disable'},{codespace:''},{domain:'evil/x'}])assert.throws(()=>stagingConfig({...base,...patch}));
});
test('staging never enables cron/backup/account management/deletion routes but retains authentication and receipt saves',()=>{
 for(const a of ['backup','repairMirror','createUser','resetUser','toggleUser','updateUser','deleteStudents','previewStudentDeletion'])assert.equal(stagingActionAllowed(a),false);
 for(const a of ['login','resume','load','sync','save','artifact','logout','health'])assert.equal(stagingActionAllowed(a),true);
});

test('staging diagnostics accept only exact application origin and marker, never log body/cookies/credentials or normalize untrusted origins',()=>{
 const expected='https://test-space-4173.app.github.dev',req={headers:{origin:expected,'x-sc-request':'1',cookie:'PRIVATE_COOKIE'},body:{password:'PRIVATE_PASSWORD',totp:'PRIVATE_TOTP'}};
 assert.equal(stagingRequestProblem(req,expected),null);
 req.headers.origin='http://localhost:4173';let p=stagingRequestProblem(req,expected);assert.equal(p.code,'STAGING_ORIGIN_MISMATCH');assert.equal(p.receivedOrigin,'http://localhost:4173');assert(!/PRIVATE/.test(JSON.stringify(p)));
 req.headers.origin=expected+'/';assert.equal(stagingRequestProblem(req,expected).code,'STAGING_ORIGIN_MISMATCH');
 req.headers.origin=expected;delete req.headers['x-sc-request'];assert.equal(stagingRequestProblem(req,expected).code,'STAGING_REQUEST_MARKER_MISSING');
 req.headers.origin='https://user:PRIVATE_PASSWORD@different.example/path?secret=PRIVATE_TOTP';p=stagingRequestProblem(req,expected);assert.equal(p.receivedOrigin,'https://different.example');assert(!/PRIVATE/.test(JSON.stringify(p)));
});

test('trusted Codespaces proxy adaptation rejects other origins, missing Referer, marker or cross-site',()=>{
 const e='https://test-space-4173.app.github.dev',h={origin:'http://localhost:4173',referer:e+'/', 'x-sc-request':'1','sec-fetch-site':'same-origin'};
 assert.equal(stagingRequestProblem({headers:h},e),null);
 for(const patch of [{referer:undefined},{referer:'https://evil.example/'},{referer:e+'.evil.example/'},{origin:'http://127.0.0.1:4173'},{'x-sc-request':undefined},{'sec-fetch-site':'cross-site'}])assert.notEqual(stagingRequestProblem({headers:{...h,...patch}},e),null);
 assert.notEqual(stagingRequestProblem({headers:h},'https://production.example'),null);
});
