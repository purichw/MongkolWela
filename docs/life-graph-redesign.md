# Life Graph Reference Adaptation

Date: 2026-09-23. Route: `/horoscope/life-graph/`. Local only; no CMS publication
or production deployment is part of this change.

## Visual Contract

- References: `ChatGPT Image Sep 23, 2026, 10_48_58 AM (1).png` and `(2).png`.
- Keep the existing shared header, footer, 1220px content frame and Thai font.
- Desktop: compact form rail, wide result, adjacent score table and line graph,
  twelve topic disclosures in six columns, then three learning items.
- Mobile: one form followed directly by its result, two six-topic score tables,
  one responsive graph with all twelve points, vertical topic disclosures,
  illustrated closing quote, edit action and learning items. Education does not
  interrupt the calculation-to-result path.
- Keep formula details accessible through a disclosure rather than deleting
  data to match the simplified illustration.
- The reference is direction, not data: scores, average, bands, periods and
  readings come from the unchanged engine. Existing three bands are retained;
  contradictory five-band labels in the mock are not adopted.
- Generated watercolor is decorative, not a claim about an actual temple.

## Preserved Behavior And Boundaries

- Initial calculation remains, clearly marked as an example from default input.
- Editing a form leaves the committed result visible with an update notice.
  Invalid input does not clear the previous result. Submit moves focus to the
  new result; graph points open and focus their matching reading.
- The table, chart, score and readings share one result. Resizing replaces only
  the chart presentation, not the form draft or calculation.
- Sharing requires an explicit preview/confirmation and excludes name, birth
  date and birth time. Native share has a clipboard/manual-copy fallback.
- Formula and thresholds have not changed. The calendar provider's default
  fetch now retains its browser receiver; previously it threw an illegal
  invocation error and silently used fallback data even with an endpoint set.
  Response mapping and fallback policy are unchanged. Birth time is
  currently display-only; transit date labels the reading months. Calendar
  fallback remains visibly approximate, never represented as verified data.
- The page does not add persisted reading history. The optional remote calendar
  provider can receive a date; copy does not promise all computation is offline.
- No global font/token/control changes, production writes or navigation changes.

## Acceptance And Focused QA

| Scenario | Expected | Evidence | Priority |
| --- | --- | --- | --- |
| Desktop/mobile result | Twelve scores, computed average, readable graph; no page overflow at 320/390/768/1024/1440 | Targeted Playwright and personally inspected captures | P0 |
| Calculation and escaping | Real engine values; typed markup remains text | Runtime and Playwright | P0 |
| Keyboard chart selection | Matching topic opens; focus reaches its summary | Playwright | P0 |
| Formula details | All five original numeric rows remain available | Runtime and Playwright | P1 |
| Invalid/draft form | Previous result remains until valid recalculation | Playwright | P0 |
| Draft edited during remote calculation | Response does not mark newer edits as committed or steal input focus | Playwright with delayed calendar fixture | P0 |
| Share preview | No name or birth data in copied result; Escape restores focus | Runtime and Playwright | P0 |
| Responsive resize | One graph, same committed values, no horizontal overflow | Playwright | P0 |
| Assets/accessibility | Watercolor decoded; no serious/critical Axe findings in main | Playwright | P1 |

Commands: `node --test tests/runtime/life-graph-view.test.mjs`,
`PLAYWRIGHT_BASE_URL=http://127.0.0.1:4363 PLAYWRIGHT_CHROMIUM_CHANNEL=chrome npx playwright test tests/e2e/life-graph-redesign.spec.ts --project=chromium-desktop`,
`npm run check`, `git diff --check`.

Screenshots and paired references are in `artifacts/life-graph-redesign/`.
The shared shell is intentionally retained, so total page height is not equal
to the mock. This is not a numerical fidelity score or user acceptance claim.
Full-site regression, Safari/Firefox, native OS share sheets and production
smoke are deferred; runtime privacy tests and mocked clipboard cover this scope.
Remote calendar integration uses a fixture; live provider availability is not
claimed by these checks.

## Artwork Provenance

Built-in image generation; output converted to WebP without compositional edits:
`public/assets/images/life-graph-watercolor.webp`.

Prompt: Create a polished decorative illustration for a Thai life-graph tool,
not a UI mockup. Wide 3:2 composition, delicate watercolor and pale gold linework
on warm white paper #fcf9f2. Muted sage foliage, white lotus with peach tips,
Thai temple spires and pale golden sun. Detailed bottom-right cluster fading
into clean upper-left paper; thin Thai cloud lines. Airy manuscript style,
not photographic or dark fantasy. No people, text, logos, UI or border.
