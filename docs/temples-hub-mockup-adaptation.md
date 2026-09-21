# Temple Hub Mockup Adaptation

## Scope And Authority

2026-09-21. The user explicitly selected **Hub `/temples/`**, after clarification that
`mongkolwela-popular-collection-codex-handoff/CODEX_IMPLEMENTATION_PROMPT.md`
describes `/temples/popular/` instead. The four supplied Hub images govern this
change. Popular-only filter, map, list and URL-state requirements are not applied
to the Hub. A later user request explicitly authorized larger headings elsewhere:
shared page-title tokens are therefore enlarged, with targeted heading checks on
their consumers. Collection/planner behavior, detail layouts and header/footer
design are otherwise unchanged.

The visual synthesis uses reference 2's compact five-section structure with
reference 4's red first collection and photo-led ivory/gold peers. This is a
mockup-to-product adaptation, not a claim of pixel-exact reproduction.

## Preserved And Translated

- Preserved shared header/footer, `PageBanner`, page-width/gutter tokens, CMS
  runtime ownership, existing GET search and category/intent/tool destinations.
- Reused `CmsImage`, `SiteIcon`, `LinkArrow` and `BrandOrnament`. Collection links
  are not place-result cards: their different semantics remain local composition.
- Translated the golden architectural hero, shaded text area, integrated search,
  numbered section hierarchy, horizontal category cards, jade planning tool,
  meaningful icons, warm notice, confidence legend and compact supplementary tools.
- Collection counts come from the existing datasets. The directory count now
  comes from the build-time registry summary, not a literal screenshot number.
- Mobile uses short collection rows, stacked tool links, three-column icon/text
  intent tiles and a native details notice. Secondary tool descriptions remain
  on desktop; mobile keeps each tool's identity, destination, count and CTA.
- Current shared navigation/footer content is authoritative. Illustrative social
  links and destinations are not fabricated to fill the reference.

## Ownership And CMS

- `src/pages/temples/index.astro`: Hub composition and native navigation/search.
- `src/styles/temple-hub.css`: Hub-only geometry, type scale and responsive layout.
- `src/config/styles.js`: exact `/temples/` loads Hub CSS instead of the large
  legacy `temples.css`/map bundle. Other temple routes retain their current styles.
- `src/data/temple-page-banners.json`: only the `hub` banner default changed.
- `src/data/temple-hub-media.js`: independent collection media defaults with source
  metadata. Home's runtime CMS configuration is not coupled to this route.
- Stable selectors include `#temple-page-title`, `#temple-hub-search`, `#collections`,
  `#intent`, `.temple-hub-v2-card--popular`, `#supporting-tools` and the original
  `.temple-hub-v2-hero-image` class.
- New image IDs: `#temple-hub-hero-image`, `#temple-hub-collection-sacred`,
  `#temple-hub-collection-mu`. All support existing CMS image patches, including
  alt, focal point and source metadata. No live/seed CMS JSON was written.
- Focal point is not overridden by mobile CSS. Published image patches therefore
  remain effective at all widths. Broken images use the existing neutral fallback.

## Visual Review Findings

Baseline screenshots were captured before implementation at 1440 and 390 px.
The old mobile page was 3040 px tall, with oversized text-only cards and a dark
confidence panel dominating the lower half.

The first new render exposed three issues that source inspection alone missed:
the search glyph inherited a filled SVG style; Astro's component specificity
overrode some icon sizes; intrinsic image sizing produced unequal mobile rows.
All were corrected locally without changing shared component defaults.

Equal-width reference/actual comparisons then exposed excess mobile tool and
intent-card height. Tool secondary text was reduced on mobile, intent tiles became
horizontal icon/text groups, and desktop supplementary tools moved onto one row.
Full-page captures also needed an explicit instant scroll reset and settled frames
to avoid capturing the sticky header halfway down the page.

## Verification

Run from the project root:

```sh
npm run build
node scripts/qa/temples-hub.mjs
node scripts/qa/temples-hub-comparison.mjs
node scripts/qa/page-headings.mjs
node --test tests/runtime/ui-markup.test.mjs
git diff --check
```

`HUB_QA_URL` selects the preview (default `http://127.0.0.1:4349`). The local preview
uses a read-only published-content fixture, not production CMS mutations.

Targeted coverage: 320/390/768/1024/1440 px overflow, equal collection rows,
three-column mobile intents, rendered custom Thai fonts, all local destinations,
decoded images/icon assets, native search, keyboard disclosure, CMS image/title/
focal-point patches, refresh preserving unsent input, fallback/recovery, and basic
Hub navigation without JavaScript. Main-region axe checking additionally caught
and corrected insufficient gold count-text contrast.

Final Hub captures are 1577px tall at 1440px width and 1491px at 390px width.
The later heading request is implemented through shared roles: page title
56/44/32/30px, editorial display title 64/52/36/32px, and Hub section titles using
the existing 28/22/20px section scale. The heading harness checks 14 public routes
at 1440/390/320px; representative banner/tool snapshots were visually inspected
at both desktop and mobile sizes. Commerce's existing local title override remains
36/28px. This is not a global increase of every `h2` or compact-panel heading.

Final checks: 735-page static build, Hub harness, 42 heading geometry checks,
four shared-icon runtime tests, `git diff --check`, and zero axe violations in the
390px Hub main region. Full-page reference comparisons were reopened after the
final typography changes, not just generated for the user to inspect.

Evidence is in `artifacts/temples-hub/`: full-page desktop/mobile, viewport captures,
reference/actual comparisons, QA JSON and build log. Comparison crops retain aspect
ratio and remove only slide/device framing. Reference 2's mobile ends before its
footer; the implementation intentionally retains the shared footer.

Not run: full-site E2E/NFR, production smoke, live CMS publishing or deployment.
The existing dirty worktree and unrelated changes remain untouched.
