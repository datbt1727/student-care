(function(root){
'use strict';
const P=typeof module==='object'&&module.exports?require('./parts.cjs'):root.StudentParts;
const D=typeof module==='object'&&module.exports?require('./study-decisions.cjs'):root.StudentStudyDecisions;
const MAX_FILE_BYTES=10000000;
function checkFiles(files){if(!files.length||files.length>10)throw Error('Chọn từ 1 đến 10 file/lần.');for(const f of files){if(!/\.xlsx$/i.test(f.name))throw Error('Chỉ hỗ trợ file .xlsx.');if(Number.isFinite(f.size)&&f.size>=MAX_FILE_BYTES)throw Error(f.name+': mỗi file phải nhỏ hơn 10 MB (10.000.000 byte).');}}
const norm=v=>String(v||'').trim().toUpperCase();
function termId(v){const s=norm(v),y=s.match(/\b(20\d{2})\b/)?.[1],c=/SPRING|\bSPR\b|\bSP\b/.test(s)?'SPR':/SUMMER|\bSUM\b|\bSU\b/.test(s)?'SUM':/FALL|\bFA\b/.test(s)?'FALL':'';return y&&c?y+'-'+c:'';}
function plan(term,files,part,tid){
 if(part!==1&&part!==2)throw Error('Chọn Part 1 hoặc Part 2.');
 const projected=D.project(term),history=D.project({...term,records:[...(term.records||[]),...(term.importFiles||[]).flatMap(f=>f.records||[])]}).records,bindings=P.bindings(history),oldGroups=new Set(history.map(P.groupKey)),full=new Set(term.fullTermSubjects||[]),roster=new Map((term.students||[]).map(s=>[norm(s.id),s]));
 const reports=[],candidates=[],keys=new Map(),existing=new Map(projected.records.map(r=>[JSON.stringify([D.key(r),r.date]),r]));
 for(const [fi,file]of files.entries()){
  for(const message of file.errors||[])reports.push({file:file.name,sheet:'Điểm danh',line:'—',id:'',name:'',errors:[message],warnings:[]});
  for(const raw of file.rows||[]){
   const r={...raw},student=roster.get(norm(r.id));if(student)r.id=student.id;
   const attempts=D.candidates(term,r),choices=attempts.filter(a=>a.part==='full'||a.part===part),chosen=choices.find(a=>a.id===r.attemptId);
   if(chosen){r.attemptId=chosen.id;r.attemptNumber=chosen.number;}const k=P.groupKey(r),prior=chosen?.part||bindings.get(k),report={file:file.name,sheet:r.subject||'Điểm danh',line:r.line||'—',id:r.id||'',name:r.name||student?.name||'',subject:r.subject||'',group:r.group||'',part:prior||part,errors:[],warnings:[]};
   if(attempts.length&&!chosen)report.errors.push(choices.length?'Cần chọn đúng lượt học đã xác nhận trước khi nhập dòng này.':'Không có lượt học đã xác nhận thuộc Part đang nhập; giữ dữ liệu cũ, cần đối chiếu.');
   if(r.attemptId&&!chosen)report.errors.push('Mã lượt học không thuộc đúng sinh viên, môn, nhóm và Part.');
   if(chosen?.slots&&chosen.slots!==r.slots)report.errors.push('Tổng slot nguồn khác tổng slot lượt học đã xác nhận; cần đối chiếu trước khi nhập.');
   if(!student)report.errors.push('MSSV không có trong danh sách học kỳ; không nhập dòng này.');
   if(norm(r.subject)==='ENR003'&&norm(r.group)==='ENR003 - TUTOR')report.errors.push('Nhóm ENR003 - TUTOR chưa được công nhận; không nhập mới, giữ nguyên lịch sử cũ để đối chiếu.');
   if(termId(r.term)!==tid)report.errors.push('Học kỳ nguồn không khớp học kỳ đang chọn.');
   if(!r.subject||!r.group||!/^\d{4}-\d{2}-\d{2}$/.test(r.date||'')||!Number.isFinite(Date.parse(r.date+'T00:00:00Z'))||new Date(r.date+'T00:00:00Z').toISOString().slice(0,10)!==r.date||!Number.isInteger(r.slots)||r.slots<=0||!Number.isInteger(r.absent)||r.absent<0||r.absent>r.slots)report.errors.push('Mã môn, nhóm lớp, ngày hoặc số slot không hợp lệ.');
   const scope=chosen?chosen.part:prior==='full'||full.has(r.subject)?'full':prior||part;report.part=scope;
   if(scope!=='full'&&scope!==part)report.errors.push(P.label(scope)+' / nhóm '+r.group+' không thuộc Part '+part+' và không được đánh dấu Cả kỳ; bỏ qua, giữ dữ liệu cũ.');
   if(!prior&&oldGroups.has(k)&&part===2&&!full.has(r.subject))report.errors.push('Nhóm cũ chưa phân Part. Phân dữ liệu cũ trước khi nhập Part 2.');
   if(student){r.id=student.id;if(r.name&&r.name!==student.name)report.warnings.push('Tên nguồn khác hồ sơ; dùng MSSV để đối chiếu, không đổi hồ sơ.');}
   r.part=scope;const candidate={row:r,report,fi};reports.push(report);candidates.push(candidate);
   if(!report.errors.length){const key=JSON.stringify([D.key(r),r.date]),list=keys.get(key)||[];list.push(candidate);keys.set(key,list);}
  }
  for(const message of file.warnings||[])reports.push({file:file.name,sheet:'Đối chiếu nguồn',line:'—',id:'',name:'',errors:[],warnings:[message]});
 }
 for(const list of keys.values())if(list.length>1){const signatures=new Set(list.map(c=>JSON.stringify([c.row.absent,c.row.slots,c.row.status||'',c.row.part])));if(signatures.size>1)for(const c of list)c.report.errors.push('Trùng sinh viên/môn/nhóm/ngày nhưng khác số liệu; loại mọi dòng xung đột.');else for(const c of list.slice(1)){c.duplicate=true;c.report.warnings.push('Trùng hoàn toàn; chỉ nhập một bản ghi.');}}
 const valid=candidates.filter(c=>!c.report.errors.length&&!c.duplicate),rows=valid.map(c=>c.row),fileRows=files.map((f,fi)=>({name:f.name,part,date:rows[0]?.date||'',records:valid.filter(c=>c.fi===fi).map(c=>c.row)})).filter(f=>f.records.length);
 const changes=valid.map(c=>{const before=existing.get(JSON.stringify([D.key(c.row),c.row.date])),after=c.row;
 const fields=['absent','slots','status','start','end','part'],changedFields=before?fields.filter(k=>JSON.stringify(before[k]??'')!==JSON.stringify(after[k]??'')):[];
 const type=!before?'add':changedFields.length?'correct':'unchanged';
 if(type==='correct')c.report.warnings.push('Cập nhật bản ghi đã có: vắng '+before.absent+'/'+before.slots+' → '+after.absent+'/'+after.slots+' slot. Thay đổi: '+changedFields.join(', ')+'. Chỉ thay sau khi xác nhận.');
 if(type==='unchanged')c.report.warnings.push('Số liệu đã có giống hoàn toàn; không thay đổi điểm danh.');
 return {type,id:after.id,subject:after.subject,group:after.group,date:after.date,before:before?{...before}:null,after:{...after},changedFields};});
 const writeCandidates=valid.filter((c,i)=>changes[i].type!=='unchanged');
 const writeRows=writeCandidates.map(c=>c.row),writeFileRows=files.map((f,fi)=>({name:f.name,part,date:writeCandidates.find(c=>c.fi===fi)?.row.date||'',records:writeCandidates.filter(c=>c.fi===fi).map(c=>c.row)})).filter(f=>f.records.length);
 return {rows,fileRows,writeRows,writeFileRows,unchangedCount:changes.filter(c=>c.type==='unchanged').length,reports,changes,rejected:reports.filter(r=>r.errors.length).length};
}
const api={MAX_FILE_BYTES,checkFiles,plan};if(typeof module==='object'&&module.exports)module.exports=api;else root.StudentAttendanceImport=api;
})(typeof window==='object'?window:globalThis);
