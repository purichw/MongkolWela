# Tool Layout Implementation

## Scope And Authority

Date: 2026-09-21. The Thai astrology handoff and the user's circular chart crop
are the visual direction. The same layout language now applies to all current
tool templates, without redesigning temple pages or the global navigation.
No production content, database, auth, checkout or hosting changes are included.

The worktree already contained public select/alignment changes at the start of
this pass. Those remain intact; they are not temple edits made by this redesign.

## Shared Owners

- `src/layouts/ToolsLayout.astro`: composes BaseLayout and adds `tools-page`.
- `src/components/ToolsHero.astro`: one title, breadcrumb, lead and optional quote.
- `src/styles/tools.css`: tool-only typography, gutters, forms and result frames.
- `src/config/styles.js`: enables the tool stylesheet only for in-scope routes.
- Route scripts retain selection, calculation, storage, playback and navigation.
- Header/Footer, CMS page IDs and BaseLayout metadata stay with existing owners.

Consumers: Thai astrology, life graph, palmistry, seamsi, Tarot meanings index
and card detail, daily/monthly/luck Tarot, dynamic love/money/career pages and
all corresponding result templates. There are 14 source templates. Template
coverage is not a claim that every generated URL was manually reviewed.

## Astrology Contracts

`src/scripts/thai-astrology.js` remains the calculation and form-state owner.
`src/scripts/thai-astrology-view.js` renders a committed snapshot into separate
heading, wheel, overview, planet table and reading mounts. Draft edits never
relabel or replace the previous chart until a valid submission succeeds.

Preserved input fields: display name, birth date, hour, minute, birthplace,
chart type, calculation system and transit date. Defaults are current local date
minus 32 years, 07:30, Bangkok, natal, Suriyayatra and today's transit date.
Minute options remain in five-minute increments; the six birthplace choices,
four modes and two calculation systems are unchanged.

The calculation body is unchanged. Birthplace uses coarse offsets, not a
geocoder; date interpretation uses the browser timezone. The existing engine is
an approximation, not a verified ephemeris. Modes share the same basic planet
calculation and transit date affects readings in every mode. Visible provenance
and a disclosure explain these limits. No new astronomical accuracy is claimed.

The live chart has twelve unique canonical houses, clockwise from the top as
before, a real ascendant label, and actual house membership. Its straight and
diagonal gold divisions are schematic, not angular coordinates. Dense houses
show two glyphs and an overflow count; the ten-row planet table retains every
planet, sign, degree, house and meaning. All six reading topics remain available.
Names are escaped before rendering. Failed validation preserves the last chart.

No new save/share account, server submission or birth-data persistence was added.

## Reference Adaptations

- One form and one chart change CSS placement across breakpoints; mobile puts
  the chart before the form without duplicating state or event listeners.
- Chart symbols and labels use real data, not incorrect mockup text or dates.
- The chart is live SVG geometry plus DOM text, never a screenshot of the UI.
- The handoff lacks isolated landscape artwork. Existing lotus/bodhi artwork
  provides the approved paper/ornament fallback, not a pixel-identical landscape.
- Current header/footer and real controls remain; missing mock actions are not
  presented as working features. Tarot's actual card table retains its visual
  treatment within the shared light tool frame.

## CMS And Data Boundaries

No page registry, schema, content or API contract was edited. The bundled CMS
fixture has no tool-page selector patches or sections. Arbitrary production
selector overrides were not fetched or published. Old bespoke hero selectors
were replaced by the shared `.tools-hero` and `#tools-title`; audit any separately
maintained production CSS/selector patches before a future deployment.

Local Astro serves the static frontend but not the Vercel CMS API. Screenshot
and E2E runs explicitly fulfill that endpoint with `public/admin/content/live.json`.
This is labelled fixture evidence, not authenticated production smoke.

## Verification

- PASS: `npm run check`, zero errors/warnings, one pre-existing TempleDetail hint.
- PASS: `npm run build`, 735 generated pages. Existing JSON import-attribute
  consistency warnings are outside this scoped change.
- PASS: three runtime tests for unchanged calculation baselines across both
  systems and four modes, twelve houses/dense membership, escaping and full data.
- PASS: targeted Chrome desktop/mobile journeys for astrology, Tarot daily/love,
  life graph, palm modes and seamsi. Route-family checks sample 18 URLs, one H1,
  decoded ornament assets, overflow and browser errors.
  The combined run completed four desktop tests, then stalled during worker
  teardown and was interrupted. All four mobile tests passed in a separate run.
- PASS: WebKit mobile astrology draft/submit/invalid/resize and serious/critical
  axe checks. Sizes exercised: 320, 360, 430, 768, 1024, 1280 and 1920 CSS pixels.
- PASS: desktop/mobile rendered review and reference comparison. Screenshots are
  under `.local/tools-redesign/`; captures identify viewport and fixture source.
- NOT_RUN: full-site E2E, Firefox, dedicated landscape/text-zoom suite, production
  CMS/auth testing, server-error fault injection and manual screen-reader audit.
- NOT_RUN: push/deploy. This pass is local implementation and verification only.

The no-ascendant partial view is runtime-tested. Busy state is synchronous, so no
artificial loading delay was introduced. Runtime-error recovery is implemented
but has not been fault-injected in the browser.

Commands:

```sh
node --test tests/runtime/thai-astrology-presentation.test.mjs
PLAYWRIGHT_BASE_URL=http://127.0.0.1:4337 PLAYWRIGHT_CHROMIUM_CHANNEL=chrome npx playwright test tests/e2e/tools-layout.spec.ts --project=chromium-desktop --project=chromium-mobile
PLAYWRIGHT_BROWSERS_PATH=.local/playwright-browsers PLAYWRIGHT_BASE_URL=http://127.0.0.1:4337 npx playwright test tests/e2e/tools-layout.spec.ts --project=webkit-mobile --grep 'astrology commits'
npm run check
npm run build
git diff --check
```
