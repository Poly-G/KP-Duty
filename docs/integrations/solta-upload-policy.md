# Solta client upload policy — October 12, 2026

Solta's direct client uploads now use a 50 MiB (52,428,800 byte) limit and accept PDF, PNG, JPEG, HEIC/HEIF, DOCX/XLSX/PPTX, static SVG, UTF-8 text and CSV. The receiver validates stored bytes and SHA-256 before making a file ready. Active SVG, external resources, animation, mislabeled Office archives and oversized files are rejected. Download responses remain private attachments. KP's separate staff server-action upload path retains its existing 20 MiB limit.

The live KP database migration `solta_upload_policy_50mb` was applied as version `20261013033604`. Follow-up reads confirm both portal table constraints and the private `kp-project-files` bucket use the expanded policy. No grants, RLS policies, project mappings or Drive activation flags were changed.

Validation: production build with Webpack and TypeScript passed; 44 unit tests passed; 21 isolated collaboration checks passed; the new policy test also reserves every supported MIME type at the exact 50 MiB boundary through the real database RPC and rejects larger and unsupported uploads. Solta's four client file-validation tests passed. Security advisor findings were present before this migration; service-only Drive/payment tables deliberately deny browser access.

Backend code deployment and hosted upload verification are pending. Chrome automation was blocked by an open extension panel; the owner was asked to close it. The database policy alone does not complete the rollout: the deployed receiver must use this code before larger/new-format uploads work.
