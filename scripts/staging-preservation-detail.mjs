import fs from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {createHash} from 'node:crypto';
import {db,transaction} from '../lib/db.mjs';
import {decrypt} from '../lib/security.mjs';
import {verifiedTls} from '../lib/verified-tls.mjs';
import {stagingConfig} from '../lib/staging-guard.mjs';
import detail from '../lib/preservation-detail.cjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
async function read(file){const x=JSON.parse(await fs.readFile(file,'utf8'));if(x.format!==1||x.revision!==88||hash(x.cipher)!==x.cipherSha256)throw Error('CHECKPOINT_INVALID');return decrypt(x.cipher,'archive');}
try{
 const prod=parseEnv(await fs.readFile('.env','utf8'));
 stagingConfig({productionUrl:prod.DATABASE_URL,stagingUrl:process.env.DATABASE_URL,codespace:process.env.CODESPACE_NAME,domain:process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN});
 const baseline=await read('.staging-baseline.enc.json'),checkpoint=await read('.staging-aeg-before-88.enc.json');
 const row=await transaction(async c=>{await c.query('SET TRANSACTION READ ONLY');verifiedTls(c,new URL(process.env.DATABASE_URL).hostname);return (await c.query('SELECT revision,cipher FROM sc_archive WHERE id=1')).rows[0];});
 if(!row)throw Error('EMPTY');
 const result=detail(baseline,checkpoint,decrypt(row.cipher,'archive'));
 console.log(JSON.stringify({baselineRevision:88,currentRevision:row.revision,...result},null,2));if(!result.ok)process.exitCode=1;
}catch(e){console.error(JSON.stringify({ok:false,readOnly:true,code:['BASELINE_CHECKPOINT_MISMATCH','CHECKPOINT_INVALID'].includes(e.message)?e.message:'DETAIL_CHECK_STOPPED',message:'Chưa hoàn tất đối chiếu; không sửa database. Giữ baseline/checkpoint. Không gửi .env, khóa hoặc dữ liệu cá nhân.'}));process.exitCode=1;}
finally{await db().end();}
