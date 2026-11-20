// Read-only transaction; emits aggregate counts, never identities, keys or connection details.
import {db,transaction} from '../lib/db.mjs';
import {decrypt} from '../lib/security.mjs';
import review from '../lib/business-audit.cjs';
try{
 const row=await transaction(async c=>{await c.query('SET TRANSACTION READ ONLY');return (await c.query('SELECT revision,cipher FROM sc_archive WHERE id=1')).rows[0];});
 if(!row)throw Error('EMPTY');
 console.log(JSON.stringify({revision:row.revision,...review(decrypt(row.cipher,'archive'))},null,2));
}catch{console.error('Không hoàn tất đối chiếu. Kiểm tra cấu hình/kết nối riêng tư tại môi trường được phép; không gửi URL hoặc khóa.');process.exitCode=1;}
finally{await db().end();}
