'use strict';
// Additive study-attempt model. Never edits legacy attendance, profiles or Follow.
const copy=v=>JSON.parse(JSON.stringify(v)),own=(o,k)=>Object.hasOwn(o,k);
const day=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
const text=(s,label)=>{if(typeof s!=='string'||!s.trim()||s.length>100||/[<>\x00-\x1f]/.test(s)||['__proto__','constructor','prototype'].includes(s))throw Error(label+' không hợp lệ.');return s.trim();};
const fresh=()=>({version:2,offerings:{},attempts:{},bindings:{},snapshots:{},events:{},audit:[]});
function state(t){
 const l=copy(t.studyLedger||fresh());
 if(![1,2].includes(l.version))throw Error('Phiên bản lượt học chưa được hỗ trợ.');
 if(l.version===1){
  const bindings={};for(const a of Object.values(l.attempts))for(const m of a.memberships){const k=bindingKey(a.studentId,m.offeringId);if(own(bindings,k))throw Error('Liên kết lượt học cũ xung đột.');bindings[k]=a.id;}
  l.bindings=bindings;l.version=2;
 }
 return l;
}
function stamp(l,actor,action,detail){l.audit.push({action,actor:text(actor,'Người xác nhận'),detail,at:new Date().toISOString()});return l;}
const bindingKey=(studentId,offeringId)=>JSON.stringify([studentId,offeringId]);
function resolve(ledger,row){
 let candidates=Object.values(ledger.offerings).filter(o=>o.subject===row.subject&&o.group===row.group);
 if(row.offeringId)candidates=candidates.filter(o=>o.id===row.offeringId);
 if(row.part!==undefined)candidates=candidates.filter(o=>o.part===row.part||o.part==='full');
 candidates=candidates.filter(o=>own(ledger.bindings,bindingKey(row.id,o.id)));
 if(row.attemptId)candidates=candidates.filter(o=>ledger.bindings[bindingKey(row.id,o.id)]===row.attemptId);
 if(candidates.length!==1)return {issue:candidates.length?'ambiguous_attempt':'unresolved_attempt',offeringIds:candidates.map(o=>o.id)};
 const o=candidates[0],attemptId=ledger.bindings[bindingKey(row.id,o.id)],a=ledger.attempts[attemptId];
 if(!a||a.studentId!==row.id||a.subject!==row.subject)return {issue:'invalid_binding'};
 return {offeringId:o.id,attemptId,attempt:a};
}
function reviseOffering(term,id,patch,actor){
 const l=state(term),o=l.offerings[id];
 if(!o||!patch||Object.keys(patch).some(k=>!['start','end'].includes(k)))throw Error('Chỉ cập nhật lịch lớp; đổi môn, Part hoặc slot cần đối chiếu riêng.');
 const next={...o,...patch};if(!day(next.start)||!day(next.end)||next.start>next.end)throw Error('Ngày lớp không hợp lệ.');
 l.offerings[id]=next;return stamp(l,actor,'offering_dates_update',{offeringId:id,before:{start:o.start,end:o.end},after:{start:next.start,end:next.end}});
}
function offering(term,input,actor){
 const l=state(term),o=copy(input);o.id=text(o.id,'Mã lớp mở');o.subject=text(o.subject,'Mã môn');o.group=text(o.group,'Nhóm lớp');
 if(own(l.offerings,o.id)||!term.courseCatalog?.some(c=>c.subject===o.subject))throw Error('Mã lớp mở trùng hoặc môn chưa có trong danh mục kỳ.');
 if(![1,2,'full'].includes(o.part)||!Number.isInteger(o.slots)||o.slots<1||o.slots>10000||typeof o.slotsConfirmed!=='boolean'||!day(o.start)||!day(o.end)||o.start>o.end)throw Error('Kiểm tra Part, tổng slot và thời gian lớp.');
 l.offerings[o.id]={...o,status:'open'};return stamp(l,actor,'offering_create',o.id);
}
function open(term,master,input,actor){
 const l=state(term),o=l.offerings[input.offeringId];if(!o)throw Error('Lớp chưa được xác định.');
 const id=text(input.id,'Mã lượt học'),studentId=text(input.studentId,'MSSV');if(own(l.attempts,id)||!own(master,studentId)||!term.students?.some(s=>s.id===studentId))throw Error('Lượt học trùng hoặc MSSV chưa có trong hồ sơ gốc/danh sách kỳ.');
 if(!['new','retake'].includes(input.kind))throw Error('Phải xác nhận học mới hoặc học lại.');
 const prior=Object.values(l.attempts).filter(a=>a.studentId===studentId&&a.subject===o.subject);
 if(input.kind==='new'&&prior.length)throw Error('Đã có lượt học môn này; xác nhận học lại hoặc học tiếp.');
 const parent=input.kind==='retake'?l.attempts[input.parentId]:null;
 if(input.kind==='retake'&&(!parent||parent.studentId!==studentId||parent.subject!==o.subject))throw Error('Học lại phải đối chiếu đúng lượt trước.');
 const key=bindingKey(studentId,o.id);if(own(l.bindings,key))throw Error('Nhóm này đã gắn lượt học; không tự gộp hoặc chia lại.');
 const a={id,studentId,subject:o.subject,startPart:o.part,kind:input.kind,parentId:parent?.id||null,number:parent?parent.number+1:1,slots:o.slots,slotsConfirmed:o.slotsConfirmed,status:'active',memberships:[{offeringId:o.id,start:o.start,end:o.end}]};
 l.attempts[id]=a;l.bindings[key]=id;return stamp(l,actor,'attempt_create',id);
}
function link(term,attemptId,offeringId,kind,actor){
 const l=state(term),a=l.attempts[attemptId],o=l.offerings[offeringId];if(!a||!o||!['continue','transfer'].includes(kind)||a.subject!==o.subject)throw Error('Chưa đối chiếu đúng lượt học/lớp hoặc loại chuyển tiếp.');
 if(a.slots!==o.slots||!o.slotsConfirmed||!a.slotsConfirmed)throw Error('Cần xác nhận cùng tổng slot chính thức trước khi nối lớp.');
 const key=bindingKey(a.studentId,o.id);if(own(l.bindings,key))throw Error('Nhóm đã được gắn; không tự ghi đè.');
 a.memberships.push({offeringId:o.id,start:o.start,end:o.end,kind});l.bindings[key]=a.id;return stamp(l,actor,kind,a.id+' → '+o.id);
}
function importRows(term,rows,{mode,confirmCorrections=false,weights={}}={},actor){
 if(!['cumulative','detail'].includes(mode))throw Error('Chọn rõ lũy kế hoặc điểm danh chi tiết.');
 const l=state(term),accepted=[],issues=[],changes=[],batch=new Map();
 for(const raw of rows){
  const r=copy(raw),resolved=resolve(l,r),attemptId=resolved.attemptId,a=resolved.attempt;
  if(resolved.issue){issues.push({type:resolved.issue,offeringIds:resolved.offeringIds||[]});continue;}
  if(!day(r.date)){issues.push({type:'invalid_date'});continue;}
  const store=mode==='cumulative'?l.snapshots:l.events;let key,value;
  if(mode==='cumulative'){
   if(!Number.isInteger(r.absent)||r.absent<0||r.absent>a.slots||r.slots!==a.slots){issues.push({type:'invalid_or_unconfirmed_source_slots'});continue;}
   key=JSON.stringify([a.id,r.date]);value={attemptId:a.id,date:r.date,absent:r.absent,mode};
  }else{
   if(typeof r.eventId!=='string'||!r.eventId||!own(weights,r.attendanceStatus)||!Number.isFinite(weights[r.attendanceStatus])||weights[r.attendanceStatus]<0){issues.push({type:'unmapped_detail_status_or_event'});continue;}
   key=JSON.stringify([a.id,r.eventId]);value={attemptId:a.id,date:r.date,eventId:r.eventId,absent:weights[r.attendanceStatus],mode};
  }
  if(batch.has(key)&&batch.get(key)!==JSON.stringify(value))throw Error('Lô nhập có số liệu xung đột; không áp dụng lô.');batch.set(key,JSON.stringify(value));
  const other=Object.values(mode==='cumulative'?l.events:l.snapshots).some(x=>x.attemptId===a.id);
  if(other){issues.push({type:'mixed_modes_require_review'});continue;}
  const before=store[key];if(before&&JSON.stringify(before)===JSON.stringify(value)){changes.push({type:'unchanged',attemptId:a.id,date:r.date});continue;}
  if(before&&!confirmCorrections){issues.push({type:'correction_requires_confirmation',attemptId:a.id,date:r.date,before:copy(before),after:value});continue;}
  const sameKey=accepted.find(x=>x.key===key);
  if(sameKey&&JSON.stringify(sameKey.value)!==JSON.stringify(value))throw Error('Lô nhập có số liệu xung đột cho cùng lượt/ngày hoặc sự kiện; không áp dụng lô.');
  store[key]=value;accepted.push({key,value});changes.push({type:before?'correct':'add',attemptId:a.id,date:r.date});
 }
 if(accepted.length)stamp(l,actor,'attendance_import',{mode,accepted:accepted.length});
 return {ledger:l,accepted:accepted.length,issues,changes};
}
function metric(ledger,attemptId,asof,{early=10,limit=25}={}){
 const a=ledger.attempts[attemptId];if(!a||!day(asof)||!Number.isFinite(early)||!Number.isFinite(limit)||early<0||early>limit||limit>100)throw Error('Lượt học, ngày hoặc ngưỡng không hợp lệ.');
 const snapshots=Object.values(ledger.snapshots).filter(x=>x.attemptId===a.id&&x.date<=asof).sort((x,y)=>y.date.localeCompare(x.date)),events=Object.values(ledger.events).filter(x=>x.attemptId===a.id&&x.date<=asof);
 const absent=snapshots.length?snapshots[0].absent:events.length?events.reduce((n,x)=>n+x.absent,0):0;
 if(absent>a.slots)throw Error('Vắng vượt tổng slot; cần đối chiếu.');
 const rate=absent/a.slots*100;
 return {attemptId:a.id,studentId:a.studentId,subject:a.subject,absent,slots:a.slots,rate,official:a.slotsConfirmed,state:!a.slotsConfirmed?'unconfirmed_slots':!snapshots.length&&!events.length?'no_data':absent*100>limit*a.slots?'over':absent*100===limit*a.slots?'at_limit':absent*100>=early*a.slots?'early':'normal',remaining:a.slotsConfirmed?Math.max(0,Math.floor(limit*a.slots/100+1e-9)-absent):null};
}
function calendar(input){
 const {year,term,start,end,parts}=input;if(!Number.isInteger(year)||year<2000||year>2100||!['SPR','SUM','FALL'].includes(term)||!day(start)||!day(end)||start>end||!Array.isArray(parts)||parts.length!==2)throw Error('Lịch kỳ không hợp lệ.');
 const sorted=[...parts].sort((a,b)=>a.part-b.part);if(sorted.some((p,i)=>p.part!==i+1||!day(p.start)||!day(p.end)||p.start>p.end||p.start<start||p.end>end)||sorted[0].end>=sorted[1].start)throw Error('Thời gian hai Part không hợp lệ hoặc chồng lấn.');
 return {year,term,termId:year+'-'+term,start,end,parts:copy(sorted)};
}
module.exports={fresh,offering,open,link,importRows,metric,calendar,bindingKey,resolve,reviseOffering};
