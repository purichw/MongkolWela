# CMS Content

## Place URL Slugs

The place editor has automatic and custom URL modes. Automatic mode uses a
reviewed English name for existing places and offline Thai romanization for new
names; custom mode retains the editor's value when the place name changes.
Saving the drawer updates the draft. Publishing validates and applies the URL.

`temples.records[key].slug` is separate from the immutable legacy CMS `key`.
The compact `thailand` directory collection does not need a detail slug: it
reuses the same place editor and publication API with fewer fields, and links
to a directory row plus Maps. See `docs/thailand-directory.md` and
`docs/admin-place-editor.md` for coordinate/Plus Code validation and sourcing.
Source metadata is retained independently of the compact form, with per-fact
provenance and unknown fields preserved for later search enhancements. Directory
publication merges that metadata rather than replacing it with visible fields.
`slugMode` is `auto` or `custom`; `slugAliases` is server-maintained publication
history, not an editable list. Existing Thai URLs remain HTTP 308 aliases, and
previously published ASCII URLs remain reserved after rename or deletion.
Canonical detail URLs, sitemap, search, planner, cards and map links consume
the same published slug. Page-level patches associated with an old place URL
continue to apply under its new canonical URL.

All 625 curated collection records have English/romanized URL mappings.
Existing valid custom ASCII slugs are preserved. The mappings apply when the
new runtime reads the current CMS; the next normal revision-checked publication
persists normalized slugs and aliases without replacing non-URL fields.
Do not run a CMS seed or overwrite the live document to migrate URLs.
This is not a rewrite of the separate all-Thailand location index.
See [Temple URL Slugs](docs/temple-slugs.md) for verification and rollout details.

## Tarot Research And Editorial Import

The 2026-10-15 authorized local integration now uses the delivered
`mongkol-tarot-editorial-v1` bundle: 78 cards and 468 upright contexts, plus
general reversed meanings. See [integration and field ownership](docs/tarot-editorial-integration.md)
for exact CMS paths, preserved overrides, monthly limitations and QA. This is
not a production publication. The older research brief below remains historical.

The [78-card research prompt](docs/research/tarot-78-deep-research-prompt.md) is a
research/editorial brief, not a completed dataset or a CMS import file. Its
proposed `tarot-research-v1` schema is not the live CMS schema.

- Meanings owner: `src/data/tarot-meanings.js`, registry `tarot.tarotMeaningCards`.
- Reading owner: `src/scripts/tarot-data.js`, registry `tarot.tarotCards`.
- Both contain 78 matching legacy IDs. Preserve ID spellings, artwork references,
  existing overrides and draw/storage contracts; display names may differ from IDs.
- Imported readings distinguish each card and upright context. General reversed
  meanings are present; reversed context matrices and automatic monthly synthesis
  are not implemented. Monthly positions have separate editable guidance.
- Before import, review sources and Thai copy, map only supported editorial fields
  through `managedContent`, and record unmapped fields as pending implementation.
  New nested context/orientation fields require explicit schema, Admin and Visitor
  work; they must not be silently dropped or described as already synchronized.
- Merge against the current live revision, preview the diff and test both library
  and result consumers using fixtures/UAT. Publishing, changing draw eligibility
  or enabling reversed draws are separate authorized implementation decisions.
  Never seed over live edits to import research.

## Content Workspace

The central Admin now includes page fields, shared website copy, the reading
library and embedded commerce. See [CMS workspace coverage](docs/cms-workspace-coverage.md)
for ownership, design choices, validation, verification and remaining boundaries.

Page editing discovers stable `data-cms-field` bindings from the actual template;
editors do not need CSS selectors for normal changes. The advanced patch editor
remains available for existing documents. Missing page registrations are appended
only when edited; existing published entries and overrides are not replaced.

Reading data is registered through `managedContent`: only declared editorial
strings can change. IDs, formulas, counts and drawing geometry stay code-owned.
Published `contentLibrary` overrides are filtered by route, shared with runtime
tools and applied to SSR markup through `contentBinding`. An explicit empty
string clears content. An absent override retains the original editorial seed.

Publishing requires the revision read by the editor. Stale or concurrent writes
return 409 and retain the editor's input. Drafts remain local to the browser;
the website link opens published content, not a draft preview.

## Contact Page

`/contact/` is registered as existing page `contact` in both development seeds.
It already consumes published page patches through the shared CMS runtime;
an Admin-specific contact editor is not required for the data connection.
Email and LINE ID each have one editable attribute on `#contact-channel-data`.
All displayed values, destinations, topic email recipients and clipboard actions
derive from those attributes. Explicit clears disable the corresponding actions;
removing the patch restores the build default. Image and copy slots use stable IDs.
See [Contact Page](docs/contact-page.md) for the editor contract and focused QA.
Do not seed over production: append only the missing page to the latest published
document if needed, preserving all unrelated content. No live publication was
performed as part of implementing this route.

## Travel Guide

The `/guide/` route uses page ID `travelGuide`; both build/development seeds
register it as an existing page. The shared utility link now opens this route.
The page reuses the public shell, PageBanner and CmsImage without changing their
CMS ownership. Checklist state stays only in the visitor's local storage.
Do not seed or replace live content during deployment. If the live page registry
needs an entry, append only the missing record to the latest published document
through the existing Admin workflow, preserving all edits. See `docs/travel-guide.md`.

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

Live-rendered temple detail pages embed this same public, path-scoped payload
and revision from the server's fresh CMS read. The browser consumes it once on
initialization instead of immediately requesting the same document again. The
HTML remains `no-store`; prerendered pages never embed this bootstrap. Invalid
or mismatched bootstrap data triggers a live API read. Every later refresh still
checks the configured source normally, including failure/retry behavior below.

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

### Curated Place Histories

`temples.records[key].fields.description` owns the public overview paragraph
under **รู้จักสถานที่แห่งนี้**. Admin edits it as **ประวัติและเรื่องน่ารู้**.
An explicit empty value stays empty. The renderer does not invent generic prose.

Reviewed evidence is stored separately in each record's `historyResearch`
(`key`, `reviewedAt`, `importedDescription`, `sources`, `factNotes`). The editor
shows source links in a collapsed disclosure. `GET /api/admin/content?view=editor`
requires current Admin membership and returns the full document/revision.
Public full/path projections and SSR bootstrap omit `historyResearch`. Evidence
is editorial metadata, not a public citation or image-credit replacement.

On publication, records linked by the reviewed history key share description
edits, including an intentional clear. Conflicting edits to the same place in
different collections fail validation. Immutable record keys, routes, visibility,
photos, coordinates, visit information and collection ordering do not change.

`scripts/publish-place-histories.mjs` imports the reviewed dataset only when all
378 source identities / 625 memberships are present and evidence-backed. It is
dry-run by default and rejects existing Admin-description conflicts. Direct
publication requires an expected revision and records a backup plus CMS revision.
Its `--sql <project-local-file> --checksum <current-database-md5>` mode prepares
an equivalent transaction for an authorized Supabase SQL Editor session without
exporting credentials. SQL checks the locked live document, merges only history
fields, saves before/after revisions and writes the audit event atomically.
Never run a seed or raw research crawler as a production content migration.
When the browser editor rejects a large query, `--sql-batch-dir <local-directory>`
creates bounded staging queries plus one final publication query. Staging uses
`cms_history_import_batches`, with RLS enabled and no public/authenticated grants.
Each part is checksum-verified; an incomplete or altered batch cannot publish.
Staging never changes live content. Retain it as import evidence until separately
authorized cleanup; it is not a CMS content source or a new public API.

Focused coverage: `tests/runtime/place-history.test.mjs` (coverage, conflicts,
idempotence, metadata projection and real PostgreSQL transaction),
`tests/runtime/cms-publishing.test.mjs` (auth/revision boundary), and
`tests/e2e/place-history.spec.ts` (real handlers, edit/save/reload, cross-collection
sync and public SSR). Private raw research remains in ignored/local artifacts;
only rewritten editorial content and provenance belong in the reviewed dataset.

The 2026-10-26 dataset contains 378 source name/province identities, linked into
371 history groups across 625 collection memberships. Seven evidence-confirmed
alias pairs share prose; nearby landmarks are not merged merely by proximity.
Editorial revisions should explain why each place matters: a revered teacher,
worship object, religious tradition, community role or significant history.
Use additional space for supported context, not filler or a fixed word target.
Distinguish documented history from legend and devotees' beliefs; never promise
miracles or outcomes. Keep sources and identity caveats in backend research,
and verify expanded copy together with topics and worship objects in the
existing overview card without increasing its layout or truncating the prose.
For example, the curated `วัดโนนกุ่ม` entry explicitly refers to the Somdet To
foundation in its original guide and worship-object fields, not the older
registered temple with the same popular name. The import preserves that intent.
Known district/pin discrepancies remain in backend `factNotes` for a separate
location-data review; this publication does not certify or modify those pins.

Recovery: the SQL import saves `history-import-before` and
`curated-place-history-import` revisions in the same transaction. Inspect the
latest live revision before restoring anything; merge only affected history
fields if newer Admin work exists. Do not blindly restore the whole document.

### Shared Search Projection

`GET /api/temple-search` reads the current configured CMS once per request and
applies the same temple merge rules before ranking. Disabled collections/records,
custom labels, edited fields and explicit image clears remain authoritative.
It returns only public search fields, facets and paging metadata, with `no-store`;
source failures return 503 rather than seed results or a false empty count.
Vercel rewrites this URL to the existing Planner data function with `view=search`;
the isolated `_search.js` handler keeps the deployment within its 12-function
limit. Ordinary Planner requests and revision checks are unchanged.
Home/Header suggestions refresh on search/focus; the results page also uses the
shared visible-page refresh lifecycle without clearing an unsubmitted query.

`templeSearch` (`/search/`) is registered in both local seeds. On release, register
only this missing page in the latest live Admin document if Admin page management
is needed; do not replace the published document with either seed. Search needs
no CMS migration and uses the existing detail URL/static page publication contract.

### Display Names

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

## Homepage And Navigation Editors

The default page-content screen is now **จัดการหน้าแรก (Homepage)**. Its numbered
sections edit the existing Home page patches, media and visibility rather than
replacing the published page with a design seed. Other pages remain available in
the page selector. Calendar dates and database counts stay source-derived.

Optional `homepage.collections` entries on the page with `id: "home"` manage the order, visibility,
copy, links and images of `shortcuts`, `daily`, `intents`, `stops`, `categories`
and `tools`. `src/lib/homepage-content.js` owns the bounded schema and visitor DOM
projection. Missing collection overrides preserve the existing template. Both
Admin publish validation and the content API validate the new fields; the usual
draft, revision-conflict and publish contracts still apply. No database migration
or automatic production content publication is required.

Navigation now supports grouped children, desktop/mobile visibility and labels,
menu layout, descriptions, icons and feature imagery. The editor normalizes
legacy flat section markers into grouped draft items without publishing them.
The preview uses the same renderers as the visitor header and mobile drawer.
Disabling a group also hides its children; choosing a direct link keeps its
stored submenu data for later use. Mobile editing has separate info, submenu
and preview tabs, plus an explicit return to the menu list.

The central commerce workspace includes service status, preparation steps and
the existing product, campaign, order and seller controls. A disabled API shows
unavailable counts, not invented zeros. API failures remain errors with retry;
they are not treated as a disabled service. The redesign does not enable
commerce, payments or additional permissions. Media uploads still require a
configured provider; local preview is read-only and blocks writes.

Focused verification lives in `tests/runtime/homepage-content.test.mjs`,
`tests/runtime/site-navigation.test.mjs` and
`tests/e2e/cms-content-coverage.spec.ts`. Browser tests use isolated fixtures,
not production content.

## Commerce And Merit

Commerce and merit reservations use separate private tables, not CMS JSON.
The Admin sidebar opens the embedded commerce workspace in `/admin/` for platform
management. Authorized platform managers visiting `/seller/` are redirected to
that workspace; seller access stays scoped by active organization membership. See
[Commerce And Merit](docs/commerce-and-merit.md) for schema, local preview,
verification and release gates. The feature is disabled in deployed APIs unless
explicitly enabled; payment processing remains unavailable even then.

The shared navigation exposes a CMS-managed `commerce` group with `shop`
and `merit` links. Admin > Navigation controls their labels, destinations,
order and visibility. Both routes are also registered as existing CMS pages.
Adding these links does not enable commerce APIs or payments.

Shop's default display name is `วัตถุมงคลและเครื่องราง`. The shared navigation
model maps only the legacy `ร้านค้ากลาง` label on `/shop/` to this name, including
device-specific labels; custom published names, URLs and visibility are preserved.
Build seeds and the temple-to-shop link use the new name. This does not publish
or replace the live CMS document.

`CommerceBreadcrumb` derives its full ancestry from the same navigation model,
preferring the deepest matching child when a group shares its landing URL.
It renders the visible trail and BreadcrumbList from one helper and refreshes
both after live CMS content arrives. Labels and hierarchy are edited through
Navigation, not independent per-page breadcrumb patches. If navigation is removed,
the current page registry label is used without restoring a removed group.
The Merit route no longer has duplicate shop/merit tabs.
Both routes use `CommerceIntro` for the top banner. Shop keeps its existing
`3746c99e-3/4/5` and quote bindings; Merit adds `merit-intro-kicker/title/lead/quote`.
The banner owns the page H1, while closed-state, campaign and detail headings
remain below it as H2s with their existing CMS fields.

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
