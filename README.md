# Mongkol Wela Astro

Thai-first auspicious, horoscope, calendar, tarot, and temple guide website built with Astro.

Production: [Mongkol Wela](https://mongkolwela.vercel.app)

## Documentation

- [Architecture](Architecture.md): routes, source ownership, CMS authority and Astro/Vercel output.
- [CMS](CMS.md): supported fields, draft/publication contracts and Visitor synchronization.
- [Roadmap](Roadmap.md): dated release evidence, pending work and product decisions.
- [CMS workspace coverage](docs/cms-workspace-coverage.md): homepage, navigation, shared copy, reading library and commerce owners.
- Admin references: [places](docs/admin-temple-list.md), [place editor](docs/admin-place-editor.md), [activities](docs/admin-activities-redesign.md), [media](docs/admin-media-library.md), [analytics](docs/admin-analytics-redesign.md).
- Visitor references: [shared UI](docs/shared-ui.md), [place details](docs/temple-detail-redesign.md), [travel guide](docs/travel-guide.md), [contact](docs/contact-page.md).
- [Temple URL slugs](docs/temple-slugs.md): automatic/custom English URLs, stable IDs, aliases and release verification.
- [Tarot experience](docs/tarot-redesign.md) and [78-card Deep Research prompt](docs/research/tarot-78-deep-research-prompt.md). The latter is a research brief, not completed research or imported CMS data.
- [Tarot editorial integration](docs/tarot-editorial-integration.md): the 2026-10-15 delivered bundle, 78 cards/468 contexts, CMS ownership, preserved fields and local QA.

Use the checkout already selected for the current task; do not switch from a
worktree to the primary checkout just because a document mentions its path.

## Local Development

```sh
npm install
npm run dev -- --host 127.0.0.1 --port 4324
```

Then visit `http://127.0.0.1:4324/`.

Useful routes:

- `/` - Thai homepage
- `/tarot/daily/` - interactive daily tarot
- `/tarot/monthly/`, `/tarot/love/`, `/tarot/money/`, `/tarot/career/`, `/tarot/luck/` - contextual readings
- `/tarot/meanings/` - 78-card meanings library
- `/calendar/` - Thai calendar
- `/calendar/day/` - Thai day view
- `/horoscope/life-graph/` - life graph horoscope
- `/horoscope/seamsi/` - seamsi fortune
- `/horoscope/thai-astrology/` - Thai astrology
- `/temples/` - temple hub
- `/temples/popular/` - วัดดังน่าไป
- `/temples/mu/` - พิกัดสายมู
- `/temples/sacred/` - วัดเด่นขอพร
- `/temples/thailand/` - all-Thailand temple directory
- `/admin/` - Admin Portal

## Checks

```sh
npm run check
npm run build
```

## Structure

- `src/pages/` - Astro routes
- `src/layouts/BaseLayout.astro` - shared document shell and content-hashed assets
- `src/components/` - shared header, footer, loading screen, and temple components
- `src/config/` - shared site config
- `src/data/` - runtime temple data, image overrides, banners, and slug helpers
- `src/scripts/` - browser interaction source modules bundled and minified by Astro
- `src/styles/site.css` - shared control and navigation styles
- `src/styles/` - design tokens, base rules, feature styles, and responsive behavior
- `public/assets/images/` - local visual assets
- `outputs/` - local generated artifacts; intentionally untracked

## Temple Data

Curated temple collections use base JSON under `src/data/`, merged with the
authoritative live CMS through `src/data/temple-cms.js`:

- `popular-temples.json` for `/temples/popular/`
- `mu-temples.json` for `/temples/mu/`
- `sacred-temples.json` for `/temples/sacred/`
- `temple-image-overrides.json` for card/detail image overrides
- `temple-page-banners.json` for page banner images

Place details and the sitemap render on demand. Public slugs can change without
changing CMS/planner identity; old URLs redirect. Bundled CMS JSON is bootstrap
data, not a production fallback. See [CMS](CMS.md) before changing live content.

The all-Thailand temple directory source attribution is:

ระบบทะเบียนวัด สำนักงานพระพุทธศาสนาแห่งชาติ

The all-Thailand directory serves a lightweight `/assets/data/temples-thailand-index.json`
for filters and first-page preview, then loads the full
`/assets/data/temples-thailand.json` only when a full search/table result is
needed.

Do not add, delete, or modify `outputs/` unless a task explicitly asks for it.
