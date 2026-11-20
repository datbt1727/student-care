(function(root){
'use strict';
const clone=v=>JSON.parse(JSON.stringify(v)),norm=v=>String(v||'').trim().toUpperCase();
const ref=r=>JSON.stringify([r.id,r.subject,r.group||'',r.date,...(r.attemptId?[r.attemptId]:[])]);
const validPart=p=>p===1||p===2||p==='full';
const projectionCache=new WeakMap();
const date=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
function select(t,id,subject,s){
 if(!s||typeof s.group!=='string'||!s.group.trim()||s.group.length>100||/[<>\u0000-\u001f]/.test(s.group)||!validPart(s.part)||Object.keys(s).some(k=>!['group','part','from','to','planned','slots'].includes(k)))throw Error('Chọn đúng nhóm và Part.');
 if((s.from||s.to)&&(!date(s.from)||!date(s.to)||s.from>s.to))throw Error('Khoảng ngày chốt cần đủ hai mốc hợp lệ.');
 return (t.records||[]).filter(r=>r.id===id&&r.subject===subject&&(r.group||'')===s.group&&r.part===s.part&&(!s.from||r.date>=s.from&&r.date<=s.to));
}
function index(t){
 const m=new Map();
 for(const d of t.studyDecisions||[])if(d.status==='active')for(const [side,a]of [['source',d.sourceAttempt],['target',d.targetAttempt]])for(const k of d[side+'Refs']){
  const old=m.get(k);if(old&&old.id!==a.id)throw Error('Liên kết lượt học bị xung đột.');
  m.set(k,{...a,part:d.kind==='retake'?d[side].part:d.source.part===d.target.part?d.source.part:'full'});
 }
 return m;
}
function prepare(t,p,decisionId,actor,at=new Date().toISOString()){
 if((t.studyDecisions||[]).length>=1000)throw Error('Đã đạt giới hạn 1.000 quyết định thử nghiệm trong kỳ. Dừng để rà soát trước khi bổ sung.');
 if(!p||Object.keys(p).some(k=>!['studentId','subject','kind','source','target','cumulativeConfirmed'].includes(k)))throw Error('Thông tin quyết định không hợp lệ.');
 if(!t.students?.some(s=>s.id===p.studentId)||typeof p.subject!=='string'||!['retake','continue','transfer'].includes(p.kind))throw Error('Sinh viên, môn hoặc quyết định không hợp lệ.');
 if(!/^[\w-]{8,100}$/.test(decisionId)||!actor||(t.studyDecisions||[]).some(d=>d.id===decisionId))throw Error('Mã quyết định không hợp lệ hoặc đã được dùng.');
 const source=select(t,p.studentId,p.subject,p.source),target=select(t,p.studentId,p.subject,p.target);
 if(p.source.planned||p.source.slots!==undefined)throw Error('Phạm vi cũ phải là dữ liệu đã lưu.');
 const planned=p.target.planned===true;
 if(planned&&(target.length||!Number.isInteger(p.target.slots)||p.target.slots<1||p.target.slots>10000))throw Error('Lớp/lượt mới cần chọn phạm vi chưa có bản ghi và xác nhận tổng slot từ 1 đến 10.000.');
 if(!source.length||!target.length&&!planned)throw Error('Phạm vi đã chọn không có dữ liệu.');
 if((t.studyDecisions||[]).some(d=>d.status==='active'&&d.studentId===p.studentId&&d.subject===p.subject&&JSON.stringify(d.target)===JSON.stringify(p.target)))throw Error('Phạm vi mới đã có quyết định đang hiệu lực. Không tạo trùng.');
 const src=new Set(source.map(ref));if(target.some(r=>src.has(ref(r))))throw Error('Hai phạm vi trùng nhau. Chọn khoảng ngày chốt riêng khi dùng lại cùng nhóm và Part.');
 const m=index(t),prior=new Set(source.map(r=>m.get(ref(r))?.id).filter(Boolean)),targetPrior=new Set(target.map(r=>m.get(ref(r))?.id).filter(Boolean));
 if(prior.size>1||targetPrior.size)throw Error('Phạm vi đã liên kết lượt khác. Chưa ghi đè; cần đối chiếu lại.');
 const sourceSlots=[...new Set(source.map(r=>r.slots))],targetSlots=planned?[p.target.slots]:[...new Set(target.map(r=>r.slots))];
 if(p.kind!=='retake'&&(sourceSlots.length!==1||targetSlots.length!==1||sourceSlots[0]!==targetSlots[0]||p.cumulativeConfirmed!==true))throw Error('Học tiếp/chuyển lớp cần cùng tổng slot và xác nhận số vắng nguồn là lũy kế toàn lượt.');
 const old=prior.size?[...m.values()].find(a=>a.id===[...prior][0]):null;
 const n=Math.max(0,...(t.studyDecisions||[]).filter(d=>d.studentId===p.studentId&&d.subject===p.subject).flatMap(d=>[d.sourceAttempt.number,d.targetAttempt.number]));
 const sourceAttempt=old?{id:old.id,number:old.number}:{id:decisionId+'-source',number:n+1};
 const targetAttempt=p.kind==='retake'?{id:decisionId+'-target',number:Math.max(n,sourceAttempt.number)+1}:{...sourceAttempt};
 const d={id:decisionId,studentId:p.studentId,subject:p.subject,kind:p.kind,source:clone(p.source),target:clone(p.target),sourceRefs:source.map(ref),targetRefs:target.map(ref),sourceAttempt,targetAttempt,sourceSlots,targetSlots,cumulativeConfirmed:p.cumulativeConfirmed===true,status:'active',actor,at};
 index({...t,studyDecisions:[...(t.studyDecisions||[]),d]});
 return d;
}
function project(t){
 if(!t.studyDecisions?.length)return t;
 let cached=projectionCache.get(t.studyDecisions);if(!cached){const m=index(t),rules=[];for(const d of t.studyDecisions)if(d.status==='active')for(const side of ['source','target'])rules.push({studentId:d.studentId,subject:d.subject,selector:d[side],attempt:d[side+'Attempt'],part:d.kind==='retake'?d[side].part:d.source.part===d.target.part?d.source.part:'full'});cached={m,rules};projectionCache.set(t.studyDecisions,cached);}const {m,rules}=cached;
 const assign=r=>{
  let a=m.get(ref(r));
  if(!a&&r.attemptId){const choices=rules.filter(x=>x.studentId===r.id&&x.subject===r.subject&&x.attempt.id===r.attemptId&&x.selector.group===(r.group||''));if(choices.length)a={...choices.at(-1).attempt,part:choices.at(-1).part};}
  if(!a&&!r.absent&&r.slots===undefined){const choices=rules.filter(x=>x.studentId===r.id&&x.subject===r.subject&&x.selector.group===(r.group||'')&&(!validPart(r.part)||x.part==='full'||r.part===x.part)&&(!x.selector.from||r.date>=x.selector.from&&r.date<=x.selector.to));const ids=new Set(choices.map(x=>x.attempt.id));if(ids.size===1)a={...choices.at(-1).attempt,part:choices.at(-1).part};}
  return a?{...r,attemptId:a.id,attemptNumber:a.number,part:a.part,studyLabel:'Lượt '+a.number}:r;
 };
 return {...t,records:(t.records||[]).map(assign),dailyFollow:Object.fromEntries(Object.entries(t.dailyFollow||{}).map(([k,f])=>[k,assign(f)])),followAudit:(t.followAudit||[]).map(assign)};
}
function candidates(t,r){
 const m=new Map();
 for(const d of t.studyDecisions||[])if(d.status==='active'&&d.studentId===r.id&&d.subject===r.subject)for(const side of ['source','target'])if(d[side].group===(r.group||'')){const a=d[side+'Attempt'];m.set(a.id,{...a,slots:d[side+'Slots'].length===1?d[side+'Slots'][0]:null,part:d.kind==='retake'?d[side].part:d.source.part===d.target.part?d.source.part:'full',label:'Lượt '+a.number+' · '+(d[side].part==='full'?'Cả kỳ':'Part '+d[side].part)});}
 return [...m.values()];
}
function key(r){return r.attemptId?JSON.stringify([r.id,r.subject,'attempt',r.attemptId]):JSON.stringify([r.id,r.subject,r.group||'']);}
function followStorageKey(t,r,day){const notes=Object.fromEntries(Object.entries(t.dailyFollow||{}).filter(([,f])=>f.id===r.id&&f.subject===r.subject&&f.date===day)),p=project({...t,records:[],dailyFollow:notes,followAudit:[]});return Object.entries(p.dailyFollow||{}).find(([,f])=>key(f)===key(r))?.[0];}
function validateNew(before,after){
 const prior=new Set([...(before.records||[]),...(before.importFiles||[]).flatMap(f=>f.records||[])].map(ref));
 for(const r of [...(after.records||[]),...(after.importFiles||[]).flatMap(f=>f.records||[])]){
  const options=candidates(after,r);
  if(r.attemptId&&!options.some(a=>a.id===r.attemptId&&(a.part==='full'||a.part===r.part)&&(!a.slots||a.slots===r.slots)&&(r.attemptNumber===undefined||r.attemptNumber===a.number)))throw Error('Mã lượt học hoặc tổng slot không thuộc đúng sinh viên, môn, nhóm và Part.');
  if(!r.attemptId&&!prior.has(ref(r))&&options.length)throw Error('Bản ghi mới cần chọn lượt học đã xác nhận; chưa tự gán theo tên nhóm hoặc ngày lớp.');
 }
 for(const f of Object.values(after.dailyFollow||{}))if(f.attemptId&&!candidates(after,f).some(a=>a.id===f.attemptId&&(f.attemptNumber===undefined||f.attemptNumber===a.number)))throw Error('Ghi chú không thuộc đúng lượt học của sinh viên/môn/nhóm.');
}
// Read-only consequence preview. Cumulative snapshots are selected, never summed.
function summary(t,d){
 const projected=project({...t,studyDecisions:[...(t.studyDecisions||[]),d]}),ids=new Set([d.sourceAttempt.id,d.targetAttempt.id]);
 return [...ids].map(id=>{const rows=projected.records.filter(r=>r.attemptId===id).sort((a,b)=>a.date.localeCompare(b.date)),latest=rows.at(-1),days=new Map();for(const r of rows){const old=days.get(r.date);if(old&&(old.absent!==r.absent||old.slots!==r.slots))throw Error('Cùng lượt/ngày có số liệu khác nhau; cần đối chiếu nguồn, chưa lưu quyết định.');days.set(r.date,r);}if(!latest)return {id,number:d.targetAttempt.number,records:0,first:'',last:'',slots:d.targetSlots[0],absent:0,percent:0,groups:[d.target.group]};return {id,number:latest.attemptNumber,records:rows.length,first:rows[0].date,last:latest.date,slots:latest.slots,absent:latest.absent,percent:latest.absent/latest.slots*100,groups:[...new Set(rows.map(r=>r.group))]};});
}
const api={ref,prepare,index,project,candidates,key,summary,followStorageKey,validateNew};
if(typeof module==='object'&&module.exports)module.exports=api;else root.StudentStudyDecisions=api;
})(typeof window==='object'?window:globalThis);
