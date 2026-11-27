(function(){
 'use strict';
 const panel=document.querySelector('#study-review-preview');if(!panel)return;
 const labels={retake:'Học lại',continue:'Học tiếp',transfer:'Chuyển lớp'};
 function editor(c){
  try{RegistryCloud.studyReady();}catch(e){panel.querySelector('#study-review-message').textContent=e.message;return;}
  const d=document.createElement('dialog');d.className='study-decision-dialog';
  d.innerHTML='<h2>Xác nhận lượt học</h2><p data-person></p><p>Ngày bên dưới là ngày chốt điểm danh, không phải ngày bắt đầu/kết thúc lớp. Chỉ chọn khoảng ngày khi cần tách hai lượt dùng lại cùng nhóm và Part.</p><div class="study-decision-grid"><label>Phạm vi cũ<select data-source></select></label><label>Phạm vi mới<select data-target></select></label><label>Từ ngày chốt cũ (tùy chọn)<input type="date" data-source-from></label><label>Đến ngày chốt cũ<input type="date" data-source-to></label><label>Từ ngày chốt mới (tùy chọn)<input type="date" data-target-from></label><label>Đến ngày chốt mới<input type="date" data-target-to></label></div><label class="study-confirm"><input type="checkbox" data-planned> Tạo lớp/lượt mới chưa có điểm danh</label><div class="study-decision-grid"><label>Tên nhóm mới (nếu khác)<input type="text" maxlength="100" data-new-group></label><label>Tổng slot chính thức của lớp/lượt mới<input type="number" min="1" max="10000" data-new-slots></label></div><label>Cách xử lý<select data-kind><option value="">Chọn cách xử lý…</option><option value="retake">Học lại — lượt mới, không lấy số vắng cũ</option><option value="continue">Học tiếp — cùng một lượt</option><option value="transfer">Chuyển lớp — cùng một lượt</option></select></label><label class="study-confirm"><input type="checkbox" data-cumulative> Tôi xác nhận số vắng nguồn mới là tổng lũy kế từ đầu lượt học (chỉ học tiếp/chuyển lớp).</label><p data-status role="status"></p><div data-result></div><p><strong>Lưu ý:</strong> áp dụng lựa chọn vào cách hiển thị và báo cáo; giữ nguyên điểm danh và Follow gốc. Lần nhập sau phải chọn đúng lượt.</p><div class="study-controls"><button type="button" class="secondary" data-close>Đóng</button><button type="button" class="secondary" data-preview>Xem tác động</button><button type="button" class="primary" data-save disabled>Xác nhận lưu lựa chọn</button></div>';
  const q=s=>d.querySelector(s);q('[data-person]').textContent=c.studentId+' · '+c.name+' · '+c.subject;
  const options=c.groups.flatMap(g=>[1,2,...(g.parts.includes('full')?['full']:[])].map(part=>({group:g.group,part})));
  for(const side of ['source','target']){const select=q('[data-'+side+']');select.append(new Option('Chọn nhóm và Part…',''));options.forEach((o,i)=>select.append(new Option(o.group+' · '+(o.part==='full'?'Cả kỳ':'Part '+o.part),String(i))));}
  let plan=null,requestId='',working=false,committed=false;
  const invalidate=()=>{plan=null;requestId='';q('[data-save]').disabled=true;q('[data-result]').textContent='';};
  d.querySelectorAll('input,select').forEach(n=>n.addEventListener('change',invalidate));
  function selector(side){const value=q('[data-'+side+']').value;if(value==='')throw Error('Chọn đủ hai nhóm và Part.');const o={...options[Number(value)]},from=q('[data-'+side+'-from]').value,to=q('[data-'+side+'-to]').value;if(from||to){o.from=from;o.to=to;}if(side==='target'&&q('[data-planned]').checked){o.planned=true;o.slots=Number(q('[data-new-slots]').value);if(q('[data-new-group]').value.trim())o.group=q('[data-new-group]').value.trim();}return o;}
  function lock(value){working=value;d.querySelectorAll('input,select,[data-close],[data-preview]').forEach(n=>n.disabled=value||committed);q('[data-close]').disabled=value;q('[data-save]').disabled=value||committed||!plan;}
  q('[data-preview]').onclick=async()=>{
   if(working)return;invalidate();lock(true);q('[data-status]').textContent='Đang kiểm tra; chưa lưu.';
   try{
    plan=await RegistryCloud.previewStudy({studentId:c.studentId,subject:c.subject,kind:q('[data-kind]').value,source:selector('source'),target:selector('target'),cumulativeConfirmed:q('[data-cumulative]').checked});requestId=crypto.randomUUID();
    const table=document.createElement('table'),head=table.createTHead().insertRow();['Lượt','Ngày chốt mới nhất','Vắng / tổng slot','Tỷ lệ'].forEach(text=>{const th=document.createElement('th');th.textContent=text;head.append(th);});const body=table.createTBody();
    for(const a of plan.attempts){const tr=body.insertRow();[a.number,a.last?a.last.split('-').reverse().join('/'):'Chưa nhập điểm danh',a.absent==null?'Chưa có dữ liệu':a.absent+' / '+a.slots,a.percent==null?'—':a.percent.toLocaleString('vi-VN',{minimumFractionDigits:2,maximumFractionDigits:2})+'%'].forEach(text=>{tr.insertCell().textContent=text;});}
    q('[data-result]').replaceChildren(table);q('[data-status]').textContent=plan.sourceCount+' bản ghi cũ · '+plan.targetCount+' bản ghi mới. Chỉ xác nhận khi phân loại và số liệu đúng.';
   }catch(e){plan=null;q('[data-status]').textContent=e.message;}finally{lock(false);}
  };
  q('[data-save]').onclick=async()=>{
   if(working||!plan)return;lock(true);q('[data-status]').textContent='Đang chờ máy chủ xác nhận…';
   try{await RegistryCloud.confirmStudy(plan,requestId);committed=true;plan=null;q('[data-status]').textContent='Đã lưu và áp dụng lựa chọn. Dữ liệu gốc được giữ nguyên.';q('[data-preview]').hidden=true;q('[data-save]').hidden=true;panel.dispatchEvent(new Event('study-saved'));}
   catch(e){q('[data-status]').textContent=e.message+' Nếu chưa có xác nhận, bấm lại nút lưu trong hộp này để kiểm tra cùng giao dịch.';}finally{lock(false);}
  };
  const close=()=>{if(!working){d.close();d.remove();}};q('[data-close]').onclick=close;d.addEventListener('cancel',e=>{e.preventDefault();close();});document.body.append(d);d.showModal();
 }
 window.StudentStudyEditor={open:editor,labels};
})();
