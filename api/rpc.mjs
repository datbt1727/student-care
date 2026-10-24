import {createHmac} from 'node:crypto';
import {db,transaction} from '../lib/db.mjs';
import {rate} from '../lib/rate.mjs';
import {fail,assertOrigin,hashPassword,verifyPassword,opaque,digest,equal,encrypt,decrypt,publicUser,verifyTotp,totpSecret,key,validateArchive} from '../lib/security.mjs';
import {backup} from '../lib/backup.mjs';
import {normalizePermissions,requirePermission,hasPermission,canWrite,authorizeArchive} from '../lib/permissions.mjs';
import StudentDeletion from '../lib/deletion.cjs';
const COOKIE='__Host-sc';
const audit=(c,u,a,d='')=>c.query('INSERT INTO sc_audit(actor,action,detail) VALUES($1,$2,$3)',[u,a,d]);
const cookie=(res,value,age)=>res.setHeader('Set-Cookie',COOKIE+'='+value+'; Path=/; Secure; HttpOnly; SameSite=Strict'+(age===null?'':'; Max-Age='+age));
const parseCookie=req=>String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';
async function health(){const [recent,successful]=await Promise.all([db().query("SELECT completed_at,status FROM sc_backup_runs ORDER BY day DESC LIMIT 1"),db().query("SELECT completed_at,status FROM sc_backup_runs WHERE completed_at IS NOT NULL AND object_key IS NOT NULL ORDER BY completed_at DESC LIMIT 1")]);const last=recent.rows[0],lastSuccess=successful.rows[0];const ok=last?.status==='success'&&Date.now()-new Date(lastSuccess?.completed_at).getTime()<30*3600000;return {mirrorStatus:'Neon · dữ liệu mã hóa',backupAt:lastSuccess?.completed_at||'',backupError:ok?'':last?.status==='running'?'Sao lưu đang chạy; chưa có xác nhận bản mới.':'Chưa xác nhận sao lưu gần nhất thành công trong 30 giờ. Cần kiểm tra.',mirrorError:'',backupSchedule:'00:00 Asia/Ho_Chi_Minh',info:{spreadsheetUrl:'#',driveUrl:'#'}};}

// Independent reads run together; pending sessions never call this helper.
async function workspaceFor(user){
 const [,read,backupHealth]=await Promise.all([audit(db(),user.username,'read_workspace'),db().query('SELECT * FROM sc_archive WHERE id=1'),health()]);
 const r=read.rows[0];if(!r)throw fail('Quản trị viên chưa khởi tạo dữ liệu.',503);
 return {archive:decrypt(r.cipher,'archive'),revision:r.revision,user:publicUser(user),health:backupHealth};
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
 try{
 if(req.method!=='POST')throw fail('Method not allowed',405);
 assertOrigin(req);
 if(!String(req.headers['content-type']||'').startsWith('application/json'))throw fail('JSON required',415);
 const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
 if(!body||Buffer.byteLength(JSON.stringify(body))>3500000)throw fail('Yêu cầu vượt 3,5 MB. Chia nhỏ lần nhập.',413);
 const {action,p={}}=body;
 if(typeof action!=='string'||!p||typeof p!=='object'||Array.isArray(p))throw fail('Yêu cầu không hợp lệ.');
 const ip=String(req.headers['x-vercel-forwarded-for']||req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0];
 const ipKey=createHmac('sha256',key('RATE_KEY')).update(ip).digest('hex');
 await rate('ip:'+ipKey,180,60);
 if(action==='challenge')return res.json({ok:true,data:{salt:'a'.repeat(32),iterations:1}});
 if(action==='login'){
 const username=String(p.username||'').trim().toLowerCase();if(!/^[a-z0-9._-]{3,60}$/.test(username))throw fail('Thông tin đăng nhập hoặc mã xác thực không đúng.',401);
 const [,,userRead]=await Promise.all([rate('login-ip:v2:'+ipKey,60,900),rate('login-user:'+digest(username),8,900),db().query('SELECT * FROM sc_users WHERE username=$1',[username])]);
 const u=userRead.rows[0];
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
 await c.query('DELETE FROM sc_rate WHERE bucket=$1',['login-user:'+digest(username)]);
 });
 const data={token:'cookie',csrf,user:publicUser(u)};if(p.includeWorkspace===true&&!u.must_change){try{data.workspace=await workspaceFor(u)}catch(e){data.workspaceUnavailable=true}}
 cookie(res,token,u.must_change?900:remember?seconds:null);return res.json({ok:true,data});
 }
 const raw=parseCookie(req);if(!raw)throw fail('Vui lòng đăng nhập.',401);
 const s=(await db().query("SELECT s.*,u.display_name,u.role,u.active,u.must_change,u.password_hash,u.totp_cipher,u.permissions FROM sc_sessions s JOIN sc_users u USING(username) WHERE token_hash=$1 AND expires_at>now() AND ((s.remember AND last_seen>now()-interval '24 hours') OR (NOT s.remember AND last_seen>now()-interval '60 minutes'))",[digest(raw)])).rows[0];
 if(!s?.active)throw fail('Phiên đã hết hạn hoặc tài khoản bị khóa.',401);
 if(action!=='resume'&&!equal(req.headers['x-sc-csrf'],s.csrf))throw fail('Phiên không hợp lệ. Đăng nhập lại.',403);
 await rate('user:'+s.username,120,60);
 await db().query('UPDATE sc_sessions SET last_seen=now() WHERE token_hash=$1',[digest(raw)]);
 if(action==='logout'){await db().query('DELETE FROM sc_sessions WHERE token_hash=$1',[digest(raw)]);cookie(res,'',0);return res.json({ok:true,data:{message:'Đã đăng xuất.'}});}
 if(action==='resume'){const data={user:publicUser(s),csrf:s.csrf,token:'cookie'};if(p.includeWorkspace===true&&!s.must_change&&!s.pending){try{data.workspace=await workspaceFor(s)}catch(e){data.workspaceUnavailable=true}}return res.json({ok:true,data});}
 if(action==='changePassword'){
 if(!await verifyPassword(p.oldPassword,s.password_hash))throw fail('Mật khẩu hiện tại không đúng.',403);
 if(await verifyPassword(p.newPassword,s.password_hash))throw fail('Mật khẩu mới phải khác mật khẩu cũ.');
 const hash=await hashPassword(p.newPassword);
 await transaction(async c=>{await c.query('UPDATE sc_users SET password_hash=$2,must_change=false WHERE username=$1',[s.username,hash]);await c.query('DELETE FROM sc_sessions WHERE username=$1',[s.username]);await audit(c,s.username,'password_changed');});
 cookie(res,'',0);return res.json({ok:true,data:{message:'Đã đổi mật khẩu; mọi phiên cũ đã thu hồi.'}});
 }
 if(s.must_change||s.pending)throw fail('Bắt buộc đổi mật khẩu tạm trước khi truy cập dữ liệu.',403);
 const admin=()=>{if(s.role!=='admin')throw fail('Chỉ quản trị viên được thực hiện.',403);};
 const permit=key=>requirePermission(s,key);
 const assertActor=async c=>{const live=(await c.query('SELECT * FROM sc_users WHERE username=$1 FOR SHARE',[s.username])).rows[0];if(!live?.active||live.must_change||live.role!==s.role||live.password_hash!==s.password_hash||JSON.stringify(normalizePermissions(live.permissions||{}))!==JSON.stringify(normalizePermissions(s.permissions||{}))||!(await c.query('SELECT token_hash FROM sc_sessions WHERE token_hash=$1',[digest(raw)])).rows.length)throw fail('Quyền hoặc phiên đã thay đổi. Đăng nhập lại trước khi lưu.',401)};
 const accountTarget=async(c,username)=>{const target=(await c.query('SELECT * FROM sc_users WHERE username=$1 FOR UPDATE',[username])).rows[0];if(!target)throw fail('Tài khoản không tồn tại.');if(target.role==='admin'&&s.role!=='admin')throw fail('Nhân viên không được quản lý tài khoản quản trị.',403);return target};
 let result;
 switch(action){
 case 'load':{result=await workspaceFor(s);break;}
 case 'save':{if(!canWrite(s))throw fail('Tài khoản chỉ có quyền đọc dữ liệu.',403);
 // Staff currently share the full workspace. No false per-mentor isolation is claimed.
 const a=validateArchive(JSON.parse(p.json||''));if(!Number.isSafeInteger(p.revision)||p.revision<1)throw fail('Phiên bản dữ liệu không hợp lệ.');const requestHash=digest(JSON.stringify([p.revision,p.json,p.restore===true,p.confirmation||''])),receipt=revision=>({committed:true,requestId:p.requestId,requestHash,revision});if(!/^[\w-]{8,100}$/.test(p.requestId||''))throw fail('Mã yêu cầu không hợp lệ.');
 result=await transaction(async c=>{await assertActor(c);await c.query('SELECT id FROM sc_archive WHERE id=1 FOR UPDATE');const prior=(await c.query('SELECT revision,request_hash FROM sc_requests WHERE username=$1 AND request_id=$2',[s.username,p.requestId])).rows[0];if(prior){if(prior.request_hash!==requestHash)throw fail('Mã lưu đã được dùng cho nội dung khác. Không ghi đè dữ liệu.',409);return {revision:prior.revision,receipt:receipt(prior.revision),warning:''};}
 const current=(await c.query('SELECT * FROM sc_archive WHERE id=1')).rows[0];if(!current)throw fail('Chưa có dữ liệu.',503);authorizeArchive(s,decrypt(current.cipher,'archive'),a,p);
 const r=await c.query('UPDATE sc_archive SET cipher=$1,revision=revision+1,updated_at=now() WHERE id=1 AND revision=$2 RETURNING revision',[encrypt(a,'archive'),p.revision]);if(!r.rowCount)throw fail('Dữ liệu đã được người khác thay đổi. Tải lại trước khi lưu.',409);
 await c.query('INSERT INTO sc_requests(username,request_id,revision,request_hash) VALUES($1,$2,$3,$4)',[s.username,p.requestId,r.rows[0].revision,requestHash]);await audit(c,s.username,'workspace_saved','revision='+r.rows[0].revision);return {revision:r.rows[0].revision,receipt:receipt(r.rows[0].revision),warning:''};});try{result.info=await health()}catch(e){result.healthUnavailable=true}break;}
 case 'health':result=await health();break;
 case 'job':{const r=(await db().query('SELECT revision,request_hash FROM sc_requests WHERE username=$1 AND request_id=$2',[s.username,String(p.requestId||'')])).rows[0];result=r?{status:'done',percent:100,message:'Đã ghi nhận giao dịch lưu.',revision:r.revision}:{status:'unknown',message:'Chưa có xác nhận giao dịch lưu.'};break;}
 case 'logs':permit('viewLogs');result=(await db().query('SELECT * FROM sc_audit ORDER BY id DESC LIMIT 200')).rows.map(r=>[r.at,r.actor,r.action,'Đã ghi nhận',r.detail,'']);break;
 case 'users':permit('manageAccounts');result=(await db().query('SELECT * FROM sc_users ORDER BY username')).rows.map(publicUser);break;
 case 'createUser':{
 permit('manageAccounts');const username=String(p.username||'').trim().toLowerCase();if(!/^[a-z0-9._-]{3,60}$/.test(username)||!['admin','staff'].includes(p.role)||typeof p.displayName!=='string'||p.displayName.length>100)throw fail('Thông tin tài khoản không hợp lệ.');
 if(s.role!=='admin'&&(p.role!=='staff'||Object.values(p.permissions||{}).some(Boolean)))throw fail('Chỉ quản trị viên được cấp quyền bổ sung hoặc quyền quản trị.',403);
 const permissions=normalizePermissions(p.permissions||{});const hash=await hashPassword(p.password),secret=totpSecret();
 await transaction(async c=>{await assertActor(c);await c.query('INSERT INTO sc_users(username,display_name,role,password_hash,totp_cipher,permissions) VALUES($1,$2,$3,$4,$5,$6)',[username,p.displayName,p.role,hash,encrypt(secret,'totp:'+username),JSON.stringify(permissions)]);await audit(c,s.username,'user_created',username);});
 result={message:'Đã tạo tài khoản. Bắt buộc đổi mật khẩu lần đầu. Khóa TOTP (chỉ hiện lần này; bàn giao qua kênh riêng): '+secret};break;}
 case 'resetUser':permit('manageAccounts');if(p.username===s.username)throw fail('Sử dụng Đổi mật khẩu cho tài khoản của bạn.');{const hash=await hashPassword(p.password);await transaction(async c=>{await assertActor(c);await accountTarget(c,p.username);const r=await c.query('UPDATE sc_users SET password_hash=$2,must_change=true WHERE username=$1 RETURNING username',[p.username,hash]);if(!r.rowCount)throw fail('Tài khoản không tồn tại.');await c.query('DELETE FROM sc_sessions WHERE username=$1',[p.username]);await audit(c,s.username,'password_reset',p.username);});result={message:'Đã đặt mật khẩu tạm và thu hồi phiên. TOTP không thay đổi.'};}break;
 case 'toggleUser':permit('manageAccounts');if(p.username===s.username)throw fail('Không được tự khóa.');await transaction(async c=>{await c.query("SELECT username FROM sc_users WHERE role='admin' AND active=true ORDER BY username FOR UPDATE");await assertActor(c);const target=await accountTarget(c,p.username);if(target.role==='admin'&&target.active){const n=(await c.query("SELECT count(*)::integer AS n FROM sc_users WHERE role='admin' AND active=true")).rows[0].n;if(n<=1)throw fail('Phải giữ ít nhất một quản trị viên đang hoạt động.',403)}await c.query('UPDATE sc_users SET active=NOT active WHERE username=$1',[p.username]);await c.query('DELETE FROM sc_sessions WHERE username=$1',[p.username]);await audit(c,s.username,'user_toggled',p.username);});result={message:'Đã cập nhật và thu hồi phiên.'};break;
 case 'updateUser':{
 permit('manageAccounts');const username=String(p.username||'').trim().toLowerCase();if(!/^[a-z0-9._-]{3,60}$/.test(username)||typeof p.displayName!=='string'||!p.displayName.trim()||p.displayName.length>100||!['admin','staff'].includes(p.role)||typeof p.active!=='boolean')throw fail('Thông tin tài khoản không hợp lệ.');
 const permissions=normalizePermissions(p.permissions||{});
 await transaction(async c=>{
 await c.query("SELECT username FROM sc_users WHERE role='admin' AND active=true ORDER BY username FOR UPDATE");
 await assertActor(c);const target=await accountTarget(c,username);
 if(username===s.username&&(p.role!==target.role||p.active!==target.active||JSON.stringify(permissions)!==JSON.stringify(normalizePermissions(target.permissions||{}))))throw fail('Không được tự đổi quyền hoặc tự khóa tài khoản.',403);
 if(s.role!=='admin'&&(p.role!=='staff'||JSON.stringify(permissions)!==JSON.stringify(normalizePermissions(target.permissions||{}))))throw fail('Chỉ quản trị viên được thay đổi quyền.',403);
 if(target.role==='admin'&&target.active&&(!p.active||p.role!=='admin')){const count=(await c.query("SELECT count(*)::integer AS n FROM sc_users WHERE role='admin' AND active=true")).rows[0].n;if(count<=1)throw fail('Phải giữ ít nhất một quản trị viên đang hoạt động.',403)}
 await c.query('UPDATE sc_users SET display_name=$2,role=$3,active=$4,permissions=$5 WHERE username=$1',[username,p.displayName.trim(),p.role,p.active,JSON.stringify(permissions)]);
 if(username!==s.username)await c.query('DELETE FROM sc_sessions WHERE username=$1',[username]);
 await audit(c,s.username,'account_updated',JSON.stringify({username,role:p.role,active:p.active,permissions}));
 });result={message:'Đã lưu tài khoản. Các phiên cũ của người được chỉnh sửa đã được thu hồi; cần đăng nhập lại.'};break;
 }
 case 'artifact':if(p.kind==='input')permit('importData');else if(p.kind==='restore')permit('restoreData');else if(p.kind!=='export')throw fail('Loại file không hợp lệ.');await audit(db(),s.username,p.kind==='input'?'import_processed':p.kind==='restore'?'restore_processed':'export_requested');result={url:'',id:'processed-client-side',message:'File được xử lý trên thiết bị; dữ liệu đã lưu Neon. Không lưu file gốc.'};break;
 case 'backup':permit('backupData');await rate('backup',1,900);result=await backup({force:true});break;
 case 'repairMirror':admin();result=await health();break;
 case 'previewStudentDeletion':permit('deleteData');{const r=(await db().query('SELECT * FROM sc_archive WHERE id=1')).rows[0];const plan=StudentDeletion.plan(decrypt(r.cipher,'archive'),p);result={...plan,revision:r.revision,planToken:encrypt({plan,revision:r.revision,username:s.username,expires:Date.now()+300000},'delete-plan')};}break;
 case 'deleteStudents':permit('deleteData');{const ticket=decrypt(p.planToken,'delete-plan');if(ticket.username!==s.username||ticket.expires<Date.now()||p.confirmation!==ticket.plan.confirmation)throw fail('Xác nhận xóa hết hạn hoặc không khớp.');result=await transaction(async c=>{await assertActor(c);const r=(await c.query('SELECT * FROM sc_archive WHERE id=1 FOR UPDATE')).rows[0];if(r.revision!==ticket.revision)throw fail('Dữ liệu đã thay đổi. Kiểm tra lại phạm vi xóa.',409);const a=decrypt(r.cipher,'archive');StudentDeletion.apply(a,ticket.plan);await c.query('UPDATE sc_archive SET cipher=$1,revision=revision+1,updated_at=now() WHERE id=1',[encrypt(a,'archive')]);await audit(c,s.username,'student_deleted','count='+ticket.plan.ids.length);return {revision:r.revision+1,counts:ticket.plan.counts,warning:''};});}break;
 default:throw fail('Chức năng không được hỗ trợ.',400);
 }
 res.json({ok:true,data:result});
 }catch(e){const status=e.status||(e.code==='23505'?409:500);if(status===500)console.error('StudentCare operation failed',e.code||e.name);if(status===429){e.retryAfter=Math.max(1,Math.min(900,Number(e.retryAfter)||5));res.setHeader('Retry-After',String(e.retryAfter))}res.status(status).json({ok:false,...(status===429?{retryAfter:e.retryAfter}:{}),code:status===401?'SESSION':String(status),error:status===500?'Máy chủ chưa xử lý được. Dữ liệu chưa xác nhận lưu; thử lại sau.':e.code==='23505'?'Tên tài khoản đã tồn tại.':e.message});}
}
