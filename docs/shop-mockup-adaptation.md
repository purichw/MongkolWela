# Shop Mockup Adaptation

Date: 2026-09-21. Route: `/shop/`. Local implementation only; no deployment.

## Design Authority

The user supplied `codex-clipboard-058796ae-7346-4279-99fa-712a9995a5f1.png`.
It shows the service-closed state, not an empty product catalog. Production was
observed displaying the closed-service message as an error with a retry button.

Preserve the large title, illustrated wooden kiosk, quiet warm status panel,
centered mobile status copy, lotus divider, pale temple/botanical frieze, three
destination cards and compact FAQ. Desktop pairs image and prose; mobile stacks
them. Shared page width, Thai font, Header/Footer, SiteIcon and LinkArrow remain
the owners of repeated site semantics. No shared shell or commerce CSS changed.

Adaptations: generated transparent artwork replaces the illustration embedded in
the reference; existing shared icon assets/library replace its painted shortcut
icons. The current shared mobile header retains search and planning actions, and
the shared footer retains its navigation. Native FAQ rows keep 44px hit areas.
At tablet widths the shortcuts stack instead of squeezing text into narrow cards.

## State Contract

| State | Expected presentation |
| --- | --- |
| Loading | Neutral status check; do not claim the service is closed |
| API `COMMERCE_DISABLED` | Illustrated waiting page; hide operational Shop controls and retry |
| Other API/network error | Error and original retry path; never masquerade as planned closure |
| Empty successful catalog | Original empty-results state, not the waiting page |
| Published catalog | Original catalog, product detail, cart and private tracking behavior |
| Disabled to enabled on refresh | Restore original operational UI without a reload |
| Repeated disabled response | Preserve FAQ DOM, expanded state and keyboard focus |
| JavaScript disabled | Truthful status-unknown fallback with working destination links |

Only the Shop availability presentation is added to `commerce-public.js`.
Merit retains its existing unavailable/retry presentation. No API, feature gate,
CMS content, commerce data, seller logic, payment handling or authentication was
changed. Local checks never submit purchases or contact production write APIs.

## Ownership

- `src/pages/shop/index.astro`: page composition, destinations, FAQ content.
- `src/styles/shop.css`: route-scoped responsive presentation.
- `src/scripts/commerce-public.js`: narrow availability-state integration.
- `public/assets/images/shop-*.webp`: alpha-preserving generated design artwork;
  provenance in `shop-media-credits.txt`.
- `scripts/qa/shop-preview.mjs`: loopback-only, read-only disabled-service fixture.
- `scripts/qa/shop-mockup.mjs`: state, responsive, accessibility and interaction QA.
- `scripts/qa/shop-comparison.mjs`: proportional reference/actual comparison sheets.

## Verification

Run against an existing Astro dev server:

```sh
SHOP_QA_URL=http://127.0.0.1:4348 node scripts/qa/shop-mockup.mjs
node scripts/qa/shop-comparison.mjs
npm run check
```

Optional user preview: `node scripts/qa/shop-preview.mjs` serves port 4354 using
Astro on 4348. Override `SHOP_PREVIEW_PORT` / `SHOP_DEV_URL` as needed. It returns
the closed-service fixture regardless of production status and rejects writes.

Latest evidence: `artifacts/shop-mockup/qa-report.json`, `actual-*.png`,
`comparison-1440.png`, `comparison-390.png`, and `actual-overview.png`.
Reference crops remove only the surrounding sheet; CSS viewport scales are
inferred as 1440px / 390px. Neither reference is stretched or retouched.

Personally inspected full-page desktop/mobile comparisons and the tablet render.
The main composition and section sequence are retained; total page height differs
because of the shared shell, real Thai font and accessible FAQ controls. No numeric
similarity score is claimed.

Passed: 1440/768/390/320 widths, no horizontal overflow or clipped headings,
decoded assets, actual Noto Sans Thai webfont, keyboard FAQ with refresh retention,
Shop-main axe WCAG A/AA, working destination routes, distinct availability states,
automatic activation, product/add-to-cart/form smoke, unchanged Merit rendering,
no-JS fallback, and no uncaught browser errors. `npm run check` passed with zero
errors/warnings. Diff checks cover the exact edited/untracked owner files.

Deferred for release: production build/deploy, full-site NFR/E2E, live order or
seller/admin tests, and production post-deploy media smoke. Those systems were
not modified in this visual task.
