# Error Pages

## Scope And Design

The September 23, 2026 user-supplied 404, 500 and 403 desktop/mobile mockups
define the visual direction. `ErrorPage.astro` owns all three status views:
gold serif numerals, a lotus inside the middle zero, delicate cloud flourishes,
a pale illustrated landscape, centered text/actions and a closing quotation.
Mobile stacks the actions and places the landscape below the reading content.
Typography changes at explicit breakpoints, not with viewport-sized fonts.

Consumers: `src/pages/404.astro`, `src/pages/500.astro`, `src/pages/403.astro`.
The public Header, Footer, font entrance, CMS navigation and consent behavior
remain shared and unchanged. Their existing mobile composition intentionally
differs from the mockups; no separate error-page header/footer was created.

`stylesForPath(path, page)` accepts an optional page identity so an unmatched
URL receives error-page CSS even under another route family. Existing callers
without this argument retain their previous behavior. Page-local selectors
prevent the new typography, artwork and buttons from affecting other routes.

The 500 copy omits the mockup's assertion that a team is currently investigating:
the template has no incident-management source with which to verify that claim.
The contact action reuses the site's existing `/#consult` destination and local
phone icon; it does not introduce a new support service.

## Routing And Recovery

- Astro's 404 view serves unmatched URLs with HTTP 404 during local verification.
  The static build emits `dist/404.html` as before.
- Astro recognizes the 500 page and emits `dist/500.html`. Its local dev route
  returns HTTP 500. This does not establish interception of Vercel platform or
  API errors in a static deployment.
- `/403/` is a preview/reusable access-denied view and emits `dist/403/index.html`.
  It is a static page (HTTP 200 when directly visited), not an authorization rule.
  No protected route, API response or authentication behavior was changed.
- Retry is an explicit button calling `location.reload()`, preserving the current
  URL/query. No automatic retry loop is installed. A no-JS empty-href link retries
  the current document, preserving its query without runtime templating.
- All status views declare `noindex, follow`. Analytics injection is disabled.
  Recovery text and links are rendered in HTML and remain usable if CMS fails.

## Assets

Generated decorative assets, based on the supplied visual direction, not photos
of a particular real temple:

- `public/assets/images/error-temple-landscape.webp`, 1774 x 887: pale ivory
  watercolor, antique gold pagodas and sage/ivory lotus foliage at the outer
  lower corners, winding gold river along the bottom, blank center for text.
  Source generation: `exec-a989087c-00ff-4ee5-bc01-c4ad2a65a57b.png`.
- `public/assets/images/error-cloud-reference.webp`, 400 x 222 with alpha:
  a pale gold outline cloud with one inward curl and an outward wind tail.
  The left instance mirrors the right. Source generation:
  `exec-d40884a1-3c45-45a7-9683-063100e9e23c.png`.
- `public/assets/images/error-lotus-layered.webp`, 192 x 192 with alpha:
  compact layered gold petals with fine ivory veins, without the prior icon's
  sparkle or pedestal. Used in the middle zero and quotation divider.
  Source generation: `exec-556eba5b-22cf-4444-80ac-32e88b70f497.png`.

These were generated with the built-in image tool and converted to WebP with
Sharp. The ornament prompts requested reconstruction from the user's close-up:
one fine gold cloud with an inward curl and outward tail; one compact layered
lotus with ivory petal veins, no sparkle, pedestal, background or other elements.
They are reconstructed artwork, not the mockup's unavailable original assets.
Earlier `error-gold-cloud.webp` and `error-lotus-reference.webp` trials remain
unused. All text, numbers, links and buttons are real HTML, not baked into art.
The stupa action reuses `SiteIcon`; action glyphs reuse local Lucide assets.

## Typography Refinement

The user corrected the serif Thai interpretation: the reference calls for Noto
Sans, not a newly invented traditional-serif direction. Thai content now reuses
the site's existing Noto Sans Thai family: headings 700, controls 600, body and
quotes 400. The error-specific Thai font override and serif font-face rules have
been removed. The original serif experiment's local files remain unused.

Status numerals retain Cormorant Garamond 600 with lining figures. Its 23 KB
WOFF2 and original SIL Open Font License are self-hosted under
`public/assets/fonts/error-pages/`, sourced from the official
[Cormorant Garamond distribution](https://fonts.google.com/specimen/Cormorant+Garamond).
No header/footer font, global token or loading behavior was changed.
The focused test asserts the Thai family and heading weight to prevent the
same unintended replacement. Current 1440px/390px typography proof supersedes
the earlier serif experiment captures.

The ornament follow-up uses the supplied close-up
`codex-clipboard-739c7db6-5119-4844-a892-6f75729e4294.png` as authority for the
cloud and lotus. `.local/error-pages/ornament-comparison.png` pairs its original
crop (0, 0, 836, 254, uniformly resized to 840px) with a current desktop capture.
The close-up's CSS zoom is unknown; the comparison does not establish exact
numeric font identity. `.local/error-pages/ornament-390.png` and refreshed
`404-390.png` cover placement on mobile. `ornament-proof.json` records current
font family/weight, image decoding and overflow. Earlier six-page comparison
captures are historical evidence, not evidence for these latest ornament edits.
The focused desktop/mobile `all error` checks passed for all three statuses after
the artwork replacement. Current 404 captures were personally inspected at 1440px
and 390px; the final opacity adjustment was recaptured. No full-site suite or
production deployment was repeated for this visual-only follow-up.

## Acceptance And QA

| Scenario | Expected | Evidence | Priority |
| --- | --- | --- | --- |
| Three status views | Correct text, three recovery actions, one H1, noindex | Focused Playwright | P1 |
| Missing nested URL | HTTP 404, shared design CSS present | Focused Playwright | P1 |
| Retry | Keyboard activation reloads current URL only on request | Focused Playwright | P1 |
| No JavaScript | Content/links remain visible; retry preserves query | Focused Playwright | P1 |
| CMS unavailable | Recovery remains available | Focused Playwright with 503 fixture | P1 |
| Responsive | No horizontal overflow at 320/390/768/1024/1440 | Focused Playwright | P1 |
| Accessible content | Axe WCAG A/AA scan of main; targets at least 44px | Focused Playwright | P1 |
| Artwork and composition | Images decode, lotus inside zero, desktop/mobile reference review | Browser captures and personal visual inspection | P1 |

Local screenshots and capture provenance are under `.local/error-pages/`:
six full-page captures at 1440 and 390px, `404-comparison-desktop.png`,
`404-comparison-mobile.png`, `mobile-overview.png`, and `proof.json`.
Reference crops retain their aspect ratio; the CSS scale of supplied mockups
is inferred. CMS responses in normal captures use a read-only local fixture,
not production data. These are local visual checks, not user approval or a
claim of pixel-identical reproduction.

Run the focused suite with:

```sh
PLAYWRIGHT_CHROMIUM_CHANNEL=chrome PLAYWRIGHT_BASE_URL=http://127.0.0.1:4343 npx playwright test tests/e2e/error-pages.spec.ts --project=chromium-desktop --project=chromium-mobile
```

Scope intentionally excludes full-site E2E, changes to protected-route handling,
Safari/Firefox-specific verification, live CMS writes and production deployment.

Verification completed locally: the initial focused suite passed 10 tests, then
the final typography/responsive/CMS-outage pass passed six targeted tests.
`npm run check`, `npm run build`, `npm run nfr:cms` and `git diff --check` passed.
The existing TempleDetail script hint and Home/Calendar JSON import-attribute
build warnings remain outside this change. Built error pages reference existing
hashed stylesheets; Home does not load error-page CSS. All six final screenshots
were personally inspected, including the desktop and mobile reference pairing.
