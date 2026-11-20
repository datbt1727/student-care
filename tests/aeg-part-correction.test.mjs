import test from 'node:test';import assert from 'node:assert/strict';import C from '../lib/aeg-part-correction.cjs';import P from '../lib/parts.cjs';import I from '../lib/attendance-import.cjs';
const row=(group,part,absent=2)=>({id:'S1',subject:'AEG116',group,part,absent,slots:40,date:'2026-11-18',term:'2026-FALL'});
const fixture=()=>({registry:{students:{S1:{name:'Test'}}},terms:{'2026-FALL':{students:[{id:'S1'}],records:[row('GAE2441-01',1,10),row('GAE2441-02',1,8),row('GAE2442',1)],importFiles:[{part:1,records:[row('GAE2442',1)]}],dailyFollow:{x:{id:'S1',subject:'AEG116',group:'GAE2442',note:'keep',part:1}},notes:{S1:[{text:'keep'}]}}}});
test('correction changes only confirmed Part metadata and keeps original archive immutable',()=>{
 const a=fixture(),copy=structuredClone(a),p=C.plan(a);assert.deepEqual(a,copy);assert.equal(p.summary.changedRecords,1);assert.equal(p.summary.changedSourceRows,1);
 const t=p.archive.terms['2026-FALL'];assert.deepEqual(t.records.map(r=>r.part),[1,1,2]);assert.deepEqual(t.records.map(r=>r.absent),[10,8,2]);assert.deepEqual(t.dailyFollow,a.terms['2026-FALL'].dailyFollow);assert.deepEqual(t.notes,a.terms['2026-FALL'].notes);
 assert.equal(P.scope(t,'2').records.length,1);assert.equal(P.scope(t,'2').records[0].absent/40*100,5);
 assert.equal(C.plan(p.archive).summary.changed,false);
});
test('Part2 import admits new class and rejects old Part1 groups after correction',()=>{
 const t=C.plan(fixture()).archive.terms['2026-FALL'],p=I.plan(t,[{name:'test.xlsx',rows:[row('GAE2442',2),row('GAE2441-01',1)]}],2,'2026-FALL');
 assert.equal(p.rows.length,1);assert.equal(p.rows[0].group,'GAE2442');assert.equal(p.changes[0].type,'unchanged');assert.equal(p.rejected,1);
});
test('other courses/terms untouched and ambiguous classifications stop',()=>{
 const a=fixture();a.terms['2027-SPR']={records:[row('GAE2442',1)]};a.terms['2026-FALL'].records.push({...row('GAE2442',1),subject:'OTHER'});const p=C.plan(a);assert.deepEqual(p.archive.terms['2027-SPR'],a.terms['2027-SPR']);assert.equal(p.archive.terms['2026-FALL'].records.at(-1).part,1);
 for(const part of ['full',undefined,0]){const b=fixture();b.terms['2026-FALL'].records[2].part=part;assert.throws(()=>C.plan(b));}
 const b=fixture();b.terms['2026-FALL'].fullTermSubjects=['AEG116'];assert.throws(()=>C.plan(b));
});
