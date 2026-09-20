import { test } from "node:test";
import assert from "node:assert/strict";
import { startContentRefresh } from "../../src/scripts/content-refresh.js";

test("visible refresh coalesces events, pauses hidden pages, resumes bfcache and avoids overlapping requests", async (t) => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const document = new EventTarget();
  document.visibilityState = "visible";
  const window = new EventTarget();
  Object.assign(globalThis, { document, window });
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const advance = async (ms) => { t.mock.timers.tick(ms); await new Promise(setImmediate); };
  let calls = 0;
  let release;
  let hold = false;
  const stop = startContentRefresh(async () => {
    calls++;
    if (hold) await new Promise((resolve) => { release = resolve; });
  });
  try {
    await advance(60000);
    assert.equal(calls, 1);
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    await advance(250);
    assert.equal(calls, 2);
    document.visibilityState = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
    await advance(180000);
    assert.equal(calls, 2);
    document.visibilityState = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    await advance(250);
    assert.equal(calls, 3);
    window.dispatchEvent(new Event("pagehide"));
    await advance(60000);
    assert.equal(calls, 3);
    window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
    await advance(250);
    assert.equal(calls, 4);
    hold = true;
    window.dispatchEvent(new Event("online"));
    await advance(250);
    window.dispatchEvent(new Event("focus"));
    await advance(250);
    assert.equal(calls, 5);
    release();
    hold = false;
    await advance(0);
    await advance(60000);
    assert.equal(calls, 6);
    stop();
    window.dispatchEvent(new Event("focus"));
    await advance(60000);
    assert.equal(calls, 6);
  } finally {
    stop();
    if (originalDocument === undefined) delete globalThis.document; else globalThis.document = originalDocument;
    if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
  }
});
