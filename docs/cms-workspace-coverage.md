# CMS Workspace Coverage

## Design Direction

Keep Mongkol Wela's Noto Sans Thai, public paper surfaces, jade, lacquer red and
restrained gold. Admin remains a compact operational workspace, not a visitor
landing page. The sidebar's dark jade and gold palette is explicitly unchanged.
Use one primary publish action, searchable shared dropdowns, bounded tables,
plain labeled fields, visible status and reusable content-area styling.

`admin-shared.css` scopes public brand aliases to the main workspace. The existing
Choices.js/Floating UI select controller is reused, with left-aligned Admin
values and search for longer option lists. Commerce mounts the same console
controller used by sellers; it does not duplicate the transaction API.

## Editorial Ownership

| Content | Editor | Published owner |
| --- | --- | --- |
| Page headings, body copy, labels, links and images | Page and content | Matching `pages[].patches` |
| Header/footer shared copy | Shared website content | `site.patches` |
| Navigation hierarchy, labels, destinations and visibility | Navigation | Existing `navigation` model |
| Temple identity, location, descriptive copy, images and visiting details | Temple editor | Existing `temples.records` overrides |
| 14 registered groups / 268 reading records | Reading library | Sparse `contentLibrary` overrides |
| Temple activities | Activities | Existing private per-record activity store |
| Sellers, products, campaigns, channels, memberships, orders and bookings | Embedded commerce | Existing private commerce tables |
| Media uploads and references | Existing media/temple image workflow | Configured media provider and content references |

The reading library includes 28 fortune slips, 6 fortune topics, 78 draw cards,
78 reference cards, 3 tarot intent pages, life-graph houses/bands, Thai astrology
signs/houses/planets/reading templates and palm line definitions/readings/categories.

Normal page editing scans actual rendered templates with stable field IDs and
separates global elements from `main`. Fields are searchable, grouped by section
and paginated. Images show a preview. Repeated Astro elements carry an occurrence
index; content with reorderable records should use stable domain IDs instead.
Template edits must preserve existing field IDs and verify old bindings. Do not
blindly regenerate IDs or apply an old occurrence patch to reordered records.

## Data And Safety

- Current configured CMS remains authoritative. Never publish a seed over live edits.
- Publishing sends `expectedRevision`. Server reads current content, validates
  fields and uses compare-and-set publication for Supabase/GitHub.
- A failed publication leaves form values intact. Successful publication reads
  back the saved document. Edits made while a request is pending remain drafts.
- Library updates accept registered text paths only; reject HTML, unsafe media
  URLs, unknown records and formula/identity changes.
- Shared/page patches constrain editable attributes, sanitize legacy rich HTML,
  and reject executable links. Selector errors do not crash the whole runtime.
- Page-field discovery parses an inert document without running page scripts.
- Commerce saves, inventory transitions and activities remain separate from
  the CMS document. A CMS publish never writes those stores.
- Unsaved commerce forms guard navigation; changing organization or closing a
  form must not silently discard edits. Disabled and unauthorized service states
  stay inside the central Admin shell.
- No new backend is introduced and no production feature flag is enabled.

## Deliberate Boundaries

This is not a claim that every possible website setting is already CMS-editable.
The following remain explicit engineering/operational ownership:

- Authentication policy, administrator provisioning and role permissions.
- Calculation formulas, geometric diagrams, stable identities and analytics logic.
- The official all-Thailand temple source, external calendar facts and transport
  datasets. These are not replaced by free-form editorial text.
- New collection types/routes, arbitrary new reading records and asset uploads
  outside the existing provider workflow need their own validated domain contract.
- SEO/social metadata still uses the build-time layout. A live body-copy update
  does not promise immediate changes to non-JavaScript crawlers or social previews.
- Browser drafts are not shared server drafts. The interface does not claim
  scheduled publishing, revision restore, review approval or draft-preview support.
- Existing library content is refreshed on opening/reloading tools. Active
  calculated charts are not silently recalculated against a user's unfinished form.

These boundaries must remain visible in handoff and release planning rather than
being hidden behind enabled buttons that do nothing.

## Research Basis

The current stack is retained. These sources informed the model and workflow,
not a migration to a different CMS:

- [Sanity connected content](https://www.sanity.io/docs/studio/connected-content):
  structured content and reusable references, applied as shared library records.
- [Sanity schema introduction](https://www.sanity.io/docs/apis-and-sdks/introduction-to-schemas):
  declared editable fields, applied as the content catalog and validation.
- [Strapi Draft & Publish](https://docs.strapi.io/cms/features/draft-and-publish):
  distinguish edited work from published content; do not treat Save as Publish.
- [Strapi Preview](https://docs.strapi.io/cms/features/preview): preview needs an
  explicit authenticated draft contract. The current live-site link is not labeled
  preview because that contract has not been implemented.

## Acceptance And QA Matrix

| Priority | Scenario | Expected result | Evidence |
| --- | --- | --- | --- |
| P0 | Stale or simultaneous publish | Reject 409, retain draft, no silent overwrite | Runtime real-handler fixture + browser conflict test |
| P0 | Revoked account / cross-origin mutation | Reject access before write | Existing admin auth / commerce API tests |
| P0 | Unsafe library values or patch URLs | Reject without saving | CMS publishing runtime tests |
| P1 | Page edit, publish, reload | Actual visitor text changes; child markup survives | `cms-content-coverage.spec.ts` |
| P1 | Shared footer edit | Same value on Home and another visitor route | Browser test |
| P1 | Reading edit | Current reference page and tool read the published value | Library + four-tool browser tests |
| P1 | Temple description and visiting notice | Current detail page reads the override | Browser test |
| P1 | Commerce enabled/disabled | Same Admin shell; real domain mutation or recoverable unavailable state | Browser tests with isolated API fixtures |
| P1 | Mobile layout | No document overflow; table scroll is local; controls usable | Desktop/mobile screenshots + geometry assertions |
| P1 | Sidebar identity | Computed dark jade stays `rgb(11, 56, 46)` | Browser assertion |

Browser fixtures are test-only and must never be imported by deployed endpoints
or the authenticated local preview bridge. Production content has not been
published or migrated by this work.
