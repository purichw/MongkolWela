import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { hasReadableDatabase, supabaseClient } from "./_database.js";
import { isProductionRuntime } from "./_shared.js";
import { validateMediaAsset } from "../../src/lib/admin-media-library.js";

const PREFIX = "media:";
const unavailable = () => Object.assign(new Error("ไม่สามารถเชื่อมต่อทะเบียนคลังสื่อได้ กรุณาลองอีกครั้ง"), { statusCode: 503 });
const conflict = () => Object.assign(new Error("ไฟล์นี้มีข้อมูลใหม่ในคลังแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนบันทึกอีกครั้ง"), { statusCode: 409 });
let queue = Promise.resolve();
function database() {
  if (!hasReadableDatabase() && !process.env.VERCEL && !isProductionRuntime()) return null;
  const client = supabaseClient({ service: true });
  if (!client) throw unavailable();
  return client;
}
function localPath() { return path.join(process.env.MONGKOLWELA_MEDIA_DIR || path.join(process.cwd(), ".local"), "media-library.json"); }
async function readLocal() {
  try { const rows = JSON.parse(await fs.readFile(localPath(), "utf8")); if (!Array.isArray(rows)) throw unavailable(); return rows; }
  catch (error) { if (error.code === "ENOENT") return []; throw unavailable(); }
}
export async function readMediaAssets() {
  const client = database();
  if (!client) return readLocal();
  const assets = [];
  for (let offset = 0; ; offset += 200) {
    const { data, error } = await client.from("cms_documents").select("content").like("id", `${PREFIX}%`).order("id").range(offset, offset + 199);
    if (error || !data) throw unavailable();
    assets.push(...data.map(row => row.content));
    if (data.length < 200) return assets;
  }
}
export async function saveMediaAsset(input, { expectedVersion, actor }) {
  const asset = validateMediaAsset(input);
  const id = createHash("sha256").update(asset.src).digest("hex");
  const make = previous => {
    if (previous ? !expectedVersion || previous.version !== expectedVersion : Boolean(expectedVersion)) throw conflict();
    const now = new Date().toISOString();
    return { ...asset, id, version: randomUUID(), createdAt: previous?.createdAt || now, updatedAt: now, updatedBy: actor };
  };
  const client = database();
  if (!client) {
    const operation = queue.then(async () => {
      const rows = await readLocal();
      const result = make(rows.find(row => row.id === id));
      const file = localPath();
      await fs.mkdir(path.dirname(file), { recursive: true });
      const temporary = `${file}.${randomUUID()}.tmp`;
      await fs.writeFile(temporary, JSON.stringify([...rows.filter(row => row.id !== id), result]));
      await fs.rename(temporary, file);
      return result;
    });
    queue = operation.catch(() => {});
    return operation;
  }
  const { data: previous, error: readError } = await client.from("cms_documents").select("content").eq("id", `${PREFIX}${id}`).maybeSingle();
  if (readError) throw unavailable();
  const result = make(previous?.content);
  // Only id='live' is public under the existing cms_documents RLS policy.
  const document = { id: `${PREFIX}${id}`, content: result, status: "draft", schema_version: 1, updated_at: result.updatedAt, published_by: actor };
  const query = previous ? client.from("cms_documents").update(document).eq("id", document.id).eq("content->>version", expectedVersion) : client.from("cms_documents").insert(document);
  const { data, error } = await query.select("content");
  if (error?.code === "23505") throw conflict();
  if (error) throw unavailable();
  if (!data?.length) throw conflict();
  return data[0].content;
}
