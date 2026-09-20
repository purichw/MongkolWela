# Home Discovery Sections

Scope: intent cards, planner/sample route, category discovery and supporting
tool links on `/`. Header, hero carousel and unrelated routes are unchanged.
Reference: user-supplied desktop crop and the earlier mobile Home mockup.

## Components And Contracts

- `CmsImage.astro`: stable media-slot ID, seed image metadata, intrinsic
  dimensions, lazy loading and existing Home fallback. Published image patches
  remain authoritative, including focal point. Removing a patch restores the
  built baseline and metadata.
- `LinkArrow.astro`: decorative circular arrow shared by intent, collection and
  tool cards. The containing link is the single interactive target.
- `SiteIcon.astro`: existing shared heritage/Lucide primitive, extended with
  local Lucide symbols. No new icon library runtime.
- Intent search URLs, planner entry point and collection routes are unchanged.
  Calendar overview and existing month mode have separate tool links.
- Sample times remain explicitly illustrative. Registry counts stay canonical.

## Responsive Decisions

- Six intent columns on wide desktop, three on tablet, two on phones including
  320px. Image frames stay equal regardless of source aspect ratio.
- Planner stacks on narrow screens; compact thumbnail timeline and quote remain
  side by side. The quote is editorial copy, not a testimonial.
- Three horizontal category links share one mobile row, including at 320px.
  The first card has slightly more width for its longer title. Images fill an
  independent frame so intrinsic aspect ratios cannot inflate the row; arrows
  stay in the lower-right corner with reserved text clearance.
- The latest full-page mobile composition omits the duplicate database panel.
  The same destination remains in the visible hero shortcut and footer links;
  the canonical count remains in the stats strip. Desktop keeps the map panel.
- Tool links use a contained horizontal scroller on phones. All five links
  remain reachable by touch, keyboard and focus-driven scrolling.

## CMS And Media

Fourteen image patches were added to local `live.json` and `default.json` seeds.
No production CMS write occurred. `CmsImage` resolves these slots rather than
hardcoding image paths in the Home template. Publish selected slots through the
normal CMS process when releasing; do not replace the entire live CMS record.

Six intent photographs are sourced from Pexels and optimized locally as WebP.
They represent gold, work, a lotus, a seedling, a fresh start and incense.
Temple thumbnails depict the actual named places. Existing licensed hero media
is reused for categories/background. The Thailand silhouette is rendered from
the project's existing boundary GeoJSON rather than a generic temple icon.

Sources/licenses are stored in the image patches and
`public/assets/images/home-media-credits.txt`, linked from the sample route.
Wat Pho and Wat Kalayanamit: Mastertongapollo, CC BY-SA 4.0. Their resized WebP
derivatives retain that license. Photo choices differ from the illustrative
mockup; the supplied mock image was not reused as production photography.

## Verification

- `npm run check`
- `npm run nfr:cms`
- Focused Home Playwright: responsive geometry, compact card rows, media loads,
  tool access, CMS source/focal-point override and restoration, refresh reveal,
  image fallback, desktop/mobile accessibility.
- `artifacts/home-sections/proof.mjs`: local CMS preview, actual image decoding,
  no page overflow at 1440/1024/720/390/320, contextual desktop/mobile pairs.

No whole-site audit, production build, commit or deploy is included in this pass.
