import {randomUUID} from 'node:crypto';
import {S3Client,PutObjectCommand,GetObjectCommand} from '@aws-sdk/client-s3';
import {transaction,db} from './db.mjs';
import {encrypt,decrypt,digest,fail} from './security.mjs';
import {validateSnapshot} from './snapshot.mjs';
export function s3(){return new S3Client({endpoint:process.env.S3_ENDPOINT,region:process.env.S3_REGION||'auto',credentials:{accessKeyId:process.env.S3_ACCESS_KEY_ID,secretAccessKey:process.env.S3_SECRET_ACCESS_KEY}});}
export function backupBoundary(now=new Date()){const at=new Date(now);at.setUTCHours(17,0,0,0);if(at>now)at.setUTCDate(at.getUTCDate()-1);return at;}
export async function backup({force=false,scheduled=false}={}){
 const day=new Date().toISOString().slice(0,10),objectKey='daily/'+day+'/'+Date.now()+'-'+randomUUID()+'.json.enc';
 const claimed=await db().query("INSERT INTO sc_backup_runs(day,status,started_at) VALUES($1,'running',date_trunc('milliseconds',clock_timestamp())) ON CONFLICT(day) DO UPDATE SET status='running',started_at=date_trunc('milliseconds',clock_timestamp()),error=NULL WHERE (sc_backup_runs.status='success' AND ($2 OR ($3 AND sc_backup_runs.completed_at<$4))) OR sc_backup_runs.status='failed' OR (sc_backup_runs.status='running' AND sc_backup_runs.started_at<now()-interval '15 minutes') RETURNING day,started_at",[day,force,scheduled,backupBoundary()]);
 if(!claimed.rowCount){const last=(await db().query('SELECT * FROM sc_backup_runs WHERE day=$1',[day])).rows[0];if(last?.status==='success'&&!force)return {status:'verified',message:'Bản sao lưu hôm nay đã được xác minh.',objectKey:last.object_key};throw fail('Sao lưu đang chạy hoặc vừa thất bại. Chưa xác nhận có bản sao mới; kiểm tra và thử lại sau 15 phút.',409)}
 const lease=claimed.rows[0].started_at;
 try{
 const snapshot=await transaction(async c=>{await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');const tables={};for(const t of ['sc_users','sc_archive','sc_audit'])tables[t]=(await c.query('SELECT * FROM '+t)).rows;return validateSnapshot({format:1,at:new Date().toISOString(),tables});});
 const payload=encrypt(snapshot,'student-care-backup-v1','BACKUP_KEY'),client=s3();
 await client.send(new PutObjectCommand({Bucket:process.env.S3_BUCKET,Key:objectKey,Body:payload,ContentType:'application/octet-stream',Metadata:{sha256:digest(payload)}}));
 const check=await client.send(new GetObjectCommand({Bucket:process.env.S3_BUCKET,Key:objectKey}));
 const downloaded=await check.Body.transformToString();
 if(digest(downloaded)!==digest(payload))throw Error('Backup checksum verification failed');
 validateSnapshot(decrypt(downloaded,'student-care-backup-v1','BACKUP_KEY'));
 const done=await db().query("UPDATE sc_backup_runs SET status='success',completed_at=now(),object_key=$2 WHERE day=$1 AND started_at=$3 AND status='running' RETURNING day",[day,objectKey,lease]);
 if(!done.rowCount)throw Error('Backup lease expired; success not recorded');
 // Cleanup and optional monitoring cannot invalidate a verified remote backup.
 try{await db().query("DELETE FROM sc_sessions WHERE expires_at<now(); DELETE FROM sc_rate WHERE until_at<now()-interval '1 day'; DELETE FROM sc_requests WHERE created_at<now()-interval '7 days'")}catch(e){console.error('Backup cleanup failed',e.name)}
 if(process.env.MONITOR_PING_URL)await fetch(process.env.MONITOR_PING_URL,{signal:AbortSignal.timeout(5000)}).catch(()=>{});
 return {status:'verified',message:'Đã sao lưu ngoài Neon, tải lại và kiểm tra toàn bộ dữ liệu giải mã thành công.',objectKey,revision:snapshot.tables.sc_archive[0].revision};
 }catch(e){await db().query("UPDATE sc_backup_runs SET status='failed',error=$2 WHERE day=$1 AND started_at=$3 AND status='running'",[day,'Backup failed; inspect protected server logs',lease]);throw e;}
}
