---
name: mockup-to-product
description: Implement mockup-led redesigns as coherent real-product experiences, preserving composition and design details while adapting layout, assets, content and responsive behavior. Use for flexible mockup adaptation, overall proportions, desktop/mobile design translation, or repeated visual rework. Not for explicit pixel-perfect reproduction or inspiration-only design.
---

# Mockup To Product

Treat the approved mockup as a design direction to realize in a working product,
not a literal screenshot to copy and not loose inspiration. Own the visual
translation and review: the user should not need to point out each missing icon,
surface treatment, alignment, mobile adjustment or lower-page section.

**Adapt the implementation; preserve the design intent.** Flexibility is not
permission to omit observable details or call a different composition complete.

## Choose This Approach

- Use this skill when the user allows judgment in dimensions, structure,
  responsive composition, real assets or content while asking for the mockup's
  overall design. Routine visual choices within that scope do not need approval.
- Explicit exact/to-a-tee/pixel-perfect requests belong to `reference-to-a-tee`.
  It also supports faithful adaptation, but this skill starts from product/design
  judgment rather than exact parity plus exceptions. Do not weaken an exact
  request by switching modes because it is difficult.
- Inspiration-only requests belong to general design direction. If intent is
  materially ambiguous, ask once; do not repeatedly ask about already-approved
  visual freedom. A reference alone does not authorize new features or a
  site-wide redesign.

Load `ui-ux-expert` when available for baseline craft. This skill owns the
adaptation method; do not automatically load an exact-reproduction workflow
merely because the input is an image. Respect explicit fidelity constraints.

## Establish A Small Design Brief

Inspect the actual selected reference and current rendered product. Accept
images, HTML or mixed references; missing HTML is not a blocker. Resolve authority
per surface when artifacts disagree. The user's latest chosen direction wins,
not a filename or modification time.

For a page, note the following once; for a small repair, a few lines suffice:

| Preserve | Translate | Adapt | Do not infer |
| --- | --- | --- | --- |
| Real journeys, data/CMS ownership, semantics, permissions, focus, scroll and responsive constraints | Hierarchy, grouping, density, proportions, image roles, icon character, material and decorative language | Dimensions, grid, breakpoints, crop, wrapping, component structure and mobile arrangement within authorized scope | New destinations, metrics, fields, backend behavior or interactions from decorative mock elements |

Name what makes this design recognizable and what the user has allowed to change.
Record only material tradeoffs. Do not require a ledger entry or approval for
every spacing adjustment. Ask before changing product meaning, removing a
capability, exceeding scope, or contradicting an explicit design decision.

Identify the product state shown, not just the route: empty versus populated,
draft versus committed, active query, selected items and open disclosures can
change the composition. Use a comparable real state for review; do not remove
required results or choices to match an illustrative screenshot's height.

## Read The Whole Requested Surface

Review at three scales before implementing, not only the first visible section:

1. **Composition:** dominant task, hierarchy, shell, section rhythm, image/text
   balance, whitespace, density, and where the page changes material or mood.
2. **Components:** footprint, image frame, title/meta/action grouping, alignment,
   orientation, proportions, text measure and neighboring relationships.
3. **Character:** icon family and optical weight, filled/outline treatment,
   translucency, borders, shadows, separators, patterns and edge decoration.

Keep a compact coverage list for a full page, including header and footer if in
scope. Record detail work still pending while building the larger structure.
Do not treat motifs or transparency as optional just because they are decorative.
Inspect the mobile reference independently; it may express a different grouping
or priority rather than smaller desktop dimensions.

## Implement With Judgment

Work from composition to component geometry to visual finish, checking both
desktop and mobile early enough to avoid rebuilding an incompatible structure.
These are priorities, not a rigid sequence or an excuse to omit finish.

- Rebuild an obstructive layout when authorized. Preserve product behavior, not
  unwanted legacy geometry. Do not broaden a visual rebuild into a data rewrite.
- Use the existing shared owner for repeated semantics/behavior. Add a variant
  when contexts differ; sharing does not mean universal dimensions. If asked to
  apply across the site, map and migrate the relevant consumers, not just Home.
  Establish shared outer widths, gutters and type roles before forcing different
  task layouts into one component. A copied override or an unused shared file
  is not consolidation. For cross-page work, read
  [shared-surfaces.md](references/shared-surfaces.md).
- Prefer the established icon library or assets. Adapt visual weight and optical
  size, not only the icon's name. Center compact controls and grouped tiles where
  the reference calls for it; do not center all prose by default.
- Treat transparent/opaque surfaces and motifs as design materials. Keep readable
  contrast, layering and non-intercepting decoration; support a solid fallback
  where transparency effects are unavailable. Do not add decoration to a utilitarian
  design that does not call for it.
- Give media independent responsive frames. Portrait sources, missing images,
  loading and CMS replacements must not inflate peer cards or consume text space.
  Reserve space for titles, badges and actions; test long real content.
- Compose mobile deliberately: information order, grouped actions, compact
  controls, safe areas, text wrapping and accessible touch areas. A small visible
  icon need not have a tiny hit target. Do not make the entire UI illegible just
  to match total screenshot height or a fixed column count.
  Reduce competing control rows and excess containers before shrinking type.
  Disclose secondary tools only with a visible path back; active queries, errors
  and the primary result must not disappear as a side effect of compactness.
- Keep internal scrolling, selected-state persistence, search, links, menu focus,
  intentional motion and keyboard behavior. Diagnose repeated animation at its
  own lifecycle instead of disabling desired motion; preserve reduced-motion
  support. A static reference cannot establish the absence of these behaviors.

Use the relevant shared-component or interaction specialist only when those
contracts are actually changing. See [rework-patterns.md](references/rework-patterns.md)
for concrete failure patterns, data substitutions and mobile examples.

## Handle Assets And Missing Data

Choose replacements by visual role: subject, focal point, light, color balance,
negative space and crop on each required viewport. A semantically related photo
with the wrong composition is not sufficient. Inspect barriers, watermarks,
unwanted clutter and the actual rendered crop before using it.

Use real product media when the subject must be accurate. Keep editorial media
in existing CMS slots when the product has them, including alt/focal point/source
metadata; do not create hard-coded competing sources. Reusable decorative brand
art may be a design-system asset instead. Preserve licenses and required credit;
a demo is not an attribution exemption. Use imagery tooling/skills as appropriate.

Separate **data differences** from **design differences**. Missing fields do not
prevent matching supported grouping, alignment and visual weight. Reflow or
rebalance truthful content; do not invent ratings, usage totals or auspicious
claims, add dead controls, or build a new backend just to fill the picture.
Prefer an existing supported equivalent when it serves the same role. A new
action is not interchangeable with a read-only fact merely because it fits the
same tile. Disclose meaningful substitutions; ask when the product decision is
material and unresolved. Do not show placeholder claims as production data.

## Review Before The User Has To

Render the changed surface and compare it with the selected reference. Separate
visual judgment from functional tests: no overflow and a green test suite do not
prove design quality. Check at actual viewing size as well as a uniform whole-page
overview when overall composition is in scope.

**Personally inspect the rendered images on both desktop and mobile every time
you assess mockup fidelity.** Capturing screenshots, receiving file paths, reading
computed styles, or sending a comparison to the user is not visual review. Open
the actual images with an image-viewing tool and examine them yourself before
asking the user to judge the result. Desktop approval cannot stand in for mobile
review, or vice versa. For a small fix, inspect the changed region and neighbors
on both sizes; do not expand that into an unrelated whole-site audit.

Use comparable framing: separate desktop and mobile reference crops, remove only
device/slide framing when needed, preserve aspect ratio, and label inferred CSS
scale. Do not put a whole desktop/phone composite beside a single desktop capture
at unequal scale and treat that as a reliable proportion check. For page-level
work, inspect top/middle/bottom at readable size as well as the full-page rhythm.

Review, identify the largest remaining visible gaps, fix the in-scope ones, then
open fresh desktop and mobile renders again. Track concrete observations such as
an oversized toolbar, displaced map, missing chevron, wrong image crop, or inflated
card body. The user should not be the first person to discover these. If the user
sets a target such as "85-90% like the mockup", treat it as a high-fidelity visual
expectation, not a calculated score or a reason to declare success with major
composition differences. Never invent a percentage from tests or your confidence.

Use five questions, not an invented numerical similarity score:

- Is the hierarchy and grouping recognizable as the selected design?
- Are density, proportions and section rhythm coherent across the requested page?
- Have the material, icon, image and decorative details been translated?
- Does mobile feel deliberately composed, readable and operable?
- Are real content, behavior and shared consumers preserved as claimed?

Fix material, in-scope gaps you can see yourself. Do not return repeated
"closer now" updates while leaving obvious details for the user to discover.
When a user reports a point defect, inspect the likely underlying pattern and
affected neighbors rather than patching that element blindly. A newly discovered
broader problem warrants scoping it, not silently redesigning unrelated routes.

Capture current contextual reference/development evidence with `snapshot` when
available, or equivalent browser tooling. For full-page work include whole-page
or top/middle/bottom coverage and the required mobile view. A tiny repair needs
only the changed area, neighbors and affected viewport(s). Label actual viewport,
state and any inferred reference scale; never stretch or retouch the reference.

Test touched behavior and risk, not every control on the site by habit. Keep
existing dependencies and a usable dev server; do not reinstall, rebuild or run
whole-site suites on each cosmetic iteration without a reason. Reuse unaffected
evidence, but refresh the changed area and any overall composition it alters.

After a component/media migration, check the rendered asset itself, not only
its wrapper: images must load and remain visible; glyphs must have visible
geometry. Exercise the changed CMS refresh/fallback or interaction path where
relevant. Build success and DOM presence cannot detect every missing visual.

## Finish Clearly

Complete the requested scope when the review questions are satisfied, relevant
checks pass and remaining material differences are explained or resolved within
the user's authority. Do not invent source measurements or claim pixel parity,
whole-site coverage, user approval or proven time savings from a local review.
If visual capture is blocked, report what remains unverified.
Likewise, distinguish "captured" from "personally visually inspected" in evidence
notes. Keep an honest record of the views inspected and material differences;
do not imply user approval or defer a known, practical visual fix to user review.

Keep the closeout brief: what was adopted/adapted, current visual proof, relevant
checks and remaining limitations. Do not carry a deep audit into the next tiny
follow-up. Commit, push, deploy and production writes require their own user
authorization; creating this skill does not grant them.
