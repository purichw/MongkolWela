# Commerce Mockup Adaptation

Routes: `/shop/` and `/merit/`. Local implementation, not deployed.

## Direction

The September 27 shop references supersede the wooden-kiosk design. Preserve
the sacred still-life, clear title/eyebrow, centered closed-state copy, two CTAs,
four category previews, three destination shortcuts and FAQ. The open shop uses
category chips, search/sort, desktop collections and four-column products;
mobile uses horizontal product rows. Merit deliberately uses a different
composition: robe offering artwork when closed, photographic banner and campaign
cards when available. Both use the same page width, gutters and breadcrumbs.

Header, footer and Thai typography remain owned by the existing brand system.
Reference annotations, device frames and promotional claims are not UI content.

## Real Product Adaptations

- Public subnavigation now contains only shop and merit. No cart-count text or
  seller-management link. A labelled cart icon in the active shop preserves
  access to the existing cart/order flow.
- The opening-news CTA links to the existing CMS-managed Contact page. It does
  not claim subscription, collect addresses or send notifications.
- Generated illustrations are editorial artwork/category previews, not product
  inventory. Published cards use actual commerce product media and metadata.
- Optional product category is validated by the API and editable in the existing
  seller/Admin editor. Legacy products remain unclassified; titles are not used
  to guess categories. JSONB persistence needs no schema migration. Older editors
  that omit the category preserve the existing value.
- Public temple metadata exposes only id, name, province and image for locations
  linked to visible catalog entries. No donor/customer data is added.
- Progress is reserved fund units divided by capacity, NOT fundraising revenue.
  Lead-host capacity is displayed separately. A reservation is not money received.
- Trust copy and steps describe current order requests, seller confirmation and
  reviewed recipient channels. Online payments remain disabled. No authenticity,
  delivery, blessing or tax claims are inferred from the mockup.
- Favorites contain only listing IDs in local storage, labelled as device-local.

## Shared Owners

- `CommerceBreadcrumb.astro`, `CommerceNav.astro`, `commerce-landing.css`: shared
  outer geometry, current-location semantics, two-link navigation and states.
- `commerce-catalog.js`: category taxonomy and pure combined filtering/sorting.
- `commerce-catalog-ui.js`: escaped catalog controls, collection previews and
  distinct product/campaign card renderers. Existing ChoiceChip and icon helpers
  are reused; native-backed shared dropdowns own interaction.
- `commerce-public.js`: loading/disabled/error/ready state, refresh, filters,
  favorites and preserved transactional journeys.
- Route `.astro` files and `shop.css` / `merit.css`: independent compositions.
- Existing CMS fields stay intact; new editorial copy, links and desktop/mobile
  merit artwork have individual CMS field hooks.
- Commerce console tab clicks no longer bubble into the parent Admin router.

## State Coverage

Only `COMMERCE_DISABLED` shows the closed composition. Network/server failures
remain retryable. A successful empty catalog displays an empty message, not an
unavailable-service claim. Opening the service is reflected on normal refresh.
Detail, cart and private receipt views retain their existing controller and do
not show catalog-only support sections. Closed and open shop FAQs differ.

## Verification

Targeted runtime tests cover categories, old-editor compatibility, filters,
public metadata whitelist and existing authorization/storage/booking behavior.
`commerce-design.spec.ts` covers both route states, decoded images, CMS patches,
search/category/province/type/sort, favorites, errors, empty results, activation
and no horizontal overflow. `commerce.spec.ts` exercises real local order,
reservation, receipt, seller edit and Admin review paths against isolated data.

Visual evidence: `artifacts/commerce-redesign/`, Chromium desktop 1440x1000 and
mobile 393x851. Populated screenshots use clearly labelled local fixtures, not
production inventory. Screenshots are personally inspected in both sizes.
No production writes, real charges, CMS publication or deployment occur here.
Whole-site suites and live Supabase/payment-provider checks are out of scope.
