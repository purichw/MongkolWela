# AGENTS

This file is for coding agents working in this repository.

## First Commands

Start every coding task with:

```sh
git status --short --branch
```

Expected current clean-ish state may include:

```text
?? outputs/
```

`outputs/` is a local artifact directory from previous work. Do not add, delete, or modify it unless the user explicitly asks.

## Project

This is the Mongkol Wela Astro site.

- Workspace: `/Users/point/hora-astro`
- Production: `https://mongkolwela.vercel.app`
- GitHub: `purichw/hora-astro`
- Default branch: `main`

Read these before substantial work:

- `Architecture.md`
- `Roadmap.md`
- `CMS.md` when changing Admin Portal content, page registry, or navigation.

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
- Bump `assetVersion` in `src/layouts/BaseLayout.astro` when changing public CSS/JS.
- Bump query strings in `public/styles.css` when changing imported CSS that needs cache invalidation.
- Do not add `outputs/` unless explicitly requested.

## Language And Product Direction

- The site is Thai-first.
- Do not build English routes/copy unless explicitly requested.
- Keep UI copy concise, Thai, and consistent with Mongkol Wela.
- Avoid long visible explanations about data sources or internal implementation.
- Use the exact source text for the all-Thailand temple directory:
  `ระบบทะเบียนวัด สำนักงานพระพุทธศาสนาแห่งชาติ`

## Design Rules

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

- `public/admin/content/live.json` is the code-owned source of truth for deployable Admin Portal content.
- Keep `public/admin/content/default.json` in sync with `live.json` for pages and navigation.
- After adding/removing/renaming pages or navigation items, run `npm run nfr:cms`.
- If Supabase env is configured, run `npm run db:seed:cms` after page/nav changes so `cms_documents/live` does not serve stale content.
- Production verification must include `npm run cms:verify:production` or `npm run smoke:production`; both catch stale `/api/admin/content` page/nav data.

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

- `public/assets/js/temple-directory.js`
- `public/assets/js/temple-map.js`
- `public/assets/js/temple-detail.js`

Important CSS:

- `public/assets/css/temples.css`
- `public/assets/css/temple-map.css`

## Verification Expectations

For any implementation:

```sh
npm run check
npm run build
```

For frontend changes, verify at least one relevant desktop and mobile viewport.

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

## References

Local Notenwert reference project:

- `/Users/point/notenwert`

Notenwert production:

- `https://notenwert.vercel.app/`

Wat Portal references:

- `https://www.watportal.com/th/wat/type/index/id/1`
- `https://www.watportal.com/th/wat/type/index/id/2`

Use references for behavior/layout inspiration only. Keep Mongkol Wela visually and linguistically distinct.
