# Shared Header And Navbar

2026-09-21. Public header, utility strip, desktop panels, compact drawer and shared
consumer offsets. No production CMS writes, commit, push or deployment this pass.

## Authority And Baseline

The supplied implementation prompt, responsive spec, manifest, navigation
contracts, tokens and QA inventory establish the handoff. Latest user feedback
requires a more compact menu than the first implementation; it supersedes the
spec's proposed dimensions. Selected images establish composition, not new routes.

Baseline build: 735 routes. Baseline images: `artifacts/header-navbar/before-*.png`.
Extensive pre-existing dirty work, including commerce, was preserved. The read-only
published CMS inspection returned revision `80f74f48e856da6ace2d5fea`.

Published navigation includes Temples, direct Calendar, Tools and Commerce. No
Articles route is published. Collection order is Popular, Mu, Sacred, not the
illustrative reference's Popular, Sacred, Mu. Keep the CMS order. Tarot precedes
Other; every enabled tool and Shop/Merit remains reachable. No feature gates change.

Search is the existing `/#site-search` link: focus Home's real input or navigate
Home first. It is not a new universal search modal. Contact is `/#consult`, Home's
existing footer. Config owns utility links; CMS utility adds distinct destinations.

## Design And Ownership

- Jade utility, ivory main row, lacquer CTA, gold dividers and existing icons.
- Opaque `#FFFDF7` panels; only decorative layers are translucent.
- Original configured logo; reused optimized heritage/Lucide and lotus/bodhi art.
  The decorative temple illustration is adapted, not the exact mockup spires.
- Temple desktop panel: linked Planner feature, collections row, single directory
  row. Width reduced from 640 to 560px, with tighter title/padding/section rhythm.
- Mobile intro title reduced from 24 to 20px, primary text from 18 to 16px,
  heritage icons from 40 to 28px. Minimum target remains 44px. Remove duplicate
  utility destinations, not unique links. Preserve Hub overview, Day and Commerce.
  Hub overview now shares the intro eyebrow row instead of consuming a separate
  menu row; it remains an ordinary CMS-derived link with its full accessible name.
- Desktop requires >=1280 and actual intrinsic fit, with 16px safety and 32px
  re-entry hysteresis. Search moves into drawer below 390. CTA keeps full accessible
  name. Text enlargement reflows instead of shrinking or clipping actions.
- Typography: Prompt 600 for desktop navigation/CTA and 700 for the brand;
  Noto Sans Thai for panel headings, children, descriptions and drawer intro;
  IBM Plex Mono 400 for the English wordmark; IBM Plex Sans Thai 400 for tool
  members. Mobile main rows adapt the proposed Prompt role to Noto Sans Thai
  500 (featured group 600), matching the reference's lighter, looped Thai text.
  Thai tracking remains zero. Descendants inherit their role instead of being
  reset by the global `:lang(th)` selector.

`Header.astro` / `Topbar.astro`: SSR shell. `lib/site-navigation.js`: normalized
data, safe text/URLs, groups, state and both renderers. `scripts/navigation.js`:
interaction and keyed updates. `header.css`: namespaced shared styling.
`cms-runtime.js` delegates rendering but retains request/revision freshness.
Decorative assets and UI descriptions are not a competing CMS route source.

Desktop supports fine-pointer hover delay/grace, focus opening, ArrowDown, click,
Escape suppression, outside click, natural Tab and edge/height clamping. Mobile
uses native dialog modality, persistent Close, one scrolling region, focus return,
scroll restoration and persistent accordions. No history entries. Native details
keep links accessible without JS. CMS refresh preserves surviving keyed focus,
open groups and scroll, and moves removed focus to a safe control.

Utility strip is normal flow; only main header sticks. Main height and viewport
bottom are distinct variables. Calendar retains its observer. Planner anchors,
Tarot detail and temple sticky surfaces consume main height. Page bodies, footer,
loaders, database and payment behavior were not redesigned.

## Evidence

Commands:

```sh
node --test tests/runtime/site-navigation.test.mjs tests/runtime/content-refresh.test.mjs
node scripts/qa/header-navbar.mjs
node scripts/qa/header-typography.mjs
npm run nfr:cms
npm run check
npm run build
git diff --check
```

Targeted Playwright: `commerce-navigation.spec.ts` and `cms-freshness.spec.ts`
on Chromium desktop/mobile (8 passing tests); shared public header and desktop
dropdown tests in `home-reconstruction.spec.ts` (2 passing tests). Admin publishing
tests use intercepted local fixtures only. No authenticated production writes.

The dedicated harness uses local live.json with explicit provenance. It covers
12 viewport states (320-1920, tablet and landscape), 14 public routes, keyboard,
pointer and touch emulation, focus/scroll across CMS updates, no-JS/CMS failure,
200% text sizing, Calendar sticky controls and axe header/drawer checks.
Results: `artifacts/header-navbar/browser-results.json`.

Desktop and mobile renders were personally opened during iteration. This found
SVG stroke/scoped-size regressions, oversized spacing/icons, redundant utilities
and decorative overflow at 200% text, all corrected. Reference comparisons use
cropped frames at labelled inferred scale; no numerical similarity score or user
approval is claimed. Real published content may require drawer scrolling.

`artifacts/header-navbar/QA_CASES.json` distinguishes covered cases from NOT_RUN
cases. CSS text-size testing is not browser zoom. Actual hardware keyboard/safe
areas, screen-reader speech, browser zoom, Firefox/Safari and deployment are not
claimed verified by Chromium emulation. Page-specific workflows were not broadly
retested beyond the shared header's stated integration checks.

## Font Follow-Up

The built preview exposed a missing token stylesheet, not just a font-size
difference. Seller imported `tokens.css` as bundled CSS while shared layouts used
`?url`; the build emitted a stale token URL on public pages. Seller now uses the
same URL import/link, preserving its content and behavior. Built Home, Calendar,
Popular and Seller load the token stylesheet successfully.

The focused follow-up checks 1440/1280/390/320 layouts and records computed roles
plus Chromium's actual rendered platform fonts in `typography-results.json`.
Screenshots wait for fonts after opening each panel/drawer, including faces not
used in the closed state. Both fresh comparisons were personally inspected.
The earlier broader interaction results remain historical evidence, not a claim
that all 72 handoff cases were rerun after this font repair.
