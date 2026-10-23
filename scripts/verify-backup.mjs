import fs from 'node:fs/promises';import {decrypt} from '../lib/security.mjs';
const backup=decrypt(await fs.readFile(process.argv[2],'utf8'),'student-care-backup-v1','BACKUP_KEY');
if(backup.format!==1||!Array.isArray(backup.tables.sc_users)||backup.tables.sc_archive.length!==1)throw Error('Backup format invalid');
const a=decrypt(backup.tables.sc_archive[0].cipher,'archive');
console.log('Giải mã được. Học kỳ:',Object.keys(a.terms).length,'; tài khoản:',backup.tables.sc_users.length,'; thời điểm:',backup.at);
