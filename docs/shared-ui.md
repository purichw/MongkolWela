# Shared Public UI

## Contract

Reuse shared anatomy, semantics and interaction fixes. The public shell owns
outer width, responsive gutters, banner composition and page-title scale. Route
owners keep internal grids, domain-specific density, controls and media focal
points. A different task layout must still sit on the same site frame.

| Owner | Use | Current consumers |
| --- | --- | --- |
| `tokens.css` page tokens | 1220px maximum, 32/20/12/8px responsive gutters; 56/44/32/30px page-title scale; 64/52/36/32px editorial display role | Public content/footer, Home, Calendar/Day, planner, temple hub/collections/directory/details, tarot and horoscope tools, shop/merit |
| `Header.astro`, `Footer.astro` | One public shell; Footer keeps only the approved ivory Day variant and contextual links | All public routes through `BaseLayout.astro`; admin/seller workspaces remain separate |
| `Topbar.astro`, `lib/site-navigation.js`, `scripts/navigation.js`, `header.css` | One published navigation model for SSR/CMS; split links/disclosures, opaque panels, compact dialog drawer and intrinsic fit guard | Every shared Header consumer |
| `PageBanner.astro`, `page-banner.css` | Shared full-width image layer, shade, motifs, breadcrumb/copy scale, quote and content alignment | Calendar, Day, temple hub, three temple collections, planner and Thailand directory via `TempleSearchHero` |
| `scripts/planner/place-card.js` | One escaped, semantic place-selection renderer for desktop tiles and mobile rows | Planner list in picker-only and combined views |
| `icons/SiteIcon.astro` | Decorative heritage raster or Lucide icon; parent provides the accessible action name | Header/footer, Home, Calendar, Calendar Day, Place Detail |
| `lib/ui-markup.js` | Same Lucide glyph attributes for Astro and runtime-rendered HTML | `SiteIcon`, place detail SSR, CMS refresh, travel controls, map markers |
| `IconMedallion.astro` / `renderIconMedallion` | A circular centered icon wrapper; slot/argument is trusted icon markup | Home intent cards, Calendar summaries, Calendar Day facts/guidance, Place Detail headings/activities |
| `public-ui.css` | Icon mask, medallion anatomy, existing glass material | All public routes via `stylesForPath` |
| `site.css` field rules | Native single-select appearance/arrow clearance; centered public choices and short numeric/date/time values | Calendar, temple directory/planner, horoscope, shop/merit; admin/seller keep existing alignment |
| `public-select.js`, `public-select-control.js`, `public-select.css` | Native-backed Choices.js dropdown, searchable long lists, floating popup, keyboard and form synchronization | Visible public single-selects, including asynchronously rendered filters; excludes admin/seller and multi-selects |
| `CarouselControls.astro`, `LinkArrow.astro`, `BrandOrnament.astro` | Existing shared control, link affordance and decorative motif | Existing Home/Calendar/detail/shell consumers |

## Usage

### Shared Navigation

The header handoff intentionally gives navigation a 1440px maximum frame with
32/24/12px gutters; content/footer retain their 1220px frame. The utility strip
scrolls away. `--site-header-sticky-height` measures the sticky main row;
`--site-header-visible-bottom` measures its current viewport bottom. Calendar's
observer, Planner anchors, Tarot detail and temple sticky sidebars use this
measurement contract. Do not resize page bodies to compensate for header height.

`navigationModel` preserves published order, gates and stable IDs. Both renderers
share grouping/escaping/current-route logic. `updateHeaderNavigation` reconciles
keyed elements to retain focus, groups and scroll. Request/revision ownership
stays in `cms-runtime` / `content-refresh`; no second fetch loop or root HTML swap.
Native details work before JS; enhancement moves the same fallback content into
one modal dialog. Desktop panels are ordinary disclosures, not ARIA menus.

Latest compact adaptation: temple panel 560px, drawer title 20px, primary rows
16px, children 15px, tools 14px regular, controls at least 44px. Drawer utility
aliases are omitted only when their exact destination is already in the main
menu. Decorative art is a shared design asset; CMS still owns navigation labels
and routes. See `docs/header-navbar-implementation.md` for proof and limitations.

### Page Surfaces

For a full-width public content section, use `width: var(--page-width)` and
`margin-inline: auto`. Do not add another outer max-width or mobile gutter in a
route stylesheet. `--page-inset` is the equivalent padding for full-bleed bands.
Nested forms, reading columns, charts and map dialogs may be narrower; do not use
the outer page-width token inside an already constrained container.

Page-title scale was enlarged at the user's request in the Hub mockup pass.
`--page-title-size` applies to shared secondary-page titles; the Hub uses
`--page-display-title-size` for its short editorial H1. The latter is not a blanket
rule for every H1, card, dialog or admin title. `--section-title-size` stays 28px
desktop / 22px mobile / 20px below 360px. Card titles, table headings and controls
retain their domain-specific sizes. Use role tokens, not viewport-scaled type.

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
keep their width, height, font size and vertical padding. Do not introduce
another `appearance`/arrow implementation or apply compact sizes to every form.
If a route sets a padding shorthand, use `var(--ui-select-padding-end, 44px)`
for its right side. Multiple selects remain outside this arrow rule.

Public single-selects reserve the same arrow clearance on both sides and center
the selected value. Number, numeric-code, date and time inputs also center their
values. Free-text/search inputs, contact details, textareas and field labels keep
their existing reading alignment; the Thailand registry centers its short temple
name query explicitly. Admin and seller operations are excluded. Date/time
pickers remain native.

### Public Dropdowns

`site.js` initializes one lazy-loaded enhancer for single-selects inside `main`.
Choices.js owns selection/search/keyboard behavior; Floating UI places the popup
in the browser top layer to avoid clipping. The native select remains the source
of truth for option labels/values, form data, required validation and `change`
events. No data source or CMS schema changes are needed.

- Search is automatic for eight or more enabled, nonempty options, except short
  numeric lists such as hours/minutes. Years, provinces and long place lists are
  searchable. `data-select-search="on"` or `"off"` explicitly overrides this.
- New controls and changed options/disabled attributes are observed automatically.
  After assigning only `.value` programmatically, call `syncPublicSelects(root)`
  from `src/scripts/public-select.js`; Calendar and Planner already do this.
  Native `change` and form `reset` synchronize the shared display automatically.
- Selected labels/options are centered. Search input stays left-aligned. Shared
  CSS owns the popup, selection marker, focus ring and disabled/invalid states;
  route CSS owns control geometry through `--mw-select-height`,
  `--mw-select-font-size` and the existing arrow-clearance properties.
- `data-native-select`, `multiple`, `size > 1`, and hidden legacy controls opt out.
  Without JavaScript or Popover API support the native control remains available.
  The enhancer does not apply to Admin or seller-console forms.
- Plain option labels are never rendered as HTML. No external fonts, CDN scripts,
  API keys or third-party data requests are introduced.

Focused verification: `tests/e2e/public-select.spec.ts` covers cascading filters,
search/no results, keyboard/focus, validation, form data/reset, async options,
literal HTML labels, narrow popup bounds and native fallback. The field-alignment
suite samples Calendar, Planner, registry, horoscope and commerce controls.

## Tool Layout

`ToolsLayout.astro` composes `BaseLayout.astro`; it does not fork the shared
header, footer, navigation, SEO or CMS runtime. `ToolsHero.astro` owns the tool
title, breadcrumb, lead and optional quote. `tools.css` is loaded only on Tarot
and the four horoscope tool routes, after existing route styles.

Use `.tools-workspace` for an input rail with a result surface, `.tools-form` for
the input surface, and `.tools-section` for unframed supporting content. Route
owners retain field IDs, state, chart logic, storage and result navigation.
Thai astrology needs a custom grid so its single chart can precede the same form
on mobile; do not render a second chart or duplicate the form.

See [tool implementation notes](tools-layout/IMPLEMENTATION_NOTES.md) for route
coverage, calculation limitations, reference adaptations and scoped QA evidence.

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
| Public single-selects | Shared custom UI, native values/forms, keyboard/focus, cascade/reset, search and mobile popup bounds | P0 |
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
