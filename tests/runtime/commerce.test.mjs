import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { commerceFixture, guestCommand, PREVIEW_USER, OTHER_USER } from "../helpers/commerce-fixtures.mjs";
import { mutateCommerce, publicCommerce, privateCommerce, availableStock, availableUnits, guestRecord, externalUrl } from "../../api/commerce/_domain.js";

const now = Date.parse("2026-09-20T10:00:00+07:00");
function scenario() {
  const f = commerceFixture("popular:test", now);
  return { ...f, run(command, actor = f.actor, time = now) { const result = mutateCommerce(this.state, command, actor, { templeIds: f.templeIds, now: time }); this.state = result.state; return result.result; } };
}
const throwsStatus = (fn, status) => assert.throws(fn, error => error.statusCode === status);
test("tenant isolation, active membership, ownership and publication review", () => {
  const s = scenario();
  throwsStatus(() => privateCommerce(s.state, {}), 403);
  assert.equal(privateCommerce(s.state, { userId: PREVIEW_USER }).products.length, 1);
  const command = { op: "save", table: "products", id: s.otherProduct.id, expectedVersion: s.otherProduct.version, data: s.otherProduct };
  throwsStatus(() => s.run(command, { userId: PREVIEW_USER }), 403);
  throwsStatus(() => s.run({ ...command, data: { ...s.otherProduct, orgId: s.organization.id } }, { userId: OTHER_USER }), 403);
  const changed = s.run({ op: "save", table: "channels", id: s.channel.id, expectedVersion: s.channel.version, data: { ...s.channel, url: "https://example.test/new", status: "published" } }, { userId: PREVIEW_USER });
  assert.equal(changed.status, "review");
  assert.equal(publicCommerce(s.state).channels.length, 0);
  const member = s.state.members.find(m => m.userId === PREVIEW_USER);
  s.run({ op: "save", table: "members", id: member.id, expectedVersion: member.version, data: { ...member, status: "suspended" } });
  throwsStatus(() => privateCommerce(s.state, { userId: PREVIEW_USER }), 403);
});
test("order requests preserve server prices, enforce one seller and idempotency", () => {
  const s = scenario();
  const command = guestCommand("order.create", { name: "ผู้ทดสอบ", contact: "test@example.test", address: "ที่อยู่ทดสอบ", sellerVersion: s.organization.version, priceSatang: 1, lines: [{ productId: s.product.id, version: s.product.version, quantity: 2, priceSatang: 1 }] });
  const order = s.run(command, {});
  assert.equal(order.totalSatang, 75000);
  assert.equal(order.paymentStatus, "unavailable");
  assert.equal(availableStock(s.state, s.product.id, now), 2);
  assert.equal(s.run(command, {}).id, order.id);
  assert.equal(s.state.orders.length, 1);
  throwsStatus(() => s.run({ ...command, data: { ...command.data, name: "changed" } }, {}), 409);
  throwsStatus(() => s.run(guestCommand("order.create", { ...command.data, lines: [...command.data.lines, { productId: s.otherProduct.id, version: s.otherProduct.version, quantity: 1 }] }), {}), 422);
  throwsStatus(() => guestRecord(s.state, "orders", order.id, `${randomUUID()}${randomUUID()}`), 404);
  assert.equal("accessHash" in order, false);
  assert.equal(JSON.stringify(publicCommerce(s.state)).includes("test@example.test"), false);
});
test("inventory confirmation is atomic with expiry, conflict, cancellation and payment gate", () => {
  const s = scenario();
  const create = () => s.run(guestCommand("order.create", { name: "test", contact: "test", address: "test", sellerVersion: s.organization.version, lines: [{ productId: s.product.id, version: s.product.version, quantity: 2 }] }), {});
  const first = create(); const second = create();
  const accepted = s.run({ op: "transition", table: "orders", id: first.id, expectedVersion: first.version, action: "accept", note: "ตรวจสินค้าแล้ว" });
  assert.equal(availableStock(s.state, s.product.id, now), 0);
  throwsStatus(() => s.run({ op: "transition", table: "orders", id: second.id, expectedVersion: second.version, action: "accept", note: "ตรวจแล้ว" }), 409);
  throwsStatus(() => s.run({ op: "transition", table: "orders", id: first.id, expectedVersion: first.version, action: "cancel", note: "test" }), 409);
  throwsStatus(() => s.run({ op: "transition", table: "orders", id: first.id, expectedVersion: accepted.version, action: "paid", note: "test" }), 503);
  assert.equal(availableStock(s.state, s.product.id, now + 86400001), 2);
  s.run({ op: "transition", table: "orders", id: first.id, expectedVersion: accepted.version, action: "cancel", note: "ยกเลิก" });
  assert.equal(availableStock(s.state, s.product.id, now), 2);
});
test("fund capacity, host approvals and receipts are separate from reservations", () => {
  const s = scenario();
  const command = guestCommand("booking.create", { name: "test", contact: "test", campaignId: s.campaign.id, version: s.campaign.version, quantity: 2 });
  const booking = s.run(command, {});
  assert.equal(booking.status, "held"); assert.equal(booking.donationReceived, false);
  throwsStatus(() => s.run(guestCommand("booking.create", command.data), {}), 409);
  assert.equal(availableUnits(s.state, s.campaign.id, now + 86400001), 3);
  const confirmed = s.run({ op: "transition", table: "bookings", id: booking.id, expectedVersion: booking.version, action: "confirm", note: "ผู้จัดรับจอง" });
  assert.equal(confirmed.donationReceived, false);
  const received = s.run({ op: "transition", table: "bookings", id: booking.id, expectedVersion: confirmed.version, action: "receipt", note: "ตรวจยอดบัญชีแล้ว", reference: "test-reference", receivedSatang: 200000 });
  assert.equal(received.donationReceived, true);
  const hostCommand = () => guestCommand("booking.create", { name: "test", contact: "test", campaignId: s.host.id, version: s.host.version });
  const first = s.run(hostCommand(), {}); const second = s.run(hostCommand(), {});
  s.run({ op: "transition", table: "bookings", id: first.id, expectedVersion: first.version, action: "confirm", note: "วัดอนุมัติ" });
  throwsStatus(() => s.run({ op: "transition", table: "bookings", id: second.id, expectedVersion: second.version, action: "confirm", note: "วัดอนุมัติ" }), 409);
});
test("unverified links, unsafe URLs, stale publications and hidden temples", () => {
  const s = scenario();
  for (const url of ["javascript:alert(1)", "https://user:secret@example.com", "http://example.com", "https://127.0.0.1/a"]) throwsStatus(() => externalUrl(url), 422);
  throwsStatus(() => s.run({ op: "save", table: "channels", data: { ...s.channel, recipientId: "123", status: "published" } }), 422);
  assert.equal(publicCommerce(s.state, { templeIds: new Set() }).products.length, 0);
  const revision = s.run({ op: "save", table: "products", id: s.product.id, expectedVersion: s.product.version, data: { ...s.product, priceSatang: 45000 } });
  assert.notEqual(revision.version, s.product.version);
  throwsStatus(() => s.run(guestCommand("order.create", { name: "test", contact: "test", address: "test", lines: [{ productId: s.product.id, version: s.product.version, quantity: 1 }] }), {}), 409);
});

test("revoked temple associations and changed seller terms cannot accept stale requests", () => {
  const s = scenario();
  const orderInput = { name: "test", contact: "test", address: "test", sellerVersion: s.organization.version, lines: [{ productId: s.product.id, version: s.product.version, quantity: 1 }] };
  const bookingInput = { name: "test", contact: "test", campaignId: s.campaign.id, version: s.campaign.version, quantity: 1 };
  const order = s.run(guestCommand("order.create", orderInput), {});
  const booking = s.run(guestCommand("booking.create", bookingInput), {});
  const updated = s.run({ op: "save", table: "organizations", id: s.organization.id, expectedVersion: s.organization.version, data: { ...s.organization, shippingSatang: 7000 } });
  throwsStatus(() => s.run(guestCommand("order.create", orderInput), {}), 409);
  s.run({ op: "save", table: "organizations", id: updated.id, expectedVersion: updated.version, data: { ...updated, templeIds: [] } });
  assert.equal(publicCommerce(s.state).products.some(p => p.id === s.product.id), false);
  throwsStatus(() => s.run(guestCommand("order.create", orderInput), {}), 409);
  throwsStatus(() => s.run(guestCommand("booking.create", bookingInput), {}), 409);
  throwsStatus(() => s.run({ op: "transition", table: "orders", id: order.id, expectedVersion: order.version, action: "accept", note: "test" }), 409);
  throwsStatus(() => s.run({ op: "transition", table: "bookings", id: booking.id, expectedVersion: booking.version, action: "confirm", note: "test" }), 409);
});
