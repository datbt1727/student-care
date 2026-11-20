import fs from 'node:fs/promises';import {parseEnv} from 'node:util';import {createHash} from 'node:crypto';
import {db,transaction} from '../lib/db.mjs';import {decrypt} from '../lib/security.mjs';import {verifiedTls} from '../lib/verified-tls.mjs';import compare from '../lib/preservation.cjs';
const file='.staging-baseline.enc.json',hash=s=>createHash('sha256').update(s).digest('hex');
try{
 const host=v=>new URL(v).hostname.toLowerCase().replace('-pooler.','.'),prod=parseEnv(await fs.readFile('.env','utf8'));
 if(!prod.DATABASE_URL||host(prod.DATABASE_URL)===host(process.env.DATABASE_URL))throw Error('TARGET');
 const mode=process.argv[2];if(!['capture','compare'].includes(mode))throw Error('MODE');
 const row=await transaction(async c=>{await c.query('SET TRANSACTION READ ONLY');verifiedTls(c,new URL(process.env.DATABASE_URL).hostname);return (await c.query('SELECT revision,cipher FROM sc_archive WHERE id=1')).rows[0];});if(!row)throw Error('EMPTY');
 const current=decrypt(row.cipher,'archive');
 if(mode==='capture'){await fs.writeFile(file,JSON.stringify({format:1,revision:row.revision,cipherSha256:hash(row.cipher),cipher:row.cipher}),{flag:'wx',mode:0o600});console.log(JSON.stringify({ok:true,readOnly:true,baselineSaved:true,revision:row.revision,message:'Đã lưu bản gốc mã hóa tại Codespaces. Không gửi hoặc commit file .staging-baseline.enc.json.'}));}
 else{const base=JSON.parse(await fs.readFile(file,'utf8'));if(base.format!==1||hash(base.cipher)!==base.cipherSha256)throw Error('CHECKSUM');console.log(JSON.stringify({readOnly:true,baselineRevision:base.revision,currentRevision:row.revision,...compare(decrypt(base.cipher,'archive'),current)},null,2));}
}catch(e){console.error(JSON.stringify({ok:false,code:e.code==='EEXIST'?'BASELINE_ALREADY_EXISTS':'PRESERVATION_CHECK_FAILED',message:'Dừng và kiểm tra cấu hình staging hoặc bản gốc. Không ghi đè bản gốc, không sửa database. Không gửi khóa hay backup.'}));process.exitCode=1;}
finally{await db().end();}
