const fail=()=>{throw Error('STAGING_GUARD: chưa xác nhận kết nối thử nghiệm riêng hoặc origin Codespaces.');};
export function stagingConfig({productionUrl,stagingUrl,codespace,domain}){
 let p,s;try{p=new URL(productionUrl);s=new URL(stagingUrl);}catch{fail();}
 const host=u=>u.hostname.toLowerCase().replace('-pooler.','.');
 if(!['postgres:','postgresql:'].includes(s.protocol)||host(p)===host(s)||!s.hostname||!s.searchParams.get('sslmode')||s.searchParams.get('sslmode')==='disable'||!codespace||!/^[a-z0-9-]+$/.test(codespace)||!domain||!/^[a-z0-9.-]+$/.test(domain))fail();
 return {port:4173,origin:'https://'+codespace+'-4173.'+domain};
}
export const stagingActionAllowed=action=>['challenge','login','resume','logout','changePassword','studyReview','previewStudyDecision','commitStudyDecision','cancelStudyDecision','load','sync','save','health','job','logs','users','artifact'].includes(action);

const safeOrigin=value=>{try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.origin:'unavailable';}catch{return value?'invalid':'missing';}};
export function stagingRequestProblem(req,expectedOrigin){
 if(req.headers.origin!==expectedOrigin&&!stagingForwardedOriginAllowed(req,expectedOrigin))return {code:'STAGING_ORIGIN_MISMATCH',expectedOrigin:safeOrigin(expectedOrigin),receivedOrigin:safeOrigin(req.headers.origin),message:'Staging từ chối địa chỉ nguồn của yêu cầu. Gửi mã lỗi và hai địa chỉ hiển thị để kiểm tra; không gửi mật khẩu hoặc mã xác thực.'};
 if(req.headers['x-sc-request']!=='1')return {code:'STAGING_REQUEST_MARKER_MISSING',message:'Staging chưa nhận được dấu nhận diện của ứng dụng. Tải lại bằng tab riêng và gửi mã lỗi nếu vẫn còn.'};
 return null;
}

export function stagingForwardedOriginAllowed(req,expectedOrigin){
 let e,r;try{e=new URL(expectedOrigin);r=new URL(req.headers.referer);}catch{return false;}
 return e.protocol==='https:'&&e.hostname.endsWith('-4173.app.github.dev')&&!r.username&&!r.password&&r.origin===expectedOrigin&&req.headers.origin==='http://localhost:4173'&&req.headers['x-sc-request']==='1'&&(!req.headers['sec-fetch-site']||req.headers['sec-fetch-site']==='same-origin');
}
