# Seamsi Redesign

Date: 2026-09-23. Scope: `/horoscope/seamsi/` only. Local implementation, not a production release.

## Direction And Boundaries

- Adapt the supplied desktop/mobile Kau Chim mockups: ivory paper, jade headings, gold details, lacquer cup, lotus artwork, compact input rail and reading stage.
- Reuse `ToolsLayout`, `ToolsHero`, `SiteIcon`, the public dropdown and the existing header/footer. The mock's alternate mobile header is deliberately not forked.
- Desktop: form beside the cup/result; mobile: form, cup, result, prayer, guidance.
- Preserve six categories, 28 existing fortunes, the random draw, all four reading fields, optional question, reset and contact destination.
- The question is a reflection note, not an AI interpretation. It is escaped on output and is not stored. Only the last slip number is stored, with an in-memory fallback if storage is blocked.
- Both draw controls use guarded `aria-disabled` while busy, preserving focus; form fields are temporarily disabled. The result receives keyboard focus only while focus remains on the operation's trigger/skip control. Reduced motion skips shake/drop and smooth scroll.
- No live CMS, navigation, temple pages, auth, fortune data, or shared styles are changed.

## Generated Assets

Both assets were made with the built-in `image_gen` tool, not the CLI/API fallback, then resized and encoded as alpha-preserving WebP. These are decorative illustrations, not photographs of a real temple's ritual objects.

### `public/assets/images/seamsi-fortune-cup.webp`

640 x 960, approximately 114 KiB. Final generation prompt:

> Use case: stylized-concept. Create a production web illustration asset, NOT a UI mockup. A single traditional Thai-Chinese kau chim fortune-stick cylinder standing upright, centered, full object visible, on genuinely transparent background. Slender dark reddish-brown lacquered wood cylinder with finely detailed natural wood grain, narrow golden brass rim and base, one elegant gold outlined lotus emblem on the front, and a round gold medallion with the single Chinese character 籤. Ten pale bamboo fortune sticks extend out from the open top in a gently irregular fan, each rounded on top with a small dark red 吉 character. Warm soft studio light from upper left. Refined hand-painted watercolor mixed with precise botanical book illustration, tangible wood and bamboo, no cartoon, no plastic 3D look. Cylinder at very slight three-quarter angle, front emblem facing viewer. Rich restrained lacquer red, antique gold and honey bamboo. Transparent alpha everywhere around the object, including under base. Isolated cup and sticks only: NO lotus plants, clouds, temple, frame, surface, background, shadow rectangle, gradients, watermark, labels, lettering apart from specified Chinese marks. Tall portrait composition, object fills 88% of height with a little breathing room.

### `public/assets/images/seamsi-lotus-watercolor.webp`

960 x 640, approximately 126 KiB. Final generation prompt:

> Use case: illustration-story. Production illustration asset for a refined Thai spiritual reflection website. A low, wide botanical arrangement of two ivory lotus blossoms and one pale blush lotus bud among softly layered sage-green and celadon lotus leaves, with very delicate antique-gold linework and just a few pale Thai cloud curls behind. Traditional East Asian ink wash meets detailed botanical watercolor on genuinely transparent background. Graceful airy asymmetrical composition: largest lotus at center-right, small leaves spreading lower left and lower right, flat base, lots of transparent negative space above. Horizontal aspect ratio 3:2, entire arrangement fits inside canvas without clipped edges. Fine visible petal lines and paper-grain pigment inside painted shapes. Desaturated sage leaves, offwhite cream petals, quiet gold contour accents. Calm warm daylight, elegant and understated, no saturated colors. Isolated botanical arrangement only, no scenery, no cup or fortune sticks, no people, no text, no lettering, no seal, no circles or orbs, no border or frame. Real alpha transparency, not an ivory rectangle or checkerboard.

## Behavior Addendum

The supplied `MONGKOLWELA_SEAMSI_PROMPT_AND_SPEC.md` governs behavior for this pass, not a second UI redesign.

- `src/lib/seamsi-session.js` owns immutable submitted intent, operation identity, one-shot selection/commit, last result and recoverable reading. The route script owns DOM, focus, timers and lifecycle cleanup.
- One accepted form/cup activation selects once. Repeated activations while busy, animation callbacks, skip and changing reduced-motion preferences cannot select again. The visual watchdog finishes at 1100 ms, independently of content availability.
- After reveal, the cup reads the same slip and the form offers a new question. Rearming keeps the topic and prior reading, clears only the question and focuses it. Editing draft fields never relabels or erases the previous reading.
- Reading recovery retains the selected identity and its original question/topic, even if the draft changes. A failed new operation preserves the last committed reading. Empty/invalid corpus has a distinct unavailable state.
- Existing source is a local array of 28 fortunes and six categories, not a remote service. No endpoint, remote idempotency mechanism, cloud history or network timeout is invented. Number is the identity within this single corpus. The existing no-consecutive-repeat selection policy is preserved.
- The current source has no topic-specific readings. Render original fields without the former generic appended topic sentence; explain this limitation for non-overview topics. Preserve line breaks and optional-field semantics, escape source and user text, and place the belief-based limitation near the result.
- Question text stays in page memory and the result only. Only the previous number uses optional local storage. Artwork failure cannot block drawing; navigation disposes listeners/timers and invalidates late callbacks.

## Verification

- `node --test tests/runtime/seamsi-session.test.mjs`: 11 passing tests for exact selection/commit counts, delayed content, skip, rearm, dirty drafts, same-record retries, malformed content/identity, stale disposal callbacks, unavailable corpus and blocked storage.
- `npm run check`: zero errors/warnings; one existing `TempleDetail.astro` inline-script hint; browser binding checks passed.
- Targeted Playwright: 16 passing cases across Chrome desktop/mobile, including art failure, lifecycle remount, recovery fixtures, empty corpus and invalid input. Error/corpus fixtures are synthetic and browser-intercepted only, never seeded into CMS or production.

`tests/e2e/seamsi.spec.ts`: responsive order/overflow at 320, 390, 768, 1024 and 1491 px; decoded artwork; custom category selection; question escaping; repeated submission guard; keyboard draw/reset and focus; nonrepeating slips; all reading fields; reduced motion; unavailable storage; serious/critical accessibility checks in empty and reading states.

The targeted suite runs in Chrome desktop and mobile. Local browser checks use a read-only intercepted CMS fixture from `public/admin/content/live.json`; they do not alter or certify production CMS content. Full-site regressions, Safari and production smoke are deferred until release.
