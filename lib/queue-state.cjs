(function(root){
'use strict';
const key=r=>JSON.stringify([r.id,r.subject,r.group||'']);
function pending(term,rows,asof){
 const records=new Map(),resolved=new Map();
 for(const r of term.records||[])if(r.date<=asof){const k=key(r);if(!records.has(k))records.set(k,[]);records.get(k).push(r);}
 for(const f of Object.values(term.dailyFollow||{}))if(f.status==='resolved'&&f.date<=asof){const k=key(f),old=resolved.get(k);if(!old||f.date>old.date)resolved.set(k,f);}
 return rows.filter(row=>{
  const k=key(row),done=resolved.get(k);if(!done)return true;
  const list=records.get(k)||[];let base=done.resolvedAttendance;
  if(!base||!base.date||!Number.isInteger(base.absent)||!Number.isInteger(base.slots)||base.slots<=0)base=list.filter(r=>r.date<=done.date).sort((a,b)=>b.date.localeCompare(a.date))[0];
  if(!base)return true;
  // Once changed, keep pending even if the ratio later returns to its former value.
  return list.some(r=>r.date>=base.date&&r.date<=row.date&&r.absent*base.slots!==base.absent*r.slots);
 });
}
// One latest completion per student/course/group in the selected term. Historical
// audit entries preserve a completion even if a later edit changes its live status.
function completed(term,asof){
 const result=new Map();
 for(const f of [...(term.followAudit||[]),...Object.values(term.dailyFollow||{})]){
  if(f.status!=='resolved'||!f.id||typeof f.date!=='string'||f.date>asof||!f.subject&&!f.resolvedMissing)continue;
  const k=key(f),old=result.get(k);if(!old||f.date>=old.date)result.set(k,{...f,actor:f.actor||(old?.date===f.date?old.actor:'')||''});
 }
 return [...result.values()].sort((a,b)=>b.date.localeCompare(a.date)||String(a.id).localeCompare(String(b.id)));
}
function pendingMissing(term,students,asof){const handled=new Set(completed(term,asof).filter(f=>f.resolvedMissing&&!f.subject).map(f=>f.id));return students.filter(s=>!handled.has(s.id));}
const api={pending,completed,pendingMissing};if(typeof module==='object'&&module.exports)module.exports=api;else root.StudentQueueState=api;
})(typeof window==='object'?window:globalThis);
