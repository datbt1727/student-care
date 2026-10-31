(function(root){
'use strict';
function changed(a,term,date){
 const t=a.terms?.[term];if(!t||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error('Chọn học kỳ và ngày hợp lệ.');
 const roster=new Map(t.students.map(s=>[s.id,s])),key=r=>JSON.stringify([r.id,r.subject,r.group||'']),previous=new Map(),seen=new Set(),rows=[],missingRows=[];
 const current=t.records.filter(r=>r.date===date&&roster.has(r.id));let unchanged=0,outsideRange=0;
 for(const r of t.records)if(r.date<date){const k=key(r),old=previous.get(k);if(!old||old.date<r.date)previous.set(k,r);else if(old.date===r.date&&(old.absent!==r.absent||old.slots!==r.slots))throw Error('Có dữ liệu đối chiếu trùng và khác số liệu; kiểm tra file nguồn trước khi xuất.');}
 for(const r of current){
  const k=key(r);if(seen.has(k))throw Error('Trùng sinh viên/môn/nhóm lớp trong ngày chốt. Kiểm tra file nguồn.');seen.add(k);
  if(!Number.isInteger(r.slots)||r.slots<=0||!Number.isInteger(r.absent)||r.absent<0||r.absent>r.slots)throw Error('Số slot điểm danh không hợp lệ.');
  const p=previous.get(k);if(!p){missingRows.push(r);continue}
  if(!Number.isInteger(p.slots)||p.slots<=0||!Number.isInteger(p.absent)||p.absent<0||p.absent>p.slots)throw Error('Số slot đối chiếu không hợp lệ.');
  if(r.absent*p.slots===p.absent*r.slots){unchanged++;continue}
  if(r.absent*100<10*r.slots||r.absent*100>25*r.slots){outsideRange++;continue}
  const s=roster.get(r.id),name=t.courseCatalog?.find(c=>c.subject===r.subject)?.name||'';
  rows.push([r.id,s.name,name,r.subject,{value:r.absent/r.slots*100,type:'points'},s.email||a.registry?.students[r.id]?.email||'',r.group||'',p.date.split('-').reverse().join('/'),{value:p.absent/p.slots*100,type:'points'}]);
 }
 return {rows,missing:missingRows.length,missingRows,current:current.length,unchanged,outsideRange,comparedDates:[...new Set(current.map(r=>previous.get(key(r))?.date).filter(Boolean))].sort(),latestDate:[...new Set(t.records.filter(r=>roster.has(r.id)&&r.date<=date).map(r=>r.date))].sort().at(-1)||''};
}
const api={changed};if(typeof module==='object'&&module.exports)module.exports=api;else root.StudentDailyChanges=api;
})(typeof window==='object'?window:globalThis);
