import test from 'node:test';import assert from 'node:assert/strict';import review from '../lib/business-audit.cjs';
test('aggregate audit preserves archive, distinguishes unique people/memberships and never outputs PII',()=>{
 const row={id:'PRIVATE-ID',name:'PRIVATE NAME',subject:'A',group:'G',date:'2026-11-18',slots:40,absent:8,part:1};
 const a={registry:{students:{'PRIVATE-ID':{name:'PRIVATE NAME',email:'private@example.test'}}},terms:{'2026-FALL':{students:[{id:'PRIVATE-ID'}],records:[row,{...row,group:'NEW',part:2}]},'2027-SPR':{students:[{id:'PRIVATE-ID'}],records:[]}}};
 const before=JSON.stringify(a),out=review(a);assert.equal(out.uniqueEnrolledStudents,1);assert.equal(out.termMembershipCount,2);assert.equal(out.issueCounts.student_course_multiple_groups_needs_review,1);assert.equal(JSON.stringify(a),before);assert(!/PRIVATE|private@/.test(JSON.stringify(out)));
});
test('missing master, conflicting slots and duplicate keys are counted without automatically repairing records',()=>{
 const a={terms:{T:{students:[{id:'S'}],records:[{id:'S',subject:'A',group:'G',date:'d',slots:40},{id:'S',subject:'A',group:'G',date:'d',slots:70}]}}};
 const out=review(a);assert.equal(out.issueCounts.term_student_missing_master,1);assert.equal(out.issueCounts.duplicate_attendance_key,1);assert.equal(out.issueCounts.group_with_changed_total_slots,1);assert.equal(a.terms.T.records.length,2);
});
