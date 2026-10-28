import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../web/source.html',import.meta.url),'utf8');
const code=source.split('/* SC CONNECTION START */')[1].split('/* SC CONNECTION END */')[0];
const create=vm.runInNewContext(code+';createStudentConnection',{TextEncoder,AbortSignal,setTimeout,CompressionStream,Response,Blob,btoa});
const ok={ok:true,data:{revision:2}},reply=(body,status=200)=>({status,json:async()=>body});
test('lost save response retries identical request body and CSRF, never invents a confirmation',async()=>{const calls=[],wait=[];const client=create({fetcher:async(url,options)=>{calls.push(options);if(calls.length===1)throw TypeError('response lost');return reply(ok)},pause:async n=>wait.push(n)});const got=await client.request('save',{requestId:'save-idempotent-001',revision:1,json:'{"test":"value"}'},'csrf');assert.equal(got,ok);assert.equal(calls.length,2);assert.equal(calls[0].body,calls[1].body);assert.equal(calls[1].headers['X-SC-CSRF'],'csrf');assert.equal(wait[0],1000);});
test('offline and timeouts stop after three attempts and retain a specific error',async()=>{for(const timed of [false,true]){let calls=0;const client=create({fetcher:async()=>{calls++;const e=timed?Object.assign(Error('timeout'),{name:'TimeoutError',code:23}):TypeError('offline');throw e},pause:async()=>{}});await assert.rejects(()=>client.request('save',{requestId:'save-request-002'},'csrf'),e=>e.code===(timed?'TIMEOUT':'NETWORK')&&!e.message.includes('Không kết nối được máy chủ: Không'));assert.equal(calls,3);}});
test('transient HTML/server faults retry but conflict, session, permission and rate limits do not',async()=>{let calls=0;const c=create({fetcher:async()=>{calls++;return calls===1?{status:502,json:async()=>{throw Error('HTML')}}:reply(ok)},pause:async()=>{}});assert.equal(await c.request('load',{},'csrf'),ok);assert.equal(calls,2);for(const code of ['409','429','SESSION','403']){calls=0;const x=create({fetcher:async()=>{calls++;return reply({ok:false,code,error:'failure'},code==='SESSION'?401:Number(code))},pause:async()=>{}});assert.equal((await x.request('save',{requestId:'save-request-003'},'csrf')).code,code);assert.equal(calls,1);}});
test('login, account changes and other writes are never automatically resubmitted',async()=>{for(const action of ['login','createUser','changePassword','deleteStudents','backup']){let calls=0;const c=create({fetcher:async()=>{calls++;throw TypeError('lost')},pause:async()=>{}});await assert.rejects(()=>c.request(action,{requestId:'unused-request-001'},'csrf'));assert.equal(calls,1);}});
test('oversized payload is rejected before network and HTML 413 is reported without retry',async()=>{let calls=0;const c=create({fetcher:async()=>{calls++;return {status:413,json:async()=>{throw Error('HTML')}}},pause:async()=>{}});await assert.rejects(()=>c.request('createUser',{requestId:'save-request-004',json:'x'.repeat(3500001)},'csrf'),e=>e.code==='413');assert.equal(calls,0);await assert.rejects(()=>c.request('save',{requestId:'save-request-004'},'csrf'),e=>e.code==='413');assert.equal(calls,1);});

test('large save is compressed once; retry has identical bytes and server restores exact receipt input',async()=>{
 const {unpackSavePayload}=await import('../lib/save-payload.mjs');const calls=[];
 const json=JSON.stringify({rows:Array.from({length:40000},(_,i)=>({id:'SV'+i,name:'Sinh viên kiểm tra',date:'2026-10-28',subject:'TEST101',absent:2,slots:10}))});
 assert(Buffer.byteLength(json)>3500000);
 const client=create({fetcher:async(url,opt)=>{calls.push(opt.body);if(calls.length===1)throw TypeError('lost');return reply(ok)},pause:async()=>{}});
 const original={requestId:'large-save-001',revision:7,json,restore:false};
 await client.request('save',original,'csrf');
 assert.equal(calls.length,2);assert.equal(calls[0],calls[1]);assert(Buffer.byteLength(calls[0])<3500000);
 const packed=JSON.parse(calls[0]).p;assert.equal(packed.json,undefined);assert.equal(unpackSavePayload(packed).json,json);
 assert.equal(original.json,json);
});
