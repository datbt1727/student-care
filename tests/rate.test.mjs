import test from 'node:test';import assert from 'node:assert/strict';import pg from 'pg';import {PGlite} from '@electric-sql/pglite';
const sql=new PGlite();pg.Pool.prototype.query=async(text,params)=>{const r=await sql.query(text,params);return {rows:r.rows,rowCount:r.affectedRows}};
const {rate}=await import('../lib/rate.mjs');
test('rate windows stay fixed, report retry time, reset after expiry and remain atomic',async()=>{
 try{
 await sql.exec('CREATE TABLE sc_rate(bucket text PRIMARY KEY,n integer NOT NULL,until_at timestamptz NOT NULL)');
 await sql.query("INSERT INTO sc_rate VALUES('blocked',8,now()+interval '50 seconds')");
 const before=(await sql.query("SELECT until_at FROM sc_rate WHERE bucket='blocked'")).rows[0].until_at;
 for(let i=0;i<2;i++)await assert.rejects(()=>rate('blocked',8,900),e=>e.status===429&&e.retryAfter>0&&e.retryAfter<=50);
 const after=(await sql.query("SELECT until_at FROM sc_rate WHERE bucket='blocked'")).rows[0].until_at;assert.equal(+before,+after);
 await sql.query("UPDATE sc_rate SET until_at=now()-interval '1 second' WHERE bucket='blocked'");await rate('blocked',8,900);
 assert.equal((await sql.query("SELECT n FROM sc_rate WHERE bucket='blocked'")).rows[0].n,1);
 const results=await Promise.allSettled(Array.from({length:12},()=>rate('concurrent',3,60)));
 assert.equal(results.filter(x=>x.status==='fulfilled').length,3);assert.equal(results.filter(x=>x.status==='rejected'&&x.reason.status===429).length,9);
 }finally{await sql.close()}
});
