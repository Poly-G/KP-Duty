# CRM columns

Active KP staff can add open columns and drag column handles left or right on every business CRM board. Keyboard users can focus a column handle, press Space, use arrow keys, and press Space to drop (Escape cancels). Card dragging remains separate. Nex-linked provider cards retain their existing source-controlled stage rules.

Column order is shared, persisted in `pipeline_stages.position`, and used by the board and stage pickers. Existing stage IDs, slugs, kinds and lead associations are unchanged. New columns append to the right. Custom open-column names can be edited by clicking their heading or pencil icon. Built-in names show a lock and are rejected by the rename operation. Renaming preserves IDs, slugs, kinds, positions and cards, and rejects stale edits. Removing columns is outside this change.

Apply `20261019194700_crm_custom_columns.sql` and `20261019195648_crm_column_names.sql` **before deploying the UI**. The existing direct-write policies remain unchanged. Private, narrowly scoped helpers check active membership and lock the pipeline row for creation/reordering; public wrappers run as the invoker. Only column creation and position updates are exposed. Creation uses a stable UUID for retries; reordering validates exact pipeline membership and detects stale order snapshots. Archived pipelines are rejected.

Validation: `node tests/database/crm-columns.mjs` (also part of `npm test`), typecheck, lint and production build.
