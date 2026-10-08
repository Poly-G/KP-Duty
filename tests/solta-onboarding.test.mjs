import test from 'node:test';
import assert from 'node:assert/strict';
import {onboardingFields} from '../src/modules/delivery/templates.ts';
import {readOnboardingDraft,onboardingProblems,requestDisposition} from '../src/modules/client-portal/onboarding.ts';
test('onboarding restores only known fields and rejects damaged or foreign service drafts',()=>{
 assert.equal(readOnboardingDraft({version:1,service:'snd',answers:{}}),null);
 assert.equal(readOnboardingDraft({version:2,service:'website',answers:{}}),null);
 assert.equal(readOnboardingDraft({version:1,service:'website',answers:{goal:3}}),null);
 const result=readOnboardingDraft({version:1,service:'website',answers:{goal:'Grow',unexpected:'PRIVATE'}});
 assert.equal(result.answers.goal,'Grow');assert.ok(!('unexpected' in result.answers));
});
test('onboarding checks conditional branding, whitespace and email before review',()=>{
 const answers=Object.fromEntries(Object.keys(onboardingFields('website',2,{branding_included:'no'})).map(k=>[k,'Sample answer']));
 answers.approver_email='demo@example.com';answers.branding_included='no';
 assert.deepEqual(onboardingProblems({version:1,service:'website',answers}),[]);
 answers.branding_included='yes';
 assert.ok(onboardingProblems({version:1,service:'website',answers}).some(p=>p.includes('Brand context')));
 answers.brand_context='Sample';answers.brand_constraints='Sample';answers.goal='   ';answers.approver_email='invalid';
 const errors=onboardingProblems({version:1,service:'website',answers});
 assert.ok(errors.some(p=>p.includes('achieve')));assert.ok(errors.some(p=>p.includes('valid contact email')));
});
test('request entitlement routing never assumes unconfigured work is included',()=>{
 assert.equal(requestDisposition('feature',{feature:'unconfigured',bug:'included'}),'review_plan');
 assert.equal(requestDisposition('feature',{feature:'quote_required',bug:'included'}),'review_quote');
 assert.equal(requestDisposition('bug',{feature:'quote_required',bug:'included'}),'review_included');
});
