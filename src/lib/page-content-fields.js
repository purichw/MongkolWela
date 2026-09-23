export function prepareContentFields(root) {
  const counts = new Map();
  for (const node of root.querySelectorAll("[data-cms-field]")) {
    const key = node.getAttribute("data-cms-field");
    const occurrence = counts.get(key) || 0;
    counts.set(key, occurrence + 1);
    node.setAttribute("data-cms-occurrence", String(occurrence));
  }
}

export function scanContentFields(root) {
  prepareContentFields(root);
  const fields = [];
  for (const node of root.querySelectorAll("[data-cms-field]")) {
    if (node.matches("img[data-cms-media][id], img[data-home-hero-image][id]")) continue;
    if (node.closest("[data-library-binding], [data-cms-runtime], [data-header-cta], [data-photo-preview], [data-photo-state], [data-camera-title], [data-plw-line-title], [data-astro-heading], [data-life-graph-output], [data-topbar-realtime], [data-home-lunar], [data-home-weekday], [data-temple-count]")) continue;
    const key = `${node.getAttribute("data-cms-field")}-${node.getAttribute("data-cms-occurrence")}`;
    const selector = `[data-cms-field="${node.getAttribute("data-cms-field")}"][data-cms-occurrence="${node.getAttribute("data-cms-occurrence")}"]`;
    const context = node.closest("section, article, aside, header, footer")?.querySelector("h1,h2,h3")?.textContent.trim() || "เนื้อหาหน้าเว็บ";
    for (const [index, child] of [...node.childNodes].entries()) {
      if (child.nodeType !== 3 || !/[\p{L}]/u.test(child.textContent)) continue;
      fields.push({ id: `${key}-text-${index}`, selector, kind: "text-node", nodeIndex: index, label: child.textContent.trim().slice(0, 90), value: child.textContent, context });
    }
    if (node.tagName === "IMG") fields.push({ id: `${key}-image`, selector, kind: "image", label: node.getAttribute("alt") || "รูปประกอบ", src: node.getAttribute("src") || "", alt: node.getAttribute("alt") || "", context });
    for (const attr of ["href", "placeholder", "title"]) {
      const value = node.getAttribute(attr);
      if (!value || node.closest("[data-home-header]")) continue;
      fields.push({ id: `${key}-${attr}`, selector, kind: "attr", attr, label: `${attr === "href" ? "ลิงก์" : "ข้อความ"}: ${node.textContent.trim().slice(0, 65) || value}`, value, context });
    }
  }
  for (const node of root.querySelectorAll("img[data-cms-media][id], img[data-home-hero-image][id]")) {
    fields.push({ id: node.id, selector: `#${node.id}`, kind: "image", label: node.getAttribute("alt") || "ภาพแบนเนอร์", src: node.getAttribute("data-carousel-src") || node.getAttribute("src") || "", alt: node.getAttribute("alt") || "", context: "ภาพประกอบ" });
  }
  return fields;
}
