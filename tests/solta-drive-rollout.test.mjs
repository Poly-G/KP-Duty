import test from 'node:test';
import assert from 'node:assert/strict';
import {portalOperation} from '../src/modules/integrations/solta/operations.ts';
test('Drive rollout preserves uploads before migration and while disabled',async()=>{
 for(const missing of [true,false]){
  const calls=[];
  const client={rpc:async(name,args)=>{calls.push({name,args});return missing&&name==='kp_solta_portal_drive_operation'?{error:{code:'PGRST202'}}:{data:{id:'sample-file',state:'pending',path:'sample/path',driveEnabled:false}};},storage:{from:()=>({createSignedUploadUrl:async(path,options)=>{assert.equal(path,'sample/path');assert.deepEqual(options,{upsert:false});return {data:{signedUrl:'https://storage.example/sample'}};}})}};
  assert.deepEqual(await portalOperation(client,{operation:'file.reserve',payload:{}},'sample-nonce'),{id:'sample-file',state:'pending',uploadUrl:'https://storage.example/sample',uploadProvider:'supabase'});
  assert.equal(calls.length,missing?2:1);
  if(missing){assert.equal(calls[1].name,'kp_solta_portal_operation');assert.equal(calls[1].args.p_nonce,'sample-nonce');}
 }
});
test('Unexpected Drive RPC errors never silently fall back or create an upload',async()=>{
 const calls=[];const client={rpc:async(name)=>{calls.push(name);return {error:{code:'42501'}};},storage:{from:()=>({})}};
 await assert.rejects(portalOperation(client,{operation:'file.reserve',payload:{}},'sample'),/unavailable/);assert.equal(calls.length,1);
});

test('Legacy downloads receive the same expiring KP ticket as Drive files',async()=>{
 const {randomUUID}=await import('node:crypto');const {verifyDownloadTicket}=await import('../src/modules/integrations/solta/download-ticket.ts');
 const input={version:1,business:'solta',operation:'file.download',projectId:randomUUID(),organizationId:randomUUID(),portalProjectId:randomUUID(),actorId:randomUUID(),actorName:'QA',actorRole:'member',payload:{fileId:randomUUID()}};
 const previous=process.env.SOLTA_PORTAL_SHARED_SECRET;process.env.SOLTA_PORTAL_SHARED_SECRET='synthetic-download-secret'.repeat(3);
 try{const client={rpc:async()=>({data:{name:'legacy-qa.txt',path:'private/sample'}}),storage:{from:()=>({})}};const {url}=await portalOperation(client,input,randomUUID());const parsed=new URL(url);assert.equal(parsed.origin,'https://kp-duty.vercel.app');assert.deepEqual(verifyDownloadTicket(parsed.searchParams.get('ticket'),process.env.SOLTA_PORTAL_SHARED_SECRET),input);}finally{if(previous===undefined)delete process.env.SOLTA_PORTAL_SHARED_SECRET;else process.env.SOLTA_PORTAL_SHARED_SECRET=previous;}
});
