# Home Banner Media

## Direction

Home Banner only. Match the supplied composition: gold brand title and search
on the left, daily information on the right, three shortcut tiles, full-bleed
real photography with a jade overlay. Main photograph should feel luminous and
gold; supporting slides introduce green landscape and evening light.

Avoid construction barriers, scaffolding, stock watermarks, unrelated scenes,
and crops that reduce the landmark to unrecognizable detail. The orange-barrier
Bangkok candidate was rejected and is not part of the CMS carousel.

## Sources

All files are local optimized WebP assets in `public/assets/images/`. Source
photos are not generated or retouched. CSS applies responsive cover crops and
the common contrast overlay; only the active image's credit is displayed.

| Slot | File | Source / Photographer | License | Object position | Role |
| --- | --- | --- | --- | --- | --- |
| 1 | `hero-doi-suthep-gold.webp` | [Doi Suthep](https://unsplash.com/photos/ZmvuHreuHdo), Nat Weerawong | [Unsplash](https://unsplash.com/license) | 50% 28% | Golden chedi framed by ornate Thai architecture; main image |
| 2 | `hero-songkhla-buddha.webp` | [Buddha in forest](https://www.pexels.com/photo/buddhist-temple-in-the-forest-15486655/), mohd hasan | [Pexels](https://www.pexels.com/license/) | 50% 50% | Golden Buddha surrounded by green landscape in Songkhla; avoid an unverified temple name |
| 3 | `hero-doi-suthep-forest.webp` | [Doi Suthep aerial](https://unsplash.com/photos/4Gq3UG5v4Es), Mike Holp | [Unsplash](https://unsplash.com/license) | 50% 43% | Golden chedi amid forested mountains |
| 4 | `hero-wat-mahathat-sukhothai.webp` | [Wat Mahathat at sunset](https://commons.wikimedia.org/wiki/File:Wat_Mahathat_Sukhothai_at_sunset.jpg), Supanut Arunoprayote | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 54% 48% | Evening temple landscape; credit explicitly identifies resize/crop |
| 5 | `hero-wat-arun-sunset.webp` | [Wat Arun at sunset](https://unsplash.com/photos/BVB6A30FI4c), Haley Hong | [Unsplash](https://unsplash.com/license) | 50% 12% | Upper golden prang at dusk; portrait source uses a top-focused desktop crop |

## CMS Contract

The page renders initial values from the existing build seed. Image choices are
not duplicated in Astro or browser scripts. Published Home patches remain the
runtime authority. Each of five stable image slots stores the asset URL, alt,
crop position, photographer, source URL, license and license URL. Admin Home
exposes all fields. Source links allow only HTTP(S).

Only the first image loads initially; selecting another slide loads its current
CMS URL. Explicit clears remove the deferred URL too. Older patches that lack
credit metadata do not inherit unrelated build credits. Patch deletion restores
the original build slot, consistent with existing CMS patch semantics.

These seeds have NOT been published to production. Deploying code must not seed
over current Admin changes. After asset deployment, update only the five image
patches in the latest live document through the existing Admin publish flow.

## Evidence

`artifacts/home-banner/capture.mjs` captures the local development route at
`http://127.0.0.1:4325/`, Chrome, DPR 1, reduced motion, declined analytics,
fixed Bangkok date 20 September 2569 and local CMS seed fixture. Captures cover
1440, 1024, 390 and 320 CSS-pixel widths; full carousel crops additionally cover
1440 and 390. These are development screenshots, not production evidence.

The user-facing preview is `http://127.0.0.1:4326/`, served by
`artifacts/home-banner/preview.mjs`. It proxies Astro on 4325 and serves the same
local CMS fixture, read-only. This avoids Astro dev treating Vercel API files as
static source. It blocks other API calls and cannot publish to production.

Checks: Astro/script checks and CMS validation pass; five focused Home browser
cases passed (the runner was interrupted after its final case hung in teardown).
The separate Admin media mock-publish/reload smoke and screenshot scripts exit
successfully. No full build, whole-site suite, or production publish was run.

The reference uses an illustrative landscape and daily/lucky data. Real photos
cannot replicate its landscape exactly. The daily card deliberately retains
verified date/navigation instead of inventing lunar, lucky number, user or
rating data to fill the mockup's extra fields.

## Banner Detail Refinement

The header is now shared across public routes, including Home and Calendar;
their route-specific header overrides have been removed. `Header.astro` owns
the CMS-driven links and shared search action; `header.css` owns dimensions.
`SiteIcon.astro` renders heritage assets with optical sizing and local Lucide
icons. `HomeSymbol.astro` is only the Home-size adapter, not a second icon
implementation. `public-ui.css` supplies translucent surface material without
forcing shared dimensions onto page-specific cards. Admin styles are excluded.

Desktop shortcut tiles and the daily card use translucent ivory surfaces with
blur and gold borders. On phones the photo occupies the banner row only; the
daily card follows on paper, the three shortcuts remain in one row, and the
compact header retains search, planner and menu controls. The date links to day
details. Desktop daily shortcuts use real calendar routes rather than invented
lucky-number, colour or direction data. `CarouselControls.astro` uses centered
Lucide chevrons and play/pause icons. Mobile replaces the dot controls with a
compact current/total counter; previous/next, swipe and pause remain available.

At the user's request, visible photo credits are suppressed for this demo with
`data-demo-hidden`; CMS source and licence metadata and the safe-link renderer
remain intact. This is a presentation override, not removal of attribution
obligations. Review licences and restore required attribution before a public
release. No production publish was requested for this refinement.

`detail-check.mjs` verifies 1440/1024/720/390/360/320 widths on the read-only
4326 preview, with Chrome/DPR 1, reduced motion, declined analytics, local CMS
fixture and fixed Bangkok date. It checks no horizontal overflow, shortcut
alignment, photo/card separation, credit/control placement, all five slides,
search focus, menu Escape and Bangkok date rollover. `detail-comparison.mjs`
produces matched region pairs without vertically stretching either reference.
Current evidence supersedes those earlier captures: `shared-polish-proof.mjs`
and `shared-polish-*.png` cover the same widths and latest supplied mobile crop.
The reference's CSS viewport/DPR are unknown; pairs use uniform scaling without
vertical stretching. The fact strip retains canonical registry counts and real
planner limits, not the mock's illustrative user/rating claims. Focused E2E
coverage includes five public routes, mobile navigation/search, centered icons,
compact carousel geometry, CMS media refresh, autoplay and reduced motion.
