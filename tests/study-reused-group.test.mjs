import test from 'node:test';import assert from 'node:assert/strict';import L from '../lib/study-ledger.cjs';
const actor='admin',master={S:{id:'S'},T:{id:'T'}};
const initial=()=>({students:[{id:'S'},{id:'T'}],courseCatalog:[{subject:'VOG112'}],records:[{id:'S',subject:'VOG112',group:'GVO2602',absent:6,slots:20,date:'2026-10-27',part:1}],notes:{S:[{text:'old note'}]}});
function offer(t,id,part,group='GVO2602'){return {...t,studyLedger:L.offering(t,{id,subject:'VOG112',group,part,slots:20,slotsConfirmed:true,start:'2026-09-01',end:'2026-12-31'},actor)};}
function open(t,id,offeringId,kind='new',parentId){return {...t,studyLedger:L.open(t,master,{id,studentId:'S',offeringId,kind,parentId},actor)};}
function imported(t,r){return {...t,studyLedger:L.importRows(t,[{id:'S',subject:'VOG112',group:'GVO2602',slots:20,date:'2026-11-18',absent:1,...r}],{mode:'cumulative'},actor).ledger};}
test('same course and group across Parts uses separate offerings/attempts; no inherited absence',()=>{
 let t=open(offer(initial(),'O1',1),'A1','O1');t=imported(t,{offeringId:'O1',date:'2026-10-27',absent:6});t=open(offer(t,'O2',2),'A2','O2','retake','A1');t=imported(t,{offeringId:'O2',absent:1});
 assert.equal(L.metric(t.studyLedger,'A1','2026-11-18').rate,30);assert.equal(L.metric(t.studyLedger,'A2','2026-11-18').rate,5);assert.equal(t.studyLedger.attempts.A2.number,2);
 assert.equal(L.resolve(t.studyLedger,{id:'S',subject:'VOG112',group:'GVO2602'}).issue,'ambiguous_attempt');
 assert.equal(L.resolve(t.studyLedger,{id:'S',subject:'VOG112',group:'GVO2602',part:2}).attemptId,'A2');
 assert.deepEqual(t.records,initial().records);assert.deepEqual(t.notes,initial().notes);
});
test('changing source dates never changes identity, membership, snapshots or creates a new attempt',()=>{
 let t=open(offer(initial(),'O1',1),'A1','O1');t=imported(t,{offeringId:'O1',absent:2});const before=structuredClone(t);
 t={...t,studyLedger:L.reviseOffering(t,'O1',{start:'2026-11-01',end:'2027-01-10'},actor)};
 assert.deepEqual(t.studyLedger.snapshots,before.studyLedger.snapshots);assert.deepEqual(t.studyLedger.attempts,before.studyLedger.attempts);
 assert.equal(L.resolve(t.studyLedger,{id:'S',subject:'VOG112',group:'GVO2602',offeringId:'O1'}).attemptId,'A1');assert.equal(L.importRows(t,[{id:'S',subject:'VOG112',group:'GVO2602',offeringId:'O1',slots:20,date:'2026-11-18',absent:2}],{mode:'cumulative'},actor).accepted,0);
 assert.throws(()=>L.reviseOffering(t,'O1',{part:2},actor));assert.deepEqual(before.studyLedger.offerings.O1.start,'2026-09-01');
});
test('transfer/continue preserves one attempt with cumulative total; missing scope never guesses',()=>{
 let t=open(offer(initial(),'O1',1),'A1','O1');t=imported(t,{offeringId:'O1',date:'2026-10-27',absent:2});
 t=offer(t,'O2',2);t={...t,studyLedger:L.link(t,'A1','O2','continue',actor)};t=imported(t,{offeringId:'O2',absent:3});
 assert.equal(L.metric(t.studyLedger,'A1','2026-11-18').rate,15);assert.equal(Object.keys(t.studyLedger.attempts).length,1);
 const unresolved=L.importRows(t,[{id:'S',subject:'VOG112',group:'GVO2602',date:'2026-11-19',absent:4,slots:20}],{mode:'cumulative'},actor);assert.equal(unresolved.accepted,0);assert.equal(unresolved.issues[0].type,'ambiguous_attempt');
});
test('same Part can reopen same named group; explicit selection required; forged foreign linkage rejected',()=>{
 let t=open(offer(initial(),'O1',1),'A1','O1');t=open(offer(t,'O2',1),'A2','O2','retake','A1');
 const r={id:'S',subject:'VOG112',group:'GVO2602',part:1};assert.equal(L.resolve(t.studyLedger,r).issue,'ambiguous_attempt');
 assert.equal(L.resolve(t.studyLedger,{...r,offeringId:'O2'}).attemptId,'A2');
 assert.equal(L.resolve(t.studyLedger,{...r,offeringId:'O2',attemptId:'A1'}).issue,'unresolved_attempt');
 assert.equal(L.resolve(t.studyLedger,{...r,id:'T',offeringId:'O2'}).issue,'unresolved_attempt');
});
test('old experimental ledger conversion preserves attendance snapshots without editing original object',()=>{
 let t=open(offer(initial(),'O1',1),'A1','O1');t=imported(t,{offeringId:'O1',absent:2});const old=structuredClone(t);old.studyLedger.version=1;old.studyLedger.bindings={'old-key':'A1'};const before=structuredClone(old),next=L.reviseOffering(old,'O1',{end:'2027-01-01'},actor);
 assert.deepEqual(old,before);assert.deepEqual(next.snapshots,before.studyLedger.snapshots);assert.equal(next.version,2);
});
