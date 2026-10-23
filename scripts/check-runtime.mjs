import {db} from '../lib/db.mjs';
try{
 const r=(await db().query("SELECT current_user AS name,r.rolsuper,r.rolcreatedb,r.rolcreaterole,r.rolbypassrls,r.rolreplication,has_schema_privilege(current_user,'public','CREATE') AS schema_create,EXISTS(SELECT 1 FROM pg_roles n WHERE n.rolname='neon_superuser' AND pg_has_role(current_user,n.oid,'MEMBER')) AS neon_admin FROM pg_roles r WHERE r.rolname=current_user")).rows[0];
 if(!r||Object.entries(r).some(([k,v])=>k!=='name'&&v))throw Error('Runtime role has excessive privilege. Do not deploy with this connection.');
 console.log('PASS — runtime role không có quyền quản trị/tạo schema:',r.name);
}finally{await db().end();}
