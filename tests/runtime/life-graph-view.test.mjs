import test from "node:test";
import assert from "node:assert/strict";
import { calculateLifeGraph } from "../../src/scripts/life-graph-engine.js";
import { renderLifeGraph, renderLifeChart, createShareText } from "../../src/scripts/life-graph-chart.js";

const input = { name: '<img src=x onerror="alert(1)">', birthDate: "1996-09-21", birthHour: "12", birthMinute: "0", transitDate: "2026-09-21" };
const provider = { getDateInfo: async () => ({ weekdayNumber: 7, lunarMonth: 10, zodiacNumber: 1, lunarLabel: "เดือน 10 โดยประมาณ", zodiacName: "ชวด", source: "ประมาณค่าในเครื่อง" }) };

test("new presentation keeps all engine scores and escapes input", async () => {
  const result = await calculateLifeGraph(input, provider);
  const html = renderLifeGraph(result);
  assert.ok(html.includes("&lt;img"));
  assert.ok(!html.includes(input.name));
  for (const house of result.houses) {
    assert.ok(html.includes(`data-life-score="${house.id}">${house.value}</td>`));
    assert.ok(html.includes(`${house.value} คะแนน ${house.band.label}`));
  }
  assert.ok(html.includes(`<strong>${result.summary.average}</strong>`));
  assert.ok(html.includes("ฐานวัน"));
  assert.ok(html.includes("ฐานเดือน"));
  assert.ok(html.includes("ฐานปี"));
});

test("desktop and mobile use the same 12 results and the real average line", async () => {
  const result = await calculateLifeGraph(input, provider);
  for (const compact of [false, true]) {
    const html = renderLifeChart(result, compact);
    assert.equal((html.match(/data-life-house=/g) || []).length, 12);
    assert.ok(html.includes(`ค่าเฉลี่ย ${result.summary.average}`));
    assert.ok(html.includes('tabindex="0"'));
  }
});

test("share text excludes name and birth information", async () => {
  const result = await calculateLifeGraph(input, provider);
  const shared = createShareText(result);
  assert.ok(!shared.includes(input.name));
  assert.ok(!shared.includes("2539"));
  assert.ok(!shared.includes("12:00"));
  assert.equal(shared.split("\n").length, 15);
  assert.ok(shared.includes(`ค่าเฉลี่ย ${result.summary.average}`));
});
