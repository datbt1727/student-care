'use strict';
// Pure read-only diagnostics. Caller supplies a keyed pseudonym; never return raw identities.
const norm=v=>String(v??'').normalize('NFKC').trim().toUpperCase();
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)?v:null;
module.exports=function details(a,token){
 if(typeof token!=='function')throw Error('Pseudonym function required');
 const code=v=>/^[A-Za-z0-9_. /-]{1,60}$/.test(String(v||''))?String(v):token('code:'+String(v));
 const master=a.registry?.students||{},masterNorm=new Map();
 for(const [id,s]of Object.entries(master)){const k=norm(id),ids=masterNorm.get(k)||new Set();ids.add(id);masterNorm.set(k,ids);}
 const terms=[];
 for(const [tid,t]of Object.entries(a.terms||{})){
  const roster=new Set((t.students||[]).map(s=>s.id)),rosterNorm=new Map(),out=new Map(),groups=new Map(),courses=new Map();
  for(const id of roster){const k=norm(id),set=rosterNorm.get(k)||new Set();set.add(id);rosterNorm.set(k,set);}
  for(const r of t.records||[]){
   const id=r.id,sc=JSON.stringify([id,r.subject]),gk=JSON.stringify([r.subject,r.group||'']);
   if(!roster.has(id)){if(!out.has(id))out.set(id,{student:token('student:'+String(id)),records:0,inMasterExact:Object.hasOwn(master,id),masterNormalizedMatches:masterNorm.get(norm(id))?.size||0,rosterNormalizedMatches:rosterNorm.get(norm(id))?.size||0,courses:new Set(),dates:new Set()});const x=out.get(id);x.records++;x.courses.add(r.subject);if(date(r.date))x.dates.add(r.date);}
   if(!groups.has(gk))groups.set(gk,{subject:code(r.subject),group:code(r.group||''),students:new Set(),slots:new Map()});
   const g=groups.get(gk);g.students.add(id);const slot=Number.isInteger(r.slots)&&r.slots>0?r.slots:'invalid';if(!g.slots.has(slot))g.slots.set(slot,{slots:slot,records:0,dates:new Set(),students:new Set()});const x=g.slots.get(slot);x.records++;x.students.add(id);if(date(r.date))x.dates.add(r.date);
   if(!courses.has(sc))courses.set(sc,{student:token('student:'+String(id)),subject:code(r.subject),groups:new Map()});const c=courses.get(sc);
   const key=String(r.group||'');if(!c.groups.has(key))c.groups.set(key,{group:code(key),parts:new Set(),dates:new Set(),records:0,slots:new Set()});const cg=c.groups.get(key);cg.parts.add([1,2,'full'].includes(r.part)?r.part:'unclassified');if(date(r.date))cg.dates.add(r.date);cg.records++;cg.slots.add(slot);
  }
  const range=dates=>{const ds=[...dates].sort();return {first:ds[0]||null,last:ds.at(-1)||null};};
  const outsiders=[...out.values()].map(x=>({student:x.student,records:x.records,inMasterExact:x.inMasterExact,masterNormalizedMatches:x.masterNormalizedMatches,rosterNormalizedMatches:x.rosterNormalizedMatches,courseCount:x.courses.size,...range(x.dates)}));
  const changed=[...groups.values()].filter(g=>g.slots.size>1).map(g=>({subject:g.subject,group:g.group,studentCount:g.students.size,slotVariants:[...g.slots.values()].map(x=>({slots:x.slots,records:x.records,studentCount:x.students.size,...range(x.dates)}))}));
  const multiple=[...courses.values()].filter(c=>c.groups.size>1).map(c=>({student:c.student,subject:c.subject,groups:[...c.groups.values()].map(g=>({group:g.group,parts:[...g.parts],records:g.records,slots:[...g.slots],...range(g.dates)})),decision:'needs_review_not_inferred'}));
  terms.push({termId:code(tid),outsideRoster:{recordCount:outsiders.reduce((n,x)=>n+x.records,0),uniqueStudents:outsiders.length,inMasterExact:outsiders.filter(x=>x.inMasterExact).length,missingMasterExact:outsiders.filter(x=>!x.inMasterExact).length,possibleRosterFormattingMismatch:outsiders.filter(x=>x.rosterNormalizedMatches===1).length,normalizedRosterCollisionKeys:[...rosterNorm.values()].filter(s=>s.size>1).length,students:outsiders.slice(0,100),omittedStudents:Math.max(0,outsiders.length-100)},changedTotalSlots:changed.slice(0,100),changedTotalSlotsCount:changed.length,multipleGroups:multiple.slice(0,100),multipleGroupsCount:multiple.length});
 }
 return {format:2,readOnly:true,pseudonymized:true,terms,warning:'Pseudonyms are not fully anonymous. Do not delete, merge, migrate or infer retakes from this report. Counts alone do not prove data integrity.'};
};
