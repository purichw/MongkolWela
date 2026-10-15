# Shared Tarot Reference Adaptation

Content update (2026-10-15): the 78-card editorial bundle is now integrated
locally, including all six upright contexts and CMS fields. See
[Tarot editorial integration](tarot-editorial-integration.md) for current scope,
ownership and verification; earlier research plans below are historical.

Date: 2026-09-23. Local implementation; no CMS writes or deployment.

## Full-Deck Grid Update (2026-10-15)

The latest reference `codex-clipboard-81df084c-36f2-4fbf-bdd5-25e5fe6535fb.png`
supersedes the paged fan below for **all six draw pages**. The table now shows all
eligible cards as non-overlapping rows, using the existing jade/gold artwork,
hero, steps, guidance and site shell. The final row is centered. The real 78-card
deck requires four desktop rows rather than the illustrative reference's three;
no cards are omitted to reproduce the image height.

- Daily/monthly still use 78 cards; the four topic modes still use 22 Major
  Arcana. Selection requirements, shuffle/cut, result URLs, storage and editorial
  readings are unchanged.
- Mobile uses normal vertical page scrolling and at least 44px-wide card targets.
  The action toolbar stays below the site header while scrolling the deck.
- Chosen cards retain their original table slots; the ordered preview wraps,
  including all ten monthly picks. Single-card choices also have a larger preview.
- Resizing never changes deck order or selections. Keyboard picks continue to
  the next unselected card and scroll it into view; completing the required
  count focuses the visible read action. Shuffle/cut clear the selection.
- The shared owners are still `TarotDraw.astro`, `tarot-draw.js` and
  `tarot-experience.css`. Existing CMS field identifiers and page-owned bindings
  remain intact; no CMS documents are written.

Focused acceptance: all six modes at 1440/390, full 78/22 unique decks without
pagers/overlap, 320-1440 reflow, fixed table geometry after selection, ordered
monthly results, keyboard continuation, sticky actions, cut/shuffle reset,
storage-denied recovery and draw-region Axe. Screenshots live in
`artifacts/tarot-grid/`; local fixtures are not production data. Full-site E2E,
production, Safari/Firefox and the known unrelated artifact-copy type-check
errors are outside this visual change's checks. No push/deploy in this update.

Result: six focused browser scenarios passed across the targeted runs, including
the contrast repair and keyboard/cut check. Build, 86 browser-module binding
checks and `git diff --check` passed. Built-preview daily desktop/mobile renders
were inspected alongside the supplied reference; `artifacts/tarot-grid/proof.json`
records source hashes, viewports and full-deck geometry without API interception.

The sections below document the earlier adaptation; the paged fan behavior is
historical, not the current draw contract.

## Scope And Design Authority

The second supplied reference (`codex-clipboard-c9a2313e-e320-4e99-acf9-f29a8d2a1dfc.png`)
owns the composition: a compact hero, three steps, a jade card table, celestial
backs, restrained guidance, then a pictured result with grouped readings. The
first reference supports shuffle/cut/read controls and the full reading fields.
Both desktop and mobile are reviewed independently. Existing site shell, Thai
font, public content width and real card data remain authoritative.

The user's scope includes daily, monthly, luck, love, money, career, their result
pages, and the meanings library/detail family. The library remains browseable;
it is not made into a card-drawing interface.

## Shared Owners

- `components/tarot/TarotDraw.astro`: form, steps, controls, pagination, ordered
  selection tray and contextual guidance. Props are spread type, required count,
  deck count, storage key and page-owned intention/warning copy.
- `scripts/tarot-draw.js`: one controller owns deck order, selections, page and
  pending shuffle. Daily/monthly use 78 cards; other topics use 22 Major Arcana.
  Daily chooses one, monthly ten, all other topics one.
- `scripts/tarot-view.js`: front/back image, reading disclosures, single-card
  result, actions and empty state. Topic verdicts remain in `tarot-spread-result.js`;
  it preserves all original topic-specific labels, advice and caution data.
- `styles/tarot-experience.css`: tarot-only geometry/material layer, loaded after
  shared tools styles. `tarot.css` retains existing base/library styles. No global
  token or shared header/footer override.
- `ToolsHero.astro` reuses its existing optional ornament input. Other horoscope
  consumers do not receive tarot styles.
- Legacy `tarot-daily.js` and `tarot-spread.js` are thin entry-point aliases, not
  duplicate controllers. Current pages import through `TarotDraw.astro`.

## Preserved Contracts And Intentional Adaptations

- Explicit read confirmation stays available; choosing a card does not navigate
  automatically. Shuffle/cut reset selections just as before.
- Desktop displays 13 cards per page in a fan. Mobile displays nine in a 3x3
  grid. Every card remains reachable; page controls show real page counts.
- Monthly selections are unique and ordered; the tray retains choices across
  pages/resizes. Submit remains disabled until all ten are selected.
- Existing URL parameter names and storage keys remain supported. Storage
  failure no longer prevents reading through the URL. Invalid/duplicate/incomplete
  result requests show an actionable empty state instead of a misleading spread.
- Daily and topic results preserve theme, interpretation, advice, caution, color,
  time and mantra. The mantra appears once as a reflection quote. Monthly keeps
  its ten original position titles, focus text, themes and advice in order.
- Mobile reading sections use native disclosures; desktop starts expanded.
  A resize does not erase the user's disclosure choices.
- Existing Rider-Waite-Smith local images and credit manifest remain. Removed the
  obsolete daily copy claiming all face artwork was original to this project.
- Illustrative keywords, dates and predictions in the mock are not new data.
  The real data's theme appears as a badge; its wording is not invented to fill
  three mock badges. Color/time are labeled belief-based rather than guaranteed.

## Assets

Hero reuses `life-graph-watercolor.webp`, a project decorative asset. The original
Rider-Waite-Smith card face files are unchanged, with provenance in
`public/assets/images/tarot/README.md`.

`public/assets/images/tarot/celestial-card-back.webp` is generated decorative art,
converted to 360px WebP. Prompt: a flat portrait 2:3 original tarot card back,
deep green ink paper, antique-gold engraved radiant sun with a small face,
fine alternating rays, inset double border, corner flourishes, sparse stars and
crescents; balanced matte texture, no text, logo, perspective or glow.

## Focused QA

| Contract | Evidence | Priority |
| --- | --- | --- |
| Five single-card flows on desktop/mobile | Keyboard pick, shuffle/cut, confirm, correct URL/image, reload | P0 |
| Monthly ten-card sequence | Distinct picks across pages, resize retention, exact ordered result images | P0 |
| Full deck access | All 78 unique IDs reachable on mobile | P0 |
| Storage denied / invalid requests | URL still works; actionable empty state | P0 |
| Meanings | 78 links, detailed content, image and previous/next actions retained | P1 |
| Reference composition | Personally opened desktop/mobile draw/result images and representative monthly/library images | P1 |
| Readability and accessibility | Overflow checks, visible icons, decoded art, keyboard, main-region Axe | P1 |

Commands: `npm run check`, `node --test tests/runtime/tarot-view.test.mjs`,
targeted Playwright `tests/e2e/tarot-redesign.spec.ts`, `git diff --check`.
Screenshots/comparisons: `artifacts/tarot-redesign/`. Tests use local CMS fixtures;
production CMS, Safari/Firefox, every individual meaning article and unrelated
site routes are not covered by this scoped pass. No numeric fidelity score is
claimed. The retained shared shell and explicit controls change total heights.

## Meanings Library Follow-Up

The subsequent reference `codex-clipboard-1b1455f1-5b34-4e11-aba8-4cdb5705944e.png`
owns the meanings family, superseding the earlier generic reading frame here.
Draw/result consumers are unchanged. `tarot-library.css` is loaded only for
`/tarot/meanings/`; the public shell, page width and Thai font are retained.

- Library: 6-column desktop / 3-column mobile, sticky category rail on desktop,
  compact native category selector on mobile, English/Thai/keyword search,
  per-group disclosures and truthful live counts. Major starts expanded, the
  other four suits remain reachable through their headings or category control.
- `tarot-library.js` owns filtering, reset/empty state, expansion and URL context.
  `group` and `q` survive reload, detail navigation and return. Old group hash
  links still open the requested group. All 78 links and disclosures work without
  JavaScript; enhancement-only controls stay hidden in that case.
- Detail uses the actual card as its title surface, metadata rows, open general
  meaning/advice, topic disclosures and an additional-reading disclosure. All
  previous content remains accessible: overview, upright/reversed meanings,
  love/work/money/health, Western context, keywords, symbols, related cards,
  reflection questions and closing summary. Major career/finance use their
  existing separate fields; Minor keeps its combined text, without invented
  health/planet fields. Existing Minor suit definitions now also expose `element`.
- Advice reuses the existing card advice data when not present in the meanings
  record. Illustrative mock wording and literal Thai card names do not replace
  the product's existing text. The shared lotus ornament is reused, not a copy
  of the reference's floral painting. No new site-wide bottom navigation.

Acceptance/evidence: `tests/e2e/tarot-meanings.spec.ts` covers 1440/390 layouts,
6/3-column geometry, group + keyword filtering, no-results/reset, reload and
return context, keyboard disclosures, Major/Minor differences, previous/next
wraparound, 320/768/1024 overflow, Axe main-region checks, no-JS access and the
existing result-to-meaning link. `npm run check` and `git diff --check` accompany
the focused suite. Visual evidence: `artifacts/tarot-meanings/comparison.html`.
Desktop detail is an adaptation because the reference only shows mobile detail.
The mobile library reference stops mid-list; a matching top crop is paired with
it, while full-page captures document all categories and the existing footer.

## Content Research Handoff (2026-10-04)

The [78-card Deep Research prompt](research/tarot-78-deep-research-prompt.md) is
prepared; it is not completed research, a deployed content update or an importable
live CMS schema. Source ownership was reconfirmed in the 2026-10-11 docs pass.

- Existing Minor text still uses rank/suit templates. Monthly results repeat
  general advice by position; topic results also rely on shared grouped text.
- Requested research covers 78 cards x six contexts x two orientations (936
  blocks), plus 78 x ten monthly positions x two orientations (1,560 readings).
  Source-supported meanings and editorial applications must remain distinguishable.
- Preserve the exact 78 legacy IDs shared by `tarot.tarotCards` and
  `tarot.tarotMeaningCards`, even where display-name spelling differs from the ID.
- Researching all 78 cards does not change the existing topic draw restriction
  to Major Arcana or implement reversed drawing. Those are separate product tasks.
- Review sources, map supported fields and test both meanings/results before an
  authorized import. Follow [CMS import boundaries](../CMS.md#tarot-research-and-editorial-import)
  instead of seeding over live editorial overrides.
