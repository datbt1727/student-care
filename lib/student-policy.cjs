(function(root){
'use strict';
const graduated=s=>s?.lifecycleStatus? s.lifecycleStatus==='graduated':String(s?.termStatus||s?.academicStatus||s?.status||'').trim().toUpperCase()==='G';
function birthdayStudents(a,date,normalize=v=>String(v||'')){
 const states=new Map();
 for(const [id,t]of Object.entries(a.terms||{})){const name=id+' '+(t.termLabel||''),year=Number(name.match(/20\d{2}/)?.[0]||0),season=/FALL/i.test(name)?2:/SUM/i.test(name)?1:0,rank=year*3+season;for(const s of t.students||[]){const prior=states.get(s.id);if(!prior||rank>prior.rank||rank===prior.rank&&id===a.active)states.set(s.id,{rank,row:s});}}
 return Object.values(a.registry?.students||{}).filter(s=>(normalize(s.birthday)||'').slice(5)===date.slice(5)&&!graduated(states.get(s.id)?.row||s));
}
const api={graduated,birthdayStudents};if(typeof module==='object'&&module.exports)module.exports=api;else root.StudentPolicy=api;
})(typeof window==='object'?window:globalThis);
