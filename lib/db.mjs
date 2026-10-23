import pg from 'pg';
let pool;
export function db(){return pool??=new pg.Pool({connectionString:process.env.DATABASE_URL,max:3,connectionTimeoutMillis:8000,idleTimeoutMillis:10000,statement_timeout:15000,query_timeout:18000,application_name:'student-care'});}
export async function transaction(fn){const c=await db().connect();try{await c.query('BEGIN');const r=await fn(c);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
