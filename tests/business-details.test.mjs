import test from 'node:test';import assert from 'node:assert/strict';import D from '../lib/business-details.cjs';
const token=v=>'ref-'+Buffer.from(v).toString('hex').slice(-12);const row=(id,group='G1',slots=40,date='2026-11-18')=>({id,name:'SECRET NAME',email:'secret@example.test',note:'SECRET NOTE',subject:'A',group,slots,date,part:1});
test('outside-roster records count unique people separately and diagnose master/format mismatches without mutation or raw PII',()=>{
 const a={registry:{students:{S:{name:'SECRET NAME'}}},terms:{'2026-FALL':{students:[{id:'S'}],records:[row(' s '),row(' s ','G2'),row('MISSING')]}}};
 const before=JSON.stringify(a),out=D(a,token),x=out.terms[0].outsideRoster;assert.equal(x.recordCount,3);assert.equal(x.uniqueStudents,2);assert.equal(x.possibleRosterFormattingMismatch,1);assert.equal(x.missingMasterExact,2);assert.equal(x.students[0].masterNormalizedMatches,1);assert(!/SECRET|secret@|MISSING| s /.test(JSON.stringify(out)));assert.equal(JSON.stringify(a),before);
});
test('changed slots and multi-group review keeps source ranges/parts and does not decide transfer versus retake',()=>{
 const a={terms:{T:{students:[{id:'S'}],records:[row('S','G1',40,'2026-10-01'),row('S','G1',70),{...row('S','G2'),part:2}]}}};
 const out=D(a,token).terms[0];assert.equal(out.changedTotalSlotsCount,1);assert.deepEqual(out.changedTotalSlots[0].slotVariants.map(x=>x.slots),[40,70]);assert.equal(out.multipleGroupsCount,1);assert.equal(out.multipleGroups[0].decision,'needs_review_not_inferred');
});
test('roster normalization collisions are flagged, large samples bounded and identities mandatory masked',()=>{
 const a={terms:{T:{students:[{id:'S'},{id:' s '}],records:Array.from({length:105},(_,i)=>row('PRIVATE'+i))}}};
 const out=D(a,token).terms[0].outsideRoster;assert.equal(out.normalizedRosterCollisionKeys,1);assert.equal(out.students.length,100);assert.equal(out.omittedStudents,5);assert.throws(()=>D(a));
});
