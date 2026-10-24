// Works without Neon or the website. Saves only verified encrypted bytes, never plaintext.
import fs from 'node:fs/promises';
import {GetObjectCommand} from '@aws-sdk/client-s3';
import {s3} from '../lib/backup.mjs';
import {decrypt,digest} from '../lib/security.mjs';
import {validateSnapshot} from '../lib/snapshot.mjs';
const [objectKey,destination]=process.argv.slice(2);
if(!objectKey?.startsWith('daily/')||!destination)throw Error('Dùng: node --env-file=.env scripts/fetch-backup.mjs daily/.../file.json.enc /vi-tri-luu/backup.json.enc');
const result=await s3().send(new GetObjectCommand({Bucket:process.env.S3_BUCKET,Key:objectKey}));
const bytes=await result.Body.transformToString();
if(result.Metadata?.sha256&&result.Metadata.sha256!==digest(bytes))throw Error('Checksum mismatch; refusing to save.');
const snapshot=validateSnapshot(decrypt(bytes,'student-care-backup-v1','BACKUP_KEY'));
await fs.writeFile(destination,bytes,{flag:'wx',mode:0o600});
console.log('Đã tải bản mã hóa và xác minh khả năng đọc dữ liệu. Revision:',snapshot.tables.sc_archive[0].revision,'; thời điểm:',snapshot.at,'; không ghi đè file đã tồn tại.');
