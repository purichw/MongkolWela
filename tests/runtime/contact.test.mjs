import test from "node:test";
import assert from "node:assert/strict";
import { contactChannels, contactDefaults, contactEmailHref, contactLineHref } from "../../src/config/contact.js";

test("contact destinations use supplied values and encode subjects and LINE ID", () => {
  assert.deepEqual(contactChannels(contactDefaults), contactDefaults);
  assert.equal(contactLineHref(contactDefaults.lineId), "https://line.me/R/ti/p/%40MongkolWela");
  const href = new URL(contactEmailHref(contactDefaults.email, "แจ้งแก้ไขข้อมูล & สอบถาม"));
  assert.equal(href.pathname, contactDefaults.email);
  assert.equal(href.searchParams.get("subject"), "แจ้งแก้ไขข้อมูล & สอบถาม");
});

test("explicit clears and unsafe contact values never resurrect defaults", () => {
  for (const email of ["", null, "javascript:alert(1)", "x@y.com?bcc=other@example.com", "x@y.com\r\nBcc:other@example.com"]) {
    assert.equal(contactEmailHref(email), "");
  }
  for (const handle of ["", null, "https://other.example", "@abc?x=1", "@abc/path"]) {
    assert.equal(contactLineHref(handle), "");
  }
  assert.deepEqual(contactChannels({ email: " updated@example.com ", lineId: " @new-account " }), { email: "updated@example.com", lineId: "@new-account" });
});
