import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {parseTaskEnvelope,parseRequestOutcome} from '../src/modules/integrations/nex/operations-contract.ts';
import {receiveOperation,IntegrationConflict} from '../src/modules/integrations/nex/http.ts';
import {nexAdminUrl} from '../src/modules/integrations/nex/navigation.ts';
import {readOperation} from '../src/modules/integrations/nex/read-operation.ts';
const token='x'.repeat(40),config={enabled:'true',token,databaseUrl:'https://example.supabase.co',databaseSecret:'server-only'};
const task=()=>({schemaVersion:1,source:'nexproviders',target:'kp',entityType:'provider_follow_up',eventType:'task_snapshot',eventId:randomUUID(),occurredAt:'2026-10-08T00:00:00.000Z',payload:{organizationId:randomUUID(),attemptId:randomUUID(),contactId:null,taskId:randomUUID(),revision:1,kind:'follow_up',state:'open',dueAt:null,resolvedAt:null}});
const request=(body,headers={})=>new Request('https://kp.example/api/integrations/nex/tasks',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json',...headers},body:JSON.stringify(body)});
test('strict tasks reject customer/private data, invalid IDs, dates and terminal states',()=>{
 const e=task();assert.equal(parseTaskEnvelope(e).payload.state,'open');
 for(const p of [{...e.payload,notes:'PRIVATE'},{...e.payload,taskId:'email'},{...e.payload,revision:1.1},{...e.payload,dueAt:'2026-02-30T00:00:00.000Z'},{...e.payload,state:'completed'},{...e.payload,kind:'marketplace'}])assert.throws(()=>parseTaskEnvelope({...e,payload:p}));
 for(const changed of [{...e,notes:'PRIVATE'},{...e,source:'kp'},{...e,schemaVersion:2},{...e,entityType:'veteran'}])assert.throws(()=>parseTaskEnvelope(changed));
});
test('outcomes are strict, request-only, without free-text reasons',()=>{
 const v={requestId:randomUUID(),status:'accepted',code:'applied'};assert.deepEqual(parseRequestOutcome(v),v);
 for(const x of [{...v,state:'onboarded'},{...v,code:'not_allowed'},{...v,status:'pending'},{...v,notes:'PRIVATE'}])assert.throws(()=>parseRequestOutcome(x));
});
test('disabled and unauthenticated operations do not invoke parser or database',async()=>{
 const fail=()=>{throw Error('called')};assert.equal((await receiveOperation(request({}),{},fail,fail)).status,503);
 assert.equal((await receiveOperation(request({}, {authorization:'bad'}),config,fail,fail)).status,401);
 assert.equal((await receiveOperation(request('x'.repeat(9000)),config,fail,fail)).status,413);
});
test('retry errors are sanitized and no acknowledgement is invented',async()=>{
 const e=task();assert.equal((await receiveOperation(request(e),config,parseTaskEnvelope,async()=>{throw new IntegrationConflict('PRIVATE')})).status,409);
 const r=await receiveOperation(request(e),config,parseTaskEnvelope,async()=>{throw Error('PRIVATE')});assert.equal(r.status,503);assert.equal((await r.text()).includes('PRIVATE'),false);
});
test('poll pagination is bounded, authenticated and never cached',async()=>{
 const req=new Request('https://kp.example/requests',{headers:{authorization:`Bearer ${token}`}});
 const items=Array.from({length:100},()=>({requestId:randomUUID()}));const r=await readOperation(req,config,async c=>{assert.equal(c,null);return items});assert.equal(r.headers.get('Cache-Control'),'no-store');assert.equal((await r.json()).next,items.at(-1).requestId);
 const bad=new Request('https://kp.example/requests?after=private',{headers:{authorization:`Bearer ${token}`}});assert.equal((await readOperation(bad,config,()=>{throw Error('called')})).status,400);
 assert.equal((await readOperation(req,config,async()=>[])).status,200);assert.equal((await readOperation(req,{},async()=>[])).status,503);
});

test('source admin navigation only accepts a reviewed HTTPS origin',()=>{
 assert.equal(nexAdminUrl('https://nex.example'),'https://nex.example/admin');
 for(const url of [undefined,'javascript:alert(1)','http://nex.example','https://user:secret@nex.example','https://nex.example/private','https://nex.example?token=x'])assert.equal(nexAdminUrl(url),null);
});
