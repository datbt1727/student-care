import test from 'node:test';import assert from 'node:assert/strict';import {createWorkQueue} from '../lib/work-queue.mjs';
test('concurrent auth work queues within bounds, releases failures and never exceeds memory concurrency',async()=>{
 const run=createWorkQueue({concurrency:2,maxWaiting:100,timeoutMs:2000});let active=0,peak=0,done=0;
 const results=await Promise.allSettled(Array.from({length:100},(_,i)=>run(async()=>{active++;peak=Math.max(peak,active);try{await new Promise(r=>setTimeout(r,1));if(i===7)throw Error('test');done++;return i;}finally{active--;}})));
 assert.equal(peak,2);assert.equal(done,99);assert.equal(results.filter(x=>x.status==='rejected').length,1);assert.equal(await run(()=>42),42);
});
test('overload and expired wait fail explicitly without executing discarded work',async()=>{
 const run=createWorkQueue({concurrency:1,maxWaiting:1,timeoutMs:15});let release,discarded=false;
 const first=run(()=>new Promise(r=>release=r));await new Promise(r=>setTimeout(r,0));
 const second=run(()=>{discarded=true;});const expired=assert.rejects(second,e=>e.status===429&&e.retryAfter===5);
 await assert.rejects(run(()=>0),e=>e.status===429);await expired;release();await first;assert.equal(discarded,false);assert.equal(await run(()=>3),3);
});
