import { renderIcon } from "./ui-markup.js";

export const navEscape = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]);

export function navigationHref(value) {
  const href = String(value || "").trim();
  if (!href || /[\u0000-\u0020\\]/u.test(href) || href.startsWith("//")) return null;
  if (/^[a-z][a-z\d+.-]*:/i.test(href)) return /^(https?:\/\/|mailto:|tel:)/i.test(href) ? href : null;
  return href.startsWith("/") ? href : `/${href}`;
}

export function validateNavigation(navigation) {
  if (navigation === undefined) return;
  const fail = () => { throw Object.assign(new Error("ข้อมูลเมนูไม่ถูกต้อง กรุณาตรวจสอบชื่อเมนู ลิงก์ และรูปภาพ"), { statusCode: 400 }); };
  if (!navigation || typeof navigation !== "object" || Array.isArray(navigation)) fail();
  const visit = (items, depth = 0) => {
    if (items === undefined) return;
    if (!Array.isArray(items) || items.length > 200 || depth > 5) fail();
    const ids = new Set();
    for (const item of items) {
      if (!item || typeof item !== "object" || typeof item.label !== "string" || item.label.length > 200) fail();
      if (item.id && (typeof item.id !== "string" || item.id.length > 150 || ids.has(item.id))) fail();
      if (item.id) ids.add(item.id);
      if (item.href && (typeof item.href !== "string" || item.href.length > 2000 || !navigationHref(item.href))) fail();
      if (item.image && (typeof item.image !== "string" || item.image.length > 2000 || !/^(\/[^/]|https?:\/\/)/.test(item.image) || /[\s\\]/u.test(item.image))) fail();
      for (const key of ["enabled", "section", "desktop", "mobile"]) if (item[key] !== undefined && typeof item[key] !== "boolean") fail();
      for (const key of ["desktopLabel", "mobileLabel", "description", "eyebrow"]) if (item[key] !== undefined && (typeof item[key] !== "string" || item[key].length > 600)) fail();
      if (item.icon && !/^[a-z][a-z0-9-]{0,60}$/.test(item.icon)) fail();
      if (item.layout && !["auto", "link", "mega", "columns"].includes(item.layout)) fail();
      visit(item.items, depth + 1);
    }
  };
  visit(navigation.tabs);
  visit(navigation.utility);
}

export function navigationModel(navigation = {}) {
  const normalize = (items, parent) => {
    const seen = new Set();
    return navigationGroups((Array.isArray(items) ? items : []).filter(Boolean)).flatMap((item, index) => {
      if (!item || item.enabled === false || !String(item.label || "").trim()) return [];
      const id = String(item.id || `${parent}-${item.href || index}`);
      if (seen.has(id)) return [];
      seen.add(id);
      const href = navigationHref(item.href);
      const children = normalize(item.items, id);
      if (!item.section && !href && !children.length) return [];
      return [{ id, label: String(item.label), href, section: item.section === true, items: children,
        desktop: item.desktop !== false, mobile: item.mobile !== false,
        desktopLabel: String(item.desktopLabel || ""), mobileLabel: String(item.mobileLabel || ""),
        description: item.description === undefined ? undefined : String(item.description),
        eyebrow: item.eyebrow === undefined ? undefined : String(item.eyebrow),
        image: /^(\/[^/]|https?:\/\/)/.test(item.image || "") ? item.image : "",
        icon: /^[a-z][a-z0-9-]*$/.test(item.icon || "") ? item.icon : "",
        layout: ["link", "mega", "columns"].includes(item.layout) ? item.layout : "auto" }];
    });
  };
  return { tabs: normalize(navigation.tabs, "tab"), utility: normalize(navigation.utility, "utility") };
}

export function navigationForDevice(model, device) {
  const filter = items => items.filter(item => item[device] !== false).map(item => ({ ...item,
    label: item[`${device}Label`] || item.label, items: item.layout === "link" ? [] : filter(item.items),
  }));
  return { tabs: filter(model.tabs), utility: filter(model.utility) };
}

export function editableNavigationGroups(items = []) {
  const groups = [];
  let group;
  for (const item of items) {
    if (item.section) {
      const entry = { ...item, items: editableNavigationGroups(item.items || []) };
      groups.push(entry);
      group = Array.isArray(item.items) ? null : entry;
    } else if (group) group.items.push(item);
    else groups.push({ ...item, ...(Array.isArray(item.items) ? { items: editableNavigationGroups(item.items) } : {}) });
  }
  return groups;
}

export function navigationGroups(items) {
  return editableNavigationGroups(items).filter(item => !item.section || item.items.length);
}

export function findNavigationLink(items, href) {
  for (const item of items) {
    if (!item.section && item.href === href) return item;
    const found = findNavigationLink(item.items, href);
    if (found) return found;
  }
  return null;
}

function routePath(value) {
  const path = value.split(/[?#]/)[0];
  return path === "/" ? path : `${path.replace(/\/+$/, "")}/`;
}

export function navigationState(item, location = "/") {
  const local = item.href?.startsWith("/") && !item.href.startsWith("//");
  const route = routePath(location);
  const path = local ? routePath(item.href) : "";
  const exact = local && route === path && (!item.href.includes("#") || item.href.split("#")[1] === location.split("#")[1]);
  const active = exact || (local && path !== "/" && route.startsWith(path)) || item.items.some(child => navigationState(child, location).active);
  return { exact, active };
}

const key = value => ` data-nav-key="${navEscape(value)}"`;
const iconFor = item => item.icon || (item.id.includes("planner") ? "route" : item.id.includes("temple") ? "temple"
  : item.id.includes("calendar") ? "calendar-days" : item.id.includes("commerce") ? "coins" : "layers-2");
const icon = (name, assets) => assets?.[name]
  ? `<span class="mw-heritage" aria-hidden="true"><img src="${navEscape(assets[name])}" alt="" width="80" height="80"></span>`
  : renderIcon(name, "mw-icon");
const arrow = () => renderIcon("chevron-right", "mw-arrow");

function link(item, options = {}) {
  const { location = "/", className = "mw-child-link", prefix = "", symbol = item.icon || "", assets = {}, description = item.description || "", ariaLabel = "" } = options;
  const state = navigationState(item, location);
  const body = `${symbol ? icon(symbol, assets) : ""}<span class="mw-link-copy"><span>${navEscape(item.label)}</span>${description ? `<small>${navEscape(description)}</small>` : ""}</span>${arrow()}`;
  return `<a${key(`${prefix}${item.id}`)} data-nav-id="${navEscape(item.id)}" class="${className}${state.active ? " is-current" : ""}" href="${navEscape(item.href)}"${ariaLabel ? ` aria-label="${navEscape(ariaLabel)}"` : ""}${state.exact ? ' aria-current="page"' : ""}>${body}</a>`;
}

function childrenMarkup(items, options) {
  return navigationGroups(items).map(item => {
    if (item.section || item.items.length) {
      return `<section class="mw-link-group"${key(`${options.prefix || ""}group-${item.id}`)}><h3>${navEscape(item.label)}</h3>${item.description ? `<p>${navEscape(item.description)}</p>` : ""}${!item.section && item.href ? link(item, options) : ""}<div>${childrenMarkup(item.items, options)}</div></section>`;
    }
    return link(item, options);
  }).join("");
}

function templePanel(item, options) {
  return navigationGroups(item.items).map(group => {
    if (group.href === "/temples/planner/") {
      return `<div class="mw-panel-feature"${key(`feature-${group.id}`)}>${group.image ? `<img class="mw-feature-image" src="${navEscape(group.image)}" alt="" width="90" height="90">` : ""}<span class="mw-eyebrow">${navEscape(group.eyebrow ?? "MONGKOL WELA")}</span>${link(group, { ...options, className: "mw-feature-link", description: group.description ?? "ค้นหาวัดและเส้นทางมงคล วางแผนการเดินทางได้ง่าย ๆ" })}</div>`;
    }
    if (group.section) {
      if (group.items.length === 1 && group.items[0].href === "/temples/thailand/") {
        return link(group.items[0], { ...options, className: "mw-directory-link", symbol: group.items[0].icon || "map-pin", description: group.items[0].description ?? "ค้นหาวัดทุกจังหวัด พร้อมข้อมูลการเดินทาง" });
      }
      return `<section class="mw-temple-group"${key(`group-${group.id}`)}><div class="mw-group-heading">${icon(group.icon || "temple", options.assets)}<div><h3>${navEscape(group.label)}</h3><p>${navEscape(group.description ?? "วัดดังน่าไป วัดเด่นขอพร และพิกัดสายมู")}</p></div></div><div class="mw-collection-links">${childrenMarkup(group.items, options)}</div></section>`;
    }
    return link(group, options);
  }).join("");
}

export function renderDesktopNavigation(model, options = {}) {
  return navigationForDevice(model, "desktop").tabs.map(item => {
    const groups = navigationGroups(item.items);
    const panelId = `mw-panel-${encodeURIComponent(item.id)}`;
    const temple = item.href === "/temples/";
    const tools = item.layout === "columns" || (item.layout === "auto" && item.href === "/#supporting-tools");
    const state = navigationState(item, options.location);
    return `<div class="mw-nav-item${state.active ? " is-current" : ""}"${key(item.id)} data-nav-item-id="${navEscape(item.id)}">
      ${item.href ? link(item, { ...options, className: "mw-top-link", prefix: "top-" }) : `<span class="mw-top-link">${navEscape(item.label)}</span>`}
      ${groups.length ? `<details class="mw-disclosure"${key(`disclosure-${item.id}`)}><summary aria-label="เปิดเมนู ${navEscape(item.label)}" aria-controls="${panelId}">${renderIcon("chevron-down", "mw-chevron")}</summary><div class="mw-panel${temple ? " mw-panel--temples" : ""}${tools ? " mw-panel--tools" : ""}" id="${panelId}">${temple ? templePanel(item, options) : childrenMarkup(item.items, options)}</div></details>` : ""}
    </div>`;
  }).join("");
}

function mobileGroup(group, options) {
  if (group.items.length === 1 && group.items[0].href === "/temples/thailand/") {
    return link(group.items[0], { ...options, className: "mw-mobile-row", symbol: "map-pin" });
  }
  const active = group.items.some(item => navigationState(item, options.location).active);
  const open = active || group.id === "temple-featured-section";
  return `<details class="mw-mobile-group"${key(`mobile-group-${group.id}`)}${open ? " open" : ""}><summary>${icon(iconFor(group), options.assets)}<span>${navEscape(group.label)}</span>${renderIcon("chevron-down", "mw-chevron")}</summary><div class="mw-mobile-children">${group.href ? link(group, options) : ""}${navigationGroups(group.items).map(child => child.items.length ? mobileGroup(child, options) : link(child, options)).join("")}</div></details>`;
}

export function renderMobileNavigation(model, options = {}) {
  return navigationForDevice(model, "mobile").tabs.map(item => {
    const groups = navigationGroups(item.items);
    if (item.href === "/temples/" && groups.length) {
      return `<section class="mw-mobile-temples"${key(item.id)}>${groups.map(group => group.section || group.items.length ? mobileGroup(group, options) : link(group, { ...options, className: "mw-mobile-row", symbol: iconFor(group) })).join("")}</section>`;
    }
    if (groups.length) return mobileGroup(item, options);
    return link(item, { ...options, className: "mw-mobile-row", symbol: iconFor(item) });
  }).join("");
}

export function renderMobileHub(model, options = {}) {
  const hub = navigationForDevice(model, "mobile").tabs.find(item => item.href === "/temples/" && navigationGroups(item.items).length);
  return hub ? link({ ...hub, label: "ดูภาพรวม" }, { ...options, className: "mw-hub-link", prefix: "hub-", ariaLabel: `ดูภาพรวม ${hub.label}` }) : "";
}

export function navigationUtilities(model, configured = []) {
  const items = configured.map((item, index) => ({ ...item, id: `utility-config-${index}`, href: navigationHref(item.href), items: [] })).filter(item => item.href);
  for (const item of model.utility) if (!items.some(existing => existing.href === item.href)) items.push(item);
  return items;
}

export function drawerUtilities(model, utilities) {
  const destinations = new Set();
  const visit = items => items.forEach(item => { if (item.href && !item.section) destinations.add(item.href); visit(item.items); });
  visit(navigationForDevice(model, "mobile").tabs);
  return utilities.filter(item => !destinations.has(item.href));
}

export function renderUtilityNavigation(items, options = {}) {
  const device = options.device || "desktop";
  return items.filter(item => item[device] !== false).map(item => link({ ...item, label: item[`${device}Label`] || item.label }, { ...options, className: "mw-utility-link", prefix: "utility-" })).join("");
}
