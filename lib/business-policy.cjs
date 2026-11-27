(function(root){
'use strict';
const norm=v=>String(v||'').trim().toUpperCase();
const key=r=>JSON.stringify([r.id,r.subject,r.group||'']);
function followSources(term,records,follows){
 const ids=new Set((term.students||[]).map(s=>s.id)),catalog=(term.courseCatalog||[]).filter(c=>norm(c.subject)&&norm(c.subject)!=='GPDP101'),codes=new Map(catalog.map(c=>[norm(c.subject),c.subject]));
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
const api={followSources,review,classify};if(typeof module==='object'&&module.exports)module.exports=api;else root.StudentBusinessPolicy=api;
})(typeof window==='object'?window:globalThis);
