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
