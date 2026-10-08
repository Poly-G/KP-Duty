import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ProviderEventConflict,receiveProviderRequest} from '../src/modules/integrations/nex/receiver.ts';
import {prepareProviderEnvelope} from '../src/modules/integrations/nex/provider-contract.ts';
const id='123e4567-e89b-42d3-a456-426614174000';
const event=prepareProviderEnvelope(id,new Date('2026-10-08T00:00:00.000Z'),{organizationId:id,contactId:null,attemptId:id,revision:1,admission:'inbound_claim',listingReadiness:'in_research',representation:'claim_pending',disposition:'active',mergedIntoOrganizationId:null,onboardingPhase:'responded',onboardedAt:null,contactStatus:null,organizationNoContact:false});
const config={enabled:'true',token:'a'.repeat(32),databaseUrl:'https://example.test',databaseSecret:'synthetic'};
function request(body=event,token=config.token,type='application/json'){return new Request('https://kp.example/api/integrations/nex/providers',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':type},body:typeof body==='string'?body:JSON.stringify(body)});}
test('disabled or incomplete config never reads payload or calls database',async()=>{
 for(const change of [{enabled:'false'},{token:''},{databaseSecret:''},{databaseUrl:''}]) {
  let calls=0;assert.equal((await receiveProviderRequest(request(),{...config,...change},async()=>{calls++;return 'applied';})).status,503);assert.equal(calls,0);
 }
});
test('auth, content type, payload bound and allowlist precede database',async()=>{
 for(const [req,status] of [[request(event,'wrong'),401],[request(event,config.token,'text/plain'),415],[request('x'.repeat(8193)),413],[request({...event,notes:'PRIVATE'}),400],[request({...event,payload:{...event.payload,email:'PRIVATE'}}),400],[request({...event,source:null}),400],[request('{'),400]]){
  let calls=0;const res=await receiveProviderRequest(req,config,async()=>{calls++;return 'applied';});assert.equal(res.status,status);assert.equal(calls,0);assert.ok(!(await res.text()).includes('PRIVATE'));
 }
});
test('accepted results acknowledge retries and errors expose no raw content',async()=>{
 for(const result of ['applied','stale','duplicate'])assert.deepEqual(await (await receiveProviderRequest(request(),config,async e=>{assert.deepEqual(e,event);return result;})).json(),{result});
 for (const [error,status] of [[new Error('PRIVATE DATABASE ERROR'),503],[new ProviderEventConflict('PRIVATE CONFLICT'),409]]) {
  const res=await receiveProviderRequest(request(),config,async()=>{throw error;});assert.equal(res.status,status);assert.ok(!(await res.text()).includes('PRIVATE'));
 }
});
test('v2 operating updates require independent activation and preserve v1',async()=>{
 const operations={outreachStatus:'responded',endReason:null,stalled:false,stallPhase:null,stalledSince:null,lastTouchAt:null,nextActionDueAt:null,openedAt:'2026-10-01T00:00:00.000Z',closedAt:null,attemptNumber:1,rulesVersion:1,asOfAt:'2026-10-08T00:00:00.000Z'};
 const v2={...event,schemaVersion:2,payload:{...event.payload,operations}};
 let calls=0;
 assert.equal((await receiveProviderRequest(request(v2),config,async()=>{calls++;return 'applied';})).status,503);assert.equal(calls,0);
 assert.equal((await receiveProviderRequest(request(v2),{...config,operationsEnabled:'true'},async e=>{assert.equal(e.schemaVersion,2);calls++;return 'applied';})).status,200);assert.equal(calls,1);
 assert.equal((await receiveProviderRequest(request({...v2,payload:{...v2.payload,operations:{...operations,notes:'PRIVATE'}}}),{...config,operationsEnabled:'true'},async()=>{calls++;return 'applied';})).status,400);assert.equal(calls,1);
});
