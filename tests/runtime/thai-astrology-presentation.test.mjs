import test from "node:test";
import assert from "node:assert/strict";
import { calculateChart } from "../../src/scripts/thai-astrology.js";
import { renderChart, renderWheel } from "../../src/scripts/thai-astrology-view.js";

process.env.TZ = "Asia/Bangkok";
const input = { name: "fixture", birthDate: "1994-09-21", birthHour: 7, birthMinute: 30, place: "bangkok", chartType: "natal", calculationSystem: "suriyayatra", transitDate: "2026-09-21" };
// Captured from the pre-redesign calculator, not from the illustrative mockup.
const expected = [["sun",7,"virgo",6],["moon",24,"pisces",0],["mars",27,"gemini",3],["mercury",6,"aquarius",11],["jupiter",17,"taurus",2],["venus",14,"leo",5],["saturn",9,"cancer",4],["rahu",22,"virgo",6],["ketu",14,"leo",5],["uranus",1,"aries",1]];
const summary = (chart) => chart.planets.map(p => [p.id, p.degree, p.sign.id, p.houseIndex]);

test("presentation leaves the existing system and mode calculation results unchanged", () => {
  for (const mode of ["natal", "transit", "newmoon", "fullmoon"]) {
    const chart = calculateChart({ ...input, chartType: mode });
    assert.equal(chart.ascSign.id, "pisces");
    assert.equal(chart.activeHouse.id, "partner");
    assert.deepEqual(summary(chart), expected);
    const lahiriExpected = structuredClone(expected);
    lahiriExpected[3][1] = 5; lahiriExpected[7][1] = 21; lahiriExpected[8][1] = 13;
    assert.deepEqual(summary(calculateChart({ ...input, chartType: mode, calculationSystem: "lahiri" })), lahiriExpected);
  }
});

test("gold chart keeps twelve unique canonical houses, matching memberships and true center", () => {
  const chart = calculateChart(input), wheel = renderWheel(chart);
  assert.deepEqual([...wheel.matchAll(/data-house-number="(\d+)"/g)].map(m => Number(m[1])), Array.from({length:12}, (_,i)=>i+1));
  assert.equal(new Set([...wheel.matchAll(/data-house-id="([^"]+)"/g)].map(m=>m[1])).size, 12);
  assert.ok(wheel.includes(`<strong>${chart.ascSign.th}</strong>`));
  for (const planet of chart.planets) assert.ok(wheel.includes(`data-planet-id="${planet.id}"`));
  const dense = renderWheel({ ...chart, planets: chart.planets.map(p=>({...p,houseIndex:0})) });
  assert.ok(dense.includes("+8"));
  assert.ok(dense.includes("อาทิตย์ จันทร์ อังคาร"));
  assert.equal((dense.match(/data-planet-id=/g)||[]).length, 2);
  assert.ok(renderWheel({...chart,ascSign:null}).includes("ยังไม่มีข้อมูลลัคนา"));
});

test("rendered name is text and all planetary fields stay available", () => {
  const chart=calculateChart({...input,name:'<img src=x onerror="alert(1)">'});
  const reading={headline:{title:"title",copy:"copy"},overview:"overview",career:"career",wealth:"wealth",relationship:"relationship",advice:"advice",caution:"caution",system:"system",mode:"mode"};
  const parts=renderChart(chart,"sample",reading);
  assert.ok(parts.heading.includes("&lt;img"));
  assert.ok(!parts.heading.includes("<img"));
  assert.ok(parts.heading.includes("ข้อมูลตัวอย่าง"));
  assert.equal((parts.planets.match(/data-planet-row=/g)||[]).length,10);
  assert.equal((parts.planets.match(/scope="col"/g)||[]).length,5);
  assert.equal((parts.readings.match(/class="thai-reading-card"/g)||[]).length,6);
});
