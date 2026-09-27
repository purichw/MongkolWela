# Admin Temple Collections

The September 27, 2026 redesign follows the supplied Admin listing reference:
four photo cards per desktop row and compact thumbnail rows on mobile. The
existing dark-jade sidebar, authentication, edit drawer, image tools and CMS
publish workflow remain owned by their existing modules.

## Ownership

- `src/scripts/admin/temple-list.js` owns the shared Popular, Mu and Sacred list,
  applied filters, unsubmitted search text, pagination, selection and CSV export.
- `src/lib/admin-temple-list.js` projects catalog records plus CMS overrides
  without mutating either input. It owns normalized preferences, Thai sorting,
  truthful status comparisons and spreadsheet-safe CSV cells.
- `src/styles/admin-temples.css` owns only the list and its scoped page header.
- `src/scripts/admin/editor.js` retains the drawer and responsive image editing.
  Selecting a record remains stable when its edited name stops matching a search.
  The subsequent drawer redesign is documented in [Admin Place Editor](admin-place-editor.md).
- `src/scripts/admin/publishing.js` refreshes the published record baseline only
  after the existing publication verification succeeds. Revision protection and
  in-flight edit preservation are unchanged.

## Product Contracts

All collections use the same renderer and retain their own records and public
URLs. Collection tabs are retained even though the reference shows one category.
Province, type and status filters combine with explicit submitted search. Sort
offers catalog rank, Thai name and province; creation dates are not invented.
Page sizes are 20, 40 and 80, with bounded page navigation and real result counts.

The status badge is not a new server-side publication workflow. A published
record with changed local editorial fields is marked as having a draft; a new
unpublished record is a draft and cannot open a public detail URL. Legacy rank
normalization belongs to collection order and does not create false editorial
drafts. Global unsaved/publish controls still cover ordering changes. Failed
publication keeps both edited values and the draft badge.

Saved filters are per-collection browser preferences, not shared CMS settings.
Typing search text alone does not apply it or discard selections. Filtering
clears selection; changing page or view preserves explicit selection. CSV is a
local download, with formula-prefix protection. There is no new bulk deletion
or bulk publishing. The per-record overflow menu retains confirmed removal and
rank controls, with reordering unavailable under an ambiguous filter/sort.

Mobile uses the same records and controls, with extra filters disclosed from the
filter button and the public link inside each overflow menu. Native-backed shared
custom selects retain their existing keyboard and form-value integration.
Missing or failed photos use the site's approved pale-cream placeholder.

## Scoped Verification

- Runtime: `tests/runtime/admin-temple-list.test.mjs` and `admin-data.test.mjs`.
- Browser: `tests/e2e/admin-temple-list.spec.ts` and `admin-temples.spec.ts`.
- Evidence: `artifacts/admin-temple-list/popular-{1440,390}-{top,full}.png`.
- Reference comparisons: `comparison-desktop.png` (top/middle/bottom) and
  `comparison-mobile.png` (top and pagination), using the supplied
  `Analysis output 1.png` without stretching. Mock inventory is illustrative;
  development shows the real 20-record page and repository counts.

Browser checks use intercepted local APIs and repository photo data. They cover
filtering, saved preferences, selection/export, paging, category reuse, explicit
load failure, draft status, create/edit, image crop, failed image validation,
successful publication and revision conflict preservation. No production data
is written. Whole-site, production, Safari and Firefox release checks are outside
this focused change.

Verified locally: 9 browser cases and 8 runtime cases passed; the listing had no
horizontal overflow at 320, 390, 768, 1024 and 1440 pixels. The scoped WCAG A/AA
axe check passed. Astro/browser syntax checks and `git diff --check` passed.
Screenshots use the local `/admin/` route, installed Chrome, collapsed sidebar,
intercepted Admin API fixture and no open editor. No deploy was performed.
