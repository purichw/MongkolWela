# Non-Functional Maintenance

## Contracts

- Fresh content: one configured publish/read source, no cross-source failover.
- Latest means the source read for the current page/data/plan request. There is
  no continuous polling. A changed planner catalog is explicit (409).
- Bundled data is a build/development seed. A normal deployment must not seed
  over production content.
- Static CSS/JS use hashed URLs and immutable caching. Live API responses use
  no-store. Client state contains draft criteria and IDs only.
- Preserve existing design and controls; release removes the artificial
  first-visit delay and adds recoverable live-data errors.

## Ownership

- `api/admin/_shared.js`: configured published-source selection and auth.
- `src/lib/live-content.js`: live-read failure contract.
- `src/lib/public-content.js`: route-specific browser projection.
- `api/temple-planner/_catalog.js`: current catalog and revision.
- `src/data/temple-cms.js`: explicit CMS edits, deletion, stable identity.
- `src/scripts/request.js`: bounded requests and latest-response ownership.
- `src/scripts/planner/`: API, storage, map, picker, format, result modules.
- `src/scripts/admin/`: temple editor, media, publishing modules.
- `src/config/styles.js`: ordered route stylesheet manifest.
- `src/styles/`: source CSS; Vite emits content-hashed files.

## Verification

`npm run check` checks Astro and unresolved browser-script bindings. This is
not complete JavaScript type safety.

`npm run test:runtime` exercises actual HTTP handlers and authentication against
an isolated in-memory upstream database server. It verifies publish/read/plan,
revision conflicts, outages, recovery, minimal payload, and request cancellation.
It never writes production data and does not prove production database policies.

Focused Playwright suites cover planner recovery/restoration, CMS error/retry,
Admin editing/crop flows, and shared loading behavior. Preview production APIs
receive read-only smoke checks before production release.

`npm run nfr:performance` measures static artifact size only. `web-vitals`
collects standard LCP/CLS/INP metrics in the browser. Field p75 requires enough
real sessions and is not inferred from a local test.

`node scripts/measure-browser.mjs --label=current --fixtures` records matched
desktop/tablet/mobile screenshots, stylesheet bytes, initial-load lab samples,
overflow and errors in `test-results/nfr-current/`. Fixtures isolate UI behavior;
omit `--fixtures` and pass `--base-url=...` for deployed-source verification.

Full NFR builds before reading dist. Run broad checks at release boundaries;
small CSS/content changes continue to use targeted checks.
Set `PLAYWRIGHT_BASE_URL` to an already running build preview to test the emitted
assets without Vite's development dependency optimization changing during a run.

## Recovery

Changes require no database migration or reseed. Keep the previous Vercel
deployment available. A code rollback does not require restoring CMS content.
Preserve visitor criteria during errors; use retry after the source recovers.

## Deferred Work

- Database-level field projection: CMS content is currently a single JSON document.
- Full JavaScript typing and further coordinator decomposition are incremental work.
- Remaining npm audit findings require an Astro major upgrade (Astro/esbuild/sharp);
  compatible dependency fixes were applied. Schedule that migration separately.

## Release Evidence (2026-09-05)

- Astro check: 46 files, no errors/warnings; browser binding check: 43 modules.
- Six runtime tests pass, including actual HTTP publish/read/plan and outages.
- Chromium and mobile WebKit cover Admin editing/publishing, CMS retry/clears,
  and Planner restore/conflict/failure behavior. First-load timing is checked once.
- Nine routes at desktop/tablet/mobile sizes: no horizontal overflow or page errors.
- Built local CSS per page: home 49,434 bytes; Planner 166,014; calendar 37,177;
  tarot daily 48,682. These are decoded stylesheet bytes, not transfer-time claims.
- Full NFR passes; pre-existing dataset warnings remain (670 runtime, 2 visit info).
- `npm audit --omit=dev`: zero reported vulnerabilities. Full audit retains three
  build-tool findings (one low, two high); no forced major migration in this release.

## Production Release Hold

Code is committed locally; do not push main or promote until the configured
live source passes the read/plan smoke. The primary domain remains on deployment
`dpl_7on2iaBTkewzf9JApPk4V48UsKcT` (verified 2026-09-05).

The protected candidate `dpl_6vFVQEnq6PK9uZumpVsXLLjvazTt` builds successfully,
but its CMS endpoint returns 503. Server logs identify source `database`, upstream
status `0`, no database error code: a connection failure, not proof of a missing
document or invalid credentials. Check Supabase project availability and the
configured endpoint before release. No database migration, seed or write was run.

Production variables are marked sensitive in Vercel. Empty values returned by
CLI export are not evidence that the deployed secrets are empty. Do not replace
them based on that export, or restore cross-source fallback to hide the failure.

Protected candidates require authenticated `vercel curl`; ordinary smoke requests
hit Vercel Authentication. Use the existing smoke harness user agent for the
site's firewall. Full public-domain smoke and live-browser verification are pending.

One Chromium multi-flow test timed out while browsers ran concurrently; the same
test passed unchanged when run alone. Mobile WebKit build tests passed (six tests,
three desktop-only cases skipped). Keep long journeys isolated on busy machines.
