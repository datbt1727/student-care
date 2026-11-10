import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import I from '../lib/attendance-import.cjs';import P from '../lib/parts.cjs';import S from '../lib/student-policy.cjs';import X from '../lib/report-index.cjs';
import {authorizeArchive} from '../lib/permissions.mjs';
const row=(id='S',group='NEW',part)=>({id,name:'Student',term:'FALL 2026',subject:'A',group,part,date:'2026-11-09',absent:1,slots:40,status:'',line:2});
const term=()=>({termId:'2026-FALL',students:[{id:'S',name:'Student'}],records:[row('S','OLD',1),row('S','FULL','full')],courseCatalog:[{subject:'A',name:'Course A'}],dailyFollow:{},importFiles:[]});
const file=rows=>[{name:'attendance.xlsx',rows,errors:[],warnings:[]}];
test('mixed file excludes old Part 1 and outside-roster IDs; valid Part 2 and full-term rows continue without changing stored data',()=>{
 const t=term(),before=structuredClone(t),p=I.plan(t,file([row('S','OLD'),row('S','NEW'),row('OUTSIDER','NEW'),row('S','FULL')]),2,t.termId);
 assert.equal(p.rows.length,2);assert.deepEqual(p.rows.map(r=>[r.group,r.part]),[['NEW',2],['FULL','full']]);assert.equal(p.rejected,2);assert(p.reports.some(r=>r.errors.some(e=>e.includes('MSSV'))));assert(p.reports.some(r=>r.errors.some(e=>e.includes('Part 1'))));assert.equal(p.fileRows.flatMap(f=>f.records).length,2);assert.deepEqual(t,before);
});
test('all-invalid input cannot produce commit rows; malformed dates, terms, counts and conflicting duplicates are excluded',()=>{
 const t=term();for(const r of [{...row(),id:'X'},{...row(),date:'2026-02-30'},{...row(),absent:41},{...row(),term:'SPRING 2027'}])assert.equal(I.plan(t,file([r]),2,t.termId).rows.length,0);
 const conflict=I.plan(t,file([row(),{...row(),absent:2}]),2,t.termId);assert.equal(conflict.rows.length,0);assert.equal(conflict.rejected,2);
 const duplicate=I.plan(t,file([row(),row()]),2,t.termId);assert.equal(duplicate.rows.length,1);assert(duplicate.reports[1].warnings.length);
});
test('file size limit is consistently strict below 10 MB and bounded to ten XLSX files',()=>{
 assert.doesNotThrow(()=>I.checkFiles([{name:'large.xlsx',size:9999999}]));assert.throws(()=>I.checkFiles([{name:'large.xlsx',size:10000000}]),/10 MB/);assert.throws(()=>I.checkFiles(Array.from({length:11},()=>({name:'a.xlsx',size:1}))));assert.throws(()=>I.checkFiles([{name:'a.exe',size:1}]));
});
test('a catalog-only course can be marked full-semester before attendance exists and applies to later imports',()=>{
 const t={...term(),records:[]},a={terms:{'2026-FALL':t}},next=P.markFullTerm(a,'2026-FALL',['subject:A']);assert.deepEqual(next.terms['2026-FALL'].fullTermSubjects,['A']);assert.equal(I.plan(next.terms['2026-FALL'],file([row()]),2,'2026-FALL').rows[0].part,'full');assert.throws(()=>P.markFullTerm(a,'2026-FALL',['subject:UNKNOWN']));assert.equal(t.fullTermSubjects,undefined);
});
test('birthday policy excludes G in latest enrolled semester and includes other statuses and readmitted students',()=>{
 const students={G:{id:'G',birthday:'2004-11-10'},HD:{id:'HD',birthday:'2004-11-10'},BACK:{id:'BACK',birthday:'2004-11-10'},OLD:{id:'OLD',birthday:'2004-11-10',termStatus:'G'}};
 const a={active:'2026-FALL',registry:{students},terms:{'2026-FALL':{students:[{id:'G',termStatus:'G'},{id:'HD',termStatus:'HD'},{id:'BACK',termStatus:'G'}]},'2027-SPR':{students:[{id:'BACK',termStatus:'HD'}]}}};assert.deepEqual(S.birthdayStudents(a,'2026-11-10').map(s=>s.id),['HD','BACK']);assert.deepEqual(S.birthdayStudents(a,'2026-11-11'),[]);
});
test('Follow index preserves exact day and class including note-only dates without fake attendance',()=>{
 const records=[row('S','G')],notes=[{id:'S',subject:'A',group:'G',date:'2026-11-10',note:'Internal follow'},{id:'S',subject:'A',group:'OTHER',date:'2026-11-09',note:'Other class'}],map=X.build(records,notes),g=map.get('A').get('G');assert(g.dates.has('2026-11-10'));assert.equal(g.cells.get(JSON.stringify(['S','2026-11-10'])),undefined);assert.deepEqual(g.notes.get(JSON.stringify(['S','2026-11-10'])),['Internal follow']);assert(!JSON.stringify([...g.notes.values()]).includes('Other class'));assert.throws(()=>X.build([row(),row()],[]),/trùng/);
});
test('staff import API authorization blocks new outsider attendance while preserving unchanged historical outsider rows',()=>{
 const before={version:2,active:'2026-FALL',terms:{'2026-FALL':{...term(),records:[row('LEGACY','G')]}}},user={role:'staff',permissions:{importData:true,editProfiles:true}},after=structuredClone(before);after.terms['2026-FALL'].records.push(row('S','NEW'));assert.doesNotThrow(()=>authorizeArchive(user,before,after));after.terms['2026-FALL'].records.push(row('NEW-OUTSIDER','NEW'));assert.throws(()=>authorizeArchive(user,before,after),e=>e.status===403);const config=structuredClone(before);config.terms['2026-FALL'].fullTermSubjects=['A'];assert.doesNotThrow(()=>authorizeArchive(user,before,config));
});
test('tested policies ship identically in the browser',()=>{const html=fs.readFileSync(new URL('../web/source.html',import.meta.url),'utf8');for(const f of ['attendance-import','student-policy','report-index'])assert(html.includes(fs.readFileSync(new URL('../lib/'+f+'.cjs',import.meta.url),'utf8').trim()));});
