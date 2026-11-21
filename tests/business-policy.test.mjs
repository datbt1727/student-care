import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import B from '../lib/business-policy.cjs';import I from '../lib/attendance-import.cjs';
const row=(subject='AEG116',group='NEW',id='S',absent=2,slots=40)=>({id,subject,group,absent,slots,part:1,date:'2026-11-18',term:'FALL 2026'});
test('Follow excludes GPDP101 and outside roster records/notes/catalog but preserves complete source',()=>{
 const term={students:[{id:'S'}],records:[row(),row('GPDP101'),row('A','G','OUT')],dailyFollow:{a:{...row('GPDP101'),note:'keep history'},b:{...row(),note:'visible'}},courseCatalog:[{subject:'GPDP101'},{subject:'AEG116'}]};const before=JSON.stringify(term),out=B.followSources(term,term.records,Object.values(term.dailyFollow));assert.equal(out.records.length,1);assert.equal(out.follows.length,1);assert.deepEqual(out.catalog,[{subject:'AEG116'}]);assert.equal(JSON.stringify(term),before);
});
test('AEG116 identity and values remain class-specific; source absence is never reset to zero or inherited',()=>{
 const term={students:[{id:'S'}],records:[row('AEG116','OLD','S',10),row()]};const out=B.review(term);assert.equal(out.cases[0].rule,'separate_class_attempts');assert.notEqual(B.classify(term.records[0],term).identity,B.classify(term.records[1],term).identity);const planned=I.plan(term,[{name:'input.xlsx',rows:[row()]}],1,'2026-FALL');assert.equal(planned.rows[0].absent,2);assert.equal(term.records[0].absent,10);
});
test('ENR multi-class remains unresolved; different level does not reuse absence; unrecognized tutor rejected only for new input',()=>{
 const term={students:[{id:'S'}],records:[row('ENR103','OLD')],courseCatalog:[]};assert.equal(B.classify(row('ENR103','NEW'),term).type,'needs_review');assert.equal(B.classify(row('ENR203','NEW'),term).type,'group_scoped');const tutor=row('ENR003','ENR003 - TUTOR');term.records.push(tutor);const before=JSON.stringify(term);const p=I.plan(term,[{name:'x.xlsx',rows:[tutor,row('ENR203','VALID')]}],1,'2026-FALL');assert.equal(p.rows.length,1);assert.equal(p.rejected,1);assert.equal(JSON.stringify(term),before);
});
test('browser uses the tested shared policy',()=>{assert(fs.readFileSync(new URL('../web/source.html',import.meta.url),'utf8').includes(fs.readFileSync(new URL('../lib/business-policy.cjs',import.meta.url),'utf8').trim()));});

test('QA uses only selected term catalog including note-only courses; whitespace/case normalized without mutating source',()=>{
 const term={students:[{id:'S'}],courseCatalog:[{subject:'AEG116',name:'Allowed'}],records:[row(' aeg116 '),row('OUTSIDE')],dailyFollow:{ok:{...row('aeg116'),note:'Allowed note'},out:{...row('OUTSIDE'),note:'Hidden note'}}};const before=structuredClone(term),r=B.followSources(term,term.records,Object.values(term.dailyFollow));
 assert.deepEqual(r.records.map(x=>x.subject),['AEG116']);assert.deepEqual(r.follows.map(x=>x.note),['Allowed note']);assert.deepEqual(term,before);
 const other={...term,courseCatalog:[{subject:'OTHER'}]};assert.equal(B.followSources(other,term.records,Object.values(term.dailyFollow)).records.length,0);
});
test('empty term catalog never falls back to attendance or Follow subjects',()=>{
 const t={students:[{id:'S'}],courseCatalog:[]};const r=B.followSources(t,[row()],[{...row(),note:'keep raw'}]);assert.equal(r.records.length,0);assert.equal(r.follows.length,0);assert.equal(r.catalog.length,0);
});
