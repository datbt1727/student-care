'use strict';
// Aggregate-only, immutable audit. No student IDs, names, notes or ciphertext in output.
module.exports=function reviewArchive(a){
 const master=a.registry?.students||{},issueCounts={},inc=(k,n=1)=>issueCounts[k]=(issueCounts[k]||0)+n;
 let memberships=0,records=0;const people=new Set(),terms=[];
 for(const [tid,t]of Object.entries(a.terms||{})){
  const roster=new Set(),keys=new Set(),groups=new Map(),studentCourses=new Map();
  for(const s of t.students||[]){memberships++;people.add(s.id);if(roster.has(s.id))inc('duplicate_term_student');roster.add(s.id);if(!Object.hasOwn(master,s.id))inc('term_student_missing_master');}
  for(const r of t.records||[]){
   records++;if(!roster.has(r.id))inc('attendance_outside_term_roster');
   const key=JSON.stringify([r.id,r.subject,r.group||'',r.date]);if(keys.has(key))inc('duplicate_attendance_key');keys.add(key);
   if(![1,2,'full'].includes(r.part))inc('legacy_part_unclassified');
   const g=JSON.stringify([r.subject,r.group||'']);if(!groups.has(g))groups.set(g,{slots:new Set(),parts:new Set()});groups.get(g).slots.add(r.slots);groups.get(g).parts.add(r.part);
   const sc=JSON.stringify([r.id,r.subject]);if(!studentCourses.has(sc))studentCourses.set(sc,new Set());studentCourses.get(sc).add(r.group||'');
   if(!r.attemptId)inc('record_without_attempt_id');
  }
  for(const g of groups.values()){if(g.slots.size>1)inc('group_with_changed_total_slots');if(g.parts.has(1)&&g.parts.has(2))inc('group_with_two_unlinked_parts');}
  for(const gs of studentCourses.values())if(gs.size>1)inc('student_course_multiple_groups_needs_review');
  if(!t.academicYearId)inc('term_without_academic_year_mapping');
  terms.push({termId:tid,studentCount:roster.size,recordCount:(t.records||[]).length,groupCount:groups.size});
 }
 return {format:1,readOnly:true,masterStudentCount:Object.keys(master).length,uniqueEnrolledStudents:people.size,termMembershipCount:memberships,attendanceRecordCount:records,terms,issueCounts,warning:'Counts are review candidates, not proven errors. Missing source days are not absences. Do not auto-migrate from this report.'};
};
