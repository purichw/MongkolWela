# Activities Admin Redesign

Implemented 2026-09-27 from the supplied Activities / Merit Events desktop and mobile composite. This is a mockup-led adaptation, not a new event backend.

## Interface

- Desktop table: image, title/description, place, type, dates, lifecycle, public visibility, edit/copy/archive. Mobile uses compact image rows and an overflow menu.
- Real counts, search, type/status/date-overlap filters, pagination, page size, selection, and confirmed bulk archive. Active and upcoming events precede drafts and history.
- Six keyboard-accessible editor tabs: general, schedule, participation, media, publication, and actual revision history. All existing editable fields remain available.
- Missing images use the existing full-bleed cream placeholder. New and broken image URLs cannot distort the preview frame.
- Existing brand controls and searchable Choices selects are reused. Sidebar colors are untouched.

## Data Contracts

- `api/admin/activities.js` remains the authenticated GET/POST authority. Saves and archives include `expectedVersion`; conflicts retain local inputs.
- Drafts are real server drafts. Saving an existing public announcement as draft/archive requires confirmation. Copy opens an unsaved draft, without writing until Save.
- No invented registration-open status. Upcoming/ongoing/past are calculated from real dates in Asia/Bangkok; cancellation/postponement remain explicit editorial states.
- Public visibility is a read-only consequence of status, not an independent switch. Cancelled announcements remain visible until archived.
- Archive replaces the mockup's destructive trash action. It preserves audit history and permits later republishing. Partial bulk failures report actual successes and retain failed selection.
- No import action is shown because no import API exists. No fake help destination or duplicate activity summary field was added. The existing 4,000-character description remains intact.
- Media uploads update the working form only until Save. Source/verification requirements and public projection are unchanged. History shows recorded metadata, not a nonexistent rollback feature.

## Owners

- `src/scripts/admin/activities.js`: loading, save/publish, uploads, unsaved guards and confirmed archive.
- `src/scripts/admin/activity-list.js`: list state and rendering.
- `src/scripts/admin/activity-form-view.js`: editor markup, tabs, error focus and history.
- `src/lib/admin-activity-list.js`: derived phases and filters.
- `src/styles/admin-activities.css`: scoped desktop/mobile layout.

## Verification And Evidence

- Five focused Playwright tests passed: responsive layout/accessibility, filters/paging/partial archive/copy, error recovery, real local API draft/reload/publish/conflict, upload failure/retry/save.
- Four runtime tests passed covering phases/ranges, validation, Bangkok boundaries, private persistence, CAS, auth/origin, public projection and source outage.
- Browser binding checks passed (83 modules); `git diff --check` passed.
- Layout checked at 320, 390, 768, 1024, 1280 and 1440 px. Screenshots personally inspected at desktop 1440 x 940 and mobile 390 x 844; no overlays. Chrome, DPR 1, default zoom.
- `artifacts/admin-activities/`: before views, current full-page list/editor/media views and reference comparisons. The reference is `codex-clipboard-34b7d307-b94e-4867-9ba7-cc4ebf0fd9aa.png`; its individual desktop/mobile panels are cropped and uniformly scaled, never stretched. Reference viewport dimensions are inferred, not known.
- Screenshots use explicitly marked test-only events and an intercepted test session (`admin@example.test`) on local `/admin/`. They do not represent production counts or real announcements. API mutation tests use isolated temporary storage, not production.
- Full-site regression, deployment, production writes and WebKit-device testing were intentionally not run for this route-scoped change.

Local interactive API preview: `http://127.0.0.1:4327/admin/` (local preview password `admin`), proxying the existing Astro server on port 4391. This is a separate local store, not the production CMS.
