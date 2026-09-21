# Shared Public UI

## Contract

Reuse shared anatomy, semantics and interaction fixes. The public shell owns
outer width, responsive gutters, banner composition and page-title scale. Route
owners keep internal grids, domain-specific density, controls and media focal
points. A different task layout must still sit on the same site frame.

| Owner | Use | Current consumers |
| --- | --- | --- |
| `tokens.css` page tokens | 1220px maximum, 32/20/12/8px responsive gutters; 48/40/28px secondary-page title scale | Public header/footer, Home, Calendar/Day, planner, temple hub/collections/directory/details, tarot and horoscope tools, shop/merit |
| `Header.astro`, `Footer.astro` | One public shell; Footer keeps only the approved ivory Day variant and contextual links | All public routes through `BaseLayout.astro`; admin/seller workspaces remain separate |
| `PageBanner.astro`, `page-banner.css` | Shared full-width image layer, shade, motifs, breadcrumb/copy scale, quote and content alignment | Calendar, Day, temple hub, three temple collections, planner and Thailand directory via `TempleSearchHero` |
| `scripts/planner/place-card.js` | One escaped, semantic place-selection renderer for desktop tiles and mobile rows | Planner list in picker-only and combined views |
| `icons/SiteIcon.astro` | Decorative heritage raster or Lucide icon; parent provides the accessible action name | Header/footer, Home, Calendar, Calendar Day, Place Detail |
| `lib/ui-markup.js` | Same Lucide glyph attributes for Astro and runtime-rendered HTML | `SiteIcon`, place detail SSR, CMS refresh, travel controls, map markers |
| `IconMedallion.astro` / `renderIconMedallion` | A circular centered icon wrapper; slot/argument is trusted icon markup | Home intent cards, Calendar summaries, Calendar Day facts/guidance, Place Detail headings/activities |
| `public-ui.css` | Icon mask, medallion anatomy, existing glass material | All public routes via `stylesForPath` |
| `site.css` native-select rule | One owner for native single-select appearance, arrow and arrow clearance | Calendar, temple directory/planner, legacy forms, admin |
| `CarouselControls.astro`, `LinkArrow.astro`, `BrandOrnament.astro` | Existing shared control, link affordance and decorative motif | Existing Home/Calendar/detail/shell consumers |

## Usage

For a full-width public content section, use `width: var(--page-width)` and
`margin-inline: auto`. Do not add another outer max-width or mobile gutter in a
route stylesheet. `--page-inset` is the equivalent padding for full-bleed bands.
Nested forms, reading columns, charts and map dialogs may be narrower; do not use
the outer page-width token inside an already constrained container.

```astro
<PageBanner titleId="page-title">
  <CmsImage slot="media" mediaId="existing-cms-image-id" image={cmsImage}
    width={1920} height={1080} loading="eager" fetchpriority="high" />
  <div class="page-banner__copy">
    <nav class="page-banner__breadcrumb" aria-label="เส้นทางนำทาง">...</nav>
    <h1 id="page-title">...</h1>
    <p class="page-banner__description">...</p>
  </div>
  <Fragment slot="quote">...</Fragment>
</PageBanner>
```

`PageBanner` accepts `titleId`, optional `class` and `adminKey`, with `media`,
default-content and optional `quote` slots. It has no route-name variants and
does not fetch data. Callers keep image/CMS ownership, focal points, heading IDs,
forms and navigation behavior. `TempleSearchHero` is a data/content adapter, not
a second visual implementation. Home's carousel and the place-detail gallery
are deliberately not editorial banners. Interactive tool headers retain their
functional media but share the title and outer-width tokens.

The adapter's optional search panel is rendered below the banner in its own
page-width frame. A long form must not change the visual height of the banner.

`CmsImage.mediaId` is the CMS DOM identity; Astro's `slot` is reserved for content
placement. Do not reuse `slot` for both: the image can silently disappear when
nested in another Astro component. Preserve rendered IDs and metadata during
refactors and assert that the media exists, decodes and is visible.

`renderPlannerPlaceCard(item, { selected, disabled })` owns only markup. The
picker owns selection, focus restoration and event delegation; CSS chooses the
tile/row composition. Selected status lives over the image; the separate 44px
action retains add/remove semantics. Missing photographs stay visibly labelled.
It is not a replacement for navigation cards or calendar cells.

```astro
<IconMedallion class="pd-medallion">
  <SiteIcon name="lotus" />
</IconMedallion>
```

```js
renderIcon("route", "pd-icon");
renderIconMedallion(symbols.lotus, "cal-summary-symbol");
```

`renderIconMedallion` only accepts trusted, code-rendered icon HTML, never raw
CMS text. `renderIcon` restricts names to local asset identifiers and escapes
attributes. It deliberately does not impose an outer size or interactive role.
Continue using the existing SiteIcon template cloning in Calendar; it preserves
Astro's optimized heritage images and scoped icon styles.

Medallions own centering and roundness. Local classes own width/height, flex
behavior, border, tone, padding, responsive sizes and placement. Do not move
page grids, margins or heading typography into the medallion.

Native selects expose these optional custom properties on the **select itself**:

- `--ui-select-chevron`: local arrow image; existing default preserved.
- `--ui-select-chevron-size`: default `18px`.
- `--ui-select-chevron-inset`: default `18px`.
- `--ui-select-padding-end`: default `44px`.

Calendar uses its existing compact `12px / 7px / 22px` values. Route selectors
keep their width, height, font size and padding on other sides. Do not introduce
another `appearance`/arrow implementation or apply compact sizes to every form.
If a route sets a padding shorthand, use `var(--ui-select-padding-end, 44px)`
for its right side. Multiple selects remain outside this arrow rule.

## Boundaries

- Keep Home's navigation cards, calendar date cells and place/travel cards local:
  their semantics, content and interaction contracts differ.
- Keep CMS-responsive media and temple-responsive media adapters separate;
  their source/update/fallback ownership differs. Shared visual appearance alone
  does not justify merging their data flows.
- No changes to live CMS, API, admin actions, navigation content or page routes.
- This pass does not migrate every old card/button to one visual design. Reuse
  current primitives first on follow-up work; extend only after inspecting actual
  consumers and keeping route layout intact.

## Public Frame Verification

The September 21 shared-frame pass extends presentation across public route
families, not CMS/admin data or seller operations. Use:

```sh
node scripts/qa/page-shell.mjs after
PLAYWRIGHT_CHROMIUM_CHANNEL=chrome PLAYWRIGHT_BASE_URL=http://127.0.0.1:4326 npx playwright test tests/e2e/calendar.spec.ts tests/e2e/calendar-day.spec.ts tests/e2e/planner-workspace.spec.ts --project=chromium-desktop
```

The shell harness samples every public template family at 1440 and 390px. It
checks shared header/content/footer alignment, one H1, decoded banner media,
overflow and script errors, and exercises the mobile footer disclosure. It
captures top-of-page and footer images for personal visual inspection, not just
computed-style approval. `SHELL_ROUTES=calendar,day` narrows a follow-up run.

These samples do not prove every generated temple/card detail or every business
flow. Keep admin/seller widths, full-screen maps, reading-column constraints and
the Home composition separate unless a new request changes those contracts.

## Regression Gate

Acceptance: no geometry/typography/color drift, working select change/focus,
working travel filter/disclosure, no runtime errors or horizontal overflow.

| Surface | Evidence | Priority |
| --- | --- | --- |
| Home, Calendar, Calendar Day, Place Detail | Same fixture/date, full-page before/after, measured layout and styles at 390/1440 | P0 |
| Directory and life-graph selects | Same dimensions/styles and native control behavior | P0 |
| Shared markup | Asset paths, decoration semantics, class preservation, injection rejection | P0 |

Before changing shared CSS/markup:

```sh
node scripts/qa/shared-ui.mjs before
# Make the scoped change.
node scripts/qa/shared-ui.mjs after
node --test tests/runtime/ui-markup.test.mjs tests/runtime/place-detail.test.mjs
npm run check
git diff --check
```

The harness uses installed Chrome and the local preview at port 4326; override
with `UI_QA_URL`. API responses are read-only local fixtures, not production.
Artifacts live under `artifacts/shared-ui`. Baseline screenshots are task-local,
not universal approved golden images. Do not replace a failing baseline just to
make the test pass. Inspect and fix the affected consumer first.

Safari/Firefox, production smoke, full E2E and backend checks are separate release
work and are not implied by this scoped public-presentation comparison.
