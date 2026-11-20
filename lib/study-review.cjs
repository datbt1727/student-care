'use strict';
const norm=x=>String(x||'').trim().toUpperCase();
module.exports=function review(term,{offset=0,limit=50}={}){
 if(!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>100)throw Error('Phạm vi trang không hợp lệ.');
 const roster=new Map((term.students||[]).map(s=>[s.id,s])),people=new Map();let outside=0;
 for(const r of term.records||[]){
  if(!roster.has(r.id)){outside++;continue;}
  const k=JSON.stringify([r.id,norm(r.subject)]);
  if(!people.has(k))people.set(k,{studentId:r.id,name:roster.get(r.id).name||'',subject:norm(r.subject),groups:new Map()});
  const p=people.get(k),g=String(r.group||'');
  if(!p.groups.has(g))p.groups.set(g,{group:g,parts:new Set(),slots:new Set(),sourceSchedules:new Set(),first:r.date,last:r.date,records:0,attemptIds:new Set()});
  const c=p.groups.get(g);c.records++;c.parts.add(r.part??'unknown');c.slots.add(r.slots);
  c.sourceSchedules.add(JSON.stringify([r.start||'',r.end||'']));if(r.attemptId)c.attemptIds.add(r.attemptId);
  if(r.date<c.first)c.first=r.date;if(r.date>c.last)c.last=r.date;
 }
 const cases=[...people.values()].map(p=>{
  const groups=[...p.groups.values()].map(g=>({...g,parts:[...g.parts],slots:[...g.slots],sourceSchedules:[...g.sourceSchedules].map(x=>JSON.parse(x)),attemptIds:[...g.attemptIds]}));
  const reasons=[];if(groups.length>1)reasons.push('multiple_groups');
  if(groups.some(g=>g.sourceSchedules.length>1))reasons.push('source_dates_changed');
  if(groups.some(g=>g.parts.length>1))reasons.push('multiple_parts');
  if(groups.some(g=>g.slots.length>1))reasons.push('source_slots_changed');
  return {studentId:p.studentId,name:p.name,subject:p.subject,groupCount:groups.length,omittedGroups:Math.max(0,groups.length-20),groups:groups.slice(0,20).map(g=>({...g,sourceScheduleCount:g.sourceSchedules.length,omittedSchedules:Math.max(0,g.sourceSchedules.length-20),sourceSchedules:g.sourceSchedules.slice(0,20)})),reasons,requiresDecision:reasons.length>0,choices:['retake','continue','transfer','defer']};
 }).filter(p=>p.requiresDecision).sort((a,b)=>a.subject.localeCompare(b.subject)||a.studentId.localeCompare(b.studentId));
 return {readOnly:true,rosterCount:roster.size,totalCases:cases.length,outsideRecordsPreserved:outside,offset,limit,cases:cases.slice(offset,offset+limit),warning:'Tên nhóm và ngày học không xác định được lượt học. Chưa gán mã lượt hoặc sửa dữ liệu. Cả trường hợp không xuất hiện ở đây vẫn có thể cần đối chiếu khi nhập mới.'};
};
