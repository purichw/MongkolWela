# Admin Place Editor

The September 27, 2026 desktop/mobile references guide the shared editor used
by Popular, Mu and Sacred collections. This change preserves the dark-jade
sidebar, existing Admin authentication, CMS records and publication API.

## Ownership And Layout

- `src/scripts/admin/editor.js`: drawer markup, existing field bindings and all
  six card/hero/map image slots (desktop and mobile).
- `src/scripts/admin/temple-editor-controls.js`: editor session, disclosure and
  media-variant state, geographic options, cancellation, validation and focus.
- `src/scripts/admin/visit-content.js`: existing visit-field schema, editable
  sections and data-backed summaries for hours, admission and contacts.
- `src/scripts/admin/media.js`: existing URL/upload/crop pipeline with session
  guards that ignore late results after cancel or opening another record.
- `src/styles/admin-place-editor.css`: scoped editor geometry only.

Desktop uses a right-hand drawer with three numbered section shortcuts. The
place and media sections start expanded; visiting information is summarized.
Mobile is full screen, with place information initially expanded. Header,
section shortcuts and save/cancel remain outside the independently scrolling
body. Secondary place fields are under Additional Information. Its disclosure
is in the place heading on desktop and below the primary fields on mobile.

The mobile Plus Code occupies a full row so that coordinates remain readable.
Image variants use a segmented control without unmounting the other variant.
Tablet photo tools use a stacked thumbnail/URL/action arrangement.

## Data And Editing Contracts

No record fields are removed. Name, region, province, district, address, Plus
Code, latitude/longitude, summary, description, place type, travel modes,
blessings, worship objects, image description, visiting details and sources
continue using their existing CMS keys. Image roles keep the existing configured
crop ratios, including the 16:10 detail image, rather than adopting the mock's
illustrative ratio. Confidence and reviewed dates use available record data;
an audit actor or last-edit timestamp is not invented.

Geographic choices use the existing Thailand directory index plus catalog and
current values. Selecting a region/province clears dependent geographic values.
An explicit manual-entry action retains support for noncanonical or missing
locations. If the index cannot load, catalog/current-value choices remain usable.

Opening snapshots the temple draft/catalog. Cancel, close, backdrop and Escape
restore that snapshot, including image edits and a newly added record, without
discarding drafts that existed before the editor opened. Save validates the
required name, coordinate ranges and typed URL fields, then keeps changes in the
existing in-memory Admin draft. The global Save Draft and Publish controls retain
their existing persistence/publication responsibilities; editor Save is not a
new server-side write or an autosave guarantee.

Confirmed removal retains the existing soft-delete/publication path. Async
media work carries both record key and editor session, preventing old image
results from changing a subsequently opened record. Uploaded but cancelled
assets are not deleted from the remote media provider.

## Verification And Evidence

Scoped browser checks: `tests/e2e/admin-place-editor.spec.ts`,
`admin-temples.spec.ts` and `admin-temple-list.spec.ts` (12 cases).
Runtime checks: `admin-data.test.mjs` and `admin-temple-list.test.mjs` (8 cases).
Astro and browser binding checks pass. Browser checks use installed Chrome,
repository content, intercepted Admin APIs and no production credentials/writes.

Covered: save/cancel/new-record rollback, coordinate validation, advanced and
visit fields, publication/reload, conflict retention, media variants, confirmed
image removal, crop opening, broken URLs, stale image requests, cascading/manual
geography, keyboard containment/Escape/focus restoration, sidebar inert state and
horizontal overflow at 320/390/768/1024/1440 widths. The editor's scoped WCAG A/AA
axe scan passes. Real external-provider upload delivery, other browser engines
and whole-site/release checks are not covered by this local pass.

Evidence in `artifacts/admin-place-editor/` captures the local `/admin/` route
at 1672x941, 390x844 and 768x1024, with the first Popular record open. Desktop
top/bottom and mobile top/bottom/media views were visually inspected. Reference
comparisons preserve aspect ratios and label inferred mobile scale; the mock's
filled prose is illustrative while the repository's absent prose stays blank.
The underlying listing/sidebar reflect the existing product rather than the
mock's older shell. No deployment is included.
