import test from 'node:test';import assert from 'node:assert/strict';import I from '../lib/attendance-import.cjs';
const row={id:'S',term:'FALL 2026',subject:'A',group:'G',date:'2026-11-18',part:2,absent:8,slots:40};
const term={students:[{id:'S',name:'Student'}],records:[row],importFiles:[]};
const file=rows=>[{name:'same.xlsx',rows}];
test('correction preview identifies exact old/new slots, does not add cumulative snapshots or mutate history',()=>{
 const before=JSON.stringify(term);const result=I.plan(term,file([{...row,absent:10}]),2,'2026-FALL');
 assert.equal(result.changes[0].type,'correct');assert.equal(result.changes[0].before.absent,8);assert.equal(result.changes[0].after.absent,10);assert(result.reports[0].warnings.some(x=>x.includes('8/40 → 10/40')));assert.equal(result.rows[0].absent,10);assert.equal(JSON.stringify(term),before);
});
test('reimport identical values is classified unchanged, new date is addition and omitted rows are never deletions',()=>{
 const same=I.plan(term,file([{...row}]),2,'2026-FALL');assert.equal(same.changes[0].type,'unchanged');
 const next=I.plan(term,file([{...row,date:'2026-11-19',absent:10}]),2,'2026-FALL');assert.equal(next.changes[0].type,'add');assert.equal(term.records.length,1);assert.equal(term.records[0].absent,8);
});
