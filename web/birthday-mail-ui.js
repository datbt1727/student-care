 function birthdayTable(headers,rows){return '<div class="table-wrap"><table><thead><tr>'+headers.map(v=>'<th>'+esc(v)+'</th>').join('')+'</tr></thead><tbody>'+(rows.map(r=>'<tr>'+r.map(v=>'<td>'+v+'</td>').join('')+'</tr>').join('')||'<tr><td colspan="5">Không có sinh nhật phù hợp với ngày và bộ lọc đã chọn.</td></tr>')+'</tbody></table></div>';}
 let birthdayBusy=false,birthdaySelection=new Set(),birthdayScope='';
 function birthdays(){
 const date=q('#birthday-date').value||today(),filter=q('#birthday-filter').value;
 if(birthdayScope!==date+'|'+filter){birthdaySelection.clear();birthdayScope=date+'|'+filter;}
 const map=RegistryCloud.birthdayMail,list=S.birthdayRows(archive,date).filter(r=>filter==='all'||StudentBirthdayMail.sent(map,r[0],date)===(filter==='sent'));
 const writable=!!window.StudentPermissions?.has('editFollow');
 const available=new Set(list.filter(r=>!StudentBirthdayMail.sent(map,r[0],date)).map(r=>r[0]));
 for(const id of birthdaySelection)if(!available.has(id))birthdaySelection.delete(id);
 q('#birthday-list').innerHTML=birthdayTable(['MSSV','Họ và tên','Email','Trạng thái','Thao tác'],list.map(r=>{const done=StudentBirthdayMail.sent(map,r[0],date);return [(!done&&writable?`<label><input type="checkbox" data-birthday-select="${esc(r[0])}" ${birthdaySelection.has(r[0])?'checked':''} ${birthdayBusy?'disabled':''}> ${esc(r[0])}</label>`:esc(r[0])),esc(r[1]),esc(r[2]),done?'Đã gửi email':'Chưa ghi nhận gửi',!done&&writable?`<button data-birthday-mark="${esc(r[0])}" ${birthdayBusy?'disabled':''}>Đã gửi email</button>`:'—'];}));
 q('#birthday-all').disabled=!writable||birthdayBusy||!available.size;
 q('#birthday-all').checked=available.size>0&&birthdaySelection.size===available.size;
 q('#birthday-all').indeterminate=birthdaySelection.size>0&&birthdaySelection.size<available.size;
 q('#birthday-bulk').disabled=!writable||birthdayBusy||!birthdaySelection.size;
 q('#birthday-bulk').textContent='Đã gửi email ('+birthdaySelection.size+')';
 q('#birthday-list').querySelectorAll('[data-birthday-select]').forEach(n=>n.onchange=()=>{n.checked?birthdaySelection.add(n.dataset.birthdaySelect):birthdaySelection.delete(n.dataset.birthdaySelect);birthdays()});
 q('#birthday-list').querySelectorAll('[data-birthday-mark]').forEach(n=>n.onclick=()=>markBirthdays([n.dataset.birthdayMark]));
 q('#birthday-all').onchange=e=>{birthdaySelection=e.target.checked?new Set(available):new Set();birthdays()};
 const n=S.birthdayRows(archive,today()).filter(r=>!StudentBirthdayMail.sent(map,r[0],today())).length;
 banner.hidden=n===0;banner.innerHTML=`<span>Hôm nay còn <b>${n}</b> sinh viên sinh nhật chưa ghi nhận gửi email.</span><button id="birthday-open" class="secondary">Xem danh sách</button>`;
 q('#birthday-open').onclick=()=>{q('#birthday-date').value=today();q('#birthday-filter').value='pending';q('#open-birthdays').click()};
 }
 async function markBirthdays(ids){
 if(birthdayBusy||!window.StudentPermissions?.has('editFollow'))return;
 birthdayBusy=true;const date=q('#birthday-date').value||today(),message=q('#birthday-result');
 try{StudentBirthdayMail.mark(archive,date,ids,S.birthdayRows(archive,date).map(r=>r[0]),RegistryCloud.currentUser.username);save();message.textContent='Đang xác nhận lưu…';birthdays();await RegistryCloud.persist();birthdaySelection.clear();message.textContent='Đã ghi nhận gửi email cho '+ids.length+' sinh viên.';render();}
 catch(e){message.textContent='Chưa xác nhận lưu. Thông báo vẫn được giữ. '+e.message;}
 finally{birthdayBusy=false;birthdays();}
 }
 q('#birthday-bulk').onclick=()=>markBirthdays([...birthdaySelection]);
 q('#birthday-filter').onchange=birthdays;
