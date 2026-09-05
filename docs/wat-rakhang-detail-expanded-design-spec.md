# Wat Rakhang Detail Expanded Design Spec

Source:
- Screenshot: `/Users/point/Website Projects/hora-astro/outputs/wat-rakhang-detail-expanded-standalone/source-desktop.png`
- Offline export: `/Users/point/Website Projects/hora-astro/outputs/wat-rakhang-detail-expanded-standalone/index.html`
- Runtime surface: `/temples/popular/001-วัดระฆังโฆสิตาราม-กรุงเทพมหานคร/`
- Implementation files: `src/components/TempleDetail.astro`
- Implementation files: `src/styles/temple-map.css`
- Implementation files: `src/scripts/temple-detail.js`

## Purpose

- Present one temple detail page for the Mongkol Wela temple vertical.
- Help users judge whether this place fits their merit-making or blessing trip.
- Keep the temple photo, name, location, blessing tags, map, visit info, and travel routes visible in a clear reading flow.
- Make route planning feel practical, not astrological or fortune-telling focused.
- Preserve every route detail in expanded export state for design review and Claude Design upload.

## Visual Direction

- Preserve the existing Mongkol Wela temple theme.
- The page uses a warm merit-making palette: cream paper background, lacquer red actions, gold highlights, jade confidence state, and dark brown ink.
- The mood should feel like a refined Thai temple guide: calm, devotional, useful, and credible.
- Visual hierarchy comes from large Thai headline weight, section spacing, compact factual cards, and the existing paper/border/shadow language.

## Layout

- Container width is `min(var(--container), calc(100% - 40px))` on desktop.
- Breadcrumb/back row sits above the hero and uses `.temple-detail__back`.
- Hero uses `.temple-detail-hero` as a two-column grid.
- Hero columns are `minmax(0, 1.12fr)` for image and `minmax(320px, 0.78fr)` for copy.
- Hero image minimum height is `440px` on desktop.
- Detail body uses `.temple-detail-layout` with main story plus right sidebar.
- Detail body columns are `minmax(0, 1fr)` and `minmax(280px, 360px)`.
- In the expanded export, all route groups and nested route details are open.

## Hero

- Use `TempleResponsiveImage` with eager loading and high fetch priority.
- Photo frame keeps `object-fit: cover`, rounded inner corners, and bottom gradient overlay.
- Hero copy includes collection/rank kicker, H1 temple name, short summary, tags, and actions.
- H1 uses `clamp(2.4rem, 5vw, 5rem)`, weight `900`, line-height `1.05`.
- Main hero actions are: `เปิดแผนที่`, `แชร์`, `คัดลอกลิงก์`.
- Primary action uses `.temple-detail-action--primary` with lacquer fill and cream text.

## Story Content

- Primary section title is `จุดเด่นของพิกัดนี้`.
- Blessing chips use `.temple-detail-chip-group`.
- `สิ่งที่นิยมสักการะ` uses `.temple-detail-notes`.
- Notes use a dashed top divider and gold dot bullets.
- Preserve the factual tone; do not turn these sections into marketing claims.

## Visit Info

- Visit info block uses `.temple-detail-visit`.
- Internal cards use `.temple-detail-visit-card`.
- Status classes are `is-verified`, `is-listed`, and `needs-check`.
- Source disclosure uses native `<details class="temple-detail-visit-sources">`.
- In the expanded export, source details are open.
- Preserve `โปรดตรวจสอบกับสถานที่โดยตรง` when data needs confirmation.

## Travel Routes

- Travel section uses `.temple-detail-transit`.
- Highlight cards use `.temple-detail-transit-highlights`.
- Route group accordions use native `<details>`.
- Route cards use `.temple-detail-route`.
- Route card summary uses a short mode label pill and stop name.
- Route timeline uses `.temple-detail-route-timeline`.
- Route line chips use `.temple-detail-route-lines span`.
- Nested `ดูสายทั้งหมด +N` details must remain available and keyboard-operable.
- In expanded export, every native details element is opened for complete review.

## Confidence

- Score row includes label, progress bar, and help button.
- Low uses brown, medium uses gold, high uses jade.
- Progress bar uses `role="progressbar"` with `aria-valuemin`, `aria-valuemax`, and `aria-valuenow`.
- Help button has `aria-expanded` and `aria-controls`.
- Tooltip panel must not be clipped by parent containers.
- Tooltip must be closed by default in the offline export unless explicitly reviewing the tooltip state.
- Desktop supports hover/focus reveal; mobile uses click-open behavior.

## Sidebar

- Mini map area uses `[data-temple-detail-map]` and is keyboard-focusable with `role="button"`.
- Metadata list uses `.temple-detail-meta`.
- Metadata rows use two columns: `112px` label and flexible value.
- Sidebar is factual and compact; do not add promotional modules here.

## Map Modal

- Leaflet loads on demand for the live page.
- `Escape` closes the modal.
- Focus returns to the map trigger after close.
- Offline export replaces live Leaflet with a lightweight mock dialog.
- Offline mock must be clearly limited to map preview behavior and preserve the Google Maps link.

## Related Temples

- Heading is `แนะนำในชุดเดียวกัน`.
- Cards are image-led links with rank badge, title, and location.
- Image aspect ratio is `16 / 10`.
- Mobile collapses related cards to one column.

## Tokens And Styles

- Preserve existing CSS variables from the site: `--container`, `--ink`, `--ink-soft`, `--lacquer`, `--jade`, `--line`, and `--radius`.
- Key colors: lacquer `#7b271f`, gold `#d6ad55`, jade `#2f5548`.
- Warm surfaces use `#fffdf6`, `#fffaf0`, and translucent cream fills.
- Border radius comes from `var(--radius)` and small reductions such as `calc(var(--radius) - 2px)`.
- Shadows are soft and warm; do not introduce strong black elevations.
- Body text and UI labels use the project Thai font stack from the main layout.

## Responsive Behavior

- At `max-width: 980px`, hero and detail layout collapse to one column.
- At `max-width: 980px`, `.temple-detail-side` is ordered before the main story and map card minimum height becomes `280px`.
- At `max-width: 760px`, `.temple-detail` width becomes `min(100% - 28px, var(--container))`.
- At `max-width: 760px`, hero padding becomes `16px` and image minimum height becomes `310px`.
- At `max-width: 760px`, visit cards and transit highlights become one column.
- At `max-width: 760px`, timeline columns become `64px 20px minmax(0, 1fr)`.
- No horizontal overflow is acceptable at 390px viewport.

## Accessibility

- Keep semantic landmarks and H1/H2/H3 ordering.
- Map trigger must support click, Enter, and Space.
- Dialog must expose `role="dialog"` and `aria-modal="true"`.
- Confidence help must keep `aria-expanded` and `aria-hidden` synchronized.
- Native details/summary controls must remain keyboard accessible.
- Links opening externally should keep `target="_blank"` and `rel="noopener"`.
- Do not rely on color alone for route mode or confidence; keep text labels.

## Export Notes

- Source scripts are removed in the standalone HTML.
- Lightweight local JavaScript preserves copy/share feedback, confidence toggle, native details behavior, and an offline map dialog.
- Production URL was not used as the direct export source because Vercel returned a challenge response during automated access.
- The source screenshot and export were verified from the local app route instead.

## Guardrails

- Do not remove the sidebar map, visit info, route timelines, confidence bar, or related temples.
- Do not flatten route accordions into plain paragraphs in production.
- Do not hide nested route line details on mobile.
- Do not replace Thai sacred-place tone with horoscope language.
- Keep map interactivity mocked only in offline export, not in production source.
- Preserve existing layout dimensions before making consistency changes.

## QA Checklist

- Open standalone export via `file://`.
- Confirm all native details are open in the export.
- Confirm confidence tooltip is closed by default.
- Click confidence help and confirm panel opens without clipping.
- Click copy/share and confirm local feedback appears.
- Click the map card and confirm offline dialog opens.
- Close dialog by close button and overlay.
- Check desktop at 1440px and mobile at 390px.
- Confirm `scrollWidth <= clientWidth` on mobile and desktop.
- Confirm no console or page errors in offline export.
- Confirm related cards remain visible after the long route sections.
- Confirm source links and Google Maps links remain clickable.
