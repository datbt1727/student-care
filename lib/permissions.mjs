import {isDeepStrictEqual as same} from 'node:util';
import {fail} from './security.mjs';
export const PERMISSION_KEYS=['importData','editProfiles','editFollow','manageServices','deleteData','restoreData','backupData','manageAccounts','viewLogs','manageSettings'];
export function normalizePermissions(value={}){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!PERMISSION_KEYS.includes(k))||Object.values(value).some(v=>typeof v!=='boolean'))throw fail('Danh sách quyền không hợp lệ.');
 const out=Object.fromEntries(PERMISSION_KEYS.map(k=>[k,value[k]===true]));
 if(out.importData&&!out.editProfiles)throw fail('Quyền nhập dữ liệu cần kèm quyền sửa hồ sơ vì file nhập có cập nhật thông tin sinh viên.');
 return out;
}
export function hasPermission(user,key){return user?.role==='admin'||user?.permissions?.[key]===true}
export function requirePermission(user,key){if(!hasPermission(user,key))throw fail('Tài khoản chưa được cấp quyền cho thao tác này.',403)}
export function canWrite(user){return user?.role==='admin'||['importData','editProfiles','editFollow','manageServices','restoreData','manageSettings'].some(k=>hasPermission(user,k))}
const empty=v=>v===undefined||v===null||Array.isArray(v)&&!v.length||v&&typeof v==='object'&&!Array.isArray(v)&&Object.values(v).every(empty);
function unchanged(a,b){return same(a,b)||empty(a)&&empty(b)}
function appendOnly(before=[],after=[],label){if(!Array.isArray(before)||!Array.isArray(after)||after.length<before.length||!same(after.slice(0,before.length),before))throw fail('Không được sửa hoặc xóa lịch sử '+label+'.',403)}
function requireChange(user,key,label){if(!hasPermission(user,key))throw fail('Chưa có quyền thay đổi '+label+'.',403)}
function removedRows(before=[],after=[],key='id'){const id=typeof key==='function'?key:r=>String(r[key]);const remaining=new Set(after.map(id));return before.some(r=>!remaining.has(id(r)))}
// Whole-archive transport remains, but authorization is checked against the locked
// current archive field-by-field. Client role, intent labels and checkbox state are not trusted.
export function authorizeArchive(user,before,after,options={}){
 if(user.role==='admin')return;
 if(options.restore===true){requirePermission(user,'restoreData');if(options.confirmation!=='KHÔI PHỤC DỮ LIỆU')throw fail('Cần xác nhận khôi phục toàn bộ dữ liệu.',403);return}
 if(!canWrite(user))throw fail('Tài khoản chỉ có quyền đọc dữ liệu.',403);
 const roots=['version','active','terms','registry','studentServices','importBatches','statusCodeMap'];
 for(const k of new Set([...Object.keys(before),...Object.keys(after)]))if(!roots.includes(k)&&!unchanged(before[k],after[k]))throw fail('Trường dữ liệu không được phép thay đổi: '+k,403);
 if(!unchanged(before.statusCodeMap,after.statusCodeMap))requireChange(user,'manageSettings','đối chiếu trạng thái');
 if(before.version!==after.version)throw fail('Không được đổi phiên bản cấu trúc.',403);
 if(!after.terms[after.active])throw fail('Học kỳ đang chọn không tồn tại.');
 for(const id of new Set([...Object.keys(before.terms),...Object.keys(after.terms)])){
 let a=before.terms[id];const b=after.terms[id];
 if(!a){requireChange(user,'manageSettings','tạo học kỳ');a={students:[],records:[]}}
 if(!b){requireChange(user,'manageSettings','xóa học kỳ');requireChange(user,'deleteData','xóa dữ liệu');continue}
 for(const k of new Set([...Object.keys(a),...Object.keys(b)])){
 if(unchanged(a[k],b[k]))continue;
 if(k==='students'){requireChange(user,'editProfiles','hồ sơ học kỳ');if(removedRows(a[k],b[k]))requireChange(user,'deleteData','xóa sinh viên');}
 else if(['records','courseCatalog','importFiles','followTemplate','rosterSource','termDataSource','rosterSheets','catalogAudit'].includes(k)){
 requireChange(user,'importData','dữ liệu nhập');if(['records','courseCatalog','importFiles'].includes(k)&&Array.isArray(a[k])&&Array.isArray(b[k])){const key=k==='records'?r=>JSON.stringify([r.id,r.subject,r.group||'',r.date]):k==='courseCatalog'?'subject':'id';if(removedRows(a[k],b[k],key))requireChange(user,'deleteData','xóa dữ liệu nhập');}
 if(k==='importFiles'&&Array.isArray(a[k]))for(const file of a[k]){const next=(b[k]||[]).find(x=>x.id===file.id);if(next&&removedRows(file.records||[],next.records||[],r=>JSON.stringify([r.id,r.subject,r.group||'',r.date])))requireChange(user,'deleteData','xóa bản ghi trong file nhập');}
 if(k==='importFiles'&&Array.isArray(a[k])&&a[k].some(x=>!x.deleted&&b[k]?.find(y=>y.id===x.id)?.deleted))requireChange(user,'deleteData','xóa file nhập');
 }
 else if(['notes','dailyFollow','followAudit'].includes(k)){requireChange(user,'editFollow','ghi chú và Follow');if(k==='followAudit')appendOnly(a[k],b[k],'Follow');}
 else if(k==='trainingAudit'){requireChange(user,'editProfiles','thông tin học kỳ');appendOnly(a[k],b[k],'học kỳ');}
 else if(k==='log'){appendOnly(a[k],b[k],'nhập dữ liệu');}
 else if(['limit','early','termLabel','termId','version'].includes(k)){if(a[k]===undefined&&['termId','version'].includes(k)&&b[k]===(k==='version'?1:id))continue;requireChange(user,'manageSettings','cấu hình học kỳ');}
 else if(k!=='asof')throw fail('Không có quyền thay đổi trường học kỳ '+k+'.',403);
 }
 }
 const oldR=before.registry||{},newR=after.registry||{};
 for(const k of new Set([...Object.keys(oldR),...Object.keys(newR)])){
 if(unchanged(oldR[k],newR[k]))continue;
 if(k==='version'&&oldR[k]===undefined&&newR[k]===1)continue;
 if(['students','events','seen'].includes(k)){requireChange(user,'editProfiles','hồ sơ tổng');if(k==='students'&&Object.keys(oldR.students||{}).some(id=>!Object.hasOwn(newR.students||{},id)))requireChange(user,'deleteData','xóa hồ sơ tổng');if(k==='events')appendOnly(oldR[k],newR[k],'hồ sơ');}
 else if(['statusMap','unmappedStatuses','statusMappings'].includes(k))requireChange(user,'manageSettings','đối chiếu trạng thái');
 else throw fail('Không có quyền thay đổi cấu trúc hồ sơ '+k+'.',403);
 }
 const oldS=before.studentServices||{},newS=after.studentServices||{};
 for(const k of new Set([...Object.keys(oldS),...Object.keys(newS)]))if(!unchanged(oldS[k],newS[k])){if(!['certificates','insurance','audit'].includes(k))throw fail('Trường dịch vụ không hợp lệ.',403);requireChange(user,'manageServices','BHYT và giấy xác nhận');if(k==='audit')appendOnly(oldS[k],newS[k],'dịch vụ');}
 if(!unchanged(before.importBatches,after.importBatches)){requireChange(user,'importData','lịch sử file nhập');if((before.importBatches||[]).some(x=>x.status==='active'&&after.importBatches?.find(y=>y.batchId===x.batchId)?.status!=='active'))requireChange(user,'deleteData','thu hồi file nhập');}
}
