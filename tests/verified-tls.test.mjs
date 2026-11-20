import test from 'node:test';import assert from 'node:assert/strict';import {verifiedTls} from '../lib/verified-tls.mjs';
const client=(overrides={})=>({connection:{stream:{encrypted:true,authorized:true,getPeerCertificate:()=>({subjectaltname:'DNS:staging.example'}),...overrides}}});
test('verified client-to-pooler TLS succeeds without relying on the pooler-to-Postgres leg',()=>{assert.equal(verifiedTls(client(),'staging.example'),true)});
test('plain transport, untrusted certificate, absent peer certificate and wrong hostname fail closed',()=>{
 for(const c of [client({encrypted:false}),client({authorized:false}),client({authorizationError:'UNTRUSTED'}),client({getPeerCertificate:()=>({})}),{},client({getPeerCertificate:()=>({subjectaltname:'DNS:other.example'})})])assert.throws(()=>verifiedTls(c,'staging.example'),e=>e.safeCode==='TLS_NOT_CONFIRMED');
});
