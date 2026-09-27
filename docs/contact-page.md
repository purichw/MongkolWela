# Contact Page

## Scope

- Route `/contact/`, page ID `contact`; shared shell, PageBanner and CmsImage.
- Confirmed defaults: `mongkolwela@mongkolwela.com`, LINE `@MongkolWela`.
- No Facebook, invented office details, response-time promise or fake form.
- Native mailto opens the visitor's mail application. LINE opens its public
  profile/add-friend URL in a new tab; this is not proof of message delivery.
- Website messages are not stored by this page. Do not add an inbox, submission
  success state or personal-data form without a separate backend contract.

## CMS Contract

Use the existing `pages[].patches` publication path for `contact`. No new API,
polling loop, database table or copy of published content is needed. The existing
page projection includes these patches. The route script responds to
`mw:cms-content-ready`, including later refreshes and page re-enablement.

| Value | Selector | Patch kind | Attribute |
| --- | --- | --- | --- |
| Email address | `#contact-channel-data` | `attr` | `data-email` |
| LINE public ID (include `@`) | `#contact-channel-data` | `attr` | `data-line-id` |
| Hero media | `#contact-hero-image` | `image` | Standard image fields |
| Title, intro, kicker | `#contact-title`, `#contact-intro`, `#contact-kicker` | `text` | - |
| Section heading/description | `#contact-channels-title`, `#contact-channels-intro`, `#contact-topics-title`, `#contact-topics-intro` | `text` | - |
| Channel copy | `#contact-{email,line}-{title,description,action-label,note,detail}` | `text` | - |
| Topic copy | `#contact-{usage,corrections,partnerships}-{title,description,action-label}` | `text` | - |
| Email subject | `#usage a`, `#corrections a`, `#partnerships a`, `.contact-channel--email a` | `attr` | `data-email-subject` |
| Privacy note | `#contact-privacy-title`, `#contact-privacy-description` | `text` | - |
| Guide link copy | `#contact-guide-title`, `#contact-guide-description` | `text` | - |
| Hero ornament copy | `#contact-tagline`, `#contact-hero-quote` | `text` | - |
| Mobile closing strip | `#contact-closing-{title,description,action}` | `text` | - |

Text nodes also carry stable `data-cms-field` keys for discovery by the existing
CMS page scanner. Original IDs remain valid for published selectors. Channel
values remain derived from `data-email` and `data-line-id`, not duplicate copy
fields. The mobile closing action links to `#contact-channels`; it does not
introduce another contact value or submission flow.

Example patches in the existing contact page record:

```json
[
  { "selector": "#contact-channel-data", "kind": "attr", "attr": "data-email", "value": "mongkolwela@mongkolwela.com" },
  { "selector": "#contact-channel-data", "kind": "attr", "attr": "data-line-id", "value": "@MongkolWela" }
]
```

Future Admin controls should edit those two fields, not separate display text,
mailto URLs, copy payloads or LINE URLs. Do not patch generated contact values or
hrefs independently. Subjects are encoded; invalid addresses and handles do not
produce active actions. Empty published values stay empty. A deleted patch
restores the build default by the shared patch lifecycle; an outage retains the
last published state with the shared retry notice, never a seed replacement.
Unchanged refreshes preserve clipboard confirmation and pending copy operations;
actual channel changes invalidate a confirmation for the previous address.

Only development/build seeds are registered here. When publishing this route,
read the latest live document and append the page only if missing. Never replace
the document with bundled seeds. The general Admin patch editor can use these
selectors now; a dedicated contact form in Admin can be added later.

The JavaScript-disabled static view uses build defaults and native links, as
other static pages do. Runtime CMS freshness requires JavaScript; this change
does not introduce server rendering or claim no-JS published parity.

LINE format follows the [official LINE URL scheme](https://developers.line.biz/en/docs/messaging-api/using-line-url-scheme/):
`https://line.me/R/ti/p/` plus the percent-encoded public ID.

## Entry Points

- Header utility navigation and mobile drawer, via `siteConfig`.
- Tarot result contact link, Seamsi contact CTA, forbidden-page support link.
- SSR and client-rendered collection correction links target
  `/contact/#corrections`; the anchor respects the sticky header.
- The legacy footer `#consult` anchor remains for old bookmarks.

## Acceptance And QA

- Real channel values and working destinations, without sending messages.
- All contact actions update together when CMS changes a single source field.
- Explicit clear, invalid value, deleted patch and source failure are distinct.
- Copy success/failure stays honest; no-JS native links remain available.
- Desktop/mobile inherit shared width and fonts, with no clipping or overflow.

| Feature | Scenario / Expected Result | Source | Check | Priority |
| --- | --- | --- | --- | --- |
| Contact targets | Confirmed email and encoded LINE URL, subjects preserved | User-provided contacts / LINE docs | Runtime + E2E | P1 |
| CMS ownership | Publish/refresh changes values, links, copy, title and image | Shared page patches | E2E | P1 |
| CMS state | Clear/invalid disables; deletion restores; outage retains and retries; page disable/enable works | CMS contract | E2E | P1 |
| Clipboard | Keyboard activation copies current value; denial offers manual copy | Browser clipboard | E2E | P1 |
| Page links | Header entry and correction anchor; no-JS native destinations | Route contract | E2E | P1 |
| Composition | 1440px and 390px, plus 320px email wrapping | Existing site design | Personally reviewed snapshots | P1 |
| Responsive controls | 320/390/768/1024/1440px: no overflow, 44px copy targets, full-width actions | Contact mockups / accessible adaptation | E2E | P1 |
| CMS media/copy stress | Long email and portrait replacement retain layout; new copy accepts patches | Existing CMS contract | E2E | P1 |
| Accessibility | Keyboard copy, heading/label semantics, text contrast, anchored content clears header | WCAG 2 A/AA and 2.1 AA | Axe + E2E | P1 |

Focused commands: `node --test tests/runtime/contact.test.mjs`,
`playwright test tests/e2e/contact.spec.ts --project=chromium-desktop`,
`npm run check`, `git diff --check`. Run `npm run nfr:cms` when changing the
page registry or navigation, not for this route-only visual redesign.
No external email/LINE message is sent by the tests. Production publication,
dedicated Admin form, broad E2E and cross-browser coverage are outside this pass.

## September 27 Contact Redesign

References: `ChatGPT Image Sep 27, 2026, 06_41_00 PM-1.png` (desktop) and
`ChatGPT Image Sep 27, 2026, 06_41_02 PM-2.png` (mobile).

- Preserve the shared header/footer, native destinations, clipboard behavior,
  unavailable/error states, correction deep link and CMS publication lifecycle.
- Translate the panoramic jade/gold hero, lotus dividers, two channel cards,
  three contact topics, privacy/guide strip and mobile closing invitation.
- Keep 44px touch targets and readable Thai content. The mobile page is taller
  than the scaled mockup; below 360px, topics become rows instead of tiny columns.
- Do not copy the mockup's unverified response-time guarantees. The helper strips
  describe what to send, and disappear when their contact channel is unavailable.
- The non-interactive hero quotation is reviewed against the rendered gold sky
  separately: Axe cannot resolve the negative-z image and reports contrast
  against the dark fallback instead. Other page content remains in Axe coverage.
- `contact-sunset-sanctuary-20260927.webp` is an AI-generated editorial
  illustration, not documentary place photography. It uses the existing
  `contact-hero-image` CMS slot, including alt text and focal point ownership.
- `public/assets/brand/LINE_Brand_icon.png` is the unmodified official asset from
  [LINE's brand icon download](https://www.line.me/en/logo). It is shown at 48px
  desktop/40px mobile without recoloring. The separate message icon is Lucide.

Snapshot command:

```sh
node scripts/qa/contact-snapshots.mjs "/path/to/desktop-reference.png" "/path/to/mobile-reference.png"
```

This captures the read-only local preview (default `http://127.0.0.1:4327`),
1440px/390px full pages and first viewports, reference comparisons, and provenance
in `artifacts/contact/`. Reference crops exclude most device/annotation framing;
their CSS scale is inferred. This is local evidence, not production verification.
