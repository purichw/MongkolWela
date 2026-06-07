export function createTempleSlug(temple) {
  const rank = String(temple.rank || "").padStart(3, "0");
  const text = `${rank}-${temple.name || "temple"}-${temple.province || "thailand"}`;
  return text
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function getTempleDetailUrl(collection, temple) {
  return `/temples/${collection}/${createTempleSlug(temple)}/`;
}
