# Planner Visual Refinement

Date: 2026-09-21. Local implementation, not deployed or user-approved.

## Direction And Boundaries

The user's latest feedback asks for the mockup's composition, compactness,
component proportions and small visual details, with personal visual inspection
on both desktop and mobile. A target of roughly 85-90% is a qualitative
expectation, not a similarity score measured in this work.

Preserved: the planner engine, API schema, CMS banner precedence, A/B/C workspace,
draft/committed snapshots, all route stops, 12/6 initial catalog batches, keyboard
actions, selection limits, origin validation, export and save constraints.

Translated: map-first desktop rail, smaller result summaries, compact timeline
rows, photo/text card proportions, grouped manual/automatic choices, gold/red/jade
materials and botanical decoration. The latest request authorizes geometry
changes, so the container is 1280px with a 380px rail rather than the handoff's
1220px/360px. These are route-owned sizes, not new shared defaults.

## Changes

- The workspace mode control and status share one desktop row. Mobile mode
  buttons use horizontal icon/label grouping instead of tall stacked buttons.
- The desktop route map precedes totals; the five summary metrics use restrained
  rules and whitespace instead of five separate filled boxes.
- Setup spacing, heading rhythm and action grouping are closer to the reference.
  Visible purpose pills are smaller while their hit areas remain 44px high.
- Cards use 16:9 photography, two-line name space, one-line locality and compact
  blessing labels. Full labels remain available to assistive technology and in
  titles; filter values are unchanged. No substitute place photography was added.
- Each timeline stop retains its thumbnail, name, locality, arrival/departure,
  visit duration and onward estimates. A 44px chevron opens its editing actions.
- Mobile selected-list management and supplemental guides are disclosures.
  The committed plan and every timeline stop remain visible in C mode.
- Shared Header, Footer, SiteIcon, IconMedallion, BrandOrnament and hero ownership
  remain intact; these changes do not redesign unrelated routes.

## Media

The bundled fallback for `temples.planner.banner` now uses a real gold-lit Wat Arun
photo by [Vasant Jain](https://unsplash.com/photos/wcghi5PGJcI), under the
[Unsplash License](https://unsplash.com/license). Published CMS media still wins.
The crop, dark-to-transparent overlay and existing botanical artwork are checked
on both sizes. This remains a real single-landmark photograph, not the mockup's
illustrated panorama. Asset provenance is in
`public/assets/images/planner-media-credits.txt`.

Rejected portrait candidates stay only in local `artifacts/planner-responsive/`:
SHAN LU, Unsplash `8KVnMbjkOoY`; Kamil Pietrzak, `amGksIRKrxw`; both Unsplash
License. Pexels inspection candidates: Maksim Romashkin `11104877`, Margarita K
`35981274`, Lu Zhao `16749320`, free Pexels photos. They are not runtime assets.

## Personal Visual Review

This is not just a list of screenshot files. The implementation's desktop and
mobile images were opened with the image viewer and compared against the supplied
reference, at full-page scale and readable top/middle/bottom crops. Review found
and led to a second pass on the hero blend, crowded mobile picker tools, long
badge labels and a missing disclosure glyph. The glyph's wrapper existed, but
its inner mask was 0x0 under `display:block`; `inline-grid` fixed it and a browser
test checks the actual glyph bounds.

Current capture set: `artifacts/planner-responsive/polish/`.
Comparison: `artifacts/planner-responsive/comparison.html`.

Reference crop provenance from the supplied 1312x1199 composite:

| Surface | Source crop x,y,w,h | Uniform output width |
| --- | --- | --- |
| Desktop | 55,32,910,1167 | 1440 |
| Mobile content | 1005,60,249,1135 | 390 |

These widths follow the labels on the reference, not measured source CSS.
No reference content was retouched or stretched. Unlike the earlier comparison,
desktop and mobile now have separate equal-width pairs. Full-page mobile captures
show the fixed action bar at the capture viewport's bottom; actual scrolling
still keeps it fixed to the screen.

Observed changes for the same local CMS three-stop C state:

| Viewport | Previous page height | Current page height |
| --- | --- | --- |
| 1440x900 | 2811px | 2412px |
| 390x844 | 4558px | 3564px |

These are density observations, not visual-similarity percentages. Height alone
does not prove fidelity.

## Verification And Remaining Differences

- `npm run check`: 59 Astro files, zero diagnostics; 55 browser modules checked.
- Five focused browser tests pass: replacement/reorder draft behavior, responsive
  A/B/C and search persistence, nine-stop/midnight/export boundaries, mobile
  map-failure/overlay behavior, and the new compact/disclosure contract test.
- Captured initial/A/B/C and three-stop C at 1440x900 and 390x844: no horizontal
  overflow or page errors. Responsive behavior test covers 320, 360, 390, 430,
  768, 1024, 1180 and 1440 widths.
- Skill `mockup-to-product` updated at the user's explicit request and validated.
- No new production writes, deploy, full build or unrelated-route test sweep.
  Prior full implementation evidence is in `planner-responsive-qa.md`; it is not
  represented as newly rerun evidence.

The real CMS catalog lacks many place photos and has longer names. The reference
has eight desktop / three mobile cards and hides the mobile plan; the handoff
requires twelve / six cards and an open complete timeline. Date/budget, actual
totals, state notices and accessible touch controls also remain. Thus the entire
page cannot honestly have the exact reference height. These content/contract
differences are disclosed, not used to waive geometry or detail review. No
measured 85-90% match or user approval is claimed.
