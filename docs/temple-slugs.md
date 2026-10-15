# Temple URL Slugs

Implementation date: 2026-09-30. No production CMS write is required by this
release. Slug normalization takes effect when reading the existing live document.

## Contract

- The 625 curated records are popular (243), mu (165) and sacred (217), covering
  378 distinct source names. `src/data/temple-english-names.js` maps every name.
  Common English spellings are used where available; the remainder are manually
  romanized, not claimed to be official translations. Province-specific mappings
  distinguish identically named places. Existing custom ASCII slugs take priority.
- Example: the old ranked Thai URL for Wat Rakhang Khositaram becomes
  `/temples/popular/wat-rakhang-khositaram/`. The old URL redirects with 308 and
  preserves its query string.
- Legacy CMS keys, planner IDs, source names, visit information, images, ordering,
  activities and unrelated page data are not renamed or discarded.
- Automatic mode uses the reviewed mapping, then the offline
  `@pcampus/thai-romanization` library. Its browser module loads only when automatic
  generation is needed. Repeated names receive deterministic numeric suffixes.
- Custom mode accepts 1-100 lowercase ASCII letters/digits separated by single
  hyphens. Spaces, Thai characters, reserved names and duplicate or historically
  claimed URLs in the same collection are rejected in both editor and API.
- Custom values survive name edits, draft saves and reloads. Cancel restores the
  editor snapshot. The publication handler retains historical aliases even when
  a client omits them, and ignores forged alias additions.
- Hidden/deleted records return 404 and reserve their URLs. An unavailable CMS
  returns 503, not a bundled stale page. Historical URLs redirect directly to the
  latest URL without chains.

## Implementation

`temple-slugs.js` handles naming, `temple-cms.js` merges live records without
changing identity, and `temple-routing.js` resolves aliases and validates the
revision-checked publication. The three detail routes and sitemap use Vercel SSR
and the existing `readLiveContent` authority. Public projections supply a stable
key-to-URL map for static card/map/related-link refreshes; search and planner
catalogs use the same merge. Old page-level CMS patch registrations follow the
resolved place without rewriting their stored page IDs.

The Vercel adapter is paired with Astro 7.3.5. Astro was upgraded because the
earlier version was affected by the [AVIF security advisory](https://github.com/withastro/astro/security/advisories/GHSA-26w7-cxv4-gfx2).
`compressHTML: true` preserves previous output behavior. Four Astro prop casts
are type-only compatibility fixes. At release verification on 2026-09-30,
`npm audit --omit=dev` reported no production dependency vulnerabilities; this
is not a current security audit or a claim that the whole app was audited.
The full development audit then reported one moderate `fast-uri` advisory;
no broad dependency cleanup was included in this task.

Reference spelling for the example: the Tourism Authority of Thailand's
[Khlong tours brochure](https://www.thailandtourismus.de/fileadmin/user_upload/E_Broschueren/Spezialthemen/Khlong_tours.pdf).
Automatic transliteration uses the existing MIT-licensed
[Pcampus library](https://github.com/Pcampus-Studio/Pcampus-thai-romanization), not
a hand-written phonetic engine.

## Verification

Release verification (2026-09-30), not rerun for the 2026-10-11 documentation update:
`npm run check`, `npm run build`, 129 runtime tests, two new
slug browser journeys plus four existing place/CMS/map/filter regression tests,
SEO, temple-CMS, Vercel configuration and runtime-data validation. Runtime-data
validation retains warnings about incomplete existing travel/visit source data.

- Runtime: complete mapping coverage, unique canonical routes, all legacy route
  resolution, unchanged identities, idempotent migration, repeated renames,
  collision rejection, tombstones, CMS patch retention and API projections.
- Browser: actual Admin editing, validation, cancel/reopen, publication through
  the real handler, canonical SSR and sitemap, collection links, reload, new
  automatic slugs, 404 and source-outage 503. Desktop and narrow mobile views
  are captured in `artifacts/temple-slugs/`.
- `tests/helpers/temple-routing-server.mjs` is a loopback-only, in-memory CMS/auth
  fixture. It runs the built Vercel renderer and actual CMS publication handler;
  it never writes a project CMS file or production document.
- The SEO/performance scripts read `dist/client` and render dynamic pages against
  that fixture instead of requiring stale static copies of detail pages.
- Full-site performance budgets still report oversized aggregate JavaScript/CSS
  and several route stylesheets. A fresh build of the pre-change `c27c0ab` commit
  fails the same six limits: JavaScript 1129.0 KB, largest Admin chunk 478.8 KB,
  CSS 813.3 KB, home CSS 89.1 KB, calendar CSS 84.0 KB, tarot daily CSS 111.8 KB.
  This release measures 1191.7 / 484.6 / 825.0 / 88.7 / 82.9 / 110.3 KB
  respectively. Most added JavaScript is the optional Admin romanization chunk.
  Limits were not relaxed; performance cleanup remains outstanding.
- The release recheck scopes Astro diagnostics to `src` (83 files, zero errors)
  because the local baseline comparison under ignored deploy artifacts contains
  another complete copy of the old source. Browser binding checks pass for all
  86 modules. Baseline artifacts are excluded by `.vercelignore` and are not
  committed. Clean GitHub CI passed the normal full `npm run check`; the scoped
  local check is not a new default or permission to hide diagnostics. Future
  baseline copies should live outside automatic source discovery. Full
  browser-matrix testing was not repeated for this release.

## Release Evidence (2026-09-30)

- Intended and verified production revision:
  `303d84cea0b1dff6d0f4151dd58f2a1a10035087`, branch `main`.
- [GitHub CI](https://github.com/purichw/Mongkol-Wela/actions/runs/36701944270)
  succeeded for that revision. The legacy `purichw/hora-astro` remote redirected
  to `purichw/Mongkol-Wela`.
- The CLI candidate was
  [mongkolwela-8gz84tw64](https://mongkolwela-8gz84tw64-purich-w.vercel.app),
  `dpl_6x2MbWAc3AvqYeaY84s5VWo48Edu`. After its promotion, the Git integration
  completed a deployment of the same SHA:
  [mongkolwela-mvaf7ji5j](https://mongkolwela-mvaf7ji5j-purich-w.vercel.app),
  `dpl_29rHfKk5zmzuZmuz1pbuaBmYYvJn`. The final production alias and Vercel
  metadata were verified against this READY Git deployment, not just the candidate.
- Production smoke passed 16 routes. Read-only checks covered 625 canonical
  sitemap entries and representative current 200 / legacy 308 URLs in popular,
  mu and sacred, including query preservation. The candidate also returned 404
  for a missing place.
- The inspected live CMS revision was `0151b1b080d0d11612a3efe6`, with two stored
  place overrides over the 625 curated records. An in-memory publication
  normalization dry run passed; no production CMS write was performed.
- Both `/api/commerce` and `/api/commerce/index` returned the expected disabled
  service response: 503 `COMMERCE_DISABLED`, not an accidental missing handler.
- Candidate check results are in `artifacts/slug-release/candidate-report.json`;
  that report identifies the candidate, not the later production deployment.
  Admin create/rename/publication tests used the loopback fixture described
  above, not live production edits. Do not commit raw CMS snapshots as evidence.

These are historical checks. Reconfirm the current revision and run the relevant
gates for a future release. The six performance budget failures above remain
recorded debt; this evidence does not claim full NFR passed.

## Rollout And Recovery

1. Review the current live document and save a secured, access-controlled backup
   using the existing CMS operational workflow. Never publish the local seed over
   it. An initial plain request received a firewall 429; the authorized harness
   later completed the read-only inventory recorded above. Use the existing smoke
   harness/protected-deployment access flow, not disabled firewall rules.
2. Deploy only the reviewed changes with the existing CMS server credentials. Do
   not run `db:seed:cms`. English mappings and redirects become effective on read;
   a normal Admin publication subsequently persists the normalized metadata.
3. Read-only smoke old Thai and current ASCII URLs in all three collections,
   canonical/OG tags, sitemap, search, planner and map links. Test custom rename
   and newly added places in the fixture or explicitly authorized UAT. Verify
   the Vercel function count and fresh CMS reads in the deployed environment.
4. Recover names by a normal revision-checked publication while retaining
   `slugAliases`. Do not revert to the pre-SSR build alone after distributing new
   URLs: that build cannot serve their redirects or newly created routes.
