import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { validateMediaAsset, mediaInventory, filterMedia, mediaMetadata } from "../../src/lib/admin-media-library.js";
import handler from "../../api/admin/media.js";
import { ADMIN_ACCESS_COOKIE } from "../../api/admin/_auth.js";
import { createAuthFixture, testAccessToken } from "../helpers/supabase-auth-fixture.mjs";
import { createAdminMedia } from "../../src/scripts/admin/media.js";

test("media metadata validates safe URLs, sizes and kinds without inventing dimensions", () => {
  const value = { src: "/photo.webp", kind: "image" };
  for (const invalid of [{ src: "javascript:alert(1)" }, { src: "//unsafe.org/photo" }, { src: "http://unsafe.org/a" }, { src: "https://a:b@example.org/a" }, { src: "/\\unsafe.org/x" }, { bytes: -2 }, { width: 1.5 }, { kind: "constructor" }]) assert.throws(() => validateMediaAsset({ ...value, ...invalid }), { statusCode: 422 });
  assert.equal(validateMediaAsset(value).width, null);
  assert.equal(validateMediaAsset(value).name, "photo.webp");
  assert.equal(mediaMetadata({ kind: "image", format: "WEBP", references: [1] }), "WEBP · อ้างอิง 1 ตำแหน่ง");
  assert.equal(mediaMetadata({ bytes: 2 * 1024 ** 2, width: 1920, height: 1080 }), "2.0 MB · 1920 × 1080");
});
test("inventory deduplicates URLs, preserves CMS ownership and uses actual type/filter counts", () => {
  const rows = mediaInventory([{ src: "/a.webp", name: "a.webp", references: [{ templeKey: "t", label: "วัดทดสอบ" }] }], [{ src: "/a.webp", kind: "image", name: "ภาพวัด", category: "วัดเด่น" }, { src: "/b.pdf", kind: "document", name: "คู่มือ" }], [{ imageUrl: "/a.webp", title: "งานบุญ", status: "published" }]);
  assert.equal(rows.length, 2); assert.equal(rows[0].references.length, 2);
  assert.equal(filterMedia(rows, { search: "งานบุญ" }).total, 1);
  assert.equal(filterMedia(rows, { kind: "document" }).total, 1);
  assert.equal(filterMedia(rows, { category: "ไม่มี" }).total, 0);
  assert.equal(filterMedia(rows, { page: 500 }).page, 1);
});

test("shared uploader keeps temple defaults and isolates library provider folders", async t => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => { calls.push({ url, form: options.body }); return new Response(JSON.stringify({ secure_url: "https://example.test/image.jpg", url: "https://example.test/image.jpg" })); });
  const state = { media: { provider: "cloudinary", cloudinary: { enabled: true, cloudName: "test", uploadPreset: "test-preset" } } };
  const { uploadAdminMedia } = createAdminMedia({ state, currentTempleRecord: () => ({ key: "test-temple" }), api: async () => ({ authentication: { publicKey: "public", signature: "signed", token: "token", expire: 1 } }) });
  await uploadAdminMedia("image-data", "name.jpg");
  assert.equal(calls.at(-1).form.get("folder"), "mongkolwela/temples");
  assert.match(calls.at(-1).form.get("context"), /temple=test-temple/);
  await uploadAdminMedia("image-data", "name.jpg", { library: true });
  assert.equal(calls.at(-1).form.get("folder"), "mongkolwela/library");
  assert.equal(calls.at(-1).form.get("context"), "source=media_library");
  state.media = { provider: "imagekit", imagekit: { enabled: true } };
  await uploadAdminMedia("image-data", "name.jpg");
  assert.equal(calls.at(-1).form.get("folder"), "/mongkolwela/temples");
  await uploadAdminMedia("image-data", "name.jpg", { library: true });
  assert.equal(calls.at(-1).form.get("folder"), "/mongkolwela/library");
  assert.equal(calls.at(-1).form.get("signature"), "signed");
});

const listen = server => new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${server.address().port}`)));
const close = server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
test("media registry authenticates, persists privately, rejects stale writes and fails closed", async () => {
  const auth = createAuthFixture(), documents = new Map(); let outage = false;
  const database = http.createServer(async (req, res) => {
    if (await auth.handle(req, res)) return;
    res.setHeader("Content-Type", "application/json");
    if (outage) { res.statusCode = 503; res.end('{"message":"offline"}'); return; }
    const url = new URL(req.url, "http://local"); const id = url.searchParams.get("id");
    if (req.method === "GET") {
      if (id?.startsWith("eq.")) res.end(JSON.stringify(documents.get(id.slice(3)) || null));
      else { assert.equal(id, "like.media:%"); res.end(JSON.stringify([...documents.values()])); }
      return;
    }
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const document = JSON.parse(Buffer.concat(chunks));
    if (req.method === "POST" && documents.has(document.id)) { res.statusCode = 409; res.end('{"code":"23505"}'); return; }
    if (req.method === "PATCH" && documents.get(document.id)?.content.version !== url.searchParams.get("content->>version")?.slice(3)) { res.end("[]"); return; }
    documents.set(document.id, document); res.end(JSON.stringify([document]));
  });
  const baseDb = await listen(database);
  const values = { SUPABASE_URL: baseDb, SUPABASE_ANON_KEY: "test", SUPABASE_SERVICE_ROLE_KEY: "test-service-key", VERCEL_ENV: "production" };
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]])); Object.assign(process.env, values);
  const app = http.createServer(handler), base = await listen(app);
  const headers = { "Content-Type": "application/json", Cookie: `${ADMIN_ACCESS_COOKIE}=${testAccessToken()}` };
  const asset = { src: "https://example.test/photo.webp", name: "ภาพวัด.webp", kind: "image", bytes: 2048, width: 600, height: 400 };
  const save = (value, extra = {}) => fetch(`${base}/api/admin/media`, { method: "POST", headers: { ...headers, ...extra }, body: JSON.stringify(value) });
  try {
    assert.equal((await fetch(`${base}/api/admin/media?view=library`)).status, 401);
    assert.equal((await save({ action: "save-asset", asset }, { Origin: "https://foreign.invalid" })).status, 403);
    assert.equal((await save({ action: "save-asset", asset: { ...asset, src: "data:image/svg+xml,x" } })).status, 422);
    const created = await (await save({ action: "save-asset", asset })).json(); assert.equal(created.ok, true);
    assert.equal(documents.get(`media:${created.asset.id}`).status, "draft");
    assert.equal((await save({ action: "save-asset", asset })).status, 409);
    assert.equal((await save({ action: "save-asset", asset, expectedVersion: "stale" })).status, 409);
    const body = { action: "save-asset", asset: { ...asset, name: "ใหม่.webp" }, expectedVersion: created.asset.version };
    const first = await save(body); assert.equal(first.status, 200);
    assert.equal((await save(body)).status, 409);
    const read = await fetch(`${base}/api/admin/media?view=library`, { headers });
    assert.equal(read.headers.get("cache-control"), "no-store");
    assert.equal((await read.json()).assets[0].name, "ใหม่.webp");
    outage = true;
    assert.equal((await fetch(`${base}/api/admin/media?view=library`, { headers })).status, 503);
  } finally { await close(app); await close(database); for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value; }
});
