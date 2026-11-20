'use strict';
const {isDeepStrictEqual}=require('node:util');
const P=require('./parts.cjs');
const target=r=>String(r.subject||'').trim().toUpperCase()==='AEG116'&&String(r.group||'').trim().toUpperCase()==='GAE2442';
function plan(a){
 const t=a.terms?.['2026-FALL'];if(!t)throw Error('TERM_MISSING');
 if((t.fullTermSubjects||[]).some(s=>String(s).trim().toUpperCase()==='AEG116'))throw Error('FULL_TERM_CONFLICT');
 let records=0,sourceRows=0;const changes=[];
 const assign=(r,location)=>{
  if(!target(r))return r;
  if(r.part===2)return r;
  if(r.part!==1)throw Error('UNEXPECTED_PART_REQUIRES_REVIEW');
  if(location[0]==='records')records++;else sourceRows++;
  changes.push(location);return {...r,part:2};
 };
 const next={...t,records:(t.records||[]).map((r,i)=>assign(r,['records',i]))};
 if(t.importFiles)next.importFiles=t.importFiles.map((f,i)=>({...f,records:(f.records||[]).map((r,j)=>assign(r,['importFiles',i,'records',j]))}));
 P.bindings([...next.records,...(next.importFiles||[]).flatMap(f=>f.records||[])]);
 const archive={...a,terms:{...a.terms,'2026-FALL':next}};
 // Check exact content preservation, allowing only the planned Part edits.
 const restored=structuredClone(archive);
 for(const loc of changes){let row=restored.terms['2026-FALL'];for(const k of loc)row=row[k];row.part=1;}
 if(!isDeepStrictEqual(a,restored))throw Error('PRESERVATION_FAILED');
 return {archive,summary:{term:'2026-FALL',subject:'AEG116',group:'GAE2442',fromPart:1,toPart:2,changedRecords:records,changedSourceRows:sourceRows,changed:changes.length>0,attendanceValuesPreserved:true,notesAndProfilesPreserved:true}};
}
module.exports={plan};
