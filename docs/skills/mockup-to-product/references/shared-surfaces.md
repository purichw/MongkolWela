# Shared Surfaces Without Flattening The Product

Read for authorized cross-page alignment or shared-component migration, not for
every local visual edit. Use the shared-component specialist for API/extraction
details; this reference covers the visual lessons from mockup-led consolidation.

## Separate The Layers

| Layer | Share when appropriate | Keep locally owned |
| --- | --- | --- |
| Site frame | Outer content width, responsive gutters, title roles, header/footer alignment | Reading measure, form width, charts, maps and internal grids |
| Editorial banner | Media frame, shade, motifs, copy alignment and responsive anatomy | Content, image source/focal point, CMS identity, links and optional sections |
| Photo card | Stable media/text/action anatomy for the same task | Selection or navigation semantics, data adapter and feature state |
| Primitive | Icon rendering, medallion, arrow, control material | Page spacing, grid placement and domain behavior |

Use the project's approved values; do not import a previous project's maximum
width, colors, column count or decorative language. Align outer edges across
header, content and footer, but do not apply outer gutter calculations again
inside already-constrained containers. Full-bleed bands can contain aligned
inner content without becoming floating cards.

A Home carousel, a place gallery and an interactive tool header may share tokens
without becoming one banner. Public editorial pages and operational workspaces
may have intentionally different shells. Name exclusions instead of silently
forcing them together or claiming universal adoption.

## Migrate The Actual Owners

For substantial consolidation, record a small owner-to-consumer map including
responsive variants, runtime-rendered markup and CMS replacement paths. Look for
existing route branches and active overrides before extracting. One shared file
is not enough if old copies or competing width rules still render.

Choose the smallest unit that removes a real reason for drift. Prefer composition
or a meaningful variant to route-name conditionals. Keep data fetching, selection
state and event delegation with their feature owner when extracting presentation.
Preserve stable IDs, accessible names, hooks and safe text/URL handling.

Keep editorial image sources in their existing adapters. Verify that props used
for business identity do not collide with framework composition attributes. One
observed Astro failure used `slot` both as a CMS image identifier and a named slot;
the image disappeared after nesting even though the build passed. A distinct
identity prop such as `mediaId` preserved both contracts. This is a reason to
inspect framework boundaries, not a universal prop-naming rule.

Retire superseded in-scope rules rather than stacking permanent overrides.
Preserve unrelated work and necessary variants. Leave a concise ownership note
in existing project documentation so the next edit reaches the same owner.

## Preserve The Visual Hierarchy

After changing the shared title scale or width, recheck neighboring section
headings, cards and actions. A correct new H1 can make an unchanged H2 dominate;
a narrower frame can turn a compact toolbar into several rows. Sharing tokens
does not by itself preserve hierarchy.

Do not let optional long forms dictate every banner's height. Put a task panel
beside or below the shared editorial region when that fits the approved design;
do not impose that arrangement when the reference intentionally integrates it.
Reserve room for quotes, controls and imagery so real long copy does not overlap
them. Test the actual crop after changes to the shared frame, not just the source
photo or its focal-point value.

## Verify At The Changed Boundary

For a shared-shell change, sample each affected template family and meaningful
variant on desktop and mobile, with narrow/intermediate widths at changed
breakpoints. A local component repair needs its affected consumers, not this
whole-site matrix. State the coverage and stop once the touched risks are covered.

Use three distinct forms of evidence:

- **Rendered visuals:** personally inspect aligned page edges, hierarchy, crop,
  density, material and decoration. Contact sheets help cross-page comparison;
  readable-size crops are still needed for controls, text and glyphs.
- **Asset integrity:** check decoded, visible images and nonzero visible glyph
  geometry. An existing wrapper, successful image request or passing build is
  insufficient. Inspect refresh/fallback only where the changed path warrants it.
- **Behavior:** exercise touched menus/disclosures, selection and focus, active
  queries, and CMS updates without production writes. Keep prior product state
  intact through responsive and runtime rerenders.

Label viewport, route, state, data fixture and any inferred reference scale.
Refresh evidence for changed regions; do not pass off stale captures as the
final state. Before/after implementations should use comparable data. If the
reference is illustrative, disclose that difference without excusing avoidable
geometry or visual omissions. Distinguish template-family samples from every
generated URL, and visual review from full business-flow or production testing.
