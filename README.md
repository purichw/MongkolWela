# Mongkol Wela Astro

Thai-first auspicious, horoscope, calendar, tarot, and temple guide website built with Astro.

Production: https://mongkolwela.vercel.app

## Local Development

```sh
npm install
npm run dev -- --host 127.0.0.1 --port 4324
```

Then visit `http://127.0.0.1:4324/`.

Useful routes:

- `/` - Thai homepage
- `/tarot/daily/` - interactive daily tarot
- `/calendar/` - Thai calendar
- `/calendar/day/` - Thai day view
- `/horoscope/life-graph/` - life graph horoscope
- `/horoscope/seamsi/` - seamsi fortune
- `/horoscope/thai-astrology/` - Thai astrology
- `/temples/` - temple hub
- `/temples/popular/` - สายไหว้พระ 9 วัด
- `/temples/mu/` - สายมู
- `/temples/thailand/` - all-Thailand temple directory

## Checks

```sh
npm run check
npm run build
```

## Structure

- `src/pages/` - Astro routes
- `src/layouts/BaseLayout.astro` - shared document shell and cache-busted assets
- `src/components/` - shared header, footer, loading screen, and temple components
- `src/config/` - shared site config
- `src/data/` - runtime temple data, image overrides, banners, and slug helpers
- `src/scripts/` - browser interaction source modules bundled and minified by Astro
- `src/styles/site.css` - shared control and navigation styles
- `src/styles/` - design tokens, base rules, feature styles, and responsive behavior
- `public/assets/images/` - local visual assets
- `outputs/` - local generated artifacts; intentionally untracked

## Temple Data

Temple pages are data-driven from JSON files under `src/data/`:

- `popular-temples.json` for `/temples/popular/`
- `mu-temples.json` for `/temples/mu/`
- `temple-image-overrides.json` for card/detail image overrides
- `temple-page-banners.json` for page banner images

The all-Thailand temple directory source attribution is:

ระบบทะเบียนวัด สำนักงานพระพุทธศาสนาแห่งชาติ

The all-Thailand directory serves a lightweight `/assets/data/temples-thailand-index.json`
for filters and first-page preview, then loads the full
`/assets/data/temples-thailand.json` only when a full search/table result is
needed.

Do not add, delete, or modify `outputs/` unless a task explicitly asks for it.
