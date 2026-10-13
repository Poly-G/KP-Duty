import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {officeScope} from '../src/modules/delivery/office-offer.ts';
import {planOfficeRecipe,runOfficeRecipe} from '../src/modules/delivery/office-recipes.ts';
const contact={id:'synthetic',name:'QA',email:'qa@example.invalid',canMessage:true};
const config={id:randomUUID(),kind:'inquiry',active:true,scopeApproved:true,paymentVerified:true,accessReady:true,acceptanceApproved:true,scopeVersion:1,messageApproved:true,message:'Approved sample wording',staffInbox:'staff@example.invalid'};
test('scope templates require actual tool names, costs and task-specific acceptance criteria',()=>{
 for(const kind of ['inquiry','reminder','review']){const scope=officeScope({kind,toolsConfirmed:true,costsConfirmed:true,sourceTool:'Approved source',destinationTool:'Approved destination',thirdTool:'',details:'Synthetic single task, field mapping and timing',softwareCosts:'No added provider cost confirmed',message:''});assert.match(scope.commercial_terms,/\$799 USD.*after approval/);assert.match(scope.deliverables,/1\..*\n2\..*\n3\./);assert.match(scope.exclusions,/Multiple tasks.*separate quote/);}
 assert.throws(()=>officeScope({kind:'multiple',sourceTool:'x',destinationTool:'y',details:'x',softwareCosts:'unknown'}));
});
test('paused and unapproved setups cannot execute or call customer tools',async()=>{
 const event={type:'inquiry',id:'one',contact,summary:'QA'};let called=0;const ports={claim:async()=>{called++;return true;},execute:async()=>{},finish:async()=>{},fail:async()=>{}};
 for(const change of [{active:false},{scopeApproved:false},{paymentVerified:false},{accessReady:false},{acceptanceApproved:false}])await assert.rejects(runOfficeRecipe({...config,...change},event,ports),/Activate only/);
 assert.equal(called,0);assert.throws(()=>planOfficeRecipe({...config,kind:'review'},event),/does not match/);
});
test('a repeated inquiry cannot duplicate contact writes or notifications; step retry keeps its idempotency key',async()=>{
 const event={type:'inquiry',id:'same-event',contact,summary:'QA'},completed=new Set(),steps=new Set();let failOnce=true,calls=0;
 const ports={claim:async k=>!completed.has(k),execute:async(s,k)=>{if(steps.has(k))return;if(s.type==='notify-staff'&&failOnce){failOnce=false;throw Error('provider unavailable');}steps.add(k);calls++;},finish:async k=>{completed.add(k);},fail:async()=>{}};
 await assert.rejects(runOfficeRecipe(config,event,ports));assert.equal((await runOfficeRecipe(config,event,ports)).status,'complete');assert.equal((await runOfficeRecipe(config,event,ports)).status,'duplicate');assert.equal(calls,2);
});
test('reminders require correct timing, time zone, approved wording and current-status recheck',()=>{
 const event={type:'appointment',id:'appointment',version:'v1',contact,status:'confirmed',startsAt:'2026-11-05T10:00:00-08:00',timeZone:'America/Los_Angeles'},c={...config,kind:'reminder'};
 const plan=planOfficeRecipe(c,event,new Date('2026-11-01T00:00:00Z'));assert.equal(plan.steps[0].at,'2026-11-04T18:00:00.000Z');assert.equal(plan.steps[0].recheckBeforeSend,true);
 assert.notEqual(plan.key,planOfficeRecipe(c,{...event,version:'v2'},new Date('2026-11-01T00:00:00Z')).key);
 assert.equal(planOfficeRecipe(c,{...event,status:'cancelled'}).steps.length,0);assert.equal(planOfficeRecipe(c,event,new Date('2026-11-06T00:00:00Z')).steps.length,0);
 assert.throws(()=>planOfficeRecipe(c,{...event,timeZone:'invalid'}),/time zone/);assert.throws(()=>planOfficeRecipe({...c,messageApproved:false},event),/Approve the message/);
});
test('opt-outs are respected and review requests never use satisfaction filtering',()=>{
 const c={...config,kind:'review',reviewUrl:'https://example.invalid/review'},event={type:'completed_job',id:'job',contact};
 assert.equal(planOfficeRecipe(c,{...event,contact:{...contact,canMessage:false}}).steps.length,0);
 assert.equal(planOfficeRecipe(c,event).steps[0].type,'send-review');assert.throws(()=>planOfficeRecipe(c,{...event,rating:5}));assert.throws(()=>planOfficeRecipe({...c,reviewUrl:'http://example.invalid'},event));
});
