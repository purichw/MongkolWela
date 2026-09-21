# Planner Responsive Implementation

Date: 2026-09-21. Route: `/temples/planner/`. Local implementation, not deployed.

## Authority And Reading

Read all 12 files from `mongkolwela-planner-responsive-handoff.zip`: README,
implementation prompt, the complete 912-line responsive specification, reference
notes and approved image, both source-handoff documents, QA checklist, all 64
acceptance cases, historical API snapshot, manifest and verifier. Package hashes
and snapshot arithmetic passed the supplied verifier. That is package validation,
not proof of application correctness or current production data.

The responsive specification governs behavior omitted or contradicted by the
illustrative image. Real API/data semantics take priority over illustrative
counts, photos, map geometry and advertising claims. Applied `mockup-to-product`
and the project's Home rework lessons; this is not a pixel-exact reproduction.

## Preserve / Translate / Adapt

| Preserve | Translate | Adapt |
| --- | --- | --- |
| Existing planner API, engine, published catalog IDs/revisions, CMS loader and banner key | Full-width photographic hero, jade/red/gold hierarchy, setup and discovery left, route right | A/B/C workspace projections from one controller |
| Shared header/footer, icons, medallions and brand ornament | Restrained paper surfaces, compact controls, photo-first choices, numbered timeline | Mobile compact rows, stacked concurrent panes, expandable map and action bar |
| Existing localStorage key and supported date/budget controls | Clear manual/automatic actions and purpose chips | Real 3/5/9 place ceilings, partial manual plans, visible applied criteria |

No new routing engine, live traffic, hours validation, geocoder/GPS, cloud save,
share/print placeholder, rating, confidence metric, payment or booking feature.
No CMS seed or production write. Existing unrelated working-tree edits remain.

## Owners And Changes

- `src/pages/temples/planner/index.astro`: one form and workspace, semantic controls,
  staged-action dialog, notices, mobile actions, no-JavaScript fallback.
- `src/scripts/temple-planner.js`: one state owner; view projection, explicit update,
  confirmation, revision refresh, local persistence and map orchestration.
- `src/scripts/planner/workspace-state.js`: pure draft identity, freshness,
  request guards, response validation and atomic replacement helpers.
- `src/scripts/planner/picker.js`: cards/rows, batches, selected tray and focus.
- `src/scripts/planner/results.js`: committed-only summary, timings and timeline.
- `src/scripts/planner/maps.js`: separate picker/route instances, graceful failures,
  attribution, reduced-motion-aware clustering and retained route framing.
- `src/scripts/planner/storage.js`: backward-compatible optional workspace fields;
  still stores IDs rather than trusting cached timing results on restoration.
- `src/scripts/planner/format.js`: explicit next-day offsets after midnight.
- `src/styles/temple-planner.css`: scoped composition and responsive styling.
- `src/components/Footer.astro`: Planner opts into the existing editorial footer.
- `src/components/icons/SiteIcon.astro`: accepts existing `info` and `x` icon assets;
  default icon geometry and other consumers are unchanged.

Reused `TempleSearchHero`, `BrandOrnament`, `IconMedallion`, `SiteIcon`, the runtime
icon helper, catalog adapter, request helper and existing engine. Did not create
separate mobile controllers or force route-specific geometry into global tokens.

## State Contracts

1. A = plan; B = picker; C = both. Switching views, local search, scope or
   disclosures does not compute or clear work. C on mobile keeps both panes open.
2. Draft criteria/IDs/order and the committed records/criteria/timing snapshot
   are separate. Old results remain readable when dirty or stale; exports/save
   require a synchronized result.
3. Commit only when request token, draft version and catalog revision still match.
   Validate returned IDs, order, revision and arithmetic before atomic commit.
4. Manual partial selection stays partial. Zero selection cannot fall through to
   automatic planning. Lowering the ceiling asks which IDs to keep, without slicing.
5. Automatic replacement, clearing and reverting require confirmation. A staged
   replacement retains the old slot until confirmation and rejects stale versions.
6. Reorder buttons change draft order only. Explicit update sends manual ordering.
7. A 409/background catalog change retains valid selected IDs and the old result
   snapshot, marks it stale and requires explicit recomputation.
8. Origin matches catalog records only. Unknown/ambiguous text blocks planning.
   Date/budget have visible summaries; budget remains advisory.
9. Restore recalculates saved IDs against the current catalog. Removed IDs and
   old dates have persistent recovery notices until a new plan succeeds.
10. Maps export includes every committed point in order. Internal dashed lines
    are not road routes. Map/library errors do not disable the timeline.

## Visual Decisions And Differences

- Desktop workspace max width 1220px, 24px gap, 360px combined rail. Four discovery
  columns at 1440px, three at 1180px; stacked workspace below 1180px.
- Mobile below 600px uses 80x72 photo rows (64px at 320px), six initial results,
  44px interactive targets and wrapping Thai labels. Desktop starts with 12.
- All nine timeline stops remain present. The page is deliberately taller than
  a mockup showing only a few stops; no hidden stops or tiny type to fake height.
- The default career filter returns temples and shrines, not necessarily the
  photograph set pictured in the mockup. Unknown photos have explicit placeholders.
- Shared CMS banner key remains `temples.planner.banner`. Bundled fallback is the
  existing Wat Mahathat Sukhothai photograph; published overrides still win.
  `public/assets/images/planner-media-credits.txt` provides attribution, source,
  license and crop/resize notice through a page link.
- Header/footer use current shared navigation and supported destinations. No
  fabricated social/contact links were introduced to fill the reference.
- Astroscoped icon styles originally overrode equally specific page rules.
  Computed-style checks caught 32px icons where 20px was intended, and a search
  icon pushed outside its input. Fixed with route-scoped selectors, not global
  overrides. This is why rendered geometry is part of acceptance.
- Programmatic map framing is immediate; user interactions retain their own
  map state. This avoids overlapping initialization animations losing a marker
  popup and prevents draft edits from resetting the committed map's zoom.

## Verification And Evidence

Browser evidence is Chrome with local CMS/catalog fixtures and the real planner
engine behind intercepted APIs, not a production API test. The initial baseline
and six core A/B/C desktop/mobile captures are in `artifacts/planner-responsive/`.
`visual-report.json` records actual viewport, DOM counts, overflow and runtime
errors. Three-stop comparisons are supplemental; nine-stop captures remain.
Full-page captures show the fixed mobile bar at the capture viewport's bottom,
not at the bottom of the long image. Source mockup is an unmodified composite
with an illustrated phone, not an exact CSS-pixel viewport measurement.

Commands:

```sh
npm run check
npm run build
node --test tests/runtime/planner-workspace.test.mjs tests/runtime/planner-data.test.mjs tests/runtime/request.test.mjs
PLAYWRIGHT_BASE_URL=http://127.0.0.1:4326 npx playwright test tests/e2e/planner-workspace.spec.ts tests/e2e/planner-runtime.spec.ts --project=chromium-desktop
node scripts/qa/planner-responsive.mjs
git diff --check
```

Results and case-level scope are in `planner-responsive-qa.md`. No claim that
all 64 cases, physical devices, browsers or production integrations were tested.
The build currently emits existing JSON-import-attribute warnings for Home and
Calendar; no unrelated import cleanup was folded into this change.

## Local Preview

Astro on port 4326 alone does not execute Vercel API functions. To try the whole
Planner without production writes:

```sh
node scripts/qa/planner-preview.mjs
```

Open `http://127.0.0.1:4330/temples/planner/`. This loopback-only preview reads
`public/admin/content/live.json`, uses the existing catalog adapter/engine, proxies
assets to Astro and rejects other API/write operations. It is a local fixture
preview, not a deployment and not the current published database. Restart it
after changing the local CMS fixture. Production API handlers are unchanged.
