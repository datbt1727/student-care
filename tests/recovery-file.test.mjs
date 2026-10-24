import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import vm from 'node:vm';import {webcrypto} from 'node:crypto';
const ctx={crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary')};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(await fs.readFile(new URL('../web/modules/recovery.js',import.meta.url),'utf8'),ctx);
test('portable recovery copy encrypts data independently; wrong passwords, tampering and invalid KDF are rejected',async()=>{
 const archive={version:2,active:'2026-FALL',terms:{'2026-FALL':{students:[{id:'SV001',name:'Sinh viên riêng tư'}],records:[]}}};const password='Mat-khau-rieng#2026';
 const e=await ctx.StudentRecovery.seal(archive,password);assert(!JSON.stringify(e).includes('Sinh viên'));assert(!JSON.stringify(e).includes(password));assert.equal(JSON.stringify(await ctx.StudentRecovery.unseal(e,password)),JSON.stringify(archive));
 const next=await ctx.StudentRecovery.seal(archive,password);assert.notEqual(e.iv,next.iv);assert.notEqual(e.salt,next.salt);assert.notEqual(e.data,next.data);
 await assert.rejects(()=>ctx.StudentRecovery.unseal(e,'Wrong-password#2026'),/không đúng/);
 await assert.rejects(()=>ctx.StudentRecovery.unseal({...e,data:e.data.slice(0,-4)+'AAAA'},password),/không đúng/);
 await assert.rejects(()=>ctx.StudentRecovery.unseal({...e,iterations:1},password),/Định dạng/);
 await assert.rejects(()=>ctx.StudentRecovery.seal(archive,'short'),/12/);
});
