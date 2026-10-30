// Structural/interaction checks in a lightweight DOM fixture, not a real browser rendering test.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const root=__dirname+'/..';
const decode=s=>String(s).replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
class N{constructor(tag='#text',text=''){this.tagName=tag.toUpperCase();this.nodeType=tag==='#text'?3:1;this.data=text;this.childNodes=[];this.attrs={};this.style={};this._value=undefined;this.files=[];this.open=false;this.classList={add:(...x)=>{const s=new Set(this.className.split(/\s+/).filter(Boolean));x.forEach(y=>s.add(y));this.className=[...s].join(' ')},remove:(...x)=>{this.className=this.className.split(/\s+/).filter(y=>!x.includes(y)).join(' ')},contains:x=>this.className.split(/\s+/).includes(x),toggle:(x,on)=>{on=on===undefined?!this.classList.contains(x):on;on?this.classList.add(x):this.classList.remove(x);return on}};this.dataset=new Proxy({},{get:(_,k)=>this.attrs['data-'+String(k).replace(/[A-Z]/g,x=>'-'+x.toLowerCase())],set:(_,k,v)=>(this.attrs['data-'+String(k).replace(/[A-Z]/g,x=>'-'+x.toLowerCase())]=String(v),true)})}get parentNode(){return this.parentElement}get children(){return this.childNodes.filter(n=>n.nodeType===1)}get nextElementSibling(){if(!this.parentElement)return null;const a=this.parentElement.children;return a[a.indexOf(this)+1]||null}get className(){return this.attrs.class||''}set className(v){this.attrs.class=v}get id(){return this.attrs.id||''}set id(v){this.attrs.id=v}get hidden(){return 'hidden' in this.attrs}set hidden(v){v?this.attrs.hidden='':delete this.attrs.hidden}get options(){return this.querySelectorAll('option')}get value(){if(this._value!==undefined)return this._value;if(this.tagName==='SELECT'){const o=this.options.find(o=>'selected'in o.attrs)||this.options[0];return o?o.value:''}return this.attrs.value??this.textContent}set value(v){this._value=String(v)}get textContent(){return this.nodeType===3?this.data:this.childNodes.map(n=>n.textContent).join('')}set textContent(v){if(this.nodeType===3)this.data=String(v);else this.replaceChildren(String(v))}get innerHTML(){return this.childNodes.map(n=>n.nodeType===3?n.data:'<'+n.tagName.toLowerCase()+Object.entries(n.attrs).map(([k,v])=>' '+k+'="'+v+'"').join(' ')+'>'+n.innerHTML+'</'+n.tagName.toLowerCase()+'>').join('')}set innerHTML(v){this.replaceChildren(...parse(v));this._value=undefined}append(...nodes){for(let n of nodes){if(!(n instanceof N))n=new N('#text',String(n));n.remove();n.parentElement=this;this.childNodes.push(n)}}prepend(...nodes){const old=[...this.childNodes];this.replaceChildren(...nodes,...old)}replaceChildren(...nodes){for(const c of this.childNodes)c.parentElement=null;this.childNodes=[];this.append(...nodes)}remove(){if(this.parentElement){const p=this.parentElement;p.childNodes=p.childNodes.filter(n=>n!==this);this.parentElement=null}}after(...nodes){const p=this.parentElement;if(!p)return;const i=p.childNodes.indexOf(this);const tail=p.childNodes.slice(i+1);tail.forEach(n=>n.remove());p.append(...nodes,...tail)}replaceWith(...nodes){const p=this.parentElement;if(!p)return;const i=p.childNodes.indexOf(this);const tail=p.childNodes.slice(i+1);tail.forEach(n=>n.remove());this.remove();p.append(...nodes,...tail)}setAttribute(k,v){this.attrs[k]=String(v)}getAttribute(k){return this.attrs[k]??null}removeAttribute(k){delete this.attrs[k]}querySelectorAll(s){return select(this,s)}querySelector(s){return this.querySelectorAll(s)[0]||null}closest(s){let n=this;while(n){if(match(n,s))return n;n=n.parentElement}return null}addEventListener(){}showModal(){this.open=true}close(){this.open=false}click(){if(this.tagName==='A')downloads.push(this.attrs.download||this.download);return this.onclick?.({target:this,preventDefault(){}})}requestSubmit(){return this.onsubmit?.({preventDefault(){}})}reset(){for(const e of this.querySelectorAll('input,textarea'))e.value=''}}
N.prototype.insertBefore=function(n,b){if(!b){this.append(n);return n}n.remove();const i=this.childNodes.indexOf(b);assert(i>=0);n.parentElement=this;this.childNodes.splice(i,0,n);return n};
function parse(html){const r=new N('fragment'),stack=[r],voids=new Set(['INPUT','IMG','BR','HR','META','LINK','WBR']);for(const t of String(html).match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g)||[]){if(t.startsWith('<!--')||t.startsWith('<!'))continue;if(t.startsWith('</')){if(stack.length>1)stack.pop();continue}if(t.startsWith('<')){const m=t.match(/^<([\w-]+)/);if(!m)continue;const n=new N(m[1]);const attrs=t.slice(m[0].length).replace(/\/?\s*>$/,'');for(const a of attrs.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))n.attrs[a[1]]=decode(a[2]??a[3]??a[4]??'');stack.at(-1).append(n);if(!voids.has(n.tagName)&&!t.endsWith('/>'))stack.push(n)}else stack.at(-1).append(new N('#text',decode(t)))}return [...r.childNodes]}
function match(n,s){if(n.nodeType!==1)return false;const attr=[...s.matchAll(/\[([\w-]+)(\^?=)?["']?([^\]"']*)["']?\]/g)];s=s.replace(/\[[^\]]*\]/g,'');for(const [,k,op,v]of attr){if(!(k in n.attrs))return false;if(op==='='&&n.attrs[k]!==v)return false;if(op==='^='&&!n.attrs[k].startsWith(v))return false}const id=s.match(/#([\w-]+)/);if(id&&n.id!==id[1])return false;for(const [,cl]of s.matchAll(/\.([\w-]+)/g))if(!n.classList.contains(cl))return false;const tag=s.match(/^[\w-]+/);return !tag||n.tagName===tag[0].toUpperCase()}
function select(root,s){if(s.includes(','))return [...new Set(s.split(',').flatMap(x=>select(root,x.trim())))];const parts=s.trim().replace(/\s*>\s*/g,' > ').split(/\s+/),tokens=[];let direct=false;for(const p of parts){if(p==='>'){direct=true;continue}tokens.push({s:p,direct});direct=false}const flat=[];(function walk(n){for(const c of n.children){flat.push(c);walk(c)}})(root);return flat.filter(n=>{let i=tokens.length-1;if(!match(n,tokens[i].s))return false;let p=n.parentElement;while(i>0){const direct=tokens[i].direct;i--;if(direct){if(!p||!match(p,tokens[i].s))return false;p=p.parentElement}else{while(p&&!match(p,tokens[i].s))p=p.parentElement;if(!p)return false;p=p.parentElement}}return true})}

N.prototype.before=function(...nodes){for(const n of nodes)this.parentElement.insertBefore(n,this)};
const html=fs.readFileSync(root+'/web/source.html','utf8'),scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const doc=new N('document');doc.append(...parse(html.replace(/<script>[\s\S]*?<\/script>/g,'').replace(/<style>[\s\S]*?<\/style>/g,'')));doc.documentElement=doc.querySelector('html');doc.body=doc.querySelector('body');doc.createElement=t=>new N(t);doc.getElementById=id=>doc.querySelector('#'+id);
const docEvents={};doc.removeEventListener=(name,fn)=>{docEvents[name]=(docEvents[name]||[]).filter(x=>x!==fn)};doc.addEventListener=(name,fn)=>{(docEvents[name]??=[]).push(fn)};N.prototype.matches=function(s){return s.split(',').some(part=>match(this,part.trim()))};
const downloads=[],storage=new Map(),requests=[];
let saved={version:2,active:'2026-FALL',terms:{'2026-FALL':{termId:'2026-FALL',termLabel:'FALL 2026',asof:'2026-10-23',limit:25,early:20,students:[],records:[],courseCatalog:[],notes:{},dailyFollow:{},log:[],importFiles:[]}},registry:{students:{},events:[],seen:{}},studentServices:{certificates:[],insurance:[],audit:[]}};
const user={username:'admin.test',displayName:'Admin',role:'admin',active:true,mustChange:false};
const health={mirrorStatus:'Neon',backupAt:'2026-10-23',backupError:'',mirrorError:'',info:{spreadsheetUrl:'#',driveUrl:'#'}};
let syncWorkspace=null;
const fetch=async(url,options)=>{const {action,p}=JSON.parse(options.body);requests.push({action,p,headers:options.headers});let data;
switch(action){case 'resume':return {json:async()=>({ok:false,code:'SESSION',error:'Log in'})};case 'challenge':data={salt:'a'.repeat(32)};break;case 'login':data={token:'cookie',csrf:'test-csrf',user,workspace:{archive:structuredClone(saved),revision:1,user,health}};break;case 'load':data={archive:structuredClone(saved),revision:1,user,health};break;case 'users':data=[user];break;case 'logs':data=[];break;case 'save':saved=JSON.parse(p.json);data={revision:p.revision+1,receipt:{committed:true,requestId:p.requestId,requestHash:crypto.createHash('sha256').update(JSON.stringify([p.revision,p.json,p.restore===true,p.confirmation||''])).digest('hex'),revision:p.revision+1},warning:'',info:health};break;case 'sync':data=syncWorkspace?{archive:structuredClone(syncWorkspace),revision:p.revision+1,changed:true,user}:{revision:p.revision,changed:false,user};break;case 'health':data=health;break;case 'artifact':data={id:'processed'};break;default:data={message:'OK'};}
return {json:async()=>({ok:true,data})}};
const observers=[];
const ctx={setImmediate,clearImmediate,MutationObserver:class{constructor(fn){this.fn=fn}observe(target){observers.push(()=>this.fn([{target}]))}},document:doc,console,crypto:crypto.webcrypto,TextEncoder,TextDecoder,Blob,URL,AbortSignal,fetch,structuredClone,btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary'),localStorage:{getItem:k=>null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},setTimeout:(fn,ms)=>{const t=setTimeout(fn,ms);if(ms>500&&ms!==1000&&ms!==3000)t.unref();return t},clearTimeout,setInterval:(fn,ms)=>{const t=setInterval(fn,ms);t.unref();return t},clearInterval,confirm:()=>true,location:{reload(){}},scrollTo(){},addEventListener(){}};
ctx.window=ctx;vm.createContext(ctx);for(const [i,script]of scripts.entries()){try{vm.runInContext(script,ctx)}catch(e){console.error('SCRIPT',i);throw e;}}
const q=s=>doc.querySelector(s);
(async()=>{
await new Promise(r=>setTimeout(r,25));
assert(doc.documentElement.classList.contains('sc-auth-open'));assert(q('.workspace-frame').inert);assert(q('#auth-gate').parentElement===doc.body);q('#auth-gate').hidden=true;observers.forEach(fn=>fn());assert(!doc.documentElement.classList.contains('sc-auth-open'));assert(!q('.workspace-frame').inert);q('#auth-gate').hidden=false;observers.forEach(fn=>fn());assert(q('#auth-message').getAttribute('aria-live')==='polite');assert(q('#auth-totp'));assert(q('#auth-remember'));assert(!q('.demo-entry'));assert(!q('#provision-box'));
q('#auth-username').value='admin.test';q('#auth-password').value='Password#1234';q('#auth-totp').value='123456';q('#auth-remember').checked=true;
await q('#login-form').requestSubmit();
assert(q('#auth-gate').hidden,q('#auth-message').textContent);
const vnToday=ctx.StudentDates.today();
assert.equal(ctx.StudentDates.today(new Date('2026-10-23T16:59:59Z')),'2026-10-23');
assert.equal(ctx.StudentDates.today(new Date('2026-10-23T17:00:00Z')),'2026-10-24');
for(const id of ['asof','import-date','changed-date','birthday-date','registry-effective'])assert.equal(q('#'+id).value,vnToday,id+' defaults to current Vietnam date');
assert.equal(saved.terms['2026-FALL'].asof,'2026-10-23','loading does not automatically save over stored data');
q('#import-date').value='2026-10-20';q('#changed-date').value='2026-10-21';q('#open-student-exports').click();q('#open-student-exports').click();
assert.equal(q('#changed-date').value,'2026-10-21','opening report does not overwrite a manual date');
q('#asof').value='2026-10-22';q('#asof').onchange();vm.runInContext('render()',ctx);
assert.equal(q('#asof').value,'2026-10-22');assert.equal(q('#import-date').value,'2026-10-20');
assert(!ctx.RegistryCloud.hasUnsaved,'changing the view date does not create a save');
console.log('PASS Vietnam midnight defaults and manual dates preserved across renders/tab visits.');
const login=requests.find(r=>r.action==='login');assert.equal(login.p.password,'Password#1234');assert.equal(login.p.remember,true);assert.equal(login.p.totp,'123456');assert(!login.p.verifier);assert.equal(login.p.includeWorkspace,true);assert(!requests.some(r=>r.action==='load'),'inline authenticated workspace avoids the second load request');
// A second account adds a semester; polling updates the picker without reloading or saving it back.
await q('#cloud-sync').click();ctx.Operation.clear();syncWorkspace=structuredClone(saved);syncWorkspace.terms['2027-SPRING']={...structuredClone(saved.terms['2026-FALL']),termId:'2027-SPRING',termLabel:'SPRING 2027'};
const savesBeforeSync=requests.filter(r=>r.action==='save').length;
await ctx.StudentLiveSync.check();
assert(q('#term-switch').innerHTML.includes('SPRING 2027'),'new semester from another account appears');
assert.equal(q('#term-switch').value,'2026-FALL','current semester stays selected');
assert.equal(q('#import-date').value,'2026-10-20','manual import date stays intact');
assert.equal(requests.filter(r=>r.action==='save').length,savesBeforeSync,'remote render never saves over server data');
syncWorkspace.terms['2026-FALL'].rosterSource='Dữ liệu mới nhất để xuất';await ctx.RegistryCloud.prepareReport();assert.equal(vm.runInContext('state.rosterSource',ctx),'Dữ liệu mới nhất để xuất');assert.equal(requests.filter(r=>r.action==='save').length,savesBeforeSync,'report refresh is read-only');
const beforeFileGuard=requests.filter(r=>r.action==='sync').length;q('#attendance-files').files=[{name:'draft.xlsx'}];
await ctx.StudentLiveSync.check();assert.equal(requests.filter(r=>r.action==='sync').length,beforeFileGuard,'selected import file blocks refresh');q('#attendance-files').files=[];const draft=q('#registry-paste');draft.value='Ghi chú đang nhập chưa lưu';for(const fn of docEvents.input||[])fn({target:draft});await ctx.StudentLiveSync.check();assert.equal(draft.value,'Ghi chú đang nhập chưa lưu');assert.equal(requests.filter(r=>r.action==='sync').length,beforeFileGuard,'typed draft blocks refresh');draft.value='';syncWorkspace=null;
console.log('PASS cross-account semester sync preserves selection/manual dates and does not write; import selection blocks refresh.');
q('#registry-paste').value='MSSV\tHọ tên\tEmail\tMentor\nTEST001\tSinh viên thử\ttest@example.test\tCB01';await q('#registry-check').click();assert(q('#import-review').open);await q('#review-confirm').click();
assert(saved.registry.students.TEST001);assert(requests.some(r=>r.action==='save'&&r.headers['X-SC-CSRF']==='test-csrf'));
assert.equal(storage.size,0);assert.equal(q('#auth-password').value,'');

assert.equal(q('.sc-login-credit').textContent,'Powered by DatBT13');assert.equal(q('.sc-global-credit').textContent,'Powered by DatBT13');assert.equal(q('#operation-status').parentElement,doc.body);
const importBar=q('#imports .console-local-tabs');
assert.deepEqual(importBar.children.map(b=>b.textContent),['Hồ sơ tổng','Danh sách học kỳ','Danh mục môn','Điểm danh','Lịch sử nhập']);
assert(q('#import-pane-master #registry-pane-import'));assert(q('#import-pane-history #import-batch-history'));assert(!q('.import-shortcuts'));
importBar.children[3].click();assert(!q('#import-pane-attendance').hidden);assert(q('#import-pane-master').hidden);
importBar.children[0].click();assert(!q('#import-pane-master').hidden);assert(!q('#registry-pane-import').hidden);
let nativeCalls=0,writes=0,closes=0;
ctx.showSaveFilePicker=async options=>{nativeCalls++;assert.equal(options.suggestedName,'test.xlsx');return {createWritable:async()=>({write:async blob=>{assert.equal(await blob.text(),'bytes');writes++},close:async()=>{closes++}})}};
let pending=ctx.StudentFileSave.save('test.xlsx','bytes','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
assert.equal(nativeCalls,0);assert.equal(downloads.length,0);
await q('.sc-save-dialog [data-save="picker"]').click();await pending;
assert.equal(nativeCalls,1);assert.equal(writes,1);assert.equal(closes,1);assert(!q('.sc-save-dialog'));
ctx.showSaveFilePicker=async()=>{const e=Error('cancel');e.name='AbortError';throw e};
pending=ctx.StudentFileSave.save('cancel.xlsx','bytes','application/octet-stream');
await q('.sc-save-dialog [data-save="picker"]').click();assert(q('.sc-save-dialog').open);assert.equal(downloads.length,0);
const rejection=assert.rejects(pending,{name:'AbortError'});q('.sc-save-dialog [data-save="cancel"]').click();await rejection;
ctx.showSaveFilePicker=undefined;ctx.File=class extends Blob{constructor(parts,name,opts){super(parts,opts);this.name=name}};
let shares=0;ctx.navigator={canShare:()=>true,share:async()=>{shares++}};
pending=ctx.StudentFileSave.save('browser.xlsx','bytes','application/octet-stream');
assert(!q('.sc-save-dialog [data-save="share"]'),'share action removed even on browsers that support sharing');assert.equal(shares,0);
await q('.sc-save-dialog [data-save="download"]').click();await pending;assert.equal(shares,0);assert.equal(downloads.length,1);downloads.length=0;
let aborted=false;await assert.rejects(ctx.StudentFileSave.writeHandle({createWritable:async()=>({write:async()=>{throw Error('disk full')},abort:async()=>{aborted=true}})},new Blob(['x'])),/disk full/);assert(aborted);
const palette=vm.runInContext('qaStyleXml()',ctx);assert(palette.includes('FFC4D9EB'));assert(palette.includes('FFECD2DD'));assert(palette.includes('FF34475F'));

vm.runInContext("ConsoleLayout.navigate('imports');Operation.start('Kiểm tra file');Operation.fail('Dòng kiểm thử không hợp lệ.',['#attendance-files']);",ctx);
const importBadge=q('button[data-console-page="imports"] .tab-badge');assert(importBadge&&!importBadge.hidden);assert(!q('#import-error-note'),'no duplicate wide warning or acknowledgement button');
vm.runInContext("Operation.clear();Operation.fail('Sự cố chưa xác định.');",ctx);assert(importBadge.hidden,'generic client errors do not create import notifications');
vm.runInContext('Operation.clear()',ctx);
// Internal footer and dismissal of the account menu are independent of data edits.
assert.equal(q('.sc-global-credit').textContent,'Powered by DatBT13');
assert.equal(q('.sc-global-credit').parentElement,q('.workspace-frame>main'),'credit follows page content inside main');
assert(html.includes('position:static!important;text-align:center!important;background:transparent!important;border:0!important;box-shadow:none!important'));
const accountMenu=q('.account-menu');assert(accountMenu);accountMenu.open=true;
ctx.AccountMenuOutside({target:accountMenu.querySelector('summary')});assert(accountMenu.open);
ctx.AccountMenuOutside({target:doc.body});assert.equal(accountMenu.open,false);
assert(ctx.StudentPermissions.has('manageAccounts'));
ctx.StudentPermissions.setUser({role:'staff',permissions:{editFollow:true}});
assert(ctx.StudentPermissions.has('editFollow'));assert(!ctx.StudentPermissions.has('editProfiles'));assert(!ctx.StudentPermissions.has('manageAccounts'));
ctx.StudentPermissions.setUser({role:'admin'});
assert(q('#new-user-permissions'));
const permissionBox=q('#new-user-permissions'),importRight=permissionBox.querySelector('[data-permission="importData"]'),profileRight=permissionBox.querySelector('[data-permission="editProfiles"]');
importRight.checked=true;importRight.onchange();assert(profileRight.checked);profileRight.checked=false;profileRight.onchange();assert.equal(importRight.checked,false);
ctx.AccountPermissionUI.open({username:'staff.test',displayName:'Staff',role:'staff',active:true,permissions:{editFollow:true}});
assert(q('#sc-edit-account').open);assert.equal(q('#sc-edit-name').value,'Staff');assert(q('#edit-user-permissions [data-permission="editFollow"]').checked);
q('#sc-edit-name').value='Staff Updated';await q('#sc-edit-account-form').requestSubmit();
const updatedAccount=requests.find(r=>r.action==='updateUser');assert(updatedAccount);assert.equal(updatedAccount.p.displayName,'Staff Updated');assert.equal(updatedAccount.p.permissions.editFollow,true);assert.equal(q('#sc-edit-account').open,false);

console.log('PASS inline internal footer, outside account-menu dismissal and staff permission visibility (DOM fixture).');
// A successful HTTP response without the matching committed receipt is never a save confirmation.
await ctx.RegistryCloud.persist();
const normalFetch=ctx.fetch;
vm.runInContext("archive.registry.students.TEST001.name='Tự khôi phục kết nối';save()",ctx);
const retriedBodies=[];ctx.fetch=async(url,options)=>{const body=JSON.parse(options.body);if(body.action==='save'){retriedBodies.push(options.body);const result=await normalFetch(url,options);if(retriedBodies.length===1)throw TypeError('lost response after commit');return result;}return normalFetch(url,options);};
await ctx.RegistryCloud.persist();assert.equal(retriedBodies.length,2);assert.equal(retriedBodies[0],retriedBodies[1]);assert(!ctx.RegistryCloud.hasUnsaved);assert.equal(saved.registry.students.TEST001.name,'Tự khôi phục kết nối');ctx.fetch=normalFetch;
console.log('PASS a lost save response recovers automatically with the identical request and a verified receipt.');
vm.runInContext("archive.registry.students.TEST001.name='Thay đổi A';save()",ctx);
ctx.fetch=async(url,options)=>{const body=JSON.parse(options.body);if(body.action==='save')return {json:async()=>({ok:true,data:{revision:body.p.revision+1}})};return normalFetch(url,options)};
await assert.rejects(()=>ctx.RegistryCloud.persist(),/xác nhận/);assert(ctx.RegistryCloud.hasUnsaved);assert(q('#save-retry-note'));
// Commit may succeed while its response is lost; retry the identical request, then save newer edits.
vm.runInContext("archive.registry.students.TEST001.name='Thay đổi B';save()",ctx);
let lostRequest;
ctx.fetch=async(url,options)=>{const body=JSON.parse(options.body);if(body.action==='save'){lostRequest=body.p;await normalFetch(url,options);throw Error('network response lost')}return normalFetch(url,options)};
await assert.rejects(()=>ctx.RegistryCloud.persist());assert(ctx.RegistryCloud.hasUnsaved);
ctx.fetch=normalFetch;await ctx.RegistryCloud.persist();assert(!ctx.RegistryCloud.hasUnsaved);assert(!q('#save-retry-note'));assert.equal(saved.registry.students.TEST001.name,'Thay đổi B');
assert(requests.filter(r=>r.action==='save'&&r.p.requestId===lostRequest.requestId).length>=2,'lost response retries the same request ID');
// Concurrent save callers share one flight, and edits made in flight are acknowledged separately.
let releaseSave,saveCalls=0;ctx.fetch=async(url,options)=>{const body=JSON.parse(options.body);if(body.action==='save'&&++saveCalls===1)await new Promise(r=>releaseSave=r);return normalFetch(url,options)};
vm.runInContext("archive.registry.students.TEST001.name='Thay đổi C';save()",ctx);
const saveOne=ctx.RegistryCloud.persist(),saveTwo=ctx.RegistryCloud.persist();await new Promise(r=>setTimeout(r,0));assert.equal(saveCalls,1);
vm.runInContext("archive.registry.students.TEST001.name='Thay đổi D';save()",ctx);releaseSave();await Promise.all([saveOne,saveTwo]);assert.equal(saveCalls,2);assert.equal(saved.registry.students.TEST001.name,'Thay đổi D');assert(!ctx.RegistryCloud.hasUnsaved);ctx.fetch=normalFetch;
// Permission denied disables only the unavailable save method, without an automatic download.
ctx.showSaveFilePicker=async()=>{const e=Error('Permission denied');e.name='NotAllowedError';throw e};
pending=ctx.StudentFileSave.save('permission.xlsx','bytes','application/octet-stream');const beforeDownloads=downloads.length;await q('.sc-save-dialog [data-save="picker"]').click();assert(q('.sc-save-dialog [data-save="picker"]').hidden);assert(q('.sc-save-dialog .sc-save-error').textContent.includes('Tải qua trình duyệt'));assert.equal(downloads.length,beforeDownloads);
const deniedCancel=assert.rejects(pending,{name:'AbortError'});q('.sc-save-dialog [data-save="cancel"]').click();await deniedCancel;
console.log('PASS no false save from malformed receipt/lost response/concurrent edits; save-picker denial has explicit fallback.');
// Revised semester import: retired columns are optional/ignored, and preflight never writes.
const termHeads=['ID','Full name','Trạng thái','Level','Lớp','Ngày','Tháng','Năm','Ngày sinh','Email'];
const termRow=['NEW001','Sinh viên mới','HD',1,'IT01',29,2,2004,'29/02/2004','new@example.test'];
const catalog={name:'Môn',rows:[['Mã môn','Tên môn'],['COMP101','Lập trình']]};
const termSheets=row=>[{name:'Sinh viên',rows:[termHeads,row]},catalog];
const parsedTerm=ctx.RosterData.parseTerm(termSheets(termRow));assert.equal(parsedTerm.students[0].birthday,'2004-02-29');
const retired=['Ngày nhập học chính thức','Thời gian đã học','Niên khóa','Thời gian dự kiến TN'];
const oldSheets=[{name:'Sinh viên',rows:[[...termHeads,...retired],[...termRow,'không cần đọc','cũ','cũ','sai ngày cũng bỏ qua']]},catalog];
const parsedOld=ctx.RosterData.parseTerm(oldSheets);
for(const key of ['enrollmentDate','studiedDuration','cohortYear','expectedGraduation'])assert(!(key in parsedOld.students[0]));
const preserved=structuredClone(saved);preserved.terms['2026-FALL'].students.push({...parsedTerm.students[0],enrollmentDate:'2020-01-01',studiedDuration:'2 năm',cohortYear:'2020',expectedGraduation:'2028-01-01'});
ctx.RosterData.applyTerm(preserved,'2026-FALL',parsedTerm,'test.xlsx');
assert.equal(preserved.terms['2026-FALL'].students.find(x=>x.id==='NEW001').studiedDuration,'2 năm');
assert.equal(preserved.terms['2026-FALL'].students.find(x=>x.id==='NEW001').expectedGraduation,'2028-01-01');
for(const [column,value]of [[0,'BAD ID'],[1,''],[2,''],[3,'1.5'],[8,'31/02/2004'],[9,'bad-email']]){const row=[...termRow];row[column]=value;assert.throws(()=>ctx.RosterData.parseTerm(termSheets(row)));}
const badSplit=[...termRow];badSplit[5]=31;badSplit[6]=4;badSplit[8]='';assert.throws(()=>ctx.RosterData.parseTerm(termSheets(badSplit)));
const reviewed=ctx.ImportReview.inspect([{name:'SV',rows:[termHeads,termRow,termRow]},catalog],'term');
assert(reviewed.reports.every(r=>r.errors.length),'duplicate students block confirmation');
assert(ctx.ImportReview.inspect(oldSheets,'term').reports[0].warnings.some(w=>w.includes('4 cột')));
assert(ctx.ImportReview.inspect([termSheets(termRow)[0],{name:'Môn',rows:[['Mã môn','Tên môn'],['COMP101','']]}],'term').courseReports.some(r=>r.errors.length));
const wrongTermHeads=termHeads.map(v=>v==='Trạng thái'?'Trạng thái SPRING 2027':v);assert(ctx.ImportReview.inspect([{name:'SV',rows:[wrongTermHeads,termRow]},catalog],'term','2026-FALL').reports[0].errors.some(x=>x.includes('học kỳ')));
const originalMake=vm.runInContext('makeXlsx',ctx),originalDownload=vm.runInContext('download',ctx);
vm.runInContext('makeXlsx=async sheets=>{window.capturedTermSheets=sheets;return new Uint8Array()};download=async()=>({method:"test"})',ctx);
await q('#registry-term-template').click();
const template=ctx.capturedTermSheets;assert.equal(template.length,2);assert.equal(template[0].rows[2].length,13);assert.equal(template[0].rows[1].length,13);
for(const label of retired)assert(!template[0].rows[2].includes(label));
ctx.makeXlsx=originalMake;ctx.download=originalDownload;
const templateBytes=await originalMake(template),templateZip=await ctx.JSZip.loadAsync(templateBytes);
const templateXML=await templateZip.file('xl/worksheets/sheet1.xml').async('string');
assert(templateXML.includes('Full name'));for(const label of retired)assert(!templateXML.includes(label));
const originalReader=vm.runInContext('readXlsx',ctx);ctx.testTermSheets=termSheets(termRow);vm.runInContext('readXlsx=async()=>window.testTermSheets',ctx);
const uploadFile={name:'term.xlsx',size:100,arrayBuffer:async()=>new ArrayBuffer(0)};q('#registry-term-file').files=[uploadFile];q('#registry-term-import').value='2026-FALL';
const savesBeforeReview=requests.filter(r=>r.action==='save').length;
await q('#registry-term-upload').click();assert(q('#import-review').open);assert(!q('#review-confirm').disabled);
assert.equal(requests.filter(r=>r.action==='save').length,savesBeforeReview);
q('#registry-term-file').files=[{...uploadFile}];await q('#review-confirm').click();
assert(q('#review-guidance').textContent.includes('File đã thay đổi'));
assert.equal(requests.filter(r=>r.action==='save').length,savesBeforeReview,'changed file cannot bypass revalidation');
q('#review-cancel').click();q('#registry-term-file').files=[];ctx.readXlsx=originalReader;ctx.Operation.clear();
console.log('PASS reduced semester template XLSX, retired-field preservation, row validation, preview gate and changed-file guard.');

// Daily changed-absence report uses exact inclusive 10%-25%, never rounded labels.
const rangeRows=vm.runInContext(`(()=>{const values=[9.9,10,12.5,24.4,25,25.01,60],students=values.map((v,i)=>({id:'R'+i,name:'Range '+v})),records=values.flatMap((v,i)=>[{id:'R'+i,subject:'M',group:'G',date:'2026-10-26',absent:0,slots:10000},{id:'R'+i,subject:'M',group:'G',date:'2026-10-27',absent:Math.round(v*100),slots:10000}]);return StudentServices.changed({terms:{T:{students,records}}},'T','2026-10-27').rows;})()`,ctx);
assert.deepEqual(Array.from(rangeRows,r=>r[4].value),[10,12.5,24.4,25]);
console.log('PASS daily changed-absence report includes exact 10% and 25%, excludes below/above before rounding.');
// Verify real QA/term-summary XLSX bytes, including shifted course/date columns.
const qaArchiveSnapshot=vm.runInContext('JSON.stringify(archive)',ctx);
const qaStateSnapshot=vm.runInContext('JSON.stringify(state)',ctx);
vm.runInContext(`state.students=[{id:'EXPORT01',name:'Export Student',cohort:'CLASS-A',email:'export@example.test',birthday:'2004-02-03',gender:'Nam',ethnicity:'Kinh',enrollmentDate:'RETIRED_ENROLL',studiedDuration:'RETIRED_DURATION',cohortYear:'RETIRED_COHORT',expectedGraduation:'RETIRED_GRAD'}];state.courseCatalog=[{subject:'TEST101',name:'Test Course'}];state.records=[{id:'EXPORT01',subject:'TEST101',group:'G',date:'2026-10-25',absent:2,slots:10},{id:'EXPORT01',subject:'TEST101',group:'G',date:'2026-10-26',absent:244,slots:1000}];state.asof='2026-10-26';state.dailyFollow={};`,ctx);
const qaSheets=vm.runInContext('qaFollowTable()',ctx);
assert.equal(qaSheets[0].profileColumns,14);assert.equal(qaSheets[0].courseColumns[0],14);
assert.equal(qaSheets[0].rows[3][5],'CLASS-A');assert.equal(qaSheets[0].rows[3][12],'export@example.test');
assert.equal(qaSheets[0].rows[3][15].value,20);assert.equal(qaSheets[0].rows[3][17].value,24.4);
const qaBytes=await originalMake(qaSheets),qaZip=await ctx.JSZip.loadAsync(qaBytes);
const qaXML=await qaZip.file('xl/worksheets/sheet1.xml').async('string');
for(const label of [...retired,'RETIRED_ENROLL','RETIRED_DURATION','RETIRED_COHORT','RETIRED_GRAD'])assert(!qaXML.includes(label));
assert(qaXML.includes('O1:S1'));assert(qaXML.includes('xSplit="3"'));assert(!qaXML.includes('undefined'));
const legacyBytes=await originalMake([{name:'Legacy',rows:[['MSSV',...retired,'Email'],['EXPORT01','a','b','c','d','export@example.test']],headerRow:1}]);
const legacyZip=await ctx.JSZip.loadAsync(legacyBytes),legacyXML=await legacyZip.file('xl/worksheets/sheet1.xml').async('string');
for(const label of retired)assert(!legacyXML.includes(label));assert(legacyXML.includes('export@example.test'));assert(/r="B2"[^>]*t="inlineStr"/.test(legacyXML));assert(!legacyXML.includes('r="F2"'));
// General notes appear as plain content in Follow, including a student with no course data.
vm.runInContext(`state.students.push({id:'NOCOURSE',name:'No course',categories:[]});state.notes={EXPORT01:[{date:'2026-10-25',time:'PRIVATE_TIME',text:'General note content'},{date:'2026-10-27',text:'Future note hidden'}],NOCOURSE:[{date:'2026-10-26',time:'PRIVATE_TIME',text:'Missing attendance note'},{text:'Legacy general note'}]};`,ctx);
const generalSheet=vm.runInContext('qaFollowTable()',ctx)[0],generalIndex=generalSheet.rows[0].indexOf('Follow (ghi chú chung)');
assert(generalIndex>=14);assert.equal(generalSheet.rows[3][generalIndex],'General note content');
assert.equal(generalSheet.rows[4][generalIndex],'Missing attendance note\nLegacy general note');
const generalZip=await ctx.JSZip.loadAsync(await originalMake([generalSheet])),generalXML=await generalZip.file('xl/worksheets/sheet1.xml').async('string');
assert(generalXML.includes('General note content'));assert(generalXML.includes('Missing attendance note'));assert(!generalXML.includes('PRIVATE_TIME'));assert(!generalXML.includes('Future note hidden'));
vm.runInContext("state.students.pop();state.notes={}",ctx);
console.log('PASS general notes export into Follow as content only, including students without attendance, while future dated notes remain excluded.');
// Regression: a student can attend distinct groups of one subject on the same date.
vm.runInContext(`state.records.push({id:'EXPORT01',subject:'TEST101',group:'H',date:'2026-10-26',absent:5,slots:10});state.dailyFollow={g:{id:'EXPORT01',subject:'TEST101',group:'G',date:'2026-10-26',note:'Note group G'},h:{id:'EXPORT01',subject:'TEST101',group:'H',date:'2026-10-26',note:'Note group H'}};`,ctx);
const grouped=vm.runInContext('qaFollowTable()',ctx)[0];
assert.deepEqual(Array.from(grouped.courseColumns),[14,19]);assert.equal(grouped.rows[0][14],'TEST101 · G');assert.equal(grouped.rows[0][19],'TEST101 · H');
assert.equal(grouped.rows[3][17].value,24.4);assert.equal(grouped.rows[3][18],'Note group G');assert.equal(grouped.rows[3][20].value,50);assert.equal(grouped.rows[3][21],'Note group H');
vm.runInContext("state.students.forEach(s=>s.categories??=[]);state.records.forEach(r=>{r.term=state.termLabel;r.start='2020-01-01'})",ctx);
const exportPrepare=ctx.RegistryCloud.prepareReport;let releaseExport,exported=[],prepareCount=0;
ctx.RegistryCloud.prepareReport=async()=>{prepareCount++;await new Promise(r=>releaseExport=r)};
ctx.download=async(name,bytes)=>{exported.push({name,bytes});return {method:'test'}};
const firstQA=q('#export').onclick();assert(q('#export').disabled);assert(q('#export-feedback').textContent.includes('Đang kiểm tra'));
await q('#export').onclick();assert.equal(prepareCount,1);releaseExport();await firstQA;
assert.equal(exported.length,1);assert(!q('#export').disabled);
const groupedZip=await ctx.JSZip.loadAsync(exported[0].bytes),groupedXML=await groupedZip.file('xl/worksheets/sheet1.xml').async('string');
assert(groupedXML.includes('TEST101 · G'));assert(groupedXML.includes('TEST101 · H'));assert(groupedXML.includes('Note group G'));assert(groupedXML.includes('Note group H'));
ctx.RegistryCloud.prepareReport=async()=>{};await q('#term-full-export').onclick();assert.equal(exported.length,2);
// Failures are visible beside the clicked button; no file is produced.
ctx.RegistryCloud.prepareReport=async()=>{throw Error('Test server unavailable')};await q('#export').onclick();
assert(q('#export-feedback').textContent.includes('Test server unavailable'));assert.equal(q('#export-feedback').getAttribute('role'),'alert');assert.equal(exported.length,2);assert(!q('#export').disabled);
ctx.RegistryCloud.prepareReport=async()=>{};
vm.runInContext('state.records.push({...state.records[0]})',ctx);await q('#export').onclick();
assert(q('#export-feedback').textContent.includes('trùng bản ghi'));assert.equal(exported.length,2);
vm.runInContext('state.records.pop()',ctx);
ctx.download=async()=>{const e=Error('cancel');e.name='AbortError';throw e};await q('#export').onclick();
assert(q('#export-feedback').textContent.includes('Đã hủy'));assert(!q('#export').disabled);
ctx.RegistryCloud.prepareReport=exportPrepare;ctx.download=originalDownload;ctx.Operation.clear();
ctx.RegistryCloud.prepareReport=async()=>{};
const beforePreviewExports=exported.length;
for(const previewId of ['export-preview','term-full-export-preview']){
 await q('#'+previewId).onclick();
 const dialog=q('.sc-report-preview');assert(dialog);assert(dialog.querySelector('table'));
 assert(dialog.querySelector('select').children.length>0);
 dialog.querySelector('button').onclick();assert(!q('.sc-report-preview'));
}
assert.equal(exported.length,beforePreviewExports);ctx.RegistryCloud.prepareReport=exportPrepare;
console.log('PASS QA and semester preview open real report sheets without downloading and close cleanly.');
console.log('PASS real QA/term export click: multi-group data and notes stay separate; progress, double-click lock, inline errors and cancellation work.');
ctx.restoreQAState=JSON.parse(qaStateSnapshot);ctx.restoreQAArchive=qaArchiveSnapshot;vm.runInContext('archive=JSON.parse(window.restoreQAArchive);state=archive.terms[archive.active];Object.assign(state,window.restoreQAState)',ctx);
assert.equal(vm.runInContext('JSON.stringify(archive)',ctx),qaArchiveSnapshot);
console.log('PASS real QA/summary XLSX has 14 profile columns, aligned course percentages, and no retired fields; legacy export guard preserves stored archive.');
// Retired training fields must disappear from every profile view without deleting stored values.
const profileArchiveBefore=vm.runInContext('JSON.stringify(archive)',ctx);
vm.runInContext(`Object.assign(archive.registry.students.TEST001,{enrollmentDate:'2020-01-01',studiedDuration:'2 năm',cohortYear:'2020',expectedGraduation:'2028-01-01',extra:{'Niên khóa':'2020','Ngày nhập học chính thức':'2020-01-01','Thời gian đã học':'2 năm','Thời gian dự kiến TN':'2028-01-01','Ghi chú khác':'Giữ thông tin này'}});
if(!state.students.some(s=>s.id==='TEST001'))state.students.push({...archive.registry.students.TEST001,level:1});
state.trainingAudit=[{id:'TEST001',at:'2026-10-26',source:'test.xlsx',changes:{studiedDuration:{before:'1 năm',after:'2 năm'},level:{before:0,after:1}}}];
archive.registry.events.push({id:'TEST001',type:'profile_update',before:{cohortYear:'2019'},after:{cohortYear:'2020',name:'Sinh viên thử'},recordedAt:'2026-10-26'});
`,ctx);
vm.runInContext('StudentRegistry.ensure(archive);StudentServices.hydrate(archive)',ctx);const archiveWithRetired=vm.runInContext('JSON.stringify(archive)',ctx);ctx.showStudentHistory('TEST001');
const profileText=['history-pane-profile','history-pane-events','history-pane-terms','history-pane-term-data'].map(id=>q('#'+id)?.textContent||'').join(' ');
for(const label of ['Niên khóa','Ngày nhập học chính thức','Thời gian đã học','Dự kiến tốt nghiệp','Ngày dự kiến tốt nghiệp','Thời gian dự kiến TN','cohortYear','studiedDuration','expectedGraduation','enrollmentDate'])assert(!profileText.includes(label),label+' hidden in profile/history');
assert(profileText.includes('Ghi chú khác'));assert(profileText.includes('Level'));
for(const field of ['enrollmentDate','studiedDuration','cohortYear','expectedGraduation'])assert(!q('#profile-'+field),'removed editor field '+field);
assert.equal(vm.runInContext('JSON.stringify(archive)',ctx),archiveWithRetired,'opening profile does not delete stored historical fields');
q('#registry-history').close();ctx.profileArchiveBefore=profileArchiveBefore;vm.runInContext('archive=JSON.parse(window.profileArchiveBefore);state=archive.terms[archive.active];render()',ctx);
console.log('PASS retired fields absent from profile/editor/extra/term-history while stored legacy data remains intact.');
// Simulate another authenticated tab saving between the local load and save.
q('#profile-editor').open=false;const concurrentFetch=ctx.fetch;
async function conflictServer(remoteChange,localChange){const remote=vm.runInContext('JSON.parse(JSON.stringify(archive))',ctx);remoteChange(remote);vm.runInContext(localChange,ctx);let staleRevision=null;ctx.fetch=async(url,options)=>{const body=JSON.parse(options.body);if(body.action==='save'){staleRevision??=body.p.revision;if(body.p.revision===staleRevision)return {json:async()=>({ok:false,code:'409',error:'Dữ liệu đã được người khác thay đổi.'})};}if(body.action==='sync')return {json:async()=>({ok:true,data:{changed:true,revision:staleRevision+1,archive:structuredClone(remote),user}})};return concurrentFetch(url,options);};}
await conflictServer(a=>a.registry.students.TEST001.email='peer@example.test',"archive.registry.students.TEST001.name='Sửa độc lập';save()");
q('#profile-editor').open=true;await assert.rejects(()=>ctx.RegistryCloud.persist(),/Đang mở/);assert(ctx.RegistryCloud.hasUnsaved);q('#profile-editor').open=false;await ctx.RegistryCloud.persist();assert(!ctx.RegistryCloud.hasUnsaved);assert.equal(saved.registry.students.TEST001.name,'Sửa độc lập');assert.equal(saved.registry.students.TEST001.email,'peer@example.test');assert(!q('.sc-merge-dialog'));
ctx.fetch=concurrentFetch;
await conflictServer(a=>{a.registry.students.TEST001.name='Tên trên máy chủ';a.registry.students.TEST001.email='peer2@example.test'},"archive.registry.students.TEST001.name='Tên tôi chọn';save()");
const manualMerge=ctx.RegistryCloud.persist();await new Promise(r=>setTimeout(r,0));assert(q('.sc-merge-dialog').open);assert(ctx.RegistryCloud.hasUnsaved);assert(q('[data-merge="apply"]').disabled);
for(const select of q('.sc-merge-dialog').querySelectorAll('select')){select.value='local';select.onchange();}
await q('[data-merge="apply"]').click();await manualMerge;assert.equal(saved.registry.students.TEST001.name,'Tên tôi chọn');assert.equal(saved.registry.students.TEST001.email,'peer2@example.test');assert(q('#cloud-error').hidden,'old conflict warning clears only after a confirmed save');ctx.fetch=concurrentFetch;
await conflictServer(a=>a.registry.students.TEST001.name='Tên khác',"archive.registry.students.TEST001.name='Giữ bản nhập';save()");
const cancelledMerge=ctx.RegistryCloud.persist();await new Promise(r=>setTimeout(r,0));const cancelExpected=assert.rejects(cancelledMerge,/giữ nguyên|giữ/);q('[data-merge="cancel"]').click();await cancelExpected;assert(ctx.RegistryCloud.hasUnsaved);assert.equal(vm.runInContext('archive.registry.students.TEST001.name',ctx),'Giữ bản nhập');
// Retry presents the conflict again rather than overwriting the server.
const resolvedMerge=ctx.RegistryCloud.persist();await new Promise(r=>setTimeout(r,0));for(const select of q('.sc-merge-dialog').querySelectorAll('select')){select.value='remote';select.onchange();}q('[data-merge="apply"]').click();await resolvedMerge;assert.equal(saved.registry.students.TEST001.name,'Tên khác');ctx.fetch=concurrentFetch;
const writesBeforeView=requests.filter(r=>r.action==='save').length;q('#term-switch').value='2027-SPRING';q('#term-switch').onchange();assert(!ctx.RegistryCloud.hasUnsaved);assert.equal(requests.filter(r=>r.action==='save').length,writesBeforeView);q('#term-switch').value='2026-FALL';q('#term-switch').onchange();
// A new semester remains a real write.
q('#new-year').value='2028';q('#new-term').value='SPR';q('#create-term').click();assert(ctx.RegistryCloud.hasUnsaved);await ctx.RegistryCloud.persist();assert(saved.terms['2028-SPR']);q('#term-switch').value='2026-FALL';q('#term-switch').onchange();
// Refresh for export must not overwrite edits made while the read is in flight.
let releaseReport;ctx.fetch=async(url,options)=>{const body=JSON.parse(options.body);if(body.action==='sync'){await new Promise(r=>releaseReport=r);return {json:async()=>({ok:true,data:{changed:false,revision:body.p.revision,user}})};}return concurrentFetch(url,options);};
const reportRead=ctx.RegistryCloud.prepareReport();await new Promise(r=>setTimeout(r,0));vm.runInContext("archive.registry.students.TEST001.name='Đang gõ khi xuất';save()",ctx);releaseReport();await assert.rejects(reportRead,/vừa được chỉnh sửa/);assert.equal(vm.runInContext('archive.registry.students.TEST001.name',ctx),'Đang gõ khi xuất');ctx.fetch=concurrentFetch;await ctx.RegistryCloud.persist();ctx.Operation.clear();
console.log('PASS independent concurrent edits merge; same-field conflicts require choice; cancel preserves drafts; view-only navigation never saves; report race preserves edits.');
// Queue filtering is a local view and never changes data or notification totals.
const queueArchiveBefore=vm.runInContext('JSON.stringify(archive)',ctx);
vm.runInContext(`state.students=[{id:'QOVER',name:'Vượt',categories:[]},{id:'QNEAR',name:'Gần',categories:[]},{id:'QMISSING',name:'Thiếu',categories:[]}];state.records=[{id:'QOVER',name:'Vượt',term:state.termLabel,group:'G',subject:'M1',date:state.asof,start:'2020-01-01',absent:6,slots:10},{id:'QNEAR',name:'Gần',term:state.termLabel,group:'G',subject:'M2',date:state.asof,start:'2020-01-01',absent:2,slots:10}];state.limit=25;state.early=20;state.dailyFollow={};render()`,ctx);
const queueTotal=q('#queue-count').textContent,queueWrites=requests.filter(r=>r.action==='save').length;
for(const [value,included,excluded]of [['over','QOVER','QNEAR'],['near','QNEAR','QOVER'],['missing','QMISSING','QOVER']]){q('#queue-severity').value=value;q('#queue-severity').onchange();assert(q('#queue-items').textContent.includes(included));assert(!q('#queue-items').textContent.includes(excluded));assert(q('#queue-count').textContent.includes('Hiển thị 1/3'));vm.runInContext('render()',ctx);assert.equal(q('#queue-severity').value,value);}
assert(q('#queue-items .queue-only-missing'),'missing-only view gets compact columns without removing source cells');
const missingEditor=q('#queue-items [data-queue-note]'),missingRow=missingEditor.closest('tr'),missingSave=q('#queue-items [data-queue-save]');
assert.equal(missingSave.closest('td'),missingRow.children[5]);assert(missingSave.closest('.queue-row-actions'));assert(!missingEditor.parentElement.querySelector('[data-queue-save]'));
assert.equal(q('#queue-items [data-queue-select]').getAttribute('aria-label'),'Chọn QMISSING');
q('#queue-severity').value='all';q('#queue-severity').onchange();assert.equal(q('#queue-count').textContent,queueTotal);assert(!q('#queue-items .queue-only-missing'));assert.equal(requests.filter(r=>r.action==='save').length,queueWrites);assert(!ctx.RegistryCloud.hasUnsaved);
// Course/severity filters combine, while unsaved inline notes survive redraws.
const quickInput=(id,subject)=>[...q('#queue-items').querySelectorAll('[data-queue-note]')].find(n=>{const parts=JSON.parse(n.dataset.queueNote);return parts[1]===id&&parts[2]===subject;});
const quickSave=input=>[...q('#queue-items').querySelectorAll('[data-queue-save]')].find(n=>n.dataset.queueSave===input.dataset.queueNote);
vm.runInContext(`const row=state.records[0];state.dailyFollow[followKey(row,state.asof)]={id:row.id,term:row.term,subject:row.subject,group:row.group,date:state.asof,status:'contacted',note:'Ghi chú cũ',publicNote:'Nội dung công khai',updated:'trước'};render()`,ctx);
q('#queue-course').value='M1';q('#queue-course').onchange();assert(q('#queue-items').textContent.includes('QOVER'));assert(!q('#queue-items').textContent.includes('QNEAR'));assert(!q('#queue-items').textContent.includes('QMISSING'));
const privateNote='NỘI BỘ RIÊNG <b>không gửi sinh viên</b>';
let quick=quickInput('QOVER','M1');quick.value=privateNote;quick.oninput();const quickWrites=requests.filter(r=>r.action==='save').length;
q('#queue-course').value='M2';q('#queue-course').onchange();assert(!q('#queue-drafts').hidden);assert.equal(q('#queue-drafts textarea').value,privateNote);q('#queue-course').value='M1';q('#queue-course').onchange();quick=quickInput('QOVER','M1');assert.equal(quick.value,privateNote);assert.equal(requests.filter(r=>r.action==='save').length,quickWrites);
await quickSave(quick).click();
let internal=vm.runInContext("Object.values(state.dailyFollow).find(f=>f.id==='QOVER'&&f.subject==='M1')",ctx);assert.equal(internal.note,privateNote);assert.equal(internal.status,'contacted');assert.equal(internal.publicNote,'Nội dung công khai');assert(!ctx.RegistryCloud.hasUnsaved);
const studentReport=vm.runInContext("JSON.stringify(excelTables('QOVER'))",ctx);assert(!studentReport.includes(privateNote));assert(studentReport.includes('Nội dung công khai'));
// Failure retains the draft; retry does not append another audit event.
quick=quickInput('QOVER','M1');quick.value='Nội bộ chờ xác nhận';quick.oninput();const quickFetch=ctx.fetch;
ctx.fetch=async(url,options)=>{const body=JSON.parse(options.body);if(body.action==='save')return {json:async()=>({ok:true,data:{revision:body.p.revision+1}})};return quickFetch(url,options);};
await quickSave(quick).click();assert(ctx.RegistryCloud.hasUnsaved);assert.equal(quickInput('QOVER','M1').value,'Nội bộ chờ xác nhận');assert(q('#queue-items').textContent.includes('Chưa xác nhận lưu'));
const quickAudit=vm.runInContext('state.followAudit.length',ctx);ctx.fetch=quickFetch;await quickSave(quickInput('QOVER','M1')).click();assert(!ctx.RegistryCloud.hasUnsaved);assert.equal(vm.runInContext('state.followAudit.length',ctx),quickAudit);
// Editing a failed draft does not mistake the user's own pending write for another writer.
quick=quickInput('QOVER','M1');quick.value='Bản lỗi trước';quick.oninput();ctx.fetch=async(url,options)=>{const body=JSON.parse(options.body);if(body.action==='save')return {json:async()=>({ok:true,data:{revision:body.p.revision+1}})};return quickFetch(url,options);};await quickSave(quick).click();quick=quickInput('QOVER','M1');quick.value='Bản sửa sau lỗi';quick.oninput();ctx.fetch=quickFetch;await quickSave(quick).click();assert.equal(vm.runInContext("Object.values(state.dailyFollow).find(f=>f.id==='QOVER').note",ctx),'Bản sửa sau lỗi');assert(!ctx.RegistryCloud.hasUnsaved);
// New typing while a request is in flight remains a separate unsaved draft.
let releaseQuick;ctx.fetch=async(url,options)=>{const body=JSON.parse(options.body);if(body.action==='save')await new Promise(r=>releaseQuick=r);return quickFetch(url,options);};
quick=quickInput('QOVER','M1');quick.value='Bản gửi trước';quick.oninput();const quickFlight=quickSave(quick).click();await new Promise(r=>setTimeout(r,0));quick=quickInput('QOVER','M1');quick.value='Bản nhập tiếp';quick.oninput();releaseQuick();await quickFlight;assert.equal(quickInput('QOVER','M1').value,'Bản nhập tiếp');ctx.fetch=quickFetch;await quickSave(quickInput('QOVER','M1')).click();assert.equal(vm.runInContext("Object.values(state.dailyFollow).find(f=>f.id==='QOVER').note",ctx),'Bản nhập tiếp');
// No course data: store an internal general note on the correct student.
q('#queue-course').value='';q('#queue-course').onchange();q('#queue-severity').value='missing';q('#queue-severity').onchange();quick=quickInput('QMISSING','');quick.value='Ghi chú chung nội bộ';quick.oninput();await quickSave(quick).click();assert.equal(vm.runInContext("state.notes.QMISSING.at(-1).text",ctx),'Ghi chú chung nội bộ');
// Batch save includes hidden drafts in exactly one confirmed workspace request.
q('#queue-severity').value='all';q('#queue-severity').onchange();
for(const [id,subject,text]of [['QOVER','M1','Batch A'],['QNEAR','M2','Batch B']]){const input=quickInput(id,subject);input.value=text;input.oninput();}
assert(q('#queue-save-all').textContent.includes('(2)'));
q('#queue-course').value='M1';q('#queue-course').onchange();
const beforeBatch=requests.filter(r=>r.action==='save').length;
await q('#queue-save-all').click();
assert.equal(requests.filter(r=>r.action==='save').length,beforeBatch+1);
for(const [id,text]of [['QOVER','Batch A'],['QNEAR','Batch B']])assert.equal(vm.runInContext('Object.values(state.dailyFollow).find(f=>f.id==='+JSON.stringify(id)+').note',ctx),text);
assert(q('#queue-batch-status').textContent.includes('2/2'));assert(q('#queue-save-all').disabled);
// Malformed receipt retains all drafts, and retry does not duplicate audit entries.
for(const [id,subject,text]of [['QOVER','M1','Retry batch A'],['QNEAR','M2','Retry batch B']]){q('#queue-course').value=subject;q('#queue-course').onchange();const input=quickInput(id,subject);input.value=text;input.oninput();}
ctx.fetch=async(url,options)=>{const body=JSON.parse(options.body);if(body.action==='save')return {json:async()=>({ok:true,data:{revision:body.p.revision+1}})};return quickFetch(url,options);};
await q('#queue-save-all').click();assert(ctx.RegistryCloud.hasUnsaved);assert(q('#queue-save-all').textContent.includes('(2)'));
const batchAudit=vm.runInContext('state.followAudit.length',ctx);ctx.fetch=quickFetch;await q('#queue-save-all').click();
assert.equal(vm.runInContext('state.followAudit.length',ctx),batchAudit);assert(!ctx.RegistryCloud.hasUnsaved);
assert(q('#queue-batch-status').textContent.includes('2/2'));
q('#queue-course').value='';q('#queue-course').onchange();
console.log('PASS batch notes save hidden drafts in one request; malformed receipts retain all drafts and retry never duplicates audit.');
// Read-only staff cannot invoke a save even by directly calling the handler.
q('#queue-severity').value='all';q('#queue-severity').onchange();ctx.StudentPermissions.setUser({role:'staff',permissions:{}});ctx.ConsoleLayout.notifications();quick=quickInput('QOVER','M1');assert(quickSave(quick).disabled);assert(q('#queue-save-all').disabled);await q('#queue-save-all').onclick();const readOnlyWrites=requests.filter(r=>r.action==='save').length;await quickSave(quick).onclick();assert.equal(requests.filter(r=>r.action==='save').length,readOnlyWrites);ctx.StudentPermissions.setUser(user);ctx.ConsoleLayout.notifications();
console.log('PASS course+severity filtering, inline private/general notes, retry deduplication, in-flight edits and read-only guards.');
// Compact tools start folded, remain in the heading/selection bar, and retain common input.
assert(q('#queue-compose-panel').hidden);
assert(q('#queue-view-current').closest('.panel-heading'));
assert(q('#queue-resolve-selected').closest('.queue-selection-bar'));
q('#queue-toggle-compose').click();assert(!q('#queue-compose-panel').hidden);assert.equal(q('#queue-toggle-compose').getAttribute('aria-expanded'),'true');
q('#queue-common-note').value='Common draft retained on fold';q('#queue-toggle-compose').click();assert(q('#queue-compose-panel').hidden);
vm.runInContext('render()',ctx);q('#queue-toggle-compose').click();assert.equal(q('#queue-common-note').value,'Common draft retained on fold');q('#queue-toggle-compose').click();
console.log('PASS compact two-tab layout folds common input without deleting it or moving bulk save/completion away from selection.');
// Queue percentage filter and selected-row bulk actions.
const percentChoices=()=>[...q('#queue-percent').querySelectorAll('option')].map(n=>n.value);
q('#queue-course').value='M1';q('#queue-course').onchange();assert(percentChoices().includes('60'));assert(!percentChoices().includes('20'));
q('#queue-percent').value='60';q('#queue-percent').onchange();
q('#queue-course').value='M2';q('#queue-course').onchange();assert.equal(q('#queue-percent').value,'');assert(percentChoices().includes('20'));assert(!percentChoices().includes('60'));
q('#queue-severity').value='over';q('#queue-severity').onchange();assert.equal(q('#queue-course').value,'');assert(![...q('#queue-course').querySelectorAll('option')].some(n=>n.value==='M2'));assert(percentChoices().includes('60'));assert(!percentChoices().includes('20'));
q('#queue-course').value='';q('#queue-course').onchange();assert(percentChoices().includes('60'));assert(!percentChoices().includes('20'));
q('#queue-severity').value='all';q('#queue-severity').onchange();
assert(q('#queue-save-all').closest('.queue-selection-bar'));assert(!q('#queue-save-all').closest('.queue-filters'));
assert(q('#queue-apply-note').closest('.queue-compose'));
assert(q('#queue-items [data-queue-select]').closest('td'));assert(!q('#queue-items [data-queue-select]').closest('.queue-note-editor'));
assert(q('#queue-items [data-queue-save]').closest('.queue-note-actions'));
vm.runInContext('render()',ctx);
const selectionCheck=q('#queue-items [data-queue-select]'),selectionCell=selectionCheck.closest('td'),selectionLabel=selectionCheck.closest('label');let selectionOpened=false;
for(const target of [selectionCheck,selectionLabel]){selectionCell.onclick({target,preventDefault(){selectionOpened=true},stopPropagation(){selectionOpened=true}});selectionCell.onkeydown({target,key:'Enter',preventDefault(){selectionOpened=true},stopPropagation(){selectionOpened=true}});}
assert(!selectionOpened,'checkbox and its label never open profile or cancel the default checkbox action');
selectionCheck.checked=true;selectionCheck.onchange();assert(q('#queue-selected-count').textContent.includes('1'));
selectionCheck.checked=false;selectionCheck.onchange();

console.log('PASS dependent percentage options follow severity/course and clear stale selections; compact grouped controls preserve row selection.');

q('#queue-percent').value='60';q('#queue-percent').onchange();assert(q('#queue-items').textContent.includes('QOVER'));assert(!q('#queue-items').textContent.includes('QNEAR'));
q('#queue-percent').value='';q('#queue-percent').onchange();assert([...q('#queue-items').querySelectorAll('[data-queue-student]')].every(b=>b.textContent==='Xem hồ sơ'));
function selectQueue(id,subject){const n=[...q('#queue-items').querySelectorAll('[data-queue-select]')].find(n=>{const a=JSON.parse(n.dataset.queueSelect);return a[1]===id&&a[2]===subject});assert(n);n.checked=true;n.onchange();}
selectQueue('QOVER','M1');selectQueue('QNEAR','M2');
const bulkStart=requests.filter(r=>r.action==='save').length;
q('#queue-common-note').value='Cùng nội dung liên hệ';q('#queue-apply-note').click();
assert.equal(quickInput('QOVER','M1').value,'Cùng nội dung liên hệ');assert.equal(quickInput('QNEAR','M2').value,'Cùng nội dung liên hệ');
assert.equal(requests.filter(r=>r.action==='save').length,bulkStart,'fill common note never saves automatically');
await q('#queue-save-all').click();assert.equal(requests.filter(r=>r.action==='save').length,bulkStart+1);
// Failed resolution stays visible and retry reuses audit; success removes both course rows.
selectQueue('QOVER','M1');selectQueue('QNEAR','M2');
ctx.fetch=async(url,opt)=>{const b=JSON.parse(opt.body);if(b.action==='save')return {json:async()=>({ok:true,data:{revision:b.p.revision+1}})};return quickFetch(url,opt);};
await q('#queue-resolve-selected').click();assert(ctx.RegistryCloud.hasUnsaved);assert(quickInput('QOVER','M1'));assert(quickInput('QNEAR','M2'));
const resolveAudit=vm.runInContext('state.followAudit.length',ctx);
ctx.fetch=quickFetch;await q('#queue-save-all').click();assert(!ctx.RegistryCloud.hasUnsaved);
assert.equal(vm.runInContext('state.followAudit.length',ctx),resolveAudit);
assert(!q('#queue-items').textContent.includes('QOVER'));assert(!q('#queue-items').textContent.includes('QNEAR'));assert(q('#queue-items').textContent.includes('QMISSING'));
assert.equal(vm.runInContext("Object.values(state.dailyFollow).find(f=>f.id==='QOVER').status",ctx),'resolved');
// Read-only cannot apply bulk text or completion even via direct handler.
ctx.StudentPermissions.setUser({role:'staff',permissions:{}});ctx.ConsoleLayout.notifications();
const noBulkWrites=requests.filter(r=>r.action==='save').length;await q('#queue-resolve-selected').onclick();q('#queue-apply-note').onclick();
assert.equal(requests.filter(r=>r.action==='save').length,noBulkWrites);ctx.StudentPermissions.setUser(user);ctx.ConsoleLayout.notifications();
vm.runInContext("state.students.push({id:'QONE',name:'Single completion',categories:[]});state.records.push({id:'QONE',name:'Single completion',term:state.termLabel,subject:'M1',group:'G',date:state.asof,start:'2020-01-01',absent:6,slots:10});render()",ctx);
const resolveOne=[...q('#queue-items').querySelectorAll('[data-queue-resolve]')].find(b=>JSON.parse(b.dataset.queueResolve)[1]==='QONE');
assert(resolveOne);await resolveOne.click();assert.equal(vm.runInContext("Object.values(state.dailyFollow).find(f=>f.id==='QONE').status",ctx),'resolved');assert(!q('#queue-items').textContent.includes('QONE'));
console.log('PASS percentage filter, accurate profile label, bulk common drafts and resolution; failed receipt retains rows; retry avoids duplicate audit; missing records remain.');
// Production backfill tabs: exact historical date, completed rows included, drafts isolated.
const mainDateBeforeBackfill=vm.runInContext('state.asof',ctx),beforeBackfillWrites=requests.filter(r=>r.action==='save').length;
vm.runInContext("state.records.push({id:'QOVER',name:'Vượt',term:state.termLabel,subject:'M1',group:'G',date:'2026-10-20',start:'2020-01-01',absent:6,slots:10},{id:'QNEAR',name:'Gần',term:state.termLabel,subject:'M2',group:'G',date:'2026-10-20',start:'2020-01-01',absent:2,slots:10});render()",ctx);
quick=quickInput('QMISSING','');quick.value='Draft current retained';quick.oninput();
q('#queue-view-backfill').click();q('#queue-follow-date').value='2026-10-20';q('#queue-follow-date').onchange();
assert.equal(vm.runInContext('state.asof',ctx),mainDateBeforeBackfill);
assert(quickInput('QOVER','M1'));assert(quickInput('QNEAR','M2'));assert(q('#queue-resolve-selected').hidden);
assert(q('#queue-items [data-queue-resolve]').hidden);
q('#queue-severity').value='over';q('#queue-severity').onchange();assert(![...q('#queue-course').querySelectorAll('option')].some(n=>n.value==='M2'));q('#queue-severity').value='all';q('#queue-severity').onchange();
selectQueue('QOVER','M1');selectQueue('QNEAR','M2');q('#queue-common-note').value='Historical common note';q('#queue-apply-note').click();
assert(q('#queue-save-all').textContent.includes('(2)'));
q('#queue-follow-date').value='2026-10-19';q('#queue-follow-date').onchange();assert(![...q('#queue-items').querySelectorAll('[data-queue-note]')].some(n=>JSON.parse(n.dataset.queueNote)[2]==='M1'),'never label latest data as a missing historical day');
q('#queue-follow-date').value='2026-10-20';q('#queue-follow-date').onchange();assert.equal(quickInput('QOVER','M1').value,'Historical common note');
assert.equal(requests.filter(r=>r.action==='save').length,beforeBackfillWrites,'tabs and date never write');
await q('#queue-save-all').click();assert.equal(requests.filter(r=>r.action==='save').length,beforeBackfillWrites+1);
assert.equal(vm.runInContext("Object.values(state.dailyFollow).find(f=>f.id==='QOVER'&&f.date==='2026-10-20').note",ctx),'Historical common note');
assert.equal(vm.runInContext("Object.values(state.dailyFollow).find(f=>f.id==='QOVER'&&f.date==='2026-10-20').status",ctx),'none');
assert.equal(vm.runInContext("Object.values(state.dailyFollow).find(f=>f.id==='QOVER'&&f.date===state.asof).status",ctx),'resolved');
q('#queue-follow-date').value='2099-01-01';q('#queue-follow-date').onchange();assert.equal(q('#queue-follow-date').value,'2026-10-20');
q('#queue-view-current').click();assert.equal(quickInput('QMISSING','').value,'Draft current retained');assert.equal(vm.runInContext('state.asof',ctx),mainDateBeforeBackfill);
quick=quickInput('QMISSING','');quick.value='';quick.oninput();
console.log('PASS backfill bulk notes include completed cases on exact selected day, preserve other-day status/drafts, scope save counts, and never change attendance date.');
ctx.queueArchiveBefore=queueArchiveBefore;vm.runInContext('archive=JSON.parse(window.queueArchiveBefore);state=archive.terms[archive.active];render()',ctx);
console.log('PASS warning-level queue filters preserve totals and selection without writing workspace data.');
// A double submit sends only one login request while authentication is pending.
const previousFetch=ctx.fetch;let releaseLogin;let submissions=0;
ctx.fetch=async(url,options)=>{const body=JSON.parse(options.body);if(body.action==='login'){submissions++;await new Promise(resolve=>{releaseLogin=resolve})}return previousFetch(url,options)};
q('#auth-password').value='Password#1234';q('#auth-totp').value='654321';
const firstSubmit=q('#login-form').requestSubmit();const secondSubmit=q('#login-form').requestSubmit();await new Promise(r=>setTimeout(r,0));assert.equal(submissions,1);releaseLogin();await Promise.all([firstSubmit,secondSubmit]);
ctx.fetch=previousFetch;
// A real 429 displays a waiting state and blocks repeated submits without weakening MFA.
ctx.fetch=async()=>({json:async()=>({ok:false,code:'429',retryAfter:30,error:'Tạm giới hạn số lần thử.'})});q('#auth-password').value='Password#1234';await q('#login-form').requestSubmit();assert(q('#login-submit').disabled);assert(q('#login-submit').textContent.includes('Thử lại sau'));assert.equal(q('#auth-password').value,'Password#1234');
console.log('PASS inline authenticated workspace/no duplicate login; import badge ownership/acknowledgment; login cooldown.');
console.log('PASS save dialog/native picker/cancel/browser download/write failure; ordered import tabs; approved export palette.');
console.log('PASS secure client login/remember/TOTP/import review/server-save/no persistent storage (DOM fixture, not browser)');
})().catch(e=>{console.error(e);process.exitCode=1});
