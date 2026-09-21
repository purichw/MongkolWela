# Public Frame And Planner Picker

Date: 2026-09-21. Local worktree only; no production/CMS writes or deployment.

## Scope

The user's planner-card refinement expanded to shared non-Home banners and a
coherent whole-site frame. Preserve individual tasks and real content while
aligning page edges, title scale, navigation, decoration and footer behavior.

## Implemented

- Public frame: one 1220px maximum with responsive 32/20/12/8px gutters, owned by
  `tokens.css`. Header, content and footer align at x=110 at 1440px and x=12 at
  390px. All public template families consume the frame; dialogs and inner
  reading/form/chart widths remain independent.
- Secondary-page headings use a 48/40/28px scale. Temple hub section headings
  and mobile cards were reduced after visual review found their old hierarchy
  overpowering the new page title.
- `PageBanner.astro` owns the photograph layer, shade, motifs, copy/quote layout
  and responsive dimensions. Calendar, Day, temple hub, three collections,
  Planner and Thailand directory now consume it. Images and focal points remain
  caller-owned. The directory search form sits below the banner instead of
  stretching the banner to the height of the form.
- The public footer has one implementation, retaining the approved ivory Day
  treatment, CMS/config navigation and page-specific links. Mobile disclosure
  behavior is shared across all public pages.
- Planner selection cards have one renderer for desktop tiles and mobile rows.
  Mobile images fill about 30% of the row, selected status overlays the image,
  and a separate 44px action adds/removes a place. Gold selected outlines were
  replaced with restrained borders and white surfaces.
- Planner tools occupy one primary row. Search appears in browse mode or when
  an active query exists. The selected-count button opens the reorder/remove
  tray. Map/list and keyboard focus behavior are preserved.

## Boundaries

Home retains its carousel/composition. Temple detail retains its photographic
gallery. Tarot, palmistry and astrology retain functional tool media rather than
being forced into a photograph banner. Admin and seller workspaces are not public
editorial pages and were not redesigned. No route/engine/API/schema changes.

Placeholder photographs, three selected places out of a three-place limit, and
real route summaries differ from the illustrative mockup. No invented photos,
ratings, counts or opening-hour guarantees were added to mimic it. Six initial
mobile candidates remain available instead of removing real choices to match
the mockup's three visible examples.

## Verification

- `npm run check`: zero Astro errors/warnings; browser script checks passed.
- Seven focused runtime tests passed for card/medallion/icon contracts.
- Six Calendar/Day browser tests passed for date navigation, month boundaries,
  responsive controls, CMS media and fallback behavior.
- Four Home/Planner browser tests passed for CMS image refresh, shared header
  geometry/menu behavior and picker selection/focus/search disclosure.
- Planner compact/no-JS cases also passed after the width migration.
- `page-shell.mjs`: 18 route-family samples at 1440/390, plus seven families at
  320/768/1024. No horizontal overflow or runtime errors; banner images loaded,
  one H1 remained, and footer disclosure/outer alignment passed. Extra widths
  also checked title clipping and quote/copy overlap.
- Desktop and mobile screenshots were personally opened and inspected, including
  focused reference/before/after picker comparison. These are observed design
  improvements, not a measured 85-90% similarity claim.

Artifacts: `artifacts/shared-page-shell/` and
`artifacts/planner-responsive/picker-refinement/`. The latter records fresh
unauthenticated state, a three-stop automatic plan, both panes, the real local
planning engine and a read-only CMS fixture. Reference scale is inferred from
the supplied board's 1440/390 labels; actual screenshots are CSS-pixel captures.

The first Calendar test attempt could not launch the missing bundled Chromium;
the passing rerun used installed Chrome via `PLAYWRIGHT_CHROMIUM_CHANNEL=chrome`.
Safari/Firefox, production smoke, the entire business-flow suite and every
generated detail URL were not run for this presentation pass.

## Lessons

1. A shared file is not consolidation until real consumers use it and retired
   route rules no longer control the same surface.
2. Unify outer frame and typography before forcing unrelated cards or tools into
   one component. Shared identity does not require identical task composition.
3. Names can cross framework boundaries: CMS image identity must be `mediaId`,
   not Astro's reserved `slot`. A successful build and correct container width
   did not catch missing banner media; rendered image inspection did.
4. Separate design comparison from data differences. Preserve useful controls
   through disclosure and retain truthful missing-image labels.
5. A width change needs real long content and neighboring controls at mobile,
   tablet and desktop breakpoints, not only an overflow assertion.

Ownership and reuse contracts are in `docs/shared-ui.md`.
