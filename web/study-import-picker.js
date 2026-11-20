(function(){
 'use strict';
 window.chooseStudyImport=function(term,inputs,part){
  const cases=new Map();
  for(const file of inputs)for(const r of file.rows||[]){const all=StudentStudyDecisions.candidates(term,r),options=all.filter(a=>a.part==='full'||a.part===part);if(!options.length)continue;const key=JSON.stringify([r.id,r.subject,r.group]);if(!cases.has(key))cases.set(key,{key,row:r,options});}
  if(!cases.size)return Promise.resolve(inputs);
  return new Promise((resolve,reject)=>{
   const d=document.createElement('dialog');d.className='study-decision-dialog';d.innerHTML='<h2>Chọn lượt học cho lần nhập</h2><p>Chọn lượt đã đối chiếu cho từng sinh viên/môn/nhóm. Ngày lớp thay đổi không tạo lượt mới. Dòng chưa chọn sẽ được báo cần điều chỉnh và không nhập.</p><button type="button" class="secondary" data-unique>Chọn các dòng chỉ có một lượt phù hợp</button><div data-list></div><div class="study-controls"><button type="button" class="secondary" data-cancel>Hủy kiểm tra</button><button type="button" class="primary" data-apply>Tiếp tục kiểm tra file</button></div>';
   const selects=new Map();
   for(const c of cases.values()){const label=document.createElement('label');label.textContent=c.row.id+' · '+c.row.subject+' · '+c.row.group;const select=document.createElement('select');select.setAttribute('aria-label','Lượt học '+label.textContent);select.append(new Option('Chưa xác định — bỏ qua dòng này',''));for(const a of c.options)select.append(new Option(a.label,a.id));label.append(select);d.querySelector('[data-list]').append(label);selects.set(c.key,select);}
   const close=()=>{d.close();d.remove();};const cancel=()=>{close();reject(Error('Đã hủy kiểm tra; chưa nhập dữ liệu.'));};
   d.querySelector('[data-unique]').onclick=()=>{for(const c of cases.values())if(c.options.length===1)selects.get(c.key).value=c.options[0].id;};
   d.querySelector('[data-cancel]').onclick=cancel;d.addEventListener('cancel',e=>{e.preventDefault();cancel();});
   d.querySelector('[data-apply]').onclick=()=>{const selected=new Map([...selects].map(([k,n])=>[k,n.value]));const result=inputs.map(f=>({...f,rows:f.rows?.map(r=>{const attemptId=selected.get(JSON.stringify([r.id,r.subject,r.group]));return attemptId?{...r,attemptId}:r;})}));close();resolve(result);};
   document.body.append(d);d.showModal();
  });
 };
})();
