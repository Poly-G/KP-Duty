import test from 'node:test';
import assert from 'node:assert/strict';
import {clientDeliverables,mergeVersionReviews} from '../src/modules/deliverables/types.ts';
test('client deliverables exclude drafts and private review evidence and never inherit old approval',()=>{
 const review={lane:'client_record',outcome:'approved',note:'Approved design',evidence:'PRIVATE EMAIL',client_name:'PRIVATE NAME',recorded_by:'PRIVATE ACTOR'};
 const version=(number,published,reviews=[])=>({id:`v${number}`,version:number,description:`Design ${number}`,file_ids:[`file${number}`],published_at:published?'2026-10-07':null,reviews});
 const project={id:'d',title:'Design',reviewer_id:'PRIVATE REVIEWER',versions:[version(1,true,[review,{lane:'internal',note:'PRIVATE NOTE'}]),version(2,false)]};
 const before=clientDeliverables([project]);
 assert.deepEqual(before[0].versions.map(v=>v.version),[1]);
 assert.equal(before[0].versions[0].outcome,'approved');
 assert.ok(!JSON.stringify(before).includes('PRIVATE'));
 project.versions.push(version(3,true));
 const after=clientDeliverables([project]);
 assert.deepEqual(after[0].versions.map(v=>v.version),[3,1]);
 assert.equal(after[0].versions[0].outcome,null);
 assert.equal(after[0].versions[0].feedback,null);
 assert.deepEqual(after[0].versions[0].file_ids,['file3']);
 assert.deepEqual(clientDeliverables([{...project,versions:[version(4,false)]}]),[]);
});

test('portal responses stay on their exact version, replace stale staff projection and omit private evidence from client projection',()=>{
 const decision={id:'decision',version_id:'v2',actor_id:'client-user',actor_name:'Client Approver',outcome:'approved',note:'Approved',created_at:'2026-10-13T04:00:00Z'};
 const staff=[{id:'internal',version_id:'v2',lane:'internal',outcome:'approved',note:'PRIVATE INTERNAL'}, {id:'old',version_id:'v2',lane:'client_record',outcome:'changes_requested',note:'Stale staff copy'}];
 const reviews=mergeVersionReviews('v2',staff,[decision]);assert.equal(reviews.length,2);assert.equal(reviews[1].source,'portal');assert.equal(reviews[1].client_name,'Client Approver');assert.equal(reviews[1].outcome,'approved');assert.deepEqual(mergeVersionReviews('v3',staff,[decision]),[]);
 const client=clientDeliverables([{id:'d',title:'Website',versions:[{id:'v2',version:2,description:'Website',file_ids:[],published_at:'2026-10-13',reviews}]}]);assert.equal(client[0].versions[0].outcome,'approved');assert.ok(!JSON.stringify(client).includes('PRIVATE'));assert.ok(!JSON.stringify(client).includes('Authenticated client portal decision'));
 assert.equal(mergeVersionReviews('v2',staff,[{...decision,outcome:'changes_requested'}])[1].outcome,'changes_requested');
});
