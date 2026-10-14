import { test } from "node:test";
import assert from "node:assert/strict";
import { requestJson, createLatestRequest } from "../../src/scripts/request.js";

test("latest request invalidates older work and cancellation invalidates completion", () => {
  const requests = createLatestRequest();
  const old = requests.start();
  const current = requests.start();
  assert.equal(old.isCurrent(), false);
  assert.equal(old.signal.aborted, true);
  assert.equal(current.isCurrent(), true);
  requests.cancel();
  assert.equal(current.isCurrent(), false);
});

test("timeouts, malformed responses and HTTP errors are recoverable failures", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason)));
    await assert.rejects(requestJson("http://test", { timeoutMs: 10 }), { name: "TimeoutError" });
    globalThis.fetch = async () => new Response("invalid json");
    await assert.rejects(requestJson("http://test"), SyntaxError);
    globalThis.fetch = async () => new Response(JSON.stringify({ code: "CATALOG_CHANGED" }), { status: 409 });
    await assert.rejects(requestJson("http://test"), (error) => error.status === 409 && error.payload.code === "CATALOG_CHANGED");
    globalThis.fetch = async (_url, options) => { assert.equal(options.cache, "no-store"); return Response.json({ ok: true }); };
    assert.deepEqual(await requestJson("http://test"), { ok: true });
    globalThis.fetch = async (_url, options) => { assert.equal(options.cache, "force-cache"); return Response.json({ items: [] }); };
    assert.deepEqual(await requestJson("http://test/static-index.json", { cache: "force-cache" }), { items: [] });
  } finally { globalThis.fetch = original; }
});
