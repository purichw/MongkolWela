# Prediction Library Editor

Updated 2026-09-27 from the supplied desktop/mobile prediction-library mockups.

## Scope

- One shared editor for the existing prediction catalog: Seamsi, Tarot, life graph,
  Thai astrology, and palmistry. The list, filters, schemas and API remain intact.
- Desktop uses an editable form beside publication metadata. Mobile stacks the
  two disclosures and keeps the existing Save Draft / Publish controls fixed at
  the bottom, with clearance for the final field and safe area.
- Existing jade sidebar, shell navigation, visitor-linked colors and Lucide icons
  are preserved. The mobile website icon replaces the mockup's unsupported
  overflow actions. Generic tips are omitted; publication timing and immutable
  engine-reference information are retained.
- Narrative fields use textareas. Field types depend on the catalog, not on each
  keystroke. All editable paths remain present, including nested Tarot fields.
- The record heading follows title edits. Returning to the list restores its
  search, category, page, scroll and originating edit-button focus.

## Data Contract

`src/scripts/admin/content-library.js` only writes editorial overrides under
`state.content.contentLibrary[group][recordId][fieldPath]`. Explicit empty strings
are preserved. Formula inputs, record IDs, card order and protected fields remain
owned by `src/lib/managed-content.js`; no new editable engine fields are introduced.

Save Draft uses the existing browser-local draft and revision. Publish uses the
existing revision-checked central CMS workflow. Failures retain current edits.
Both actions operate on the shared CMS draft, not a separate record-level backend.

Editor styling is scoped in `src/styles/admin-content-library.css`.
`setTitle` removes the editor class and contextual header link on section changes.
No new publication controller, browser-storage key or event observer is added.

## Verification

- Four targeted Playwright cases: desktop/mobile layout, keyboard disclosures,
  mobile draft save/reload, publish conflict/retry, catalog retry, nested fields,
  shell cleanup and existing Tarot visitor publication/reload.
- Four existing managed-content runtime tests: string overrides, empty values,
  identity preservation, protected-field and unsafe-content rejection.
- Browser binding/syntax check (85 modules); `git diff --check`.
- Scoped Axe check; overflow checks at 1440, 1024, 768, 390 and 320 CSS pixels.
- Actual local catalog loaded through authenticated isolated preview at
  `http://127.0.0.1:4327/admin/`, with no runtime errors or production writes.

Evidence under `artifacts/admin-content-library/`: actual Seamsi record 4, test
session, Chromium/Chrome, 1440x1000 and 390x844, device scale 1. Desktop/full mobile
and mobile top/bottom images were personally inspected. Comparison sheets label
the reference scale; mobile device framing is approximately cropped, not stretched.

No whole-site suite, production publish, commit, push or deploy in this pass.
