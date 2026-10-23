import pg from 'pg';import fs from 'node:fs/promises';import {opaque} from '../lib/security.mjs';
const c=new pg.Client({connectionString:process.env.MIGRATION_DATABASE_URL});await c.connect();
try{
 const password=opaque()+'!';
 // Only a generated base64url password plus ! is interpolated into DDL; no user text.
 if(!/^[A-Za-z0-9_!-]+$/.test(password))throw Error('Invalid generated password');
 await c.query('BEGIN');
 await c.query("CREATE ROLE studentcare_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD '"+password+"'");
 await c.query(await fs.readFile(new URL('./grants.sql',import.meta.url),'utf8'));
 await c.query('COMMIT');
 console.log('Role runtime được tạo bằng SQL, không qua Add role của Neon Console.');
 console.log('Chỉ hiện một lần — lưu vào trình quản lý bí mật:');
 console.log('username: studentcare_app\npassword: '+password);
 console.log('Dùng trong DATABASE_URL pooled; không dùng mật khẩu owner trên Vercel.');
}catch(e){await c.query('ROLLBACK');throw e;}finally{await c.end();}
