# Mongkol Wela Content Model

This project is moving toward an admin-editable Thai content model. The active audience is Thai users, so the site now keeps only Thai routes and Thai UI copy.

## Content Rule

Editable copy must be stored by route and page key, not hardcoded inside feature components. If another language is introduced later, it should be added as a deliberate content dimension in the admin portal instead of mixing translations into component code.

Recommended future shape:

```js
{
  locale: "th",
  route: "/calendar/",
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

- The admin portal should edit Thai content independently per feature and route.
- Routes should select content by `pageKey` and route metadata, not by hardcoded component text.
- Shared feature engines may keep formulas in JavaScript, but UI labels, empty states, button text, and interpretive copy should come from editable content data.
- New pages should not add editable prose directly inside `.astro` components. Put it in a locale content source first, then render it.

## Current Migration Note

Non-Thai routes have been removed. The next migration step should move existing Thai page shells from route files into this content source or the future admin database.
