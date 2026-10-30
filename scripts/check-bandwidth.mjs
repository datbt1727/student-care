// Read-only aggregates. Never downloads the cipher, names, account secrets or URLs.
import {db} from '../lib/db.mjs';
try{
 const r=(await db().query('SELECT revision,octet_length(cipher) AS cipher_bytes,pg_column_size(cipher) AS stored_bytes FROM sc_archive WHERE id=1')).rows[0];
 if(!r)throw Error('Chưa có dữ liệu workspace.');
 const audit=(await db().query("SELECT count(*)::integer AS events_7d,count(*) FILTER (WHERE action='read_workspace')::integer AS loads_7d,count(*) FILTER (WHERE action='workspace_saved')::integer AS saves_7d FROM sc_audit WHERE at>now()-interval '7 days'")).rows[0];
 const backup=(await db().query("SELECT count(*)::integer AS successful_7d,max(completed_at) AS last_success FROM sc_backup_runs WHERE status='success' AND completed_at>now()-interval '7 days'")).rows[0];
 const bytes=Number(r.cipher_bytes),gb=n=>(n/1e9).toFixed(3);
 console.log(JSON.stringify({revision:r.revision,encryptedWorkspaceBytes:bytes,storedBytes:r.stored_bytes,audit,backup,illustration:{description:'Ước tính truy vấn đồng bộ cũ: 1 tab, mở 8 giờ/ngày trong 30 ngày, mỗi 15 giây, dữ liệu không thay đổi. Không phải số đo Neon.',legacyUnchangedPollingGB:gb(bytes*4*60*8*30),newUnchangedCipherBytes:0},limitations:'Không lấy được Usage/Billing Neon từ SQL. Đăng nhập, tải dữ liệu mới, lưu của nhân viên và sao lưu vẫn có lưu lượng. Theo dõi Usage thực tế sau triển khai.'},null,2));
}catch(e){console.error('Chưa kiểm tra được băng thông:',e.code||e.name);process.exitCode=1}finally{await db().end()}
