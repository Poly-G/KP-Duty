import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sendSetupWelcomes} from '../src/modules/integrations/solta/onboarding/welcome-workflow.ts';
const ready={ready:true,jobId:'prepared-job',projectEmailsReady:true,portalProjectId:'portal',members:[],inviteEmails:['owner@example.invalid','member@example.invalid'],welcomeAccepted:[]};
test('only confirmed setup recipients receive welcomes and accepted invites are skipped',async()=>{
 const sent=[];assert.deepEqual(await sendSetupWelcomes({...ready,inviteEmails:[...ready.inviteEmails,ready.inviteEmails[0]],welcomeAccepted:['owner@example.invalid']},async email=>{sent.push(email);}),[]);assert.deepEqual(sent,['member@example.invalid']);
});
test('one provider failure preserves successful invitations and returns only pending recipients',async()=>{
 const sent=[];const pending=await sendSetupWelcomes(ready,async email=>{sent.push(email);if(email==='member@example.invalid')throw new Error('offline');});assert.deepEqual(pending,['member@example.invalid']);assert.equal(sent.length,2);assert.equal(ready.ready,true);
});
test('an incomplete setup sends no email',async()=>{let calls=0;await assert.rejects(sendSetupWelcomes({...ready,ready:false},async()=>{calls++;}),/Finish/);assert.equal(calls,0);});

test('multi-person welcomes keep at most two provider requests in flight',async()=>{let active=0,max=0,calls=0;const emails=Array.from({length:10},(_,i)=>`person${i}@example.invalid`);await sendSetupWelcomes({...ready,inviteEmails:emails},async()=>{active++;max=Math.max(max,active);await new Promise(resolve=>setTimeout(resolve,1));calls++;active--;});assert.equal(calls,10);assert.ok(max<=2);});
