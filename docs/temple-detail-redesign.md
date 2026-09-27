# Temple Detail Redesign

## Scope

The supplied desktop/mobile temple-detail mockups guide composition, cream/jade/red/gold materials, medallions, botanical borders, compact travel cards, paired community panels, merit banner, and related-place imagery. The shared `TempleDetail.astro` applies to popular, sacred, and mu collection detail pages.

Shared header/footer remain unchanged. The current record image and image credit remain authoritative; a working single-image viewer replaces the mock's unsupported multi-image gallery. No fabricated photo count, favorites, notifications, plan membership, nearby ranking, or verification claim was introduced. Related places remain from the same collection.

## Preserved Contracts

- CMS identity, image overrides, highlights, coordinates, address, and visit details retain their current data owners and refresh hooks. No published content or seed data was changed.
- All admission audiences, daily opening hours, additional contacts, location metadata, route directions, operators, transfers, route numbers, and stop links remain available. Secondary information uses native disclosures.
- On mobile, the initial all-modes view shows the closest stop by the existing approximate distance data; the visible show-all button reveals every stop. Desktop initially shows up to four distinct modes.
- Photo/map dialogs support Escape, focus containment and restoration. An unchanged CMS refresh preserves the photo viewer; changed image data or an unavailable place closes it.
- Share cancellation does not copy silently; explicit copying uses the canonical URL and retains its fallback dialog.
- Empty, loading, stale, failed, and populated activity states retain existing behavior. Commerce gates remain authoritative. The merit copy keeps its existing CMS field IDs when moved into the banner.
- At 360-979px, location and visit panels share a row; below 360px they stack. Text enlargement can wrap controls without page overflow.

## Verification

- `npm run check`: 82 Astro files, zero errors/warnings/hints; 78 browser modules passed syntax/binding checks.
- `node --test tests/runtime/place-detail.test.mjs tests/runtime/managed-content.test.mjs`: 11 passed.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4391 npx playwright test tests/e2e/place-detail.spec.ts --project=chromium-desktop --grep-invert 'shared Home'`: 10 passed.
- Responsive widths: 320, 390, 768, 1024, 1440; landscape dialog 844x390; 200% text at 390px. No horizontal overflow in tested states.
- Axe WCAG A/AA scan of the detail main: no violations. The harness waits for the existing page-entry animation before measuring contrast and checks the active detail dialog instead of unrelated shared dialogs.
- Desktop 1440x1000 and mobile 390x844 full-page captures personally inspected. Reference/development comparison images and capture metadata are under `artifacts/temple-detail-redesign/`.

The visual preview uses bundled CMS fixtures, empty activities, and disabled commerce through the read-only loopback proxy, not current production content:

```sh
npm run dev -- --host 127.0.0.1 --port 4391
node scripts/qa/place-detail-preview.mjs
```

Open `http://127.0.0.1:4392/temples/popular/002-ว-ดอร-ณ-กร-งเทพมหานคร/`.

No production deploy, whole-site suite, live CMS writes, or Safari/device verification was performed for this page-scoped redesign.
