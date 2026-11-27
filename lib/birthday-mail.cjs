(function(root){
 const key=(id,date)=>JSON.stringify([id,date]);
 function validDate(d){return typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;}
 function validate(map){if(!map||typeof map!=='object'||Array.isArray(map))throw Error('Lịch sử gửi email sinh nhật không hợp lệ.');for(const [k,v]of Object.entries(map)){if(!v||typeof v.id!=='string'||!v.id||v.id.length>60||!validDate(v.date)||key(v.id,v.date)!==k||typeof v.markedAt!=='string'||!Number.isFinite(Date.parse(v.markedAt))||typeof v.actor!=='string'||!v.actor||v.actor.length>100||Object.keys(v).some(x=>!['id','date','markedAt','actor'].includes(x)))throw Error('Bản ghi gửi email sinh nhật không hợp lệ.');}return map;}
 const sent=(map,id,date)=>!!map?.[key(id,date)];
 function mark(a,date,ids,eligible,actor,at=new Date().toISOString()){if(!validDate(date)||!actor||!Array.isArray(ids)||!ids.length)throw Error('Chọn ngày và sinh viên cần ghi nhận.');const allowed=new Set(eligible);if(ids.some(id=>!allowed.has(id)))throw Error('Sinh viên không thuộc danh sách sinh nhật đã chọn.');const map={...(a.studentServices?.birthdayMail||{})};for(const id of new Set(ids))if(!sent(map,id,date))map[key(id,date)]={id,date,markedAt:at,actor};validate(map);a.studentServices=a.studentServices||{};a.studentServices.birthdayMail=map;return map;}
 root.StudentBirthdayMail={key,validDate,validate,sent,mark};if(typeof module!=='undefined')module.exports=root.StudentBirthdayMail;
})(typeof window!=='undefined'?window:globalThis);
