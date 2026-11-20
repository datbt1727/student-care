import test from 'node:test';import assert from 'node:assert/strict';import review from '../lib/study-review.cjs';
const row=(id,group,start,part=1)=>({id,subject:'VOG112',group,start,end:'2026-12-31',part,slots:20,absent:2,date:'2026-11-18'});
test('review finds reused group with changed dates without deciding retake, never rewrites records',()=>{
 const t={students:[{id:'S',name:'Test'}],records:[row('S','SAME','2026-09-01'),row('S','SAME','2026-11-01'),row('OUT','G','2026-09-01')]},before=structuredClone(t),r=review(t);
 assert.equal(r.totalCases,1);assert.deepEqual(r.cases[0].reasons,['source_dates_changed']);assert.equal(r.outsideRecordsPreserved,1);assert.equal(r.cases[0].groups[0].sourceSchedules.length,2);assert(!('suggestedPart' in r.cases[0]));assert.deepEqual(t,before);
});
test('review does not claim clean history proves no future retake; paging rejects invalid bounds',()=>{
 const t={students:[{id:'S'}],records:[row('S','G','2026-09-01')]};assert.equal(review(t).totalCases,0);assert(review(t).warning.includes('vẫn có thể'));
 for(const p of [{offset:-1},{offset:1.1},{limit:0},{limit:101}])assert.throws(()=>review(t,p));
});

test('large source schedule variations are counted but response details remain bounded',()=>{
 const rows=Array.from({length:30},(_,i)=>row('S','G','source-'+i));const r=review({students:[{id:'S'}],records:rows});
 assert.equal(r.cases[0].groups[0].sourceScheduleCount,30);assert.equal(r.cases[0].groups[0].sourceSchedules.length,20);assert.equal(r.cases[0].groups[0].omittedSchedules,10);assert(r.cases[0].reasons.includes('source_dates_changed'));
});
