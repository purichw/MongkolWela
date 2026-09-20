# Temple Activities

## Scope

- Admin: search/status filters, create/edit, draft, publish, postponed,
  cancelled, archive. Saving is independent of the global page CMS.
- Public: shared `TempleActivities.astro` on popular, mu and sacred detail pages;
  three upcoming notices, expand all, past notices, source and verification date.
- No production seed events. No inferred events from the Thai calendar.
- Calendar/Planner integration, automatic recurrence, notifications, official
  announcement ingestion, and nationwide directory entries are future work.

## Data And Authority

`api/admin/activities` uses the existing Admin session and same-origin guard.
Each activity has its own UUID and references a current catalog `cmsKey` as
`templeId`. This survives display-name/rank edits; it is not a name lookup.
Current catalog IDs are collection-specific. A temple present in two collections
has two IDs; a cross-collection canonical-place mapping is not inferred.

Production stores one record per activity in the existing Supabase
`cms_documents` table, with `id=activity:<uuid>` and document `status=draft`.
This envelope is always private under the existing public RLS policy
(`id='live' AND status='published'`). The event's separate `content.status`
controls public publication. Reads/writes require the server-side service role;
missing credentials or source failures return 503. No schema migration or
replacement of the live CMS document is required. Do not broaden public RLS.

The browser never receives a Supabase key. Public responses contain only
published/postponed/cancelled events for an active temple; editor identity,
version and audit metadata are omitted. Each write generates a new version and
atomically checks the previous version on update. Concurrent writes return 409
without replacing the editor's entered data. The latest 20 status/edit audit
entries stay with the private record; this is not full rollback history.

Non-production without Supabase uses `.local/activities.json` (gitignored).
Writes are serialized within the single local Node process and replace the file
atomically. Do not use local-file mode as multi-process production storage.
GitHub CMS fallback is not an activity-storage fallback.

## Event Contract

- `title`, `templeId`, `type`, `status` required even for draft.
- `startDate`/`endDate`: Gregorian `YYYY-MM-DD`; `timeZone=Asia/Bangkok`.
- `timeMode`: timed, allDay, unknown. Unknown never means midnight or all day.
- `startTime`/`endTime`: `HH:mm`; end must follow start. Overnight events use
  the next end date. No guessed duration when an end time is absent.
- `venue`, `description`, `participation`, `cost`, `preparation` optional;
  an empty cost does not imply free admission.
- `sourceUrl` and `verifiedAt` required before publication. Verification date
  cannot be in the future. Only HTTP(S) links are accepted.
- `registrationUrl` optional; hidden for postponed, cancelled and past events.
- `statusNote` required for postponed/cancelled events.
- Past boundary: explicit end time, otherwise end of the final date in Bangkok.
  Postponed notices remain upcoming with original date and status note until
  an editor confirms a new date or archives them. Rescheduling means updating
  dates and returning to published. Cancellation notices move to past after
  their original end date.

`GET /api/temple-activities?templeId=...&revision=...` reads the source every
time and returns no-store. The widget checks every 60s while visible and on
focus, online, visibility and bfcache resume. Revision hashes include actual
projected data and past status, so database changes and date rollover are
detected. Direct database editors must also change `version` to preserve
optimistic concurrency with Admin clients.

A load failure displays retry, not an empty list or stale registration links.
Successful zero results display: `ยังไม่มีประกาศกิจกรรมที่ยืนยันในระบบ`.

## Acceptance / QA Matrix

| Scenario | Expected | Source | Evidence | Priority |
| --- | --- | --- | --- | --- |
| Create draft/reload | Persisted privately | Private document | API + E2E | P0 |
| Publish announcement | Valid source/date; correct temple | Document + catalog | API + E2E | P0 |
| Invalid auth/origin/URL/date | Reject without write | Server validation | API tests | P0 |
| Two editors | Stale save 409; fields retained | Atomic version compare | Concurrent API + E2E | P0 |
| Deleted temple | No public activities | Live catalog | API test | P0 |
| Source outage | Retry; no fallback or stale actions | Configured source | API + E2E | P0 |
| Changed announcement | Open page refreshes | Fresh public API | E2E | P1 |
| Postponed/cancelled | Notice retained; no registration | Event status | Runtime + E2E | P1 |
| Bangkok midnight | Correct upcoming/past membership | Bangkok clock | Runtime test | P1 |
| Desktop/mobile | No overflow; usable controls | Rendered UI | Chromium + WebKit snapshots | P1 |

Commands:

```sh
node --test tests/runtime/temple-activities.test.mjs
npx playwright test tests/e2e/temple-activities.spec.ts --project=chromium-desktop --project=webkit-mobile
npm run check
npm run build
```

Local isolated preview, with Astro already running on port 4324:

```sh
node tests/helpers/activities-preview.mjs
```

This binds to loopback port 4327 only, rejects production/database credentials,
uses `.local/activities-preview/`, and allows local Admin sign-in with
`admin`. Other production write APIs are unavailable in this preview. It must
never be deployed. E2E creates isolated directories per test and never writes
production. Screenshot content is explicitly labeled test data and is saved
under `.local/activities-snapshots/`, outside Playwright's disposable output.

Before first production release: verify service-role configuration and the
existing RLS policy in the target project; run a read-only production smoke.
No production data has been created by this implementation task.
