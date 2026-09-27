# Admin Portal Supabase Auth

## Contract

- Login uses email/password against Supabase Auth, not `ADMIN_PASSWORD`.
- Every protected API validates the access token with Auth `getUser`, then
  reads `public.admin_portal_members` using a separate server-only client.
- Only a confirmed-email user with a matching active membership is authorized.
  Neither `user_metadata`, client actor names nor seller membership grants Admin.
- Audit actors use the verified Auth user UUID; the UI displays the email.
- CMS publication, temple management, activity management, analytics reads,
  media signing and the commerce administrator path use this same guard.
- Public CMS reads and public analytics ingestion retain their existing contract.

## Session Lifecycle

The initial `/admin/` HTML contains only a neutral session-check screen, never
the Dashboard or its navigation. The browser keeps this screen while checking
`GET /api/admin/session` and constructs the Admin shell only after success.
Signed-out, revoked and unavailable sessions show the login/error screen without
mounting the Dashboard. This is a presentation gate; API authorization remains
the security boundary. No-JavaScript visits show an explicit enable-JavaScript note.

The browser receives HttpOnly, SameSite=Strict cookies. Hosted environments use
Secure cookies. Tokens and keys are never returned in login JSON or put in browser
localStorage. Access/refresh cookies have a 12-hour sliding browser lifetime.
After access-token expiry, the server refreshes through Supabase, checks membership
again and rotates cookies. Invalid/revoked sessions fail closed. Auth or membership
outages return 503 without discarding recoverable cookies.

Logout revokes the current Supabase session's refresh credentials and clears both
cookies plus the legacy cookie. Like standard Supabase JWT sessions, a separately
copied access token can remain valid until its expiry; logout is not a global
instant JWT blacklist. Deactivating membership blocks subsequent Admin API calls
even while an access token is still valid. No positive membership cache is used.

Old `mw_admin_session` cookies and the old shared password cannot authorize any
deployed Admin or commerce API. `ADMIN_SESSION_SECRET` is no longer the production
Admin identity source. Remove obsolete environment variables only after successful
live login verification and a reviewed rollback plan.

## Configuration And Migration

Server environment:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` or existing `SUPABASE_ANON_KEY`
- `SUPABASE_SECRET_KEY` or existing `SUPABASE_SERVICE_ROLE_KEY`

The frontend needs no new environment variables. Never publish the secret/service
key. All three settings must refer to the same Supabase project.

Migration: `supabase/migrations/20260921000000_admin_portal_members.sql`.
The owner already created this table and provisioned two accounts manually in the
Dashboard. The migration is idempotent, contains no user IDs and does not enable,
remove or overwrite existing memberships. Do not seed over the owner's rows.

Membership changes are performed through the authorized Supabase Dashboard/SQL
Editor. Client roles have no direct access; the server role has SELECT only.
Set `is_active=false` to revoke portal access. Do not change the Auth user's
Postgres role to `service_role`.

This implementation does not add self-registration, invitation, password recovery,
MFA enrollment or a user-management CRUD screen. Existing users sign in with their
confirmed email/password. Recovery, SMTP and MFA are separate rollout decisions.

## Isolated Testing

`tests/runtime/admin-auth.test.mjs` exercises the real API handlers and SDK against
a local mock Supabase HTTP boundary, plus PostgreSQL grant/RLS tests in PGlite.
`tests/e2e/admin-auth.spec.ts` uses the same real login handlers, a mock Auth
provider and a disposable CMS fixture. This is not evidence of live Supabase login.
`tests/e2e/admin-loading.spec.ts` guards initial HTML, slow session checks, denied
and unavailable sessions, and authorized reloads on desktop/mobile. It observes
DOM mutations so an intermediate Dashboard flash cannot pass a final-state check.

Existing activities/commerce previews may explicitly enable
`MONGKOLWELA_ADMIN_PREVIEW=1` with password `admin`. This adapter requires a
loopback peer, no Supabase credentials, no Vercel markers and non-production mode.
Its signed cookie is marked `local-preview:admin`. It is only for testing unrelated
local domain flows and is never used by the Auth acceptance tests.

## Rollout Gate

1. Check the migration and environment in the intended environment.
2. Run targeted Auth, CMS persistence, activities and commerce tests.
3. Check email login/error/logout UI on desktop and mobile.
4. On an isolated deployed preview, the owner signs in without sharing a password.
5. Verify authorized access, non-member denial, membership revocation, refresh and
   logout against real Supabase before switching production.
6. Deploy only this worktree's reviewed diff; do not include other pending work.
7. Verify production login before retiring the old environment variables.

Rollback must not restore a known-compromised shared password. Prefer a fix-forward
or temporarily unavailable Admin over reopening the legacy authentication path.
