# Home Composition Refinement

Scope: Home only, including the existing Home branch of shared `Footer.astro`.
No routing, CMS schema/source precedence, navigation data or production content
changes. Existing unrelated work is preserved.

## Visual Direction

- Desktop: supplied `codex-clipboard-4d9e61fa-babc-45a9-8c64-272a2bd79a5c.png`.
- Mobile: supplied `codex-clipboard-adf1c505-b6f4-4fb5-ad98-426804695233.png`.
- New explicit direction places mobile carousel controls at the hero's top right.
- Desktop uses the original full image, scaled uniformly. Mobile comparison
  crops the phone screen at x230/y54, 480x1618, then scales to390. CSS viewport
  dimensions are inferred; the screenshot is not evidence of an exact font size.

Adopted: heading hierarchy, gold botanical edge details, ivory translucent
surfaces, badge/image overlap, thin rules, contained circular arrows, compact
horizontal category cards, a photographic planner band and compact dark footer.

`BrandOrnament.astro` is a decorative shared primitive, not a content image.
Its local WebP is AI-generated botanical artwork with alpha, reused in the hero,
planner, quote and footer. It is aria-hidden and cannot intercept pointer input.
All photographic content remains connected to the existing CMS image slots.

## Intentional Differences

- Real photographs, registry counts, current date and calendar links are kept.
  No mock ratings, user totals, lucky numbers or unsupported social/contact
  destinations are introduced. The footer CTA opens the real planner.
- Mobile omits the duplicate database map panel; its destination remains in the
  hero and footer, and the same count remains in the stats strip.
- All five tools remain reachable in the horizontal mobile scroller.
- Footer navigation is a native disclosure on mobile and expanded on desktop.
  Without JavaScript it remains expanded. Every original destination is retained.
- Sample times retain their disclaimer and image credits remain accessible.
- The daily card follows the supplied close-up: full-width heading/date, a
  larger moon at left, lunar details/weekday above the aligned italic advice.
  Lunar data reuses the existing approximate calendar engine with Bangkok date
  boundaries and a visible preliminary-calculation label. No favorable-day,
  lucky-number, color or direction claims are added. Desktop keeps real
  calendar shortcuts in the three lower tiles; mobile omits those tiles.

## Verification

`artifacts/home-sections/overall-proof.mjs` captures complete pages at
1440/1024/720/390/320, checks image decoding, page overflow, category text/arrow
clearance and footer disclosure behavior, then creates desktop/mobile reference
pairs. The scoped Home Playwright tests cover header search/menu, carousel,
responsive geometry, footer links and accessibility. No deploy or whole-site
verification is included.
