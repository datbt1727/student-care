import {gunzipSync} from 'node:zlib';
import {TextDecoder} from 'node:util';
import {fail,validCipherBase64} from './security.mjs';
// Only called after cookie, CSRF and write permission checks.
export function unpackSavePayload(p){
 if(p.jsonGzip===undefined)return p;
 if(p.json!==undefined||typeof p.jsonGzip!=='string'||p.jsonGzip.length>3400000||!p.jsonGzip.length||!validCipherBase64(p.jsonGzip))throw fail('Gói dữ liệu nén không hợp lệ.');
 let json;
 try{const raw=gunzipSync(Buffer.from(p.jsonGzip,'base64'),{maxOutputLength:24000000});json=new TextDecoder('utf-8',{fatal:true}).decode(raw);}
 catch(e){if(e.code==='ERR_BUFFER_TOO_LARGE')throw fail('Dữ liệu sau giải nén vượt 24 MB; chưa lưu.',413);throw fail('Gói dữ liệu nén bị lỗi; chưa lưu.');}
 return {...p,json};
}
