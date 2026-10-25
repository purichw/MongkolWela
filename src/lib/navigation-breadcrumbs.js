import { navigationHref, navigationLabel, navigationModel, navEscape } from "./site-navigation.js";
import { canonicalUrl, createBreadcrumbJsonLd } from "./seo.js";

const routePath = value => {
  const href = navigationHref(value);
  if (!href?.startsWith("/")) return null;
  const path = href.split(/[?#]/)[0];
  return path === "/" ? path : `${path.replace(/\/+$/, "")}/`;
};

export function navigationBreadcrumbs(content, pathname) {
  const route = routePath(pathname);
  const pages = content?.pages || [];
  const home = { label: pages.find(page => routePath(page.route) === "/")?.label || "หน้าแรก", href: "/" };
  const page = pages.find(page => routePath(page.route) === route);
  const model = navigationModel(content?.navigation);
  const find = (items, parents = []) => {
    let match = [];
    for (const item of items) {
      const trail = [...parents, { label: item.label, ...(item.href ? { href: item.href } : {}) }];
      // A group and its landing-page child can share a URL. Prefer the full trail.
      if (item.href && routePath(item.href) === route && !item.href.includes("#") && trail.length > match.length) match = trail;
      const child = find(item.items, trail);
      if (child.length > match.length) match = child;
    }
    return match;
  };
  if (route === "/") return [home];
  const trail = find(model.tabs);
  if (!trail.length && page) trail.push({ label: navigationLabel(page.label, page.route), href: page.route });
  return [home, ...trail];
}

export function renderNavigationBreadcrumbs(items) {
  return items.map((item, index) => {
    const current = index === items.length - 1;
    const label = navEscape(item.label);
    const href = navigationHref(item.href);
    const node = current ? `<span aria-current="page">${label}</span>`
      : href ? `<a href="${navEscape(href)}">${label}</a>` : `<span>${label}</span>`;
    return `${index ? '<span aria-hidden="true">/</span>' : ""}${node}`;
  }).join("");
}

export function navigationBreadcrumbJsonLd(items, pathname) {
  return JSON.stringify({ "@context": "https://schema.org", ...createBreadcrumbJsonLd(items, canonicalUrl(pathname)) }).replace(/</g, "\\u003c");
}
