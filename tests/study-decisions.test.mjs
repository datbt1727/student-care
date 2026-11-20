import test from 'node:test';import assert from 'node:assert/strict';import {randomBytes} from 'node:crypto';
import D from '../lib/study-decisions.cjs';import {previewDecision,openDecisionTicket,applyDecision,preserveDecisions,requireStudyStaging} from '../lib/study-decision-service.mjs';
process.env.DATA_KEY=randomBytes(32).toString('base64');
const row=(group,part,date,absent,slots=40)=>({id:'S',subject:'AEG116',group,part,date,absent,slots,start:'2026-01-01',end:'2026-12-31'});
const term=()=>({students:[{id:'S',name:'Test'}],records:[row('OLD',1,'2026-10-01',10),row('NEW',2,'2026-11-18',2)],dailyFollow:{old:{id:'S',subject:'AEG116',group:'OLD',date:'2026-10-01',note:'Keep'}},notes:{S:'Keep'},importFiles:[{name:'source',records:[row('OLD',1,'2026-10-01',10)]}]});
const decision=()=>({studentId:'S',subject:'AEG116',kind:'retake',source:{group:'OLD',part:1},target:{group:'NEW',part:2}});
test('retake creates independent stable IDs; original records, files, notes and profiles unchanged',()=>{
 const t=term(),original=structuredClone(t),d=D.prepare(t,decision(),'decision-123','admin'),p=D.project({...t,studyDecisions:[d]}),m=D.summary(t,d);
 assert.notEqual(d.sourceAttempt.id,d.targetAttempt.id);assert.deepEqual(m.map(x=>x.percent),[25,5]);assert.equal(p.records[1].absent,2);assert.equal(p.records[1].attemptNumber,2);assert.equal(p.dailyFollow.old.note,'Keep');assert.deepEqual(t,original);
 const changed=structuredClone(t);changed.records[1].start='2026-11-05';changed.records[1].end='2027-01-01';assert.equal(D.project({...changed,studyDecisions:[d]}).records[1].attemptId,d.targetAttempt.id);
});
test('continue/transfer uses latest cumulative total, never sums snapshot counts',()=>{
 for(const kind of ['continue','transfer']){const t=term();t.records[1].absent=15;const d=D.prepare(t,{...decision(),kind,cumulativeConfirmed:true},'decision-123','admin');assert.equal(d.sourceAttempt.id,d.targetAttempt.id);assert.deepEqual(D.summary(t,d).map(x=>x.absent),[15]);assert.equal(D.summary(t,d)[0].percent,37.5);assert.throws(()=>D.prepare(t,{...decision(),kind},'decision-456','admin'),/lũy kế/);}
});
test('reused same group and Part needs disjoint explicit snapshot ranges; dates do not infer identity',()=>{
 const t=term();t.records=t.records.map(r=>({...r,group:'SAME',part:2}));const p={...decision(),source:{group:'SAME',part:2},target:{group:'SAME',part:2}};
 assert.throws(()=>D.prepare(t,p,'decision-123','admin'),/trùng nhau/);
 p.source={...p.source,from:'2026-10-01',to:'2026-10-01'};p.target={...p.target,from:'2026-11-18',to:'2026-11-18'};
 const d=D.prepare(t,p,'decision-123','admin');assert.equal(D.summary(t,d).length,2);
 assert.throws(()=>D.prepare(t,{...p,target:{...p.target,from:'2026-02-30'}},'decision-456','admin'),/hợp lệ/);
});
test('refuses conflicting classification, slot mismatch, unknown roster and conflicting same-day cumulative values',()=>{
 const t=term(),p=decision(),d=D.prepare(t,p,'decision-123','admin');assert.throws(()=>D.prepare({...t,studyDecisions:[d]},p,'decision-456','admin'),/liên kết|hiệu lực/);
 assert.throws(()=>D.prepare(t,{...p,studentId:'OUT'},'decision-456','admin'));
 t.records[1].slots=70;assert.throws(()=>D.prepare(t,{...p,kind:'transfer',cumulativeConfirmed:true},'decision-456','admin'),/slot/);
 t.records[1].slots=40;t.records[1].date=t.records[0].date;const x=D.prepare(t,{...p,kind:'continue',cumulativeConfirmed:true},'decision-456','admin');assert.throws(()=>D.summary(t,x),/khác nhau/);
});
test('encrypted server preview is bound to actor and expiry; apply only appends metadata, normal save cannot alter it',()=>{
 const a={version:2,active:'T',terms:{T:term()}},before=structuredClone(a),p=previewDecision(a,{revision:89,termId:'T',decision:decision()},'admin');
 assert.equal(p.rawDataUnchanged,true);assert.equal(p.attempts[1].percent,5);assert.deepEqual(a,before);
 const args={requestId:'request-123',planToken:p.planToken,confirmation:p.decisionId},ticket=openDecisionTicket(args,'admin').ticket;
 assert.throws(()=>openDecisionTicket(args,'other'),/khớp/);const after=applyDecision(a,ticket);assert.deepEqual(after.terms.T.records,a.terms.T.records);assert.deepEqual(after.terms.T.dailyFollow,a.terms.T.dailyFollow);assert.deepEqual(a,before);preserveDecisions(after,structuredClone(after));assert.throws(()=>preserveDecisions(after,a),/Không sửa/);assert.throws(()=>applyDecision(a,{...ticket,expires:0}),/hết hạn/);
 const modified=structuredClone(a);modified.terms.T.records[1].slots=70;assert.throws(()=>applyDecision(modified,ticket),/thay đổi/);
});
test('write feature is closed outside the isolated Codespaces runner',()=>{
 delete process.env.SC_STUDY_DECISIONS;assert.throws(requireStudyStaging);process.env.SC_STUDY_DECISIONS='staging';process.env.APP_ORIGIN='https://production.test';assert.throws(requireStudyStaging);process.env.APP_ORIGIN='https://test-4173.app.github.dev';requireStudyStaging();delete process.env.SC_STUDY_DECISIONS;
});
