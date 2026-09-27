import { list as splitPlaceList } from "../../lib/place-detail-view.js";
const compareThai = (a, b) => a.localeCompare(b, "th");

export function mediaProviderStatus(media, failed = false) {
  if (failed) return "ยังไม่สามารถโหลดการตั้งค่าอัปโหลดได้";
  return media?.provider && media[media.provider]?.enabled
    ? `${media.provider} พร้อมใช้งาน`
    : "ยังไม่ได้ตั้งค่าผู้ให้บริการอัปโหลด";
}

// Count references in managed content, not guessed traffic or provider storage.
export function collectAdminMedia(content, catalog, imageValue) {
  const images = new Map();
  const add = (src, reference) => {
    if (typeof src !== "string" || !src.trim()) return;
    src = src.trim();
    if (!/^(https?:\/\/|\/[^/]|data:image\/)/i.test(src)) return;
    let name = "รูปภาพฝังในเนื้อหา";
    if (!src.startsWith("data:")) {
      let filename;
      try { filename = new URL(src, "https://local.invalid").pathname.split("/").pop(); }
      catch { return; }
      try { name = decodeURIComponent(filename) || "รูปภาพ"; }
      catch { name = filename || "รูปภาพ"; }
    }
    if (!images.has(src)) images.set(src, { src, name, references: [] });
    images.get(src).references.push(reference);
  };
  for (const page of content?.pages || []) {
    const ref = { pageId: page.id, label: page.label || page.route || page.id, enabled: page.enabled !== false };
    for (const patch of page.patches || []) {
      if (patch.kind === "image") add(patch.src, { ...ref, enabled: ref.enabled && patch.enabled !== false, slot: patch.label || patch.selector });
    }
    for (const block of page.blocks || []) {
      const src = block.type === "hero" ? block.props?.image : block.type === "image" ? block.props?.src : "";
      add(src, { ...ref, enabled: ref.enabled && block.enabled !== false, slot: block.props?.title || block.id || block.type });
    }
  }
  for (const place of catalog || []) {
    const edit = content?.temples?.records?.[place.key];
    for (const role of ["card", "hero", "map"]) {
      for (const viewport of ["desktop", "mobile"]) {
        add(imageValue(place, edit, role, viewport), { templeKey: place.key, label: place.temple.name, slot: `${role} / ${viewport}`, enabled: true });
      }
    }
  }
  return [...images.values()];
}

export function catalogTaxonomy(catalog) {
  const regions = new Map();
  const modes = new Map();
  const count = (map, value) => { if (value) map.set(value, (map.get(value) || 0) + 1); };
  for (const { temple } of catalog || []) {
    count(regions, String(temple.region || "").trim());
    const values = splitPlaceList(temple.travelModes);
    for (const mode of new Set(values.map(value => String(value).trim()).filter(Boolean))) count(modes, mode);
  }
  const rows = map => [...map].sort(([a], [b]) => compareThai(a, b)).map(([label, count]) => ({ label, count }));
  return { regions: rows(regions), modes: rows(modes) };
}
