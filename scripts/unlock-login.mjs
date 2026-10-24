import {db,transaction} from '../lib/db.mjs';
import {digest} from '../lib/security.mjs';
const username=String(process.argv[2]||'').trim().toLowerCase();
if(process.env.CI||!/^[a-z0-9._-]{3,60}$/.test(username)||process.argv[3]!=='LOGIN-UNLOCK-VERIFIED')throw Error('Chỉ chạy từ Codespaces/máy quản trị đã xác minh: node --env-file=.env scripts/unlock-login.mjs username LOGIN-UNLOCK-VERIFIED');
try{
 await transaction(async c=>{
 const account=(await c.query('SELECT username FROM sc_users WHERE username=$1',[username])).rows[0];if(!account)throw Error('Tài khoản không tồn tại.');
 await c.query('DELETE FROM sc_rate WHERE bucket=$1',['login-user:'+digest(username)]);
 await c.query("INSERT INTO sc_audit(actor,action,detail) VALUES('offline-admin','login_limit_cleared',$1)",[username]);
 });
 console.log('Đã xóa giới hạn thử đăng nhập riêng cho '+username+'. Mật khẩu, khóa TOTP, quyền và giới hạn IP không thay đổi.');
}finally{await db().end()}
