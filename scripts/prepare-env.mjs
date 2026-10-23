import fs from 'node:fs/promises';import {randomBytes} from 'node:crypto';
const path=new URL('../.env',import.meta.url);let text;
try{text=await fs.readFile(path,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;text=await fs.readFile(new URL('../.env.example',import.meta.url),'utf8');}
const created=[];
for(const name of ['DATA_KEY','BACKUP_KEY','RATE_KEY','CRON_SECRET']){
 const re=new RegExp('^'+name+'=(.*)$','m'),match=text.match(re);
 if(match&&match[1].trim()){if(Buffer.from(match[1].trim(),'base64').length!==32)throw Error(name+' đã có giá trị không đúng định dạng. Không tự thay khóa cũ.');continue;}
 const line=name+'='+randomBytes(32).toString('base64');text=match?text.replace(re,()=>line):text+'\n'+line+'\n';created.push(name);
}
await fs.writeFile(path,text,{mode:0o600});await fs.chmod(path,0o600);
console.log('Đã chuẩn bị .env trên máy này. Không upload .env lên GitHub.');
console.log(created.length?'Đã tạo: '+created.join(', '):'Giữ nguyên các khóa đã có; không thay khóa dữ liệu cũ.');
