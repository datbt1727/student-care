import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import I from '../lib/attendance-import.cjs';
import D from '../lib/study-decisions.cjs';
const html=fs.readFileSync(new URL('../web/source.html',import.meta.url),'utf8');
const code=html.slice(html.indexOf('function parseAttendance(sheets,date,source){'),html.indexOf('function parseFollow(sheets){'));
const context={clean:v=>String(v??'').trim(),norm:v=>String(v??'').trim().toUpperCase(),iso:v=>v,key:r=>JSON.stringify([r.id,r.subject,r.group])};vm.createContext(context);vm.runInContext(code,context);
const headers=['Semester','GroupName','SubjectCode','RollNumber','FullName','NumberOfSlot','NumberOfAbsent','PercentAbs','StartDate','EndDate'];
function parsed(date){return context.parseAttendance([{name:'Attendance',rows:[headers,['FALL 2026','GAE2441-02','AEG116','GBC210068','Student',40,13,32.5,'2026-09-14','2026-10-21'],['FALL 2026','GAE2442','AEG116','GBC210068','Student',40,8,20,'2026-11-16','2026-12-16']]}],date,'source.xlsx');}
const term=()=>({students:[{id:'GBC210068',name:'Student'}],records:[{id:'GBC210068',subject:'AEG116',group:'GAE2441-02',part:1,date:'2026-11-06',slots:40,absent:13}],dailyFollow:{},courseCatalog:[{subject:'AEG116',name:'English'}],importFiles:[]});
test('actual browser parser keeps both AEG groups and calculates Part2 from 8/40, not old 13/40',()=>{const p=parsed('2026-11-18');assert.equal(p.errors.length,0);assert.equal(p.rows.length,2);const t=term(),before=structuredClone(t),plan=I.plan(t,[{name:'source.xlsx',rows:p.rows}],2,'2026-FALL');assert.equal(plan.rows.length,1);assert.equal(plan.rows[0].group,'GAE2442');assert.equal(plan.rows[0].absent/plan.rows[0].slots*100,20);assert.deepEqual(t,before);const next={...t,records:[...t.records,...plan.rows]};const d=D.prepare(next,{studentId:'GBC210068',subject:'AEG116',kind:'retake',source:{group:'GAE2441-02',part:1},target:{group:'GAE2442',part:2}},'decision-aeg-source','admin');assert.deepEqual(D.summary(next,d).map(x=>x.percent),[32.5,20]);});
test('wrong cutoff before class starts is rejected without changing archive or treating it as zero',()=>{const t=term(),before=structuredClone(t),p=I.plan(t,[{name:'source.xlsx',rows:parsed('2026-11-06').rows}],2,'2026-FALL');assert.equal(p.rows.length,0);assert(p.reports.some(r=>r.errors.some(e=>e.includes('Ngày chốt trước'))));assert.deepEqual(t,before);});

test('planned retake with no snapshots returns no data rather than a fabricated zero percent',()=>{const t=term(),d=D.prepare(t,{studentId:'GBC210068',subject:'AEG116',kind:'retake',source:{group:'GAE2441-02',part:1},target:{group:'GAE2442',part:2,planned:true,slots:40}},'decision-aeg-empty','admin');const a=D.summary(t,d)[1];assert.equal(a.records,0);assert.equal(a.absent,null);assert.equal(a.percent,null);assert.equal(a.hasData,false);});
