export const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]);

// The same decorative glyph contract serves Astro and client-rendered content.
/** @returns {{ class: string, "aria-hidden": "true", style: string }} */
export function iconAttributes(name, className = "") {
  if (typeof name !== "string" || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name)) throw new TypeError("Invalid icon name");
  return {
    class: ["ui-icon-mask", className].filter(Boolean).join(" "),
    "aria-hidden": "true",
    style: `mask-image:url('/assets/icons/lucide/${name}.svg')`,
  };
}

export function renderIcon(name, className = "") {
  const attributes = iconAttributes(name, className);
  return `<span ${Object.entries(attributes).map(([key, value]) => `${key}="${escapeHtml(value)}"`).join(" ")}></span>`;
}

export function iconMedallionClass(className = "") {
  return ["ui-medallion", className].filter(Boolean).join(" ");
}

// Content must be trusted icon markup (SiteIcon templates or renderIcon), not CMS text.
export function renderIconMedallion(iconMarkup, className = "") {
  return `<span class="${escapeHtml(iconMedallionClass(className))}">${iconMarkup}</span>`;
}
