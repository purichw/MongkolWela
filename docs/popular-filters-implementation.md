# Popular Search And Filter Adaptation

Date: 2026-09-21. Base: `425794d`. Implemented in the isolated
`.local/popular-filters-20260921` worktree, not the mixed root working tree.
Source: `mongkolwela-popular-search-filter-handoff`, specification v1.0.0,
the desktop/mobile reference board, and the supplied before-panel image.
The implementation pass made no CMS publishing or dataset changes. A subsequent
owner request authorizes committing, pushing and deploying this scoped work.

Release preparation uses `.local/releases/popular-filters-20260921`, based on
published `f819b6e`, with an independent `npm ci`. The only release delta remains
the eleven Popular filter files; no mixed root work is included. Existing tools
and public-select styles are preserved before the Popular-only stylesheet.
The fresh install/build passes (735 pages); check has zero errors/warnings and
one existing TempleDetail inline-script hint. The lockfile is unchanged.
`npm audit --omit=dev` reports zero findings. The unchanged build dependency tree
reports five advisories (one critical, two high, one moderate, one low), deferred
to a dedicated dependency upgrade. This change adds no image-processing endpoint
or untrusted image inputs; Astro output remains static.

## Ownership

| File | Responsibility |
| --- | --- |
| `src/components/PopularFilters.astro` | Popular-only form, selectors, applied disclosure and one editor |
| `src/scripts/popular-filters.js` | Editor working copy, responsive presentation, keyboard/focus, summaries and semantic snapshot identity |
| `src/scripts/temple-directory.js` | Existing authoritative matcher/facets/card engine; bounded Popular adapter, request guards and loading/retry status |
| `src/styles/popular-filters.css` | Route-local compact composition, popover/modal/sheet and state styles |
| `src/components/TempleCollectionView.astro` | Selects new UI only for `popular`; Sacred/Mu retain legacy UI |
| `src/config/styles.js` | Loads new CSS only on `/temples/popular/` |
| `tests/e2e/popular-filters.spec.ts` | Eleven focused browser scenarios, including synthetic inventory and failure cases |
| `tests/runtime/popular-filter-state.test.mjs` | Set-order equivalence and Thai-preserving normalization |
| `scripts/qa/popular-filters-capture.mjs` | Reproducible local captures, composition board and provenance |

The shared page width, SiteIcon/Lucide glyphs, IBM Plex Sans Thai, collection
data pipeline and result-card renderer are reused. This is a feature-specific
adapter, not a second search engine or a global replacement for every filter.
Hero, shared navigation, card content/actions, ranking, map and footer markup
are unchanged. Result top spacing and sticky-header scroll clearance are local.

## Product Contracts

- Matching remains OR inside a selected group and AND across keyword/groups.
  Values come from the full collection, not merely the first eight visible cards.
- The existing dataset uses the actual province/purpose strings as filter keys;
  there is no separate immutable taxonomy ID/translated-label contract to invent.
- Province choices retain existing cross-facet availability. Choosing a new
  province also adds its region. Region changes prune provinces outside the
  remaining regions, with an explicit notice. Region All clears provinces.
- Opening an editor clones only that draft group. Checkbox changes stay local.
  Done copies it to draft. Search captures draft and updates applied/results.
  Close, Escape, outside click, switching fields and main Search discard any
  unconfirmed working copy. Equivalent Sets do not create a false dirty state.
- Main Clear resets filters and Nearby, invalidating outstanding requests.
  Nearby success applies draft; switching Nearby off only restores ordinary
  ordering of the currently applied results, preserving the previous contract.
- `name || q` URL-entry precedence is unchanged. Search/Clear still do not write
  complete filter state to the URL. Local option search is never serialized.
- CMS refresh recomputes results with applied values, not unsubmitted draft.
  Open working selections/query remain intact. Missing selected keys are labelled,
  removable and rejected by Done/Search rather than silently substituted.
- Initial/failed collection loads keep existing cards and detail links visible.
  Retry performs a new request. A stale geolocation response cannot undo Clear
  or overwrite a newer draft; a changed catalog invalidates pending location work.
- No new API, tracking, analytics payload, sorting taxonomy, favorites or planner
  selection model. Existing eight-card reveal batches and card URLs are preserved.

## Responsive Decisions

- Desktop: compact always-visible search row and two equal-height selectors.
  One anchored 360-480px editor, max 480px tall, outside document flow. It flips
  when necessary and falls back to a modal if neither side has useful space.
- Tablet: one centered modal, maximum 640px wide.
- Phone: full-width search, paired utility actions, stacked selectors and one
  field-specific sheet. Pointer opening focuses the title, not the keyboard.
- One live editor survives breakpoint changes. Native modal dialog supplies
  background inertness, with explicit focus handling and an owned body-scroll
  restore. Short visible viewports switch to one scrolling dialog.
- Options are native checkboxes with reserved checkmark space, wrapping labels
  and 44px targets. All means an empty/unrestricted Set, not every visible item.
  All and Clear remain usable when an option search hides selected items.
- Summaries fit up to two labels with an accurate remainder; narrow/long values
  use a count. Full applied criteria are accessible in a read-only disclosure.

## Visual Review And Measurements

Opened actual screenshots and compared against the supplied reference personally
on desktop and mobile, including open editors, then inspected tablet and short
landscape. Corrected the inherited solid-black search SVG, oversized icon
wrappers, control-row height and the dirty-status height shift after that review.

Latest local capture measurements (`capture-provenance.json`):

| State | Panel height | Result viewport top | Editor height |
| --- | ---: | ---: | ---: |
| 1440, Province open | 180.5px | 434.05px | 480px |
| 1440, Purpose open / province draft | 180.5px | 434.05px | 480px |
| 1440, closed / dirty draft | 180.5px | 434.05px | 0 |
| 390, closed / dirty draft | 355px | 601.09px | 0 |
| 390, Purpose sheet | 355px | 601.09px | 820px |
| 768, Province modal | 238.5px | 596.44px | 338px |

Synthetic inventory swaps 3/120, 120/3, 1/1, 0/50 and 500/500 pass the <=1px
closed-panel-height assertion at 1440/768/390. Opening does not change result
position relative to the filter section. Measurement excludes the intentional
body fixed-scroll offset used by modal scroll locking.

Intended differences from the illustrated board: only one editor opens at a
time; no in-flow blank space beneath selectors; no duplicate mobile all-filters
button; real available labels/counts, not illustrated sample taxonomy; taller
phone sheet when a long actual list needs it. Existing site shell/card designs
are preserved, not redesigned to imitate unrelated parts of the board.
No numerical visual-similarity percentage or user approval is claimed.

## Verification

PASS: `npm run check` (62 Astro files, zero diagnostics; 59 browser modules).
PASS: `npm run build` (735 routes). Existing JSON import-attribute warnings in
Home/Calendar/Day remain outside this change.
PASS: `node --test tests/runtime/popular-filter-state.test.mjs` (1 test).
PASS: focused Chromium Playwright suite (11 tests).
PASS: `git diff --check`.
PASS: compiled-build browser smoke at 1440px and 390px: popover/sheet,
no horizontal overflow or page errors, 20px icon and unfilled search glyph.
Extra evidence: `compiled-1440.png` and `compiled-390.png`.

Browser suite includes selection/cancellation, local no-match, selected-only,
Search versus Done, restore/Clear, OR/AND matching, CMS refresh/missing values,
failed-load retry, stale/denied geolocation, keyboard focus/escape/trap, scoped
axe checks, URL precedence, batch reveal, Sacred/Mu smoke, no-JS and long labels.
Geometry exercised 320x568, 360x800, 390x844, 430x932, 768x1024, 1024x768,
1280x800, 1440x900, 1920x1080, 844x390, plus 390x300 short-height simulation.

The handoff's 78 individual cases are not claimed as 78 separately executed tests.
Grouped case evidence:

| Case IDs | Status / evidence |
| --- | --- |
| LAY-01, LAY-02, LAY-03, LAY-05, LAY-08 | PASS: inventory/geometry/selection browser scenarios |
| LAY-04, LAY-10 | PASS: direct rendered review plus scoped source diff |
| LAY-06, LAY-07, LAY-09 | NOT_RUN as isolated acceptance cases; general resize/clamping exercised |
| SEL-01, SEL-02, SEL-03, SEL-04, SEL-06, SEL-07, SEL-08, SEL-10 | PASS: working/draft/applied and five-value tests |
| SEL-05, SEL-09 | NOT_RUN: no separate width-toggle measurement or old-runtime ID parity harness |
| OPT-01, OPT-02, OPT-03, OPT-04, OPT-05, OPT-06, OPT-07 | PASS: local-search/selected-only tests and Thai normalization unit test |
| OPT-08 | NOT_RUN in full: 500 options exercised, no explicit network-call-count assertion |
| STA-01, STA-02, STA-03, STA-04, STA-05, STA-06, STA-07, STA-08, STA-09, STA-10, STA-11, STA-12 | PASS: browser state, outside Search, keyboard, restore and Clear tests |
| MOB-01, MOB-02, MOB-04, MOB-05, MOB-06, MOB-07, MOB-08, MOB-09, MOB-10 | PASS: responsive and short-height tests plus sheet/modal review |
| MOB-03 | NOT_RUN: no physical iPhone/Android soft keyboard; only viewport simulation |
| DAT-01 | NOT_RUN as isolated assertion; inspected existing dependency predicate and added notice |
| DAT-02 | NOT_RUN: source has label-as-key, not independent stable IDs with mutable labels |
| DAT-03, DAT-05, DAT-06, DAT-08, DAT-09, DAT-10 | PASS: CMS, failure and location race browser scenarios |
| DAT-04, DAT-07 | NOT_RUN as independent reversed collection-response races |
| A11Y-01, A11Y-02, A11Y-03, A11Y-04, A11Y-05, A11Y-07 | PASS: scoped axe, keyboard, visible review and reduced-motion tests |
| A11Y-06, A11Y-08 | NOT_RUN in full: narrow reflow/header sequence covered, not actual 200% browser zoom or full map sequence |
| REG-01, REG-02, REG-04, REG-06, REG-08, REG-09, REG-10 | PASS: URL/batch/no-JS/XSS/build/diff evidence |
| REG-03, REG-05, REG-07 | NOT_RUN in full: shared Sacred/Mu/header covered; no whole-site/Leaflet/provider/network duplication sweep |

## Evidence And Preview

`artifacts/popular-filters/` contains nine current captures, `review.png`, capture
provenance and the generated Playwright JSON result. These are local artifacts.
The preview at `http://127.0.0.1:4361/temples/popular/` uses the existing read-only
Planner preview proxy, Astro on 4360 and the repository CMS snapshot. It is not
production/live CMS verification, and does not publish or seed anything.

A first screenshot-script run incorrectly encoded spaces in PNG output paths.
The script now uses `fileURLToPath`; current evidence is under the correct
worktree. Nine redundant PNGs were left in the accidental
`/Users/point/Website%20Projects/hora-astro/.local/popular-filters-20260921/artifacts/popular-filters/`
path. No outside-project cleanup/deletion was performed.

Deferred: physical mobile/soft keyboard, assistive-technology manual testing,
actual browser zoom and broad NFR/full E2E. Production API smoke and deployed
desktop/mobile verification remain release gates, not local implementation proof.
