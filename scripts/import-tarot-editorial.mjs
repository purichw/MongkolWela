import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const archive = resolve(root, "docs/research/tarot-editorial-v1");
const source = process.argv[2] ? resolve(process.argv[2]) : archive;
const checksums = readFileSync(resolve(source, "checksums.sha256"), "utf8");
const files = checksums.trim().split(/\r?\n/).map(line => {
  const match = /^([a-f0-9]{64})  ([\w.-]+)$/.exec(line);
  assert.ok(match, "Invalid checksum entry");
  const [, checksum, name] = match;
  assert.equal(createHash("sha256").update(readFileSync(resolve(source, name))).digest("hex"), checksum, name);
  return name;
});
const cards = readFileSync(resolve(source, "card-content.ndjson"), "utf8").trim().split(/\r?\n/).map(JSON.parse);
const contexts = ["daily", "monthly", "love", "money", "career", "luck"];
const ranks = ["ace", "two", "three", "four", "fives", "sixs", "sevens", "eights", "nines", "tens", "pages", "knights", "queens", "kings"];
const majorIds = ["the-fool", "the-magician", "the-high-priestess", "the-empress", "the-emperor", "the-hierophant", "the-lovers", "the-chariot", "the-strength", "the-hermit", "the-wheel-of-fortune", "the-justice", "the-hanged-man", "the-death", "temperance", "the-devil", "the-tower", "the-star", "the-moon", "the-sun", "the-judgment", "the-world"];
const ids = [...majorIds, ...["wands", "cups", "swords", "pentacles"].flatMap(suit => ranks.map(rank => `the-${rank}-of-${suit}`))];
assert.deepEqual(cards.map(card => card.legacy_id), ids, "Legacy IDs/order must not change");
for (const card of cards) {
  assert.equal(card.schema_version, "mongkol-tarot-editorial-v1");
  assert.deepEqual(Object.keys(card.contexts).sort(), [...contexts].sort());
  for (const context of contexts) {
    const reading = card.contexts[context];
    assert.equal(reading.orientation, "upright");
    for (const key of ["reading", "advice", "caution"]) assert.ok(typeof reading[key] === "string" && reading[key].trim());
  }
  assert.ok(card.upright && card.reversed && card.summary);
  for (const related of card.differentiation) assert.ok(ids.includes(related.legacy_id));
}
// Archive the delivered evidence unchanged; runtime gets editorial text only.
if (source !== archive) {
  for (const name of [...files, "checksums.sha256"]) {
    const target = resolve(archive, name);
    if (existsSync(target)) assert.ok(readFileSync(target).equals(readFileSync(resolve(source, name))), `Refusing to replace a different archive: ${name}`);
  }
  mkdirSync(archive, { recursive: true });
  for (const name of [...files, "checksums.sha256"]) copyFileSync(resolve(source, name), resolve(archive, name));
}
const content = cards.map(card => ({
  id: card.legacy_id,
  summary: card.summary,
  upright: card.upright,
  reversed: card.reversed,
  keywords: card.keywords,
  contexts: Object.fromEntries(contexts.map(context => {
    const { reading, advice, caution } = card.contexts[context];
    return [context, { reading, advice, caution }];
  })),
  symbolism: card.symbolism.map(item => ({ symbol: item.motif, meaning: `${item.observation} ${item.interpretation}` })),
  relatedCards: card.differentiation.map(item => ({ card_id: item.legacy_id, relationship: item.difference })),
}));
writeFileSync(resolve(root, "src/data/tarot-editorial-content.json"), `${JSON.stringify(content, null, 2)}\n`);
console.log(`Imported ${cards.length} cards and ${cards.length * contexts.length} contexts; no CMS writes.`);
