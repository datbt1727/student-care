import test from 'node:test';import assert from 'node:assert/strict';import L from '../lib/study-ledger.cjs';
const master={S:{id:'S',name:'Student'}},actor='admin';
function term(){return {students:[{id:'S',name:'Student'}],courseCatalog:[{subject:'A',name:'Course'}],records:[{id:'S',subject:'A',group:'OLD',absent:7,slots:70,date:'2026-09-01'}]};}
function offer(t,id='G1',part=1,slots=70,confirmed=true){return {...t,studyLedger:L.offering(t,{id,subject:'A',group:id,part,slots,slotsConfirmed:confirmed,start:'2026-09-01',end:'2026-12-31'},actor)};}
function attempt(t,id='A1',offeringId='G1',kind='new',parentId){return {...t,studyLedger:L.open(t,master,{id,studentId:'S',offeringId,kind,parentId},actor)};}
const row=(absent,date='2026-11-18',group='G1',slots=70)=>({id:'S',subject:'A',group,slots,absent,date});
const input=(t,rows,mode='cumulative',extra={})=>L.importRows(t,rows,{mode,...extra},actor);
test('calendar follows SPR SUM FALL by calendar year; validates Part boundaries without changing old term IDs',()=>{
 for(const termCode of ['SPR','SUM','FALL'])assert.equal(L.calendar({year:2026,term:termCode,start:'2026-01-01',end:'2026-12-31',parts:[{part:1,start:'2026-01-01',end:'2026-06-30'},{part:2,start:'2026-07-01',end:'2026-12-31'}]}).termId,'2026-'+termCode);
 assert.throws(()=>L.calendar({year:2026,term:'FALL',start:'2026-01-01',end:'2026-12-31',parts:[{part:1,start:'2026-01-01',end:'2026-07-01'},{part:2,start:'2026-07-01',end:'2026-12-31'}]}));
});
test('Part1 and Part2 new offerings start separately; retake has a distinct identity and zero inherited absence',()=>{
 let t=attempt(offer(term()));t={...t,studyLedger:input(t,[row(7)]).ledger};t=offer(t,'G2',2,40);t=attempt(t,'A2','G2','retake','A1');
 assert.equal(L.metric(t.studyLedger,'A2','2026-11-18').absent,0);assert.equal(L.metric(t.studyLedger,'A2','2026-11-18').state,'no_data');assert.equal(L.metric(t.studyLedger,'A1','2026-11-18').absent,7);assert.equal(t.studyLedger.attempts.A2.parentId,'A1');
});
test('full-term cumulative 7 then15 is15/70, never7+15; raw ratio remains unrounded',()=>{
 let t=attempt(offer(term(),'G1','full'));t={...t,studyLedger:input(t,[row(7,'2026-10-01'),row(15)]).ledger};const m=L.metric(t.studyLedger,'A1','2026-11-18');assert.equal(m.absent,15);assert.equal(m.rate,15/70*100);assert.equal(m.rate.toFixed(2),'21.43');
});
test('explicit transfer/continue keeps one attempt and history; new group is unresolved before confirmation',()=>{
 let t=attempt(offer(term()));t={...t,studyLedger:input(t,[row(7,'2026-10-01')]).ledger};t=offer(t,'G2',2);
 assert.equal(input(t,[row(15,'2026-11-18','G2')]).issues[0].type,'unresolved_attempt');
 t={...t,studyLedger:L.link(t,'A1','G2','transfer',actor)};t={...t,studyLedger:input(t,[row(15,'2026-11-18','G2')]).ledger};
 assert.equal(Object.keys(t.studyLedger.attempts).length,1);assert.equal(L.metric(t.studyLedger,'A1','2026-11-18').absent,15);assert.equal(L.metric(t.studyLedger,'A1','2026-10-01').absent,7);
});
test('same course multiple classes cannot bind a group twice or infer new instead of retake',()=>{
 let t=attempt(offer(term()));t=offer(t,'G2',2);assert.throws(()=>attempt(t,'A2','G2','new'));assert.throws(()=>attempt(t,'A2','G2','retake','missing'));assert.throws(()=>attempt(t,'A2','G1','retake','A1'));
});
test('official slot confirmation is mandatory for official warnings',()=>{
 let t=attempt(offer(term(),'G1',1,40,false));t={...t,studyLedger:input(t,[row(11,'2026-11-18','G1',40)]).ledger};const m=L.metric(t.studyLedger,'A1','2026-11-18');assert.equal(m.official,false);assert.equal(m.state,'unconfirmed_slots');assert.equal(m.remaining,null);
});
test('8/40,10/40,11/40 classify without premature rounding; exact boundary is distinct',()=>{
 for(const [absent,state]of [[8,'early'],[10,'at_limit'],[11,'over']]){let t=attempt(offer(term(),'G1',1,40));t={...t,studyLedger:input(t,[row(absent,'2026-11-18','G1',40)]).ledger};const m=L.metric(t.studyLedger,'A1','2026-11-18');assert.equal(m.state,state);assert.equal(m.rate,absent/40*100);}
});
test('cumulative reimport is idempotent and corrections need explicit confirmation',()=>{
 let t=attempt(offer(term()));t={...t,studyLedger:input(t,[row(8)]).ledger};assert.equal(input(t,[row(8)]).accepted,0);
 const blocked=input(t,[row(10)]);assert.equal(blocked.accepted,0);assert.equal(blocked.issues[0].type,'correction_requires_confirmation');assert.equal(L.metric(blocked.ledger,'A1','2026-11-18').absent,8);
 const fixed=input(t,[row(10)],'cumulative',{confirmCorrections:true});assert.equal(fixed.accepted,1);assert.equal(L.metric(fixed.ledger,'A1','2026-11-18').absent,10);
});
test('detail events use confirmed weights, deduplicate stable event IDs, and never mix with cumulative',()=>{
 let t=attempt(offer(term()));const r={...row(0),eventId:'E1',attendanceStatus:'ABSENT'};const first=input(t,[r],'detail',{weights:{ABSENT:1}});t={...t,studyLedger:first.ledger};assert.equal(input(t,[r],'detail',{weights:{ABSENT:1}}).accepted,0);assert.equal(L.metric(t.studyLedger,'A1','2026-11-18').absent,1);assert.equal(input(t,[row(15)]).issues[0].type,'mixed_modes_require_review');assert.equal(input(t,[{...r,eventId:'E2',attendanceStatus:'UNKNOWN'}],'detail').accepted,0);
});
test('invalid inputs and batch conflicts never change old records, profiles or ledger',()=>{
 const base=attempt(offer(term())),before=JSON.stringify(base);assert.throws(()=>input(base,[row(8),row(9)]));assert.equal(JSON.stringify(base),before);assert.equal(input(base,[row(71)]).accepted,0);assert.equal(input(base,[{...row(1),date:'2026-02-30'}]).accepted,0);assert.throws(()=>input(base,[row(1)],'guess'));assert.equal(JSON.stringify(base),before);
});
test('missing student master/semester/curriculum fails closed; unsafe identifiers rejected',()=>{
 const t=offer(term());assert.throws(()=>L.open(t,{}, {id:'A',studentId:'S',offeringId:'G1',kind:'new'},actor));assert.throws(()=>L.open({...t,students:[]},master,{id:'A',studentId:'S',offeringId:'G1',kind:'new'},actor));assert.throws(()=>offer({...term(),courseCatalog:[]}));assert.throws(()=>offer(term(),'__proto__'));assert.throws(()=>L.open(t,master,{id:'__proto__',studentId:'S',offeringId:'G1',kind:'new'},actor));
});
