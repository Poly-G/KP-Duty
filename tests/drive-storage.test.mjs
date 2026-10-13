import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {DriveStorage,uploadSessionUrl} from '../src/modules/integrations/google-drive/storage.ts';
import {downloadTicket,verifyDownloadTicket} from '../src/modules/integrations/solta/download-ticket.ts';
test('Download tickets expire, cannot be altered, and carry only the authorized file-download request',()=>{
 const secret='sample-only-secret'.repeat(3),now=1000000;
 const input={version:1,business:'solta',operation:'file.download',projectId:randomUUID(),organizationId:randomUUID(),portalProjectId:randomUUID(),actorId:randomUUID(),actorName:'QA',actorRole:'member',payload:{fileId:randomUUID()}};
 const ticket=downloadTicket(input,secret,now);assert.deepEqual(verifyDownloadTicket(ticket,secret,now),input);
 assert.throws(()=>verifyDownloadTicket(ticket,secret,now+60000));assert.throws(()=>verifyDownloadTicket(ticket.slice(1),secret,now));assert.throws(()=>verifyDownloadTicket(ticket,'wrong'.repeat(10),now));
 assert.throws(()=>verifyDownloadTicket(downloadTicket({...input,operation:'file.complete'},secret,now),secret,now));
});
test('Drive upload session is limited to the official upload endpoint',async()=>{
 const url='https://www.googleapis.com/upload/drive/v3/files?upload_id=sample';assert.equal(uploadSessionUrl(url),url);
 for(const bad of ['https://attacker.example/upload/drive/v3/files?upload_id=a','http://www.googleapis.com/upload/drive/v3/files?upload_id=a','https://www.googleapis.com/drive/v3/files?upload_id=a'])assert.throws(()=>uploadSessionUrl(bad));
 const drive=new DriveStorage('synthetic-token',async(url,options)=>{assert.equal(options.headers.Authorization,'Bearer synthetic-token');assert.equal(options.headers.Origin,'https://www.soltaworks.com');const body=JSON.parse(options.body);assert.deepEqual(body.parents,['folder']);assert.equal(body.id,'file');assert.equal(body.name,'qa.txt');return new Response(null,{headers:{Location:'https://www.googleapis.com/upload/drive/v3/files?upload_id=sample'}});});
 assert.equal(await drive.start('file','folder','qa.txt','text/plain',3),url);
});
test('Drive downloads reject changed folder, size and oversized data',async()=>{
 const fetcher=(parents,size,body='abc')=>async(url)=>new Response(url.includes('alt=media')?body:JSON.stringify({parents,size,trashed:false}));
 const drive=new DriveStorage('fake',fetcher(['folder'],'3'));assert.equal(Buffer.from(await drive.bytes('file','folder',3)).toString(),'abc');
 await assert.rejects(new DriveStorage('fake',fetcher(['other'],'3')).bytes('file','folder',3));
 await assert.rejects(new DriveStorage('fake',fetcher(['folder'],'4')).bytes('file','folder',3));
 await assert.rejects(new DriveStorage('fake',fetcher(['folder'],'20971521')).bytes('file','folder'));
 await assert.rejects(new DriveStorage('fake',fetcher(['folder'],'3','abcd')).bytes('file','folder',3));
});
