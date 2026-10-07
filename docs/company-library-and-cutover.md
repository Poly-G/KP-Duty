# Company Library and October 7 cutover
KP Duty is the working home for company knowledge, approved processes and shared operations. Notion is a frozen migration snapshot/provenance source, not an automatically synchronized backup. Drive holds file artifacts and Bitwarden holds credentials.

## Library
Active members can read current guides and search titles. Research, drafts and history are excluded from the default list and can be revealed explicitly. Admins can create/edit guides; each edit keeps an immutable previous revision, and a stale revision cannot overwrite a newer edit. Approved company rules should be published only after actual owner approval. Team members submit proposed changes through Requests.

Site Tools expose get_company_knowledge, get_knowledge_document and save_knowledge_document. Long document reads return 20,000-character parts with nextOffset and optional section lookup.

## Reconciliation
- 33 Notion task records mapped without duplicating the 27 already present. Six missing tasks/history records added; the separate parked Nex placeholder stays intact, producing 34 tasks.
- Five completed tasks: SnD public-site v2, shared Drive access, Bitwarden setup, and the two historical pre-KP task reconciliations.
- Existing KP owners and richer Airtable-era instructions were preserved rather than overwritten by older unassigned Notion rows.
- Bible delivery now waits on rewriting the standards. Notion-access requirements became actual KP sign-in/ChatGPT acceptance.
- Six uncommitted/future tasks are parked, not actionable blockers.
- Seven original decisions retained/mapped; the obsolete Notion-as-live-OS choice is superseded. Two further records capture the user-approved KP cutover and the unresolved Solta copy/hour decision.
- 13 commercial opportunities preserved: 11 Solta prospects and 2 already-applied SnD jobs. Ten Notion prospect records restore public contact details/research lost in the earlier import. Their evidence is dated October 1 and marked for recheck before outreach. Quality Handyman's newer extra prospect is preserved.
- 100 reference documents: 35 current guides (including 8 approved SOPs), 47 draft Signal Radar research records, and 18 historical references/journals.
- Two project summaries: Solta sellable V1 active; SnD site v2 complete. Nex stays parked.
- Shared business material only; no private PM content or private ChatGPT histories imported.

## Backup and recovery
Admins can download a fresh JSON company export from Library. It paginates visible company tables and includes document revision history, IDs, source mappings and profiles without credentials. Messages remain subject to participant access. Notion retains the original reference snapshots; it will not automatically receive later KP edits. Restore should be reviewed by an admin and preserve IDs, links, ordering and approval states, rather than blindly re-running historical imports.

Detailed before snapshots, source documents, import payloads and guarded reconciliation SQL are saved in the parent workspace audit directory. They contain business reference material and are deliberately not committed into the repository.

## Verification
Typecheck, lint, production build and existing tests pass. Transactional database tests in supabase/tests/knowledge.sql prove admin edits, previous-version retention, stale-edit rejection, member read-only access, anonymous/nonmember isolation and immutable history; they roll back all fixtures. Live UI/Site Tool verification must follow deployment.

Keshia's actual browser/ChatGPT read/write and two-person Inbox acceptance remain to be performed using her own account. Database permission tests do not prove her browser/session integration.

