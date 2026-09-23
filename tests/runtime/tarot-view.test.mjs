import test from "node:test";
import assert from "node:assert/strict";
import { tarotCards } from "../../src/scripts/tarot-data.js";
import { renderSingleReading, renderReadingSections, renderCardBack, renderEmptyReading } from "../../src/scripts/tarot-view.js";

test("every card preserves its original reading fields in the shared result", () => {
  assert.equal(tarotCards.length, 78);
  for (const card of tarotCards) {
    const html = renderSingleReading(card);
    for (const value of [card.thName, card.name, card.theme, card.interpretation, card.advice, card.caution, card.color, card.time, card.mantra, card.image]) assert.ok(html.includes(value), `${card.id}: missing ${value}`);
    assert.ok(html.includes(`/tarot/meanings/${card.id}/`));
    assert.equal((html.match(/class="tarot-reading-section"/g) || []).length, 3);
  }
});

test("topic-specific content overrides only its intended presentation fields", () => {
  const html = renderSingleReading(tarotCards[0], { labels: { advice: "แนวทางสื่อสาร", time: "เวลาตั้งจิต" }, advice: "คำแนะนำเฉพาะความรัก", verdict: { label: "หัวใจเปิดรับ", copy: "ทบทวนความสัมพันธ์" } });
  for (const text of ["แนวทางสื่อสาร", "เวลาตั้งจิต", "คำแนะนำเฉพาะความรัก", "หัวใจเปิดรับ", "ทบทวนความสัมพันธ์", tarotCards[0].caution]) assert.ok(html.includes(text));
});

test("common imagery, empty state and disclosure IDs remain explicit", () => {
  assert.ok(renderCardBack().includes("celestial-card-back.webp"));
  const html = renderReadingSections([{ label: "คำแนะนำ", text: "ทบทวน", icon: "lightbulb" }], "position-4");
  assert.ok(html.includes('id="position-4-0"'));
  assert.ok(renderEmptyReading("ยังไม่มีไพ่", "เลือกก่อนอ่าน").includes('href="../"'));
});
