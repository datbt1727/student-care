import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import D from './study-decisions.cjs';
import {S3Client,PutObjectCommand,GetObjectCommand} from '@aws-sdk/client-s3';
import {encrypt,decrypt,digest,fail,validateArchive} from './security.mjs';

export function studyEnabled(){
 return ['staging','production'].includes(process.env.SC_STUDY_DECISIONS);
}
export function requireStudyStaging(){
 const mode=process.env.SC_STUDY_DECISIONS,origin=process.env.APP_ORIGIN||'';
 if(mode==='staging'&&/^https:\/\/[a-z0-9-]+-4173\.app\.github\.dev$/.test(origin))return;
 if(mode==='production'&&process.env.VERCEL_ENV==='production'){
  try{const u=new URL(origin);if(u.protocol==='https:'&&u.origin===origin&&!u.port&&!['localhost','127.0.0.1'].includes(u.hostname)&&!u.hostname.endsWith('.app.github.dev'))return;}catch{}
 }
 throw fail('Xác nhận lượt học chưa được bật cho môi trường này.',403);
}
async function remoteCheckpoint(row){
 const names=['S3_ENDPOINT','S3_ACCESS_KEY_ID','S3_SECRET_ACCESS_KEY','S3_BUCKET','BACKUP_KEY'];if(names.some(k=>!process.env[k]))throw fail('Thiếu cấu hình kho sao lưu mã hóa. Đã dừng trước khi thay đổi.',503);
 const client=new S3Client({endpoint:process.env.S3_ENDPOINT,region:process.env.S3_REGION||'auto',credentials:{accessKeyId:process.env.S3_ACCESS_KEY_ID,secretAccessKey:process.env.S3_SECRET_ACCESS_KEY}});
 const value={format:1,revision:row.revision,cipherSha256:digest(row.cipher),cipher:row.cipher},payload=encrypt(value,'study-checkpoint-v1','BACKUP_KEY'),key='study-checkpoints/'+row.revision+'-'+digest(row.cipher)+'.json.enc';
 try{
  await client.send(new PutObjectCommand({Bucket:process.env.S3_BUCKET,Key:key,Body:payload,ContentType:'application/octet-stream',Metadata:{sha256:digest(payload)}}));
  const check=await client.send(new GetObjectCommand({Bucket:process.env.S3_BUCKET,Key:key})),downloaded=await check.Body.transformToString();
  if(digest(downloaded)!==digest(payload))throw Error('CHECKSUM');const read=decrypt(downloaded,'study-checkpoint-v1','BACKUP_KEY');
  if(read.revision!==row.revision||read.cipher!==row.cipher||read.cipherSha256!==value.cipherSha256)throw Error('CONTENT');
  return key;
 }catch{throw fail('Chưa xác minh được điểm khôi phục ngoài máy chủ. Đã dừng, chưa lưu thay đổi.',503);}
 finally{client.destroy();}
}
export async function checkpointDecision(row){
 requireStudyStaging();
 if(!Number.isSafeInteger(row?.revision)||row.revision<1||typeof row.cipher!=='string')throw fail('Không có dữ liệu gốc để tạo điểm khôi phục.',503);
 if(process.env.SC_STUDY_DECISIONS==='production')return remoteCheckpoint(row);
 const sha=digest(row.cipher),dir=new URL('../.staging-study-checkpoints/',import.meta.url),file=new URL(row.revision+'-'+sha+'.enc.json',dir),value={format:1,revision:row.revision,cipherSha256:sha,cipher:row.cipher};
 try{await fs.mkdir(dir,{recursive:true,mode:0o700});await fs.writeFile(file,JSON.stringify(value),{flag:'wx',mode:0o600});}
 catch(e){if(e.code!=='EEXIST')throw fail('Không tạo được bản gốc mã hóa trước thay đổi. Đã dừng, chưa lưu quyết định.',503);}
 try{const saved=JSON.parse(await fs.readFile(file,'utf8'));if(saved.revision!==row.revision||saved.cipherSha256!==sha||digest(saved.cipher)!==sha)throw Error();}
 catch{throw fail('Bản gốc mã hóa chưa được xác minh. Đã dừng, chưa lưu quyết định.',503);}
 return file;
}
export function previewDecision(archive,p,username){
 if(!p||Object.keys(p).some(k=>!['revision','termId','decision'].includes(k))||!Number.isSafeInteger(p.revision)||p.revision<1)throw fail('Thông tin xem trước không hợp lệ.');
 const t=archive.terms?.[p.termId];if(!t)throw fail('Học kỳ không tồn tại.');
 try{
  const d=D.prepare(t,p.decision,randomUUID(),username),attempts=D.summary(t,d);
  return {revision:p.revision,termId:p.termId,decisionId:d.id,kind:d.kind,sourceCount:d.sourceRefs.length,targetCount:d.targetRefs.length,attempts,rawDataUnchanged:true,planToken:encrypt({revision:p.revision,termId:p.termId,decision:d,username,expires:Date.now()+300000},'study-decision-plan')};
 }catch(e){throw fail(e.message);}
}
export function openDecisionTicket(p,username){
 if(!p||Object.keys(p).some(k=>!['requestId','planToken','confirmation'].includes(k))||!/^[\w-]{8,100}$/.test(p.requestId||'')||typeof p.planToken!=='string'||p.planToken.length>2000000)throw fail('Yêu cầu xác nhận không hợp lệ.');
 let ticket;try{ticket=decrypt(p.planToken,'study-decision-plan');}catch{throw fail('Bản xem trước không hợp lệ. Kiểm tra lại.');}
 if(ticket.username!==username||p.confirmation!==ticket.decision.id)throw fail('Xác nhận không khớp bản xem trước.',403);
 return {ticket,requestHash:digest(JSON.stringify(['study-decision',p.planToken,p.confirmation]))};
}
export function applyDecision(archive,ticket){
 if(ticket.expires<Date.now())throw fail('Bản xem trước đã hết hạn. Kiểm tra lại.');
 const t=archive.terms?.[ticket.termId],d=ticket.decision;if(!t)throw fail('Học kỳ không tồn tại.');
 try{
  // Rebuild from the locked current archive; never trust record references supplied by a browser.
  const next=D.prepare(t,{studentId:d.studentId,subject:d.subject,kind:d.kind,source:d.source,target:d.target,cumulativeConfirmed:d.cumulativeConfirmed},d.id,d.actor,d.at);
  if(JSON.stringify(next)!==JSON.stringify(d))throw fail('Phạm vi dữ liệu đã thay đổi. Xem trước lại.',409);
  D.summary(t,next);
  return validateArchive({...archive,terms:{...archive.terms,[ticket.termId]:{...t,studyDecisions:[...(t.studyDecisions||[]),next]}}});
 }catch(e){throw e.status?e:fail(e.message);}
}
export function preserveDecisions(before,after){
 for(const tid of new Set([...Object.keys(before.terms||{}),...Object.keys(after.terms||{})]))if(JSON.stringify(before.terms?.[tid]?.studyDecisions||[])!==JSON.stringify(after.terms?.[tid]?.studyDecisions||[]))throw fail('Không sửa hoặc xóa liên kết lượt học bằng lưu toàn bộ dữ liệu. Dùng màn hình đối chiếu.',403);
 for(const [tid,t]of Object.entries(after.terms||{}))try{D.validateNew(before.terms?.[tid]||{},t);}catch(e){throw fail(e.message,403);}
}
export function cancelDecision(archive,termId,decisionId,actor){
 const t=archive.terms?.[termId],d=t?.studyDecisions?.find(x=>x.id===decisionId&&x.status==='active');if(!d)throw fail('Không còn quyết định đang áp dụng.');
 const ids=new Set([d.sourceAttempt.id,d.targetAttempt.id]);
 if(t.studyDecisions.some(x=>x.id!==d.id&&x.status==='active'&&(ids.has(x.sourceAttempt.id)||ids.has(x.targetAttempt.id)))||(t.records||[]).some(r=>ids.has(r.attemptId))||Object.values(t.dailyFollow||{}).some(r=>ids.has(r.attemptId)))throw fail('Quyết định đã được lượt hoặc dữ liệu khác tham chiếu. Cần đối chiếu; không tự hoàn tác.',409);
 return {...archive,terms:{...archive.terms,[termId]:{...t,studyDecisions:t.studyDecisions.map(x=>x.id===d.id?{...x,status:'cancelled',cancelledAt:new Date().toISOString(),cancelledBy:actor}:x)}}};
}
