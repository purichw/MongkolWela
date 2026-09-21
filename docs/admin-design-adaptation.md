# Admin Design Adaptation

## Scope And Ownership

The 21 September 2026 dashboard reference guides the whole `/admin/` workspace:
navigation, command bar, overview, statistics, temple list/editor, collections,
page content, navigation editor, activities, media, current account and settings.
The separate `/seller/` application remains a destination, not a redesigned admin
section. Public pages, auth handlers, database schemas and CMS publishing APIs
are unchanged. The data follow-up extends the existing analytics read API with
measured daily counts and referring domains, without adding tracking.

Work is isolated at `.local/admin-design-20260921`, based on `9414179`, because the
main checkout contains unrelated pending work. This pass does not commit, push,
deploy, merge into that checkout, or modify production content.

## Design Translation

- Preserve the 252px jade sidebar, gold selected navigation, 68px command bar,
  generous heading, four metrics, wide chart plus donut, and three lower panels.
- Reuse Noto Sans Thai, the brand mark, existing sanctuary artwork and the site's
  Lucide mask helper. Fine warm borders, 8px surfaces and restrained shadows carry
  the reference's character without adding decorative controls.
- At 1440px, keep 28px content gutters and 16-18px dashboard spacing. On smaller
  screens use two metric columns, stacked panels and a scrollable modal sidebar.
- Mobile temple rows reflow instead of hiding edit/delete beyond a wide table.
  Editor forms retain their own scrolling area and fixed action footer.
- Search is functional for the loaded temple catalogue and CMS pages. It does
  not imply a user-directory search API. Keyboard search, Escape, focus return,
  menu focus containment and persisted desktop collapse are covered by tests.

## Truthful Data Adaptations

The analytics API aggregates existing `analytics_events` from the last 90 days,
up to the latest 10,000 events. Reads page below the database row cap, use stable
ordering and report capped results explicitly. Database failures never silently
become local seed data or zero statistics. Legacy local stores still provide
totals and paths, but no invented daily or referrer series. Reporting slots stay:

| Reference role | Implemented equivalent |
| --- | --- |
| Visitor metrics | Recorded pageviews and events, labelled as such |
| Daily trend | Actual Bangkok-date counts; fewer than two recorded days shows an insufficient-data state |
| Referral donut | Actual referring hostnames per pageview; absent referrers are not claimed as direct visits |
| Unique/returning users | Persistent card explaining unavailable identity/session data |
| Recent content | Existing CMS pages and enabled state |
| Activity feed | Actual content/publishing metadata, not invented actors |

Unknown/unavailable totals show a dash, not a fabricated zero. A shared empty
state retains each chart/card with an icon, clear heading, reason, and retry for
read failures. Empty, insufficient, unsupported and failed states are distinct.
Fabricated series ratios, user counts, direct traffic ratios and media usage
values are removed.

### Data Sources

| Surface | Authoritative input and action |
| --- | --- |
| Pages/navigation/components | Existing live CMS document and publish flow, preserved |
| Temples/collections | Catalog API merged with CMS; shortcuts select the actual category |
| Temple type/source | Real editable type, no royal-monastery default; dataset/CMS provenance is not a guessed publication status |
| Media | Deduplicated page image patches, hero/image blocks, and temple image slots; real filenames, reference counts, pagination, and links to owners |
| Taxonomy | Current catalog region/travel-mode counts; travel modes editable in the temple form and parsed like public details |
| Activities | Existing independent activity API and publish workflow, preserved |
| Account | Current authenticated account, no invented directory |
| Upload provider | Actual API-enabled status; failure differs from unconfigured |

Media counts are managed-content slot references, including disabled content and
local drafts. They are not traffic totals, public-page usage counts or a complete
provider storage inventory. Public datasets and CMS development seeds remain
legitimate product content: this pass does not delete or republish them over live
content.

## Shared Owners

- `src/styles/admin-design.css`: route-scoped tokens, shell, typography, controls,
  surfaces, dashboard and responsive variants. Loaded only by the admin entry.
- `src/scripts/admin/design.js`: icon adapter, dashboard/statistics renderers and
  search results. Uses existing state and event delegation.
- `src/scripts/admin-portal.js`: shell, navigation, auth session, draft/publish
  controls and existing workflow dispatch.
- `src/scripts/admin/editor.js`: temple row/drawer markup and shared icons.
- `src/scripts/admin/data.js`: media-reference and taxonomy selectors.
- `src/lib/admin-analytics.js`: pure aggregation of existing event rows.

Do not add public-site overrides to fix an admin surface. Watch for older
selectors with greater specificity: collapsed grid columns, mobile flex basis,
button widths and visibility transitions caused real regressions in this pass.

## Verification And Preview

- `npm run check`: 61 Astro files and browser-script bindings passed.
- `npm run build`: 735 pages built successfully. Existing JSON import-attribute
  warnings remain in Home and Calendar modules outside this pass.
- `admin-design.spec.ts`, `admin-navigation.spec.ts`, `admin-temples.spec.ts`:
  10 Chromium tests, including desktop, 390px mobile, 320/768/1024px overflow,
  search, menu focus, reload persistence, editing, confirmation, publishing,
  image crop/fallback, empty/unavailable analytics and sign-in failure.
- Two focused activity tests passed with isolated local API handlers: draft,
  publish, reload, validation, conflicting edit preservation and upload recovery.
- Dashboard main-region WCAG A/AA axe checks have no violations. This is not an
  accessibility certification of every legacy form or third-party service.
- Visual evidence: `artifacts/admin-design/`. Desktop and mobile were personally
  inspected; the mobile reference is an adaptation, not a supplied mockup.

Run Astro on 4356 and `node scripts/qa/admin-design-preview.mjs` for the read-only
preview at `http://127.0.0.1:4357/admin/`. The proxy now calls real read handlers
and sign-in/sign-out handlers. It never supplies a fixture session or fabricated
business metrics. Normal auth/data environment settings are required; missing
settings remain an explicit error. Publishing and upload writes stay blocked.

### Data Follow-Up QA

- `tests/runtime/admin-data.test.mjs`: references, explicit clears, image fallback,
  taxonomy, provider status, Thai-day counts, missing referrers, database paging
  and source failure.
- `tests/e2e/admin-data.spec.ts`: desktop/mobile empty and failed cards, one-day
  vs. two-day series, media-owner links, actual taxonomy, and isolated real-handler
  publish/reload/public-page propagation of temple fields.
- The four admin browser suites pass 14 tests. Test fixtures are only used in
  tests, with empty analytics by default. Populated chart screenshots use explicit
  controlled test inputs, not production traffic claims.
- Current visual evidence is `artifacts/admin-design/data-empty-*.png` and
  `data-populated-*.png`. Desktop and mobile images were inspected directly.

No production smoke or exhaustive cross-browser suite was run for this local
design pass. `git diff --check` passed. The final 1440px overview is 1122px tall
(reference: 1086px); the first metric row starts at 199px (reference: about 196px).
All five overview photographs decoded successfully, Noto Sans Thai loaded, and
the 390px mobile view has zero document-level horizontal overflow.
