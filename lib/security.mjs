import {randomBytes,scrypt as scryptCallback,timingSafeEqual,createCipheriv,createDecipheriv,createHash,createHmac} from 'node:crypto';
import {promisify} from 'node:util';
const runScrypt=promisify(scryptCallback);let activeKdf=0;
async function scrypt(...args){if(activeKdf>=2)throw fail('Máy chủ đang xác thực. Thử lại sau ít giây.',429);activeKdf++;try{return await runScrypt(...args);}finally{activeKdf--;}}
export const fail=(message,status=400)=>Object.assign(new Error(message),{status});
export function passwordPolicy(p){if(typeof p!=='string'||[...p].length<12||[...p].length>128||!/[^\p{L}\p{N}\s]/u.test(p))throw fail('Mật khẩu cần 12–128 ký tự, có ít nhất một ký tự đặc biệt.');}
export async function hashPassword(p){passwordPolicy(p);const salt=randomBytes(16).toString('hex');const hash=await scrypt(p,salt,64,{N:131072,r:8,p:1,maxmem:160*1024*1024});return 'scrypt$'+salt+'$'+hash.toString('hex');}
export async function verifyPassword(p,encoded){if(typeof p!=='string'||p.length>512)return false;const [type,salt,hex]=String(encoded).split('$');if(type!=='scrypt'||!salt||!/^[a-f0-9]{128}$/.test(hex||''))return false;const candidate=await scrypt(p,salt,64,{N:131072,r:8,p:1,maxmem:160*1024*1024});return timingSafeEqual(candidate,Buffer.from(hex,'hex'));}
export function key(name){const k=Buffer.from(process.env[name]||'','base64');if(k.length!==32)throw Error('Missing valid '+name);return k;}
export function encrypt(value,context,name='DATA_KEY'){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key(name),iv);c.setAAD(Buffer.from(context));const ciphertext=Buffer.concat([c.update(JSON.stringify(value),'utf8'),c.final()]);return JSON.stringify({v:1,iv:iv.toString('base64'),tag:c.getAuthTag().toString('base64'),data:ciphertext.toString('base64')});}
export function decrypt(envelope,context,name='DATA_KEY'){const e=JSON.parse(envelope);if(e.v!==1)throw Error('Unknown cipher version');const d=createDecipheriv('aes-256-gcm',key(name),Buffer.from(e.iv,'base64'));d.setAAD(Buffer.from(context));d.setAuthTag(Buffer.from(e.tag,'base64'));return JSON.parse(Buffer.concat([d.update(Buffer.from(e.data,'base64')),d.final()]).toString('utf8'));}
export const digest=s=>createHash('sha256').update(s).digest('hex');
export const opaque=()=>randomBytes(32).toString('base64url');
export function equal(a,b){const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&timingSafeEqual(x,y);}
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function totpSecret(){const b=randomBytes(20);let bits='';for(const n of b)bits+=n.toString(2).padStart(8,'0');return bits.match(/.{5}/g).map(n=>alphabet[parseInt(n,2)]).join('');}
export function totp(secret,step=Math.floor(Date.now()/30000)){let bits='';for(const ch of secret)bits+=alphabet.indexOf(ch).toString(2).padStart(5,'0');const b=Buffer.from(bits.match(/.{8}/g).map(n=>parseInt(n,2))),counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(step));const h=createHmac('sha1',b).update(counter).digest(),o=h[h.length-1]&15;return String((h.readUInt32BE(o)&0x7fffffff)%1000000).padStart(6,'0');}
export function verifyTotp(secret,code,last=-1,now=Date.now()){if(!/^\d{6}$/.test(String(code)))return null;const step=Math.floor(now/30000);for(const n of [step,step-1,step+1])if(n>Number(last)&&equal(totp(secret,n),code))return n;return null;}
export function validateArchive(a){
 if(!a||a.version!==2||!a.terms||Array.isArray(a.terms)||!Object.hasOwn(a.terms,a.active))throw fail('Cấu trúc bản lưu không hợp lệ.');
 const terms=Object.entries(a.terms);if(terms.length>120)throw fail('Vượt 120 học kỳ.');
 let count=0;const walk=(v,depth=0)=>{if(++count>3000000||depth>35)throw fail('Dữ liệu quá lớn hoặc quá sâu.');if(typeof v==='string'){if(v.length>100000||/[<>]/.test(v)||/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(v))throw fail('Dữ liệu chứa ký tự đánh dấu không được hỗ trợ.');}else if(v&&typeof v==='object'){for(const [k,x]of Object.entries(v)){if(['__proto__','prototype','constructor'].includes(k))throw fail('Khóa dữ liệu không hợp lệ.');walk(x,depth+1);}}};
 for(const [id,t]of terms){if(!/^[A-Za-z0-9_-]{1,50}$/.test(id)||!t||!Array.isArray(t.students)||!Array.isArray(t.records)||t.students.length>30000||t.records.length>150000)throw fail('Học kỳ hoặc số dòng vượt giới hạn.');const ids=new Set();for(const s of t.students){if(!/^[\p{L}\p{N}._-]{1,60}$/u.test(s.id||'')||!s.name||ids.has(s.id))throw fail('MSSV trùng hoặc hồ sơ thiếu thông tin.');ids.add(s.id);}for(const r of t.records)if(!r.id||!r.subject||!Number.isFinite(r.slots)||r.slots<=0||!Number.isFinite(r.absent)||r.absent<0)throw fail('Dòng điểm danh không hợp lệ.');}
 const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
 if(a.registry!==undefined){if(!object(a.registry)||!object(a.registry.students||{})||!Array.isArray(a.registry.events||[])||!object(a.registry.seen||{}))throw fail('Cấu trúc hồ sơ tổng không hợp lệ.');for(const [id,s]of Object.entries(a.registry.students||{}))if(!object(s)||s.id!==id||!s.name||!/^[\p{L}\p{N}._-]{1,60}$/u.test(id))throw fail('Hồ sơ tổng thiếu mã số hoặc họ tên.');}
 if(a.studentServices!==undefined){if(!object(a.studentServices))throw fail('Cấu trúc dịch vụ không hợp lệ.');for(const kind of ['certificates','insurance','audit'])if(a.studentServices[kind]!==undefined&&!Array.isArray(a.studentServices[kind]))throw fail('Danh sách dịch vụ không hợp lệ.');}
 if(a.importBatches!==undefined&&!Array.isArray(a.importBatches))throw fail('Lịch sử file nhập không hợp lệ.');
 walk(a);return a;
}
export function assertOrigin(req){if(!/^https:\/\/[^/]+$/.test(process.env.APP_ORIGIN||'')||req.headers.origin!==process.env.APP_ORIGIN||req.headers['x-sc-request']!=='1')throw fail('Yêu cầu không hợp lệ.',403);}
export function publicUser(u){return {username:u.username,displayName:u.display_name,role:u.role,active:u.active,mustChange:u.must_change,permissions:u.permissions||{}};}
