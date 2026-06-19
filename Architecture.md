# Architecture

Last updated: 2026-06-19

## Project Shape

`hora-astro` is a Thai-first Astro static site for Mongkol Wela. The deployed production site is:

- `https://mongkolwela.vercel.app`
- Vercel project: `mongkolwela`
- GitHub repository: `purichw/hora-astro`

The app is built as static Astro pages. Client-side behavior is small, route-specific JavaScript loaded through `BaseLayout.astro`.

## Top-Level Structure

- `src/pages/`: Astro routes.
- `src/layouts/BaseLayout.astro`: shared document shell, header/footer, global CSS, cache-busted scripts.
- `src/components/`: shared Astro components.
- `src/data/`: JSON datasets and small data helpers.
- `src/config/`: site/navigation/page configuration.
- `public/styles.css`: CSS import entrypoint.
- `public/assets/css/`: feature CSS files.
- `public/assets/js/`: browser-side feature modules.
- `public/assets/images/`: local images and generated placeholders.
- `outputs/`: local generated artifacts. This directory is intentionally untracked unless a future task says otherwise.

## Admin Portal CMS Content

Admin Portal content has three deploy-time surfaces:

- `public/admin/content/live.json`: code-owned source of truth for published page registry and navigation.
- `public/admin/content/default.json`: bundled fallback that must match `live.json` for page registry and navigation.
- `/api/admin/content`: production API used by `cms-runtime.js` and Admin Portal.

Production may read `/api/admin/content` from Supabase first. To avoid stale database content hiding new features, `readLiveContent()` uses the bundled `live.json` page registry and navigation as the fallback deploy contract when the stored CMS copy does not include the current editable contract. New Admin Portal publishes include `cmsContractVersion` and are allowed to override bundled navigation for visitors. `cms-runtime.js` follows the same rule, so old data cannot restore stale nav after hydration while fresh Admin publishes remain visible.

Validation commands:

- `npm run nfr:cms`: validates local `default.json` and `live.json`.
- `npm run db:seed:cms`: writes `live.json` into Supabase `cms_documents/live` when server-only Supabase env is available.
- `npm run cms:verify:production`: validates production `/api/admin/content` against `live.json`.
- `npm run smoke:production`: includes the production CMS API check.

## Verification Workflow

The project uses proportional verification to conserve usage during frequent UI/data iteration.

Quick CI is always required before commit/deploy: `git diff --check`, `npm run check`, `npm run build`, then `git status --short --branch`. This is the baseline safety gate even when broader NFR/E2E coverage is intentionally deferred.

Workflow modes are explicit. Quick patch means make only the requested change without commit, push, or deploy. Batch mode means collect multiple requests, then test and deploy once. Production mode means complete commit, push, deploy, and production smoke. Browser verification may be skipped when the change is not behavior-critical. Final summaries should be brief: files changed plus test results.

For every feature with new or changed behavior, agents should infer acceptance criteria as itemized lists, propose or update a QA matrix row, and recommend the right automation level before or alongside implementation. Ask the user only when the expected result depends on a business rule that cannot be safely inferred. Automation should be checked against the intended behavior, and important tests should fail when the protected behavior is deliberately broken in a safe local check.

During small edits, prefer `git diff --check` and focused Browser spot-checks for only the touched page/flow. UI work should get a brief desktop and mobile pass. Do not run full E2E or `npm run nfr` during ordinary incremental edits.

Before commit, run `npm run check` and `git status --short --branch`. If a one-page CSS/markup change has a clearly relevant targeted E2E test, run only that test; otherwise Browser verification is acceptable when it clearly covers the change.

Before deploy, run `npm run build` and targeted smoke checks for touched routes. After deploy, smoke production on key routes plus touched routes.

NFR is not a per-deploy requirement. Batch `npm run nfr` into release/maintenance sweeps: before major releases, after CMS/SEO/data/config changes, or about weekly. When checks are intentionally deferred, keep a short checklist of the deferred NFR/E2E coverage.

## Global Layout And Assets

All normal pages use `src/layouts/BaseLayout.astro`.

Important behavior:

- `assetVersion` is used to cache-bust `/styles.css`, `/script.js`, and page-specific scripts.
- When changing CSS or public JS, bump `assetVersion`.
- `public/styles.css` also imports CSS files with explicit version query strings. Bump those when cache correctness matters.
- `extraScripts` is passed by pages that need route-specific JS.
- A fixed scroll progress indicator is rendered by `BaseLayout.astro`, styled in `base.css`, and updated by `scroll-progress.js`.
- A global page loader is rendered by `LoadingScreen.astro`, styled in `base.css`, and controlled by `page-loader.js`.
  It shows a 3-second simulated intro once per browser session, then only reappears for slow loads or pending internal navigation.
  The loader uses a soft full-page smoke treatment, transparent vector outline icons, simulated progress, and timeout messaging for unusually long loads.
  It intentionally avoids a visibly framed loading card or skeleton panel.

Shared shell components:

- `src/components/Header.astro`
- `src/components/Footer.astro`
- `src/components/LoadingScreen.astro`

## Main Feature Areas

### Home And Core Astrology Pages

Routes include:

- `/`
- `/horoscope/life-graph/`
- `/horoscope/palmistry/`
- `/horoscope/seamsi/`
- `/horoscope/thai-astrology/`
- `/calendar/`
- `/calendar/day/`
- `/tarot/daily/`
- `/tarot/monthly/`
- `/tarot/luck/`
- `/tarot/love/`
- `/tarot/money/`
- `/tarot/career/`
- `/tarot/meanings/`
- `/tarot/meanings/[card]/`

Feature JS lives under `public/assets/js/`, for example:

- `life-graph.js`
- `seamsi.js`
- `thai-astrology.js`
- `thai-calendar-day.js`
- `thai-calendar-year.js`
- `tarot-daily.js`
- `tarot-spread.js`
- `tarot-result.js`
- `tarot-spread-result.js`

CSS is split by feature in `public/assets/css/`.

### Palmistry

Route:

- `src/pages/horoscope/palmistry/index.astro`

Main components:

- `src/components/PalmistryHandDiagram.astro`: reference hand with switchable main-line, minor-line, and nine-mount views.
- `src/components/PalmLineWidget.astro`: interactive reader covering 45 line variants, dominant/non-dominant hand context, and two-hand comparison.

Supporting assets:

- `public/assets/js/palmistry.js`
- `public/assets/js/palmistry-data.js`
- `public/assets/css/palmistry.css`
- `public/images/lines/`

Reading model:

- Layer 1: the base meaning of the selected line characteristic.
- Layer 2: dominant hand, non-dominant hand, or comparison context.
- Final result: base line meaning + hand context + comparison result.

The physical left/right hand is derived from the visitor's handedness. The dominant hand represents developed/current expression; the non-dominant hand represents underlying potential or earlier disposition. Comparing both hands describes continuity, strengthening, weakening, or changed expression without automatically labeling every difference good or bad.

### Tarot

Topic routes are generated from:

- `src/data/tarot-topic-pages.js`

Current focused one-card topics:

- `/tarot/love/`
- `/tarot/money/`
- `/tarot/career/`

The 78-card knowledge base uses:

- `src/data/tarot-meanings.js`
- `src/data/tarot-major-arcana-details.js`
- `src/pages/tarot/meanings/index.astro`
- `src/pages/tarot/meanings/[card].astro`
- Original Rider-Waite-Smith images under `public/assets/images/tarot/rws-jpg/` and thumbnails under `rws-thumb/`.

The public reading tone is Thai-first, with restrained Western context such as elements, astrology, numerology, and archetypes when it improves interpretation.

### Temple Hub

The temple section is under:

- `/temples/`
- `/temples/popular/`
- `/temples/mu/`
- `/temples/thailand/`
- `/temples/popular/[slug]/`
- `/temples/mu/[slug]/`

Current Thai labels:

- Top-level nav item: `วัดดังเสริมมงคล`
- Section/tab label for popular route package page: `สายไหว้พระ 9 วัด`
- Section/tab label for mu route package page: `สายมู`
- Hub section naming from previous UX direction: `วัดเด่นวัดดัง`

The target audience is Thai. Do not build English variants unless explicitly requested.

## Temple Data Flow

### Popular Temples

Source workbook:

- `/Users/point/Library/CloudStorage/GoogleDrive-purich.wc@gmail.com/My Drive/make-merit-9-temples-dataset.xlsx`

Runtime JSON:

- `src/data/popular-temples.json`

Count:

- 144 ranked places.

Important columns from workbook:

- `Summary` sheet ranking is column `M`.
- Column `N` was previously inspected/used as part of dataset review.

### Mu Temples

Source workbook:

- `/Users/point/Library/CloudStorage/GoogleDrive-purich.wc@gmail.com/My Drive/mu-temples-dataset.xlsx`

Runtime JSON:

- `src/data/mu-temples.json`

Count:

- 91 ranked places.

### Generated Excel Dataset

Known latest Excel dataset from previous work:

- `make-merit-9-temples-dataset.xlsx`

Scratch generator:

- `/tmp/9temples_work/build_9temples_research.mjs`

Regenerate command:

```sh
/Users/point/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node /tmp/9temples_work/build_9temples_research.mjs
```

Workbook sheets:

- `Summary`: metrics plus ranked temple list.
- `Temple_Route_Rows`: raw route occurrence rows.
- `Temple_Master`: unique temples/places.
- `Routes_Packages`: one row per route/package.
- `Route_Temples`: one row per temple in route.
- `Category_Dictionary`: taxonomy.
- `Source_Index_No_URL`: name is legacy; sheet includes `sourceUrl`.

Join keys:

- `routeId`
- `routeRowId`
- `templeMasterKey`
- `templeSequence`
- `sourceKey`

Important constraint:

- Do not use Python/openpyxl to write these workbooks.
- If editing the generator, use `apply_patch` on the generator and regenerate.
- For spreadsheet creation/modification, use `@oai/artifact-tool` through the bundled spreadsheet runtime.

### Temple Image Overrides

Image override helper:

- `src/data/temple-images.js`

Override data:

- `src/data/temple-image-overrides.json`

Placeholder image:

- `public/assets/images/temple-placeholder-auspicious.png`

The placeholder is intentionally muted so it does not compete with real photos.

Each temple/place image entry is intended to be Admin-editable later. Keep image fields data-driven.

### Coordinates

Location data is currently embedded in:

- `src/data/popular-temples.json`
- `src/data/mu-temples.json`
- Both source Excel files.

Location fields:

- `plusCode`: Google Maps/Open Location Code label for exact lookup.
- `latitude` / `longitude`: numeric coordinates for Leaflet rendering and fallback lookup.
- `travelModes`: semicolon-separated normalized travel modes from `Temple_Master`.
- `travelDetail`: structured transit access data for detail pages. Known keys include `summary`, `railAccess`, `boatAccess`, `busAccess`, `vanAccess`, `walkAccess`, `routes`, `sources`, `confidence`, and `updatedAt`.
- `travelDetail.routes`: normalized route objects for readable detail-page rendering. Known fields include `mode`, `stop`, `distanceText`, `routeText`, `operatorText`, `typeText`, and `isTransfer`.

When both `plusCode` and coordinates are present, outbound Google Maps links should prefer `plusCode`; Leaflet minimaps still use coordinates.

Coordinate source history:

- Nominatim/OpenStreetMap.
- ArcGIS World Geocoding Service.
- Namtang GTFS feed via Busmaps for public transport stops, route names, agencies, and route types.

Map payloads are generated from the JSON data by `TempleMapOverlay.astro`.

## Temple Components

### Listing Pages

Routes:

- `src/pages/temples/popular/index.astro`
- `src/pages/temples/mu/index.astro`

Shared behavior:

- Search input filters within the current page.
- Region tags filter by region.
- Province tags appear after selecting a region.
- Lazy loading reveals cards in batches with a `ดูเพิ่ม` fallback button.
- Cards link to detail pages.
- Region badges are color-coded by region.

Client JS:

- `public/assets/js/temple-directory.js`

CSS:

- `public/assets/css/temples.css`

### Temple Map Overlay

Component:

- `src/components/TempleMapOverlay.astro`

Client JS:

- `public/assets/js/temple-map.js`

CSS:

- `public/assets/css/temple-map.css`

Behavior:

- Floating map button.
- Opens large Leaflet map overlay.
- Uses Esri street tiles.
- Fetches Thailand boundary from `public/assets/data/thailand-boundary.geojson`.
- Uses marker clustering.
- Bounds are constrained to Thailand with a small tolerated edge.
- Marker popup shows image, rank, region, name, province/district, and detail link.

### Temple Detail Pages

Routes:

- `src/pages/temples/popular/[slug].astro`
- `src/pages/temples/mu/[slug].astro`

Component:

- `src/components/TempleDetail.astro`

Client JS:

- `public/assets/js/temple-detail.js`

CSS:

- `public/assets/css/temple-map.css`

Behavior:

- Back link and breadcrumb.
- Hero image with watermark. Detail annotation pins are intentionally hidden for now; keep future data shape Admin-editable.
- Thai title, summary, tags, share/copy actions.
- Mini Leaflet map with a single marker.
- Google Maps external link, preferring Plus Code with coordinate fallback.
- Metadata block with area and travel mode fields.
- Source-backed travel detail section, shown only when structured `travelDetail` data exists. It uses compact recommendation cards plus grouped route rows from `travelDetail.routes`, with legacy access strings kept as fallback.
- Travel-data confidence is presented as a Thai label plus a color-coded power bar. A lightweight circular `!` control stays on the right of the bar and opens a concise explanation of the green, gold, and light-brown levels.
  Desktop supports hover and keyboard focus; touch/mobile uses tap. The client script also closes the panel on outside click or Escape.
- Related cards from same province/region where possible.

Detail URL helper:

- `src/data/temple-slugs.js`

Slug convention:

- Rank is included and padded to 3 digits.
- Thai text is normalized and non-letter/number characters become hyphens.

### Temple Search Hero And Banners

Component:

- `src/components/TempleSearchHero.astro`

Data:

- `src/data/temple-page-banners.json`

Each banner has its own `adminKey`, image, and focal point. Banner images for different temple pages should remain separately configurable for a future Admin Portal.

## Thailand Temple Directory

Route:

- `src/pages/temples/thailand/index.astro`

Client JS:

- `public/assets/js/temple-directory.js`

Expected UX:

- Search field should not feel squeezed.
- Region must be selected before province.
- Province must be selected before district.
- District must be selected before subdistrict.
- Includes filters for ZIP code and `ได้รับวิสุงคามสีมา`.
- Does not display the temple code column.
- No `ดู` button in the table.
- Source text should be: `ระบบทะเบียนวัด สำนักงานพระพุทธศาสนาแห่งชาติ`
- Avoid long explanatory copy like "ใช้ข้อมูลจากไฟล์..."

Data source constraint:

- The all-Thailand temple directory uses the attached/provided `Report_Temple 2.numbers` only.
- Do not scrape/export that data from the web unless the user explicitly changes this constraint.

## Current Deployment Workflow

Typical checks:

```sh
npm run check
npm run build
```

Verification is intentionally proportional to reduce unnecessary usage:

- Small UI changes: targeted desktop/mobile browser checks plus `check` and `build`.
- Full E2E: tested-route changes, shared interaction changes, visual baseline work, or a planned release sweep.
- Broad NFR: periodic maintenance/release sweep, except focused CMS validation remains mandatory for page registry/navigation changes.

Development server:

```sh
npm run dev -- --host 127.0.0.1 --port 4324
```

Production deployment:

```sh
vercel --prod --yes
```

Git workflow:

```sh
git status --short
git add <files>
git commit -m "<message>"
git push origin main
vercel --prod --yes
```

Do not add `outputs/` unless explicitly requested.

## Design Constraints

Use Thai-first copy and typography. Avoid English UI labels unless they are brand names, source names, or external service names.

Important UI decisions:

- Loading/progress should match the auspicious site tone, not plain black spinner styling.
- Thai display headlines need enough line-height and spacing so vowels/tone marks do not collide with eyebrows or neighboring text.
- Form action buttons such as `ผูกดวง` should stay near the bottom of the form flow when requested.
- Operational/search interfaces should remain usable and dense enough, not become landing pages.
- Cards may be used for repeated items and framed tools; avoid unnecessary card nesting.

## Known External References

Notenwert local reference project:

- `/Users/point/notenwert`
- Production reference: `https://notenwert.vercel.app/`

Features copied/adapted from Notenwert:

- Floating map overlay concept.
- Detail page hero/annotation/share/map patterns.

Wat Portal visual reference:

- `https://www.watportal.com/th/wat/type/index/id/1`
- `https://www.watportal.com/th/wat/type/index/id/2`

Use these as inspiration only; Mongkol Wela should keep its own Thai tone and CI.
