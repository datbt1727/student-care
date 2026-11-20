'use strict';
const {isDeepStrictEqual:same}=require('node:util');
const correction=require('./aeg-part-correction.cjs');
const key=r=>JSON.stringify([r.id,r.subject,r.group||'',r.date,r.attemptId||'']);
function rows(before,after){
 const buckets=new Map();for(const r of after){const k=key(r);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(r);}
 let unchanged=0,missing=0,changed=0,ambiguous=0;const fields={};
 for(const r of before){const bucket=buckets.get(key(r))||[],i=bucket.findIndex(n=>same(r,n));if(i>=0){bucket.splice(i,1);unchanged++;continue;}if(!bucket.length){missing++;continue;}if(bucket.length!==1){ambiguous++;continue;}const n=bucket.shift();changed++;for(const f of new Set([...Object.keys(r),...Object.keys(n)]))if(!same(r[f],n[f]))fields[f]=(fields[f]||0)+1;}
 return {original:before.length,current:after.length,unchanged,missing,changed,ambiguous,changedFields:fields,additional:[...buckets.values()].reduce((n,b)=>n+b.length,0)};
}
module.exports=function detail(baseline,checkpoint,current){
 if(!same(baseline,checkpoint))throw Error('BASELINE_CHECKPOINT_MISMATCH');
 const planned=correction.plan(checkpoint),expected=planned.archive,terms=[];
 for(const [tid,t]of Object.entries(expected.terms||{})){const n=current.terms?.[tid]||{};terms.push({termId:tid,attendance:rows(t.records||[],n.records||[]),sourceRows:rows((t.importFiles||[]).flatMap(f=>f.records||[]),(n.importFiles||[]).flatMap(f=>f.records||[])),missingOrChangedProfiles:(t.students||[]).filter(s=>!(n.students||[]).some(x=>same(s,x))).length,missingOrChangedFollow:Object.entries(t.dailyFollow||{}).filter(([k,v])=>!same(v,n.dailyFollow?.[k])).length,missingOrChangedNotes:Object.entries(t.notes||{}).filter(([k,v])=>!same(v,n.notes?.[k])).length});}
 const missingOrChangedMaster=Object.entries(expected.registry?.students||{}).filter(([k,v])=>!same(v,current.registry?.students?.[k])).length;
 const passed=missingOrChangedMaster===0&&terms.every(t=>t.missingOrChangedProfiles===0&&t.missingOrChangedFollow===0&&t.missingOrChangedNotes===0&&[t.attendance,t.sourceRows].every(r=>!r.missing&&!r.changed&&!r.ambiguous));
 return {ok:passed,readOnly:true,baselineMatchesCheckpoint:true,approvedCorrection:planned.summary,missingOrChangedMaster,terms,conclusion:passed?'Chỉ phát hiện thay đổi Part AEG đã phê duyệt trên dữ liệu gốc; các bản ghi bổ sung được thống kê riêng.':'Có khác biệt chưa giải thích được. Dừng trước Production; không tự sửa hoặc khôi phục.',warning:'Chỉ đối chiếu dữ liệu được kiểm tra, không xác nhận toàn bộ nghiệp vụ hoặc an toàn Production.'};
};