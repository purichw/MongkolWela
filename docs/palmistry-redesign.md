# Palmistry Redesign

Date: 2026-09-23. Route: `/horoscope/palmistry/`. Initial local implementation; release integration notes below. No CMS writes.

## Direction

The latest user-selected reference is `codex-clipboard-f7f9e549-3d5e-43a3-81d9-ee2d714846db.png`. It supersedes the initial interpretation based on the second full-page mockup. The hand is the primary interactive diagram beside the settings, not decorative hero art. Match the peach palm, fine colored lines, side callouts, faint circular construction, hand switch and mobile stacking. Remove the floral hand from the hero. Keep optional paired photos, line navigation, examples and readings below. The older main/minor/mount reference remains available through its existing disclosure.

Reuse `ToolsLayout`, `ToolsHero`, the existing header/footer, `SiteIcon` and `ui-markup`. Presentation is owned by the Palmistry route and its existing widget/CSS. Shared shell or CMS contracts are not changed.

## Preserved Contracts

- Existing seven line types and 45 variants, meanings and comparison rules remain unchanged.
- Handedness is explicit. Physical left/right is derived from dominant/non-dominant roles; it is not hard-coded as fate versus present.
- A photo is an optional local reference, not automatic image analysis. Camera/library input, JPG/PNG/WebP validation, 10 MB limit, drag/drop, rotation, zoom and removal are retained. No upload endpoint, AI pipeline or persistence is added.
- Main/minor/nine-mount diagrams, four line-location explanations, and all nine existing source links remain available through disclosures.
- Desktop displays the examples as equal-width compact cards. Mobile has a horizontal row and an explicit expand/collapse action; all variants remain reachable.
- Keyboard focus survives rebuilding the line/variant controls. Pressed/selected states describe the current hand only; comparisons retain both selections.
- Native file inputs now have accessible names. Photo data and selections survive switching reading modes within the existing page session.

## Intentional Adaptations

The current reading model has no basic/deep or topic-specific modes, so the mock's mode labels are not copied. Existing dominant/non-dominant/comparison controls are retained. Mobile guides use two columns rather than reducing Thai copy to the mock's tiny four-column text. An initial empty reading is shown on desktop; on mobile the result appears after a selection. No new question field or submit/analysis behavior is inferred from the first mockup.

The interactive map uses all seven existing line types, including Mercury and marriage; it does not invent finance/health line categories from the illustration. Left/right diagram buttons synchronize the existing dominant/non-dominant state, preserving compare mode when active. The asset depicts a right palm (thumb on viewer left); the opposite hand is mirrored together with its lines. Selecting a line or its keyboard-accessible callout opens that category in the existing example picker, without inventing a reading before a variant is selected. Leader geometry tracks responsive sizing. Start-reading moves focus to the examples.

## Assets

- Existing `public/images/lines/` diagrams remain the source of all selectable line examples.
- `public/assets/images/palmistry-diagram-hand.webp`: 480 x 849 transparent WebP, generated with the built-in image tool using the selected screenshot as reference. Palm only; no flowers or labels. Interactive lines and callouts are rendered separately by `PalmLineMap.astro`, with route-local styling in `palm-line-map.css`.
- `public/assets/images/palmistry-hand-lotus.webp`: superseded decorative asset, no longer used by the page. Retained on disk without deleting unrelated artifacts.
- `public/assets/icons/lucide/camera.svg`: official Lucide camera glyph from `https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/camera.svg`, using the existing local Lucide license and mask helper.

Current diagram asset prompt (built-in image tool; input is the selected screenshot):

> Use case: background-extraction / precise-object-edit. Asset type: isolated palm illustration for the interactive diagram shown in the reference. Reproduce ONLY the large center human hand illustration from the left desktop diagram in the supplied screenshot, matching its exact delicate peach watercolor/soft medical-illustration style, slender fingers, pose and proportions as closely as possible. Five fingers total, middle finger tallest, four near-upright slightly separated fingers, thumb extending diagonally to viewer left, palm facing viewer, short straight wrist extending down with a softly fading bottom edge. Preserve the source hand's natural shallow skin crease detail and thin warm peach contour. REMOVE every colored annotation line, leader line, text, button, circle/ring background and UI. NO flowers, NO leaves, NO decoration, NO halo, NO symbols, NO floating accessories. Isolated single hand with genuine transparent background everywhere outside the hand. Vertical asset, fully show fingertips and wrist, tight but uncropped framing. Natural skin creases only, no colored palmistry lines because interactive code will draw those later. This is a product illustration, not a photo; match the smooth refined original rather than making it photorealistic.

Superseded hero image prompt:

> Use case: illustration-story. Asset type: a decorative transparent-background illustration for a Thai palmistry educational web tool, not a UI mockup. One elegant upright open human palm facing the viewer, all five anatomically correct fingers visible, thumb on viewer left, fingers relaxed and naturally separated. Realistic soft peach skin, refined delicate sepia linework, a few natural subtle palm creases only (no colored diagrams, no labels). At the wrist, a low arrangement of ivory lotus blossoms and muted sage/celadon leaves, small delicate antique-gold Thai cloud curls extending to the sides. Hand is primary and much taller than the low botanical base. Style: sophisticated watercolor and botanical engraving on old ivory paper, fine pigment texture INSIDE the painted objects. Genuine transparent alpha everywhere outside the hand and plants; no background rectangle, no fake checkerboard. Warm diffuse daylight, restrained soft peach, sage green, ivory petals and fine antique gold. Square composition with ample air, complete fingertips and botanical base not cropped. No text, no symbols, no marks, no orb or halo, no gradients behind the subject, no interface, no border, no objects other than hand and botanicals. This is decorative artwork only, not a clinical or fortune-reading diagram.

## Acceptance And Verification

| Surface | Expected result | Evidence | Priority |
| --- | --- | --- | --- |
| Composition | Form above explanatory reference; 320/390/768/1024/1440 px without page overflow | Targeted Playwright, desktop/mobile captures | P1 |
| Reading | Keyboard choice, current-hand selection and two-hand comparison persist correctly | Targeted Playwright against existing reading data | P1 |
| Examples | All variants reachable on mobile, expanded/collapsed state retains choice | Targeted Playwright | P1 |
| Photos | Valid local blob preview; unsupported/oversized files rejected; edit/remove retained; no upload POST | Targeted Playwright with a local illustration fixture | P1 |
| Reference | All views and source links reachable; camera denial has recovery | Targeted Playwright with denied-camera fixture | P1 |
| Accessibility | Named controls, stable focus and no serious/critical initial-page Axe issues | Targeted Playwright | P1 |

Commands: `npm run check`, `git diff --check`, and `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4343 PLAYWRIGHT_CHROMIUM_CHANNEL=chrome npx playwright test tests/e2e/palmistry.spec.ts --project=chromium-desktop --project=chromium-mobile`.

Local browser tests intercept CMS reads with `public/admin/content/live.json`; they do not certify or modify production content. Visual proof and capture provenance are in ignored `.local/palmistry-design/`. Reference crops use inferred artwork bounds, not a claimed original CSS viewport. Captures are personally inspected, not pixel-parity or user-approval claims.

Final results: `npm run check` passed with 0 errors, 0 warnings and one pre-existing `TempleDetail.astro` hint; browser binding checks passed for 63 modules. `git diff --check` passed. All five behavior cases passed on desktop and all five passed on mobile. A combined repeat stalled during desktop browser teardown after its five cases passed; that runner was stopped and the mobile project was rerun separately, exiting successfully. The responsive geometry case also passed independently on both projects. Screenshots showed no broken images, page overflow or page errors at 1440 px and 390 px; automated layout checks covered 320, 390, 768, 1024 and 1440 px. Paired full-page reference/development captures are `comparison-desktop.png` and `comparison-mobile.png`, with reference hash and inferred crop bounds in `comparison-provenance.json`.

Not run: whole-site suite, production build/deploy, Safari, physical-device camera capture and a real permission-acceptance flow.

## Annotated Map Follow-Up

Scoped verification: initial layout/Axe at 320/390/768/1024/1440, existing reading state/focus, map callout keyboard selection, direct line click, physical-hand synchronization, compare-mode retention and start-reading focus. Current contextual desktop/mobile reference pairs are `map-comparison-desktop.png` and `map-comparison-mobile.png`; both were personally inspected. `map-proof.json` records source crops, inferred scale, local fixture, viewport and state. The screenshot-only source provides no original DOM or hand asset, so the generated hand is a close reconstruction rather than a claim of identical pixels. Existing reading vocabulary, handedness semantics and 44px mobile controls are retained intentionally.

Follow-up results: six targeted desktop/mobile cases passed across the final runs, along with `npm run check` (66 files; one existing TempleDetail hint) and `git diff --check`. Direct path testing uses a rendered point on the actual curve instead of the SVG bounding-box center, which can lie off the path or on an intersecting line. No broad suite or publishing was performed for this correction.

## Release Integration

The release is based on published `e927fc2`, not the earlier design checkout.
It preserves that commit's removal of the public source list, method section
and generated line-guide copy. The interactive reference diagram and all seven
line categories remain. The corresponding focused test now asserts these
published sections stay absent while still testing reference views and camera
denial. Earlier preservation notes describe the pre-integration implementation.
Superseded floral-hand and trial error artwork/font assets are not shipped.
