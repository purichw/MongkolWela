const registrations = new Map();
let activeLibrary = {};
const clone = value => JSON.parse(JSON.stringify(value));
const own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const protectedFields = new Set(["id", "slug", "number", "index", "group", "groupId", "suit", "rank", "level", "mode", "glyph", "lineId", "sourceIds", "tradition", "confidence", "element", "icon", "art", "imageCredit", "speed", "base", "min", "max", "card_id", "spreadType", "storageKey", "pageId", "symbol"]);

export function contentLeaves(value, path = []) {
  if (typeof value === "string") return [{ path: path.join("/"), value }];
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => (protectedFields.has(key) && !(key === "symbol" && path[0] === "symbolism")) || key.startsWith("_") || (key === "tone" && !/[\u0e00-\u0e7f]/.test(child))
    ? [] : contentLeaves(child, [...path, key]));
}

function records(value) {
  return Array.isArray(value)
    ? value.map((record, index) => [String(record?.id ?? record?.number ?? index), record])
    : Object.entries(value);
}

function label(record, id) {
  return record?.title || record?.nameTh || record?.name_th || record?.name || record?.label || record?.th || `รายการ ${id}`;
}

function apply(registration) {
  const overrides = activeLibrary[registration.key] || {};
  const targets = new Map(records(registration.value));
  for (const [id, seed] of records(registration.seed)) {
    const target = targets.get(id);
    for (const field of contentLeaves(seed)) {
      const path = field.path.split("/");
      let parent = target;
      for (const part of path.slice(0, -1)) parent = parent[part];
      parent[path.at(-1)] = own(overrides[id], field.path) && typeof overrides[id][field.path] === "string"
        ? overrides[id][field.path] : field.value;
    }
  }
}

// Preserve references used by active tools. Only registered editorial strings change.
/**
 * @template T
 * @param {string} key
 * @param {T} seed
 * @param {{ title: string, group: string, routes: string[] }} metadata
 * @returns {T}
 */
export function managedContent(key, seed, metadata) {
  if (registrations.has(key)) return registrations.get(key).value;
  const registration = { key, seed: clone(seed), value: clone(seed), ...metadata };
  registrations.set(key, registration);
  apply(registration);
  return registration.value;
}

export function applyContentLibrary(library = {}) {
  activeLibrary = library;
  for (const registration of registrations.values()) apply(registration);
}

export function contentCatalog() {
  return [...registrations.values()].map(({ key, seed, title, group, routes }) => ({
    key, title, group, routes,
    records: records(seed).map(([id, record]) => ({ id, label: label(record, id), fields: contentLeaves(record) })),
  }));
}

export function validateContentLibrary(library) {
  if (library === undefined) return;
  const invalid = message => { throw Object.assign(new Error(message), { statusCode: 400 }); };
  if (!library || Array.isArray(library) || typeof library !== "object") invalid("คลังเนื้อหาไม่ถูกต้อง");
  const catalog = new Map(contentCatalog().map(group => [group.key, group]));
  for (const [key, entries] of Object.entries(library)) {
    const group = catalog.get(key);
    if (!group || !entries || typeof entries !== "object" || Array.isArray(entries)) invalid(`ไม่พบหมวดเนื้อหา: ${key}`);
    const allowed = new Map(group.records.map(record => [record.id, new Set(record.fields.map(field => field.path))]));
    for (const [id, fields] of Object.entries(entries)) {
      if (!allowed.has(id) || !fields || typeof fields !== "object" || Array.isArray(fields)) invalid(`ไม่พบรายการเนื้อหา: ${key}/${id}`);
      for (const [path, value] of Object.entries(fields)) {
        if (!allowed.get(id).has(path) || typeof value !== "string" || value.length > 30000) invalid(`ช่องเนื้อหาไม่ถูกต้อง: ${key}/${id}/${path}`);
        if (/[<>]/.test(value)) invalid("เนื้อหาคำทำนายต้องเป็นข้อความธรรมดา ไม่ใช่ HTML");
        if (/(?:^|\/)(?:image|href|url|src|imageUrl|imageThumb|thumbImage)$/i.test(path) && value && (!/^(?:\/[^/\\]|https?:\/\/|#[\w-])/i.test(value) || /[\s"'\\\u0000-\u001f]/.test(value))) invalid("ลิงก์ต้องเป็น HTTP(S) หรือเส้นทางภายในเว็บไซต์");
      }
    }
  }
}

export function formatContentTemplate(template, values) {
  return template.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (token, key) => own(values, key) ? String(values[key]) : token);
}

export function libraryForPath(library, pathname) {
  const route = String(pathname || "/");
  const keys = new Set(contentCatalog().filter(group => group.routes.some(prefix => route.startsWith(prefix))).map(group => group.key));
  return Object.fromEntries(Object.entries(library || {}).filter(([key]) => keys.has(key)));
}
