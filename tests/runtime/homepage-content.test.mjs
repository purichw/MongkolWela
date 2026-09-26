import test from "node:test";
import assert from "node:assert/strict";
import { validateHomepageContent } from "../../src/lib/homepage-content.js";

const content = cards => ({ pages: [{ id: "home", homepage: { collections: { shortcuts: cards } } }] });
const card = () => ({ id: "test-1", template: 0, title: "ทดสอบ", href: "/temples/" });

test("homepage collections accept existing documents, ordering and intentional empty lists", () => {
  assert.doesNotThrow(() => validateHomepageContent({ pages: [{ id: "home" }] }));
  assert.doesNotThrow(() => validateHomepageContent(content([card()])));
  assert.doesNotThrow(() => validateHomepageContent(content([])));
});

test("homepage collection validation rejects unsafe links, duplicate IDs and oversized lists", () => {
  for (const cards of [[{ ...card(), href: "javascript:alert(1)" }], [card(), card()], Array.from({ length: 4 }, (_, index) => ({ ...card(), id: `card-${index}` })), [{ ...card(), template: -1 }], [{ ...card(), sourceUrl: "data:text/html,bad" }]]) {
    assert.throws(() => validateHomepageContent(content(cards)), error => error.statusCode === 400);
  }
  assert.throws(() => validateHomepageContent({ pages: [{ id: "contact", homepage: { collections: {} } }] }));
});
