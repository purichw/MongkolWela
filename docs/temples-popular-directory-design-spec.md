# Temples Popular Directory Design Spec

Source:
- Screenshot: `/Users/point/Website Projects/hora-astro/outputs/temples-popular-standalone/source-desktop.png`
- Offline export: `/Users/point/Website Projects/hora-astro/outputs/temples-popular-standalone/index.html`
- Runtime surface: `/temples/popular/`
- Implementation files: `src/pages/temples/popular/index.astro`
- Implementation files: `src/components/TempleSearchHero.astro`
- Implementation files: `src/components/TempleFilterChips.astro`
- Implementation files: `src/components/TempleMapOverlay.astro`
- Implementation files: `public/assets/css/temples.css`, `public/assets/css/temple-map.css`
- Implementation files: `src/scripts/temple-directory.js`, `src/scripts/temple-map.js`

## Purpose

- Present the main `สายไหว้พระ 9 วัด` listing page for the temple vertical.
- Let users scan popular temple cards and jump into temple detail pages.
- Support filtering by name, region, province, purpose, and nearby location.
- Keep trip discovery practical, sacred-place focused, and separate from horoscope positioning.
- Preserve the default page state for design review: first 30 cards visible, filters reset, map floating button visible.

## Visual Direction

- Preserve the existing Mongkol Wela temple design system.
- The page uses a warm sacred-place palette: dark hero overlay, cream paper surfaces, lacquer red CTAs, gold borders, and jade accents.
- The mood is editorial but useful: a temple guide with search tools, not a marketing landing page.
- Imagery is central; cards must show real temple photos when verified source imagery exists.
- Placeholder cards are acceptable only when source data intentionally uses the placeholder image.
- Do not add new decorative wrappers or redesign the page hierarchy.

## Layout

- Main page shell is `.temples-hub`.
- Hero uses `.temple-page-hero.has-panel`.
- Hero minimum height is `560px` on desktop with panel.
- Hero content width is `min(var(--container), calc(100% - 40px))`.
- Hero copy sits above the filter panel inside `.temple-page-hero-content`.
- Search/filter panel uses `.temple-page-hero-panel` and `.temple-search-panel`.
- Results section uses `.temples-section.temples-popular-section`.
- Results container width matches `var(--container)` constrained by viewport gutters.
- Section header uses `.temples-section-head` with left title and right count.
- Card grid uses `.popular-temple-grid`.
- Desktop card grid is 3 columns with `22px` gap.
- Default export state shows 30 visible cards out of 243 total cards.
- The `ดูเพิ่ม` button sits centered below the grid.
- Floating map button remains fixed at lower right.

## Hero And Search Panel

- Breadcrumb labels are `หน้าแรก / วัดดังเสริมมงคล / สายไหว้พระ 9 วัด`.
- H1 is `สายไหว้พระ 9 วัด`.
- Description explains route planning, temple discovery, Thai temple database, and auspicious-life fit.
- Hero image is `/assets/images/hero-temple-red.jpg`.
- Hero image uses object fit cover and `--temple-hero-focus`.
- Dark layered shade must preserve text contrast over the temple image.
- Filter panel contains a search field labelled `ชื่อวัด`.
- Search placeholder is `ค้นหาในสายไหว้พระ 9 วัด`.
- Action buttons are `ค้นหา`, `พิกัดใกล้ฉัน`, and `เคลียร์ข้อมูล`.
- Primary search button uses lacquer fill.
- Nearby button uses cream surface by default and jade when active.
- Clear button uses muted neutral surface.

## Filter Chips

- Region chips live in `.popular-temple-region-tags`.
- Default active region chip is `ทั้งหมด`.
- Region choices follow source order: ภาคเหนือ, ภาคกลาง, ภาคตะวันออกเฉียงเหนือ, ภาคตะวันออก, ภาคตะวันตก, ภาคใต้.
- Province filter uses native `<details class="temple-province-accordion">`.
- Purpose filter uses native `<details class="temple-purpose-accordion">`.
- In default state, province and purpose accordions are closed.
- Summary right-side text is `ทั้งหมด` until selections are active.
- Open accordion content uses compact pill chips.
- Active chips use lacquer fill with cream text.
- Disabled/unavailable chips should reduce opacity and remain readable.
- Filters should not auto-scroll or reflow the hero unexpectedly before submit.

## Temple Cards

- Cards are anchors with `.popular-temple-card`.
- Card links should point to the matching popular temple detail route.
- Cards use a 16:10 image figure.
- Rank badge appears at top-left of each image as `#01`, `#02`, etc.
- Distance badge appears at top-right only when nearby sorting is active.
- Card body contains region chip, temple name, and province/district line.
- Region chip colors vary by `data-region`.
- Card H3 uses heavy Thai type and compact line height.
- Card surface is warm cream with subtle gold border and soft warm shadow.
- Hover/focus on a card gently scales and saturates the image.
- Focus-visible outline must remain visible outside the card.
- Placeholder cards keep `.is-placeholder` and muted imagery treatment.
- Hidden cards remain in DOM for load-more behavior.

## Interactions

- Submit search commits current name, region, province, and purpose filters.
- Count text reports filtered total, for example `แสดง 243 จาก 243 พิกัด`.
- Empty state text is `ไม่พบสายไหว้พระ 9 วัดที่ตรงกับคำค้นหา`.
- `ดูเพิ่ม` increases visible cards by the batch size.
- Source configuration is `data-initial-count="30"` and `data-batch-size="30"`.
- Nearby button requests geolocation in production.
- Offline export uses mock nearby feedback instead of requesting real location.
- Map floating button opens a modal map in production.
- Offline export uses a lightweight map-preview modal and keeps open/close behavior.
- Internal links in the offline export are rewritten to production URLs for clickability.

## Tokens And Styles

- Preserve tokens: `--container`, `--ink`, `--ink-soft`, `--lacquer`, `--jade`, `--line`, `--radius`, and `--shadow`.
- Key colors: lacquer `#7b271f`, CTA red `#9f3028`, gold `#d6ad55`, jade `#123f33` or `var(--jade)`.
- Warm surfaces use `#fffdf6`, `#fffaf0`, and translucent cream fills.
- Hero text uses cream and gold over dark overlay.
- Borders are thin, low-contrast brown or gold.
- Cards and panels use `var(--radius)`.
- Pills may use `999px` radius.
- Shadows stay warm and soft; do not introduce hard black card shadows.
- Letter spacing remains `0`.
- Motion should remain purposeful: card reveal, accordion reveal, image hover.
- Respect `prefers-reduced-motion`.

## Responsive Behavior

- At `max-width: 900px`, card grid collapses from 3 columns to 2.
- At `max-width: 900px`, filter form becomes a single column.
- At `max-width: 720px`, hero has no fixed minimum height.
- At `max-width: 720px`, page gutters become `min(100% - 28px, var(--container))`.
- At `max-width: 720px`, card grid becomes 1 column with `16px` gap.
- At `max-width: 720px`, `.temples-section-head` stacks vertically.
- At `max-width: 720px`, filter action buttons become full-width.
- At `max-width: 720px`, filter panel padding becomes `18px`.
- No horizontal overflow is acceptable at 390px viewport.

## Accessibility

- Keep semantic `<main>`, breadcrumb `<nav aria-label="breadcrumb">`, and section headings.
- H1 must remain the only page title.
- Search input must keep a visible label, not placeholder-only labeling.
- Filter chips must expose active state with `aria-pressed`.
- Native details/summary controls must remain keyboard accessible.
- Count and empty nodes should remain status regions.
- Map modal must expose dialog semantics and close controls.
- Nearby button must keep `aria-pressed` and `aria-busy` states.
- All cards need meaningful image alt text.
- Card links must remain keyboard focusable and visible on focus.

## Export Notes

- Export is a DOM snapshot from local source render.
- Default state is preserved: accordions closed, first 30 cards visible, load-more visible.
- Source scripts are removed from the standalone HTML.
- Lightweight export JavaScript preserves key local interactions without real geolocation or live map tiles.
- Internal navigation links point to `https://mongkolwela.vercel.app`.

## Guardrails

- Do not convert this page into a new landing page.
- Do not remove the hero search panel or move it below results.
- Do not flatten province/purpose accordions into always-open chip blocks.
- Do not change initial visible card count without product approval.
- Do not remove `ดูเพิ่ม` while hidden cards remain.
- Do not hide placeholder cards unless source image audit changes.
- Do not replace temple-card imagery with generic decorative imagery.
- Preserve the floating map affordance.
- Preserve card route links and data attributes used by JS filtering.

## QA Checklist

- Open standalone export via `file://`.
- Confirm first viewport matches the popular page default state.
- Confirm province and purpose accordions are closed by default.
- Confirm visible cards equal 30 on desktop and mobile.
- Confirm total cards in DOM equal 243.
- Search `วัดระฆัง` and confirm one visible matching result.
- Click `เคลียร์ข้อมูล` and confirm default grid returns.
- Click `ดูเพิ่ม` and confirm visible cards increase to 60.
- Open province accordion and confirm chip content appears.
- Click map floating button and close map modal with `Escape`.
- Check desktop at 1440px and mobile at 390px.
- Confirm no console or page errors.
- Confirm no horizontal overflow.
- Confirm first 30 card images render offline.
