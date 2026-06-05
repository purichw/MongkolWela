# Hora Astro

Thai-first auspicious, horoscope, calendar, and spiritual knowledge website built with Astro.

## Preview

Install dependencies and start the Astro dev server:

```sh
npm install
npm run dev
```

Then visit the local URL shown by Astro.

Useful routes:

- `/` - Thai homepage
- `/en/` - English homepage
- `/tarot/daily/` - interactive daily tarot
- `/calendar/` - Thai calendar

## Checks

```sh
npm run check
npm run build
npm run preview
```

## Structure

- `src/pages/` - Astro routes
- `src/layouts/` - page layout shells
- `src/components/` - shared header, footer, and SVG icons
- `src/config/` - shared site/navigation/page config
- `public/styles.css` - CSS entrypoint
- `public/assets/css/` - design tokens, base rules, sections, and responsive behavior
- `public/script.js` - browser interaction entrypoint
- `public/assets/js/` - feature modules
- `public/assets/images/` - local visual assets
