import {db,transaction} from '../lib/db.mjs';
import {hashPassword,totpSecret,encrypt,opaque} from '../lib/security.mjs';
const username=process.argv[2];
if(!/^[a-z0-9._-]{3,60}$/.test(username||'')||process.argv[3]!=='IDENTITY-VERIFIED')throw Error('Chỉ quản trị được ủy quyền sau xác minh danh tính: node scripts/recover-account.mjs username IDENTITY-VERIFIED');
const password=opaque()+'!',secret=totpSecret(),hash=await hashPassword(password);
try{await transaction(async c=>{const r=await c.query('UPDATE sc_users SET password_hash=$2,totp_cipher=$3,last_totp_step=-1,must_change=true WHERE username=$1 RETURNING username',[username,hash,encrypt(secret,'totp:'+username)]);if(!r.rowCount)throw Error('Tài khoản không tồn tại');await c.query('DELETE FROM sc_sessions WHERE username=$1',[username]);await c.query("INSERT INTO sc_audit(actor,action,detail) VALUES('offline-admin','account_recovered',$1)",[username]);});
console.log('Chỉ bàn giao sau xác minh danh tính, qua kênh an toàn. Không chạy trong CI.');
console.log('Tài khoản:',username,'\nMật khẩu tạm:',password,'\nKhóa TOTP mới:',secret);
}finally{await db().end();}
