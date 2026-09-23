const attributes = new Set(["href", "src", "alt", "title", "placeholder", "aria-label", "content", "target", "rel", "data-email", "data-line-id", "data-email-subject"]);

export function safeContentUrl(value, { link = false } = {}) {
  if (typeof value !== "string" || /[\\\u0000-\u0020]/.test(value)) return false;
  if (!value) return true;
  try {
    const url = new URL(value, "https://mongkolwela.invalid/");
    return ["https:", "http:", ...(link ? ["mailto:", "tel:"] : [])].includes(url.protocol);
  } catch { return false; }
}

export function validContentPatch(patch) {
  if (!patch || typeof patch.selector !== "string" || !patch.selector.trim()) return false;
  if (patch.kind === "image") return safeContentUrl(patch.src ?? "");
  if (patch.kind === "text-node") return Number.isInteger(patch.nodeIndex) && patch.nodeIndex >= 0 && typeof patch.value === "string";
  if (patch.kind === "attr") return attributes.has(patch.attr) && typeof patch.value === "string"
    && (!["href", "src"].includes(patch.attr) || safeContentUrl(patch.value, { link: patch.attr === "href" }));
  return ["text", "html"].includes(patch.kind) && typeof patch.value === "string";
}

export function validateContentPatches(content) {
  const invalid = () => { throw Object.assign(new Error("ช่องเนื้อหาหรือลิงก์ไม่ถูกต้อง กรุณาตรวจสอบก่อนเผยแพร่"), { statusCode: 400 }); };
  if (!Array.isArray(content.pages)) invalid();
  for (const owner of [content.site, ...content.pages]) {
    if (owner?.patches === undefined) continue;
    if (!Array.isArray(owner.patches) || owner.patches.some(patch => !validContentPatch(patch))) invalid();
  }
}

export function contentPatchNodes(root, selector) {
  try { return [...root.querySelectorAll(selector)]; } catch { return []; }
}

export function safeContentHtml(root, value) {
  const template = root.createElement("template");
  template.innerHTML = String(value || "");
  template.content.querySelectorAll("script,iframe,object,embed,link,meta,style").forEach(node => node.remove());
  for (const node of template.content.querySelectorAll("*")) {
    for (const attr of [...node.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on") || name === "srcdoc" || (["href", "src", "xlink:href"].includes(name) && !safeContentUrl(attr.value, { link: name !== "src" }))) node.removeAttribute(attr.name);
    }
  }
  return template.innerHTML;
}

// Read published content in an inert document, without running page scripts.
export function projectContentPatches(root, patches) {
  for (const patch of patches) {
    if (patch.enabled === false || !validContentPatch(patch)) continue;
    for (const node of contentPatchNodes(root, patch.selector)) {
      if (patch.kind === "text-node") {
        if (node.childNodes[patch.nodeIndex]?.nodeType === 3) node.childNodes[patch.nodeIndex].textContent = patch.value;
      } else if (patch.kind === "image") {
        node.setAttribute("src", patch.src || "");
        if (node.hasAttribute("data-home-hero-image")) node.setAttribute("data-carousel-src", patch.src || "");
        if (patch.alt !== undefined) node.setAttribute("alt", patch.alt);
      } else if (patch.kind === "attr") node.setAttribute(patch.attr, patch.value);
      else if (patch.kind === "html") node.innerHTML = safeContentHtml(root, patch.value);
      else node.textContent = patch.value;
    }
  }
}
