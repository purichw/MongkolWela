# Travel Planning Guide

`/guide/` is the destination for the existing top utility link
`คู่มือวางแผนเดินทางมงคล`, including its mobile drawer counterpart.
It is a practical guide, not another collection or Planner landing page.

## Ownership

- Page/content: `src/pages/guide/index.astro`
- Route-only style: `src/styles/travel-guide.css`, registered in `src/config/styles.js`
- Checklist: `src/scripts/travel-guide.js`
- Entry: `src/config/site.js` topbar; existing shared navigation renderers
- CMS page ID: `travelGuide`; registered in both development/build seeds
- Shared shell: BaseLayout, PageBanner, CmsImage, SiteIcon, existing buttons/tokens

Four anchored chapters link to the three curated collections, shared search,
Calendar/day and Planner. No API, account, new tracking or trip persistence
contract is added. The guide accurately describes Planner estimates, which do
not validate opening hours, live traffic or the return journey.

The six-item checklist stores only selected item IDs under
`mongkolwela.travel-guide.checklist.v1`. Invalid/unknown stored entries are
ignored. Storage failures leave the checklist usable and show an inline note.
Reset clears only this key and restores focus to the first checkbox. Without
JavaScript, the guide, links, native checkboxes and FAQ remain available; saved
progress controls stay hidden.

## Consistency Decisions

- Existing shared tokens are authoritative: 1220px maximum width, responsive
  gutters, 56/44/32/30px page titles, Noto Sans Thai and 8px radii.
- Header/footer, banner, CMS image, icons and primary action use existing
  implementations. No shared component API or other page geometry changed.
- Chapter layout and checklist stay route-owned, separate from place cards
  and Planner state. Collection tones retain the hub's red/jade/gold roles.
- Icon overrides are scoped to this route and use `--site-icon-color`.
- Desktop checklist sits beside chapters; mobile places it after preparation.
  Both preserve all six items and the same storage state.

## Acceptance And QA

| Feature | Scenario / expected | Source of truth | Verification | Priority |
| --- | --- | --- | --- | --- |
| Entry | Topbar opens guide before/after CMS hydration | Config and route | Desktop/mobile E2E | P1 |
| Tools | Collection/calendar/search links exist; Planner opens | Existing routes | Focused E2E | P1 |
| Checklist | Reload, complete and reset preserve correct state | Selected input IDs | Focused E2E | P1 |
| Resilience | Malformed/blocked storage leaves controls usable | Browser state | Focused E2E | P2 |
| Accessibility | Keyboard FAQ, reset focus, no-JS content | Native elements | Focused E2E | P2 |
| Layout | Readable Thai, loaded images, no overlap/overflow | Rendered guide | Desktop/mobile snapshots | P1 |

Run `tests/e2e/travel-guide.spec.ts`, `npm run check`, `npm run build`,
`npm run nfr:cms` and `git diff --check` before release. Then run the production
smoke and verify real CMS hydration, images and interactions at 1440/390px.
Never seed the live CMS document to register this page.

## Recovery Note (2026-09-24)

The original uncommitted worktree disappeared during release checks after five
E2E cases passed. Reconstructed only this guide's source, registry entries,
documentation and tests in a new isolated worktree from `69b9e28`.
The original working copy and other tasks' work are not part of this release.
Rerun checks against the recovered source; earlier results are not release proof.
Use dedicated Playwright Chromium headless shell, not installed Chrome, because
the latter's teardown previously hung on this machine. Do not change production
dependencies or force a test process to exit in order to claim a pass.

## Recovered Build Verification (2026-09-24)

- `npm run check`: zero errors/warnings; one pre-existing TempleDetail hint.
- `npm run nfr:cms` and `git diff --check`: passed.
- `npm run build`: passed, 745 static pages.
- Focused E2E on the built preview: all five cases passed, exit code 0.
  The no-JS case waits for fonts and the native FAQ to enter the viewport before
  clicking; assertions and browser behavior are not bypassed.
- Real read-only API preview at 1440/390px: checklist reload/complete/reset,
  FAQ, guide entry after CMS hydration, Planner navigation and media passed.
  No overflow, failed asset responses or console errors. Personally reviewed
  full desktop/mobile snapshots in `artifacts/travel-guide/` (not committed).
- Screenshot capture uses instant programmatic scrolling and waits at the top
  before capturing, so sticky elements are not recorded halfway down the page.
- Full-site E2E, Firefox and Safari are outside this focused release pass.
  CI supplies the existing runtime regression suite for the exact pushed commit.
- No production CMS writes. Previous production deployment for recovery:
  `dpl_Hv3pzQcBXqnHn4rj6VfRLFrydLTX` (commit `69b9e28`).
