// Local Codespaces staging runner. Never deploys, schedules backups or changes schema.
import fs from 'node:fs/promises';import path from 'node:path';import http from 'node:http';import {parseEnv} from 'node:util';import {fileURLToPath} from 'node:url';
import {stagingConfig,stagingActionAllowed,stagingRequestProblem,stagingForwardedOriginAllowed} from '../lib/staging-guard.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),dist=path.join(root,'dist');
try{
 const prod=parseEnv(await fs.readFile(path.join(root,'.env'),'utf8'));
 const config=stagingConfig({productionUrl:prod.DATABASE_URL,stagingUrl:process.env.DATABASE_URL,codespace:process.env.CODESPACE_NAME,domain:process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN});
 process.env.APP_ORIGIN=config.origin;
 process.env.SC_STUDY_DECISIONS='staging';
 for(const k of Object.keys(process.env))if(k.startsWith('S3_')||['MIGRATION_DATABASE_URL','MONITOR_PING_URL','CRON_SECRET','BACKUP_KEY'].includes(k))delete process.env[k];
 await fs.access(path.join(dist,'index.html'));const {default:rpc}=await import('../api/rpc.mjs');
 const headers=JSON.parse(await fs.readFile(path.join(root,'vercel.json'),'utf8')).headers[0].headers;
 const server=http.createServer(async(req,res)=>{
  for(const {key,value}of headers)res.setHeader(key,value);
  const json=(status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
  try{
   const url=new URL(req.url,'http://localhost');
   if(url.pathname==='/api/rpc'){
    if(req.method!=='POST')return json(405,{ok:false,error:'POST required'});
    const problem=stagingRequestProblem(req,process.env.APP_ORIGIN);
    if(problem){console.warn(JSON.stringify({stagingRequestRejected:true,...problem}));return json(403,{ok:false,code:problem.code,error:problem.message+(problem.expectedOrigin?' Mong đợi: '+problem.expectedOrigin+'; nhận: '+problem.receivedOrigin:'' )});}

    if(stagingForwardedOriginAllowed(req,process.env.APP_ORIGIN))req.headers.origin=process.env.APP_ORIGIN;
    let size=0;const parts=[];for await(const chunk of req){size+=chunk.length;if(size>3500000)return json(413,{ok:false,error:'Request too large'});parts.push(chunk);}
    try{req.body=JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{return json(400,{ok:false,error:'Invalid JSON'});}
    if(!stagingActionAllowed(req.body?.action))return json(403,{ok:false,code:'403',error:'Thao tác này bị tắt trong bản thử nghiệm staging.'});
    res.status=n=>{res.statusCode=n;return res};res.json=data=>json(res.statusCode||200,data);return await rpc(req,res);
   }
   if(req.method!=='GET'||url.pathname.startsWith('/api/'))return json(404,{ok:false});
   const rel=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).replace(/^\/+/,''),target=path.resolve(dist,rel);
   if(!target.startsWith(dist+path.sep))return json(404,{ok:false});
   let content=await fs.readFile(target);const ext=path.extname(target);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'})[ext]||'application/octet-stream');
   if(ext==='.html')content=Buffer.from(content.toString().replace(/<body([^>]*)>/i,'<body$1><div style="position:fixed;bottom:0;left:0;z-index:999999;background:#fff1be;color:#233f56;padding:4px 10px;font:600 11px Arial;pointer-events:none">STAGING · dữ liệu thử nghiệm · không phải Production</div>'));
   res.end(content);
  }catch{if(!res.headersSent)json(500,{ok:false,error:'Staging chưa xử lý được yêu cầu.'});else res.end();}
 });
 server.listen(config.port,'127.0.0.1',()=>{console.log('STAGING ONLY: '+config.origin);console.log('STAGING RUNNER: codespaces-origin-v3');console.log('Mở cổng4173 trong Ports, giữ Visibility=Private. Dừng bằng Ctrl+C. Không commit/push.');});
}catch{console.error('Chưa khởi động staging. Kiểm tra .env/.env.staging, endpoint riêng, Codespaces và npm run build. Không gửi khóa hoặc URL database.');process.exitCode=1;}
