import test from 'node:test';
import assert from 'node:assert/strict';
import {projectPortalContent} from '../src/modules/client-portal/projection.ts';

test('portal payload excludes private fields, drafts, internal messages and unshared attachment identifiers', () => {
 const input = {
  published: {revision: 2, draft_revision: 9, current_work: 'Design', next_action: 'Review',
   private_note: 'PRIVATE', milestones: [{title: 'Design', status: 'in_progress', evidence: 'PRIVATE'}]},
  draft: {current_work: 'PRIVATE'},
  files: [
   {id: 'shared', version: 1, name: 'Design.pdf', state: 'ready', audience: 'client', drive_url: null, storage_path: 'PRIVATE'},
   {id: 'PRIVATE-internal', state: 'ready', audience: 'internal'},
   {id: 'PRIVATE-pending', state: 'pending', audience: 'client'},
  ],
  messages: [
   {id: 'message', audience: 'client', body: 'Please review', created_at: '2026-10-07', author_id: 'PRIVATE', author: {display_name: 'Your team', email: 'PRIVATE'}},
   {id: 'PRIVATE-message', audience: 'internal', body: 'PRIVATE'},
  ],
  deliverables: [{id: 'design', title: 'Design', versions: [
   {id: 'v1', version: 1, description: 'Design', file_ids: ['shared', 'PRIVATE-internal', 'PRIVATE-pending'], published_at: '2026-10-07',
    reviews: [{lane: 'internal', note: 'PRIVATE'}, {lane: 'client_record', outcome: 'approved', note: 'Looks good', evidence: 'PRIVATE'}]},
   {id: 'PRIVATE-v2', version: 2, published_at: null, description: 'PRIVATE'},
  ]}],
 };
 const before = JSON.stringify(input);
 const result = projectPortalContent(input);
 assert.ok(!JSON.stringify(result).includes('PRIVATE'));
 assert.equal(result.files.length, 1);
 assert.equal(result.messages.length, 1);
 assert.deepEqual(result.deliverables[0].versions[0].file_ids, ['shared']);
 assert.equal(result.deliverables[0].versions[0].outcome, 'approved');
 assert.equal(JSON.stringify(input), before);
});

test('unpublished project produces empty portal content', () => {
 assert.deepEqual(projectPortalContent({published: null, files: [], messages: [], deliverables: []}),
  {progress: null, files: [], messages: [], deliverables: []});
});
