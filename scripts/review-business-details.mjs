import {verifiedTls} from '../lib/verified-tls.mjs';
import fs from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {createHmac,createHash} from 'node:crypto';
import {db,transaction} from '../lib/db.mjs';
import {decrypt,key} from '../lib/security.mjs';
import details from '../lib/business-details.cjs';
try{
 const baseline=parseEnv(await fs.readFile('.env','utf8'));
 const host=value=>new URL(value).hostname.toLowerCase().replace('-pooler.','.');
 if(!baseline.DATABASE_URL||!process.env.DATABASE_URL||host(baseline.DATABASE_URL)===host(process.env.DATABASE_URL))throw Object.assign(Error(),{safeCode:'TARGET_NOT_SEPARATE'});
 const {row,tls}=await transaction(async c=>{await c.query('SET TRANSACTION READ ONLY');const tls=verifiedTls(c,new URL(process.env.DATABASE_URL).hostname);return {tls,row:(await c.query('SELECT revision,cipher FROM sc_archive WHERE id=1')).rows[0]};});
 if(!row)throw Object.assign(Error(),{safeCode:'EMPTY_ARCHIVE'});
 const secret=key('DATA_KEY'),token=value=>'ref-'+createHmac('sha256',secret).update('business-review-v2:'+value).digest('hex').slice(0,16);
 console.log(JSON.stringify({targetEndpointDifferentFromLocalProduction:true,databaseTls:tls,revision:row.revision,encryptedArchiveSha256:createHash('sha256').update(row.cipher).digest('hex'),...details(decrypt(row.cipher,'archive'),token)},null,2));
}catch(e){console.error(JSON.stringify({ok:false,code:e.safeCode||'REVIEW_FAILED',message:'Chưa hoàn tất kiểm tra. Không sửa dữ liệu. Không gửi URL/khóa hoặc nội dung .env; chỉ gửi mã lỗi này.'}));process.exitCode=1;}
finally{await db().end();}
