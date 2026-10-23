import fs from 'node:fs/promises';
import pg from 'pg';
const c=new pg.Client({connectionString:process.env.MIGRATION_DATABASE_URL});await c.connect();
try{await c.query(await fs.readFile(new URL('../schema.sql',import.meta.url),'utf8'));console.log('Đã tạo cấu trúc dữ liệu.');}finally{await c.end();}
