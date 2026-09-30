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
are type-only compatibility fixes. Production dependencies pass `npm audit
--omit=dev`; this is not a claim that the entire app has been security-audited.
The full development dependency audit still reports one moderate `fast-uri`
advisory; no broad dependency cleanup was included in this task.

Reference spelling for the example: the Tourism Authority of Thailand's
[Khlong tours brochure](https://www.thailandtourismus.de/fileadmin/user_upload/E_Broschueren/Spezialthemen/Khlong_tours.pdf).
Automatic transliteration uses the existing MIT-licensed
[Pcampus library](https://github.com/Pcampus-Studio/Pcampus-thai-romanization), not
a hand-written phonetic engine.

## Verification

Completed locally: `npm run check`, `npm run build`, 129 runtime tests, two new
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
  committed. Full browser-matrix testing was not repeated for this release.

## Rollout And Recovery

1. Review the current live document and save a secured, access-controlled backup
   using the existing CMS operational workflow. Never publish the local seed over
   it. A read-only production request in this pass returned HTTP 429, so additional
   live-only records have not been inventoried.
2. Deploy only the reviewed changes with the existing CMS server credentials. Do
   not run `db:seed:cms`. English mappings and redirects become effective on read;
   a normal Admin publication subsequently persists the normalized metadata.
3. Smoke old Thai and current ASCII URLs in all three collections, custom rename,
   newly added place, canonical/OG tags, sitemap, search, planner and map links.
   Verify the Vercel function count and fresh CMS reads in the deployed environment.
4. Recover names by a normal revision-checked publication while retaining
   `slugAliases`. Do not revert to the pre-SSR build alone after distributing new
   URLs: that build cannot serve their redirects or newly created routes.
