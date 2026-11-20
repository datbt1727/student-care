// Explicit staging-only metadata correction. No schema changes.
import fs from 'node:fs/promises';import {parseEnv} from 'node:util';import {createHash} from 'node:crypto';
import {db,transaction} from '../lib/db.mjs';import {decrypt,encrypt} from '../lib/security.mjs';import {verifiedTls} from '../lib/verified-tls.mjs';import {stagingConfig} from '../lib/staging-guard.mjs';import correction from '../lib/aeg-part-correction.cjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
try{
 const prod=parseEnv(await fs.readFile('.env','utf8'));
 stagingConfig({productionUrl:prod.DATABASE_URL,stagingUrl:process.env.DATABASE_URL,codespace:process.env.CODESPACE_NAME,domain:process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN});
 const mode=process.argv[2]||'preview';if(!['preview','apply'].includes(mode))throw Error('MODE');
 const result=await transaction(async c=>{
  if(mode==='preview')await c.query('SET TRANSACTION READ ONLY');
  verifiedTls(c,new URL(process.env.DATABASE_URL).hostname);
  const row=(await c.query('SELECT revision,cipher FROM sc_archive WHERE id=1'+(mode==='apply'?' FOR UPDATE':''))).rows[0];if(!row)throw Error('EMPTY');
  const before=decrypt(row.cipher,'archive'),p=correction.plan(before);
  if(mode==='preview')return {ok:true,readOnly:true,revision:row.revision,...p.summary};
  if(process.argv[3]!==String(row.revision))throw Error('REVISION_MISMATCH');
  if(!p.summary.changed)return {ok:true,changed:false,revision:row.revision,...p.summary};
  const file='.staging-aeg-before-'+row.revision+'.enc.json';
  await fs.writeFile(file,JSON.stringify({format:1,revision:row.revision,cipherSha256:hash(row.cipher),cipher:row.cipher}),{flag:'wx',mode:0o600});
  const update=await c.query('UPDATE sc_archive SET cipher=$1,revision=revision+1,updated_at=now() WHERE id=1 AND revision=$2 RETURNING revision',[encrypt(p.archive,'archive'),row.revision]);if(update.rowCount!==1)throw Error('REVISION_MISMATCH');
  await c.query('INSERT INTO sc_audit(actor,action,detail) VALUES($1,$2,$3)',['staging-reviewed-correction','aeg_part_corrected',JSON.stringify(p.summary)]);
  return {ok:true,readOnly:false,revision:update.rows[0].revision,encryptedCheckpoint:file,...p.summary};
 });console.log(JSON.stringify(result,null,2));
}catch(e){const allowed=['TERM_MISSING','FULL_TERM_CONFLICT','UNEXPECTED_PART_REQUIRES_REVIEW','PRESERVATION_FAILED','REVISION_MISMATCH'];console.error(JSON.stringify({ok:false,code:e.code==='EEXIST'?'CHECKPOINT_EXISTS':allowed.includes(e.message)?e.message:'STAGING_CORRECTION_STOPPED',message:'Dừng; không bỏ qua kiểm tra. Không gửi .env, khóa hoặc bản sao mã hóa.'}));process.exitCode=1;}
finally{await db().end();}
