import test from 'node:test';
import assert from 'node:assert/strict';
import {clientDeliverables} from '../src/modules/deliverables/types.ts';
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
