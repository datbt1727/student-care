import fs from 'node:fs/promises';import {decrypt} from '../lib/security.mjs';import {validateSnapshot} from '../lib/snapshot.mjs';
const backup=validateSnapshot(decrypt(await fs.readFile(process.argv[2],'utf8'),'student-care-backup-v1','BACKUP_KEY'));
const a=decrypt(backup.tables.sc_archive[0].cipher,'archive');
console.log('Đã kiểm tra cả hai lớp mã hóa, cấu trúc hồ sơ, tài khoản và Authenticator. Học kỳ:',Object.keys(a.terms).length,'; tài khoản:',backup.tables.sc_users.length,'; revision:',backup.tables.sc_archive[0].revision,'; thời điểm:',backup.at);
