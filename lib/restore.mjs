import {normalizePermissions} from './permissions.mjs';
import {decrypt,validateArchive} from './security.mjs';
export async function restoreIntoEmptyDatabase(c,snapshot){
 if(snapshot.format!==1||!Array.isArray(snapshot.tables?.sc_users)||snapshot.tables?.sc_archive?.length!==1||!Array.isArray(snapshot.tables?.sc_audit))throw Error('Invalid backup');
 validateArchive(decrypt(snapshot.tables.sc_archive[0].cipher,'archive'));
 for(const u of snapshot.tables.sc_users)decrypt(u.totp_cipher,'totp:'+u.username);
 await c.query('BEGIN');
 try{
 if(Number((await c.query('SELECT count(*)::int AS n FROM sc_users')).rows[0].n)!==0)throw Error('Target DB must have no accounts; refusing to overwrite.');
 for(const u of snapshot.tables.sc_users)await c.query('INSERT INTO sc_users(username,display_name,role,active,must_change,password_hash,totp_cipher,last_totp_step,created_at,permissions) VALUES($1,$2,$3,$4,true,$5,$6,$7,$8,$9)',[u.username,u.display_name,u.role,u.active,u.password_hash,u.totp_cipher,u.last_totp_step,u.created_at,JSON.stringify(normalizePermissions(u.permissions||{}))]);
 const a=snapshot.tables.sc_archive[0];await c.query('INSERT INTO sc_archive(id,revision,cipher,updated_at) VALUES(1,$1,$2,$3) ON CONFLICT(id) DO UPDATE SET revision=EXCLUDED.revision,cipher=EXCLUDED.cipher,updated_at=EXCLUDED.updated_at',[Number(a.revision)+1,a.cipher,a.updated_at]);
 for(const r of snapshot.tables.sc_audit)await c.query('INSERT INTO sc_audit(at,actor,action,detail) VALUES($1,$2,$3,$4)',[r.at,r.actor,r.action,r.detail]);
 await c.query('INSERT INTO sc_audit(actor,action,detail) VALUES($1,$2,$3)',['recovery','restore_test',snapshot.at]);await c.query('COMMIT');
 }catch(e){await c.query('ROLLBACK');throw e;}
}
