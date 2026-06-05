# Hora Astro

Static MVP homepage for a Thai-first auspicious, horoscope, calendar, and spiritual knowledge website.

## Preview

Open `index.html` directly in a browser, or run a local static server:

```sh
python3 -m http.server 4177 --bind 127.0.0.1
```

Then visit `http://127.0.0.1:4177/`.

The English homepage is available at `http://127.0.0.1:4177/en/`.

The interactive daily tarot feature is available at `http://127.0.0.1:4177/tarot/daily/`.

## Structure

- `index.html` - homepage markup and content
- `styles.css` - CSS entrypoint
- `assets/css/` - design tokens, base rules, header, homepage sections, and responsive behavior
- `script.js` - JavaScript entrypoint
- `assets/js/` - interactive behavior
- `assets/images/` - local visual assets
