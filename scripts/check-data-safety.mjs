// Read-only readiness checks. Never prints URLs, secrets or student records.
import {db} from '../lib/db.mjs';
import {key} from '../lib/security.mjs';
try{
 const data=key('DATA_KEY'),backup=key('BACKUP_KEY');key('RATE_KEY');
 if(data.equals(backup))throw Error('DATA_KEY và BACKUP_KEY phải khác nhau. Không tự thay khóa hiện tại; cần lập kế hoạch chuyển đổi trước.');
 for(const name of ['APP_ORIGIN','S3_ENDPOINT']){const u=new URL(process.env[name]);if(u.protocol!=='https:'||u.username||u.password)throw Error(name+' cần HTTPS và không chứa thông tin đăng nhập.');}
 for(const name of ['S3_BUCKET','S3_ACCESS_KEY_ID','S3_SECRET_ACCESS_KEY','CRON_SECRET'])if(!process.env[name])throw Error('Thiếu '+name);
 const ssl=(await db().query('SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()')).rows[0];if(!ssl?.ssl)throw Error('Chưa xác nhận kết nối cơ sở dữ liệu dùng TLS.');
 const columns=(await db().query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND ((table_name='sc_users' AND column_name='permissions') OR (table_name='sc_requests' AND column_name='request_hash'))")).rows;if(columns.length!==2)throw Error('Thiếu cấu trúc dữ liệu v5. Chạy migrate bằng kết nối chủ cơ sở dữ liệu.');
 const r=(await db().query("SELECT r.rolsuper,r.rolcreatedb,r.rolcreaterole,r.rolbypassrls,r.rolreplication,has_schema_privilege(current_user,'public','CREATE') AS schema_create,EXISTS(SELECT 1 FROM pg_roles n WHERE n.rolname='neon_superuser' AND pg_has_role(current_user,n.oid,'MEMBER')) AS neon_admin FROM pg_roles r WHERE r.rolname=current_user")).rows[0];if(!r||Object.values(r).some(Boolean))throw Error('DATABASE_URL đang có quyền quá cao; dùng role runtime hạn chế.');
 console.log('PASS: khóa đúng định dạng/tách biệt, cấu hình HTTPS, PostgreSQL TLS, schema v5 và quyền runtime hạn chế.');
 console.log('Chưa xác nhận bản sao B2 thật. Cần chạy sao lưu, tải lại và khôi phục thử riêng.');
}finally{await db().end();}
