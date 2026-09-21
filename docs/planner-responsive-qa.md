# Planner Responsive QA

2026-09-21. Local Chrome; no production writes/deploy. PASS applies only to the
listed evidence. NOT RUN also covers cases with partial evidence but an untested
condition; it is not a claim that the feature is absent or broken.

## Results

- `npm run check`: 59 Astro files, zero errors/warnings/hints; 55 browser modules pass.
- `npm run build`: 735 pages; succeeds with pre-existing JSON import-attribute warnings.
- Runtime: 11 tests pass (workspace, catalog data, request lifecycle).
- Browser: 13 tests pass (11 workspace journeys and 2 existing runtime journeys).
- Targeted follow-up verifies final loading/field-validation changes and mobile widths.
- Six A/B/C screenshots at 1440x900 and 390x844, initial and three-stop supplemental
  screenshots, plus dirty/count-dialog/replacement/error evidence.
- Automated A/B/C overflow check at 320/360/390/430/768/1024/1180/1440; no overflow.
- Home, Calendar and Place Detail smoke at 390/1440: visible shared shell, working
  menu close, no Planner CSS leak, no page-level overflow or runtime exception.
- Package verifier: 11 file hashes/sizes and historical snapshot arithmetic pass.
- `git diff --check`: pass. No commit/push/deploy.

The API snapshot shipped by the designer remains historical evidence. Browser
tests use intercepted catalog/CMS responses plus the existing calculation engine.
Live Supabase/Vercel APIs and production media replacements are NOT tested here.

## Evidence Keys

- **V**: `artifacts/planner-responsive/visual-report.json` and `plan-*`, `picker-*`,
  `both-*`, `both-three-stops-*`, `initial-*` screenshots. Actual CSS viewports are
  embedded in the report; phone-chrome mockups are not treated as viewport measurements.
- **W**: `tests/e2e/planner-workspace.spec.ts`; machine-readable final run in
  `artifacts/planner-responsive/playwright-results.json`.
- **R**: `tests/e2e/planner-runtime.spec.ts`.
- **U**: `tests/runtime/planner-workspace.test.mjs`, `planner-data.test.mjs`,
  `request.test.mjs`.
- **S**: six shared-route smoke entries in V. Smoke is not a full regression suite.
- **C**: source review plus rendered visual review of the touched route.
- **P**: supplied handoff verifier; package/fixture only.

## Acceptance Mapping

| Case | Status | Evidence / Boundary |
| --- | --- | --- |
| PLN-001 A-D | PASS | V, nine-stop desktop plan with picker hidden and map right |
| PLN-002 A-M | NOT RUN | Nine-stop mobile V exists; complete nine-stop touch/map/footer sequence not exercised on device |
| PLN-003 B-D | PASS | W view projection, V full-width picker and retained plan |
| PLN-004 B-M | NOT RUN | W/V prove mobile partial selection and compact rows; exact three-of-nine scenario tested only on desktop |
| PLN-005 C-D | PASS | V, W snapshot IDs/counts |
| PLN-006 C-M | NOT RUN | W proves both panes/query preserved; exact jump/scroll-restoration sequence not fully asserted |
| PLN-007 C-empty | NOT RUN | Implemented empty state, no full two-place empty-C test |
| PLN-008 widths | PASS | W all specified widths and all three views; no horizontal overflow |
| PLN-009 resize | NOT RUN | Selection/query tested across resize; dirty state and loaded-count combination not fully asserted |
| PLN-010 text-zoom | NOT RUN | 320px and long-name reflow tested; true 200% browser/text zoom not tested |
| PLN-011 view-projection | PASS | W asserts no additional plan request and unchanged committed IDs |
| PLN-012 draft-dirty | PASS | W adds fourth draft stop, keeps three committed stops, blocks export; state-dirty screenshot |
| PLN-013 criteria-dirty | PASS | W changes start time during request; U immutable criteria/timings |
| PLN-014 query-local | PASS | W query does not change draft version or call compute |
| PLN-015 show-all | PASS | W selects outside filter and retains it; manual omission guard tested |
| PLN-016 revert | PASS | W confirmation restores IDs/synced state; U revision freshness guard |
| PLN-017 close-picker | NOT RUN | View preservation tested, but dirty-close-reopen sequence not independently asserted |
| PLN-018 manual-partial | PASS | W target9 with three selected returns exactly three; U exact ID checks |
| PLN-019 manual-zero | PASS | W disabled manual build; separate auto action |
| PLN-020 auto-confirm | PASS | W cancel confirmation leaves IDs/request count unchanged |
| PLN-021 count-options | PASS | C 3/5/9; W exercises 3/9 without inventing 8 |
| PLN-022 count-limit | PASS | W keyboard activation at cap produces feedback and retains IDs |
| PLN-023 count-reduce | PASS | W chooses specific retained IDs, plus cancel restores prior ceiling; dialog screenshot |
| PLN-024 count-increase | PASS | W raises ceiling then explicitly adds records; existing IDs retained |
| PLN-025 selected-hidden | PASS | W outside-filter tray label and retained ID |
| PLN-026 purpose-or | PASS | W career+love returns union, with distinct purpose fixtures |
| PLN-027 clear-selection | PASS | W confirms draft clearing while old committed plan stays |
| PLN-028 clear-plan | PASS | R confirms plan clearing with reusable form values |
| PLN-029 reorder | PASS | W explicit update sends manual order; no API call on move alone |
| PLN-030 reorder-keyboard | NOT RUN | Desktop Enter activation tested; mobile complete first/last-bound keyboard path not covered |
| PLN-031 replace-cancel | NOT RUN | Lossless cancel tested on desktop; mobile return-focus sequence not fully covered |
| PLN-032 replace-confirm | PASS | W/U retains slot, no duplicate, dirty until successful compute |
| PLN-033 replace-revision | PASS | U rejects stale revision/draft-version replacement |
| PLN-034 origin-empty | PASS | C explanation, engine/UI starts at first stop and omits return leg |
| PLN-035 origin-match | PASS | W matched origin is first of three, not an extra stop |
| PLN-036 origin-unknown | PASS | W unmatched text blocks API and focuses input |
| PLN-037 origin-ambiguous | NOT RUN | Suggestion selection tested; identical names across provinces not separately exercised |
| PLN-038 budget-date | PASS | W advanced date/budget, visible summary, advisory over-budget warning |
| PLN-039 pending | PASS | W pending/cancel preserves old plan and responsive controls |
| PLN-040 latest-token | PASS | U request invalidation; W cancel/retry and stale-result guard |
| PLN-041 draft-version | PASS | W draft edit during response rejects obsolete result |
| PLN-042 revision-409 | PASS | W/R retain IDs and old names/timings until explicit update |
| PLN-043 timeout | PASS | W server failure and retry; U timeout/malformed response handling |
| PLN-044 manual-omission | PASS | W rejects omitted ID response, keeps old plan and blocks exports |
| PLN-045 catalog-refresh | NOT RUN | R tests input/selection/snapshot preservation; exact expanded-row/scroll preservation not asserted |
| PLN-046 snapshot-arithmetic | PASS | P historical fixture arithmetic only, not a live result |
| PLN-047 midnight | PASS | U formatting and W nine-stop result past midnight |
| PLN-048 copy-truth | PASS | C no live ETA, optimal-route, confidence, opening-hours validation or cloud claims |
| PLN-049 picker-map-sync | PASS | W popup removal reflected in list/count while route snapshot stays |
| PLN-050 route-map-order | PASS | W marker count/context, V numbering, C committed coordinates and dashed-line disclaimer |
| PLN-051 two-maps | PASS | W distinct instances; picker edits do not alter route; route click does not edit selection |
| PLN-052 map-failure | PASS | W blocked library preserves timeline/Maps; tile error fallback reviewed in C |
| PLN-053 map-resize | NOT RUN | General resize tested, but expanded mobile map rotation not a dedicated assertion |
| PLN-054 maps-export | PASS | W all nine points in exact origin/waypoint/destination order; dirty export blocked |
| PLN-055 save-local | PASS | W/R old key, saved IDs and recomputation on reload |
| PLN-056 save-denied | PASS | W denied storage shows failure while session remains usable |
| PLN-057 restore-invalid | PASS | W removed ID/date notice, no auto-fill, no request/export |
| PLN-058 optional-actions | PASS | C no unimplemented share/print/fullscreen/drag controls |
| PLN-059 keyboard | NOT RUN | Dialog trap/Esc/return-focus and reorder tested; full screen-reader/keyboard journey not audited |
| PLN-060 sticky-consent | NOT RUN | W actual consent/menu/dialog coexistence passes; physical keyboard/safe-area/footer sequence not tested |
| PLN-061 missing-photo | NOT RUN | V labeled missing photos pass; broken-image network-failure path not separately automated |
| PLN-062 no-js | PASS | W JavaScript-disabled context shows alternative link and hides inert workspace |
| PLN-063 shared-regression | PASS | S/C targeted shared shell/navigation/CMS smoke, not all website journeys |
| PLN-064 performance | NOT RUN | V confirms 6/12 batching and lazy maps; low-end-device profiling not run |

## Remaining Verification

Real iOS Safari/Android, software keyboard and safe areas, text zoom/screen reader,
expanded-map rotation, low-end performance, and the NOT RUN combinations above.
No release-readiness claim until required production/integration gates are run.
