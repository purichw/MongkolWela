# AGENTS

This file is for coding agents working in this repository.

## First Steps

At the start of a new repo session, a broad feature, a risky change, or any
task where ownership is unclear:

1. Read `AGENTS.md`.
2. Read `Architecture.md`.
3. Read `Roadmap.md`.
4. Run:

```sh
git status --short --branch
```

Expected current clean-ish state may include:

```text
?? outputs/
```

For tiny follow-ups after the project context is already loaded, keep the
preflight proportional: read this file, run `git status --short --branch`, then
read only the owner files and nearby selectors/data needed for the requested
change.

`outputs/` is a local artifact directory from previous work. Do not add, delete, or modify it unless the user explicitly asks.

## Project

This is the Mongkol Wela Astro site.

- Workspace: `/Users/point/Website Projects/hora-astro`
- Production: `https://mongkolwela.vercel.app`
- GitHub: `purichw/hora-astro`
- Default branch: `main`

Also read `CMS.md` when changing Admin Portal content, page registry, or navigation.

## Commands

Install:

```sh
npm install
```

Run dev server:

```sh
npm run dev -- --host 127.0.0.1 --port 4324
```

Check:

```sh
npm run check
```

Build:

```sh
npm run build
```

Deploy production:

```sh
vercel --prod --yes
```

Smoke-test production after deploy:

```sh
npm run smoke:production
```

## Editing Rules

- Use `apply_patch` for manual file edits.
- Do not revert user changes.
- Do not run destructive git commands unless the user explicitly requests them.
- Keep edits scoped to the requested behavior.
- CSS/JS are emitted with content hashes. Use `src/config/styles.js` for route CSS ownership; no manual version bumps.
- Do not add `outputs/` unless explicitly requested.

## Language And Product Direction

- The site is Thai-first.
- Do not build English routes/copy unless explicitly requested.
- Keep UI copy concise, Thai, and consistent with Mongkol Wela.
- Avoid long visible explanations about data sources or internal implementation.
- Use the exact source text for the all-Thailand temple directory:
  `ระบบทะเบียนวัด สำนักงานพระพุทธศาสนาแห่งชาติ`

## Design Rules

Before adding repeated public UI, consult `docs/shared-ui.md` and reuse its
canonical components/styles. Keep page geometry and responsive composition local;
shared changes require representative desktop/mobile before-and-after checks.

For mockup-led UI adaptation, read `docs/mockup-adaptation-lessons.md` before
implementation and use `$mockup-to-product` when available. Treat composition,
mobile layout, icon/material/motif details and overall proportions as part of
the requested design, not optional later polish. Review the full requested
surface proactively; do not wait for point-by-point corrections. Keep effort
proportional for tiny follow-ups. Explicit exact/pixel-perfect requests still
use `$reference-to-a-tee`; do not weaken their fidelity requirements.

- Match the existing CI: warm paper background, lacquer red, jade/green, gold, restrained sacred tone.
- Avoid making operational pages into landing pages.
- Use cards for repeated items and genuine tools only.
- Avoid card nesting.
- Keep Thai headings readable with enough line-height for vowels and tone marks.
- Make sure mobile text does not overflow or overlap.
- Use real/place images where possible; use the muted auspicious placeholder only as fallback.
- Region tags on temple cards are color-coded by region and should not all be green.

## Data Rules

### Admin Portal CMS Content

- Runtime precedence: valid current Admin Portal/API content is the live source
  for visitors and must not be overridden by bundled fallback JSON, cache, or
  older stale CMS copies.
- `public/admin/content/live.json` and `default.json` are build/development seed
  data, not production runtime failover sources.
- After adding/removing/renaming pages or navigation items, run `npm run nfr:cms`.
- Never seed over live Admin edits during a routine deploy. Explicit content migrations must preserve current published values.
- Production verification must include `npm run cms:verify:production` or `npm run smoke:production`; both catch stale `/api/admin/content` page/nav data.
- Supabase is authoritative when configured; otherwise authenticated GitHub is
  authoritative. Failure returns 503 rather than another source. Browser reloads
  show an error/retry state. Schema versions validate shape, not content freshness.

### Excel Workbooks

Important workbook paths:

- `/Users/point/Library/CloudStorage/GoogleDrive-purich.wc@gmail.com/My Drive/make-merit-9-temples-dataset.xlsx`
- `/Users/point/Library/CloudStorage/GoogleDrive-purich.wc@gmail.com/My Drive/mu-temples-dataset.xlsx`

Do not use Python/openpyxl to write these workbooks.

If spreadsheet editing is needed:

- Use the spreadsheet/artifact-tool workflow.
- If editing the generator, patch the generator first and regenerate.

Scratch generator:

```sh
/Users/point/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node /tmp/9temples_work/build_9temples_research.mjs
```

### Runtime JSON

Temple data used by the site:

- `src/data/popular-temples.json`
- `src/data/mu-temples.json`
- `src/data/temple-image-overrides.json`
- `src/data/temple-page-banners.json`

Keep fields data-driven for future Admin Portal replacement.

### Thailand Temple Directory

All-Thailand temple directory data must come from the provided `Report_Temple 2.numbers` source only unless the user explicitly changes this.

Do not scrape/export that data from a website on your own.

## Temple Feature Map

Important routes:

- `/temples/`
- `/temples/popular/`
- `/temples/mu/`
- `/temples/thailand/`
- `/temples/popular/[slug]/`
- `/temples/mu/[slug]/`

Important components:

- `src/components/TempleSearchHero.astro`
- `src/components/TempleMapOverlay.astro`
- `src/components/TempleDetail.astro`

Important scripts:

- `src/scripts/temple-directory.js`
- `src/scripts/temple-map.js`
- `src/scripts/temple-detail.js`

Important CSS:

- `src/styles/temples.css`
- `src/styles/temple-map.css`

## Horoscope Feature Map

Important routes:

- `/horoscope/palmistry/`
- `/tarot/daily/`
- `/tarot/monthly/`
- `/tarot/luck/`
- `/tarot/love/`
- `/tarot/money/`
- `/tarot/career/`
- `/tarot/meanings/`
- `/tarot/meanings/[card]/`

Palmistry:

- `src/pages/horoscope/palmistry/index.astro`
- `src/components/PalmistryHandDiagram.astro`
- `src/components/PalmLineWidget.astro`
- `src/scripts/palmistry.js`
- `src/scripts/palmistry-data.js`
- `src/styles/palmistry.css`

Tarot:

- `src/data/tarot-topic-pages.js`
- `src/data/tarot-meanings.js`
- `src/data/tarot-major-arcana-details.js`
- `src/scripts/tarot-data.js`
- `src/scripts/tarot-spread.js`
- `src/scripts/tarot-spread-result.js`
- `src/styles/tarot.css`

## Verification Expectations

Use proportional verification so small edits do not burn usage on broad suites.

Quick CI is always required before commit/deploy:

- `git diff --check`
- `npm run check`
- `npm run build`
- `git status --short --branch`

Workflow modes:

- Quick patch: make only the requested change; do not commit, push, or deploy.
- Batch mode: collect multiple requests, then test and deploy once.
- Production mode: run full commit, push, deploy, and production smoke.
- Skip Browser verification when the change is not behavior-critical.
- Final summaries should stay short: files changed plus test results.

During small iterative edits:

- Do not run `npm run nfr`.
- Do not run full E2E.
- Run `git diff --check`.
- For tiny copy/CSS/selector/spacing/typography edits, use one relevant
  Browser/computed-style/snapshot spot-check when the change is visible.
- Add desktop plus mobile Browser coverage only when the edit touches responsive
  layout, shared navigation, touch behavior, text wrapping, or when preparing to
  commit/deploy.

Before commit:

- Run `npm run check`.
- If the change touches CSS/markup for one page, run only the targeted E2E test when one clearly covers that page, or skip E2E when Browser verification is already clear.
- Run `git status --short --branch`.

Before deploy:

- Run `npm run build`.
- Run targeted smoke checks for the route(s) touched.

After deploy:

- Smoke-test production on key route(s) plus the route(s) touched.

NFR:

- Do not run NFR on every deploy.
- Batch NFR into release/maintenance sweeps, such as before a large release, after CMS/SEO/data/config work, or about weekly.
- Keep a checklist of deferred NFR/E2E coverage when intentionally batching those checks.

## QA Defaults

For every feature with new or changed behavior, infer QA coverage instead of waiting for the user to write test cases:

1. Draft acceptance criteria from the request and repo context as itemized lists.
2. Add or propose a QA matrix row covering feature, scenario, expected result, source of truth, test type, and priority.
3. Recommend the automation level: static validation, focused script, Playwright E2E, visual snapshot, Browser spot-check, or production smoke.
4. Ask only when a business rule or expected result cannot be safely inferred.

When adding or changing automation, make sure the test would fail if the feature broke. Prefer fail-first validation for important behavior when it can be done safely.

For frontend behavior, layout, or responsive changes, verify at least one
relevant desktop and mobile viewport. For micro visual edits with no responsive
risk, one targeted viewport or computed-style check is enough before continuing.

Keep verification proportional to the change:

- Use targeted browser checks for small UI changes.
- Run full E2E only when changing a tested route, shared interaction contract, or visual baseline.
- Run broad `npm run nfr` periodically as a release/maintenance sweep rather than after every small change.
- `npm run nfr:cms` remains required when page registry or navigation content changes.

For map changes, verify:

- Leaflet loads.
- Markers render.
- No console errors.
- Thailand bounds are respected.
- Detail links work.

For deployment tasks:

1. Commit only intended files.
2. Push `main`.
3. Run `vercel --prod --yes`.
4. Smoke-test production.

## Temple Detail Confidence UI

The travel-data confidence indicator on temple detail pages is implemented by:

- `src/components/TempleDetail.astro`
- `src/styles/temple-map.css`
- `src/scripts/temple-detail.js`

Preserve these interaction rules:

- Show the Thai confidence label next to `ความมั่นใจข้อมูล`.
- Keep the power bar and the circular `!` information control on the same row.
- Keep the information control visually light and transparent; its glyph must be optically centered.
- Desktop users can reveal the explanation by hover or keyboard focus.
- Touch/mobile users can tap to open or close it.
- Clicking outside or pressing Escape closes an open explanation.
- The panel explains the green, gold, and light-brown levels in concise visitor-facing Thai.
- Verify that the panel does not create horizontal overflow or sit behind the map.

## References

Local Notenwert reference project:

- `/Users/point/notenwert`

Notenwert production:

- `https://notenwert.vercel.app/`

Wat Portal references:

- `https://www.watportal.com/th/wat/type/index/id/1`
- `https://www.watportal.com/th/wat/type/index/id/2`

Use references for behavior/layout inspiration only. Keep Mongkol Wela visually and linguistically distinct.
