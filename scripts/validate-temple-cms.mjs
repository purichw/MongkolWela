import assert from "node:assert/strict";
import popularTemples from "../src/data/popular-temples.json" with { type: "json" };
import muTemples from "../src/data/mu-temples.json" with { type: "json" };
import sacredTemples from "../src/data/sacred-temples.json" with { type: "json" };
import liveContent from "../public/admin/content/live.json" with { type: "json" };
import { applyTempleCmsRecords, normalizeTempleImages, templeImageSlots } from "../src/data/temple-cms.js";

const datasets = { popular: popularTemples, mu: muTemples, sacred: sacredTemples };
const records = liveContent.temples?.records || {};

assert.equal(typeof records, "object", "temples.records must be an object");
assert.deepEqual(Object.keys(templeImageSlots), ["card", "hero", "map"]);

for (const [key, record] of Object.entries(records)) {
  assert.ok(["popular", "mu", "sacred"].includes(record.collection), `${key}: invalid collection`);
  assert.ok(record.slug, `${key}: missing stable slug`);
  assert.ok(record.fields?.name, `${key}: missing place name`);
  for (const role of Object.keys(templeImageSlots)) {
    for (const viewport of ["desktop", "mobile"]) {
      const url = record.images?.[role]?.[viewport]?.url;
      if (url) assert.match(url, /^(?:https:\/\/|\/)/u, `${key}: ${role}.${viewport} must be HTTPS or root-relative`);
    }
  }
}

for (const [collection, dataset] of Object.entries(datasets)) {
  const merged = applyTempleCmsRecords(collection, dataset, liveContent);
  assert.ok(merged.length > 0, `${collection}: no places after CMS merge`);
  merged.forEach((temple) => {
    assert.ok(temple.cmsKey, `${collection}: missing cmsKey`);
    assert.ok(temple.cmsSlug, `${collection}: missing cmsSlug`);
    assert.ok(temple.name, `${collection}: missing name`);
    assert.ok(temple.cmsImages?.card?.desktop, `${collection}: missing normalized card image`);
    assert.ok(temple.cmsImages?.hero?.desktop, `${collection}: missing normalized hero image`);
    assert.ok(temple.cmsImages?.map?.desktop, `${collection}: missing normalized map image`);
  });
}

const sourceTemple = applyTempleCmsRecords("popular", popularTemples, liveContent)[0];
const editedContent = {
  temples: {
    records: {
      [sourceTemple.cmsKey]: {
        key: sourceTemple.cmsKey,
        collection: "popular",
        slug: sourceTemple.cmsSlug,
        source: "dataset",
        status: "active",
        fields: { name: "สถานที่ทดสอบ CMS" },
        images: {
          card: {
            desktop: { url: "https://example.com/card.jpg" },
            mobile: { url: "https://example.com/card-mobile.jpg" },
          },
        },
      },
    },
  },
};
const edited = applyTempleCmsRecords("popular", popularTemples, editedContent);
assert.equal(edited[0].name, "สถานที่ทดสอบ CMS");
assert.equal(edited[0].imageUrl, "https://example.com/card.jpg");
assert.equal(edited[0].imageMobileUrl, "https://example.com/card-mobile.jpg");

const deletedContent = structuredClone(editedContent);
deletedContent.temples.records[sourceTemple.cmsKey].status = "deleted";
assert.equal(applyTempleCmsRecords("popular", popularTemples, deletedContent).length, popularTemples.length - 1);

const newKey = "popular:admin-validator";
const createdContent = {
  temples: {
    records: {
      [newKey]: {
        key: newKey,
        collection: "popular",
        slug: "999-validator-place-thailand",
        source: "admin",
        status: "active",
        fields: { rank: 999, name: "สถานที่ใหม่จาก Admin", province: "กรุงเทพมหานคร" },
        images: normalizeTempleImages({}, "https://example.com/new.jpg", "สถานที่ใหม่จาก Admin"),
      },
    },
  },
};
const created = applyTempleCmsRecords("popular", popularTemples, createdContent);
assert.ok(created.some((temple) => temple.cmsKey === newKey && temple.cmsSlug === "999-validator-place-thailand"));

console.log(`Temple CMS validation passed for ${Object.values(datasets).reduce((total, rows) => total + rows.length, 0)} source records.`);
