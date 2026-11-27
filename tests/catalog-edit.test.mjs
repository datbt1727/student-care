import test from 'node:test';
import assert from 'node:assert/strict';
import policy from '../lib/business-policy.cjs';
test('catalog rename keeps source records, notes and attempts; QA resolves old code to new code',()=>{
 const t={termId:'TEST',courseCatalog:[{subject:'OLD1',name:'Old'}],students:[{id:'S1'}],records:[{id:'S1',subject:'OLD1',group:'G',date:'2026-11-27',absent:8,slots:40,attemptId:'stable'}],dailyFollow:{a:{id:'S1',subject:'OLD1',group:'G',date:'2026-11-27',note:'Keep me'}},studyDecisions:[]};
 const before=JSON.stringify(t),next=policy.editCatalog(t,'OLD1','NEW1','New','admin');
 assert.equal(JSON.stringify(t),before);assert.equal(next.records,t.records);assert.equal(next.dailyFollow,t.dailyFollow);
 const sources=policy.followSources(next,next.records,Object.values(next.dailyFollow));
 assert.equal(sources.records[0].subject,'NEW1');assert.equal(sources.records[0].attemptId,'stable');assert.equal(sources.records[0].absent,8);assert.equal(sources.follows[0].note,'Keep me');
 const again=policy.editCatalog(next,'NEW1','NEW2','Newer','admin');assert.deepEqual(again.courseCatalog[0].aliases,['OLD1','NEW1']);assert.equal(again.catalogAudit.length,2);
});
test('rename rejects catalog collisions and a distinct source-only course rather than merging histories',()=>{
 const t={courseCatalog:[{subject:'A',name:'A'},{subject:'B',name:'B'}],records:[{subject:'C'}]};
 assert.throws(()=>policy.editCatalog(t,'A','B','B','admin'),/trùng/);
 assert.throws(()=>policy.editCatalog(t,'A','C','C','admin'),/dữ liệu riêng/);
 assert.throws(()=>policy.catalogCodes([{subject:'A',name:'A',aliases:['B']},{subject:'B',name:'B'}]),/trùng/);
});
