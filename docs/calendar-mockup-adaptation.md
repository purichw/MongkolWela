# Calendar Mockup Adaptation

## Scope

2026-09-21: applied `mockup-to-product` and the Home lessons to `/calendar/`.
The supplied desktop and phone references define visual direction, not calendar
facts. This pass changes composition, responsive presentation, CMS media, and
shared footer reuse. It does not replace the lunar/date engine or publish content
to production.

## Lessons Applied

- Review the whole page before individual details: hero, overlapping toolbar,
  summary row, calendar/rail balance, yearly navigation, and footer.
- Carry over the visual vocabulary, including gold icon medallions, botanical
  edge ornaments, translucent paper surfaces, restrained badges, and arrow scale.
- Use a separate mobile composition: compact two-row toolbar, 2x2 summaries,
  three-week preview, stacked contextual sections, and four visible month tiles.
- Control actual typography inheritance. Broad `font: inherit` and line-height
  declarations were overriding smaller controls and adding invisible line-box
  height. Fix the responsible selectors rather than repeatedly reducing padding.
- Verify shared CSS actually loads. The new footer stylesheet is imported by its
  owning Astro component; Home and Calendar use the same implementation.
- Inspect assets inside the final crop at both viewport sizes. Keep the Buddha
  away from the title on mobile, retain a readable text scrim, and do not turn a
  photographic replacement into a fake copy of the illustrative reference.
- Preserve real functionality when simplifying: all dates, event types, views,
  year boundaries, historical links, source notes, and error recovery remain.

## Ownership

| Surface | Owner |
| --- | --- |
| Calendar page structure and CMS image slots | `src/pages/calendar/index.astro` |
| View rendering, preview expansion, navigation | `src/scripts/calendar-overview.js` |
| Existing date normalization/state | `src/scripts/calendar-view-model.js` |
| Calendar-only geometry and responsive styling | `src/styles/calendar-overview.css` |
| Shared header | `src/components/Header.astro`, existing header styles |
| Shared editorial footer | `src/components/Footer.astro`, `src/styles/public-footer.css` |
| Shared icons and ornament | `SiteIcon.astro`, `BrandOrnament.astro` |
| Calendar image sources/focal points/credits | Calendar page patches in `public/admin/content/{live,default}.json` |

The footer rules were extracted from `home.css`, not copied into a second page
implementation. The editorial footer remains opted into by Home and Calendar;
other footer variants are unchanged.

## Intentional Adaptations

1. Hero uses the existing licensed photograph of the gold Buddha in Songkhla;
   the reading thumbnail uses the existing Wat Arun sunset photograph. Both are
   CMS-owned image slots with source/license metadata and error fallbacks.
2. The reference's dates, holidays, auspicious labels, and month totals are
   illustrative. Display the existing engine's output, not manually copied dates.
3. Calendar cells use Arabic numerals for compact lunar day labels; full Thai
   labels remain in accessible names and day-detail content. Data is unchanged.
4. Mobile overview displays three weeks around the current or last-opened date,
   or the first three weeks for other months. The expand control reveals every
   date without changing route or removing the day links. Monthly view always
   shows the complete month.
5. All twelve month tiles remain horizontally reachable on mobile. The year
   expansion control shows the full grid and additional year-system information.
6. No article collection or social destinations are invented. The knowledge
   block links to the existing day-detail experience. Footer links remain real
   product links, with the shared mobile disclosure.
7. Mobile is intentionally not a pixel-for-pixel scale-down of the phone mock:
   controls, source disclosures, concurrent-event counts, and real navigation
   remain usable. Do not hide these merely to match the reference's page height.

## Preserved Contracts

- BE 2300-2700; month/year boundary behavior, leap dates, URL state, reload,
  browser Back/Forward, legacy month hashes, and selected-date restoration.
- Native day links and Today link to actual `/calendar/day/?date=...` routes.
- Overview, monthly, and yearly-event views on desktop and mobile.
- All concurrent events in accessible date labels, event list, and day detail;
  compact badges include a remainder count.
- Loading/error/retry states and keyboard focus after recovery/navigation.
- CMS guide media stay in the DOM while hidden in event view, so refreshes can
  still patch the same node. View changes do not recreate an unpatched image.

The underlying calendar is a preliminary calculated dataset, not an official
holiday feed or authoritative ephemeris. Its existing limitations remain visible
in the source disclosure; this visual pass does not certify date accuracy.

## Verification And Evidence

Final result: 8/8 browser tests and 6/6 view-model tests passed. Astro check,
script bindings, CMS validation, and `git diff --check` passed. The corrected
mobile calendar surface has no automated color-contrast violations. All four
captured widths (1440, 768, 390, 320px) have no horizontal page overflow or
uncaught browser errors, and all inspected calendar/footer images loaded.

- `npm run check`: Astro types plus browser script bindings.
- `npm run nfr:cms`: both local seed documents and image patches.
- `node --test tests/runtime/calendar-view-model.test.mjs`: 6 data/state tests.
- `npx playwright test --config artifacts/calendar-reconstruction/playwright.config.ts`:
  8 route/UI tests, including 1440/768/430/390/360/320px, three views, native
  links, retry/focus, preview expansion, late-date restoration, CMS replacement,
  broken-image fallback, and shared Home/Calendar footer behavior.
- Automated accessibility scan of the calendar surface identified insufficient
  contrast in neighboring-month numerals. Their foreground was darkened; retain
  distinct inactive treatment without relying on low opacity. The targeted
  post-fix color-contrast scan returned zero violations.
- Full-page screenshots and geometry/image-load evidence:
  `artifacts/calendar-adaptation/`; run `capture.mjs`, then `compare.mjs`.
  Desktop reference is uniformly resized; mobile reference is cropped to the
  phone content area (185,77,570,1568), then uniformly resized to 390px.
  Reference dates intentionally differ from the implementation's engine output.

Not run: full-site regression, production smoke, deploy, real iOS Safari, and
official-calendar accuracy audit. No production CMS writes, push, or deploy.
