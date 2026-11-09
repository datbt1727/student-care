(function(root){
'use strict';
const valid=p=>p===1||p===2||p==='full';
const label=p=>p==='full'?'Cả kỳ':p?'Part '+p:'Chưa phân Part';
const groupKey=r=>JSON.stringify([String(r.subject||'').trim().toUpperCase(),String(r.group||'').trim().toUpperCase()]);
function bindings(records=[]){
 const map=new Map();
 for(const r of records){
  if(r.part===undefined||r.part===null||r.part==='')continue;
  if(!valid(r.part))throw Error('Part điểm danh chỉ được là 1 hoặc 2, hoặc phạm vi Cả kỳ.');
  if(!r.subject||!r.group)throw Error('Điểm danh có Part phải có mã môn và nhóm lớp.');
  const k=groupKey(r),old=map.get(k);
  if(old&&old!==r.part)throw Error('Môn '+r.subject+' / nhóm '+r.group+' đã thuộc '+label(old)+'. Không dùng cùng nhóm lớp cho hai Part; môn học xuyên kỳ cần được đánh dấu Cả kỳ.');
  map.set(k,r.part);
 }
 return map;
}
function partOf(r,map){return map.get(groupKey(r))||(valid(r.part)?r.part:0);}
function matches(r,selected,map){const p=partOf(r,map);return selected==='all'||p==='full'&&r.subject&&r.group&&['1','2'].includes(String(selected))||String(p)===String(selected==='unknown'?0:selected);}
function scope(term,selected='all'){
 const map=bindings(term.records||[]);
 if(!['all','1','2','full','unknown'].includes(String(selected)))throw Error('Lựa chọn Part không hợp lệ.');
 const records=(term.records||[]).filter(r=>matches(r,selected,map));
 const follows=Object.fromEntries(Object.entries(term.dailyFollow||{}).filter(([,f])=>matches(f,selected,map)));
 return {...term,records,dailyFollow:follows,followAudit:(term.followAudit||[]).filter(f=>matches(f,selected,map))};
}
function stamp(existing,incoming,part){
 if(!valid(part))throw Error('Chọn Part 1, Part 2 hoặc Cả kỳ trước khi kiểm tra file điểm danh.');
 const prior=bindings(existing),oldGroups=new Set(existing.map(groupKey));
 if(part===2&&incoming.some(r=>oldGroups.has(groupKey(r))&&!prior.has(groupKey(r))))throw Error('Nhóm lớp đã có dữ liệu cũ chưa phân Part. Gán dữ liệu cũ vào Part 1 trước; học lại ở Part 2 phải dùng nhóm lớp mới.');
 const rows=incoming.map(r=>({...r,part:prior.get(groupKey(r))==='full'?'full':part}));bindings([...existing,...rows]);return rows;
}
function markFullTerm(a,tid,keys){
 const t=a.terms?.[tid];if(!t)throw Error('Học kỳ không còn tồn tại.');
 const allowed=new Set((t.records||[]).map(groupKey)),chosen=new Set(keys);
 if(!chosen.size||[...chosen].some(k=>!allowed.has(k)))throw Error('Chọn môn/nhóm lớp hợp lệ của học kỳ này.');
 const assign=r=>chosen.has(groupKey(r))?{...r,part:'full'}:r,next={...t,records:t.records.map(assign)};
 if(t.importFiles)next.importFiles=t.importFiles.map(f=>({...f,records:(f.records||[]).map(assign)}));
 bindings(next.records);
 return {...a,terms:{...a.terms,[tid]:next}};
}
// User-confirmed one-time classification, scoped strictly to FALL 2026.
// Return a new archive; keep every attendance number, source and audit event.
function migrateLegacyFall(a){
 const tid='2026-FALL',t=a.terms?.[tid];if(!t)throw Error('Không có học kỳ FALL 2026.');
 const map=bindings([...(t.records||[]),...(t.importFiles||[]).flatMap(f=>f.records||[])]);let records=0,sourceRows=0,acknowledgements=0;
 const assign=(r,source=false)=>{if(valid(r.part))return r;const part=map.get(groupKey(r))||1;if(source)sourceRows++;else records++;return {...r,part};};
 const next={...t,records:(t.records||[]).map(r=>assign(r))};
 if(t.importFiles)next.importFiles=t.importFiles.map(f=>({...f,records:(f.records||[]).map(r=>assign(r,true))}));
 if(t.dailyFollow)next.dailyFollow=Object.fromEntries(Object.entries(t.dailyFollow).map(([k,f])=>{if(f.resolvedMissing&&!f.subject&&!valid(f.part)){acknowledgements++;return [k,{...f,part:1}]}return [k,f]}));
 return {archive:{...a,terms:{...a.terms,[tid]:next}},records,sourceRows,acknowledgements,changed:records+sourceRows+acknowledgements>0};
}
const api={valid,label,groupKey,bindings,partOf,matches,scope,stamp,markFullTerm,migrateLegacyFall};
if(typeof module==='object'&&module.exports)module.exports=api;else root.StudentParts=api;
})(typeof window==='object'?window:globalThis);
