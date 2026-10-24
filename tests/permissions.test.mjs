import test from 'node:test';import assert from 'node:assert/strict';
import {normalizePermissions,authorizeArchive,hasPermission} from '../lib/permissions.mjs';
const base={version:2,active:'2026-FALL',terms:{'2026-FALL':{termId:'2026-FALL',termLabel:'FALL 2026',students:[{id:'A',name:'Demo'}],records:[{id:'A',subject:'IT',group:'G',date:'2026-10-24',slots:10,absent:1}],courseCatalog:[{subject:'IT',name:'Information Technology'}],dailyFollow:{},notes:{},followAudit:[],log:[]}},registry:{version:1,students:{A:{id:'A',name:'Demo'}},events:[],seen:{}},studentServices:{certificates:[],insurance:[],audit:[]},importBatches:[]};
const actor=permissions=>({role:'staff',permissions:normalizePermissions(permissions)});
const changed=fn=>{const a=structuredClone(base);fn(a);return a};
const denied=(u,a,p)=>assert.throws(()=>authorizeArchive(u,base,a,p),e=>e.status===403);
test('permission grants are a closed boolean set with explicit import dependency',()=>{
 assert.throws(()=>normalizePermissions({admin:true}));assert.throws(()=>normalizePermissions({editProfiles:'true'}));assert.throws(()=>normalizePermissions({importData:true}));assert(!hasPermission(actor({}),'editFollow'));
 assert(hasPermission(actor({editFollow:true}),'editFollow'));
});
test('Follow writer cannot edit profiles, settings, services or forged top-level data',()=>{
 const u=actor({editFollow:true});authorizeArchive(u,base,changed(a=>{a.terms['2026-FALL'].dailyFollow.a={id:'A',note:'Contacted'};a.terms['2026-FALL'].followAudit.push({id:'A',note:'Contacted'})}));
 denied(u,changed(a=>a.registry.students.A.name='Changed'));denied(u,changed(a=>a.terms['2026-FALL'].students[0].name='Changed'));denied(u,changed(a=>a.terms['2026-FALL'].limit=99));denied(u,changed(a=>a.studentServices.insurance.push({id:'A',recordId:'1'})));denied(u,changed(a=>a.roles={admin:true}));
 const history=structuredClone(base);history.terms['2026-FALL'].followAudit=[{id:'A',note:'Original'}];assert.throws(()=>authorizeArchive(u,history,changed(a=>a.terms['2026-FALL'].dailyFollow.a={id:'A',note:'X'})),e=>e.status===403);
});
test('profile and service writers cannot cross domains; profile removal requires deletion permission',()=>{
 const p=actor({editProfiles:true}),service=actor({manageServices:true});authorizeArchive(p,base,changed(a=>a.registry.students.A.name='Updated'));
 denied(p,changed(a=>a.terms['2026-FALL'].students=[]));denied(p,changed(a=>a.studentServices.insurance.push({id:'A',recordId:'1'})));
 authorizeArchive(service,base,changed(a=>{a.studentServices.insurance.push({id:'A',recordId:'1'});a.studentServices.audit.push({id:'A'})}));denied(service,changed(a=>a.registry.students.A.name='Changed'));
});
test('import cannot bypass deletion by swapping equal-count records or hiding nested records',()=>{
 const u=actor({importData:true,editProfiles:true});authorizeArchive(u,base,changed(a=>a.terms['2026-FALL'].records[0].absent=2));
 denied(u,changed(a=>a.terms['2026-FALL'].records[0].subject='NEW'));denied(u,changed(a=>a.terms['2026-FALL'].courseCatalog=[{subject:'NEW',name:'New'}]));
 const original=structuredClone(base);original.terms['2026-FALL'].importFiles=[{id:'file1',deleted:false,records:structuredClone(original.terms['2026-FALL'].records)}];const next=structuredClone(original);next.terms['2026-FALL'].importFiles[0].records=[];assert.throws(()=>authorizeArchive(u,original,next),e=>e.status===403);
});
test('settings alone cannot inject student data in a new term; restore requires its own explicit confirmation',()=>{
 const settings=actor({manageSettings:true});authorizeArchive(settings,base,changed(a=>a.terms['2027-SPR']={termId:'2027-SPR',termLabel:'SPR 2027',students:[],records:[]}));
 denied(settings,changed(a=>a.terms['2027-SPR']={termId:'2027-SPR',students:[{id:'B',name:'Bypass'}],records:[]}));
 const restore=actor({restoreData:true}),newData=changed(a=>a.registry.students.A.name='Restored');denied(restore,newData);denied(restore,newData,{restore:true});authorizeArchive(restore,base,newData,{restore:true,confirmation:'KHÔI PHỤC DỮ LIỆU'});denied(actor({}),newData,{restore:true,confirmation:'KHÔI PHỤC DỮ LIỆU'});
});
