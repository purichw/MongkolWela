import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createCommercePreview } from "../helpers/commerce-preview.mjs";
import { guestCommand } from "../helpers/commerce-fixtures.mjs";
import { commerceActor } from "../../api/commerce/_auth.js";
import { createSessionCookie, COOKIE_NAME } from "../../api/admin/_shared.js";

test("HTTP auth, origin, parallel capacity, fail-closed deployment and independent storage", async () => {
  await fs.mkdir(".local/commerce-tests", { recursive: true });
  const directory = await fs.mkdtemp(path.join(process.cwd(), ".local/commerce-tests/api-"));
  const server = await createCommercePreview({ directory, seed: true });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (body, headers = {}) => fetch(`${base}/api/commerce`, { method: "POST", headers: { "Content-Type": "application/json", Origin: base, ...headers }, body: JSON.stringify(body) });
  try {
    const response = await fetch(`${base}/api/commerce`);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const catalog = await response.json();
    assert.equal(catalog.payments.enabled, false);
    assert.equal((await fetch(`${base}/api/commerce?view=manage`)).status, 403);
    assert.equal((await request({ op: "save", table: "organizations", data: {} })).status, 403);
    assert.equal((await request({ op: "checkout" })).status, 503);
    assert.equal((await request({ op: "checkout" }, { Origin: "https://evil.example" })).status, 403);
    const campaign = catalog.campaigns.find(c => c.kind === "fund");
    const commands = [1, 2].map(() => guestCommand("booking.create", { campaignId: campaign.id, version: campaign.version, name: "parallel", contact: "private@example.test", quantity: 2 }));
    const responses = await Promise.all(commands.map(c => request(c)));
    assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
    const fresh = await (await fetch(`${base}/api/commerce`)).json();
    assert.equal(fresh.campaigns.find(c => c.id === campaign.id).available, 1);
    assert.equal(JSON.stringify(fresh).includes("private@example.test"), false);
    const localAdminCookie = createSessionCookie("local-only");
    process.env.VERCEL = "1";
    assert.deepEqual(await commerceActor({ headers: { cookie: `${COOKIE_NAME}=${encodeURIComponent(localAdminCookie)}` } }), {});
    const disabled = await fetch(`${base}/api/commerce`);
    assert.equal(disabled.status, 503);
    assert.equal((await disabled.json()).code, "COMMERCE_DISABLED");
    assert.equal((await request(commands[0])).status, 503);
    delete process.env.VERCEL;
    assert.equal((await fetch(`${base}/api/commerce`)).status, 200);
  } finally { delete process.env.VERCEL; server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
