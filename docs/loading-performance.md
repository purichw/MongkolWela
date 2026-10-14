# Loading Performance

## Investigation (2026-10-11)

Read-only production samples covered Home, the popular collection, a temple
detail and daily tarot at 1440 x 1000. Network timings are single-session
diagnostics, not field Core Web Vitals or a before/after speed guarantee.

- Observed LCP was roughly 2.5-3.3 seconds across those routes.
- The temple detail requested ten loader illustrations through `/_image`;
  each runtime transform took about 1.85-1.91 seconds in that sample.
- Initial browser CMS reads took about 1-2.1 seconds. Live SSR details had
  already read that same document before returning their HTML.
- The full-page loader waited for `window.load`, so an unrelated eager image
  could keep obscuring otherwise usable content. A held-image regression test
  reproduced this before the fix.

## Changes

- Loader illustrations are checked-in 384 x 384 WebP derivatives with the
  existing quality and animation. Plain image imports produce hashed static
  URLs even on SSR, eliminating ten runtime transformations per detail load.
  They have low fetch priority; the temple hero retains high priority.
  The shared heritage icons (temple, stupa, lotus and altar) and header artwork
  reuse these same files instead of additional 128px/256px SSR transforms.
  Regenerate with `node scripts/optimize-loading-images.mjs` after changing
  the original PNG artwork.
- Initial page loading uses the shared readiness contract below, independent
  of decorative images or other noncritical resources. Navigation loading is
  preserved.
- Temple details bootstrap the browser from the fresh public CMS projection
  already read by SSR. This removes one initial browser round trip, not the
  server's authoritative read. No TTL cache or stale-data fallback was added.
- The existing Thai font families, reduced-motion behavior and visible-tab
  CMS refresh lifecycle are preserved.

## First-Render Audit (2026-10-14)

The shop's service request could still be pending after DOM/font readiness.
The previous 2.5-second font escape timer also revealed incomplete pages. A
held-commerce-request test reproduced visible loading content before the fix.

`PageEntrance.astro` installs `page-readiness.js` inline before external CSS:

- Wait for DOM, page stylesheets, actual rendered font families/weights, shared
  runtime, initial CMS publication and each route's initial data owner.
- Declare an owner in server HTML with `data-page-pending="name"`. Remove it
  using `settlePageContent(root)` only after success, empty state or actionable
  error is rendered. Do this in the initial request's `finally` block. Later
  filter requests, refreshes and retries keep their existing local feedback;
  they never re-hide the whole page or discard user input.
- Initial owners cover shop/merit, search, all three temple collections, the
  Thailand registry, planner, calendar, life graph, temple activities/commerce,
  admin and seller. Static tools/content wait for CMS and shared runtime.
- Start the existing branded loading screen after 180ms; if shown, keep it
  visible for at least 360ms to avoid a flash. These are presentation timings,
  not readiness deadlines. Pending page content is hidden and inert.
- Load the used Thai/Latin faces explicitly with `document.fonts.load` and
  check again after CMS/route rendering. `document.fonts.ready` also waited for
  an unrelated image in the browser regression, so it is not the completion
  signal. Typography must not briefly fall back before reveal.
- CSS/module failures or 30 seconds without completion show a self-contained
  recovery screen with reload. Never reveal partial content just because time
  elapsed. A slow data/font operation can still finish after the notice.
- JSON requests are bounded by the existing 15-second request helper. An API
  failure stays distinct from a genuinely closed shop. CMS-dependent reading
  placeholders become explicit failure states and support the CMS retry.
- Deferred map styles are marked `data-page-nonblocking`: their own map
  loading/error behavior must not fail the whole page. Analytics, decorative
  images, lazy media and map tiles are not first-render dependencies.
- Without JavaScript the entrance gate is not applied; existing no-JS
  content/instructions remain available. Admin auth remains fail-closed.

### Reproduction And Coverage

After `npm run build`, run:

```sh
PLAYWRIGHT_BROWSERS_PATH=artifacts/playwright-browsers node scripts/audit-page-readiness.mjs
```

The audit uses a loopback in-memory CMS and the built Vercel renderer, never
production writes. It inventories every built HTML URL, three representative
SSR temple details (one per collection), and query variants. It checks the
shared ready state, pending markers, visible busy/loading content and browser
exceptions. It is not an exhaustive audit of every temple record or every
authenticated CMS action. Font networking is mocked only for this inventory;
separate real-font screenshots and font-delay tests cover typography.

`page-readiness.spec.ts` adds delayed/failed CSS and modules, held/failed/timed-out
data, CMS failure/retry, asynchronous initial calculation, deferred map assets
and refresh-with-input coverage. `admin-loading.spec.ts` verifies signed-out,
revoked, unavailable and valid sessions, reload, sign-in and logout. Test
artifacts are saved under `artifacts/loading-performance/`.

### Verification Result

- Built-route audit: 129/129 passed, including the three SSR detail templates.
  Embedded map progress is recorded separately as intentionally deferred UI,
  not silently removed from the report.
- Chromium desktop/mobile regression: 78/78 passed across readiness, entrance,
  admin auth loading, CMS bootstrap/freshness and loading illustrations.
- Request/cache and content-refresh unit checks: 3/3 passed.
- `npm run check`: 83 Astro files and 88 browser modules, no errors/warnings.
  `npm run build`: passed (local Node 26; configured Vercel runtime Node 24).
- Real-font shop captures at 1440 and 390px: no horizontal overflow or browser
  exceptions; Noto Sans Thai and Prompt faces loaded. Ready captures wait for
  the existing loader's exit transition, not just its ready event.
- At the pre-release inspection, production HTML still had the old 2.5-second
  font escape and no commerce readiness marker. The results above describe the
  local candidate before its authorized push and deployment.

Evidence: `route-audit-complete/results.json`, `readiness-regression/`, and
`readiness-visual/` under `artifacts/loading-performance/`. Screenshots show a
deliberately delayed local commerce response, then its disabled-service state.

## Focused Verification

`page-entrance.spec.ts` covers pending images/fonts, no-JS and reduced motion.
`loading-images.spec.ts` checks the ten images and existing animation.
`cms-bootstrap.spec.ts` exercises the built SSR function against a loopback,
in-memory CMS, including live changes, revision parity, outages, retries,
malformed/wrong-path bootstrap and safely escaped embedded JSON.
`cms-freshness.spec.ts` protects focus, bfcache and timed refresh behavior.

The pre-release audit only inspected production; it did not change it. Measure
production timings again after deployment; local timings cannot establish a production
LCP improvement. The first-render inventory above does not certify third-party
availability, all browser engines or every authenticated workflow.
