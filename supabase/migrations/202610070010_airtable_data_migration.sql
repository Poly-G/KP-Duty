-- One-time Airtable -> KP Duty data migration.
begin;


insert into public.organizations (name,website,public_email,city,state)
select v.name,v.website,v.public_email,v.city,v.state
from (values
('Done Right Plumbing',null,null,null,null),
('Electrician Henderson',null,null,null,null),
('Quality Handyman Services',null,null,null,null),
('WLM Landscape',null,null,null,null),
('Energetic Lawn Care & Landscapes',null,null,null,null),
('Bristlecone Landscaping & Horticulture',null,null,null,null),
('Service Plus Plumbing',null,null,null,null),
('TGJ Painting',null,null,null,null),
('King Roofing',null,null,null,null),
('McMillan & McMillan Painting Contractors',null,null,null,null),
('All State Roofing',null,null,null,null),
('Etextbook client (Upwork)',null,null,null,null),
('7-location dance studio (Upwork client)',null,null,null,null)
) as v(name,website,public_email,city,state)
where not exists (
  select 1 from public.organizations o where lower(o.name)=lower(v.name)
);



insert into public.tasks (
  reference_code,title,business_id,owner_id,stage,availability,priority,due_at,
  next_action,finished_when,waiting_on,reference_url,what_this_is,why_it_matters,
  instructions,notes,position,finished_at,created_by,updated_by
)
values
(
    'TASK-011',
    'Deliver first paid Solta project',
    (select id from public.businesses where slug='solta'),
    null,
    'todo'::public.task_stage,
    'blocked'::public.task_availability,
    'normal'::public.task_priority,
    null::timestamptz,
    'Assign an owner or resolve the blocker before starting.',
    'The signed scope is delivered, QA/launch/handoff are complete, payment status is reconciled, and follow-up/support responsibilities are explicit.',
    null,
    'https://app.notion.com/p/3ec8037fac7381859d06cbfb984bc592',
    'A current Solta Works work item tracked by KP.',
    'This matters because the task is complete only when: The signed scope is delivered, QA/launch/handoff are complete, payment status is reconciled, and follow-up/support responsibilities are explicit.',
    '1. Read the task record and its Finished When condition.
2. Do the next concrete action shown in Do This Next.
3. Update Airtable if the work stage, owner, blocker, or next action changes.
4. Mark Finished only when the Finished When condition is actually met.
',
    'Migrated from current KP Master Tasks in Notion.',
    0,
    null,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  ),
(
    'TASK-002',
    'Build first Solta qualified prospect batch',
    (select id from public.businesses where slug='solta'),
    '8311607b-402c-48c9-945b-1a035a08cf2e',
    'working'::public.task_stage,
    'yes'::public.task_availability,
    'high'::public.task_priority,
    null::timestamptz,
    'Research the next local or U.S. small business. Search Solta Leads first for duplicates. If public evidence supports a real Solta fit, add/update the lead. Do not contact the business yet.',
    'Research a small high-fit batch and record only qualified businesses with visible evidence, contact route/channel, and next action.',
    null,
    'https://docs.google.com/document/d/1zfHVeGqrY4JnCiRIl5jmFIzpP2XylLM7OWsct2sDTE4/edit',
    'Keshia is building Solta''s first usable batch of qualified small-business prospects before controlled outreach begins.',
    'Solta needs a real, evidence-based prospect pool so outreach is targeted instead of random. Qualified leads should have a visible public problem Solta can plausibly solve.',
    '1. Search Airtable Solta Leads first to prevent a duplicate.
2. Find and verify a real small business using public sources.
3. Review the public website/business presence and identify one specific visible problem.
4. Do not invent internal pain or criticize the business generically.
5. If it qualifies, add/update the Solta Leads record with the evidence, owner, stage, priority, contact route, and next action.
6. If it does not qualify, reject it and move on.
7. Qualified does not mean outreach is approved—do not contact until the current Solta outreach gate is open.
',
    'Local/in-person and U.S. online prospects both allowed.',
    1,
    null,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  ),
(
    'TASK-001',
    'Run and own SnD Upwork screening',
    (select id from public.businesses where slug='snd'),
    '8311607b-402c-48c9-945b-1a035a08cf2e',
    'todo'::public.task_stage,
    'yes'::public.task_availability,
    'high'::public.task_priority,
    '2026-10-06'::timestamptz,
    'Run one Recent + U.S. Only Upwork screening batch. Paste the full results batch into ChatGPT, open only the shortlisted jobs, and log every APPLY recommendation in SnD Opportunities.',
    'Run the approved Recent → U.S. Only → Load More → ⌘A/⌘C screening workflow; every APPLY becomes a complete SnD Opportunity + Poly handoff.',
    null,
    'https://docs.google.com/document/d/1tPnrLFZubPHAGmCJGgkWpB3EKjmckPbx6G36BDOxM5s/edit',
    'Keshia''s recurring SnD responsibility for finding and screening high-fit Upwork opportunities before Poly spends time or Connects on them.',
    'This keeps the SnD opportunity pipeline moving and removes the first-pass screening workload from Poly.',
    '1. Open Upwork jobs and filter to Recent/newest and U.S. Only.
2. Scroll down and keep clicking Load More for the useful recent batch.
3. On Mac press Command+A, then Command+C, and paste the batch into ChatGPT.
4. Let ChatGPT shortlist only the jobs worth opening.
5. Open each shortlisted job and paste the full visible job details into ChatGPT.
6. Get a clear PASS or APPLY decision.
7. For APPLY, create/update the Airtable SnD Opportunities record and prepare the handoff for Poly.
8. Do not use Poly''s Upwork login and do not mark Applied until Poly actually submits.
',
    'First active task after shared-write setup.',
    2,
    null,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  ),
(
    'TASK-008',
    'Reconcile SnD current offer + positioning during revamp',
    (select id from public.businesses where slug='snd'),
    null,
    'todo'::public.task_stage,
    'blocked'::public.task_availability,
    'high'::public.task_priority,
    null::timestamptz,
    'Assign an owner or resolve the blocker before starting.',
    'SnD''s current offer, exclusions, positioning, proof claims, and acquisition framing are internally consistent with the active-secondary-lane strategy and current lifecycle/CRM direction.',
    null,
    'https://app.notion.com/p/3e08037fac738091a1fad41c7ba271cc',
    'A current Sent & Delivered work item tracked by KP.',
    'This matters because the task is complete only when: SnD''s current offer, exclusions, positioning, proof claims, and acquisition framing are internally consistent with the active-secondary-lane strategy and current lifecycle/CRM direction.',
    '1. Read the task record and its Finished When condition.
2. Do the next concrete action shown in Do This Next.
3. Update Airtable if the work stage, owner, blocker, or next action changes.
4. Mark Finished only when the Finished When condition is actually met.
',
    'Migrated from current KP Master Tasks in Notion.',
    3,
    null,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  ),
(
    'TASK-005',
    'Load and send Keshia required Bibles / standards',
    null,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'todo'::public.task_stage,
    'blocked'::public.task_availability,
    'high'::public.task_priority,
    null::timestamptz,
    'Resolve the dependency first: Poly needs to provide/upload the Bibles to this conversation first.',
    'The approved onboarding Bibles are stored in the shared Drive Bibles & Standards folder as the canonical copies, Keshia receives an email with links and a short explanation of what each file is for, and Keshia''s onboarding/Chat can access the references it needs (especially the Pitching Bible for Upwork).',
    'Poly needs to provide/upload the Bibles to this conversation first.',
    'https://drive.google.com/drive/folders/11NghLagIymEhtxQQC4490j3_-NBbl6Q2',
    'A current KP / Shared work item tracked by KP.',
    'This matters because the task is complete only when: The approved onboarding Bibles are stored in the shared Drive Bibles & Standards folder as the canonical copies, Keshia receives an email with links and a short explanation of what each file is for, and Keshia''s onboarding/Chat can access the references it needs (especially the Pitching Bible for Upwork).',
    '1. Read the task record and its Finished When condition.
2. Do the next concrete action shown in Do This Next.
3. Update Airtable if the work stage, owner, blocker, or next action changes.
4. Mark Finished only when the Finished When condition is actually met.
',
    'Migrated from current KP Master Tasks in Notion.',
    4,
    null,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  ),
(
    'TASK-019',
    'Finalize Solta first-touch outreach message',
    (select id from public.businesses where slug='solta'),
    null,
    'todo'::public.task_stage,
    'blocked'::public.task_availability,
    'high'::public.task_priority,
    null::timestamptz,
    'Resolve the dependency first: Public site/contact path needs to be ready enough to support outreach.',
    'A short plain-English first-touch message uses one verified prospect-specific observation, current Solta positioning, and one simple CTA without unsupported claims.',
    'Public site/contact path needs to be ready enough to support outreach.',
    'https://app.notion.com/p/3ec8037fac7381898d0dda016af39f37',
    'A current Solta Works work item tracked by KP.',
    'This matters because the task is complete only when: A short plain-English first-touch message uses one verified prospect-specific observation, current Solta positioning, and one simple CTA without unsupported claims.',
    '1. Read the task record and its Finished When condition.
2. Do the next concrete action shown in Do This Next.
3. Update Airtable if the work stage, owner, blocker, or next action changes.
4. Mark Finished only when the Finished When condition is actually met.
',
    'Migrated from current KP Master Tasks in Notion.',
    5,
    null,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  ),
(
    'TASK-024',
    'Create shared KP business finance Sheet',
    null,
    null,
    'todo'::public.task_stage,
    'blocked'::public.task_availability,
    'normal'::public.task_priority,
    null::timestamptz,
    'Assign an owner or resolve the blocker before starting.',
    'A shared Google Sheet exists under Shared Operations → Finance — Shared Business Only with an agreed lightweight structure for business income, expenses, reimbursements, and vendor/software costs.',
    null,
    'https://drive.google.com/drive/folders/12F1C4EUSagugdplSiJLlwidMDZ2N6MuE',
    'A current KP / Shared work item tracked by KP.',
    'This matters because the task is complete only when: A shared Google Sheet exists under Shared Operations → Finance — Shared Business Only with an agreed lightweight structure for business income, expenses, reimbursements, and vendor/software costs.',
    '1. Read the task record and its Finished When condition.
2. Do the next concrete action shown in Do This Next.
3. Update Airtable if the work stage, owner, blocker, or next action changes.
4. Mark Finished only when the Finished When condition is actually met.
',
    'Migrated from current KP Master Tasks in Notion.',
    6,
    null,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  ),
(
    'TASK-014',
    'Handle Solta replies and first discovery conversations',
    (select id from public.businesses where slug='solta'),
    null,
    'todo'::public.task_stage,
    'blocked'::public.task_availability,
    'normal'::public.task_priority,
    null::timestamptz,
    'Assign an owner or resolve the blocker before starting.',
    'Each qualified conversation has the buyer''s actual problem, desired outcome, decision-maker/context, timeline, and a clear go/no-go next step recorded.',
    null,
    'https://app.notion.com/p/3ec8037fac73818cb0e3edf180b52727',
    'A current Solta Works work item tracked by KP.',
    'This matters because the task is complete only when: Each qualified conversation has the buyer''s actual problem, desired outcome, decision-maker/context, timeline, and a clear go/no-go next step recorded.',
    '1. Read the task record and its Finished When condition.
2. Do the next concrete action shown in Do This Next.
3. Update Airtable if the work stage, owner, blocker, or next action changes.
4. Mark Finished only when the Finished When condition is actually met.
',
    'Migrated from current KP Master Tasks in Notion.',
    7,
    null,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  ),
(
    'TASK-015',
    'Run first controlled Solta prospecting batch',
    (select id from public.businesses where slug='solta'),
    null,
    'todo'::public.task_stage,
    'blocked'::public.task_availability,
    'high'::public.task_priority,
    null::timestamptz,
    'Resolve the dependency first: Sellable public/contact path plus approved first-touch copy.',
    'The first approved prospect batch is contacted through the approved channels and each CRM record reflects the actual contact, stage, owner, suppression status, and next action.',
    'Sellable public/contact path plus approved first-touch copy.',
    'https://app.notion.com/p/3ec8037fac7381aaad74c8f3f3ecb4e5',
    'A current Solta Works work item tracked by KP.',
    'This matters because the task is complete only when: The first approved prospect batch is contacted through the approved channels and each CRM record reflects the actual contact, stage, owner, suppression status, and next action.',
    '1. Read the task record and its Finished When condition.
2. Do the next concrete action shown in Do This Next.
3. Update Airtable if the work stage, owner, blocker, or next action changes.
4. Mark Finished only when the Finished When condition is actually met.
',
    'Migrated from current KP Master Tasks in Notion.',
    8,
    null,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  ),
(
    'TASK-026',
    'Run the two-Chat Source of Truth consistency test',
    null,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'todo'::public.task_stage,
    'yes'::public.task_availability,
    'high'::public.task_priority,
    '2026-10-06'::timestamptz,
    'Run the two-Chat Source of Truth consistency test',
    'Poly''s Chat and Keshia''s Chat answer the agreed company-truth questions consistently from the same canonical sources and can see shared updates.',
    null,
    'https://app.notion.com/3f18037fac7381b1a577cc453092b674',
    'A current KP / Shared work item tracked by KP.',
    'This matters because the task is complete only when: Poly''s Chat and Keshia''s Chat answer the agreed company-truth questions consistently from the same canonical sources and can see shared updates.',
    '1. Read the task record and its Finished When condition.
2. Do the next concrete action shown in Do This Next.
3. Update Airtable if the work stage, owner, blocker, or next action changes.
4. Mark Finished only when the Finished When condition is actually met.
',
    'Migrated from current KP Master Tasks in Notion.',
    9,
    null,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  ),
(
    'TASK-027',
    'Finish KP onboarding system for Keshia',
    null,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'working'::public.task_stage,
    'yes'::public.task_availability,
    'critical'::public.task_priority,
    '2026-10-06'::timestamptz,
    'Finish KP onboarding system for Keshia',
    'Source of Truth, roles, shared task/decision systems, access, and tomorrow''s onboarding path are ready to use.',
    null,
    'https://app.notion.com/3f18037fac7381158729edde00697dca',
    'A current KP / Shared work item tracked by KP.',
    'This matters because the task is complete only when: Source of Truth, roles, shared task/decision systems, access, and tomorrow''s onboarding path are ready to use.',
    '1. Read the task record and its Finished When condition.
2. Do the next concrete action shown in Do This Next.
3. Update Airtable if the work stage, owner, blocker, or next action changes.
4. Mark Finished only when the Finished When condition is actually met.
',
    'Migrated from current KP Master Tasks in Notion.',
    10,
    null,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  ),
(
    'TASK-016',
    'Run Solta weekly cybersecurity review once public/live',
    (select id from public.businesses where slug='solta'),
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'todo'::public.task_stage,
    'blocked'::public.task_availability,
    'normal'::public.task_priority,
    null::timestamptz,
    'Resolve the dependency first: Not recurring until the public site / real lead flow is active.',
    'Once Solta is publicly operating or storing real leads, the weekly security/compliance review is active and findings/next actions are recorded.',
    'Not recurring until the public site / real lead flow is active.',
    'https://app.notion.com/p/3ec8037fac73817a9c64ffbe10f3b4bc',
    'A current Solta Works work item tracked by KP.',
    'This matters because the task is complete only when: Once Solta is publicly operating or storing real leads, the weekly security/compliance review is active and findings/next actions are recorded.',
    '1. Read the task record and its Finished When condition.
2. Do the next concrete action shown in Do This Next.
3. Update Airtable if the work stage, owner, blocker, or next action changes.
4. Mark Finished only when the Finished When condition is actually met.
',
    'Migrated from current KP Master Tasks in Notion.',
    11,
    null,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  ),
(
    'TASK-028',
    'NexProviders — parked / no routine execution',
    (select id from public.businesses where slug='nex'),
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'todo'::public.task_stage,
    'parked'::public.task_availability,
    'low'::public.task_priority,
    null::timestamptz,
    'NexProviders — parked / no routine execution',
    'Nex remains preserved and inactive until KP explicitly reactivates it or Solta creates enough capacity to resume.',
    'Intentional portfolio pause — not a blocker to solve.',
    'https://app.notion.com/p/3dd8037fac738191be7ad303b2462b53',
    'A current NexProviders work item tracked by KP.',
    'This matters because the task is complete only when: Nex remains preserved and inactive until KP explicitly reactivates it or Solta creates enough capacity to resume.',
    '1. Read the task record and its Finished When condition.
2. Do the next concrete action shown in Do This Next.
3. Update Airtable if the work stage, owner, blocker, or next action changes.
4. Mark Finished only when the Finished When condition is actually met.
',
    'Visibility record only. Do not surface as work-now.',
    12,
    null,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  ),
(
    'TASK-010',
    'Close Solta minimum external-use business readiness',
    (select id from public.businesses where slug='solta'),
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'todo'::public.task_stage,
    'yes'::public.task_availability,
    'high'::public.task_priority,
    null::timestamptz,
    'Close Solta minimum external-use business readiness',
    'Solta can conduct outreach and accept a first paid engagement with required business/contact/payment basics resolved for the chosen operating model.',
    null,
    'https://app.notion.com/p/3ec8037fac738119bb6ff64785ba5c3d',
    'A current Solta Works work item tracked by KP.',
    'This matters because the task is complete only when: Solta can conduct outreach and accept a first paid engagement with required business/contact/payment basics resolved for the chosen operating model.',
    '1. Read the task record and its Finished When condition.
2. Do the next concrete action shown in Do This Next.
3. Update Airtable if the work stage, owner, blocker, or next action changes.
4. Mark Finished only when the Finished When condition is actually met.
',
    'Migrated from current KP Master Tasks in Notion.',
    13,
    null,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  ),
(
    'TASK-017',
    'Send first Solta scoped proposal / quote',
    (select id from public.businesses where slug='solta'),
    null,
    'todo'::public.task_stage,
    'blocked'::public.task_availability,
    'normal'::public.task_priority,
    null::timestamptz,
    'Assign an owner or resolve the blocker before starting.',
    'A real qualified prospect receives a clear bounded written scope, current price/payment structure, timeline assumptions, revision/change terms, and acceptance next step.',
    null,
    'https://app.notion.com/p/3ec8037fac738193ac9edc6ed56a418e',
    'A current Solta Works work item tracked by KP.',
    'This matters because the task is complete only when: A real qualified prospect receives a clear bounded written scope, current price/payment structure, timeline assumptions, revision/change terms, and acceptance next step.',
    '1. Read the task record and its Finished When condition.
2. Do the next concrete action shown in Do This Next.
3. Update Airtable if the work stage, owner, blocker, or next action changes.
4. Mark Finished only when the Finished When condition is actually met.
',
    'Migrated from current KP Master Tasks in Notion.',
    14,
    null,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  ),
(
    'TASK-023',
    'Turn first Solta client into truthful proof / case study',
    (select id from public.businesses where slug='solta'),
    null,
    'todo'::public.task_stage,
    'blocked'::public.task_availability,
    'normal'::public.task_priority,
    null::timestamptz,
    'Assign an owner or resolve the blocker before starting.',
    'A permissioned truthful proof asset exists, or the client declined and that outcome is recorded without pressure.',
    null,
    'https://app.notion.com/p/3ec8037fac7381b2bfecf5e850b6622d',
    'A current Solta Works work item tracked by KP.',
    'This matters because the task is complete only when: A permissioned truthful proof asset exists, or the client declined and that outcome is recorded without pressure.',
    '1. Read the task record and its Finished When condition.
2. Do the next concrete action shown in Do This Next.
3. Update Airtable if the work stage, owner, blocker, or next action changes.
4. Mark Finished only when the Finished When condition is actually met.
',
    'Migrated from current KP Master Tasks in Notion.',
    15,
    null,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  ),
(
    'TASK-007',
    'Maintain and improve SnD portfolio proof / case studies',
    (select id from public.businesses where slug='snd'),
    null,
    'todo'::public.task_stage,
    'blocked'::public.task_availability,
    'normal'::public.task_priority,
    null::timestamptz,
    'Assign an owner or resolve the blocker before starting.',
    'Current SnD case studies/portfolio assets remain truthful, clearly framed, useful for high-fit opportunities, and updated only when new evidence or learning improves them.',
    null,
    'https://app.notion.com/p/3e08037fac738091a1fad41c7ba271cc',
    'A current Sent & Delivered work item tracked by KP.',
    'This matters because the task is complete only when: Current SnD case studies/portfolio assets remain truthful, clearly framed, useful for high-fit opportunities, and updated only when new evidence or learning improves them.',
    '1. Read the task record and its Finished When condition.
2. Do the next concrete action shown in Do This Next.
3. Update Airtable if the work stage, owner, blocker, or next action changes.
4. Mark Finished only when the Finished When condition is actually met.
',
    'Migrated from current KP Master Tasks in Notion.',
    16,
    null,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  ),
(
    'TASK-012',
    'Review Solta pricing + scope after first client',
    (select id from public.businesses where slug='solta'),
    null,
    'todo'::public.task_stage,
    'blocked'::public.task_availability,
    'normal'::public.task_priority,
    null::timestamptz,
    'Assign an owner or resolve the blocker before starting.',
    'Actual effort, revision load, buyer objections and margin are compared with the current assumptions and any material pricing/scope change is recorded through the KP Decision system.',
    null,
    'https://app.notion.com/p/3ec8037fac7381ae80deed9bc6a93e0d',
    'A current Solta Works work item tracked by KP.',
    'This matters because the task is complete only when: Actual effort, revision load, buyer objections and margin are compared with the current assumptions and any material pricing/scope change is recorded through the KP Decision system.',
    '1. Read the task record and its Finished When condition.
2. Do the next concrete action shown in Do This Next.
3. Update Airtable if the work stage, owner, blocker, or next action changes.
4. Mark Finished only when the Finished When condition is actually met.
',
    'Migrated from current KP Master Tasks in Notion.',
    17,
    null,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  ),
(
    'TASK-004',
    'Build and launch SnD website redesign from approved Design Bible work',
    (select id from public.businesses where slug='snd'),
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'working'::public.task_stage,
    'yes'::public.task_availability,
    'high'::public.task_priority,
    null::timestamptz,
    'Build and launch SnD website redesign from approved Design Bible work',
    'The redesigned SnD public site is implemented in the existing Astro/Astrowind repo, known Figma UI defects are resolved in browser/CSS, responsive and accessibility QA passes, the approved design system replaces legacy visual foundations, Contact/Book/legal flows are verified, second-pass QA is complete, and the production cutover is approved.',
    null,
    'https://app.notion.com/p/3ef8037fac738192a394f05d5bac89ee',
    'A current Sent & Delivered work item tracked by KP.',
    'This matters because the task is complete only when: The redesigned SnD public site is implemented in the existing Astro/Astrowind repo, known Figma UI defects are resolved in browser/CSS, responsive and accessibility QA passes, the approved design system replaces legacy visual foundations, Contact/Book/legal flows are verified, second-pass QA is complete, and the production cutover is approved.',
    '1. Read the task record and its Finished When condition.
2. Do the next concrete action shown in Do This Next.
3. Update Airtable if the work stage, owner, blocker, or next action changes.
4. Mark Finished only when the Finished When condition is actually met.
',
    'Migrated from current KP Master Tasks in Notion.',
    18,
    null,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  ),
(
    'TASK-013',
    'Productionize Solta V1 site after approved Figma design',
    (select id from public.businesses where slug='solta'),
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'todo'::public.task_stage,
    'blocked'::public.task_availability,
    'high'::public.task_priority,
    null::timestamptz,
    'Resolve the dependency first: Approved Figma design/source before implementation.',
    'A production candidate implements the approved design/identity, current small-business messaging, truthful proof, mobile UX, accessibility, and current offer logic.',
    'Approved Figma design/source before implementation.',
    'https://app.notion.com/p/3ec8037fac7381dd9c23c5f92368879d',
    'A current Solta Works work item tracked by KP.',
    'This matters because the task is complete only when: A production candidate implements the approved design/identity, current small-business messaging, truthful proof, mobile UX, accessibility, and current offer logic.',
    '1. Read the task record and its Finished When condition.
2. Do the next concrete action shown in Do This Next.
3. Update Airtable if the work stage, owner, blocker, or next action changes.
4. Mark Finished only when the Finished When condition is actually met.
',
    'Migrated from current KP Master Tasks in Notion.',
    19,
    null,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  ),
(
    'TASK-021',
    'Prepare Solta first-client agreement / SOW + payment flow',
    (select id from public.businesses where slug='solta'),
    null,
    'todo'::public.task_stage,
    'blocked'::public.task_availability,
    'high'::public.task_priority,
    null::timestamptz,
    'Assign an owner or resolve the blocker before starting.',
    'Solta can send a clear scope, price/payment terms, technology/third-party costs, revision/change rules, cancellation/refund terms, IP/hosting responsibility, and acceptance/payment next step for a real first client.',
    null,
    'https://app.notion.com/p/3ec8037fac7381fc9f57eba33acd936e',
    'A current Solta Works work item tracked by KP.',
    'This matters because the task is complete only when: Solta can send a clear scope, price/payment terms, technology/third-party costs, revision/change rules, cancellation/refund terms, IP/hosting responsibility, and acceptance/payment next step for a real first client.',
    '1. Read the task record and its Finished When condition.
2. Do the next concrete action shown in Do This Next.
3. Update Airtable if the work stage, owner, blocker, or next action changes.
4. Mark Finished only when the Finished When condition is actually met.
',
    'Migrated from current KP Master Tasks in Notion.',
    20,
    null,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  ),
(
    'TASK-020',
    'Verify Solta production domain, hosting, inbox, form, analytics and rollback',
    (select id from public.businesses where slug='solta'),
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'todo'::public.task_stage,
    'blocked'::public.task_availability,
    'high'::public.task_priority,
    null::timestamptz,
    'Resolve the dependency first: Production candidate must exist first.',
    'The actual hosted production candidate, domain/DNS, business inbox/contact path, form mapping, analytics behavior, and basic rollback/recovery path are verified.',
    'Production candidate must exist first.',
    'https://app.notion.com/p/3ec8037fac73817ea305d590c6de634e',
    'A current Solta Works work item tracked by KP.',
    'This matters because the task is complete only when: The actual hosted production candidate, domain/DNS, business inbox/contact path, form mapping, analytics behavior, and basic rollback/recovery path are verified.',
    '1. Read the task record and its Finished When condition.
2. Do the next concrete action shown in Do This Next.
3. Update Airtable if the work stage, owner, blocker, or next action changes.
4. Mark Finished only when the Finished When condition is actually met.
',
    'Migrated from current KP Master Tasks in Notion.',
    21,
    null,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  ),
(
    'TASK-006',
    'Maintain SnD security + production baseline',
    (select id from public.businesses where slug='snd'),
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'todo'::public.task_stage,
    'yes'::public.task_availability,
    'normal'::public.task_priority,
    null::timestamptz,
    'Maintain SnD security + production baseline',
    'Necessary SnD site/security/access/production obligations remain healthy without creating an unnecessary new build cycle.',
    null,
    'https://app.notion.com/p/3e98037fac73814bb216f6e031c7a024',
    'A current Sent & Delivered work item tracked by KP.',
    'This matters because the task is complete only when: Necessary SnD site/security/access/production obligations remain healthy without creating an unnecessary new build cycle.',
    '1. Read the task record and its Finished When condition.
2. Do the next concrete action shown in Do This Next.
3. Update Airtable if the work stage, owner, blocker, or next action changes.
4. Mark Finished only when the Finished When condition is actually met.
',
    'Migrated from current KP Master Tasks in Notion.',
    22,
    null,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  ),
(
    'TASK-022',
    'Complete Solta website/demo design in Figma',
    (select id from public.businesses where slug='solta'),
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'working'::public.task_stage,
    'yes'::public.task_availability,
    'high'::public.task_priority,
    null::timestamptz,
    'Complete Solta website/demo design in Figma',
    'The current Solta/demo page designs are complete in Figma, pass QA, and are approved as the build source rather than continuing design decisions in code.',
    null,
    'https://app.notion.com/p/3ec8037fac7381a38c48fe174110f07b',
    'A current Solta Works work item tracked by KP.',
    'This matters because the task is complete only when: The current Solta/demo page designs are complete in Figma, pass QA, and are approved as the build source rather than continuing design decisions in code.',
    '1. Read the task record and its Finished When condition.
2. Do the next concrete action shown in Do This Next.
3. Update Airtable if the work stage, owner, blocker, or next action changes.
4. Mark Finished only when the Finished When condition is actually met.
',
    'Migrated from current KP Master Tasks in Notion.',
    23,
    null,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  ),
(
    'TASK-009',
    'Continue SnD lifecycle learning + testing',
    (select id from public.businesses where slug='snd'),
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'todo'::public.task_stage,
    'yes'::public.task_availability,
    'normal'::public.task_priority,
    null::timestamptz,
    'Continue SnD lifecycle learning + testing',
    'Lifecycle learning/testing produces practical reusable understanding or proof that improves SnD delivery capability and Poly/Keshia''s ability to own lifecycle work.',
    null,
    'https://app.notion.com/p/3e08037fac738091a1fad41c7ba271cc',
    'A current Sent & Delivered work item tracked by KP.',
    'This matters because the task is complete only when: Lifecycle learning/testing produces practical reusable understanding or proof that improves SnD delivery capability and Poly/Keshia''s ability to own lifecycle work.',
    '1. Read the task record and its Finished When condition.
2. Do the next concrete action shown in Do This Next.
3. Update Airtable if the work stage, owner, blocker, or next action changes.
4. Mark Finished only when the Finished When condition is actually met.
',
    'Migrated from current KP Master Tasks in Notion.',
    24,
    null,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  ),
(
    'TASK-018',
    'Implement Solta lead / quote request path',
    (select id from public.businesses where slug='solta'),
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'todo'::public.task_stage,
    'blocked'::public.task_availability,
    'high'::public.task_priority,
    null::timestamptz,
    'Resolve the dependency first: Production site candidate and final public form placement.',
    'A legitimate inquiry can travel from site CTA to stored lead/pipeline record plus owner notification, with validation, spam protection, and safe failure behavior.',
    'Production site candidate and final public form placement.',
    'https://app.notion.com/p/3ec8037fac7381c097e5cae587269bad',
    'A current Solta Works work item tracked by KP.',
    'This matters because the task is complete only when: A legitimate inquiry can travel from site CTA to stored lead/pipeline record plus owner notification, with validation, spam protection, and safe failure behavior.',
    '1. Read the task record and its Finished When condition.
2. Do the next concrete action shown in Do This Next.
3. Update Airtable if the work stage, owner, blocker, or next action changes.
4. Mark Finished only when the Finished When condition is actually met.
',
    'Migrated from current KP Master Tasks in Notion.',
    25,
    null,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  ),
(
    'TASK-003',
    'Create Solta Works business cards',
    (select id from public.businesses where slug='solta'),
    '8311607b-402c-48c9-945b-1a035a08cf2e',
    'todo'::public.task_stage,
    'waiting'::public.task_availability,
    'high'::public.task_priority,
    null::timestamptz,
    'Do nothing on this task yet. Wait for Poly to confirm the final Solta brand standards, business-card contact details, and QR destination.',
    'Produce editable source + print-ready draft using current Solta brand/copy only; Poly reviews before print/order.',
    'Need confirmed card/QR/contact details + current brand standards.',
    null,
    'Create Solta Works business cards for future local/in-person outreach.',
    'The cards can help local prospecting, but designing them before Solta''s branding, contact details, and QR destination are final would create avoidable rework.',
    '1. Do not start designing yet.
2. Wait for Poly to confirm the final branding/contact/QR inputs.
3. Once those inputs are available, ChatGPT should guide the design task step by step using the current brand/copy standards.
4. Poly reviews before anything is ordered or printed.
',
    'Do not invent contact details, claims, pricing, or brand elements.',
    26,
    null,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  ),
(
    'TASK-025',
    'Grant Keshia shared Drive access',
    null,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'todo'::public.task_stage,
    'yes'::public.task_availability,
    'high'::public.task_priority,
    '2026-10-06'::timestamptz,
    'Grant Keshia shared Drive access',
    'Keshia can access the KP — Solta + SnD shared business Drive structure with the permissions needed for current work, without access to Poly''s personal Drive or Nex.',
    null,
    'https://drive.google.com/drive/folders/1rue15wvX9fzqzH8CCxhfJVh9AqenYjtG',
    'A current KP / Shared work item tracked by KP.',
    'This matters because the task is complete only when: Keshia can access the KP — Solta + SnD shared business Drive structure with the permissions needed for current work, without access to Poly''s personal Drive or Nex.',
    '1. Read the task record and its Finished When condition.
2. Do the next concrete action shown in Do This Next.
3. Update Airtable if the work stage, owner, blocker, or next action changes.
4. Mark Finished only when the Finished When condition is actually met.
',
    'Migrated from current KP Master Tasks in Notion.',
    27,
    null,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  )
on conflict (reference_code) where reference_code is not null do update set
  title=excluded.title,
  business_id=excluded.business_id,
  owner_id=excluded.owner_id,
  stage=excluded.stage,
  availability=excluded.availability,
  priority=excluded.priority,
  due_at=excluded.due_at,
  next_action=excluded.next_action,
  finished_when=excluded.finished_when,
  waiting_on=excluded.waiting_on,
  reference_url=excluded.reference_url,
  what_this_is=excluded.what_this_is,
  why_it_matters=excluded.why_it_matters,
  instructions=excluded.instructions,
  notes=excluded.notes,
  position=excluded.position,
  updated_by=excluded.updated_by;

insert into public.opportunities (
  reference_code,name,business_id,pipeline_id,stage_id,organization_id,owner_id,
  source,source_url,priority,amount_cents,currency,next_action,next_action_at,
  position,metadata,created_by,updated_by
)
values
(
    'LEAD-002',
    'Done Right Plumbing',
    (select id from public.businesses where slug='solta'),
    (select p.id from public.pipelines p join public.businesses b on b.id=p.business_id where b.slug='solta' and p.is_default limit 1),
    (select ps.id from public.pipeline_stages ps join public.pipelines p on p.id=ps.pipeline_id join public.businesses b on b.id=p.business_id where b.slug='solta' and p.is_default and ps.slug='qualified' limit 1),
    (select id from public.organizations where lower(name)=lower('Done Right Plumbing') order by created_at limit 1),
    null,
    null,
    null,
    'normal'::public.task_priority,
    null,
    'USD',
    'Review and confirm outreach angle',
    null::timestamptz,
    0,
    '{"observed_problem_outreach_angle":"Imported from pre-shared Notion pipeline; review current website/public evidence before outreach.","outreach_channel":"TBD","do_not_contact":false,"notes":"Migrated from latest shared Google Sheet state.","airtable_stage":"Qualified"}'::jsonb,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  ),
(
    'LEAD-005',
    'Electrician Henderson',
    (select id from public.businesses where slug='solta'),
    (select p.id from public.pipelines p join public.businesses b on b.id=p.business_id where b.slug='solta' and p.is_default limit 1),
    (select ps.id from public.pipeline_stages ps join public.pipelines p on p.id=ps.pipeline_id join public.businesses b on b.id=p.business_id where b.slug='solta' and p.is_default and ps.slug='qualified' limit 1),
    (select id from public.organizations where lower(name)=lower('Electrician Henderson') order by created_at limit 1),
    null,
    null,
    null,
    'normal'::public.task_priority,
    null,
    'USD',
    'Review and confirm outreach angle',
    null::timestamptz,
    1,
    '{"observed_problem_outreach_angle":"Imported from pre-shared Notion pipeline; review current website/public evidence before outreach.","outreach_channel":"TBD","do_not_contact":false,"notes":"Migrated from latest shared Google Sheet state.","airtable_stage":"Qualified"}'::jsonb,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  ),
(
    'LEAD-011',
    'Quality Handyman Services',
    (select id from public.businesses where slug='solta'),
    (select p.id from public.pipelines p join public.businesses b on b.id=p.business_id where b.slug='solta' and p.is_default limit 1),
    (select ps.id from public.pipeline_stages ps join public.pipelines p on p.id=ps.pipeline_id join public.businesses b on b.id=p.business_id where b.slug='solta' and p.is_default and ps.slug='qualified' limit 1),
    (select id from public.organizations where lower(name)=lower('Quality Handyman Services') order by created_at limit 1),
    '8311607b-402c-48c9-945b-1a035a08cf2e',
    null,
    null,
    'normal'::public.task_priority,
    null,
    'USD',
    'Re-check for an owned website, then choose the approved outreach channel. Do not contact yet.',
    null::timestamptz,
    2,
    '{"observed_problem_outreach_angle":"Strong local reputation, but no clear owned website was found in the public results checked. Solta angle: an owned site with clear services and a direct estimate/request path. No outreach has been sent.","outreach_channel":"TBD","do_not_contact":false,"notes":"Migrated from latest shared Google Sheet state.","airtable_stage":"Qualified"}'::jsonb,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  ),
(
    'LEAD-006',
    'WLM Landscape',
    (select id from public.businesses where slug='solta'),
    (select p.id from public.pipelines p join public.businesses b on b.id=p.business_id where b.slug='solta' and p.is_default limit 1),
    (select ps.id from public.pipeline_stages ps join public.pipelines p on p.id=ps.pipeline_id join public.businesses b on b.id=p.business_id where b.slug='solta' and p.is_default and ps.slug='qualified' limit 1),
    (select id from public.organizations where lower(name)=lower('WLM Landscape') order by created_at limit 1),
    null,
    null,
    null,
    'normal'::public.task_priority,
    null,
    'USD',
    'Review and confirm outreach angle',
    null::timestamptz,
    3,
    '{"observed_problem_outreach_angle":"Imported from pre-shared Notion pipeline; review current website/public evidence before outreach.","outreach_channel":"TBD","do_not_contact":false,"notes":"Migrated from latest shared Google Sheet state.","airtable_stage":"Qualified"}'::jsonb,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  ),
(
    'LEAD-003',
    'Energetic Lawn Care & Landscapes',
    (select id from public.businesses where slug='solta'),
    (select p.id from public.pipelines p join public.businesses b on b.id=p.business_id where b.slug='solta' and p.is_default limit 1),
    (select ps.id from public.pipeline_stages ps join public.pipelines p on p.id=ps.pipeline_id join public.businesses b on b.id=p.business_id where b.slug='solta' and p.is_default and ps.slug='qualified' limit 1),
    (select id from public.organizations where lower(name)=lower('Energetic Lawn Care & Landscapes') order by created_at limit 1),
    null,
    null,
    null,
    'normal'::public.task_priority,
    null,
    'USD',
    'Review and confirm outreach angle',
    null::timestamptz,
    4,
    '{"observed_problem_outreach_angle":"Imported from pre-shared Notion pipeline; review current website/public evidence before outreach.","outreach_channel":"TBD","do_not_contact":false,"notes":"Migrated from latest shared Google Sheet state.","airtable_stage":"Qualified"}'::jsonb,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  ),
(
    'LEAD-008',
    'Bristlecone Landscaping & Horticulture',
    (select id from public.businesses where slug='solta'),
    (select p.id from public.pipelines p join public.businesses b on b.id=p.business_id where b.slug='solta' and p.is_default limit 1),
    (select ps.id from public.pipeline_stages ps join public.pipelines p on p.id=ps.pipeline_id join public.businesses b on b.id=p.business_id where b.slug='solta' and p.is_default and ps.slug='qualified' limit 1),
    (select id from public.organizations where lower(name)=lower('Bristlecone Landscaping & Horticulture') order by created_at limit 1),
    null,
    null,
    null,
    'normal'::public.task_priority,
    null,
    'USD',
    'Review and confirm outreach angle',
    null::timestamptz,
    5,
    '{"observed_problem_outreach_angle":"Imported from pre-shared Notion pipeline; review current website/public evidence before outreach.","outreach_channel":"TBD","do_not_contact":false,"notes":"Migrated from latest shared Google Sheet state.","airtable_stage":"Qualified"}'::jsonb,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  ),
(
    'LEAD-004',
    'Service Plus Plumbing',
    (select id from public.businesses where slug='solta'),
    (select p.id from public.pipelines p join public.businesses b on b.id=p.business_id where b.slug='solta' and p.is_default limit 1),
    (select ps.id from public.pipeline_stages ps join public.pipelines p on p.id=ps.pipeline_id join public.businesses b on b.id=p.business_id where b.slug='solta' and p.is_default and ps.slug='qualified' limit 1),
    (select id from public.organizations where lower(name)=lower('Service Plus Plumbing') order by created_at limit 1),
    null,
    null,
    null,
    'normal'::public.task_priority,
    null,
    'USD',
    'Review and confirm outreach angle',
    null::timestamptz,
    6,
    '{"observed_problem_outreach_angle":"Imported from pre-shared Notion pipeline; review current website/public evidence before outreach.","outreach_channel":"TBD","do_not_contact":false,"notes":"Migrated from latest shared Google Sheet state.","airtable_stage":"Qualified"}'::jsonb,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  ),
(
    'LEAD-010',
    'TGJ Painting',
    (select id from public.businesses where slug='solta'),
    (select p.id from public.pipelines p join public.businesses b on b.id=p.business_id where b.slug='solta' and p.is_default limit 1),
    (select ps.id from public.pipeline_stages ps join public.pipelines p on p.id=ps.pipeline_id join public.businesses b on b.id=p.business_id where b.slug='solta' and p.is_default and ps.slug='qualified' limit 1),
    (select id from public.organizations where lower(name)=lower('TGJ Painting') order by created_at limit 1),
    null,
    null,
    null,
    'normal'::public.task_priority,
    null,
    'USD',
    'Review and confirm outreach angle',
    null::timestamptz,
    7,
    '{"observed_problem_outreach_angle":"Imported from pre-shared Notion pipeline; review current website/public evidence before outreach.","outreach_channel":"TBD","do_not_contact":false,"notes":"Migrated from latest shared Google Sheet state.","airtable_stage":"Qualified"}'::jsonb,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  ),
(
    'LEAD-007',
    'King Roofing',
    (select id from public.businesses where slug='solta'),
    (select p.id from public.pipelines p join public.businesses b on b.id=p.business_id where b.slug='solta' and p.is_default limit 1),
    (select ps.id from public.pipeline_stages ps join public.pipelines p on p.id=ps.pipeline_id join public.businesses b on b.id=p.business_id where b.slug='solta' and p.is_default and ps.slug='qualified' limit 1),
    (select id from public.organizations where lower(name)=lower('King Roofing') order by created_at limit 1),
    null,
    null,
    null,
    'normal'::public.task_priority,
    null,
    'USD',
    'Review and confirm outreach angle',
    null::timestamptz,
    8,
    '{"observed_problem_outreach_angle":"Imported from pre-shared Notion pipeline; review current website/public evidence before outreach.","outreach_channel":"TBD","do_not_contact":false,"notes":"Migrated from latest shared Google Sheet state.","airtable_stage":"Qualified"}'::jsonb,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  ),
(
    'LEAD-009',
    'McMillan & McMillan Painting Contractors',
    (select id from public.businesses where slug='solta'),
    (select p.id from public.pipelines p join public.businesses b on b.id=p.business_id where b.slug='solta' and p.is_default limit 1),
    (select ps.id from public.pipeline_stages ps join public.pipelines p on p.id=ps.pipeline_id join public.businesses b on b.id=p.business_id where b.slug='solta' and p.is_default and ps.slug='qualified' limit 1),
    (select id from public.organizations where lower(name)=lower('McMillan & McMillan Painting Contractors') order by created_at limit 1),
    null,
    null,
    null,
    'normal'::public.task_priority,
    null,
    'USD',
    'Review and confirm outreach angle',
    null::timestamptz,
    9,
    '{"observed_problem_outreach_angle":"Imported from pre-shared Notion pipeline; review current website/public evidence before outreach.","outreach_channel":"TBD","do_not_contact":false,"notes":"Migrated from latest shared Google Sheet state.","airtable_stage":"Qualified"}'::jsonb,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  ),
(
    'LEAD-001',
    'All State Roofing',
    (select id from public.businesses where slug='solta'),
    (select p.id from public.pipelines p join public.businesses b on b.id=p.business_id where b.slug='solta' and p.is_default limit 1),
    (select ps.id from public.pipeline_stages ps join public.pipelines p on p.id=ps.pipeline_id join public.businesses b on b.id=p.business_id where b.slug='solta' and p.is_default and ps.slug='qualified' limit 1),
    (select id from public.organizations where lower(name)=lower('All State Roofing') order by created_at limit 1),
    null,
    null,
    null,
    'normal'::public.task_priority,
    null,
    'USD',
    'Review and confirm outreach angle',
    null::timestamptz,
    10,
    '{"observed_problem_outreach_angle":"Imported from pre-shared Notion pipeline; review current website/public evidence before outreach.","outreach_channel":"TBD","do_not_contact":false,"notes":"Migrated from latest shared Google Sheet state.","airtable_stage":"Qualified"}'::jsonb,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  ),
(
    'OPP-001',
    'Etextbook Sales Funnel Evaluation Management',
    (select id from public.businesses where slug='snd'),
    (select p.id from public.pipelines p join public.businesses b on b.id=p.business_id where b.slug='snd' and p.is_default limit 1),
    (select ps.id from public.pipeline_stages ps join public.pipelines p on p.id=ps.pipeline_id join public.businesses b on b.id=p.business_id where b.slug='snd' and p.is_default and ps.slug='applied' limit 1),
    (select id from public.organizations where lower(name)=lower('Etextbook client (Upwork)') order by created_at limit 1),
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'Upwork',
    'https://www.upwork.com/jobs/~022102435157242539276',
    'normal'::public.task_priority,
    null,
    'USD',
    'Wait for client response. No follow-up unless the client opens a conversation.',
    null::timestamptz,
    0,
    '{"fit":"Strong","connects_cost":11,"platform_tools":"Brevo + website/funnel analytics","proof_requirement":"Demonstrate email/funnel diagnosis, segmentation, QA, tracking verification, and prioritized recommendations without claiming textbook-sales expertise.","fit_assessment":"Good diagnostic fit: trace delivered → clicked → site visit → faculty/product path → checkout/adoption action; identify whether the failure is targeting, message, click-through, landing experience, offer, checkout, tracking, or a combination.","red_flags":"Do not promise a redesign before diagnosis; opens alone are not evidence the email is working.","proposal_draft":"\n","screening_answers":"\n","submission_owner":"Poly","submission_notes":"Submitted by Poly from Poly''s Upwork account on September 30, 2026.","last_activity":"2026-09-30","airtable_stage":"Applied"}'::jsonb,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  ),
(
    'OPP-002',
    'Email Marketing Strategist — 7 Location Dance Studio',
    (select id from public.businesses where slug='snd'),
    (select p.id from public.pipelines p join public.businesses b on b.id=p.business_id where b.slug='snd' and p.is_default limit 1),
    (select ps.id from public.pipeline_stages ps join public.pipelines p on p.id=ps.pipeline_id join public.businesses b on b.id=p.business_id where b.slug='snd' and p.is_default and ps.slug='applied' limit 1),
    (select id from public.organizations where lower(name)=lower('7-location dance studio (Upwork client)') order by created_at limit 1),
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'Upwork',
    'https://www.upwork.com/jobs/~022104679729056847183',
    'high'::public.task_priority,
    null,
    'USD',
    'Wait for client response. Do not send an Upwork follow-up unless the platform/client opens a conversation.',
    null::timestamptz,
    1,
    '{"fit":"Strong","budget_rate":"$60–$90/hr; submitted at $75/hr","connects_cost":22,"platform_tools":"Kit + GoHighLevel","proof_requirement":"Lifecycle/journey examples and results if shareable; use Activation, Win-back, and Segmentation case studies without inventing client metrics or deep Kit/GHL expertise.","fit_assessment":"Strong lifecycle fit: journey mapping, onboarding, behavior-triggered automation, re-engagement, segmentation, milestone/event messaging, and measurement. Client explicitly values thinking over exact platform background.","red_flags":"Do not imply deep GoHighLevel/Kit implementation history or fabricated performance results.","proposal_draft":"\n","screening_answers":"\n","submission_owner":"Poly","submission_notes":"Submitted by Poly from Poly''s Upwork account on September 30, 2026.","last_activity":"2026-09-30","airtable_stage":"Applied"}'::jsonb,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  )
on conflict (reference_code) where reference_code is not null do update set
  name=excluded.name,
  business_id=excluded.business_id,
  pipeline_id=excluded.pipeline_id,
  stage_id=excluded.stage_id,
  organization_id=excluded.organization_id,
  owner_id=excluded.owner_id,
  source=excluded.source,
  source_url=excluded.source_url,
  priority=excluded.priority,
  amount_cents=excluded.amount_cents,
  currency=excluded.currency,
  next_action=excluded.next_action,
  next_action_at=excluded.next_action_at,
  position=excluded.position,
  metadata=excluded.metadata,
  updated_by=excluded.updated_by;



insert into public.decisions (
  reference_code,business_id,title,domain,mode,owner_id,status,priority,needed_by,
  context,recommendation,final_decision,effective_date,revisit_trigger,resolved_at,
  created_by,updated_by
)
values
(
    'DEC-001',
    null,
    'Choose recurring KP weekly meeting day/time',
    'Operations',
    'joint'::public.decision_mode,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'open'::public.decision_status,
    'normal'::public.task_priority,
    '2026-10-06'::date,
    'The KP Weekly Meeting SOP is approved, but Poly and Keshia have not yet chosen the recurring weekday/time. Decide this during onboarding, then create the recurring Google Calendar event.',
    'Choose a reliable 60-minute weekly slot both people can protect. Keep ordinary task work in Notion rather than turning the meeting into a work session.',
    null,
    null::date,
    null,
    null,
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee',
    'ac88eaa6-a08e-422c-b594-b92cfabdd7ee'
  )
on conflict (reference_code) where reference_code is not null do update set
  business_id=excluded.business_id,
  title=excluded.title,
  domain=excluded.domain,
  mode=excluded.mode,
  owner_id=excluded.owner_id,
  status=excluded.status,
  priority=excluded.priority,
  needed_by=excluded.needed_by,
  context=excluded.context,
  recommendation=excluded.recommendation,
  final_decision=excluded.final_decision,
  effective_date=excluded.effective_date,
  revisit_trigger=excluded.revisit_trigger,
  updated_by=excluded.updated_by;

insert into public.external_links (
  entity_type,entity_id,source_system,external_record_id,sync_direction,sync_status
)
select 'task'::public.integration_entity_type,t.id,'airtable-kp-operations',m.airtable_record_id,'inbound','disabled'
from public.tasks t
join (values
('TASK-011','rec2Br5Ej6nSAhllW'),
('TASK-002','rec3SyNMzZnlLQrjL'),
('TASK-001','rec5JckKaQ9YaNQWg'),
('TASK-008','rec5Z6H3cTQwDrgB1'),
('TASK-005','recBviPPDF8yliY0D'),
('TASK-019','recCrtveztTh4ylXS'),
('TASK-024','recGsq0OsZxQ1opih'),
('TASK-014','recHPH5brYA6ZEQi8'),
('TASK-015','recHpUpNdewU10Cfh'),
('TASK-026','recN56IDOpZGcmU5C'),
('TASK-027','recPBORRzTVVNZaf6'),
('TASK-016','recWWFC0EIBILIrj1'),
('TASK-028','recX8luGRVhySJBz4'),
('TASK-010','recXbiqmF6IYYxWQn'),
('TASK-017','recZzWBobV4A1WEbF'),
('TASK-023','recbqJCd18VfdYPB0'),
('TASK-007','rechYoz7YDBjYP03z'),
('TASK-012','rechikvfQZQb0EoE8'),
('TASK-004','recm2ocnrtFs1vBHQ'),
('TASK-013','recmK5sZJB0qERYEM'),
('TASK-021','recnXaF0YSF7rZdh8'),
('TASK-020','recoUoQxKx9akGnyb'),
('TASK-006','recqc7cWgJTaYl7uB'),
('TASK-022','recsLm7nxjsC8ZhzD'),
('TASK-009','rectVFItxzh9jAEnt'),
('TASK-018','recweLU7CUVXasC5W'),
('TASK-003','recxs5nACBJpwaCmz'),
('TASK-025','recyaysDS3euFl8pj')
) as m(reference_code,airtable_record_id) on m.reference_code=t.reference_code
on conflict (source_system,entity_type,external_record_id) do update
set entity_id=excluded.entity_id,sync_status='disabled';

insert into public.external_links (
  entity_type,entity_id,source_system,external_record_id,sync_direction,sync_status
)
select 'opportunity'::public.integration_entity_type,o.id,'airtable-kp-operations',m.airtable_record_id,'inbound','disabled'
from public.opportunities o
join (values
('LEAD-002','rec18oeCyOIU4eVno'),
('LEAD-005','rec5zETJXReNzXtug'),
('LEAD-011','recCyVhBj8fFC4Xoo'),
('LEAD-006','recDuF8lbmoQODBF9'),
('LEAD-003','recJ3VKFyIdBTUubw'),
('LEAD-008','recJIgFTgz38k36fR'),
('LEAD-004','recNjO1svYhZ7qOwo'),
('LEAD-010','recSaoLvA61V4JMft'),
('LEAD-007','recVrv77TeOOx5k3B'),
('LEAD-009','recWCM5Lyz75lSv7k'),
('LEAD-001','reckTMtOmakwnatK9'),
('OPP-001','rec8MsHla8GThUS4K'),
('OPP-002','recfpRqB45QrnkBAo')
) as m(reference_code,airtable_record_id) on m.reference_code=o.reference_code
on conflict (source_system,entity_type,external_record_id) do update
set entity_id=excluded.entity_id,sync_status='disabled';

insert into public.external_links (
  entity_type,entity_id,source_system,external_record_id,sync_direction,sync_status
)
select 'decision'::public.integration_entity_type,d.id,'airtable-kp-operations',m.airtable_record_id,'inbound','disabled'
from public.decisions d
join (values
('DEC-001','recX6cFSMq5ENIZpA')
) as m(reference_code,airtable_record_id) on m.reference_code=d.reference_code
on conflict (source_system,entity_type,external_record_id) do update
set entity_id=excluded.entity_id,sync_status='disabled';

commit;
