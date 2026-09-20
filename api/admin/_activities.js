import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { hasReadableDatabase, supabaseClient } from "./_database.js";
import { isProductionRuntime } from "./_shared.js";

const PREFIX = "activity:";
const conflict = () => Object.assign(new Error("กิจกรรมนี้ถูกแก้ไขจากอีกหน้าต่างแล้ว กรุณาโหลดรายการล่าสุดก่อนบันทึกอีกครั้ง"), { statusCode: 409 });
const unavailable = () => Object.assign(new Error("ไม่สามารถเชื่อมต่อข้อมูลกิจกรรมได้ กรุณาลองใหม่"), { statusCode: 503 });
let localQueue = Promise.resolve();

function database() {
  if (!hasReadableDatabase() && !process.env.VERCEL && !isProductionRuntime()) return null;
  const client = supabaseClient({ service: true });
  if (!client) throw unavailable();
  return client;
}

function localPath() {
  return path.join(process.env.MONGKOLWELA_ACTIVITIES_DIR || path.join(process.cwd(), ".local"), "activities.json");
}

async function readLocal() {
  try { return JSON.parse(await fs.readFile(localPath(), "utf8")); }
  catch (error) { if (error.code === "ENOENT") return []; throw unavailable(); }
}

export async function readActivities({ templeId, publicOnly = false } = {}) {
  const client = database();
  if (!client) return (await readLocal()).filter((event) => !templeId || event.templeId === templeId);
  const events = [];
  // Each document is private under the existing id='live' public RLS policy.
  for (let offset = 0; ; offset += 200) {
    let query = client.from("cms_documents").select("content").like("id", `${PREFIX}%`).order("id").range(offset, offset + 199);
    if (templeId) query = query.eq("content->>templeId", templeId);
    if (publicOnly) query = query.in("content->>status", ["published", "postponed", "cancelled"]);
    const { data, error } = await query;
    if (error || !data) throw unavailable();
    events.push(...data.map((row) => row.content));
    if (data.length < 200) return events;
  }
}

export async function saveActivity(input, { id, expectedVersion, actor }) {
  if (id && !/^[a-f0-9-]{36}$/.test(id)) throw Object.assign(new Error("รหัสกิจกรรมไม่ถูกต้อง"), { statusCode: 422 });
  const makeEvent = (previous) => {
    if (id && (!previous || !expectedVersion || previous.version !== expectedVersion)) throw conflict();
    return {
      ...input, id: id || randomUUID(), version: randomUUID(), updatedAt: new Date().toISOString(), updatedBy: actor,
      history: previous ? [...(previous.history || []), { version: previous.version, status: previous.status, updatedAt: previous.updatedAt, updatedBy: previous.updatedBy }].slice(-20) : [],
    };
  };
  const client = database();
  if (!client) {
    const operation = localQueue.then(async () => {
      const events = await readLocal();
      const event = makeEvent(events.find((item) => item.id === id));
      const file = localPath();
      await fs.mkdir(path.dirname(file), { recursive: true });
      const temporary = `${file}.${randomUUID()}.tmp`;
      await fs.writeFile(temporary, JSON.stringify([...events.filter((item) => item.id !== id), event]));
      await fs.rename(temporary, file);
      return event;
    });
    localQueue = operation.catch(() => {});
    return operation;
  }
  let previous;
  if (id) {
    const { data, error } = await client.from("cms_documents").select("content").eq("id", `${PREFIX}${id}`).maybeSingle();
    if (error) throw unavailable();
    previous = data?.content;
  }
  const event = makeEvent(previous);
  const document = { id: `${PREFIX}${event.id}`, content: event, status: "draft", schema_version: 1, updated_at: event.updatedAt, published_by: actor };
  const query = id
    ? client.from("cms_documents").update(document).eq("id", document.id).eq("content->>version", expectedVersion)
    : client.from("cms_documents").insert(document);
  const { data, error } = await query.select("content");
  if (error) throw unavailable();
  if (!data?.length) throw conflict();
  return data[0].content;
}
