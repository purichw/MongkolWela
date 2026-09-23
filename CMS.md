# CMS Content

Admin identity, membership checks and rollout steps are documented in
[Admin Supabase Auth](docs/admin-supabase-auth.md). Auth accounts alone do not
grant portal access.

Temple activities are a separate, private per-record store with their own
Admin save/publish action and public projection. They never replace the live
page document. See [Temple Activities](docs/temple-activities.md) for event
validation, Supabase RLS, concurrency, freshness and QA contracts.

Runtime precedence is simple: valid current Admin Portal/API content is live for
visitors and must not be overridden by bundled JSON, cache, or stale fallback
logic.

Production reads and writes one configured source: Supabase when configured,
otherwise authenticated GitHub Contents API. Outages, missing documents, and
invalid payloads return 503. Runtime does not silently use build JSON or another
publish target. GitHub credentials remain on the server.

`public/admin/content/live.json` and `default.json` are build/development seeds.
Local development without a configured remote source reads `live.json`. Do not
run `db:seed:cms` during routine deploys: it can overwrite live Admin changes.

`/api/admin/content?path=/calendar/` returns shared shell settings and only the
current page's editable content. Temple records are included for temple pages
and Home, not unrelated tool pages. The database currently stores one CMS JSON
document, so this projection reduces browser payload, not database reads.

Visitor pages check again on tab focus, visibility restoration, restored
back/forward navigation, reconnection, and every 60 seconds while visible.
Concurrent focus/visibility events are combined; hidden tabs do not poll.
The request includes the last page-scoped revision. The API reads the current
source and hashes actual content (not publication timestamps), returning only
`unchanged` and the revision when identical. This detects direct database edits
without depending on a timestamp trigger. It still reads the CMS document once
per check; it is not a database subscription or instant push.

Only changed navigation, page patches, sections, and temple records are applied.
Refresh does not repeat analytics, consent banners, or unchanged page markup.
Planner pages receive a small temple-data revision in the CMS response and fetch
their catalog only when that changes. Criteria and remaining selected IDs are
preserved; an existing plan is marked for review instead of showing stale travel
calculations. Refresh failures retain the current view with an explicit warning
and retry the live source, never a build seed. Static all-Thailand source files
remain separate from this published CMS refresh contract.

Admin and Planner use the same `applyTempleCmsRecords` merge rules. Explicit
empty fields and image slots are preserved. Planner identities derive from
stable dataset identity or CMS record key, never an edited display name.

Planner data and plan requests read the current source once per request. A
catalog revision identifies the data used by the browser. A changed revision
returns 409 with a fresh catalog; the visitor can review and resubmit. Successful
plans return current selected-place details. Browser storage contains user
criteria and IDs, not authoritative content or calculated results.

Run `nfr:cms` after local registry changes. Verify published contracts with
`cms:verify:production` or `smoke:production` after deployment. Schema versions
describe data shape; they do not determine which document is newest.

## Temple Collection Labels

The collection display names are `วัดดังน่าไป` (`popular`), `วัดเด่นขอพร`
(`sacred`), and `พิกัดสายมู` (`mu`). Routes, collection keys, temple IDs and
original dataset category memberships are unchanged.

The 2026-09-23 rename updates source copy and both build/development seeds.
Production CMS publication is a separate step: read the latest Admin document
and update only the three collection navigation labels, matching page labels,
and Home collection image-field labels. Update the Home intro or page text
patches only where they still use the old collection names. Preserve customized
copy, links, visibility, order, assets and temple records; never publish a seed
over the current document or hardcode labels over published CMS choices.

## Commerce And Merit

Commerce and merit reservations use separate private tables, not CMS JSON.
The Admin sidebar links to `/seller/` for platform management; seller access is
scoped by active organization membership. See
[Commerce And Merit](docs/commerce-and-merit.md) for schema, local preview,
verification and release gates. The feature is disabled in deployed APIs unless
explicitly enabled; payment processing remains unavailable even then.

The shared navigation exposes a CMS-managed `commerce` group with `shop`
and `merit` links. Admin > Navigation controls their labels, destinations,
order and visibility. Both routes are also registered as existing CMS pages.
Adding these links does not enable commerce APIs or payments.

The bundled entries are development/build seeds. For an existing production
document, publish only the new group and page entries against the latest Admin
content; do not replace the document with a bundled seed. An intentional
published removal or disabled entry must remain authoritative.

## Admin Analytics

The Admin retains chart/card layouts for empty, insufficient and unavailable
data. Values come from the analytics API, never design-preview metrics.
Supabase reads aggregate the existing event table over 90 days, capped at the
latest 10,000 events with explicit coverage metadata. Daily counts use Bangkok
dates. Referrers show hostnames; a missing referrer does not prove direct traffic.
Unique/returning users remain unavailable without usable identity/session data.
No additional visitor tracking or database migration is introduced.

Configured-source errors return 503 rather than falling back to local analytics.
Local unconfigured development can still read its existing event store. See
[Admin Design Adaptation](docs/admin-design-adaptation.md) for the data-source
map, preserved workflows and focused verification.

## Admin Media

Home Banner uses the five existing `home-hero-image-1` through
`home-hero-image-5` image patches. Each slot accepts `src`, `alt`, `position`
(CSS object-position), `credit`, `sourceUrl`, `license`, and `licenseUrl`.
The Home image editor exposes these fields; the existing page save/publish
flow stores them without a database migration. Only the first image loads
initially. Later slides load their current published URL when selected.
Credits follow the active slide, and credit links allow only HTTP(S).

An explicit empty `src` clears that slot, including its deferred image, so
carousel navigation cannot resurrect an old image. Older patches without
metadata clear seed credits/crops rather than attributing a different photo.
Deleting a patch restores the build-time value, as with other page patches.
Production source failures still follow the error/retry contract above.

Photo choices and licenses are recorded in [Home Banner Media](docs/home-banner-media.md).
The bundled photo set is a local/build seed only. To adopt it on production,
publish the five Home image patches against the latest Admin document after
the assets are deployed; never replace the whole published document with a seed.

Temple image uploads go directly from the browser to the configured media provider so the image bytes do not pass through Vercel Functions.

Cloudinary:

- `ADMIN_MEDIA_PROVIDER=cloudinary`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_UNSIGNED_UPLOAD_PRESET`

ImageKit:

- `ADMIN_MEDIA_PROVIDER=imagekit`
- `IMAGEKIT_PUBLIC_KEY`
- `IMAGEKIT_PRIVATE_KEY`
- `IMAGEKIT_URL_ENDPOINT` (optional display URL)

The private ImageKit key remains server-only. `/api/admin/media` returns a short-lived upload signature after validating the Admin session.

Live navigation may intentionally differ from build seeds. Test publication,
reload, explicit clears, deletions, source failure, recovery, and revision
conflicts using `npm run test:runtime` and the focused browser suites.
