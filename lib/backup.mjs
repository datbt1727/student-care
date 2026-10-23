import {S3Client,PutObjectCommand,GetObjectCommand} from '@aws-sdk/client-s3';
import {transaction,db} from './db.mjs';
import {encrypt,decrypt,digest} from './security.mjs';
export function s3(){return new S3Client({endpoint:process.env.S3_ENDPOINT,region:process.env.S3_REGION||'auto',credentials:{accessKeyId:process.env.S3_ACCESS_KEY_ID,secretAccessKey:process.env.S3_SECRET_ACCESS_KEY}});}
export async function backup(){
 const day=new Date().toISOString().slice(0,10),objectKey='daily/'+day+'/'+Date.now()+'.json.enc';
 const claimed=await db().query("INSERT INTO sc_backup_runs(day,status) VALUES($1,'running') ON CONFLICT(day) DO UPDATE SET status='running',started_at=now(),error=NULL WHERE sc_backup_runs.status<>'success' AND sc_backup_runs.started_at<now()-interval '15 minutes' RETURNING day",[day]);
 if(!claimed.rowCount)return {message:'Đã có bản sao lưu hoặc tác vụ đang chạy.'};
 try{
 const snapshot=await transaction(async c=>{await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');const tables={};for(const t of ['sc_users','sc_archive','sc_audit'])tables[t]=(await c.query('SELECT * FROM '+t)).rows;return {format:1,at:new Date().toISOString(),tables};});
 const payload=encrypt(snapshot,'student-care-backup-v1','BACKUP_KEY'),client=s3();
 await client.send(new PutObjectCommand({Bucket:process.env.S3_BUCKET,Key:objectKey,Body:payload,ContentType:'application/octet-stream',Metadata:{sha256:digest(payload)}}));
 const check=await client.send(new GetObjectCommand({Bucket:process.env.S3_BUCKET,Key:objectKey}));
 const downloaded=await check.Body.transformToString();
 if(digest(downloaded)!==digest(payload)||decrypt(downloaded,'student-care-backup-v1','BACKUP_KEY').format!==1)throw Error('Backup verification failed');
 await db().query("UPDATE sc_backup_runs SET status='success',completed_at=now(),object_key=$2 WHERE day=$1",[day,objectKey]);
 await db().query("DELETE FROM sc_sessions WHERE expires_at<now(); DELETE FROM sc_rate WHERE until_at<now()-interval '1 day'; DELETE FROM sc_requests WHERE created_at<now()-interval '7 days'");
 if(process.env.MONITOR_PING_URL)await fetch(process.env.MONITOR_PING_URL,{signal:AbortSignal.timeout(5000)}).catch(()=>{});
 return {message:'Đã sao lưu ngoài Neon và kiểm tra giải mã thành công.',objectKey};
 }catch(e){await db().query("UPDATE sc_backup_runs SET status='failed',error=$2 WHERE day=$1",[day,'Backup failed; inspect protected server logs']);throw e;}
}
