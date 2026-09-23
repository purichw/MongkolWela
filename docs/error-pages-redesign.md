# Error Pages

## Current Direction

The latest September 23, 2026 eight-status desktop/mobile references supersede
the earlier gold-numeral and landscape design. One shared `ErrorPage.astro`
owns 401, 403, 404, 429, 500, 502, 503 and 504. Each route is a thin wrapper.

- Desktop: a Thai watercolor illustration on the left; centered red status,
  Noto Sans Thai heading, explanatory text and recovery controls on the right.
- Mobile: complete illustration above the status and copy, two full-width actions,
  followed by a smaller previous-page link. Images preserve their aspect ratio.
- Every status uses its own 4:3 illustration, provided at 600 and 1200px in WebP
  with alpha, reserved dimensions and responsive source selection.
- The existing public Header, Footer, navigation, font readiness and CMS behavior
  remain shared. No error-only navigation fork or speculative social links were added.
  Those shared regions intentionally differ from the supplied shell.
- Status, title, explanation and recovery controls are real accessible HTML.
  Wooden sign lettering belongs to decorative artwork; the meaning is repeated
  in HTML. Illustrations are not photographs of specific real temples.
- Error styles load by page identity even for an unknown nested URL. All rules
  are owned by the error surface; global typography and other route styles are unchanged.

The 503 explanatory copy does not claim a live maintenance incident: no incident
source exists. The 500 explanation likewise does not claim the team is investigating.

## Recovery And Routing

| View | Primary action | Secondary action |
| --- | --- | --- |
| 401 | Role-neutral login entry | Home |
| 403 | Home | Existing contact section |
| 404 | Existing home temple search | Home |
| 429 | Home | Manual retry |
| 500, 502, 503, 504 | Manual retry | Home |

- The search and contact actions reuse `/#site-search` and `/#consult`.
- Retry reloads the current document only after explicit activation, retaining
  query parameters. A no-JavaScript empty-href anchor provides the same recovery.
  There are no automatic retries, invented cooldowns or rate-limit changes.
- Previous-page navigation uses in-site browser history when a same-origin
  referrer exists. Direct visits, external referrers, no-JS and modified clicks
  retain the ordinary Home link as a safe fallback.
- Unmatched URLs use Astro's actual HTTP 404 view. The static build still emits
  `dist/404.html` and `dist/500.html`.
- Other status routes are static reusable views under `/<status>/`, not
  authorization rules or HTTP middleware. Direct previews return HTTP 200.
  This work does not intercept Vercel platform errors or rewrite API responses.
- Every error page is `noindex, follow`, with analytics injection disabled.
  Recovery content does not depend on a CMS response.

## All-Role Login Entry

The user explicitly requested future support for all roles. The 401 page links
to `/login/`, never to a role-specific portal. The shared destination registry
is `src/config/auth-entry-points.ts`; `src/pages/login.astro` renders all of its
entries. Currently it links to the real seller and admin portals.

Add a future account type's real login destination to the registry; neither
ErrorPage nor the entry layout needs role-specific conditionals. These are
navigation choices, not a role assignment, a permission check or a new account
system. Existing portals continue to authenticate and authorize independently.
No speculative member login, sign-up or protected-route redirect was invented.

## Artwork Provenance

The built-in image generation tool reconstructed eight independent transparent
illustrations from the supplied screenshot references. They are faithful
reconstructions, not the unavailable original production source assets.
Final files live in `public/assets/images/errors/error-<status>.webp` and
`error-<status>-600.webp`. Sharp performs only deterministic size/format
conversion and preserves alpha.

`docs/error-pages-artwork.json` records source reference names, generated source
names, final asset paths, and the full prompt set. Lucide's original
`user-round` and `headset` icons were added to the existing licensed local set.
Older error artwork and the previously used numeral font remain untouched but
are no longer referenced by the error component.

## Verification

The focused Playwright suite covers all eight statuses on Chromium desktop and
mobile: unique decoded art, Noto Sans Thai, red status codes, two main actions,
44px targets, Axe WCAG A/AA, nested 404 status/CSS, no-JS retry, query preservation,
keyboard retry, previous-page fallback, configured login destinations, shared
navigation, CMS outage recovery, and widths 320/390/768/1024/1440.

Current local visual evidence is in `.local/error-redesign-v2/`:
all status pages at 1440px and 390px, full-page overviews, separate reference/
development comparisons, login captures and `proof.json`. The references are
cropped to their application viewport and uniformly scaled; reference CSS size
is inferred, not supplied. Normal captures use the read-only checked-in CMS
fixture. Current desktop/mobile images and comparisons were personally inspected.

The desktop content band is approximately 545px high at 1440px after the final
type-size adjustment. Mobile keeps readable type and natural image proportions;
it is taller than the compressed reference and retains the real shared shell.

Checks: Astro check (no errors/warnings, existing TempleDetail hint), static
build (743 pages, existing Home/Calendar JSON import-attribute warnings), focused
32-case E2E pass, final typography/login follow-up checks and `git diff --check`.
A stale Vite optimized-dependency cache was resolved by restarting only the
task's local server; no application workaround was introduced.

Run:

```sh
PLAYWRIGHT_CHROMIUM_CHANNEL=chrome PLAYWRIGHT_BASE_URL=http://127.0.0.1:4358 npx playwright test tests/e2e/error-pages.spec.ts --project=chromium-desktop --project=chromium-mobile
```

Scope intentionally excludes a whole-site regression, Firefox/Safari verification,
changes to authentication/API status handling, production writes and deployment.
