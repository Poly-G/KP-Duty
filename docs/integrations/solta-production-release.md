# Focused Solta production connector

Prepared from KP's deployed commit `daa36d54b3d364e434aba2d8001a1bca3a6363c1`. This release adds only the signed Solta receiver, its machine-route exception, validated HEIC/HEIF/DOCX support and regression tests. It excludes unrelated unreleased changes from current main. Both included SQL migrations are already applied to the confirmed KP project `yurkyxjhxvtivdrbcjuc`; do not apply them again.

The receiver stays closed unless Production `SOLTA_PORTAL_RECEIVER_ENABLED=true`, `SOLTA_PORTAL_SHARED_SECRET` and `KP_INTEGRATION_SUPABASE_SECRET` are configured. The latter credential stays exclusively in KP. Project access is restricted by the existing exact Solta company/project/portal mapping; only the synthetic pilot mapping is currently enabled. Staff authentication stays on all other routes.

Local validation: signed receiver regression; read-boundary database suite; 21 collaboration database checks; TypeScript; scoped lint; complete Next.js production build with placeholder public settings. No live database mutation, email or payment is performed by these checks.

Deployment activation must explicitly authorize live Solta-to-KP access. If Vercel protection blocks the server request, configure only mettlesite Production as the trusted source for kp-duty Production. Preserve staff login and protected Preview deployments. After activation, verify real authenticated sample-project reads, origin/session/company denial, persistent collaboration and private file access. Do not equate configuration with verified connectivity.

This branch is a deployment snapshot, not a replacement for current main. The broader bridge PR remains separate; future main releases should include the bridge without reverting newer main work. Automatic Git deployment is disabled in this production snapshot, matching the existing deployed configuration.
