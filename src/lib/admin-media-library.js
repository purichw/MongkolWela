export const MEDIA_KINDS = { image: "รูปภาพ", video: "วิดีโอ", document: "เอกสาร" };

export function mediaFilename(src) {
  try { return decodeURIComponent(new URL(src, "https://local.invalid").pathname.split("/").pop()) || "ไฟล์สื่อ"; }
  catch { return "ไฟล์สื่อ"; }
}

export function mediaFormat(src) {
  try { return new URL(src, "https://local.invalid").pathname.match(/\.([a-z0-9]{2,5})$/i)?.[1].toUpperCase().replace("JPEG", "JPG") || "ไม่ระบุ"; }
  catch { return "ไม่ระบุ"; }
}

export function validateMediaAsset(value) {
  const fail = message => { throw Object.assign(new Error(message), { statusCode: 422 }); };
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("ข้อมูลไฟล์ไม่ถูกต้อง");
  const src = String(value.src || "").trim();
  if (!src || src.length > 2048 || /[\s\\\u0000-\u001f]/u.test(src) || !/^(https:\/\/|\/(?!\/))/i.test(src)) fail("กรุณาระบุ URL แบบ HTTPS หรือพาธไฟล์ในเว็บไซต์");
  try { const url = new URL(src, "https://local.invalid"); if (url.username || url.password) fail("URL ต้องไม่มีข้อมูลเข้าสู่ระบบ"); } catch { fail("URL ไม่ถูกต้อง"); }
  if (!Object.hasOwn(MEDIA_KINDS, value.kind)) fail("กรุณาเลือกประเภทสื่อ");
  const text = (name, max) => {
    const result = String(value[name] || "").trim();
    if (result.length > max) fail(`ข้อความ ${name} ยาวเกิน ${max} ตัวอักษร`);
    return result;
  };
  const number = (name, max) => {
    if (value[name] === undefined || value[name] === null || value[name] === "") return null;
    if (!Number.isSafeInteger(value[name]) || value[name] < 1 || value[name] > max) fail(`ข้อมูล ${name} ไม่ถูกต้อง`);
    return value[name];
  };
  return { src, kind: value.kind, name: text("name", 240) || mediaFilename(src).slice(0, 240), category: text("category", 80), description: text("description", 1000), bytes: number("bytes", 1024 ** 4), width: number("width", 100000), height: number("height", 100000) };
}

export function mediaInventory(references, assets = [], events = []) {
  const rows = new Map();
  for (const item of references) rows.set(item.src, { ...item, kind: "image", category: item.references.some(ref => ref.templeKey) ? "วัดและสถานที่" : "หน้าเว็บไซต์", references: [...item.references] });
  for (const event of events) {
    if (!event.imageUrl || !/^(https?:\/\/|\/[^/])/i.test(event.imageUrl)) continue;
    if (!rows.has(event.imageUrl)) rows.set(event.imageUrl, { src: event.imageUrl, name: mediaFilename(event.imageUrl), kind: "image", category: "กิจกรรม", references: [] });
    rows.get(event.imageUrl).references.push({ section: "dates", label: event.title, slot: "ภาพกิจกรรม", enabled: event.status === "published" });
  }
  for (const asset of assets) {
    const found = rows.get(asset.src);
    rows.set(asset.src, { ...found, ...asset, category: asset.category || found?.category || "ยังไม่จัดหมวดหมู่", references: found?.references || [] });
  }
  return [...rows.values()].map(row => ({ ...row, format: mediaFormat(row.src) }));
}

export function filterMedia(items, { kind = "image", search = "", format = "", category = "", sort = "newest", page = 1, pageSize = 20 } = {}) {
  const query = search.trim().normalize("NFC").toLocaleLowerCase("th");
  const rows = items.filter(item => item.kind === kind && (!format || item.format === format) && (!category || item.category === category) && (!query || [item.name, item.description, item.category, ...item.references.map(ref => ref.label)].join(" ").normalize("NFC").toLocaleLowerCase("th").includes(query)));
  rows.sort((a, b) => sort === "name" ? a.name.localeCompare(b.name, "th") : sort === "usage" ? b.references.length - a.references.length : (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.max(1, Math.min(page, pages));
  return { rows: rows.slice((current - 1) * pageSize, current * pageSize), total: rows.length, page: current, pages };
}

export function mediaMetadata(item) {
  const values = [];
  if (item.bytes) values.push(item.bytes >= 1024 ** 2 ? `${(item.bytes / 1024 ** 2).toFixed(1)} MB` : `${Math.ceil(item.bytes / 1024)} KB`);
  if (item.width && item.height) values.push(`${item.width} × ${item.height}`);
  if (!values.length) values.push(item.format === "ไม่ระบุ" ? MEDIA_KINDS[item.kind] : item.format, `อ้างอิง ${item.references.length} ตำแหน่ง`);
  return values.join(" · ");
}
