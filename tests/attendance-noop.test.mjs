import test from 'node:test';import assert from 'node:assert/strict';import I from '../lib/attendance-import.cjs';
const row=(id,absent=2)=>({id,name:'Test',subject:'AEG116',group:'GAE2442',part:2,absent,slots:40,date:'2026-11-18',term:'2026-FALL'});
const term=()=>({students:[{id:'S1',name:'Test'},{id:'S2',name:'Test'},{id:'S3',name:'Test'}],records:[row('S1'),row('S2')]});
test('same or renamed file creates zero write candidates',()=>{
 const t=term(),before=structuredClone(t);
 for(const name of ['original.xlsx','renamed.xlsx']){const p=I.plan(t,[{name,rows:[row('S1'),row('S2')]}],2,'2026-FALL');assert.equal(p.rows.length,2);assert.equal(p.unchangedCount,2);assert.deepEqual(p.writeRows,[]);assert.deepEqual(p.writeFileRows,[]);}
 assert.deepEqual(t,before);
});
test('mixed import only writes additions and corrections; repeat is no-op',()=>{
 const t=term(),p=I.plan(t,[{name:'same.xlsx',rows:[row('S1')]},{name:'mixed.xlsx',rows:[row('S2',3),row('S3',1),row('UNKNOWN')]}],2,'2026-FALL');
 assert.equal(p.unchangedCount,1);assert.equal(p.rejected,1);assert.deepEqual(p.writeRows.map(r=>r.id),['S2','S3']);assert.equal(p.writeFileRows.length,1);assert.equal(p.writeFileRows[0].name,'mixed.xlsx');assert.equal(t.records[1].absent,2);
 const saved={...t,records:[row('S1'),...p.writeRows]},again=I.plan(saved,[{name:'mixed.xlsx',rows:[row('S2',3),row('S3',1)]}],2,'2026-FALL');assert.equal(again.writeRows.length,0);
});
