import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { contentCatalog, validateContentLibrary, libraryForPath } from "../../src/data/content-catalog.js";
import { applyContentLibrary } from "../../src/lib/managed-content.js";
import { tarotCards } from "../../src/scripts/tarot-data.js";
import { tarotMeaningCards } from "../../src/data/tarot-meanings.js";
import { readingForContext } from "../../src/data/tarot-editorial.js";
import { monthlyPositions } from "../../src/data/tarot-monthly-positions.js";
import { renderMonthlyCard, renderSingleReading } from "../../src/scripts/tarot-view.js";

const archive = new URL("../../docs/research/tarot-editorial-v1/", import.meta.url);
const research = readFileSync(new URL("card-content.ndjson", archive), "utf8").trim().split("\n").map(JSON.parse);

test("delivered evidence stays intact and all 78 IDs and 468 contexts reach runtime", () => {
  for (const line of readFileSync(new URL("checksums.sha256", archive), "utf8").trim().split("\n")) {
    const [hash, file] = line.split("  ");
    assert.equal(createHash("sha256").update(readFileSync(new URL(file, archive))).digest("hex"), hash, file);
  }
  assert.equal(research.length, 78);
  assert.deepEqual(tarotCards.map(card => card.id), research.map(card => card.legacy_id));
  assert.deepEqual(tarotMeaningCards.map(card => card.id), tarotCards.map(card => card.id));
  for (const source of research) {
    const card = tarotCards.find(card => card.id === source.legacy_id);
    const meaning = tarotMeaningCards.find(card => card.id === source.legacy_id);
    for (const [context, values] of Object.entries(source.contexts)) {
      const reading = readingForContext(card, context);
      for (const field of ["reading", "advice", "caution"]) assert.equal(reading[field], values[field], `${card.id}/${context}/${field}`);
    }
    assert.equal(meaning.upright, source.upright);
    assert.equal(meaning.reversed, source.reversed);
    assert.equal(meaning.uprightDetails.career, source.contexts.career.reading);
    assert.equal(meaning.uprightDetails.finance, source.contexts.money.reading);
    assert.equal(meaning.love, source.contexts.love.reading);
    assert.ok(meaning.relatedCards.some(item => item.card_id === source.differentiation[0].legacy_id));
  }
});

test("all result fields and monthly positions are exposed to the route-scoped CMS", () => {
  const groups = contentCatalog();
  const catalog = groups.find(group => group.key === "tarot.tarotCards");
  for (const card of catalog.records) {
    const paths = new Set(card.fields.map(field => field.path));
    for (const path of ["interpretation", "advice", "caution"]) assert.ok(paths.has(path));
    for (const context of ["monthly", "love", "money", "career", "luck"])
      for (const field of ["reading", "advice", "caution"]) assert.ok(paths.has(`contexts/${context}/${field}`));
    assert.equal(paths.has("id"), false);
    assert.equal(paths.has("contexts/daily/reading"), false, "Daily must keep its original override paths");
  }
  assert.equal(groups.find(group => group.key === "tarot.monthlyPositions").records.length, 10);
  const library = { "tarot.tarotCards": {}, "tarot.tarotMeaningCards": {}, "tarot.monthlyPositions": {} };
  assert.deepEqual(Object.keys(libraryForPath(library, "/tarot/monthly/result/")), ["tarot.tarotCards", "tarot.monthlyPositions"]);
  assert.deepEqual(Object.keys(libraryForPath(library, "/tarot/meanings/the-fool/")), ["tarot.tarotCards", "tarot.tarotMeaningCards"]);
});

test("published edits and explicit clears win over imported seeds, without changing identity or artwork", () => {
  const card = tarotCards[0], meaning = tarotMeaningCards[0];
  const identity = { id: card.id, name: card.name, thName: card.thName, image: card.image };
  const original = readingForContext(card, "love").reading;
  const library = {
    "tarot.tarotCards": { [card.id]: { interpretation: "คำอ่านรายวันจาก CMS", advice: "", "contexts/love/reading": "คำอ่านความรักที่เผยแพร่", "contexts/love/advice": "", "contexts/monthly/reading": "คำอ่านรายเดือนที่เผยแพร่" } },
    "tarot.tarotMeaningCards": { [card.id]: { upright: "ความหมายที่เผยแพร่", "uprightDetails/career": "งานที่แก้ผ่าน CMS", "symbolism/3/meaning": "สัญลักษณ์เดิมที่ยังแก้ไขได้" } },
    "tarot.monthlyPositions": { challenge: { advice: "คำถามตำแหน่งจาก CMS" } },
  };
  try {
    validateContentLibrary(library);
    applyContentLibrary(library);
    assert.equal(tarotCards[0], card);
    assert.deepEqual({ id: card.id, name: card.name, thName: card.thName, image: card.image }, identity);
    assert.equal(readingForContext(card).reading, "คำอ่านรายวันจาก CMS");
    assert.equal(readingForContext(card).advice, "");
    assert.equal(readingForContext(card, "love").advice, "");
    assert.match(renderSingleReading(card, readingForContext(card, "love")), /คำอ่านความรักที่เผยแพร่/);
    const monthly = renderMonthlyCard(card, monthlyPositions[1], 1);
    assert.match(monthly, /คำอ่านรายเดือนที่เผยแพร่/);
    assert.match(monthly, /คำถามตำแหน่งจาก CMS/);
    assert.doesNotMatch(monthly, /คำอ่านรายวันจาก CMS/);
    assert.equal(meaning.upright, "ความหมายที่เผยแพร่");
    assert.equal(meaning.uprightDetails.career, "งานที่แก้ผ่าน CMS");
  } finally { applyContentLibrary({}); }
  assert.equal(readingForContext(card, "love").reading, original);
});

test("monthly guidance preserves ten positions and never masquerades as a full spread synthesis", () => {
  assert.deepEqual(monthlyPositions.map(position => position.id), ["overview", "challenge", "root", "recent_past", "intention", "near_term", "self", "environment", "hopes_fears", "outlook"]);
  const card = tarotCards[26];
  const html = renderMonthlyCard(card, monthlyPositions[0], 0);
  assert.match(html, /data-monthly-position="overview"/);
  assert.ok(html.includes(card.contexts.monthly.reading));
  assert.ok(html.includes(card.contexts.monthly.caution));
  assert.ok(!html.includes(card.interpretation));
  assert.throws(() => readingForContext(card, "unknown"));
});
