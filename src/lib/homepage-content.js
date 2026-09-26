import { safeContentUrl } from "./content-patches.js";
import { sitePlaceholderImage } from "./image-placeholder.js";
import { homeHeroMetadata } from "./home-hero-media.js";

export const homepageCollections = {
  shortcuts: { selector: ".hero-links", item: "a", max: 3, title: ".hero-shortcut-full", mobileTitle: ".hero-shortcut-compact", description: "small", href: true, icon: "route" },
  daily: { selector: ".home-today-actions", item: "a", max: 3, title: "[data-cms-field]", href: true, icon: "calendar-days" },
  intents: { selector: ".home-intent-grid", item: "a", max: 12, title: "strong", description: "p", image: "img", href: true, icon: "target" },
  stops: { selector: ".home-sample-content ol", item: "li", max: 9, title: "strong", description: "p", image: "img", time: "time", icon: "map-pin" },
  categories: { selector: ".home-collection-grid", item: "a", max: 8, title: "strong", description: "p", image: "img", href: true, icon: "layout-grid" },
  tools: { selector: ".home-tool-links", item: "a", max: 8, title: ".home-tool-full strong", mobileTitle: ".home-tool-compact strong", description: ".home-tool-full small", mobileDescription: ".home-tool-compact small", href: true, icon: "sparkles" },
};

export function readHomepageCollections(root) {
  return Object.fromEntries(Object.entries(homepageCollections).map(([key, definition]) => [key,
    [...(root.querySelector(definition.selector)?.querySelectorAll(`:scope > ${definition.item}`) || [])].map((node, index) => {
      const item = { id: `original-${index}`, template: index, title: node.querySelector(definition.title)?.textContent.trim() || "" };
      for (const field of ["description", "mobileTitle", "mobileDescription", "time"]) if (definition[field]) item[field] = node.querySelector(definition[field])?.textContent.trim() || "";
      if (definition.href) item.href = node.getAttribute("href") || "/";
      if (definition.image) {
        const image = node.querySelector(definition.image);
        item.image = image?.getAttribute("src") || ""; item.alt = image?.getAttribute("alt") || "";
        for (const [field, attr] of Object.entries(homeHeroMetadata)) item[field] = image?.getAttribute(attr) || "";
      }
      return item;
    }),
  ]));
}

export function validateHomepageContent(content) {
  const fail = () => { throw Object.assign(new Error("ข้อมูลการ์ดหน้าแรกไม่ถูกต้อง กรุณาตรวจสอบข้อความ รูปภาพ และลิงก์"), { statusCode: 400 }); };
  for (const page of content.pages || []) {
    if (page.homepage === undefined) continue;
    if (page.id !== "home" || !page.homepage || typeof page.homepage !== "object" || Array.isArray(page.homepage)) fail();
    const collections = page.homepage.collections;
    if (!collections || typeof collections !== "object" || Array.isArray(collections)) fail();
    for (const [key, items] of Object.entries(collections)) {
      const definition = homepageCollections[key];
      if (!definition || !Array.isArray(items) || items.length > definition.max) fail();
      const ids = new Set();
      for (const item of items) {
        if (!item || typeof item.id !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(item.id) || ids.has(item.id) || !Number.isInteger(item.template) || item.template < 0 || item.template > 11) fail();
        ids.add(item.id);
        if (typeof item.title !== "string" || item.title.length > 200) fail();
        for (const field of ["description", "mobileTitle", "mobileDescription", "time", "alt", ...Object.keys(homeHeroMetadata)]) if (item[field] !== undefined && (typeof item[field] !== "string" || item[field].length > 2000)) fail();
        if (item.href !== undefined && !safeContentUrl(item.href, { link: true })) fail();
        if (item.image !== undefined && !safeContentUrl(item.image)) fail();
        for (const field of ["sourceUrl", "licenseUrl"]) if (item[field] !== undefined && !safeContentUrl(item[field])) fail();
      }
    }
  }
}

// Retain the original nodes so patch removal and later live revisions remain reversible.
const originals = new WeakMap();
export function resetHomepageCollections(root) {
  for (const [container, nodes] of originals.get(root) || []) container.replaceChildren(...nodes);
}

export function applyHomepageCollections(root, homepage) {
  resetHomepageCollections(root);
  if (!homepage?.collections) return;
  let saved = originals.get(root);
  if (!saved) { saved = new Map(); originals.set(root, saved); }
  for (const [key, items] of Object.entries(homepage.collections)) {
    const definition = homepageCollections[key];
    if (!definition || !Array.isArray(items)) continue;
    const container = root.querySelector(definition.selector);
    if (!container) continue;
    if (!saved.has(container)) saved.set(container, [...container.childNodes]);
    const templates = saved.get(container).filter(node => node.nodeType === 1 && node.matches(definition.item));
    const cards = items.slice(0, definition.max).map(item => {
      const source = templates[item.template] || templates[0];
      if (!source) return null;
      const node = source.cloneNode(true);
      node.dataset.homeCard = item.id;
      node.querySelectorAll("[id]").forEach(child => { child.id = `home-${key}-${item.id}-${child.id}`; });
      for (const field of ["title", "description", "mobileTitle", "mobileDescription", "time"]) {
        if (definition[field] && typeof item[field] === "string") {
          const target = node.querySelector(definition[field]);
          if (target) target.textContent = item[field];
        }
      }
      if (definition.href && safeContentUrl(item.href, { link: true })) node.setAttribute("href", item.href || "/");
      if (node.hasAttribute("aria-label")) node.setAttribute("aria-label", item.title);
      if (definition.image) {
        const image = node.querySelector(definition.image);
        if (image && safeContentUrl(item.image)) {
          image.removeAttribute("srcset"); image.src = item.image || sitePlaceholderImage; image.alt = item.alt || "";
          for (const [field, attr] of Object.entries(homeHeroMetadata)) if (item[field] !== undefined) image.setAttribute(attr, item[field]);
          if (item.position !== undefined) image.style.objectPosition = item.position || "50% 50%";
        }
      }
      return node;
    }).filter(Boolean);
    container.replaceChildren(...cards);
  }
}
