export function contentBinding(key, record, path, options = {}) {
  return { "data-library-binding": JSON.stringify({ key, record: String(record), path, ...options }) };
}

const originals = new WeakMap();
export function applyContentBindings(root, library = {}) {
  for (const node of root.querySelectorAll("[data-library-binding]")) {
    let binding;
    try { binding = JSON.parse(node.dataset.libraryBinding); } catch { continue; }
    const { key, record, path, attr, prefix = "", join } = binding;
    if (attr && !["src", "alt", "content"].includes(attr)) continue;
    if (!originals.has(node)) originals.set(node, attr ? node.getAttribute(attr) : node.textContent);
    const fields = library[key]?.[record] || {};
    let value;
    if (join && Array.isArray(binding.seed)) {
      value = binding.seed.map((text, i) => fields[`${path}/${i}`] ?? text).join(join);
    } else if (Object.hasOwn(fields, path)) value = prefix + fields[path];
    else value = originals.get(node);
    if (attr) {
      if (value === null) node.removeAttribute(attr);
      else node.setAttribute(attr, value);
    } else node.textContent = value;
  }
}
