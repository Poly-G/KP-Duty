import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {receiveSoltaRead} from '../src/modules/integrations/solta/receiver.ts';
const secret='test-only-secret-'.repeat(3),now=Date.now(),nonce=randomUUID();
const payload={version:1,operation:'project.read',business:'solta',projectId:randomUUID(),organizationId:randomUUID(),portalProjectId:randomUUID(),actorId:randomUUID()};
const config={enabled:'true',secret,databaseUrl:'https://example.supabase.co',databaseSecret:'test-only-key'};
function request(body=JSON.stringify(payload),timestamp=String(Math.floor(now/1000)),signature){signature ??= createHmac('sha256',secret).update(timestamp+'.'+nonce+'.'+body).digest('hex');return new Request('https://kp.example/api/integrations/solta/portal',{method:'POST',headers:{'Content-Type':'application/json','X-Solta-Timestamp':timestamp,'X-Solta-Nonce':nonce,'X-Solta-Signature':signature},body});}
test('signed Solta reads are enabled explicitly, bounded, timestamped, strictly typed and fail closed',async()=>{
 let calls=0;const read=async(input,n)=>{calls++;assert.deepEqual(input,payload);assert.equal(n,nonce);return {project:{id:payload.projectId}};};
 assert.equal((await receiveSoltaRead(request(),{...config,enabled:undefined},read,now)).status,503);
 assert.equal((await receiveSoltaRead(request(),config,read,now)).status,200);assert.equal(calls,1);
 for(const req of [request(JSON.stringify({...payload,business:'nex'})),request(JSON.stringify({...payload,staff:true})),request('x'.repeat(9000)),request(JSON.stringify(payload),String(Math.floor(now/1000)-301)),request(JSON.stringify(payload),undefined,'0'.repeat(64))])assert.ok([400,401,413].includes((await receiveSoltaRead(req,config,read,now)).status));
 assert.equal(calls,1);assert.equal((await receiveSoltaRead(request(),config,async()=>null,now)).status,404);assert.equal((await receiveSoltaRead(request(),config,async()=>{throw new Error('PRIVATE');},now)).status,503);
});
