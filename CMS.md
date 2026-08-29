# CMS Content

Runtime precedence is simple: valid current Admin Portal/API content is live for
visitors and must not be overridden by bundled JSON, cache, or stale fallback
logic.

`public/admin/content/live.json` is the code-owned deployable fallback and seed
copy for published Admin Portal content during deploys.

`public/admin/content/default.json` must stay in sync with `live.json` for page
registry and navigation fallback. It is used only when the live API is
unavailable or invalid.

Production `/api/admin/content` may read from Supabase first. Older CMS copies
without the current editable contract are guarded by bundled page/navigation
data so stale Supabase content cannot restore old nav after hydration. New Admin
Portal publishes include `cmsContractVersion` and may intentionally override
bundled navigation for visitors. After adding, removing, or renaming a
code-owned page or navigation item:

1. Update both `public/admin/content/live.json` and `public/admin/content/default.json`.
2. Run `npm run nfr:cms`.
3. If Supabase is configured, run `npm run db:seed:cms` to write `live.json` into `cms_documents/live`.
4. After deployment, run `npm run cms:verify:production` or `npm run smoke:production`.

Do not rely on stale database content to define navigation. Database content is
a published copy; the repo JSON files define the deployable fallback contract,
while current Admin Portal publishes define the editable runtime contract.
Production smoke must pass `/api/admin/content`, and a browser hydration
spot-check is recommended for header navigation changes.

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

The production smoke test checks older CMS copies against the `live.json`
fallback contract only to block stale page/navigation regressions. For current
Admin Portal publishes, it validates the editable contract and allows live API
content to differ from bundled fallback data intentionally.
