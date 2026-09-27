import test from "node:test";
import assert from "node:assert/strict";
import { filterCommerceRows, productCategoryLabel } from "../../src/lib/commerce-catalog.js";
import { publicCommerce, mutateCommerce } from "../../api/commerce/_domain.js";
import { commerceFixture } from "../helpers/commerce-fixtures.mjs";

test("category is optional, validated, published, and preserved by older editors", () => {
  const fixture = commerceFixture();
  const save = (data, state = fixture.state, version = fixture.product.version) => mutateCommerce(state, { op: "save", table: "products", id: fixture.product.id, expectedVersion: version, data }, fixture.actor, { templeIds: fixture.templeIds });
  const saved = save({ ...fixture.product, category: "amulets" });
  assert.equal(publicCommerce(saved.state).products.find(product => product.id === fixture.product.id).category, "amulets");
  const { category, ...oldEditor } = saved.result;
  const preserved = save(oldEditor, saved.state, saved.result.version);
  assert.equal(preserved.result.category, "amulets");
  assert.throws(() => save({ ...fixture.product, category: "invented-category" }), /ประเภท/);
  assert.equal(productCategoryLabel(undefined), "วัตถุมงคล");
});

test("catalog filters combine seller, category, temple and province without inventing data", () => {
  const catalog = { organizations: [{ id: "a", name: "ร้านหนึ่ง" }], temples: [{ id: "t1", name: "วัดทดสอบ", province: "เชียงใหม่" }], products: [
    { id: "p1", title: "พระเครื่อง", orgId: "a", category: "amulets", priceSatang: 20000, templeId: "t1" },
    { id: "p2", title: "เครื่องราง", orgId: "a", priceSatang: 10000 },
  ], campaigns: [{ id: "c1", title: "กฐิน", orgId: "a", templeId: "t1", kind: "fund", eventDate: "2026-10-01" }] };
  assert.deepEqual(filterCommerceRows(catalog, "shop", { category: "amulets", search: " เชียงใหม่ " }).map(row => row.id), ["p1"]);
  assert.deepEqual(filterCommerceRows(catalog, "shop", { sort: "price-asc" }).map(row => row.id), ["p2", "p1"]);
  assert.equal(filterCommerceRows(catalog, "shop", { category: "talismans" }).length, 0);
  assert.equal(filterCommerceRows(catalog, "merit", { province: "เชียงใหม่", kind: "fund" }).length, 1);
  assert.equal(filterCommerceRows(catalog, "merit", { kind: "host" }).length, 0);
  assert.equal(catalog.products[0].id, "p1");
});
