# Mapped Thailand Directory

## Scope And Evidence

`/temples/thailand/` now lists navigable places, not the 44,705-row registry.
After explicit approval on 2026-10-16, 3,389 proposed rows were removed and 41,316
retained with unchanged metadata. The geographic index uses a separate area-only
snapshot, preserving the original CMS address choices. The cleanup receipt is
`docs/thailand-registry-cleanup.json`. Never treat failure to match a source as
proof a temple does not exist.

The three curated collections are protected inputs: Popular (243), Sacred (217)
and Mu (165). All 625 collection memberships remain represented by 378 unique
planner IDs in the nationwide directory; their source files, slugs and content
are not changed by this import. Published CMS visibility still applies.

The 2026-10-14 Geofabrik Thailand OSM extract supplies 7,721 named Buddhist
places across all 77 provinces. After 181 unique matches to curated places,
the baseline contains 7,918 distinct records before manual CMS additions.
The previous 161-place/38-province baseline is superseded. All-province coverage
does not mean every temple in Thailand is included or that every entrance is
suitable for navigation.

`scripts/import-thailand-osm.py` uses pyosmium and Shapely to read public OSM
nodes/areas and administrative province boundaries locally. It rejects unnamed,
generic, explicitly inactive/private and ambiguous-province candidates. Same-name
nodes/areas within 200 metres are deduplicated; geometry/source IDs and rejection
decisions remain in the provenance artifact. `scripts/build-thailand-directory.mjs`
matches curated aliases by name, province and distance, keeping ambiguous matches
for review. No per-temple Nominatim scraping or paid Google API is used.

`scripts/import-watportal-directory.py` caches the public paginated Watportal
index and optional detail/category facts at a bounded request rate. Only a
complete, count-checked, duplicate-free index can inform the deletion proposal.
An indexed listing is not a fetched detail page, mapped destination, government
verification or permission to reuse its photos/articles. Detail coverage and
source counts are recorded in `thailand-directory-metadata.json`, not implied
by the index count. Research mentions from tourism sites supplement provenance;
they do not establish sect, legal status or current opening hours.

Sources and constraints:
- https://operations.osmfoundation.org/policies/nominatim/
- https://www.openstreetmap.org/copyright (ODbL; public attribution retained)
- https://download.geofabrik.de/asia/thailand.html (dated national extract)
- https://www.watportal.com/ (public listing and labelled facts)
- https://developers.google.com/maps/documentation/urls/get-started (outbound
  Maps URLs need no API key; they are not a POI verification service)

## Data Flow

The existing Admin catalog adds `thailandAdminCatalog(content)`. Editors use the
shared place drawer in compact mode; manual entries need a name and coordinates
or Plus Code. No birth of a second form or write API. The existing publish API
keeps authentication, revision conflicts and atomic publication safeguards.
The shared validator runs client and server side. Old malformed directory rows
are excluded from public output and must be corrected before publication.

Public `/api/admin/content?path=/temples/thailand/` returns `directoryPage`
derived from the current CMS. It does not ship the 44k registry or full temple
records. Initial load waits for that authoritative response; failure renders a
retry state, never a seed fallback. Search and pagination use the same endpoint's
`view=directory` projection, 24 records per page. Append requests include the
dataset/CMS revision; a changed revision returns 409 and refreshes the list rather
than mixing versions. Home and temple hub counts use the same published directory.

Curated directory keys are `thailand:<plannerId>`, OSM-only keys are
`thailand:osm:<elementType>/<elementId>`, and manual keys are
`thailand:admin-<timestamp>`. Overrides are stored in `temples.records` and
`temples.order.thailand`. Explicit field/image clears are preserved. Soft-deleted
directory records are excluded. An OSM override is not resurrected when all of
its curated sources are hidden. Coordinates edited by an operator are labelled
as team-supplied rather than attributed to OSM. Image credits remain separate.
Curated detail slugs, aliases and sitemap handling are unchanged.

Authenticated `/api/admin/temples` pages the existing rich curated catalog in
batches of 125 with a consistent revision. Its first page supplies a compact
directory descriptor; the CMS loads the versioned static OSM snapshot separately.
This avoids the serverless response limit while reusing the shared place editor.
Visitors never download this full snapshot or its metadata to search.

## Metadata Preservation

`src/lib/place-metadata.js` keeps raw source fields plus extensible assertions:
`facet`, `value`, source field, provider, URL, retrieval date and evidence kind.
No single category is forced on a place. Relevant facets include:

- Sect/tradition and legal/registration status, including ordination boundaries.
- Forest/meditation practice and lineage, when a source explicitly states them.
- Visitor use, architecture, landmarks, museums, caves and cultural activities.
- Opening hours, access, wheelchair facilities, fees and contact/reference IDs.
- Original curated type, blessing and membership in each protected collection.

Unknown labels stay in `sources[].fields`; missing values stay unknown. A temple
name containing a forest/cave/royal word is not evidence of a formal category.
Tourism-source mentions and first-party statements remain distinguishable.
Conflicting source assertions are retained separately for later review.

Conservative name/province/district matching enriches mapped places with original
registry metadata before any proposed cleanup. Ambiguous matches remain in
`artifacts/directory-places/metadata-review.json`. The CMS merges hidden metadata
with the base data when editing; changing visible fields cannot silently erase
newer source facts. Metadata is not yet an exposed public filter/editor UI.

`scripts/reconcile-thailand-directory.mjs` writes the enrichment snapshot and,
only after a complete Watportal index, `deletion-proposal.json`. The proposal is
not an execution script. Before approved removal, extract the shared Admin
province/district/subdistrict lookup and update legacy-index consumers/tests.
Deletion scope must explicitly distinguish working files from Git history,
remote deployments and backups; none of those are purged in this implementation.

## Verification

Acceptance criteria: one shared compact editor; complete and validated location
before publication; same result after reload; current CMS is authoritative;
hidden/removed records stay absent; navigation uses the entered destination;
no 44k-registry request; desktop/mobile layouts remain usable.

| Scenario | Expected result | Evidence | Priority |
| --- | --- | --- | --- |
| Create, cancel, save, restore draft, publish | Existing CMS lifecycle; no phantom or lost record | Real-handler browser fixture | P0 |
| Invalid coordinate/Plus Code, anonymous write, stale revision | 400/401/409; no write | Runtime and API/browser tests | P0 |
| Public search, paging, Maps destination, home counts | Published values and matching counts | Runtime and desktop/mobile browser | P0 |
| CMS outage, hidden source, removal | Error/retry or absence; no registry fallback | Runtime and real-handler fixture | P0 |
| Existing rich editor and curated routes | Original fields/media/cancel/slugs preserved | Shared-editor regression and slug runtime tests | P0 |
| Responsive forms and cards | No overflow; visible focus and controls | Desktop/mobile screenshots and scoped axe | P1 |

- Runtime: `tests/runtime/directory-places.test.mjs` and `temple-slugs.test.mjs`.
- Browser/API: `tests/e2e/temple-thailand-directory.spec.ts`, using real handlers
  and a loopback-only test database/auth fixture, plus the existing shared-editor
  regression suite.
- Evidence: `artifacts/directory-places/` (local desktop/mobile, synthetic CMS
  entry explicitly marked as test data; no production writes).

Not covered: every Watportal detail page, exhaustive tourism-site research,
visiting-hour verification, external Google routing accuracy, real media-provider
uploads, approved permanent deletion or deployment. The free
outbound link opens a coordinate destination; it does not guarantee a suitable
vehicle entrance. Check the entrance and opening hours before travel.
