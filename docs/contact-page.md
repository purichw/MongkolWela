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
| Hero photograph | `#contact-hero-image` | `image` | Standard image fields |
| Title, intro, kicker | `#contact-title`, `#contact-intro`, `#contact-kicker` | `text` | - |
| Section heading/description | `#contact-channels-title`, `#contact-channels-intro`, `#contact-topics-title`, `#contact-topics-intro` | `text` | - |
| Channel copy | `#contact-{email,line}-{title,description,action-label}` | `text` | - |
| Topic copy | `#contact-{usage,corrections,partnerships}-{title,description,action-label}` | `text` | - |
| Email subject | `#usage a`, `#corrections a`, `#partnerships a`, `.contact-channel--email a` | `attr` | `data-email-subject` |
| Privacy note | `#contact-privacy-title`, `#contact-privacy-description` | `text` | - |
| Guide link copy | `#contact-guide-title`, `#contact-guide-description` | `text` | - |

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

Focused commands: `node --test tests/runtime/contact.test.mjs`,
`playwright test tests/e2e/contact.spec.ts --project=chromium-desktop`,
`npm run nfr:cms`, `npm run check`, `git diff --check`.
No external email/LINE message is sent by the tests. Production publication,
dedicated Admin form, broad E2E and cross-browser coverage are outside this pass.
