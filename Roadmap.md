# Roadmap

Updated: 2026-10-15. Release preparation covers this chat's Tarot editorial
integration, full-deck draw layout and documentation updates. Remote baseline
`e4ee69b` already has successful CI and Production Smoke; it must be preserved.

## Current Status

### Member Favorites Follow-Up (2026-09-27)

- When implementing the member area, restore the heart / favorite action on the
  shared Visitor collection cards (Popular, Sacred and Mu).
- Bind saved places to the signed-in member account and provide a member favorites
  view, with signed-out, saved, unsaved and error states.
- Until the member feature exists, deliberately omit the heart button. Do not
  substitute browser-only favorites. This follows the user's explicit decision.

Production is live at:

- `https://mongkolwela.vercel.app`

Previous release verified in this chat (2026-09-30):

- Commit: `303d84cea0b1dff6d0f4151dd58f2a1a10035087`, pushed to `main`, CI passed
  and production promotion verified for the same SHA.
- Admin supports automatic/custom English place slugs across popular, mu and
  sacred collections. All 625 curated records have mappings; stable CMS/planner
  keys and old URL aliases are retained.
- Place details and sitemap use live CMS-backed SSR. New places/slug edits need
  no rebuild. CMS failure returns 503, never a stale bundled document.
- Astro/Vercel output is `dist/client/` plus `.vercel/output/`; framework config
  and the 12-function deployment limit were checked.
- See [slug release evidence](docs/temple-slugs.md#release-evidence-2026-09-30)
  for exact CI/deployment references and read-only production checks.
- These are dated release facts, not a claim that production cannot have changed
  since. Inspect current checkout status and remote state before the next release.

Earlier editorial handoff (2026-10-04): the
[78-card Tarot Deep Research prompt](docs/research/tarot-78-deep-research-prompt.md)
was prepared. The accepted reduced research bundle was integrated on 2026-10-15;
see [Tarot editorial integration](docs/tarot-editorial-integration.md). Release
completion requires CI, production revision verification and read-only smoke.

## Earlier Feature Milestones

Historical implementation list; current CMS authority and release status above
supersede older deployment assumptions. Feature presence does not imply complete
data coverage or a fresh all-route QA pass.

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
- Registered the Palmistry and Tarot pages in Admin bootstrap data; published
  page/navigation edits now belong to the configured live CMS.
- Added Admin Portal drag-and-drop temple ranking plus compact manual up/down controls for the selected sidebar item.
- Added `/temples/planner/` for trip planning with auto trip generation, manual selection, nearby search, radius controls, route estimates, draggable selected-place chips, replace/reorder controls, and trip-condition filtering.
- Refined planner UX so search/filter criteria are applied explicitly, auto trip actions warn only after a trip/list exists, and manual selection remains separate from generated trip criteria.
- Added staggered reveal animation and manual `ดูเพิ่ม` behavior for temple card lists while keeping page performance predictable.
- Added a lightweight all-Thailand temple directory index so filters and the first-page preview do not require loading the full raw dataset immediately.
- Cleaned the calendar navigation: `วันพระ` is now the direct top-level nav link to `/calendar/`; stale `ฤกษ์และปฏิทิน` menu items are no longer restored by CMS hydration.
- Delivered the initial temple/planner/calendar navigation milestones. See the
  dated release evidence above rather than treating this list as a release log.

## Current Working Set

The user authorized push/deploy of this chat's work on 2026-10-15: 78-card / 468
context editorial data, CMS mappings, six full-deck draw pages, focused tests and
the related documentation. Preserve unrelated files and existing visual artifacts;
exclude generated screenshots, test reports and baseline source copies from Git.

The September release passed targeted runtime, browser, CMS, SEO, build and
production smoke checks. Full-site performance budgets still had six failures
also present in the comparison baseline; thresholds were not weakened. Details
and coverage boundaries are in [Temple URL Slugs](docs/temple-slugs.md#verification).

## CMS Content Guardrail

Published page content and navigation belong to the configured live CMS source.
Bundled `live.json` and `default.json` are build/bootstrap seeds only.

When adding a new feature page or menu item:

1. Update route code and build seeds as needed, then publish the intended navigation change through Admin without replacing unrelated live edits.
2. Run `npm run nfr:cms`.
3. Do not run `npm run db:seed:cms` during routine deploys.
4. After deploy, run `npm run cms:verify:production` or `npm run smoke:production`.

Live-source errors are explicit and retryable; bundled content never overrides a newer publish or silently substitutes for a failed source. Schema versions are not content timestamps. See `CMS.md` for the current contract.

## High-Priority Backlog

### CMS Coverage Maintenance

Admin is implemented, not a future replacement for JSON. Use [CMS.md](CMS.md),
[workspace coverage](docs/cms-workspace-coverage.md) and the
[place editor](docs/admin-place-editor.md) as the ownership map.

- For any new supported Visitor field, trace editor -> local draft -> validated
  publication -> live read -> every relevant Visitor consumer, including an
  explicit empty value and reset behavior.
- Preserve stored overrides, permissions and revision conflicts during schema
  changes. Do not use a seed deployment as a substitute for content migration.
- Distinguish missing place data from missing editor/runtime support. Add only
  evidenced gaps to the backlog rather than rebuilding existing controls.

### Tarot Research And Integration

- Integrated locally on 2026-10-15: 78 cards, six upright contexts (468 blocks),
  general reversed meanings, card-specific Minor meanings and topic results.
  The user accepted this reduced scope instead of the earlier 936/1,560 matrix.
- Original IDs, names, media, existing CMS overrides and field paths are retained.
  Five new context branches and monthly position guidance are editable in CMS.
- Monthly uses card-specific monthly content plus position guidance, not an
  automatic ten-card synthesis engine. Research spread examples remain references.
- Remaining release work: authorized publication/deploy and production smoke;
  optional independent Thai editorial proofreading. See the
  [integration record](docs/tarot-editorial-integration.md).
- Extending four topic draws beyond Major Arcana or implementing reversed draws
  requires separate behavior changes and tests. See the research prompt and
  [CMS import boundary](CMS.md#tarot-research-and-editorial-import).

### Performance Debt

Reduce the recorded aggregate JS/CSS, Admin chunk and route stylesheet budget
overruns. Re-measure the intended revision against a clean baseline before
claiming a fix; keep comparison source outside typecheck discovery and retain
the existing budget thresholds.

### Temple Detail Content Expansion

Detail pages already support descriptions, visit information and images. Improve
source-backed coverage per place; do not confuse an empty field with a missing
feature. Candidate enrichment includes:

- Full description.
- Visit notes.
- Worship flow.
- Verified opening hours and entry fees where missing.
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

The user changed direction in October 2026: use navigable mapped places, allow
OpenStreetMap and manual CMS entries, and do not require Google Places billing.
The initial implementation replaces the public registry table with a quality-gated
OSM-derived catalog and compact shared CMS editor. The raw registry retains
41,316 rows after the approved 3,389-row cleanup on 2026-10-16.
See `docs/thailand-directory.md` for coverage, source policy and verification.

The dated national OSM import now provides a 7,918-place merged baseline in all
77 provinces, protecting all 625 curated memberships. Raw source metadata is
retained for future multi-facet search. Watportal indexing/detail coverage and
deletion proposals are separate artifacts: a full index does not imply all detail
pages or coordinates were fetched. The approved cleanup has an exact receipt and
preserves the shared CMS geographic choices independently of temple records.

## Medium-Priority Backlog

### Navigation Cleanup

Project direction is Thai-first. Check for stale English navigation/routes/copy if the user asks for cleanup.

English/romanized place slugs are explicitly approved URL identifiers, not an
English-language version of the site. Do not revert them during language cleanup.

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

- Refresh route documentation and screenshots when their owning features change.
- Extend the existing smoke/Playwright suites for evidenced coverage gaps.
- Add source attribution docs for image and coordinate providers.

## Known Data Files

Excel workbooks:

- `/Users/point/Library/CloudStorage/GoogleDrive-purich.wc@gmail.com/My Drive/make-merit-9-temples-dataset.xlsx`
- `/Users/point/Library/CloudStorage/GoogleDrive-purich.wc@gmail.com/My Drive/mu-temples-dataset.xlsx`

Runtime JSON:

- `src/data/popular-temples.json`
- `src/data/mu-temples.json`
- `src/data/sacred-temples.json`
- `src/data/temple-image-overrides.json`
- `src/data/temple-page-banners.json`

Scratch generator:

- `/tmp/9temples_work/build_9temples_research.mjs`

## Verification Checklist

Use proportional verification to conserve usage during normal iteration.

Documentation-only work checks references and `git diff --check`; it does not
require a build, screenshot or production request. For an authorized code release,
required checks include:

- `git diff --check`
- `npm run check`
- `npm run build`
- `git status --short --branch`

Workflow modes:

- Quick patch: make only the requested change; do not commit, push, or deploy.
- Batch mode: collect multiple requests, then test and deploy once.
- Production mode: run full commit, push, deploy, and production smoke.
- Skip browser verification for documentation-only changes; visible edits need
  targeted visual evidence even when behavior is unchanged.
- Keep final summaries short: files changed plus test results.

For every feature with new or changed behavior:

- Infer acceptance criteria from the request and repo context as itemized lists.
- Add or propose a QA matrix row with feature, scenario, expected result, source of truth, test type, and priority.
- Recommend whether coverage should be static validation, focused script, Playwright E2E, visual snapshot, Browser spot-check, or production smoke.
- Ask the user only when the expected result depends on a business rule that cannot be safely inferred.
- For important behavior, prefer safe fail-first validation so the automation proves it catches the protected failure.

During small iterative edits:

- Do not run `npm run nfr`.
- Do not run full E2E.
- Run `git diff --check`.
- For tiny visual edits, use one relevant viewport/computed-style check. Add
  desktop/mobile coverage when responsive or shared-interaction risk is touched.

Before commit:

- Run `npm run check`.
- If CSS/markup changed for one page, run only the targeted E2E test when one clearly applies, or skip E2E when Browser verification is already clear.
- Run `git status --short --branch`.

Before deploy:

- Run `npm run build`.
- Run targeted smoke checks for touched route(s).

After deploy:

- Smoke production on important route(s) plus touched route(s).

For visual work:

- Start local dev server.
- Verify desktop and mobile viewports.
- Check console errors.
- Check no text overlap.
- Check card/tag/image state.

### Release Workflow

1. Require explicit current-task authorization. Inspect the active checkout and
   commit only intended files; do not switch worktrees or deploy another chat's work.
2. Record the full intended commit SHA and check the remote after pushing. Track
   push completion, required CI, build readiness and production promotion separately.
3. Inspect existing GitHub runs and Vercel Git-triggered deployments before any
   manual workflow dispatch or CLI deployment. Use the full SHA: a short-SHA
   `gh run list --commit` lookup missed an existing run during the slug release.
   Do not automatically follow a Git push with a duplicate `vercel --prod`.
4. Use recent comparable successful runs to set checkpoints. Without better
   evidence, investigate a push without progress at 2 minutes, missing CI/deploy
   at 3 minutes, queued/no-progress work at 5 minutes, or build/CI at 10 minutes.
   These are diagnostic checkpoints, not permission to retry, cancel or weaken gates.
   Investigate failures immediately and promotion still pending 2 minutes after
   build/check readiness. Compare actual step/log progress, not status alone.
   With a baseline, investigate beyond the greater of 1.5 times normal duration
   or normal duration plus 2 minutes; adjust only for evidenced long phases.
5. On a trigger, inspect the exact SHA/run/deployment and first causal errors.
   Recheck remote state before retrying uncertain pushes. Allow at most one
   unchanged diagnostic rerun with transient-cause evidence; repeated causes or
   two failed repairs require a new hypothesis before retrying.
6. Verify the production alias serves the intended SHA, then run
   `npm run smoke:production` and targeted read-only route/asset checks. Record
   uncovered surfaces and pre-existing failures rather than claiming all gates pass.

Use `scripts/smoke-production.mjs` and its existing request headers for the
approved production harness. Plain requests may receive a Vercel Security
Checkpoint 429; protected candidates may require the authenticated `vercel curl`
flow as well. Distinguish these from application responses, never disable the
firewall to obtain a green check, and never put bypass credentials in docs/logs.
CMS mutation tests belong in fixtures or explicitly authorized UAT, not a routine
read-only production smoke. See [slug evidence](docs/temple-slugs.md) for the
previous release's boundaries.

### Deferred Batch Checks

To conserve usage without weakening normal project integrity, collect these for a periodic release/maintenance sweep unless the current change directly affects them:

- Full `npm run nfr`
- Full `npm run test:e2e`
- Broad visual snapshot review
- Cross-route regression sweep
- Extended accessibility/performance review

Run NFR as a batch before a large release, after CMS/SEO/data/config work, or about weekly. Do not run it on every deploy.

Do not defer focused CMS validation when changing Admin Portal page registry or navigation.

## Product Decisions To Preserve

- Audience is Thai.
- Do not continue English version work unless explicitly requested.
- The `วัดดังเสริมมงคล` section includes temple collection pages and the all-Thailand directory as distinct sections.
- Popular, mu and sacred collections share search/filter/card/load-more/map/detail
  contracts; their current default labels are `วัดดังน่าไป`, `พิกัดสายมู` and
  `วัดเด่นขอพร`. Do not fix a shared behavior in only one collection.
- Keep supported data/images editable through the existing Admin Portal and
  synchronized with their Visitor consumers.
- Use source-backed data for temple facts; do not invent unsupported content.
