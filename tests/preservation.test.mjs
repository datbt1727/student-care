import test from 'node:test';import assert from 'node:assert/strict';import compare from '../lib/preservation.cjs';
const before={registry:{students:{S:{name:'PRIVATE'}}},terms:{T:{students:[{id:'S'}],records:[{id:'S',subject:'A',group:'OLD',date:'2026-10-01',absent:10,slots:40}]}}};
test('new AEG class/records/notes never require loss of original records; preservation comparison is immutable and aggregate only',()=>{
 const after=structuredClone(before);after.terms.T.records.push({id:'S',subject:'A',group:'NEW',date:'2026-11-18',absent:2,slots:40});after.terms.T.notes={S:[{text:'new note'}]};const snap=JSON.stringify(before),out=compare(before,after);assert.equal(out.originalAttendancePreserved,true);assert.equal(out.originalStudentMembershipPreserved,true);assert.equal(JSON.stringify(before),snap);assert(!JSON.stringify(out).includes('PRIVATE'));
});
test('same record count cannot conceal changed slots, removal/replacement or lost master/term membership',()=>{
 const after=structuredClone(before);after.terms.T.records[0].slots=70;let out=compare(before,after);assert.equal(out.originalAttendancePreserved,false);assert.equal(out.changedOriginalRecords,1);
 after.terms.T.records[0].group='OTHER';delete after.registry.students.S;after.terms.T.students=[];out=compare(before,after);assert.equal(out.missingOriginalRecords,1);assert.equal(out.originalMasterProfilesPresent,false);assert.equal(out.originalStudentMembershipPreserved,false);
});

test('property order alone is not a correction; profile/Follow changes and lost notes are reported separately',()=>{
 const b=structuredClone(before);b.terms.T.dailyFollow={k:{note:'old'}};b.terms.T.notes={S:[{text:'keep'}]};const a=structuredClone(b);a.terms.T.records[0]=Object.fromEntries(Object.entries(a.terms.T.records[0]).reverse());a.registry.students.S.name='changed';a.terms.T.dailyFollow.k.note='new';a.terms.T.notes.S=[];
 const out=compare(b,a);assert.equal(out.originalAttendancePreserved,true);assert.equal(out.changedOriginalProfiles,1);assert.equal(out.changedOrMissingOriginalDailyFollow,1);assert.equal(out.missingOrChangedOriginalNotes,1);
});
