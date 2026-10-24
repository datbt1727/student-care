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
const doc=new N('document');doc.append(...parse(html.replace(/<script>[\s\S]*?<\/script>/g,'').replace(/<style>[\s\S]*?<\/style>/g,'')));doc.documentElement=doc.querySelector('html');doc.body=doc.querySelector('body');doc.createElement=t=>new N(t);
const downloads=[],storage=new Map(),requests=[];
let saved={version:2,active:'2026-FALL',terms:{'2026-FALL':{termId:'2026-FALL',termLabel:'FALL 2026',asof:'2026-10-23',limit:25,early:20,students:[],records:[],courseCatalog:[],notes:{},dailyFollow:{},log:[],importFiles:[]}},registry:{students:{},events:[],seen:{}},studentServices:{certificates:[],insurance:[],audit:[]}};
const user={username:'admin.test',displayName:'Admin',role:'admin',active:true,mustChange:false};
const health={mirrorStatus:'Neon',backupAt:'2026-10-23',backupError:'',mirrorError:'',info:{spreadsheetUrl:'#',driveUrl:'#'}};
const fetch=async(url,options)=>{const {action,p}=JSON.parse(options.body);requests.push({action,p,headers:options.headers});let data;
switch(action){case 'resume':return {json:async()=>({ok:false,code:'SESSION',error:'Log in'})};case 'challenge':data={salt:'a'.repeat(32)};break;case 'login':data={token:'cookie',csrf:'test-csrf',user,workspace:{archive:structuredClone(saved),revision:1,user,health}};break;case 'load':data={archive:structuredClone(saved),revision:1,user,health};break;case 'users':data=[user];break;case 'logs':data=[];break;case 'save':saved=JSON.parse(p.json);data={revision:p.revision+1,receipt:{committed:true,requestId:p.requestId,requestHash:crypto.createHash('sha256').update(JSON.stringify([p.revision,p.json,p.restore===true,p.confirmation||''])).digest('hex'),revision:p.revision+1},warning:'',info:health};break;case 'health':data=health;break;case 'artifact':data={id:'processed'};break;default:data={message:'OK'};}
return {json:async()=>({ok:true,data})}};
const observers=[];
const ctx={MutationObserver:class{constructor(fn){this.fn=fn}observe(target){observers.push(()=>this.fn([{target}]))}},document:doc,console,crypto:crypto.webcrypto,TextEncoder,TextDecoder,Blob,URL,AbortSignal,fetch,structuredClone,btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary'),localStorage:{getItem:k=>null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},setTimeout:(fn,ms)=>{const t=setTimeout(fn,ms);if(ms>500)t.unref();return t},clearTimeout,setInterval:(fn,ms)=>{const t=setInterval(fn,ms);t.unref();return t},clearInterval,confirm:()=>true,location:{reload(){}},scrollTo(){},addEventListener(){}};
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
console.log('PASS Vietnam midnight defaults and manual dates preserved across renders/tab visits.');
const login=requests.find(r=>r.action==='login');assert.equal(login.p.password,'Password#1234');assert.equal(login.p.remember,true);assert.equal(login.p.totp,'123456');assert(!login.p.verifier);assert.equal(login.p.includeWorkspace,true);assert(!requests.some(r=>r.action==='load'),'inline authenticated workspace avoids the second load request');
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
let shares=0;ctx.navigator={canShare:()=>true,share:async payload=>{assert.equal(payload.files[0].name,'share.xlsx');shares++}};
pending=ctx.StudentFileSave.save('share.xlsx','bytes','application/octet-stream');assert.equal(shares,0);
await q('.sc-save-dialog [data-save="share"]').click();await pending;assert.equal(shares,1);assert.equal(downloads.length,0);
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
// A double submit sends only one login request while authentication is pending.
const previousFetch=ctx.fetch;let releaseLogin;let submissions=0;
ctx.fetch=async(url,options)=>{const body=JSON.parse(options.body);if(body.action==='login'){submissions++;await new Promise(resolve=>{releaseLogin=resolve})}return previousFetch(url,options)};
q('#auth-password').value='Password#1234';q('#auth-totp').value='654321';
const firstSubmit=q('#login-form').requestSubmit();const secondSubmit=q('#login-form').requestSubmit();await new Promise(r=>setTimeout(r,0));assert.equal(submissions,1);releaseLogin();await Promise.all([firstSubmit,secondSubmit]);
ctx.fetch=previousFetch;
// A real 429 displays a waiting state and blocks repeated submits without weakening MFA.
ctx.fetch=async()=>({json:async()=>({ok:false,code:'429',retryAfter:30,error:'Tạm giới hạn số lần thử.'})});q('#auth-password').value='Password#1234';await q('#login-form').requestSubmit();assert(q('#login-submit').disabled);assert(q('#login-submit').textContent.includes('Thử lại sau'));assert.equal(q('#auth-password').value,'Password#1234');
console.log('PASS inline authenticated workspace/no duplicate login; import badge ownership/acknowledgment; login cooldown.');
console.log('PASS save dialog/native picker/cancel/share/write failure; ordered import tabs; approved export palette.');
console.log('PASS secure client login/remember/TOTP/import review/server-save/no persistent storage (DOM fixture, not browser)');
})().catch(e=>{console.error(e);process.exitCode=1});
