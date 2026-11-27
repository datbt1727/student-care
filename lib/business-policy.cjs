(function(root){
'use strict';
const norm=v=>String(v||'').trim().toUpperCase();
const key=r=>JSON.stringify([r.id,r.subject,r.group||'']);

function catalogCodes(catalog=[]){
 if(!Array.isArray(catalog)||catalog.length>3000)throw Error('Danh mục môn không hợp lệ.');
 const map=new Map(),subjects=new Set();
 for(const c of catalog){
  if(!c||typeof c.subject!=='string'||!norm(c.subject)||c.subject.length>100||(c.name!==undefined&&(typeof c.name!=='string'||c.name.length>500)))throw Error('Mã và tên môn không hợp lệ.');
  if(subjects.has(norm(c.subject)))throw Error('Mã môn bị trùng: '+c.subject);subjects.add(norm(c.subject));
  if(c.aliases!==undefined&&(!Array.isArray(c.aliases)||c.aliases.length>50||c.aliases.some(x=>typeof x!=='string'||!norm(x)||x.length>100)))throw Error('Mã môn liên kết không hợp lệ.');
  for(const code of [c.subject,...(c.aliases||[])]){const k=norm(code);if(map.has(k)&&map.get(k)!==c.subject)throw Error('Mã môn bị trùng hoặc liên kết với nhiều môn: '+k);map.set(k,c.subject);}
 }
 return map;
}
function editCatalog(term,oldCode,newCode,newName,actor){
 const code=norm(newCode),name=String(newName||'').trim(),catalog=term.courseCatalog||[],index=catalog.findIndex(c=>c.subject===oldCode);
 if(index<0)throw Error('Môn học không còn trong danh mục.');
 if(!/^[A-Z0-9][A-Z0-9._-]{0,99}$/.test(code)||!name||name.length>500||/[<>]/.test(name))throw Error('Kiểm tra mã môn và tên môn.');
 const previous=catalog[index],aliases=[...new Set([...(previous.aliases||[]),...(norm(previous.subject)!==code?[previous.subject]:[])])].filter(x=>norm(x)!==code);
 if(norm(previous.subject)!==code){
  const owned=new Set([previous.subject,...(previous.aliases||[])].map(norm));
  const refs=[...(term.records||[]),...Object.values(term.dailyFollow||{}),...(term.importFiles||[]).flatMap(f=>f.records||[]),...(term.studyDecisions||[])];
  if(!owned.has(code)&&refs.some(r=>norm(r.subject)===code))throw Error('Mã mới đã có dữ liệu riêng. Không tự gộp hai môn; cần đối chiếu.');
 }
 const next={...previous,subject:code,name,...(aliases.length?{aliases}:{})};if(!aliases.length)delete next.aliases;
 const rows=catalog.map((c,i)=>i===index?next:c);catalogCodes(rows);
 if(JSON.stringify(next)===JSON.stringify(previous))return term;
 return {...term,courseCatalog:rows,catalogAudit:[...(term.catalogAudit||[]),{type:'edit',before:previous,after:next,actor,at:new Date().toISOString(),term:term.termId}]};
}

function followSources(term,records,follows){
 const ids=new Set((term.students||[]).map(s=>s.id)),catalog=(term.courseCatalog||[]).filter(c=>norm(c.subject)&&norm(c.subject)!=='GPDP101'),codes=catalogCodes(catalog);
 const select=rows=>rows.filter(r=>ids.has(r.id)&&codes.has(norm(r.subject))).map(r=>r.subject===codes.get(norm(r.subject))?r:{...r,subject:codes.get(norm(r.subject))});
 return {records:select(records),follows:select(follows),catalog};
}
function review(term){
 const roster=new Set((term.students||[]).map(s=>s.id)),map=new Map();let outside=0;
 for(const r of term.records||[]){if(!roster.has(r.id)){outside++;continue;}const k=JSON.stringify([r.id,r.subject]);if(!map.has(k))map.set(k,{id:r.id,subject:r.subject,groups:new Map()});const c=map.get(k),g=r.group||'';if(!c.groups.has(g))c.groups.set(g,{group:g,parts:new Set(),slots:new Set(),first:r.date,last:r.date,records:0});const a=c.groups.get(g);a.records++;a.parts.add(r.part||'unknown');a.slots.add(r.slots);if(r.date<a.first)a.first=r.date;if(r.date>a.last)a.last=r.date;}
 const cases=[...map.values()].filter(c=>c.groups.size>1).map(c=>({id:c.id,subject:c.subject,groups:[...c.groups.values()].map(g=>({...g,parts:[...g.parts],slots:[...g.slots]})),rule:norm(c.subject)==='AEG116'?'separate_class_attempts':norm(c.subject)==='GPDP101'?'excluded_from_follow':'needs_review'}));
 return {rosterCount:roster.size,outsideRecordCount:outside,cases};
}
function classify(row,term){
 const same=(term.records||[]).filter(r=>r.id===row.id&&norm(r.subject)===norm(row.subject)&&String(r.group||'')!==String(row.group||''));
 if(norm(row.subject)==='AEG116')return {type:'new_class_data',identity:key(row),inheritAbsence:false};
 if(norm(row.subject)==='ENR003'&&norm(row.group)==='ENR003 - TUTOR')return {type:'unrecognized_group',identity:key(row),inheritAbsence:false};
 if(/^ENR\d+$/.test(norm(row.subject))&&same.length)return {type:'needs_review',identity:key(row),inheritAbsence:false};
 return {type:'group_scoped',identity:key(row),inheritAbsence:false};
}
const api={followSources,review,classify,catalogCodes,editCatalog};if(typeof module==='object'&&module.exports)module.exports=api;else root.StudentBusinessPolicy=api;
})(typeof window==='object'?window:globalThis);
