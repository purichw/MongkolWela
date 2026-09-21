# Commerce, Merit Reservations And Donation Links

## Delivery Plan (2026-09-20)

- [x] Private transactional store, tenant authorization and audit trail.
- [x] Organizations, products/variants, stock, carts and order requests.
- [x] Fund-unit reservations and lead-host applications, with separate receipt confirmation.
- [x] Reviewed external e-Donation channels and temple-page integration.
- [x] Seller/administrator console and public desktop/mobile journeys.
- [x] Targeted runtime, database, browser and snapshot verification.

The owner has no payment gateway yet and explicitly requested preparation only.
No real charges, payout routing, automatic payment confirmation or tax receipts
will be enabled. Order requests are not completed purchases. Confirming an order
reserves stock temporarily; fulfilling it requires a verified payment integration
which is deliberately unavailable in this version. Donations always leave the
site for a reviewed recipient channel. Clicking that link does not confirm money.

## Boundaries

- Organizations may be the platform, a temple or an independent shop.
- Platform administrators approve organizations, temple associations and donation
  destinations. Seller membership is checked server-side on every request.
- Seller identity uses Supabase Auth. Local preview credentials exist only in an
  explicitly isolated, non-Vercel preview, never in a deployed runtime.
- A public basket has one seller per order. Server-side prices are authoritative;
  order lines preserve historical price, seller and fulfillment identity.
- Product rows represent independently stocked variants (SKU/material/size).
- Order requests do not reserve stock. Seller acceptance atomically reserves it
  for 24 hours; expired/cancelled requests do not reduce available inventory.
- Fund reservations hold units for 24 hours. Lead-host requests require explicit
  organizer approval and only one approved host is allowed per campaign.
- Reservation confirmation, donation receipt and e-Donation registration are
  separate facts. Only the organizer can acknowledge receipt, with a reference.
- Guest records require an unguessable access secret, stored hashed server-side.
  Customer names, contacts and addresses never appear in public catalog responses.
- Donation destinations are drafts until a platform administrator reviews the
  recipient, temple identity, source and date. Any seller edit clears approval.
- The RD directory is a verification source, not a universal donation checkout.
  No guessed QR codes, recipient mappings or claims of tax deductibility.

## Release Scope

The owner subsequently authorized a push and deployment of this chat's work
only on 2026-09-20. Release preparation uses an isolated worktree at baseline
`10b64a2`, excluding concurrent homepage, calendar and PDPA-style changes.
No production migration, production seed, live CMS publication, real payment,
email invitation or external account configuration is authorized by this
deployment. Commerce remains disabled in production.

## Acceptance Matrix

| Surface | Required proof | Priority |
| --- | --- | --- |
| Authorization | Anonymous denied; seller cannot read/write another organization; suspended member denied | P0 |
| Storage | Version conflicts; atomic capacity/stock reservations; private RLS; source outage fails closed | P0 |
| Orders | Server prices, single seller, idempotency, expiry, cancellation, payment gate | P0 |
| Merit | No overbooking; host approval; receipt separate from booking; private donor data | P0 |
| Donation links | Only reviewed destinations; edit invalidates approval; lookup is not payment | P0 |
| UI | Persist/reload, failure retains input, keyboard controls, no mobile overflow | P1 |
| Freshness | No-store APIs; refresh catalog; submit revalidates current version | P1 |

Payment-provider selection, merchant onboarding, refund/chargeback contracts,
privacy/retention policy and reviewed real seller/temple data remain release gates.

## Routes And Ownership

| Surface | Owner |
| --- | --- |
| `/shop/`, `?product=<id>`, `?view=cart` | `src/scripts/commerce-public.js` |
| `/merit/`, `?campaign=<id>` | Same public controller |
| Private request tracking | Same routes, secret in URL fragment, never a query parameter |
| `/seller/` and platform Admin sidebar link | `src/scripts/commerce-console.js` |
| Temple detail section | `src/components/TempleCommerce.astro`, `src/scripts/temple-commerce.js` |
| HTTP API, session | `/api/commerce`, `/api/commerce/session` |
| Validation and permissions | `api/commerce/_domain.js`, `_auth.js` |
| Persistence and compare-and-swap retry | `api/commerce/_store.js` |
| Database schema and private RPCs | `supabase/migrations/20260920000000_commerce_and_merit.sql` |

New routes are `noindex` during preparation. The shared header's CMS-managed
commerce group links to `/shop/` and `/merit/`. Temple detail pages expose the
same catalog, filtered by temple ID, immediately after activities. `CommerceNav`
is shared by both public routes. Navigation visibility does not enable commerce.

## Database And Security

The migration is additive and has NOT been applied to any remote project.
It creates private `commerce_organizations`, `commerce_members`,
`commerce_products`, `commerce_campaigns`, `commerce_channels`,
`commerce_orders`, `commerce_bookings`, plus revision and audit tables.
It never edits `cms_documents`, temple datasets or existing Admin content.

All tables use RLS with no anonymous/authenticated direct-table access. Only the
server service role can call the snapshot/commit RPCs. Each request reads a
consistent snapshot, validates ownership and business rules, then commits
against a locked revision. Conflicts revalidate and retry up to four times.
Row versions prevent silently overwriting a changed seller record.

The audit records actor, operation, affected IDs and selected before/after
financial/publication fields, including donation destinations and recipient
identity. Customer names, addresses, contacts and guest secrets are excluded.
Service-role access cannot update/delete audit rows through ordinary grants;
the database owner remains privileged. Audit inspection currently uses database
queries, not an additional console tab.

Public APIs return whitelisted fields only. Seller reads filter every table by
active memberships. Revoked temple associations block public visibility, new
requests and later acceptance. A changed price OR seller/shipping revision makes
the customer review the quote again while retaining entered contact fields.

Guest tracking secrets are high-entropy bearer credentials. Only hashes are
stored in records. Visitors must keep their tracking links private. Analytics
and third-party insight scripts are disabled on shop/merit pages, including CMS
analytics. No personal form values are stored in localStorage; the basket stores
only product IDs and quantities. Seller sessions use HttpOnly cookies and
Supabase Auth validation, with membership rechecked per request.

## Local Preview

Run Astro on `127.0.0.1:4324`, then:

```sh
node tests/helpers/commerce-preview.mjs
```

Open `http://127.0.0.1:4330/shop/`, `/merit/` or `/seller/`.
The helper refuses deployed runtimes and environments with remote credentials.
It uses only `.local/commerce-preview/commerce.json`; fixture creation is
exclusive and does not overwrite an existing preview. Fixtures are labelled as
test data, and their product images are explicitly placeholders, not real goods.

- Local seller: `seller@example.test`, password `preview-only-password`.
- Local temple seller: `temple@example.test`, same password.
- Local platform Admin: sign in at `/admin/` with password `admin`, then open
  `/seller/`. These development credentials cannot grant deployed commerce access.

Tests use separate `.local/commerce-tests/run-*` directories, never production.
No emails, charges, shipments or donations are sent by these tests.

## Release Gates

1. Review/apply the additive migration to an authorized UAT database first;
   verify actual Supabase RLS, service RPCs, backups and outage behavior there.
2. Configure server-only `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, the existing
   supported anon-key variable, `ADMIN_SESSION_SECRET`, and HTTPS
   `MONGKOLWELA_SITE_URL`. Verify Supabase email templates, redirect allowlist,
   account invitation/recovery and seller sign-in end to end with test accounts.
3. Keep `MONGKOLWELA_COMMERCE_ENABLED` unset until launch is approved. Only `1`
   enables deployed APIs; it does NOT enable payments. Local preview has its own
   isolated explicit flag. When disabled, temple pages keep the commerce section
   after activities, show an unavailable message and stop its polling; visitors
   can reload after activation. The section links to the shared marketplace at
   `/shop/`; its products are scoped by temple ID, not a separate inventory.
   Emergency pause:
   unset this feature flag; retain tables.
4. Add deployment-level bot/rate protection, retention/deletion procedures,
   privacy terms, seller verification and incident handling before collecting
   real customer data. The current five-active-requests-per-secret cap is not a
   substitute for rate limiting because a caller can create a new secret.
5. Review real products, stock, images, delivery/return terms, temple associations
   and donation recipients. Do not publish fixture records or guessed URLs.
6. Address existing dependency audit findings before launching commerce. The dependency
   install reported five findings in existing Astro/transitive dependencies,
   not the added PGlite test dependency. No unrelated major-version upgrade was
   attempted in this task.
7. For paid commerce, choose a gateway and implement verified webhooks,
   idempotent stock consumption, failed/expired payments, refund/chargeback,
   fulfillment/tracking and merchant settlement before enabling a checkout.

Current storage is deliberately an initial bounded implementation: snapshot
reads stop at 5,000 rows per table instead of returning truncated inventory.
Before growing beyond that, replace full snapshots/global revisions with
scoped queries and per-inventory transactional commands, plus pagination.
Do not describe this as a scalable or completed paid marketplace.

Seller sessions expire after approximately one hour and require sign-in again;
automatic token refresh is not implemented. If an invitation email succeeds but
membership creation fails, an Admin can retry membership by the existing Auth
user ID without sending another invitation. Closed/cancelled campaigns retain
their bookings for operator follow-up; cancellation does not initiate a refund.

## Donation Source

Verified on 2026-09-20: the Revenue Department's
[registered e-Donation recipients dataset](https://data.rd.go.th/th/dataset/ds_edonation)
includes religious institutions. It is used only as a lookup/verification link,
not a payment destination or a promise of tax deductibility. A temple/provider
donation page requires separate human verification of recipient and destination.

## Verification Commands

```sh
node --test tests/runtime/commerce.test.mjs tests/runtime/commerce-database.test.mjs tests/runtime/commerce-api.test.mjs
PLAYWRIGHT_BROWSERS_PATH=./node_modules/.cache/ms-playwright npx playwright test tests/e2e/commerce.spec.ts --project=chromium-desktop --project=webkit-mobile --output=.local/commerce-playwright-output
npm run check
npm run build
npm run nfr:cms
git diff --check
```

Runtime evidence covers isolation, revoked memberships/associations, price and
shipping revisions, guest access, capacity conflicts, expiry, receipts, private
PostgreSQL grants, rollback, compare-and-swap and audited donation changes.
Browser evidence covers real form submission, reload, conflict recovery,
administrator review, seller edits, shared temple integration and mobile overflow.
Screenshots in `.local/commerce-snapshots/` use an isolated loopback preview with
test data, Chromium desktop and WebKit mobile. These are not production captures.
Broader site-wide E2E/NFR and live Supabase/payment-provider checks are not run for
this local preparation task.

Local verification completed on 2026-09-20: 8 runtime/database/API tests and all
10 commerce browser scenarios passed (5 each on Chromium desktop 1440x1000 and
WebKit iPhone 14 390x664). Both existing CMS-freshness Chromium tests also passed
after adding analytics opt-out, and CMS content validation passed. Screenshots
capture the tested dirty working tree with sample data, no open overlays and
fonts/images ready; public catalog captures start at scrollY=0. The current
development preview is `http://127.0.0.1:4330`. Test servers use ephemeral local
ports and are closed after each suite.

Final `npm run check` completed without errors or warnings; the static build
completed successfully (735 routes in the current combined working tree).
`git diff --check` passed. Unrelated calendar/handoff changes were preserved.
