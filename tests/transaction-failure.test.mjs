import test from 'node:test';import assert from 'node:assert/strict';import pg from 'pg';import {transaction} from '../lib/db.mjs';
test('failed rollback preserves the original save failure and discards a broken connection',async()=>{
 const original=pg.Pool.prototype.connect;let released;
 pg.Pool.prototype.connect=async()=>({query:async sql=>{if(sql==='ROLLBACK')throw Error('connection lost');},release:broken=>released=broken});
 const initial=Object.assign(Error('save uncertain'),{code:'CONNECTION_LOST'});
 try{await assert.rejects(transaction(async()=>{throw initial}),e=>e===initial);assert.equal(released,true);}finally{pg.Pool.prototype.connect=original;}
});
test('successful transaction commits once and releases a reusable connection',async()=>{
 const original=pg.Pool.prototype.connect;const calls=[];let released;
 pg.Pool.prototype.connect=async()=>({query:async sql=>calls.push(sql),release:broken=>released=broken});
 try{assert.equal(await transaction(async()=>7),7);assert.deepEqual(calls,['BEGIN','COMMIT']);assert.equal(released,false);}finally{pg.Pool.prototype.connect=original;}
});
