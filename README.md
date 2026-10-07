# KP Duty

KP Duty is the shared operating system for KP (Poly + Keshia).

## Current build gate

**Gate A — Foundation**

The current foundation includes:

- Next.js + React + TypeScript
- Tailwind / shadcn-compatible component structure
- dedicated Supabase configuration
- invite-only magic-link login flow
- separate Poly + Keshia application identities
- `admin` and `team_member` technical roles
- RLS enabled from the first migration
- Solta / SnD / Nex business registry
- responsive protected shell
- Home / Work / CRM / Projects / Decisions navigation
- GitHub Actions typecheck/lint/build validation

Airtable remains the live KP operational source until KP Duty reaches migration + two-user QA.

## Reuse before rebuild

KP Duty checks three sources before building cross-cutting functionality:

- **SnD** — proven internal operations behavior
- **Atomic CRM** — MIT-licensed CRM plumbing and MCP implementation
- **Internal AI System** — security/integration/audit invariants

See [docs/reuse-audit.md](docs/reuse-audit.md) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Free-tier stack

- GitHub
- Vercel Hobby
- Supabase Free
- Google Drive for files
- Bitwarden for credentials

## Environment

Copy `.env.example` to `.env.local` and supply:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Then:

```bash
npm install
npm run dev
```

## Supabase

Apply migrations under `supabase/migrations/` to the dedicated KP Duty project.

The login action uses `shouldCreateUser: false`, so unknown emails cannot create accounts through KP Duty. Public signups should also be disabled in Supabase Auth.

Invite Poly and Keshia as separate auth users.

After Poly's auth user exists, bootstrap Poly's technical admin role once:

```sql
update public.profiles
set role = 'admin'
where id = (
  select id
  from auth.users
  where email = 'POLY_LOGIN_EMAIL'
);
```

Keshia remains `team_member` initially.

The technical role controls system administration only; it does not redefine KP's real-world decision authority.

## Gate A exit

Gate A passes after:

- dedicated KP Duty Supabase project is visible/attached
- migration applies cleanly
- Poly signs in independently
- Keshia signs in independently
- unauthenticated access redirects to login
- disabled users are denied
- RLS denies unauthorized access
- both users see the shared shell
- CI passes
