import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
export function scanText(text){
 const checks=[['private-key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],['aws-access-id',/\bAKIA[0-9A-Z]{16}\b/],['github-token',/\bgh[pousr]_[A-Za-z0-9]{30,}\b/],['embedded-server-key',/\b(?:DATA_KEY|BACKUP_KEY|RATE_KEY|CRON_SECRET|S3_SECRET_ACCESS_KEY)\b\s*[:=]\s*['"][A-Za-z0-9+/_=-]{24,}['"]/]];
 return checks.filter(([,pattern])=>pattern.test(text)).map(([name])=>name);
}
export async function check(root){
 const issues=[];let count=0;const dist=path.join(root,'dist');
 async function visit(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())await visit(p);else{if(/^\.env(?:\.|$)/.test(entry.name))issues.push({file:path.relative(root,p),rule:'environment-file-in-public-build'});if(/\.(js|html|json|txt)$/i.test(entry.name)){count++;for(const rule of scanText(await fs.readFile(p,'utf8')))issues.push({file:path.relative(root,p),rule});}}}}
 await visit(dist);const config=JSON.parse(await fs.readFile(path.join(root,'vercel.json'),'utf8')),headers=config.headers.find(h=>h.source==='/(.*)')?.headers||[],map=Object.fromEntries(headers.map(h=>[h.key.toLowerCase(),h.value]));
 for(const key of ['content-security-policy','strict-transport-security','x-content-type-options','x-frame-options','referrer-policy','permissions-policy'])if(!map[key])issues.push({file:'vercel.json',rule:'missing-'+key});
 const scripts=map['content-security-policy']?.split(';').find(s=>s.trim().startsWith('script-src'))||'';if(/unsafe-inline|unsafe-eval|https?:/.test(scripts))issues.push({file:'vercel.json',rule:'unsafe-script-policy'});
 return {publicFilesChecked:count,issues};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){try{const result=await check(fileURLToPath(new URL('../',import.meta.url)));console.log(JSON.stringify(result,null,2));if(result.issues.length)process.exitCode=1;else console.log('PASS public build secret-pattern and security-header checks. This is not a penetration test.');}catch{console.error('Không hoàn tất quét. Chạy npm run build trước và kiểm tra thư mục dự án.');process.exitCode=1;}}
