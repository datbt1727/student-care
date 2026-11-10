(function(root){
'use strict';
function build(records,follows){
 const subjects=new Map();
 function group(r){if(!r.subject)return null;let groups=subjects.get(r.subject);if(!groups){groups=new Map();subjects.set(r.subject,groups);}const key=r.group||'';let g=groups.get(key);if(!g){g={records:[],follows:[],dates:new Set(),ids:new Set(),cells:new Map(),notes:new Map()};groups.set(key,g);}g.ids.add(r.id);g.dates.add(r.date);return g;}
 for(const r of records){const g=group(r);if(!g)continue;const key=JSON.stringify([r.id,r.date]);if(g.cells.has(key))throw Error(r.id+' / '+r.subject+': trùng bản ghi cùng nhóm/ngày. Cần đối chiếu trước khi xuất QA.');g.records.push(r);g.cells.set(key,r);}
 for(const f of follows){const g=group(f);if(!g)continue;g.follows.push(f);const text=f.note||f.publicNote;if(text){const key=JSON.stringify([f.id,f.date]),list=g.notes.get(key)||[];list.push(text);g.notes.set(key,list);}}
 return subjects;
}
const api={build};if(typeof module==='object'&&module.exports)module.exports=api;else root.StudentReportIndex=api;
})(typeof window==='object'?window:globalThis);
