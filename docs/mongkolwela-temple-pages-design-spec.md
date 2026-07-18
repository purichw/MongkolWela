# Mongkol Wela Temple Pages Design Spec

Updated: 2026-07-18
Surface: Home plus `temples/**`
Prototype artifact: `outputs/mongkolwela-temple-pages-offline-prototype-final-20260718`
Production reference: `https://mongkolwela.vercel.app/`

## Purpose

This spec documents the temple-focused Mongkol Wela experience for design review and Claude Design handoff. The surface is about finding temples, sacred places, auspicious routes, and worship-trip planning. It is not a horoscope or tarot experience.

The exported prototype is a source-parity offline clickable artifact. It includes the Home page and every page under `/temples/**`, including detail pages, so category cards, map payload links, planner-generated links, breadcrumbs, and related-place links do not dead-end.

## Scope

Included pages:

- `/`
- `/temples/`
- `/temples/planner/`
- `/temples/popular/`
- `/temples/mu/`
- `/temples/sacred/`
- `/temples/thailand/`
- `/temples/popular/*/`
- `/temples/mu/*/`
- `/temples/sacred/*/`

Out-of-scope links:

- Tarot pages
- Horoscope tools
- Calendar pages
- Admin/CMS pages
- External Google Maps URLs

Out-of-scope links remain clickable to production or external URLs rather than being included as offline pages.

## Experience Principles

The temple surface should feel warm, reverent, useful, and trip-oriented. It should lead with sacred-place discovery and planning, not astrology-first positioning.

Primary user jobs:

- Find a temple or sacred place by intent, province, region, or name.
- Browse trusted collections such as popular temples, sacred temples, and auspicious places.
- Plan a worship trip of 3, 5, or 9 places.
- Open temple details with blessing themes, route context, map action, visit info, and confidence level.
- Search the national temple directory by administrative filters.

## Visual Direction

Brand mood:

- Thai temple warmth
- Lacquer red accents
- Gold aura highlights
- Jade/green utility and confirmation tones
- Warm paper background
- Quiet sacred atmosphere rather than mystical fortune-telling

Core visual signals:

- Large Thai display headline on Home.
- Temple mural and sacred-place photography.
- Soft aura/ritual-line animation around the hero.
- Card grids with practical route/action copy.
- Red-gold CTA treatment for planning and search.
- Map/planner affordances presented as utility, not decoration.

## Layout System

Global shell:

- Sticky site header with logo, CMS-driven navigation, mobile menu toggle, and utility action.
- Main content uses full-width bands and constrained inner content.
- Footer reinforces temple positioning and links back to Home guide anchors.

Home layout:

- Full-bleed temple hero with carousel imagery, large brand title, search, and quick links.
- Intent panel: six cards for blessing goals.
- Route section: planner, popular temples, sacred places, and sacred/mu routes.
- Map band: visually reinforces place-based discovery.
- Directory cards: quick paths to all-Thai temple search and collection map views.
- Guide/media section: pre-trip ritual guidance.
- Supporting tools strip: out-of-scope links to production.

Temple hub/category layout:

- Hero banner with image, breadcrumb, title, and contextual copy.
- Filter/search panels for collection pages.
- Map floating action for collection pages where coordinates exist.
- Card grids using rank, image, region, province, district, and blessing metadata.
- Load-more behavior keeps dense lists navigable.

Planner layout:

- Primary decision panel for target count, date/time, budget, start point, radius, region, province, and purpose.
- Prominent automatic trip CTA.
- Manual pick section remains available for custom selection.
- Result section includes summary, warnings, timeline, map tab, save action, and Google Maps action.
- Help tooltips explain selection and trip criteria.

Thailand directory layout:

- Hero with embedded search/filter panel.
- Dense results table with internal horizontal scroll container.
- Pagination and count area support large dataset scanning.

Detail page layout:

- Hero image and key identity.
- Primary detail actions: Google Maps, share, copy link.
- Story/detail content with blessing chips.
- Visit info cards for admission, hours, contact.
- Transit/route section.
- Confidence panel with accessible tooltip.
- Side map card with offline fallback in prototype.
- Related-place card grid.

## Typography

Font:

- Noto Sans Thai, bundled locally in the offline export.

Tone:

- Thai headings are heavy, warm, and compact.
- Body copy is practical and calming.
- Labels/kickers are short, scan-friendly, and domain-specific.

Guidelines:

- Hero headline can be oversized.
- Cards and panels use smaller, dense typography.
- Avoid horoscope/tarot vocabulary in temple-first surfaces unless linking to an out-of-scope production tool.

## Color Tokens

Representative palette:

- Lacquer red: primary CTA, important section accents.
- Deep brown/ink: headings and high-contrast text.
- Warm paper: page and card surfaces.
- Gold/yellow aura: borders, highlights, button secondary glow.
- Jade green: metadata labels, active/support states.
- Muted stone/brown: secondary copy and disabled/fallback states.

Color behavior:

- Red buttons signal decisive user actions such as search or trip planning.
- Gold outlines and soft shadows signal sacred warmth.
- Green labels signal classification, confidence, or helpful metadata.
- Error/fallback states should remain calm and instructive.

## Components

Header navigation:

- CMS runtime fills nav items from embedded content in the offline prototype.
- In-scope temple links resolve to local offline pages.
- Out-of-scope nav links resolve to production.
- Mobile nav keeps the existing toggle/escape/outside-click behavior.

Hero carousel:

- Five local images.
- Dot controls and previous/next buttons.
- Auto-advance is preserved through the offline classic bundle.
- Motion should remain soft and not fight the headline/search focus.

Intent cards:

- Six cards with short labels and action-oriented headings.
- Cards link into temple collections, not horoscope pages.
- Each card keeps consistent card geometry and spacing.

Collection cards:

- Image, rank/figcaption, metadata, title, and province/district.
- Hidden/filtered states are JS-driven.
- Placeholder class is valid for records without a specific image.

Map modal:

- Floating map button opens a modal.
- In production, Leaflet/Esri renders interactive maps.
- In the offline prototype, map widgets intentionally show the existing fallback/error state instead of loading CDN tiles.

Planner:

- Automatic and manual planning journeys are both visible.
- Automatic plan can be generated offline from embedded page payload.
- Result timeline links resolve to local detail pages.
- Map tab opens but displays offline fallback class in `file://` mode.

Tooltips:

- Planner and detail-confidence tooltips are accessible disclosure panels.
- Panels must stay above their trigger and not be clipped by section bounds.
- Thai copy must wrap normally, never letter-stack vertically.

Thailand directory:

- Data is embedded via `assets/data/temples-thailand.offline.js`.
- Table initializes offline with 44,705 rows.
- Internal table scroll is preserved.

Detail page actions:

- Share uses browser share where available.
- Copy link button remains present.
- Google Maps links intentionally remain external.
- Confidence tooltip opens and closes with button/escape/outside click behavior.

## Motion And Transitions

Home:

- Hero copy and controls should fade once on initial page entry.
- Carousel image transitions use directional enter/exit classes.
- Decorative aura/orbit lines should support the sacred atmosphere without becoming the main content.

Sections:

- Home section reveals should be predictable after refresh.
- Reduced-motion preference should be respected where implemented.
- Card hover/focus effects should be subtle and not resize layout.

Planner and filters:

- Dialogs and tooltips should feel immediate and stable.
- Filter/list rendering should avoid layout jumps beyond expected card visibility changes.

## Responsive Rules

Desktop:

- Hero uses wide image composition and centered headline/search.
- Grids use multi-column layouts.
- Planner can present setup and action areas with strong hierarchy.

Mobile:

- Header nav collapses behind the toggle.
- Hero headline and search stay readable without horizontal overflow.
- Cards stack into single-column or compact two-column patterns where already defined.
- Planner controls remain tappable and do not force body-level horizontal scroll.
- Thailand table may scroll inside its table wrapper; body-level horizontal overflow should remain zero.

## Accessibility Requirements

Required behavior:

- Buttons have accessible labels.
- Dialogs use `role="dialog"` and `aria-modal` where implemented.
- Tooltips/disclosure panels update `aria-expanded` and `aria-hidden`.
- Map modal focus trap remains active in production mode.
- Images have meaningful alt text where content-bearing; decorative hero background alt may be empty when supported by visible title.
- Keyboard users can open/close navigation, tooltips, planner dialogs, and detail help.

Offline QA verified:

- CMS nav populates on file load.
- Confidence help opens on detail page.
- Planner auto-trip can generate a result.
- Map fallback opens without hard JS errors.

## Offline Prototype Implementation Notes

The artifact is intentionally not a hand-coded approximation.

Export transformations:

- Built from the current Astro source into a static dist.
- Copied Home and all `/temples/**` HTML pages.
- Rewrote in-scope links to relative local paths.
- Redirected out-of-scope links to production.
- Downloaded all 196 external rendered images into `assets/offline-images/`.
- Embedded CMS content into `assets/js/cms-runtime.js`.
- Embedded Thailand temple data into `assets/data/temples-thailand.offline.js`.
- Added `script.offline.js` as a classic-script bundle because Chromium blocks `type="module"` under `file://`.
- Converted page-level module scripts to classic scripts for file-based use.
- Kept production map tiles/CDN out of the offline bundle and surfaced existing fallback UI.

Verification files:

- `export-manifest.json`
- `qa-report.json`
- `screenshots/home-desktop.png`
- `screenshots/home-mobile.png`
- `screenshots/planner-desktop.png`
- `screenshots/planner-mobile.png`
- Additional category/detail screenshots in the same folder.

QA summary:

- HTML pages: 632
- External images localized: 196 of 196
- File-mode browser QA checks: 17
- Hard problems found: 0

## Claude Design Handoff Guidance

Use the exported folder or zip as the visual and interaction source of truth.

Primary review path:

1. Open `index.html`.
2. Review Home hero, intent cards, route cards, directory, guide, and supporting links.
3. Navigate to `/temples/planner/` and generate an automatic trip.
4. Navigate to `/temples/popular/`, filter/search, and open map fallback.
5. Navigate to `/temples/thailand/` and verify table/search density.
6. Open a temple detail page from a collection or planner timeline.

Do not redesign away from:

- Temple-first positioning.
- Warm red/gold/jade sacred palette.
- Existing route/page hierarchy.
- Planner as a key product differentiator.
- Dense Thailand directory table behavior.
- Distinct collection variants for popular, sacred, and mu contexts.

Potential future design exploration:

- More refined planner result summary cards.
- Better offline/static map preview asset for design-only review.
- A clearer distinction between sacred place collections and supporting non-temple tools.
- More photo coverage for records currently using the auspicious placeholder.
