# Admin Media Library

## Scope and Design

Reference: `codex-clipboard-1ec3a5da-c372-4149-a61d-7a7fcdf14d8e.png` supplied on 2026-09-27.

Preserved: existing jade sidebar, admin shell, brand placeholder, CMS source
ownership, provider credentials/authentication, and existing temple upload defaults.

Translated: compact header actions, real image/video/document counts, search and
format/category/sort controls, four-column desktop gallery, thumbnail rows on
mobile, per-file actions, selection and pagination. On mobile, secondary filters
expand from the filter icon; upload and page selection remain in the bottom bar.

Adapted: filenames, categories and totals come from actual records, not the
mockup. Unknown size and dimensions are not fabricated. Thumbnail dimensions
come from the original image after decoding, never from the fallback illustration.
Twenty records per page are retained even though the illustrative mockup shows
sixteen. The existing command bar and menu inventory remain unchanged.

## Owners and Contracts

- `src/scripts/admin/media-library.js`: library state, filters, selection,
  detail/import dialog, upload queue and reference links.
- `src/lib/admin-media-library.js`: validation, URL deduplication, filtering,
  sorting and metadata formatting.
- `src/scripts/admin/data.js`: references from CMS page image patches/blocks
  and temple card/hero/map desktop/mobile variants, respecting explicit clears.
- Activity images are merged from the authenticated activity endpoint.
- `api/admin/media.js`: existing provider configuration and ImageKit auth,
  plus authenticated `GET ?view=library` and `POST action=save-asset`.
- `api/admin/_media-library.js`: private registry documents under
  `cms_documents.id = media:<sha256-url>`, `status=draft`. These are distinct
  from the public `live` document and do not publish visitor content.
- Production requires the existing Supabase service connection. Failure is
  explicit 503, never a fallback to bundled JSON or a local production file.
- Local development uses `.local/media-library.json`, overridable with
  `MONGKOLWELA_MEDIA_DIR`. Writes are queued and atomically replaced.
- URL is the immutable identity. Version-based compare-and-swap prevents stale
  overwrites; duplicate URL insertion returns 409. Actor/timestamps are server-owned.

## Supported Actions

Search includes file name, category, description and known CMS owner names.
Category and format choices derive from the current inventory. Selection is
preserved across page changes and cleared when changing filter scope. Selected
URLs can be copied in bulk; no visitor content is changed by selecting a file.

The detail dialog edits library name/category/internal description. It does not
rewrite source URLs or visitor alt text. Source buttons still lead to the real
page/temple editor; activity references open the activity management section.
References are known CMS references, not an exhaustive storage dependency scan.
Failure to load the registry leaves reference details available read-only.

Image uploads use the existing configured Cloudinary/ImageKit integration, with
a separate `mongkolwela/library` folder and no temple attribution. Existing
callers retain their default temple folder. Maximum batch: 20 files, 8 MB each;
JPEG, PNG, WebP, GIF and AVIF. Actual bytes/dimensions are recorded. After upload,
the URL is retained in the in-memory retry queue if registry saving fails, so a
registration retry does not re-upload the binary. Duplicate responses reconcile
against the registry without overwriting another admin's metadata.

Video/document registration accepts an existing HTTPS/site URL. Binary upload
for these types, provider-wide asset discovery, file deletion, automatic source
replacement and editor media picking are not introduced by this redesign.
No provider credentials or example records are added to production.

## Acceptance and Evidence

| Scenario | Expected | Evidence |
| --- | --- | --- |
| Desktop/mobile layout | Four desktop columns, mobile rows, no overflow at 320–1440 px, sidebar color unchanged | Playwright + inspected screenshots |
| Metadata and filters | Actual counts, valid image dimensions, no fallback dimensions, URL deduplication | Runtime + Playwright |
| Owner navigation | Page/temple references remain actionable | Existing admin-data regression + Playwright |
| Import/edit/reload | Name and category persist without page publishing | Real isolated local API + Playwright |
| Upload failure | File URL survives registration failure and retry does not duplicate upload | Provider/API fixture + Playwright |
| Permissions/concurrency | Unauthenticated denied, foreign origin denied, unsafe URL rejected, stale write 409, database outage 503 | HTTP integration test with isolated database/auth fixture |
| Accessibility | Names, keyboard close/focus return, custom selects, relevant WCAG A/AA checks | Playwright + axe |

Screenshots under `artifacts/admin-media/` use local Astro `/admin/` at
1440×940 and 390×844, Chrome, DPR 1, loaded fonts. Data is the existing development
content with an isolated test-only media registry. The document tab's sample
record is test-only. No production writes were performed.

The reference is a composite; desktop and mobile panels are separately cropped,
then proportionally scaled for comparison. No imagery/content is retouched.
The full mobile list is longer because actual page size is 20; the viewport
capture also shows the sticky mobile actions.

Tests are scoped to the media library, its API and existing upload contract.
Full-site E2E, provider-live uploads, production smoke and deployment are not run.

Local preview: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4391 node tests/helpers/media-preview.mjs`
serves `http://127.0.0.1:4328/admin/` using the existing local-only preview login.
