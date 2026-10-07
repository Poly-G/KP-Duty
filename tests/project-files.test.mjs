import test from 'node:test';
import assert from 'node:assert/strict';
import {validateProjectFile,validateDriveUrl,MAX_FILE_BYTES} from '../src/modules/project-collaboration/files.ts';
test('file type is verified against bytes, names are safe, and hashes identify exact versions',()=>{
 const bytes=Buffer.from('%PDF-1.7\nexample');const file=validateProjectFile('../client brief.pdf',bytes);
 assert.equal(file.mime,'application/pdf');assert.ok(!file.name.includes('/'));assert.equal(file.sha256.length,64);
 assert.throws(()=>validateProjectFile('fake.pdf',Buffer.from('<html>bad</html>')));
 assert.throws(()=>validateProjectFile('file.svg',Buffer.from('<svg/>')));
 assert.throws(()=>validateProjectFile('file.txt',new Uint8Array([0])));
 assert.throws(()=>validateProjectFile('file.txt',new Uint8Array([255])));
 assert.throws(()=>validateProjectFile('file.txt',new Uint8Array(MAX_FILE_BYTES+1)));
 assert.throws(()=>validateProjectFile('file.txt',new Uint8Array()));
 assert.equal(validateProjectFile('file.csv',Buffer.from('name,value\ntest,1')).mime,'text/csv');
});
test('Drive links must use the exact trusted HTTPS host without embedded credentials',()=>{
 assert.equal(validateDriveUrl('https://drive.google.com/file/d/example'),'https://drive.google.com/file/d/example');
 for(const url of ['javascript:alert(1)','http://drive.google.com/file/d/example','https://drive.google.com.evil.test/file','https://user:password@drive.google.com/file','https://drive.google.com:8443/file'])assert.throws(()=>validateDriveUrl(url));
});
