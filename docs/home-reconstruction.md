# Home Reconstruction

Implemented on 2026-09-20 from the local `mongkolwela-home-codex-handoff`
implementation spec, manifest, context/CI documents and three approved images.
Scope is `/`. This is faithful adaptation of composition and hierarchy, not
literal reproduction of unsupported facts or generated imagery in the mockups.

## Ownership

- `src/pages/index.astro`: section order, existing CMS selector aliases, real route links.
- `src/styles/home.css`: Home-only responsive composition; no new global theme.
- `src/data/home-directory-summary.js`: build-only count of canonical registry rows
  and distinct provinces. No directory payload is added to browser JavaScript.
- `src/scripts/home.js`: trim/validate search and fixed-geometry media fallback.
- `src/scripts/home-motion.js`: visible-by-default, one-time entrance animation.
- `src/scripts/carousel.js`: Home is its only current consumer. Deferred images,
  pause control, hover/focus pause, reduced motion, controls-only arrow keys.
- `src/styles/pdpa.css`: existing consent CSS extracted unchanged from Admin CSS
  and loaded through `src/config/styles.js` on public and Admin routes. State,
  analytics permission and button handlers remain owned by CMS runtime.

## Preserved Contracts And Deliberate Adaptations

- Published CMS headline/copy/placeholder/image and section visibility still win.
  `.home-intent-panel` and `#directory` restore existing section-selector ownership.
  Main preserves section order. No CMS data, navigation or registry migration.
- Search remains `/temples/sacred/?q=...`; six intent destinations are unchanged.
- Shared header, mobile internal menu scroll, footer, consent and bot protections
  remain in place. Unrelated Calendar, Admin, commerce and temple work is retained.
- Use existing local mural/visit/incense assets, optimized to responsive WebP below
  the fold. These are thematic images, not evidence of a particular outcome.
  Itinerary thumbnails are generic temple icons, not unverified location photos.
- All five Hero images, focal positions and source/license credits are
  CMS-editable without a competing `srcset`. The first image is eager; the other
  four are requested only when selected. See [Home Banner Media](home-banner-media.md).
- Current Bangkok date plus generic planning note; no invented lunar accuracy,
  lucky numbers/colors/directions, users, ratings or testimonials.
- Registry currently has 44,705 rows and 77 distinct provinces. Both displayed
  record counts derive from the same build-time value. No all-coordinate claim.
- Planner times remain an explicitly editorial sample, not a routing API response.
  Removed unsupported static distance and algorithm claims from the old sample.
- Mobile readability takes precedence over the mock phone's compressed type.
  Intent cards use 6/3/2/1 columns; categories stack on small screens. The required
  Thailand directory stays present even where the mobile mockup omits it.

## Verification

| Surface | Expected result | Evidence |
| --- | --- | --- |
| Home layout | No overflow, equal media slots, no carousel overlap | 320, 360, 390, 720, 820, 900, 1024, 1100, 1280, 1440px |
| Search | Trim Thai input, reject blank input, preserve `q` | Targeted Playwright |
| CMS | Published edits and long copy win; disabled section hides; live outage retries without seed fallback | Home, CMS navigation and freshness tests |
| Motion | One title entrance; lower reveals survive reload; reduced motion and pause work | Animation event counter and carousel state assertions |
| Media | Deferred slides; fallback removes stale `srcset`; no layout collapse | Targeted failure checks and image capture audit |
| Consent/nav | Both consent choices persist; mobile menu scroll/Escape work | Home and Calendar representative consent check |
| Accessibility | Main passes automated WCAG A/AA scan at desktop/mobile; static content visible without JS | Axe and no-JS test |

Commands: `npm run check`, `npm run build -- --silent`, `git diff --check`,
`npx playwright test --config artifacts/home-reconstruction/playwright.config.ts`.

Check/build passed. All 16 targeted cases reported passing, but the installed
Chrome runner stalled during final browser teardown and was terminated after
test completion; this is not recorded as a clean runner exit. Snapshot capture
completed normally on the final pass.

Snapshots are under `artifacts/home-reconstruction/`: before/final full-page
captures at 1440, 820 and 390 CSS pixels, desktop reference/development pair and
mobile hero pair. Chrome, DPR 1, reduced motion, consent declined, local CMS QA
fixture using `มงคลเวลา` as the published-like title. This fixture is never written
to the live CMS. Source screenshots are image-only compositions, not browser
captures; comparison preserves aspect ratios and does not imply pixel parity.

Not performed: production deployment/smoke, full-site suite, other browser engines,
real-device or native browser 200% zoom. Narrow viewport reflow is covered but is
not a claim of real browser-zoom testing. No claim of production Core Web Vitals.
