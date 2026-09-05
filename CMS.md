# CMS Content

Runtime precedence is simple: valid current Admin Portal/API content is live for
visitors and must not be overridden by bundled JSON, cache, or stale fallback
logic.

Production reads and writes one configured source: Supabase when configured,
otherwise authenticated GitHub Contents API. Outages, missing documents, and
invalid payloads return 503. Runtime does not silently use build JSON or another
publish target. GitHub credentials remain on the server.

`public/admin/content/live.json` and `default.json` are build/development seeds.
Local development without a configured remote source reads `live.json`. Do not
run `db:seed:cms` during routine deploys: it can overwrite live Admin changes.

`/api/admin/content?path=/calendar/` returns shared shell settings and only the
current page's editable content. Temple records are included for temple pages
and Home, not unrelated tool pages. The database currently stores one CMS JSON
document, so this projection reduces browser payload, not database reads.

Admin and Planner use the same `applyTempleCmsRecords` merge rules. Explicit
empty fields and image slots are preserved. Planner identities derive from
stable dataset identity or CMS record key, never an edited display name.

Planner data and plan requests read the current source once per request. A
catalog revision identifies the data used by the browser. A changed revision
returns 409 with a fresh catalog; the visitor can review and resubmit. Successful
plans return current selected-place details. Browser storage contains user
criteria and IDs, not authoritative content or calculated results.

Run `nfr:cms` after local registry changes. Verify published contracts with
`cms:verify:production` or `smoke:production` after deployment. Schema versions
describe data shape; they do not determine which document is newest.

## Admin Media

Temple image uploads go directly from the browser to the configured media provider so the image bytes do not pass through Vercel Functions.

Cloudinary:

- `ADMIN_MEDIA_PROVIDER=cloudinary`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_UNSIGNED_UPLOAD_PRESET`

ImageKit:

- `ADMIN_MEDIA_PROVIDER=imagekit`
- `IMAGEKIT_PUBLIC_KEY`
- `IMAGEKIT_PRIVATE_KEY`
- `IMAGEKIT_URL_ENDPOINT` (optional display URL)

The private ImageKit key remains server-only. `/api/admin/media` returns a short-lived upload signature after validating the Admin session.

Live navigation may intentionally differ from build seeds. Test publication,
reload, explicit clears, deletions, source failure, recovery, and revision
conflicts using `npm run test:runtime` and the focused browser suites.
