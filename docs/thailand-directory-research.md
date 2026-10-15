# Nationwide Directory Research

Reviewed locally on 2026-10-15/16. This is not a production deployment report.

## Coverage

| Evidence | Coverage | Limit |
| --- | --- | --- |
| Geofabrik Thailand extract, 2026-10-14 | 7,721 accepted named OSM places, 77 provinces | Geometry is not a field-verified visitor entrance |
| Protected curated collections | 625 memberships, 378 unique planner IDs | All retained without editing the three source files |
| Merged navigable baseline | 7,918 places, 77 provinces | Before published CMS overrides/manual additions |
| Watportal public index | 41,106 distinct IDs, 2,741 pages, 77 provinces | Listing coverage, not complete detail/coordinate coverage |
| Fresh Watportal detail cache | 15 detail pages | Separate from the existing curated detail cache; not all 41,106 |
| Watportal category filters | 15 tourism and 21 meditation results | Royal filter returned 308 rows but only 291 unique IDs; do not claim completeness |
| Metadata enrichment | 4,437 mapped places | 1,239 ambiguous source joins remain for review; original OSM metadata also retained |
| Legacy registry metadata joins | 4,402 mapped places | Only unambiguous name/province or district matches applied |

Tourism research covers selected entries from Agoda, Traveloka, TrueID,
Chillpainai, Trip.com and Kapook, plus first-party temple/government pages.
It is not an exhaustive crawl of every travel site or every province's articles.
Exact URLs, factual assertions and dates live in
`src/data/directory-research-evidence.json`. No third-party article/photo library
is copied. For example, Wat Pah Nanachat's own site supports forest practice,
Ajahn Chah lineage, Theravada and English-language teaching.

## Approved Cleanup

The user approved removal on 2026-10-16 after reviewing the complete Watportal
index and the exact file/count proposal. The 3,389 proposed rows are now removed.

| File to change | Before | Candidate rows to remove | Rows to retain |
| --- | ---: | ---: | ---: |
| `public/assets/data/temples-thailand.json` | 44,705 | 3,389 | 41,316 |

The applied action removed exactly the IDs in
`artifacts/directory-places/deletion-proposal.json`, retaining all columns and
metadata of the remaining rows. Missing from the collected source index is not
proof that a temple does not exist. The receipt and hashes are in
`docs/thailand-registry-cleanup.json`.

Before pruning, the geographic lookup used by the shared CMS editor was extracted
to `src/data/thailand-admin-areas.json`; the generated legacy index/tests use it.
The Popular (243), Sacred (217) and Mu
(165) source files are protected, unchanged, and fingerprinted in the manifest.
This proposal covers the selected working tree and a future deployment only;
it does not purge Git history, existing deployments, backups or other checkouts.

## Reproduction

Use a project-local Python environment with
`scripts/import-directory-requirements.txt`. Keep the environment, original PBF,
HTTP caches and screenshots under ignored/local artifacts, not release source.

1. Obtain the dated Thailand PBF from Geofabrik and record its SHA-256.
2. Run `scripts/import-thailand-osm.py <pbf-path>` to extract facts and decisions.
3. Run `node scripts/build-thailand-directory.mjs` to build the mapped snapshot.
4. Run `scripts/import-watportal-directory.py` to resume the cached public index.
5. Optional `--details <observed-id> ...` and `--categories 1 3 4 5` collect labelled facts. Full detail collection is a separate, much longer run.
6. Run `node scripts/reconcile-thailand-directory.mjs` to join metadata and propose cleanup. This command never deletes registry rows.

The index crawler stops on HTTP failures, changing totals or repeated IDs; it
does not silently skip failed pages. Category-filter duplicates are retained as
an explicit coverage warning, not used as evidence of absence.

## Verification Scope

Targeted checks cover source metadata preservation, all-province coverage,
protected collection inclusion, server pagination, API payload sizes, CMS draft/
publish/reload, invalid locations, access/revision rejection and desktop/mobile
rendering. Registry cleanup also checks exact retained rows, protected hashes and
preserved CMS addresses. External map entrance accuracy and a full travel-site
crawl are not claimed by these checks.

An initial mobile outage check raced the SDK's existing 1/2/4-second retry
backoff. The diagnostic trace showed a 503 response after 7.59 seconds and the
UI error immediately afterward. The test now awaits that real response before
asserting recovery UI, with unchanged timeouts and unchanged production behavior.

## Release Verification, 2026-10-16

- Source includes current `origin/main` (`186b3e8`) without modifying its Tarot implementation.
- Astro check: 83 files, zero diagnostics. Browser bindings: 89 modules. Production build passes.
- Registry receipt, protected collection hashes and all 77 provinces pass. The generated CMS index preserves the original 925 district choices exactly.
- Data, visit-info, SEO, CMS, temple-CMS and Vercel configuration checks pass. Existing source-data completeness warnings remain; no unsupported facts were filled in.
- Full-site performance budget remains **failing**, not waived or relabelled as passing. The already-deployed Admin script is 497,009 bytes (above the existing 240 KB budget); this change is 511,698 bytes. The 494,053-byte Tarot editorial chunk is byte-size/hash-identical to production. Home, calendar and daily Tarot route CSS are unchanged at 88.7, 82.9 and 110.6 KB. Aggregate JavaScript/CSS remain above their pre-existing budgets. No limits were changed.
- The touched national route CSS is 149.7 KB, below its 230 KB limit; its new stylesheet is 4,769 bytes. Visitor requests remain paged at 24 records without downloading the registry or full metadata snapshot.
- Rich-editor fixtures retain their original three curated collections. The national catalog/paging is tested separately through the real handler. Mobile tests now open the actual navigation drawer before choosing a section; timeouts were not increased.
- Targeted E2E: all 18 desktop/mobile scenarios pass after the fixture/navigation repair (12 directory/home/readiness cases plus 6 shared-editor cases). Python import parser: 3 tests pass. Registry cleanup: 2 runtime checks pass. Full runtime suite before integration: 139 tests pass; the exact pushed revision is additionally gated by CI.
- Full cross-browser/whole-site E2E and live CMS mutation are intentionally excluded. Production smoke is read-only.
