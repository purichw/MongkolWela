# CMS Content

`public/admin/content/live.json` is the code-owned source of truth for published Admin Portal content during deploys.

`public/admin/content/default.json` must stay in sync with `live.json` for page registry and navigation. It is the bundled fallback when the live API is unavailable.

Production `/api/admin/content` may read from Supabase first, but it must expose the same page registry and navigation as `live.json`. After adding, removing, or renaming a page or navigation item:

1. Update both `public/admin/content/live.json` and `public/admin/content/default.json`.
2. Run `npm run nfr:cms`.
3. If Supabase is configured, run `npm run db:seed:cms` to write `live.json` into `cms_documents/live`.
4. After deployment, run `npm run cms:verify:production` or `npm run smoke:production`.

Do not rely on stale database content to define navigation. Database content is a published copy; the repo JSON files define the deployable contract.

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

The production smoke test checks `/api/admin/content` against `live.json` so missing Admin Portal menu/page entries are caught after every deploy.
