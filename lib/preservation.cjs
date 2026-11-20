'use strict';
const {isDeepStrictEqual:same}=require('node:util');
const key=r=>JSON.stringify([r.id,r.subject,r.group||'',r.date]);
module.exports=function compare(before,after){
 const terms=[];let lost=0,changed=0,studentsLost=0;
 for(const [tid,t]of Object.entries(before.terms||{})){
  const next=after.terms?.[tid],index=new Map((next?.records||[]).map(r=>[key(r),r])),ids=new Set((next?.students||[]).map(s=>s.id));let missing=0,modified=0;
  for(const r of t.records||[]){const n=index.get(key(r));if(!n)missing++;else if(!same(n,r))modified++;}
  const missingStudents=(t.students||[]).filter(s=>!ids.has(s.id)).length;lost+=missing;changed+=modified;studentsLost+=missingStudents;
  terms.push({termId:tid,originalRecords:(t.records||[]).length,currentRecords:(next?.records||[]).length,missingOriginalRecords:missing,changedOriginalRecords:modified,missingOriginalStudents:missingStudents});
 }
 const missingMaster=Object.keys(before.registry?.students||{}).filter(id=>!Object.hasOwn(after.registry?.students||{},id)).length;
 const changedProfiles=Object.entries(before.registry?.students||{}).filter(([id,s])=>Object.hasOwn(after.registry?.students||{},id)&&!same(s,after.registry.students[id])).length;
 let changedFollow=0,lostNotes=0;for(const [tid,t]of Object.entries(before.terms||{})){const next=after.terms?.[tid]||{};for(const [key,f]of Object.entries(t.dailyFollow||{}))if(!same(f,next.dailyFollow?.[key]))changedFollow++;for(const [id,notes]of Object.entries(t.notes||{}))if(Array.isArray(notes))for(const n of notes)if(!(next.notes?.[id]||[]).some(x=>same(n,x)))lostNotes++;}
 return {originalAttendancePreserved:lost===0&&changed===0,originalStudentMembershipPreserved:studentsLost===0,originalMasterProfilesPresent:missingMaster===0,missingOriginalRecords:lost,changedOriginalRecords:changed,missingOriginalMasterProfiles:missingMaster,changedOriginalProfiles:changedProfiles,changedOrMissingOriginalDailyFollow:changedFollow,missingOrChangedOriginalNotes:lostNotes,terms,warning:'Any missing/changed original data requires review. Matching counts alone are insufficient. This tool never restores or writes the database.'};
};
