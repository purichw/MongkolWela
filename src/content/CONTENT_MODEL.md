# Mongkol Wela Content Model

This project is moving toward an admin-editable, multilingual content model.

## Locale Rule

Editable copy must be stored per locale and per route. Thai and English content must not share one field that is translated inside a component.

Recommended future shape:

```js
{
  locale: "th" | "en",
  route: "/calendar/" | "/en/calendar/",
  pageKey: "calendar",
  title: "...",
  description: "...",
  sections: [
    {
      id: "hero",
      type: "hero",
      fields: {
        eyebrow: "...",
        heading: "...",
        body: "..."
      }
    }
  ]
}
```

## Admin Portal Contract

- The admin portal should edit Thai and English content independently.
- Routes should select content by `locale + pageKey`, not by hardcoded component text.
- Shared feature engines may keep formulas in JavaScript, but UI labels, empty states, button text, and interpretive copy should come from locale-aware content data.
- New pages should not add editable prose directly inside `.astro` components. Put it in a locale content source first, then render it.

## Current Migration Note

The English route parity work adds real `/en/...` paths for active features first. The next migration step should move existing Thai and English page shells from route files into this content source or the future admin database.
