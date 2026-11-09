import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import P from '../lib/parts.cjs';
import Q from '../lib/queue-state.cjs';
import D from '../lib/daily-changes.cjs';
import {validateArchive} from '../lib/security.mjs';
const row=(part,group,date,absent)=>({id:'SV1',subject:'A',group,date,part,absent,slots:40});
const term=()=>({students:[{id:'SV1',name:'Test'}],records:[row(1,'G1','2026-09-01',20),row(2,'G2','2026-11-01',1),row(2,'G2','2026-11-02',4)],dailyFollow:{done:{id:'SV1',subject:'A',group:'G1',date:'2026-09-01',status:'resolved',resolvedAttendance:{date:'2026-09-01',absent:20,slots:40},note:'Part one note'}},followAudit:[]});
test('retaking the same course has independent counts and completion, without mutating stored history',()=>{
 const t=term(),before=structuredClone(t),p2=P.scope(t,'2');assert.deepEqual(p2.records.map(r=>r.absent),[1,4]);assert.equal(p2.records[0].absent/p2.records[0].slots*100,2.5);assert.equal(Object.keys(p2.dailyFollow).length,0);assert.equal(Q.pending(p2,[p2.records[1]],'2026-11-02').length,1);assert.deepEqual(t,before);
});
test('daily email never borrows a Part one baseline for the first day of the repeat group',()=>{
 const t=term(),a={terms:{T:P.scope(t,'2')}};const first=D.changed(a,'T','2026-11-01');assert.equal(first.missing,1);assert.equal(first.rows.length,0);
 const next=D.changed(a,'T','2026-11-02');assert.equal(next.rows.length,1);assert.equal(next.rows[0][7],'01/11/2026');assert.equal(next.rows[0][8].value,2.5);assert.equal(next.rows[0][9],'Part 2');
});
test('legacy records remain unassigned unless that exact course/group has an explicit Part binding',()=>{
 const t={records:[row(undefined,'OLD','2026-09-01',4),row(undefined,'G2','2026-10-01',1),row(2,'G2','2026-11-01',4)]};assert.equal(P.scope(t,'unknown').records.length,1);assert.equal(P.scope(t,'2').records.length,2);assert.equal(t.records[1].part,undefined);
});
test('explicit Part is required on new imports and reusing a group across Parts is blocked on client and server',()=>{
 assert.throws(()=>P.stamp([],[],0),/Chọn Part/);assert.throws(()=>P.stamp([row(undefined,'G1','2026-09-01',4)],[row(undefined,'G1','2026-11-01',1)],2),/chưa phân Part/);assert.throws(()=>P.stamp([row(1,'G1','2026-09-01',4)],[row(undefined,'G1','2026-11-01',1)],2),/cùng nhóm lớp/);
 const a={version:2,active:'T',terms:{T:term()}};assert.doesNotThrow(()=>validateArchive(a));a.terms.T.records.push(row(2,'G1','2026-11-03',1));assert.throws(()=>validateArchive(a),/cùng nhóm lớp/);a.terms.T.records=[row(3,'G3','2026-11-03',1)];assert.throws(()=>validateArchive(a),/1 hoặc 2/);
});
test('missing-attendance acknowledgements are scoped per Part and old unassigned acknowledgements do not hide a new Part',()=>{
 const t=term();t.dailyFollow={a:{id:'SV1',subject:'',group:'',date:'2026-11-01',status:'resolved',resolvedMissing:true},b:{id:'SV2',subject:'',group:'',part:1,date:'2026-11-01',status:'resolved',resolvedMissing:true}};assert.equal(Q.completed(P.scope(t,'2'),'2026-11-02').length,0);assert.equal(Q.completed(P.scope(t,'1'),'2026-11-02').length,1);assert.equal(Q.completed(P.scope(t,'unknown'),'2026-11-02').length,1);
});
test('shipped Part logic is exactly the server-tested module',()=>{assert(fs.readFileSync(new URL('../web/source.html',import.meta.url),'utf8').includes(fs.readFileSync(new URL('../lib/parts.cjs',import.meta.url),'utf8').trim()));});
test('confirmed FALL migration classifies only unassigned rows, keeps numbers, source files, audits and other semesters',()=>{
 const t=term();t.records[0].part=undefined;t.importFiles=[{id:'old',records:[{...t.records[0]}],deleted:true}];t.dailyFollow.missing={id:'SV1',subject:'',resolvedMissing:true,status:'resolved',date:'2026-09-01'};t.followAudit=[{...t.dailyFollow.done}];
 const a={version:2,active:'2026-FALL',terms:{'2026-FALL':t,'2027-SPR':term()}},before=structuredClone(a),r=P.migrateLegacyFall(a);assert.equal(r.records,1);assert.equal(r.sourceRows,1);assert.equal(r.archive.terms['2026-FALL'].records[0].part,1);assert.equal(r.archive.terms['2026-FALL'].records[1].part,2);assert.equal(r.archive.terms['2026-FALL'].records[0].absent,20);assert.equal(r.archive.terms['2026-FALL'].importFiles[0].records[0].part,1);assert(r.archive.terms['2026-FALL'].importFiles[0].deleted);assert.deepEqual(r.archive.terms['2026-FALL'].followAudit,t.followAudit);assert.deepEqual(r.archive.terms['2027-SPR'],a.terms['2027-SPR']);assert.deepEqual(a,before);assert.equal(P.migrateLegacyFall(r.archive).changed,false);assert.equal(r.archive.terms['2026-FALL'].dailyFollow.missing.part,1);
});
test('full-semester courses continue in both Parts and later imports inherit Cả kỳ without resetting counts',()=>{
 const a={terms:{T:term()}},before=structuredClone(a),key=P.groupKey(a.terms.T.records[0]),next=P.markFullTerm(a,'T',[key]);
 assert.deepEqual(a,before);assert.equal(next.terms.T.records[0].part,'full');assert.equal(next.terms.T.records[0].absent,20);
 assert(P.scope(next.terms.T,'1').records.some(r=>r.group==='G1'));assert(P.scope(next.terms.T,'2').records.some(r=>r.group==='G1'));
 const continuing=P.stamp(next.terms.T.records,[row(undefined,'G1','2026-11-02',21)],2);assert.equal(continuing[0].part,'full');assert.equal(continuing[0].absent/continuing[0].slots*100,52.5);
 const t={...next.terms.T,records:[...next.terms.T.records,...continuing]};const report=D.changed({terms:{T:P.scope(t,'2')}},'T','2026-11-02');assert.equal(report.outsideRange,1);assert.equal(Q.pending(P.scope(t,'2'),continuing,'2026-11-02').length,1);
 const repeated=P.stamp(t.records,[row(undefined,'RETAKE','2026-11-03',1)],2);assert.equal(repeated[0].part,2);assert.equal(repeated[0].absent/repeated[0].slots*100,2.5);
});
test('marking a whole-semester group updates source snapshots while preserving notes and unrelated groups',()=>{
 const t=term();t.importFiles=[{id:'source',records:structuredClone(t.records),deleted:true}];const a={terms:{T:t}},k=P.groupKey(t.records[0]),next=P.markFullTerm(a,'T',[k]);assert.equal(next.terms.T.importFiles[0].records[0].part,'full');assert.equal(next.terms.T.importFiles[0].records[1].part,2);assert.deepEqual(next.terms.T.dailyFollow,t.dailyFollow);assert.equal(Q.completed(P.scope(next.terms.T,'2'),'2026-11-03')[0].note,'Part one note');assert.throws(()=>P.markFullTerm(a,'T',['not-a-group']),/hợp lệ/);
});
test('daily email may compare across the two Parts only for a continuing full-semester group',()=>{
 const t={students:[{id:'SV1',name:'Test'}],records:[row('full','FULL-G','2026-09-01',8),row('full','FULL-G','2026-11-01',10)]};const r=D.changed({terms:{T:P.scope(t,'2')}},'T','2026-11-01');assert.equal(r.rows.length,1);assert.equal(r.rows[0][7],'01/09/2026');assert.equal(r.rows[0][4].value,25);assert.equal(r.rows[0][9],'Cả kỳ');assert.doesNotThrow(()=>validateArchive({version:2,active:'T',terms:{T:t}}));
});
