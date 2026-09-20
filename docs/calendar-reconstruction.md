# Calendar Reconstruction

Implemented on 2026-09-20 for `/calendar/` from the supplied calendar handoff,
implementation manifest and desktop visual reference. Banner dimensions were
explicitly approved for adjustment. This is a route-local reconstruction, not
a replacement calendar engine or a shared-site redesign.

## Ownership

- `src/pages/calendar/index.astro`: hero, toolbar and initial loading shell.
- `src/scripts/thai-calendar-year.js`: browser entry point.
- `src/scripts/calendar-view-model.js`: URL state, normalized events, summaries
  and a bounded in-memory year cache around the existing engine.
- `src/scripts/calendar-overview.js`: overview/month/event rendering and interaction.
- `src/styles/calendar-overview.css`: responsive calendar route styles.
- `src/config/styles.js`: loads the new stylesheet only on `/calendar/`;
  `/calendar/day/` retains its existing stylesheet.
- `tests/runtime/calendar-view-model.test.mjs` and `tests/e2e/calendar.spec.ts`:
  focused regression coverage.

The core formulas, local-date convention, day-detail renderer, shared header,
footer markup, CMS runtime and current CMS precedence are unchanged. Existing
unrelated work in the repository was not reverted or included in these changes.

## Interaction Contract

- `year` remains Buddhist Era, with the existing 2300-2700 selection range.
  This is a selectable range, not a claim of verified historical accuracy.
- Optional `month=1..12` and `view=overview|month|events` survive reload,
  Back and Forward. Invalid parameters fall back safely. Other query parameters
  are preserved. Existing `#month-N` links still select and reveal that month.
- The current year defaults to the current month; other years default to January.
- Previous/next month crosses year boundaries and disables at the range edges.
- Today still opens `/calendar/day/?date=YYYY-MM-DD` for the actual local date,
  regardless of the selected year or month.
- Dates at every width link directly to the unchanged detail route. The mobile
  handoff supersedes the initial inline preview. The last opened date is kept
  in the calendar history entry, so Back/reload can restore its selected style.
- Overview shows a single month and contextual events. Month mode expands the
  calendar. Events mode groups the whole year's events chronologically; month
  chips select and reveal the corresponding group.
- Multiple events are retained in accessible names, the day detail and event
  list. Mobile cells show one compact category label plus a remainder count.
- Today and the selected day have separate visual and accessible states.
- Calculation failures display an explicit error with retry and current-month
  recovery, rather than a fabricated empty year. Retry restores keyboard focus.
- A current-period summary searches after today and can cross New Year. A
  non-current browsed month displays its own first holy day/important day and
  labels that distinction. The important-day summary excludes holy-day-only rows.

## Visual Decisions

- Compact real-image hero using the existing `hero-jtha-80.jpg` mural asset.
  Measured hero heights: approximately 224px desktop, 205px tablet, 200px mobile.
  Mobile now receives a 780px WebP source; desktop keeps the original asset.
- Jade, lacquer, paper and gold retain the current site identity. Existing
  lotus/stupa assets are optimized through Astro rather than embedding new art.
- Sticky year/month/view controls account for the actual shared header height.
- Desktop uses a month plus contextual rail; tablet stacks them. Mobile summary
  cards use 2 columns from 360px and 1 below that, with all four summaries visible.
  The complete seven-column month shows lunar text, one category badge and any
  additional-event count. It never truncates the month to match the mock image.
- Year tiles use 6/3/2 columns. All controls have keyboard focus treatment;
  reduced motion disables route-local transitions and smooth navigation.
- No mock articles, new article routes, invented official-source badges or
  copied reference dates were added. The shared footer is not forked; only its
  route-local dark surface was adapted.

## Verification

| Scenario | Expected evidence | Check | Result |
| --- | --- | --- | --- |
| Core data parity | Same dates, lunar values and all original events | Unit, full 2569 year | Pass |
| Navigation | Year crossings, leap day, bounds, reload/history | Unit + browser | Pass |
| Existing links | Legacy anchors and Today open correct destinations | Browser | Pass |
| Multiple events | All May 1 engine events remain reachable | Unit + browser | Pass |
| Mobile navigation | Date tap/Enter opens detail; Back/reload restores selection | Browser, 390px | Pass |
| Error/retry | Explicit error, then restored content and focus | Fault-injected browser response | Pass |
| Keyboard/sticky/reduced motion | Usable controls and unobscured focused heading | Browser, 1440/768/390/320px | Pass |
| Responsive imagery | No horizontal overflow, broken images or page errors | Final snapshots, 1440/768/390px | Pass |
| Zoom reflow | No overflow at 720px effective layout width | 200%-equivalent viewport | Pass; not native browser zoom |
| Route isolation | New CSS absent on Home and day detail | Browser | Pass |
| Static integration | Astro diagnostics, script bindings and production build | `npm run check`, `npm run build` | Pass |

Six model tests and six browser tests passed using installed Chrome. The full
site E2E/NFR suites, Firefox/WebKit, production deployment and official calendar
data validation were intentionally not run for this route-local reconstruction.

Local preview: `http://127.0.0.1:4325/calendar/`.
Visual evidence and capture provenance are in
`artifacts/calendar-reconstruction/`, including `evidence.json`, full screenshots,
first-view screenshots, a reference/development comparison and mobile contact sheet.
The reference is visual-only and has different dates/content; comparison panels
are proportionally scaled, not stretched or presented as pixel-identical copies.
The CMS API is mocked from the local seed for deterministic browser checks only;
production runtime sourcing is unchanged. Consent is declined through its real UI
for final visual captures, not hidden with test CSS.

## Remaining Risks / Decisions

1. The unchanged engine uses a mean lunar cycle and Thai 19-year leap-month rule.
   It is not an official verified feed. Existing output includes repeated festival
   labels in some leap-month periods, such as Asalha Puja in June and July 2569.
   This task preserves those outputs; it does not certify their religious or
   historical correctness. A separate verified-calendar-data task is required.
2. Special/substitute holidays are not comprehensively sourced by the existing
   rules. The data note discloses this and avoids promises of official accuracy.
3. Holy-day counts remain derived from that same approximate engine. The owner
   can choose to hide counts later; no formula or count from the mock was copied.
4. An existing shared-shell issue was observed: public PDPA markup is rendered
   by `cms-runtime.js`, but its styles are in admin-only `admin.css`. This was
   not introduced by the calendar stylesheet swap and was not expanded into a
   cross-site consent-style refactor here. Consent functionality is unchanged.

No commit, push or deploy is included in this implementation pass.

## Mobile Reference Follow-up (2026-09-20)

Authority: the user-supplied phone mockup (`codex-clipboard-c9d35675-6341-4454-9952-af3d310e5f5d.png`)
and `MONGKOLWELA_CALENDAR_MOBILE_IMPLEMENTATION_SPEC.md`. Scope: `/calendar/`
at 600px and below; formulas, CMS, routes and desktop presentation stay intact.

- Adopted: compact header/hero, published planner CTA, year/month scroller,
  four summary cards, lunar labels inside day cells, semantic labels in the
  important-date list, compact data note and shared footer treatment.
- Mobile shows three important-date rows. The existing `ดูทั้งหมด` action
  reveals the full event view and focuses the selected month.
- Retained: Today opens today's detail because this is the established
  production behavior explicitly exempted by spec section 16. All three
  existing view modes remain accessible, adding one compact toolbar row.
- All twelve year tiles remain in a two-column grid, the spec's preferred
  option, rather than copying the four visible tiles in the mockup.
- The exact Buddha hero artwork is not included as a standalone asset. The
  existing temple mural is reused, not an image cropped out of the mockup.
- No article/CMS feed, global search control or verified social destinations
  exist in this shell. Do not fabricate article content, global search behavior
  or social links. Header/footer reuse the existing markup and published links.
- The optional daily-list action is omitted because no equivalent daily listing
  route exists. Every date remains a direct, accessible link to its details.
- Actual data differs from the mock dates/counts. Existing source limitations
  and the expandable provenance note are preserved.

Acceptance matrix: complete month + 7 columns; no overflow at 320/360/390/430;
2x2 summaries at 360+; active chip visible; native date links and keyboard;
Today reachable; error/retry; desktop unchanged. Check with focused Calendar
Playwright/runtime tests and current screenshots under `artifacts/calendar-mobile/`.
The phone frame/status bar are excluded from visual comparison. Reference crop
is x185/y77, 570x1568 image pixels, proportionally scaled to 390px. CSS scale is
inferred from the handoff, not measured from a browser reference.

Follow-up results: 6 runtime tests passed, all 6 focused browser tests reported
passing, and `npm run check` completed with no diagnostics. The browser runner
stalled during final teardown after the tests; it was interrupted (exit 130,
reporter printed `6 passed`), rather than represented as a clean runner exit.
Final captures have no page errors, broken images or horizontal overflow at
320/360/390/430/1440px. The 1440px full-page before/after images are byte-identical
after raw pixel decoding (`desktopIdentical: true` in `evidence.json`).

This follow-up does not include whole-site E2E, production validation, an
official-calendar accuracy audit, commit or deployment. The initial PDPA
styling issue noted above was fixed in the subsequent Home pass; this mobile
change does not alter consent behavior.
