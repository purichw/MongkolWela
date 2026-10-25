import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { consentCopy, resolveConsentCopy, validConsent } from "../../src/lib/cookie-consent.js";

test("approved consent copy updates shipped defaults without replacing CMS authoring", () => {
  assert.deepEqual(resolveConsentCopy(), consentCopy);
  assert.deepEqual(resolveConsentCopy({ titleText: "การใช้คุกกี้และข้อมูลการใช้งาน", acceptLabel: "ยอมรับทั้งหมด", declineLabel: "ปฏิเสธ" }), consentCopy);
  const custom = Object.fromEntries(Object.keys(consentCopy).map(key => [key, `ข้อความจาก CMS ${key}`]));
  assert.deepEqual(resolveConsentCopy(custom), custom);
  for (const seed of ["default", "live"]) {
    const pdpa = JSON.parse(fs.readFileSync(`public/admin/content/${seed}.json`, "utf8")).site.pdpa;
    for (const [key, value] of Object.entries(consentCopy)) assert.equal(pdpa[key], value, `${seed}.${key}`);
  }
});

test("only explicit accepted/declined choices count as consent", () => {
  for (const value of [null, undefined, "", "yes", "true", "corrupt"]) assert.equal(validConsent(value), null);
  assert.equal(validConsent("accepted"), "accepted");
  assert.equal(validConsent("declined"), "declined");
});
