import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import D from '../lib/daily-changes.cjs';
const r=(date,absent,group='G',id='S')=>({id,subject:'M',group,date,absent,slots:100}),archive=records=>({terms:{T:{students:[{id:'S',name:'Test'},{id:'OTHER',name:'Other'}],records}}});
test('email compares latest earlier data of the same student/course/group and prints the baseline date',()=>{
 const out=D.changed(archive([r('2026-10-25',10),r('2026-10-29',20),r('2026-10-30',99,'OTHER'),r('2026-10-31',25),r('2026-11-01',40)]),'T','2026-10-31');assert.equal(out.rows.length,1);assert.equal(out.rows[0][7],'29/10/2026');assert.equal(out.rows[0][8].value,20);assert.equal(out.rows[0][4].value,25);
});
test('no earlier record is not zero; missing current date is not filled with old numbers',()=>{
 const first=D.changed(archive([r('2026-10-31',25)]),'T','2026-10-31');assert.equal(first.missing,1);assert.equal(first.rows.length,0);
 const noCurrent=D.changed(archive([r('2026-10-29',25)]),'T','2026-10-31');assert.equal(noCurrent.current,0);assert.equal(noCurrent.rows.length,0);assert.equal(noCurrent.latestDate,'2026-10-29');
});
test('exact ratios, inclusive endpoints and multiple groups are independent',()=>{
 const data=[r('2026-10-29',20),r('2026-10-31',20),r('2026-10-29',5,'G2'),r('2026-10-31',10,'G2'),r('2026-10-29',30,'G3'),r('2026-10-31',25,'G3'),r('2026-10-29',20,'G4'),{...r('2026-10-31',2501,'G4'),slots:10000}];const out=D.changed(archive(data),'T','2026-10-31');assert.equal(out.unchanged,1);assert.equal(out.outsideRange,1);assert.deepEqual(out.rows.map(row=>row[4].value),[10,25]);assert.deepEqual(out.rows.map(row=>row[6]),['G2','G3']);
});
test('invalid date and ambiguous duplicate source rows fail clearly; shipped browser matches helper',()=>{assert.throws(()=>D.changed(archive([]),'T','2026-02-30'));assert.throws(()=>D.changed(archive([r('2026-10-31',20),r('2026-10-31',20)]),'T','2026-10-31'),/Trùng/);assert(fs.readFileSync(new URL('../web/source.html',import.meta.url),'utf8').includes(fs.readFileSync(new URL('../lib/daily-changes.cjs',import.meta.url),'utf8').trim()));});
