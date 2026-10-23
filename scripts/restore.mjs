import fs from 'node:fs/promises';import pg from 'pg';import {decrypt} from '../lib/security.mjs';import {restoreIntoEmptyDatabase} from '../lib/restore.mjs';
if(process.argv[3]!=='RESTORE-INTO-ISOLATED-DATABASE')throw Error('Chỉ khôi phục thử trên DB tách biệt: node scripts/restore.mjs file.enc RESTORE-INTO-ISOLATED-DATABASE');
const snapshot=decrypt(await fs.readFile(process.argv[2],'utf8'),'student-care-backup-v1','BACKUP_KEY');
const c=new pg.Client({connectionString:process.env.MIGRATION_DATABASE_URL});await c.connect();
try{await restoreIntoEmptyDatabase(c,snapshot);console.log('Đã phục hồi vào DB trống. Phiên không phục hồi; mọi tài khoản phải đổi mật khẩu.');}finally{await c.end();}
