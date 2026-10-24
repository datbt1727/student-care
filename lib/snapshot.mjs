import {decrypt,validateArchive} from './security.mjs';
import {normalizePermissions} from './permissions.mjs';
// Verify both encryption layers and the structures needed for an actual recovery.
export function validateSnapshot(snapshot){
 const tables=snapshot?.tables;
 if(snapshot?.format!==1||!Number.isFinite(Date.parse(snapshot.at))||!Array.isArray(tables?.sc_users)||!tables.sc_users.length||!Array.isArray(tables.sc_archive)||tables.sc_archive.length!==1||!Array.isArray(tables.sc_audit))throw Error('Invalid backup structure');
 const archive=tables.sc_archive[0];
 if(archive.id!==1||!Number.isSafeInteger(archive.revision)||archive.revision<1)throw Error('Invalid backup revision');
 validateArchive(decrypt(archive.cipher,'archive'));
 const seen=new Set();let admins=0;
 for(const u of tables.sc_users){
 if(!/^[a-z0-9._-]{3,60}$/.test(u.username)||seen.has(u.username)||typeof u.display_name!=='string'||!['admin','staff'].includes(u.role)||typeof u.active!=='boolean'||!/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(u.password_hash))throw Error('Invalid backup account');
 seen.add(u.username);if(u.active&&u.role==='admin')admins++;
 if(!/^[A-Z2-7]{32}$/.test(decrypt(u.totp_cipher,'totp:'+u.username)))throw Error('Invalid backup authenticator');
 normalizePermissions(u.permissions||{});
 }
 if(!admins)throw Error('Backup has no active administrator');
 for(const r of tables.sc_audit)if(!Number.isFinite(Date.parse(r.at))||typeof r.actor!=='string'||typeof r.action!=='string'||typeof r.detail!=='string')throw Error('Invalid backup audit');
 return snapshot;
}
