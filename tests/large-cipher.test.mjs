import test from 'node:test';
import assert from 'node:assert/strict';
import {encrypt,decrypt,validCipherBase64} from '../lib/security.mjs';
process.env.DATA_KEY=Buffer.alloc(32,71).toString('base64');
process.env.BACKUP_KEY=Buffer.alloc(32,72).toString('base64');
test('large archive and outer backup encryption validate without stack overflow',()=>{
 const archive={text:'a'.repeat(5_000_000)};
 const cipher=encrypt(archive,'archive');
 assert.deepEqual(decrypt(cipher,'archive'),archive);
 const snapshot={tables:{sc_archive:[{cipher}]}};
 const outer=encrypt(snapshot,'student-care-backup-v1','BACKUP_KEY');
 const restored=decrypt(outer,'student-care-backup-v1','BACKUP_KEY');
 assert.deepEqual(decrypt(restored.tables.sc_archive[0].cipher,'archive'),archive);
 const broken=JSON.parse(outer);const data=Buffer.from(broken.data,'base64');data[20]^=1;broken.data=data.toString('base64');
 assert.throws(()=>decrypt(JSON.stringify(broken),'student-care-backup-v1','BACKUP_KEY'));
});
test('base64 scanner rejects malformed padding, alphabet and noncanonical data',()=>{
 for(const value of ['', 'YQ==','YWI=','YWJj'])assert(validCipherBase64(value));
 for(const value of [null,'a','====','YQ=','Y===','YQ==AAAA','YQ--','YQ__','YR==','YWJ=','YQ==\n'])assert(!validCipherBase64(value),String(value));
});
