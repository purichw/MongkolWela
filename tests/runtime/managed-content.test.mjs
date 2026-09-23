import test from "node:test";
import assert from "node:assert/strict";
import { contentCatalog, validateContentLibrary, libraryForPath } from "../../src/data/content-catalog.js";
import { applyContentLibrary } from "../../src/lib/managed-content.js";
import { seamsiFortunes } from "../../src/scripts/seamsi-data.js";
import { planetMeanings } from "../../src/scripts/thai-astrology-data.js";
import { updateVisitContent } from "../../src/scripts/admin/visit-content.js";
import { renderVisit, createPlaceModel } from "../../src/lib/place-detail-view.js";
import { renderCardFace, renderSingleReading } from "../../src/scripts/tarot-view.js";

test("managed strings retain object identity, support clearing and restore seeds without changing calculations", () => {
  const fortune = seamsiFortunes[0];
  const title = fortune.title;
  const speed = planetMeanings[0].speed;
  try {
    const library = { "seamsi.seamsiFortunes": { "1": { title: "CMS title", advice: "" } }, "thaiAstrology.planetMeanings": { sun: { role: "CMS role" } } };
    validateContentLibrary(library);
    applyContentLibrary(library);
    assert.equal(seamsiFortunes[0], fortune);
    assert.equal(fortune.title, "CMS title");
    assert.equal(fortune.advice, "");
    assert.equal(planetMeanings[0].speed, speed);
    assert.equal(planetMeanings[0].role, "CMS role");
    assert.deepEqual(Object.keys(libraryForPath(library, "/horoscope/seamsi/")), ["seamsi.seamsiFortunes"]);
  } finally { applyContentLibrary({}); }
  assert.equal(fortune.title, title);
  assert.ok(fortune.advice.length);
});

test("catalog rejects unknown fields, formulas, prototype keys, HTML and unsafe media URLs", () => {
  for (const library of [
    { unknown: {} },
    { "thaiAstrology.planetMeanings": { sun: { speed: "999" } } },
    { "tarot.tarotIntentTopics": { "0": { storageKey: "changed" } } },
    { "seamsi.seamsiFortunes": { "1": { title: "<img onerror=alert(1)>" } } },
    { "tarot.tarotCards": { "the-fool": { image: "javascript:alert(1)" } } },
    { "tarot.tarotCards": { "the-fool": { image: '/image.jpg" onerror="alert(1)' } } },
    JSON.parse('{"seamsi.seamsiFortunes":{"__proto__":{"title":"bad"}}}'),
  ]) assert.throws(() => validateContentLibrary(library), { statusCode: 400 });
  assert.ok(contentCatalog().every(group => group.records.every(record => record.fields.every(field => !field.path.endsWith("/speed")))));
});

test("CMS card text cannot inject attributes or HTML in readings", () => {
  const card = { id: "the-fool", name: '" onload="evil', thName: '<img src=x onerror=evil>', image: "/card.jpg", theme: "<script>evil</script>" };
  assert.doesNotMatch(renderCardFace(card), /alt="<img/);
  assert.match(renderCardFace(card), /&quot; onload=&quot;evil/);
  assert.doesNotMatch(renderSingleReading(card), /<script>/);
});

test("visit form preserves detail indices and sources and renders only explicitly verified content", () => {
  const record = { visitInfo: { hours: { status: "verified", regular: "09:00", closed: "Monday" }, sources: [{ id: "existing", url: "https://example.test" }] } };
  const edit = {};
  updateVisitContent(edit, record, "hours/details/0", "");
  updateVisitContent(edit, record, "hours/details/1", "10:00");
  assert.equal(edit.visitInfo.hours.details[0].value, "");
  assert.equal(edit.visitInfo.hours.details[1].term, "วันหยุด");
  assert.equal(edit.visitInfo.hours.details[1].value, "10:00");
  updateVisitContent(edit, record, "sourceLabel", "New source");
  updateVisitContent(edit, record, "sourceUrl", "https://new.example.test");
  assert.equal(edit.visitInfo.sources[0].id, "existing");
  const model = createPlaceModel({ record: { name: "Temple" }, visit: record.visitInfo }, edit);
  assert.match(renderVisit(model), /10:00/);
  updateVisitContent(edit, record, "hours/status", "unknown");
  assert.doesNotMatch(renderVisit(createPlaceModel({ record: {}, visit: {} }, edit)), /10:00/);
});
