# Place Detail Implementation Notes

## Scope And Authority

- Requested 2026-09-21: implement the supplied place-detail handoff using mockup-to-product.
- Primary image: the second composite (SHA-256 `061131b36e455cbbc5f528d4112f494068ef62fef48b6ded9cfa366aaf8c7772`). The earlier image is archived.
- Shared template: popular, sacred and mu. Preserve canonical routes, live CMS precedence, existing commerce gates and consent.
- P0 uses one real image. Existing desktop/mobile variants are not a gallery. No new schema, content publication or deployment.
- Desktop: hero pair, highlights/visit beside location, then full-width travel, activities and related. Mobile: hero, highlights, location, visit, travel, activities, related, footer.

## Baseline

- Working tree already contains Home/Calendar, CMS, activities and commerce work; preserve it.
- `npm run check`: passed, 0 errors/warnings/hints.
- `npm run build`: passed, 735 pages. Existing import-attribute warnings in Home/Calendar/Day remain unrelated.
- Local baseline captures: `artifacts/place-detail/before-1440.png` (5039px tall), `before-390.png` (8254px tall). Local seed CMS, anonymous, activity response intercepted as an explicitly empty fixture. Not production evidence.

## Hook Inventory

| Consumer | Existing hook | Responsibility | Migration |
| --- | --- | --- | --- |
| CMS | `.temple-detail`, `#temple-detail-title`, `p:nth-of-type(2)`, positional `.temple-detail-meta div` | Patch identity/fields | Replace positional detail patch with a route-owned normalized model and named domains; leave collection-card patch unchanged |
| Images | `.temple-detail-hero__media`, `[data-temple-mobile-source]`, `[data-temple-desktop-image]` | Published responsive media | Retain image node and existing pipeline, create/remove mobile source as needed, retain centered crop (no focal-point field exists in the temple schema) |
| Maps | `[data-temple-detail-map]`, `data-lat/lng/map-url/map-label` | Preview/dialog | Keep stable preview node; synchronize both live marker instances, links and missing states |
| Share/copy | `[data-temple-detail-share/copy]` | Native share/clipboard | Preserve actions, current canonical identity, cancellation and manual fallback |
| Visit | `.temple-detail-visit__grid`, `.temple-detail-visit-sources` | Hours/contact/sources | Shared SSR/runtime renderer with separately keyed disclosures and visit review date |
| Travel | Route rows/details and five visible chips | All source stops/services | Full-width modes/results; presentation limits only; preserve direction/operator and state |
| Activities | `[data-temple-activities]`, `data-temple-id`, `[data-activity-period/result]` | Separate API, status/timezone/period | Retain API and IDs; retain usable snapshot on refresh failure |
| Commerce/consent | Existing components and flags | Public visibility/tracking | No new enablement or payment surface |

## Verification Plan

Adapt the handoff's 66 cases to focused model tests and browser tests. Check all three collections, responsive widths 320 through 1920 including 979/980, map failure and live coordinates, unknown visit fields, travel expansion, CMS state retention, activity failure/stale states, share fallbacks, no-JS, keyboard and shared-route smoke. Capture actual desktop/tablet/mobile/narrow screenshots. Record executed and deferred checks separately; no claims from the handoff's old evidence.

## Implementation

- `src/components/TempleDetail.astro`: shared SSR template for all three collections; retained stable routes, SEO/JSON-LD, record IDs, real media, Activities and Commerce owners. One DOM order, not desktop/mobile duplicates.
- `src/lib/place-detail-view.js`: public-only normalized model and escaped renderers shared by SSR and published-CMS hydration. Coordinate range/null checks, Plus Code priority, safe contact/source URLs, complete topics/objects behind native disclosures, seven-day hours rule and fee audiences retained.
- `src/scripts/place-detail-content.js`: named content-domain patches instead of positional DOM assumptions. Preserves open disclosures/focus, supports explicit null/empty fields, responsive image replacements, and updates map attributes as one revision. Travel/related/SEO remain build-owned, not falsely advertised as live CMS fields.
- `src/scripts/temple-detail.js`: native map dialog with keyboard containment, backdrop/Escape/close/focus return, retry and live marker movement. Pan is not reset on each CMS update; a changed pin offers recenter. Canonical share/copy with cancellation and selectable fallback; mode filters, per-mode expansion and manual related rail.
- `src/data/temple-travel.js`: retains unknown modes, stop links and operator/direction identity. Keeps original route order and existing recommended-stop logic; never invents walking time or transit routes.
- `src/styles/place-detail.css`: route-owned 1220px layout, 59/41 hero, intrinsic image frames, restrained paper surfaces, jade/gold/lacquer accents, readable Thai type, 2x2 mobile transport choices and fixed-aspect related photos.
- `Footer.astro`: existing editorial footer used on detail routes only, including the existing ornaments and configured navigation. No shared Home/Calendar redesign.
- `TempleActivities.astro` / `temple-activities.js`: existing API/timezone/registration contracts preserved. Visible loading/empty/error/stale states; refresh errors retain the last usable results and open details instead of erasing them. No new activity aggregate destination.
- Lucide assets are sourced from the upstream `lucide-icons/lucide` icon directory, alongside the repository's existing license. Heritage section symbols reuse `SiteIcon`.

## Verification Results

Executed locally on 2026-09-21, using installed Google Chrome. No production writes:

| Check | Result |
| --- | --- |
| `npm run check` | 0 errors, warnings or hints; 54 browser modules pass binding/syntax checks |
| `npm run build` | 735 pages built; pre-existing JSON import-attribute warnings in Home/Calendar/Day unchanged |
| `node --test tests/runtime/place-detail.test.mjs tests/runtime/content-refresh.test.mjs` | 8 tests passed |
| Baseline `tests/runtime/temple-activities.test.mjs` | 2 tests passed; persistence/API contracts untouched |
| `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4326 npx playwright test tests/e2e/place-detail.spec.ts --project=chromium-desktop --reporter=list` | First 9 scenarios passed together; added slow-response/initial-error scenario passed separately |
| Responsive matrix | 320, 360, 375, 390, 430, 600, 768, 979, 980, 1024, 1280, 1440, 1920; no page overflow |
| Collection coverage | Actual popular, sacred and mu detail routes render the shared owner |
| Map | Library failure/retry, open dialog, keyboard loop, focus return, live valid/invalid coordinates, external links and retained map canvas passed |
| Data/interaction | Long name, explicit unknown fields, all topics, responsive image changes/failure, mode state, related rail, canonical copy, denied clipboard and cancelled native share passed |
| Activities | Pending response stays loading after tab change; true empty, initial failure, stale refresh, retry, expansion and cancelled registration gating passed |
| Accessibility | Axe WCAG 2 A/AA: no violations in the detail root; keyboard dialog checks passed |
| Text/landscape | 844x390 dialog plus 200% computed text enlargement at 390px passed without page overflow (text-only simulation, not a physical browser zoom certification) |
| Shared smoke | Home, Calendar, Day and mobile navigation: headings, overflow, open/Escape close and browser errors checked |
| No JavaScript | Core facts, all travel stops, external links and native source disclosures remain readable; enhanced actions hidden |

### Visual Evidence

Files under `artifacts/place-detail/`:

- `after-1440.png`, `after-768.png`, `after-390.png`, `after-320.png`: current full-page composition.
- `after-390-top.png`, `after-390-visit.png`: readable native-scale mobile details.
- `edge-320.png`: long CMS text, changed media and unknown fields fixture.
- `text-200-390.png`: enlarged-text stress case.
- `responsive-metrics.json`, `axe.json`, `capture-context.json`: dimensions and capture provenance.

Snapshots use local `live.json`, anonymous consent declined, an explicit empty Activities QA response and a **test-only** `COMMERCE_DISABLED` response. They do not assert that commerce is disabled in production. The ordinary port-4326 read-only preview does not serve live Activities/Commerce APIs, so those sections can show their unavailable state there. No fixture was written to CMS or shipped as source data.

## Deliberate Adaptations

- Single real record photo instead of fabricated gallery thumbnails, counts or AI temple imagery. Source attribution remains available.
- Full stop results on mobile and readable 16px body text make the page longer than the tiny phone crop. All-mode shows one stop per mode, up to four initially; remaining stops are reachable without data loss.
- Real visit contacts, coordinates, dates and route distances differ from the mockup. Unknown fees do not become free. Identical verified free Thai/foreign fees can use a short summary with full audience/notes disclosure.
- Footer/social destinations and top navigation come from the current shared configuration, not invented links from the image.
- No new commerce, donation, ratings, reviews, favorites, gallery schema or calendar-event integration.

## Remaining Limits

- Firefox/WebKit executables are not installed; Safari, physical phones, assistive-technology sessions and real operating-system share sheets were not certified. Native-share outcomes are browser-test stubs.
- Back/online refresh events and refresh scheduling were tested; actual browser BFCache restoration and every one of the handoff's 66 cases were not separately certified.
- No full admin, commerce checkout, payment, production CMS publish or whole-site release suite. Existing local gates/components are preserved; unrelated work and the branch's pre-existing behind-remote status were not changed.
- This is a local implementation and visual QA pass, not a deployment or a new verification of temple-source facts.
