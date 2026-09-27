# Shared Website Content Editor

## Scope

The Admin `siteContent` section follows the supplied shared-content desktop/mobile mockup. This is a presentation and workflow update, not a schema migration. The existing sidebar, authentication, page registry, navigation model, and visitor rendering remain the owners of their current behavior.

- `src/scripts/admin/site-content-editor.js`: scoped responsive editor, category metadata, search, pagination, field overflow copy actions.
- `src/scripts/admin/page-content.js`: existing template discovery and patch mutation; captures the requested scope before asynchronous loading.
- `src/styles/admin-site-content.css`: layout scoped to this section; sidebar colors untouched.
- `src/scripts/admin-portal.js`: removes section-specific header controls when navigating elsewhere.

## Content Contract

- Shared fields come from the homepage template outside `main`, as before, and persist only in `content.site.patches`.
- Homepage Hero content and the structured navigation model stay in their dedicated editors. The mock's sample rows do not create duplicate CMS fields.
- Labels, category badges, and field types are display metadata only. Existing selectors, node indexes, attributes, and patch IDs are preserved.
- Shared fields are scanned before projection so an explicitly empty published value does not remove its editor field. Values are resolved from the latest enabled matching patch, then from the template.
- An edit reuses the matching patch (including legacy IDs) and enables it when necessary. It does not append a competing override for the same binding.
- Search includes titles, context, categories, and current draft values. Search, category filters, reset, copy, and pagination do not mark content dirty.
- Eight rows per page. Counts are calculated from actual discovered fields; the current fixture has 58, but the interface does not hard-code that count.
- The date is the real `publishedAt`, labeled as the most recent publication, not a fabricated edit timestamp.
- Draft save/restore and revision-checked publication use the existing Admin workflow. The publication status panel can be dismissed after completion/failure so it cannot indefinitely cover Save Draft.

## Verification

Targeted browser coverage: `tests/e2e/admin-site-content.spec.ts`, plus shared footer publication, homepage text publication, and contact editor regressions from `cms-content-coverage.spec.ts`.

| Surface | Evidence |
| --- | --- |
| Desktop / mobile composition | Full desktop and mobile captures; mobile top/middle/bottom contact sheet |
| Responsive bounds | 320, 390, 768, 1024, 1280, 1440 px; middle pagination at 320 px |
| CMS persistence | Edit, paginate, search draft values, save, reload, restore, publish |
| Visitor propagation | Header and footer text checked on `/` and `/horoscope/palmistry/` |
| Ownership | Navigation and page documents unchanged in publication payload |
| Legacy / blank / disabled values | Existing IDs reused, blank value remains editable, disabled binding re-enabled by editing |
| Failure | Source failure and retry; publication conflict preserves draft; dismissible failure notification |
| Accessibility | Labels, disclosure Escape/focus return, custom select, Axe WCAG 2 A/AA |
| Isolation | Returning to Homepage removes shared editor header and styles |

Visual evidence and capture provenance: `artifacts/admin-site-content/`. Screenshots use an intercepted local API fixture, not a production account. No production content was written. No deploy, full build, whole-site NFR suite, or cross-browser release certification was performed for this page-level change.
