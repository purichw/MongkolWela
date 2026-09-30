export const TEMPLE_SLUG_MAX_LENGTH = 100;
export const reservedTempleSlugs = new Set(["index", "new", "edit", "api", "admin", "search", "page", "feed", "sitemap", "robots"]);

export function templeSlugError(slug) {
  if (typeof slug !== "string" || !slug) return "กรุณาระบุชื่อ URL";
  if (slug.length > TEMPLE_SLUG_MAX_LENGTH) return `ชื่อ URL ต้องไม่เกิน ${TEMPLE_SLUG_MAX_LENGTH} ตัวอักษร`;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return "ใช้ a-z ตัวเลข และขีดกลาง โดยไม่มีช่องว่าง";
  if (reservedTempleSlugs.has(slug)) return "ชื่อ URL นี้สงวนไว้สำหรับระบบ";
  return "";
}

export function uniqueTempleSlug(proposed, occupied) {
  if (!occupied.has(proposed)) return proposed;
  for (let index = 2; ; index++) {
    const suffix = `-${index}`;
    const candidate = proposed.slice(0, TEMPLE_SLUG_MAX_LENGTH - suffix.length).replace(/-+$/g, "") + suffix;
    if (!occupied.has(candidate)) return candidate;
  }
}
