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

## Field Synchronization Audit (2026-09-27)

The synchronization contract is source -> Admin form -> publication -> public
projection -> rendered visitor content, including explicit empty values and
removal of overrides. An empty value must not revive an older image or contact.

| Supported surface | Coverage and ownership |
| --- | --- |
| 25 registered visitor pages | Discover actual rendered field bindings, change every discovered field, clear it, then remove the override. Stable IDs and occurrence indexes remain unchanged. |
| Shared content and navigation | Header/footer copy, grouped links, device-specific labels/visibility and live refresh retain their existing separate owners. |
| Reading library | All 3,706 registered string fields across 14 groups / 268 records are checked for projection, editing, clearing and restoration. Formula inputs and record identities remain protected. |
| Place identity and descriptive fields | Name, region, province, district, coordinate address, summary, description, type, blessings, worship objects, transport labels, plus code, coordinates and image attribution use the same catalog as the visitor. |
| Place images | Card, detail hero and map each retain desktop/mobile slots. Explicit mobile clearing shows a placeholder; it does not silently use an old desktop image. |
| Visiting information | Section status, summaries, detailed values, daily timetable, review date and notice are editable and rendered. Supplementary verification references stay in the CMS audit data, not the visitor panel. Renaming a place does not change its source-data identity. |
| Collection/detail/map refresh | Text, location, rank, image changes, disabled/deleted records and removal of overrides propagate without requiring a rebuild of existing routes. Related cards refresh too. |
| Page section controls | Removing visibility/order overrides restores the original nodes and order, including removal of the page override itself. |
| Image metadata | Focal position, alt, credit, source and license fields use the same projection in Admin and visitor. Changing image source clears previous-image attribution. |
| Calendar heading | Editorial title and computed year have separate nodes so selecting a year cannot overwrite the published title. |
| Location selectors | Late geographical lookup data updates existing options without replacing the editor, closing an open province selector or losing pending edits. |

The Admin temple API previously omitted address, summary and description, and
used a different visiting-information source. Tests now call its actual catalog
projection rather than reproducing a richer mock that could conceal omissions.

Loading/error messages, runtime counts, calculation results and expand/collapse
state labels are not offered as persistent page copy. Their transient values
must not be mistaken for CMS-owned editorial fields. Activity and commerce data
still belong to their authenticated domain APIs; this audit does not merge them
into `pages[].patches`, enable services or modify production records. Media
registry metadata does not automatically replace attribution on existing content
references. New static detail routes still require a build.

Regression evidence:

- `tests/runtime/cms-field-sync.test.mjs`: real catalog, visitor/search/planner
  projections, map values, visit editing and every registered library field.
- `tests/runtime/cms-publishing.test.mjs`: real authenticated publication handler
  against an isolated database fixture, including image metadata, visiting rows,
  public projection, validation, access restrictions and stale-revision rejection.
- `tests/e2e/cms-field-sync.spec.ts`: rendered page bindings, live refresh,
  related cards, section restoration, open map updates and Admin timetable
  editing/publishing/reloading with desktop/mobile screenshots; delayed lookup
  data is also tested while the province dropdown is open.
- Existing content-coverage, freshness, navigation and temple-live browser tests
  exercise representative editor journeys and source-outage behavior.

Browser publication is fixture-backed, not a production write. These checks do
not claim a production round-trip for every field, nor immediate build-time SEO
or social-preview updates. Broader performance/SEO audits are outside this pass.

Verification completed locally: all 25 page-field cases and all library fields,
the 53-test targeted runtime suite, and targeted browser regressions for editing,
navigation, freshness, maps and collection filters. Initial failures exposed the
computed calendar/registry labels, transient status bindings and the late area
lookup race; each was corrected and rerun. Type checks and browser-script binding
checks passed, and CMS validators covered 625 source place records. The static
build produces 746 pages; Vite still reports the existing mixed JSON import
attribute warnings for the shared live-content file.

Mobile form evidence (test-only fixture):
`artifacts/cms-field-sync-20260927/admin-timetable-mobile.png`.
