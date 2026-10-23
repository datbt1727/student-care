import {createHmac} from 'node:crypto';
import {db,transaction} from '../lib/db.mjs';
import {fail,assertOrigin,hashPassword,verifyPassword,opaque,digest,equal,encrypt,decrypt,publicUser,verifyTotp,totpSecret,key,validateArchive} from '../lib/security.mjs';
import {backup} from '../lib/backup.mjs';
import StudentDeletion from '../lib/deletion.cjs';
const COOKIE='__Host-sc';
const audit=(c,u,a,d='')=>c.query('INSERT INTO sc_audit(actor,action,detail) VALUES($1,$2,$3)',[u,a,d]);
const cookie=(res,value,age)=>res.setHeader('Set-Cookie',COOKIE+'='+value+'; Path=/; Secure; HttpOnly; SameSite=Strict'+(age===null?'':'; Max-Age='+age));
const parseCookie=req=>String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';
async function rate(bucket,max,seconds){const r=await db().query("INSERT INTO sc_rate(bucket,n,until_at) VALUES($1,1,now()+$2*interval '1 second') ON CONFLICT(bucket) DO UPDATE SET n=CASE WHEN sc_rate.until_at<now() THEN 1 ELSE sc_rate.n+1 END,until_at=CASE WHEN sc_rate.until_at<now() THEN now()+$2*interval '1 second' ELSE sc_rate.until_at END RETURNING n",[bucket,seconds]);if(r.rows[0].n>max)throw fail('Thao tác quá nhanh. Vui lòng thử lại sau.',429);}
async function health(){const r=await db().query("SELECT completed_at,status FROM sc_backup_runs ORDER BY day DESC LIMIT 1");const last=r.rows[0];const ok=last?.status==='success'&&Date.now()-new Date(last.completed_at).getTime()<30*3600000;return {mirrorStatus:'Neon · dữ liệu mã hóa',backupAt:last?.completed_at||'',backupError:ok?'':'Chưa có sao lưu thành công trong 30 giờ. Cần kiểm tra.',mirrorError:'',info:{spreadsheetUrl:'#',driveUrl:'#'}};}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
 try{
 if(req.method!=='POST')throw fail('Method not allowed',405);
 assertOrigin(req);
 if(!String(req.headers['content-type']||'').startsWith('application/json'))throw fail('JSON required',415);
 const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
 if(!body||Buffer.byteLength(JSON.stringify(body))>3500000)throw fail('Yêu cầu vượt 3,5 MB. Chia nhỏ lần nhập.',413);
 const {action,p={}}=body;
 if(typeof action!=='string')throw fail('Yêu cầu không hợp lệ.');
 const ip=String(req.headers['x-vercel-forwarded-for']||req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0];
 const ipKey=createHmac('sha256',key('RATE_KEY')).update(ip).digest('hex');
 await rate('ip:'+ipKey,180,60);
 if(action==='challenge')return res.json({ok:true,data:{salt:'a'.repeat(32),iterations:1}});
 if(action==='login'){
 const username=String(p.username||'').toLowerCase();await rate('login-ip:'+ipKey,12,900);await rate('login-user:'+digest(username),8,900);
 const u=(await db().query('SELECT * FROM sc_users WHERE username=$1',[username])).rows[0];
 // Fixed valid dummy hash ensures missing accounts still pay the same scrypt cost.
 const dummy='scrypt$0123456789abcdef0123456789abcdef$'+'0'.repeat(128);
 const valid=await verifyPassword(p.password,u?.password_hash||dummy);
 const step=u?verifyTotp(decrypt(u.totp_cipher,'totp:'+u.username),p.totp,u.last_totp_step):null;
 if(!u?.active||!valid||step===null){await audit(db(),'anonymous','login_failed');throw fail('Thông tin đăng nhập hoặc mã xác thực không đúng.',401);}
 const token=opaque(),csrf=opaque(),remember=p.remember===true,seconds=remember?7*86400:8*3600;
 await transaction(async c=>{
 const changed=await c.query('UPDATE sc_users SET last_totp_step=$2 WHERE username=$1 AND last_totp_step<$2 AND active=true AND password_hash=$3 RETURNING username',[u.username,step,u.password_hash]);if(!changed.rowCount)throw fail('Mã xác thực đã dùng. Chờ mã mới.',401);
 await c.query("INSERT INTO sc_sessions(token_hash,username,csrf,expires_at,pending,remember) VALUES($1,$2,$3,now()+$4*interval '1 second',$5,$6)",[digest(token),u.username,csrf,u.must_change?900:seconds,u.must_change,remember]);
 await audit(c,u.username,'login');
 });
 cookie(res,token,u.must_change?900:remember?seconds:null);return res.json({ok:true,data:{token:'cookie',csrf,user:publicUser(u)}});
 }
 const raw=parseCookie(req);if(!raw)throw fail('Vui lòng đăng nhập.',401);
 const s=(await db().query("SELECT s.*,u.display_name,u.role,u.active,u.must_change,u.password_hash,u.totp_cipher FROM sc_sessions s JOIN sc_users u USING(username) WHERE token_hash=$1 AND expires_at>now() AND ((s.remember AND last_seen>now()-interval '24 hours') OR (NOT s.remember AND last_seen>now()-interval '60 minutes'))",[digest(raw)])).rows[0];
 if(!s?.active)throw fail('Phiên đã hết hạn hoặc tài khoản bị khóa.',401);
 if(action!=='resume'&&!equal(req.headers['x-sc-csrf'],s.csrf))throw fail('Phiên không hợp lệ. Đăng nhập lại.',403);
 await rate('user:'+s.username,120,60);
 await db().query('UPDATE sc_sessions SET last_seen=now() WHERE token_hash=$1',[digest(raw)]);
 if(action==='logout'){await db().query('DELETE FROM sc_sessions WHERE token_hash=$1',[digest(raw)]);cookie(res,'',0);return res.json({ok:true,data:{message:'Đã đăng xuất.'}});}
 if(action==='resume')return res.json({ok:true,data:{user:publicUser(s),csrf:s.csrf,token:'cookie'}});
 if(action==='changePassword'){
 if(!await verifyPassword(p.oldPassword,s.password_hash))throw fail('Mật khẩu hiện tại không đúng.',403);
 if(await verifyPassword(p.newPassword,s.password_hash))throw fail('Mật khẩu mới phải khác mật khẩu cũ.');
 const hash=await hashPassword(p.newPassword);
 await transaction(async c=>{await c.query('UPDATE sc_users SET password_hash=$2,must_change=false WHERE username=$1',[s.username,hash]);await c.query('DELETE FROM sc_sessions WHERE username=$1',[s.username]);await audit(c,s.username,'password_changed');});
 cookie(res,'',0);return res.json({ok:true,data:{message:'Đã đổi mật khẩu; mọi phiên cũ đã thu hồi.'}});
 }
 if(s.must_change||s.pending)throw fail('Bắt buộc đổi mật khẩu tạm trước khi truy cập dữ liệu.',403);
 const admin=()=>{if(s.role!=='admin')throw fail('Chỉ quản trị viên được thực hiện.',403);};
 let result;
 switch(action){
 case 'load':{await audit(db(),s.username,'read_workspace');const r=(await db().query('SELECT * FROM sc_archive WHERE id=1')).rows[0];if(!r)throw fail('Quản trị viên chưa khởi tạo dữ liệu.',503);result={archive:decrypt(r.cipher,'archive'),revision:r.revision,user:publicUser(s),health:await health()};break;}
 case 'save':{admin();
 // Staff currently share the full workspace. No false per-mentor isolation is claimed.
 const a=validateArchive(JSON.parse(p.json||''));if(!/^[\w-]{8,100}$/.test(p.requestId||''))throw fail('Mã yêu cầu không hợp lệ.');
 result=await transaction(async c=>{await c.query('SELECT id FROM sc_archive WHERE id=1 FOR UPDATE');const prior=(await c.query('SELECT revision FROM sc_requests WHERE username=$1 AND request_id=$2',[s.username,p.requestId])).rows[0];if(prior)return {revision:prior.revision,warning:''};
 const r=await c.query('UPDATE sc_archive SET cipher=$1,revision=revision+1,updated_at=now() WHERE id=1 AND revision=$2 RETURNING revision',[encrypt(a,'archive'),p.revision]);if(!r.rowCount)throw fail('Dữ liệu đã được người khác thay đổi. Tải lại trước khi lưu.',409);
 await c.query('INSERT INTO sc_requests(username,request_id,revision) VALUES($1,$2,$3)',[s.username,p.requestId,r.rows[0].revision]);await audit(c,s.username,'workspace_saved','revision='+r.rows[0].revision);return {revision:r.rows[0].revision,warning:''};});result.info=await health();break;}
 case 'health':result=await health();break;
 case 'job':result={status:'done',percent:100,message:'Đã xử lý.'};break;
 case 'logs':admin();result=(await db().query('SELECT * FROM sc_audit ORDER BY id DESC LIMIT 200')).rows.map(r=>[r.at,r.actor,r.action,'Đã ghi nhận',r.detail,'']);break;
 case 'users':admin();result=(await db().query('SELECT * FROM sc_users ORDER BY username')).rows.map(publicUser);break;
 case 'createUser':{
 admin();const username=String(p.username||'').toLowerCase();if(!/^[a-z0-9._-]{3,60}$/.test(username)||!['admin','staff'].includes(p.role)||typeof p.displayName!=='string'||p.displayName.length>100)throw fail('Thông tin tài khoản không hợp lệ.');
 const hash=await hashPassword(p.password),secret=totpSecret();
 await transaction(async c=>{await c.query('INSERT INTO sc_users(username,display_name,role,password_hash,totp_cipher) VALUES($1,$2,$3,$4,$5)',[username,p.displayName,p.role,hash,encrypt(secret,'totp:'+username)]);await audit(c,s.username,'user_created',username);});
 result={message:'Đã tạo tài khoản. Bắt buộc đổi mật khẩu lần đầu. Khóa TOTP (chỉ hiện lần này; bàn giao qua kênh riêng): '+secret};break;}
 case 'resetUser':admin();if(p.username===s.username)throw fail('Sử dụng Đổi mật khẩu cho tài khoản của bạn.');{const hash=await hashPassword(p.password);await transaction(async c=>{const r=await c.query('UPDATE sc_users SET password_hash=$2,must_change=true WHERE username=$1 RETURNING username',[p.username,hash]);if(!r.rowCount)throw fail('Tài khoản không tồn tại.');await c.query('DELETE FROM sc_sessions WHERE username=$1',[p.username]);await audit(c,s.username,'password_reset',p.username);});result={message:'Đã đặt mật khẩu tạm và thu hồi phiên. TOTP không thay đổi.'};}break;
 case 'toggleUser':admin();if(p.username===s.username)throw fail('Không được tự khóa.');await transaction(async c=>{await c.query('UPDATE sc_users SET active=NOT active WHERE username=$1',[p.username]);await c.query('DELETE FROM sc_sessions WHERE username=$1',[p.username]);await audit(c,s.username,'user_toggled',p.username);});result={message:'Đã cập nhật và thu hồi phiên.'};break;
 case 'artifact':await audit(db(),s.username,p.kind==='input'?'import_file':'export_file');result={url:'',id:'processed-client-side',message:'File được xử lý trên thiết bị; dữ liệu đã lưu Neon. Không lưu file gốc.'};break;
 case 'backup':admin();await rate('backup',1,900);result=await backup();break;
 case 'repairMirror':admin();result=await health();break;
 case 'previewStudentDeletion':admin();{const r=(await db().query('SELECT * FROM sc_archive WHERE id=1')).rows[0];const plan=StudentDeletion.plan(decrypt(r.cipher,'archive'),p);result={...plan,revision:r.revision,planToken:encrypt({plan,revision:r.revision,username:s.username,expires:Date.now()+300000},'delete-plan')};}break;
 case 'deleteStudents':admin();{const ticket=decrypt(p.planToken,'delete-plan');if(ticket.username!==s.username||ticket.expires<Date.now()||p.confirmation!==ticket.plan.confirmation)throw fail('Xác nhận xóa hết hạn hoặc không khớp.');result=await transaction(async c=>{const r=(await c.query('SELECT * FROM sc_archive WHERE id=1 FOR UPDATE')).rows[0];if(r.revision!==ticket.revision)throw fail('Dữ liệu đã thay đổi. Kiểm tra lại phạm vi xóa.',409);const a=decrypt(r.cipher,'archive');StudentDeletion.apply(a,ticket.plan);await c.query('UPDATE sc_archive SET cipher=$1,revision=revision+1,updated_at=now() WHERE id=1',[encrypt(a,'archive')]);await audit(c,s.username,'student_deleted','count='+ticket.plan.ids.length);return {revision:r.revision+1,counts:ticket.plan.counts,warning:''};});}break;
 default:throw fail('Chức năng không được hỗ trợ.',400);
 }
 res.json({ok:true,data:result});
 }catch(e){const status=e.status||(e.code==='23505'?409:500);if(status===500)console.error('StudentCare operation failed',e.code||e.name);res.status(status).json({ok:false,code:status===401?'SESSION':String(status),error:status===500?'Máy chủ chưa xử lý được. Dữ liệu chưa xác nhận lưu; thử lại sau.':e.code==='23505'?'Tên tài khoản đã tồn tại.':e.message});}
}
