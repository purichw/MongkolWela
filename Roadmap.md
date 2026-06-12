# Roadmap

Last updated: 2026-06-12

## Current Status

Production is live at:

- `https://mongkolwela.vercel.app`

Latest known code state:

- Branch: `main`
- The current release includes the confidence power bar, visitor-facing level definitions, and responsive `!` explanation control.
- The worktree may contain unrelated user changes and generated test artifacts; inspect status and stage only intended files.

## Recently Completed

- Built Thai-first temple hub and subroutes.
- Added `สายไหว้พระ 9 วัด` page at `/temples/popular/`.
- Added `สายมู` page at `/temples/mu/`.
- Added detail pages for both collections.
- Added lazy loading and `ดูเพิ่ม` fallback for temple cards.
- Added search/filter within each collection page.
- Added region and province filtering for collection pages.
- Added region color badges in temple cards.
- Added placeholder image behavior for missing or broken card images.
- Added floating map overlay for popular and mu collections.
- Added Thailand-bounded Leaflet maps with clustered markers.
- Added coordinates to JSON data and both Excel workbooks.
- Added mini map, annotation pins, share/copy buttons, metadata, and related cards to detail pages.
- Added separate banner configuration for temple pages through `src/data/temple-page-banners.json`.
- Added normalized travel route objects and readable grouped travel details on temple detail pages.
- Added a global scroll progress indicator.
- Replaced the old top loading bar with a session-aware transparent overlay loader, vector outline icon animation, simulated progress, and timeout messaging.
- Refined the loader into a soft full-page smoke treatment without a visible framed panel.
- Added Thai travel-data confidence labels and a color-coded power bar to temple detail pages.
- Added a concise `!` explanation control beside the power bar with hover/focus support on desktop and tap support on mobile.
- Added `/horoscope/palmistry/` with a switchable hand reference diagram, 45 line characteristics, nine mounts, handedness selection, dominant/non-dominant readings, and two-hand comparison.
- Added focused Tarot pages for love, money, and career.
- Added the 78-card Tarot meaning index and individual card pages using original Rider-Waite-Smith imagery.
- Added detailed Thai-first Major Arcana interpretations with restrained Western context.
- Added the Palmistry and Tarot pages to the code-owned Admin Portal page registry/navigation.
- Deployed latest changes to production.

## Current Working Set

No confidence-indicator implementation remains pending after the current release.
Keep unrelated Admin Portal/Tarot changes, visual snapshots, `.claude/`, Playwright reports, `public/images/hand.png`, and test artifacts out of unrelated commits unless explicitly requested.

Checks already completed for the confidence refinement:

- `npm run check`
- `npm run build`
- Targeted desktop and mobile browser verification
- Tooltip open/close behavior, Escape handling, no horizontal overflow, and no console errors

## CMS Content Guardrail

Admin Portal page registry and navigation are code-owned in `public/admin/content/live.json`.
Keep `public/admin/content/default.json` in sync for the same page/nav entries.

When adding a new feature page or menu item:

1. Update both CMS JSON files.
2. Run `npm run nfr:cms`.
3. Run `npm run db:seed:cms` when Supabase env is available, so production database content is not stale.
4. After deploy, run `npm run cms:verify:production` or `npm run smoke:production`.

This prevents `/api/admin/content` from overwriting the rendered nav with an older Admin Portal copy.

## High-Priority Backlog

### Admin Portal

Build an Admin Portal or content management path so these can be edited without code changes:

- Temple/place names.
- Rankings.
- Card images and fallback images.
- Detail hero images.
- Detail annotation pin placement/editing, including x/y position and label fields. Pins are currently hidden on the public detail hero.
- Banner images per page.
- Plus Codes and coordinates, with Plus Code as the Google Maps default and coordinates as fallback.
- Travel modes.
- Blessings/object hero/type fields.
- Detail content sections.

Keep current JSON fields data-driven so Admin data can replace static JSON later.

### Temple Detail Content Expansion

Detail pages currently use available dataset fields. Future content can add:

- Full description.
- Visit notes.
- Worship flow.
- Opening hours if available.
- Official/source links.
- Gallery images.
- Related route packages.

Avoid inventing religious or travel details without a source.

### Image Quality Review

Many images have been improved, but future QA should continue checking:

- Broken images.
- Placeholder usage.
- Non-location images.
- Images that show unrelated statues/groups instead of the actual place.
- Duplicate or low-confidence images.

Current fallback:

- `/assets/images/temple-placeholder-auspicious.png`

### All-Thailand Temple Directory

Continue refining `/temples/thailand/`:

- Use only `Report_Temple 2.numbers` as the source unless the user changes direction.
- Keep region -> province -> district -> subdistrict dependency.
- Keep ZIP code filter.
- Keep `ได้รับวิสุงคามสีมา` filter.
- Do not show temple code column.
- Keep source text short: `ระบบทะเบียนวัด สำนักงานพระพุทธศาสนาแห่งชาติ`
- Avoid long source/process explanations in the UI.

## Medium-Priority Backlog

### Navigation Cleanup

Project direction is Thai-first. Check for stale English navigation/routes/copy if the user asks for cleanup.

Current README may still mention `/en/` from earlier project state; verify actual route/code before changing.

### Detail Page Interaction Polish

Potential polish items:

- Re-enable hero annotation pins after Admin-owned pin data exists.
- Make annotation pane richer when Admin data exists.
- Add native share fallback states for older browsers.
- Add "nearby in map" preview if related coordinates are nearby.

### Map Enhancements

Possible future map features:

- Filter markers by region/province inside the map overlay.
- Add route grouping.
- Open detail preview cards from map search results.
- Add "fit current filtered results" when page filters are active.
- Add map state sync to current page search/filter.

### Data Refresh Pipeline

The JSON files are currently static outputs. Future pipeline could:

- Regenerate JSON from Excel reliably.
- Validate required fields.
- Validate image URLs.
- Validate Plus Codes, coordinates, and travel modes.
- Validate structured travel detail coverage and avoid invented route/vendor defaults when no source supports them.
- Regenerate `travelDetail.routes` from the source workbook/generator when the travel source pipeline changes.
- Produce a QA report for missing images/coordinates.

Keep workbook writing through artifact-tool, not Python/openpyxl.

## Low-Priority Backlog

- Update `README.md` to match the current Thai-first site and temple architecture.
- Add screenshots for key routes.
- Add a lightweight smoke-test script using Playwright if the project starts running frequent UI edits.
- Add source attribution docs for image and coordinate providers.

## Known Data Files

Excel workbooks:

- `/Users/point/Library/CloudStorage/GoogleDrive-purich.wc@gmail.com/My Drive/make-merit-9-temples-dataset.xlsx`
- `/Users/point/Library/CloudStorage/GoogleDrive-purich.wc@gmail.com/My Drive/mu-temples-dataset.xlsx`

Runtime JSON:

- `src/data/popular-temples.json`
- `src/data/mu-temples.json`
- `src/data/temple-image-overrides.json`
- `src/data/temple-page-banners.json`

Scratch generator:

- `/tmp/9temples_work/build_9temples_research.mjs`

## Verification Checklist

For normal code/CSS/JS work:

```sh
npm run check
npm run build
```

For visual work:

- Start local dev server.
- Verify desktop and mobile viewports.
- Check console errors.
- Check no text overlap.
- Check card/tag/image state.

For production deploy:

```sh
git push origin main
vercel --prod --yes
npm run smoke:production
```

Then review the smoke output before sharing the deployment.

### Deferred Batch Checks

To conserve usage without weakening normal project integrity, collect these for a periodic release/maintenance sweep unless the current change directly affects them:

- Full `npm run nfr`
- Full `npm run test:e2e`
- Broad visual snapshot review
- Cross-route regression sweep
- Extended accessibility/performance review

Do not defer focused CMS validation when changing Admin Portal page registry or navigation.

## Product Decisions To Preserve

- Audience is Thai.
- Do not continue English version work unless explicitly requested.
- The `วัดดังเสริมมงคล` section includes temple collection pages and the all-Thailand directory as distinct sections.
- `สายไหว้พระ 9 วัด` and `สายมู` collection pages should be similar in search/filter/card/lazy-load/map/detail behavior.
- Data and images should remain editable in a future Admin Portal.
- Use source-backed data for temple facts; do not invent unsupported content.
