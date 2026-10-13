# Solta client upload policy — October 13, 2026

Solta direct client uploads use a 50 MiB (52,428,800 byte) limit and accept PDF, PNG, JPEG, HEIC/HEIF, DOCX/XLSX/PPTX, static SVG, UTF-8 text and CSV. The receiver validates stored bytes and SHA-256 before making a file ready. Active SVG (including XML namespace prefixes), external resources, animation, mislabeled Office archives and oversized files are rejected. Downloads remain private attachments. KP staff server-action uploads retain 20 MiB.

Live migration solta_upload_policy_50mb, version 20261013033604, aligns the portal constraints and private kp-project-files bucket. Access grants, RLS, project mappings and Drive activation flags are unchanged.

Validation passed: both production builds and TypeScript, 45 KP unit tests, 21 isolated collaboration checks and 32 frontend backend tests. Every supported MIME type was reserved at the exact 50 MiB boundary through the isolated real database RPC; larger and unsupported files were rejected. Actual PDF/SVG/DOCX/XLSX/PPTX fixtures passed both byte validators. Security advisor findings were unchanged.

The owner approved the final SVG guard releases. KP commit 106aad25419d59c727a46924abb63a47861ec99f is Ready and Current in production, deployment He6EXLyqc96FLKrpcJPArv5sWQuM (kp-duty-68vadnnyc-solta2.vercel.app), assigned to kp-duty.vercel.app. Frontend dcae657 is Ready and Current on www.soltaworks.com, deployment JAT5zA1vC2dJd3Nu2hmUH1DaSqhR. Final unsigned receiver POST returns 401; the authenticated project still displays existing files and private Download controls.

Hosted uploads are verified ready for solta-qa-50mb.pdf (52,428,800 bytes), solta-qa-static.svg (116 bytes), and solta-qa-workbook.xlsx (1,387 bytes). The PDF was downloaded through the ordinary authenticated portal and its original SHA-256 matches: 86f7eb6f9064dd2e143fb7d364b0a71e46dcaedd7dddcf07eb819917f0b082b9. The SVG download also matches its recorded SHA-256. No duplicate upload was created for read-back checks. DOCX/PPTX format checks were local.

Hosted public QA completed at actual 1439 and 390 CSS pixels across 38 routes, with 76 captures, 380 layout checks and 148 metadata checks, zero failures. Authenticated overview, project, payments, account and help were independently checked at actual 320, 390 and 430 CSS pixels; no overflow, offscreen controls or visible buttons/navigation targets below 44 pixels were found. Project preview retained member approval restrictions. Device mode was closed and normal desktop viewport restored.

Owner-authorized live quote and sandbox checkout both reached the business inbox. Stripe clearly showed a synthetic test deposit; no real money was paid. Preview checkout uses its immutable deployment URL, so a later production rebuild cannot redirect a test session to production keys. Details and evidence are in the frontend report and qa/october-12 artifacts.
