import test from 'node:test';import assert from 'node:assert/strict';import {gzipSync} from 'node:zlib';
import {unpackSavePayload} from '../lib/save-payload.mjs';
test('compressed save preserves exact UTF8 text and plain compatibility',()=>{
 const p={revision:2,requestId:'test-save',json:'{ "name": "Sinh viên 🌷" }'};assert.equal(unpackSavePayload(p),p);
 const packed={...p,jsonGzip:gzipSync(p.json).toString('base64')};delete packed.json;
 assert.equal(unpackSavePayload(packed).json,p.json);
});
test('malformed, ambiguous, invalid UTF8 and decompression bomb requests fail closed',()=>{
 for(const p of [{jsonGzip:'!!!!'},{jsonGzip:'YQ=='},{json:'{}',jsonGzip:'YQ=='},{jsonGzip:gzipSync(Buffer.from([255])).toString('base64')}])assert.throws(()=>unpackSavePayload(p));
 assert.throws(()=>unpackSavePayload({jsonGzip:gzipSync('x'.repeat(24000001)).toString('base64')}),e=>e.status===413);
});
