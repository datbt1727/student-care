import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import Q from '../lib/queue-state.cjs';
const record=(date,absent,slots=100)=>({id:'S',subject:'M',group:'G',date,absent,slots});
function pending(records,follow){const term={records,dailyFollow:{x:follow}},row=records.at(-1);return Q.pending(term,[row],row.date).length===1;}
const done={id:'S',subject:'M',group:'G',date:'2026-10-25',status:'resolved'};
test('unchanged ratio stays resolved across days; exact ratio ignores slot scale',()=>{assert(!pending([record('2026-10-25',20),record('2026-10-26',40,200)],done));});
test('changed ratio reopens and persists until next completion even when ratio returns',()=>{
 const records=[record('2026-10-25',20),record('2026-10-26',24),record('2026-10-27',24),record('2026-10-28',20)];
 for(let n=2;n<=records.length;n++)assert(pending(records.slice(0,n),done));
 assert(!pending(records,{...done,date:'2026-10-28'}));
});
test('snapshot detects corrections of same-day records; missing baseline fails open',()=>{
 assert(pending([record('2026-10-25',24)],{...done,resolvedAttendance:{date:'2026-10-25',absent:20,slots:100}}));
 assert(pending([record('2026-10-26',24)],{...done,date:'2026-10-24'}));
});
test('completion never hides other students, groups, courses or future history',()=>{
 const r=record('2026-10-26',20),term={records:[record('2026-10-25',20),r],dailyFollow:{x:{...done,group:'OTHER'}}};assert.equal(Q.pending(term,[r],r.date).length,1);
 term.dailyFollow.x={...done,date:'2026-10-27'};assert.equal(Q.pending(term,[r],r.date).length,1);
});
test('browser queue rule is identical to tested module',()=>{const source=fs.readFileSync(new URL('../web/source.html',import.meta.url),'utf8'),module=fs.readFileSync(new URL('../lib/queue-state.cjs',import.meta.url),'utf8').trim();assert(source.includes(module));});
test('completed history keeps latest completion per group, actor and old snapshot even after reopening',()=>{
 const first={...done,note:'Đã gọi',resolvedAttendance:record(done.date,20),actor:'staff'},second={...done,date:'2026-10-26',note:'Đã gửi mail',resolvedAttendance:record('2026-10-26',24)},other={...done,group:'OTHER'};
 const term={records:[record('2026-10-27',30)],followAudit:[first],dailyFollow:{x:first,y:second,z:other,future:{...done,id:'future',date:'2099-01-01'}}};
 const list=Q.completed(term,'2026-10-27');assert.equal(list.length,2);assert.equal(list.find(f=>f.group==='G').note,'Đã gửi mail');assert.equal(list.find(f=>f.group==='G').resolvedAttendance.absent,24);assert.equal(Q.pending(term,term.records,'2026-10-27').length,1);
 assert.equal(Q.completed(term,'2026-10-25').find(f=>f.group==='G').actor,'staff');
});
test('missing data completion is scoped to term/student/date and never invents attendance',()=>{
 const term={records:[],dailyFollow:{x:{id:'S',subject:'',group:'',date:'2026-10-25',status:'resolved',resolvedMissing:true,note:''}}},students=[{id:'S'},{id:'OTHER'}];
 assert.deepEqual(Q.pendingMissing(term,students,'2026-10-26'),[{id:'OTHER'}]);assert.equal(Q.pendingMissing(term,students,'2026-10-24').length,2);assert.equal(Q.pendingMissing({},students,'2026-10-26').length,2);assert.deepEqual(term.records,[]);
});
