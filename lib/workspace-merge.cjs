(function(root){
'use strict';
const missing=Symbol('missing'),blocked=new Set(['__proto__','prototype','constructor']);
const copy=v=>v===missing||v===undefined?v:JSON.parse(JSON.stringify(v));
function same(a,b){if(a===b)return true;if(a===missing||b===missing||typeof a!==typeof b||a===null||b===null)return false;if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((x,i)=>same(x,b[i]));if(typeof a==='object'){const ak=Object.keys(a),bk=Object.keys(b);return ak.length===bk.length&&ak.every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));}return false;}
const plain=v=>v!==missing&&v!==null&&typeof v==='object'&&!Array.isArray(v);
function merge(base,local,remote,choices={}){
 const conflicts=[];
 const conflict=(b,l,r,path,locked=false)=>{const key=JSON.stringify(path);if(!locked&&choices[key]==='local')return copy(l);if(!locked&&choices[key]==='remote')return copy(r);conflicts.push({key,path,resolvable:!locked,base:b===missing?undefined:copy(b),local:l===missing?undefined:copy(l),remote:r===missing?undefined:copy(r)});return copy(l);};
 function walk(b,l,r,path){
  if(same(l,r))return copy(r);if(same(l,b))return copy(r);if(same(r,b))return copy(l);
  if(path.length===1&&path[0]==='active'||path.length===3&&path[0]==='terms'&&path[2]==='asof')return copy(r);
  if(plain(l)&&plain(r)&&(plain(b)||b===missing)){const out={};for(const k of new Set([...Object.keys(b===missing?{}:b),...Object.keys(r),...Object.keys(l)])){if(blocked.has(k))throw Error('Trường dữ liệu không an toàn.');const value=walk(b!==missing&&Object.hasOwn(b,k)?b[k]:missing,Object.hasOwn(l,k)?l[k]:missing,Object.hasOwn(r,k)?r[k]:missing,[...path,k]);if(value!==missing)out[k]=value;}return out;}
  if(Array.isArray(l)&&Array.isArray(r)&&(Array.isArray(b)||b===missing)){
   const before=b===missing?[]:b,field=path.at(-1);
   if(['events','log','audit','trainingAudit','followAudit','catalogAudit'].includes(field)){
    if(l.length<before.length||r.length<before.length||!same(l.slice(0,before.length),before)||!same(r.slice(0,before.length),before))return conflict(b,l,r,path,true);
    const out=copy(r);for(const item of l.slice(before.length)){const id=item?.eventId;const prior=id?out.find(x=>x?.eventId===id):null;if(prior&&!same(prior,item))return conflict(b,l,r,path,true);if(!out.some(x=>same(x,item)))out.push(copy(item));}return out;
   }
   const key=field==='students'?x=>x.id:field==='records'?x=>JSON.stringify([x.term||'',x.id,x.subject,x.group||'',x.date]):field==='courseCatalog'?x=>x.subject:field==='importBatches'?x=>x.batchId:['certificates','insurance'].includes(field)?x=>x.recordId:field==='importFiles'?x=>x.id:null;
   if(key){const map=rows=>{const m=new Map();for(const item of rows){const id=item&&key(item);if(typeof id!=='string'||!id||m.has(id))return null;m.set(id,item);}return m;},bm=map(before),lm=map(l),rm=map(r);if(!bm||!lm||!rm)return conflict(b,l,r,path);const out=[];
    for(const id of new Set([...rm.keys(),...lm.keys(),...bm.keys()])){const bv=bm.has(id)?bm.get(id):missing,lv=lm.has(id)?lm.get(id):missing,rv=rm.has(id)?rm.get(id):missing;const rowPath=[...path,id];let value;
     if(['records','certificates','insurance','importFiles','importBatches'].includes(field)&&!same(lv,rv)&&!same(lv,bv)&&!same(rv,bv))value=conflict(bv,lv,rv,rowPath);else value=walk(bv,lv,rv,rowPath);
     if(value!==missing)out.push(value);
    }return out;
   }
  }
  return conflict(b,l,r,path);
 }
 return {archive:walk(base,local,remote,[]),conflicts};
}
const api={merge,same};if(typeof module==='object'&&module.exports)module.exports=api;else root.StudentWorkspaceMerge=api;
})(typeof window==='object'?window:globalThis);
