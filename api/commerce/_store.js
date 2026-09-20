import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { supabaseClient, hasReadableDatabase } from "../admin/_database.js";
import { isProductionRuntime } from "../admin/_shared.js";
import { emptyCommerce, mutateCommerce, auditRecord, fail } from "./_domain.js";

let queue = Promise.resolve();
export function isLocalCommercePreview() {
  return process.env.MONGKOLWELA_COMMERCE_PREVIEW === "1" && !process.env.VERCEL && !isProductionRuntime() && !hasReadableDatabase();
}
export function requireCommerceEnabled() {
  if (!isLocalCommercePreview() && process.env.MONGKOLWELA_COMMERCE_ENABLED !== "1") throw Object.assign(new Error("ระบบร้านค้าและร่วมบุญยังไม่เปิดบริการ"), { statusCode: 503, code: "COMMERCE_DISABLED" });
}
function client() {
  requireCommerceEnabled();
  if (isLocalCommercePreview()) return null;
  return supabaseClient({ service: true }) || fail("ระบบร้านค้ายังไม่ได้เชื่อมฐานข้อมูล", 503);
}
const localFile = () => path.join(process.env.MONGKOLWELA_COMMERCE_DIR || path.join(process.cwd(), ".local/commerce-preview"), "commerce.json");
export async function readCommerce({ publicOnly = false } = {}) {
  const db = client();
  if (!db) {
    try { return JSON.parse(await fs.readFile(localFile(), "utf8")); }
    catch (error) { if (error.code === "ENOENT") return emptyCommerce(); fail("อ่านข้อมูลร้านค้าไม่สำเร็จ", 503); }
  }
  const { data, error } = await db.rpc("commerce_snapshot", { public_only: publicOnly });
  if (error || !data) fail("ระบบร้านค้ายังไม่พร้อม กรุณาลองใหม่หรือติดต่อผู้ดูแล", 503);
  return data;
}
export async function transactCommerce(command, actor, options) {
  const db = client();
  if (!db) {
    const operation = queue.then(async () => {
      const source = await readCommerce();
      const mutation = mutateCommerce(source, command, actor, options);
      if (mutation.changes.length) {
        mutation.state.revision += 1;
        mutation.state.audit = [...(source.audit || []), { actor: actor.admin ? `admin:${actor.actor}` : actor.userId || "guest", op: command.op, at: new Date().toISOString(), records: mutation.changes.map(c => ({ table: c.table, id: c.value.id, before: auditRecord(source[c.table].find(r => r.id === c.value.id)), after: auditRecord(c.value) })) }];
        const file = localFile();
        await fs.mkdir(path.dirname(file), { recursive: true });
        const temporary = `${file}.${randomUUID()}.tmp`;
        await fs.writeFile(temporary, JSON.stringify(mutation.state), { mode: 0o600 });
        await fs.rename(temporary, file);
      }
      return mutation.result;
    });
    queue = operation.catch(() => {});
    return operation;
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    const source = await readCommerce();
    const mutation = mutateCommerce(source, command, actor, options);
    if (!mutation.changes.length) return mutation.result;
    const { error } = await db.rpc("commerce_commit", { expected_revision: source.revision, changes: mutation.changes, actor_id: actor.admin ? `admin:${actor.actor}` : actor.userId || "guest", operation_name: command.op });
    if (!error) return mutation.result;
    if (error.code !== "40001") fail("บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่", 503);
  }
  fail("มีรายการพร้อมกัน กรุณาลองใหม่", 409);
}
