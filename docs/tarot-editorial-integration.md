# Tarot Editorial Integration

## Scope And Provenance

The user authorized local integration of `mongkol-tarot-editorial-v1` on
2026-10-15 after reviewing the delivered bundle. This is not a production
publication or a change to draw eligibility. The accepted, reduced research
scope is **78 cards, 468 upright contexts, and 78 general reversed meanings**.
The earlier 936-context/1,560-position brief is historical, not an acceptance
requirement for this version.

The unchanged bundle is in `research/tarot-editorial-v1/`, including checksums,
field evidence, sources, monthly examples and the original quality report.
It retains its original `editorial_review` labels; importing it does not rewrite
the research history or imply independent human approval.

Run `node scripts/import-tarot-editorial.mjs` to reproduce the runtime projection
from the archived evidence. An explicit source directory can be supplied for
the initial import. The importer verifies the delivered hashes, all 78 legacy
IDs/order, and six populated upright contexts before writing. It never writes
CMS data, calls production, renames cards or changes source files in Downloads.
The generated `src/data/tarot-editorial-content.json` contains only display
content; the source registry and evidence are not shipped to browser bundles.

## Content Ownership

| Content | Owner / CMS path | Consumer |
|---|---|---|
| Daily reading, advice, caution | `tarot.tarotCards` / `interpretation`, `advice`, `caution` | Daily result and daily disclosure in meanings |
| Monthly, love, money, career, luck | `tarot.tarotCards` / `contexts/<mode>/{reading,advice,caution}` | Context-specific results; monthly/luck also appear in meanings |
| General summary, upright/reversed, topic meanings | `tarot.tarotMeaningCards` / existing fields | Library and detail |
| Keywords, symbolism, card distinctions | `tarot.tarotMeaningCards` / existing arrays | Library/detail |
| Ten monthly position titles, focus, reflection prompts | `tarot.monthlyPositions` | Monthly result |

Library topic summaries and result readings remain separate editorial records,
as they were before this import. Editing `tarot.tarotMeaningCards/love` changes
the encyclopedia summary; editing `tarot.tarotCards/contexts/love/reading`
changes the love result. This distinction is intentional, not an automatic
cross-write. Daily retains its original paths instead of introducing a second
daily override that could hide existing edits.

`withReadingEditorial` and `withMeaningEditorial` update the source seeds before
`managedContent` registration. Published overrides still win, including empty
strings. No live/default CMS JSON is reseeded. All old editable paths remain
valid: indexed keyword/symbolism tails and related-card identities are preserved.
Additional research distinctions are appended if not already represented.
Names, slugs, artwork, numerical metadata, health/astrology supplements, reversed
topic supplements, colors, time and mantras are retained from the existing
product and must not be described as validated by this research bundle.

The four topic results no longer substitute broad positive/neutral/caution
groups for per-card text. All six contexts have distinct imported content, but
draw behavior stays unchanged: daily/monthly use 78 cards, four topic draws use
22 Major Arcana, and monthly requires ten unique ordered cards. URL/storage
contracts are preserved. Reversed meanings do not enable reversed draws.

## Monthly Boundary

Each monthly position shows the selected card's monthly reading, advice and
caution, plus a separately editable position-specific reflection prompt.
This is **not** a newly implemented contextual synthesis engine or a matrix of
780 bespoke card/position readings. The two supplied ten-card examples remain
research references, never user results. No fictional example, deterministic
prediction or concatenated text is presented as an individualized synthesis.

## Image Follow-Up

On 2026-10-15 the integration review visually inspected the existing local RWS
assets for the seven gaps declared in the delivered research: Five, Seven and
Ten of Wands; Four, Seven, Eight and Ten of Swords. Their observations match
the images at `public/assets/images/tarot/rws-jpg/<legacy_id>.jpg`. This closes
the local observation check, not an external URL/reproduction-rights audit.
Original research statuses and hashes remain unchanged for traceability.

## QA Matrix

| Scenario | Expected / Source Of Truth | Automation | Priority |
|---|---|---|---|
| All cards and contexts | 78 IDs and 468 complete context blocks match archived NDJSON | `tarot-editorial.test.mjs` | P0 |
| Existing CMS edits | Original paths accepted; overrides and explicit empty values win | Runtime tests and pre-import catalog comparison | P0 |
| Authoring lifecycle | Save, reopen draft, handle 409, publish and render exact context | `tarot-editorial.spec.ts`, local API fixture only | P0 |
| Result routing | Correct context for each mode; reject invalid/ineligible cards | Targeted browser tests | P0 |
| Monthly | Ten ordered unique cards; monthly text and position guidance | Runtime/browser tests | P1 |
| Meaning detail | Major/Minor upright, reversed, symbols, distinctions and context bindings | Runtime/browser tests | P1 |
| Mobile/desktop | Text fits, disclosures work, images load, no page errors | 1440/390 Chromium screenshots | P1 |

Production publication, real Supabase/GitHub persistence, full-site NFR and
cross-browser release coverage are outside this local integration pass.

### Local Verification (2026-10-15)

- Runtime: 11 tests passed across `tarot-editorial`, `tarot-view`, and
  `managed-content` suites. All archived checksums match. The pre-import Tarot
  catalog comparison found no removed editable paths; old full-record overrides
  still pass validation.
- Browser: 7 tests passed across `tarot-editorial.spec.ts` and
  `tarot-meanings.spec.ts`, using installed Chrome at widths 1440 and 390 on
  `http://127.0.0.1:4387`. Fixtures exercise draft restore, rejected stale publish,
  successful publish, explicit clearing, result rendering, library navigation,
  and no-JavaScript detail output. No real CMS writes were performed.
- `npm run build` and the 86-module browser script/binding check passed.
  `git diff --check` passed. Vercel's adapter noted local Node 26 versus its
  selected Node 24 runtime; a production Node 24 release check remains separate.
- The normal `npm run check` remains blocked by 8 errors, all under the existing
  `artifacts/slug-release/baseline/node_modules/astro/components/` copy. There are
  no diagnostics in the changed application files. The old artifact was not
  deleted/moved and the project check configuration was not weakened.
- Screenshots in `artifacts/tarot-editorial/` were visually inspected for the
  desktop/mobile reading, monthly result, Minor meaning and CMS context editor.
  They show the local working tree based on `303d84c`, not production. Snapshot
  content is fixture-backed; it does not establish production publication.
- A second built-preview smoke used `createTempleRoutingServer` with the real
  public content handler and an isolated in-memory database, without browser
  API interception. The love result matched the imported content at 1440/390
  with no page errors. `built-preview-*.png` and `preview-url.json` identify
  that local preview; the port is ephemeral and no live CMS is connected.
