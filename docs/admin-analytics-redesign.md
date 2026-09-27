# Admin Analytics

## Scope And Design

- Reference: the user's desktop/mobile analytics mockups, Sep 27, 2026.
- Preserve jade sidebar, shared Admin shell, custom selects and authenticated API.
- Four KPI tiles, trend and referral distribution, popular pages, events,
  returning-user availability, data readiness, collapsible scope disclosure.
- Mobile uses two KPI columns and stacked charts, with a separate readable SVG
  coordinate system instead of shrinking desktop axis text. No new bottom-nav
  destinations were invented from the mockup.
- Existing overview dashboard is unchanged. The statistics route has its own
  renderer and scoped styles; obsolete statistics rendering was removed.

## Data Contract

- The four totals are pageviews, events, paths, event types. These are not people.
- No visitor identity, new/returning users, change percentages, attribution or
  98% completeness is fabricated. Returning users explicitly remain unavailable.
- Sources are recorded referrer hostnames, not inferred marketing channels;
  unknown does not imply Direct. The current collector's request referrer may
  be the website itself. The collector and consent behavior were not changed.
- `GET /api/admin/analytics` keeps its default behavior. Optional `from`/`to`
  accept real ISO calendar dates, inclusive in Asia/Bangkok, at most 90 days,
  and not beyond today. Date filtering is done before database aggregation.
- Auth, no-store, deterministic pagination and the 10,000-event ceiling remain.
  Supabase failures are explicit 503 errors, never a seed/local fallback.
- Daily event counts and last-recorded timestamp are additive fields. Existing
  daily pageview shape remains unchanged for dashboard consumers.
- `/admin` events are excluded from row-based reports. Historical local aggregate
  files cannot be refiltered by date and explicitly report this limitation.
- Empty, loading, failed and truncated reports are distinct. Limited reports
  are visibly identified and export the same limitation. Missing days in a
  limited report are not synthesized as zero.
- CSV includes actual selected-range totals, all page/event/source rows and
  daily values. UTF-8 BOM, quoted values and spreadsheet formula escaping apply.
- Site publishing and draft buttons are hidden only on this read-only screen;
  returning to editable sections restores their existing behavior.

## Acceptance And QA

| Scenario | Expected | Evidence |
| --- | --- | --- |
| Thai-day range / invalid dates | Correct boundaries; 422 for invalid dates | Runtime |
| Auth and database outage | 401 without session, 503 without fallback | Real handler + isolated HTTP fixture |
| Daily totals / zero days | Counted events, no invented users | Runtime |
| CSV | Same scope and counts, formula-safe strings | Runtime + browser download |
| Range control / retry | Refetch, no stale totals, preserved invalid date input | Playwright |
| Empty / failed / limited | Zero is not an outage; explicit partial data | Playwright |
| Layout / navigation | No overflow 320–1440; jade color retained; publish restored | Playwright |
| Accessibility | Keyboard native disclosure, custom select, table equivalent, WCAG A/AA scan | Playwright + axe |

## Visual Evidence

`artifacts/admin-analytics/`: local Astro `/admin/`, Chrome, desktop 1440x1000
and mobile 390x844, fonts loaded, DPR 1, test-only authenticated identity.
Populated chart screenshots use explicitly isolated test events, not production
usage. Empty/error/limited states are tested separately.

Desktop/mobile images were opened and inspected; mobile chart labels and the
date toolbar were corrected after the first review. Comparison sheets show
the full page at equal width and preserve reference aspect ratio. Phone-frame
cropping is approximate, not a pixel-parity claim.

Local preview: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4391 node
tests/helpers/analytics-preview.mjs`, then `/admin/?section=analytics` at port
4329, local password `admin`. This preview reads local aggregate data and blocks
analytics writes. It deliberately does not pretend to contain production data.

No production writes, live-provider analytics verification, full-site suite,
commit, push or deploy are part of this pass.
