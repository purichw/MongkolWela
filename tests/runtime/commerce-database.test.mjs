import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { commerceFixture } from "../helpers/commerce-fixtures.mjs";
import { TABLES, auditRecord } from "../../api/commerce/_domain.js";

test("PostgreSQL migration, atomic commit, conflict, foreign keys and private roles", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role;");
    await db.exec(await fs.readFile(new URL("../../supabase/migrations/20260920000000_commerce_and_merit.sql", import.meta.url), "utf8"));
    const f = commerceFixture();
    const changes = TABLES.flatMap(table => f.state[table].map(value => ({ table, value })));
    const commit = (revision, rows) => db.query("select commerce_commit($1, $2::jsonb, 'test', 'seed') as version", [revision, JSON.stringify(rows)]);
    await commit(0, changes);
    const snapshot = (await db.query("select commerce_snapshot(false) as data")).rows[0].data;
    assert.equal(snapshot.revision, 1); assert.equal(snapshot.products.length, 2);
    await assert.rejects(commit(0, changes), /conflict/i);
    const bad = { table: "products", value: { ...f.product, id: "90000000-0000-4000-8000-000000000001", orgId: "90000000-0000-4000-8000-000000000002" } };
    await assert.rejects(commit(1, [{ table: "products", value: { ...f.product, title: "not committed" } }, bad]), /foreign key/i);
    assert.equal((await db.query("select commerce_snapshot(false) as data")).rows[0].data.products.find(p => p.id === f.product.id).title, f.product.title);
    const revised = { ...f.channel, url: "https://example.test/reviewed-new", status: "review" };
    await commit(1, [{ table: "channels", value: revised }]);
    const audit = (await db.query("select records from commerce_audit order by id desc limit 1")).rows[0].records[0];
    assert.deepEqual(audit.before, auditRecord(f.channel));
    assert.deepEqual(audit.after, auditRecord(revised));
    const privateAudit = (await db.query("select commerce_audit_record($1::jsonb) as data", [JSON.stringify({ name: "private", contact: "private", accessHash: "secret", address: "private", status: "held", receivedSatang: 10000 })])).rows[0].data;
    assert.deepEqual(privateAudit, { status: "held", receivedSatang: 10000 });
    await db.exec("set role anon");
    await assert.rejects(db.query("select * from commerce_orders"), /permission denied/i);
    await assert.rejects(db.query("select commerce_snapshot(false)"), /permission denied/i);
    await assert.rejects(commit(1, changes), /permission denied/i);
    await db.exec("reset role; set role authenticated");
    await assert.rejects(db.query("select * from commerce_members"), /permission denied/i);
    await db.exec("reset role; set role service_role");
    assert.equal((await db.query("select commerce_snapshot(true) as data")).rows[0].data.members.length, 0);
    await assert.rejects(db.query("update commerce_audit set actor='changed'"), /permission denied/i);
  } finally { await db.close(); }
});
