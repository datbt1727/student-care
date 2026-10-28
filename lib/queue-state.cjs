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
const api={pending};if(typeof module==='object'&&module.exports)module.exports=api;else root.StudentQueueState=api;
})(typeof window==='object'?window:globalThis);
