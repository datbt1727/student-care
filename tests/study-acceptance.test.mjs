import test from 'node:test';import assert from 'node:assert/strict';
import D from '../lib/study-decisions.cjs';import I from '../lib/attendance-import.cjs';import P from '../lib/parts.cjs';import Q from '../lib/queue-state.cjs';import R from '../lib/report-index.cjs';
const row=(date,absent,group='REUSED',part=2,slots=40)=>({id:'FIXTURE-STUDENT',name:'Synthetic student',term:'FALL 2026',subject:'VOG112',group,part,date,slots,absent,start:'2026-11-01',end:'2026-12-31'});
const term=records=>({termId:'2026-FALL',students:[{id:'FIXTURE-STUDENT',name:'Synthetic student'}],records,importFiles:[],dailyFollow:{},courseCatalog:[{subject:'VOG112',name:'Synthetic course'}]});
test('acceptance: reused group in same Part has separate snapshots, Follow and completion across corrected source dates',()=>{
 const t=term([row('2026-11-01',10),row('2026-11-18',2)]),raw=structuredClone(t.records);
 const d=D.prepare(t,{studentId:'FIXTURE-STUDENT',subject:'VOG112',kind:'retake',source:{group:'REUSED',part:2,from:'2026-11-01',to:'2026-11-10'},target:{group:'REUSED',part:2,from:'2026-11-11',to:'2026-12-31'}},'acceptance-retake','fixture-admin');t.studyDecisions=[d];
 let incoming={...row('2026-11-18',2),start:'2026-11-16',end:'2027-01-05',attemptId:d.targetAttempt.id};
 const plan=I.plan(t,[{name:'synthetic.xlsx',rows:[incoming]}],2,'2026-FALL');assert.equal(plan.rows.length,1);assert.equal(plan.rows[0].attemptId,d.targetAttempt.id);assert.equal(plan.rows[0].absent,2);
 const projected=D.project(t),old=projected.records[0],fresh=projected.records[1];assert.notEqual(D.key(old),D.key(fresh));
 t.dailyFollow={old:{...old,note:'First attempt only',status:'resolved',resolvedAttendance:{date:old.date,absent:old.absent,slots:old.slots}},fresh:{...fresh,note:'Retake only'}};
 const data=D.project(t),groups=R.build(data.records,Object.values(data.dailyFollow)).get('VOG112');assert.equal(groups.size,2);
 assert.deepEqual(groups.get('REUSED · Lượt 1').notes.get(JSON.stringify(['FIXTURE-STUDENT','2026-11-01'])),['First attempt only']);assert.deepEqual(groups.get('REUSED · Lượt 2').notes.get(JSON.stringify(['FIXTURE-STUDENT','2026-11-18'])),['Retake only']);
 assert.equal(Q.pending(data,[fresh],'2026-11-18').length,1);assert.deepEqual(t.records,raw);
});
test('acceptance: continuation transfer imports cumulative 15/70 then 16/70, keeps same attempt and never sums snapshots',()=>{
 const t=term([row('2026-10-01',7,'CLASS-A',1,70),row('2026-11-18',15,'CLASS-B',2,70)]),raw=structuredClone(t.records);
 const d=D.prepare(t,{studentId:'FIXTURE-STUDENT',subject:'VOG112',kind:'transfer',source:{group:'CLASS-A',part:1},target:{group:'CLASS-B',part:2},cumulativeConfirmed:true},'acceptance-transfer','fixture-admin');t.studyDecisions=[d];
 const plan=I.plan(t,[{name:'synthetic.xlsx',rows:[{...row('2026-11-19',16,'CLASS-B',2,70),attemptId:d.targetAttempt.id}]}],2,'2026-FALL');assert.equal(plan.writeRows.length,1);
 const updated={...t,records:[...t.records,...plan.writeRows]},scope=P.scope(updated,'2');assert.equal(new Set(scope.records.map(D.key)).size,1);assert.equal(scope.records.at(-1).absent,16);assert.equal(scope.records.at(-1).slots,70);
 assert.equal(I.plan(updated,[{name:'renamed.xlsx',rows:[{...row('2026-11-19',16,'CLASS-B',2,70),attemptId:d.targetAttempt.id}]}],2,'2026-FALL').writeRows.length,0);assert.deepEqual(t.records,raw);
});
test('acceptance: mixed valid and unknown student rows import only the approved student without creating master profiles',()=>{
 const t=term([row('2026-10-01',10,'OLD',1),row('2026-11-18',2,'NEW',2)]);const d=D.prepare(t,{studentId:'FIXTURE-STUDENT',subject:'VOG112',kind:'retake',source:{group:'OLD',part:1},target:{group:'NEW',part:2}},'acceptance-mixed','fixture-admin');t.studyDecisions=[d];
 const valid={...row('2026-11-19',3,'NEW'),attemptId:d.targetAttempt.id},unknown={...valid,id:'UNKNOWN-STUDENT'},before=structuredClone(t);const p=I.plan(t,[{name:'synthetic.xlsx',rows:[valid,unknown]}],2,'2026-FALL');assert.equal(p.writeRows.length,1);assert.equal(p.writeRows[0].id,'FIXTURE-STUDENT');assert.deepEqual(t,before);
});
test('acceptance: class dates alone never authorize a transfer and conflicting cumulative snapshots block confirmation',()=>{
 const t=term([row('2026-10-01',7,'A',1,70),row('2026-11-18',15,'B',2,70)]),choice={studentId:'FIXTURE-STUDENT',subject:'VOG112',kind:'transfer',source:{group:'A',part:1},target:{group:'B',part:2}};
 assert.throws(()=>D.prepare(t,choice,'acceptance-guard','fixture-admin'),/lũy kế/);t.records.push(row('2026-11-18',14,'A',1,70));const d=D.prepare(t,{...choice,cumulativeConfirmed:true},'acceptance-conflict','fixture-admin');assert.throws(()=>D.summary(t,d),/Cùng lượt/);
});
