import { normalizePlaceholderImage, sitePlaceholderImage } from "../lib/image-placeholder.js";
import { requestJson, createLatestRequest } from "./request.js";
import { applyPlaceDetailOverride } from "./place-detail-content.js";
import { startContentRefresh } from "./content-refresh.js";
import { updateHeaderNavigation } from "./navigation.js";
import { homeHeroAttributes, homeHeroMetadata } from "../lib/home-hero-media.js";

const CMS_CONTENT_URL = "/api/admin/content";
const CMS_CONSENT_KEY = "mongkolwela.pdpa.analytics";
const CMS_EDITABLE_CONTRACT_VERSION = 2;

let activeContent = null;
let activeRevision = "";
let contentLoading = false;
let pageviewTracked = false;
let disabledPageChildren = null;
const appliedPatches = new Map();
const contentRequests = createLatestRequest();
const unchanged = (before, after) => JSON.stringify(before) === JSON.stringify(after);

function markCmsNavigationReady() {
  document.documentElement.classList.remove("cms-navigation-pending");
  document.documentElement.dataset.cmsNavReady = "true";
}


function normalizeCmsContent(content) {
  if (!content || typeof content !== "object") return null;
  if (!Array.isArray(content.pages)) return null;
  if (!Array.isArray(content.navigation?.tabs)) return null;
  if (!Array.isArray(content.navigation?.utility)) return null;
  const contractVersion = Number(content.cmsContractVersion || CMS_EDITABLE_CONTRACT_VERSION);
  return {
    ...content,
    schemaVersion: content.schemaVersion || 1,
    cmsContractVersion: Number.isFinite(contractVersion) ? contractVersion : CMS_EDITABLE_CONTRACT_VERSION,
    navigation: {
      ...content.navigation,
      tabs: content.navigation.tabs,
      utility: content.navigation.utility,
    },
  };
}

async function loadContent(signal) {
  const path = encodeURIComponent(window.location.pathname);
  const revision = activeRevision ? `&revision=${encodeURIComponent(activeRevision)}` : "";
  const payload = await requestJson(`${CMS_CONTENT_URL}?path=${path}${revision}`, { signal });
  if (payload.unchanged === true && activeContent && payload.revision === activeRevision) return payload;
  const content = normalizeCmsContent(payload.content);
  if (!content) throw new Error("Live CMS payload is invalid");
  return { content, revision: payload.revision || "" };
}

function normalizeRoute(pathname = window.location.pathname) {
  if (!pathname || pathname === "/index.html") return "/";
  if (!pathname.endsWith("/")) return `${pathname}/`;
  return pathname;
}

function resolveHref(href = "") {
  if (!href) return "/";
  if (/^(https?:|mailto:|tel:)/.test(href)) return href;
  if (href.startsWith("#")) return `/${href}`;
  if (href.startsWith("/")) return href;
  return `/${href}`;
}

function pageForRoute(content, route = normalizeRoute()) {
  return (content?.pages || []).find((page) => normalizeRoute(page.route) === route) || null;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeHtml(value = "") {
  const template = document.createElement("template");
  template.innerHTML = String(value || "");
  template.content.querySelectorAll("script,iframe,object,embed,link,meta").forEach((node) => node.remove());
  template.content.querySelectorAll("*").forEach((node) => {
    [...node.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const val = attr.value || "";
      if (name.startsWith("on")) node.removeAttribute(attr.name);
      if ((name === "href" || name === "src") && /^javascript:/i.test(val)) node.removeAttribute(attr.name);
    });
  });
  return template.innerHTML;
}

function applyNavigation(content) {
  updateHeaderNavigation(content?.navigation);
}

function applyPatch(patch) {
  if (!patch?.selector || patch.enabled === false) return;
  document.querySelectorAll(patch.selector).forEach((node) => {
    if (patch.kind === "image") {
      if (node.hasAttribute("data-home-hero-image")) {
        node.setAttribute("data-carousel-src", patch.src || "");
        if (!patch.src) node.removeAttribute("src");
        else if (node.hasAttribute("src") || node.closest(".is-active")) node.setAttribute("src", patch.src);
        for (const [attr, value] of Object.entries(homeHeroAttributes(patch))) node.setAttribute(attr, value);
      } else if ("src" in node && patch.src) node.setAttribute("src", patch.src);
      if (node.hasAttribute("data-cms-media")) {
        node.style.objectPosition = patch.position || "50% 50%";
        for (const [attr, value] of Object.entries(homeHeroAttributes(patch))) node.setAttribute(attr, value);
      }
      if (patch.alt !== undefined) node.setAttribute("alt", patch.alt);
      return;
    }
    if (patch.kind === "attr" && patch.attr) {
      node.setAttribute(patch.attr, patch.value ?? "");
      return;
    }
    if (patch.kind === "html") {
      node.innerHTML = safeHtml(patch.value || "");
      return;
    }
    node.textContent = patch.value ?? "";
  });
}

function applyPagePatches(patches = []) {
  const key = (patch) => JSON.stringify([patch.selector, patch.kind, patch.attr]);
  const next = new Map(patches.filter((patch) => patch.selector && patch.enabled !== false).map((patch) => [key(patch), patch]));
  for (const [id, previous] of appliedPatches) {
    if (unchanged(previous.patch, next.get(id))) continue;
    previous.restore.forEach((restore) => restore());
    appliedPatches.delete(id);
  }
  for (const [id, patch] of next) {
    const nodes = [...document.querySelectorAll(patch.selector)];
    const previous = appliedPatches.get(id);
    if (previous && nodes.length === previous.nodes.length && nodes.every((node, index) => node === previous.nodes[index])) continue;
    const restore = nodes.map((node) => {
      if (patch.kind === "image" || (patch.kind === "attr" && patch.attr)) {
        const attributes = patch.kind === "image" ? ["src", "alt", ...(node.hasAttribute("data-home-hero-image") ? ["data-carousel-src", ...Object.values(homeHeroMetadata)] : []), ...(node.hasAttribute("data-cms-media") ? ["style", ...Object.values(homeHeroMetadata)] : [])] : [patch.attr];
        const values = attributes.map((name) => [name, node.getAttribute(name)]);
        return () => {
          values.forEach(([name, value]) => value === null ? node.removeAttribute(name) : node.setAttribute(name, value));
          if (node.hasAttribute("data-home-hero-image") && node.closest(".is-active") && !node.hasAttribute("src") && node.dataset.carouselSrc) node.setAttribute("src", node.dataset.carouselSrc);
        };
      }
      const children = [...node.childNodes];
      return () => node.replaceChildren(...children);
    });
    applyPatch(patch);
    appliedPatches.set(id, { patch, restore, nodes });
  }
}

function applySections(page) {
  document.querySelectorAll("[data-cms-duplicate-of]").forEach((node) => node.remove());
  const sections = (page.sections || []).filter((section) => section.selector);
  const found = sections
    .map((section) => ({ ...section, node: document.querySelector(section.selector) }))
    .filter((section) => section.node);
  found.forEach((section) => {
    const isDisabled = section.enabled === false;
    section.node.hidden = isDisabled;
    section.node.style.display = isDisabled ? "none" : "";
    section.node.dataset.cmsSectionId = section.id || "";
  });
  if (document.querySelector("[data-cms-preserve-section-order]")) return;
  const byParent = new Map();
  found.forEach((section) => {
    const parent = section.node.parentElement;
    if (!parent) return;
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent).push(section);
  });
  byParent.forEach((items, parent) => {
    items
      .slice()
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
      .forEach((section) => parent.appendChild(section.node));
  });
  found
    .filter((section) => section.duplicateCount && section.enabled !== false)
    .forEach((section) => {
      const count = Math.min(Number(section.duplicateCount) || 0, 5);
      for (let index = 0; index < count; index += 1) {
        const clone = section.node.cloneNode(true);
        clone.dataset.cmsDuplicateOf = section.id || section.selector;
        section.node.after(clone);
      }
    });
}

function disablePage(page) {
  const main = document.querySelector("main");
  if (!page || page.enabled !== false) {
    if (main && disabledPageChildren) main.replaceChildren(...disabledPageChildren);
    disabledPageChildren = null;
    return false;
  }
  if (!main) return true;
  if (!disabledPageChildren) disabledPageChildren = [...main.childNodes];
  main.innerHTML = `<section class="section-shell cms-disabled-page">
    <div class="section-heading">
      <p class="section-kicker">ปิดใช้งานชั่วคราว</p>
      <h1>${escapeHtml(page.label || "หน้านี้")}</h1>
      <p>หน้านี้ถูกปิดจาก Admin Portal</p>
    </div>
  </section>`;
  return true;
}

function renderBlock(block) {
  if (!block || block.enabled === false) return "";
  const props = block.props || {};
  if (block.type === "hero") {
    const bg = props.image ? ` style="background-image:linear-gradient(90deg,rgba(0,0,0,.58),rgba(0,0,0,.18)),url('${escapeHtml(props.image)}')"` : "";
    return `<section class="cms-page-hero"${bg}>
      <div>
        <p class="section-kicker">${escapeHtml(props.eyebrow || "")}</p>
        <h1>${escapeHtml(props.title || "หน้าใหม่")}</h1>
        <p>${escapeHtml(props.body || "")}</p>
        ${
          props.buttonLabel
            ? `<a class="primary-action" href="${escapeHtml(resolveHref(props.buttonHref || "/"))}">${escapeHtml(props.buttonLabel)}</a>`
            : ""
        }
      </div>
    </section>`;
  }
  if (block.type === "cards") {
    return `<section class="section-shell"><div class="tool-grid">${(props.cards || [])
      .map(
        (card) => `<article class="tool-card">
          <span>${escapeHtml(card.kicker || "")}</span>
          <h3>${escapeHtml(card.title || "")}</h3>
          <p>${escapeHtml(card.body || "")}</p>
          ${card.href ? `<a href="${escapeHtml(resolveHref(card.href))}">${escapeHtml(card.linkLabel || "เปิดอ่าน")}</a>` : ""}
        </article>`,
      )
      .join("")}</div></section>`;
  }
  if (block.type === "image") {
    return `<section class="section-shell cms-image-block">
      <img src="${escapeHtml(props.src || sitePlaceholderImage)}" alt="${escapeHtml(props.alt || "")}" data-fallback-src="${sitePlaceholderImage}">
      ${props.caption ? `<p>${escapeHtml(props.caption)}</p>` : ""}
    </section>`;
  }
  return `<section class="section-shell cms-rich-text">${safeHtml(props.html || "<p></p>")}</section>`;
}

function renderCustomPage(content) {
  const shell = document.querySelector("[data-cms-page-shell]");
  if (!shell) return false;
  const page = pageForRoute(content);
  if (!page || page.enabled === false) {
    shell.innerHTML = `<section class="section-shell"><div class="section-heading"><p class="section-kicker">ไม่พบหน้า</p><h1>ยังไม่ได้เปิดใช้งานหน้านี้</h1></div></section>`;
    return true;
  }
  document.title = `${page.label || "หน้าใหม่"} | ${content.site?.name || "มงคลเวลา"}`;
  shell.innerHTML = (page.blocks || []).map(renderBlock).join("");
  return true;
}

function templeKeyFromPath(pathname = window.location.pathname) {
  const decodedPathname = decodeURIComponent(normalizeRoute(pathname));
  const match = decodedPathname.match(/^\/temples\/([^/]+)\/([^/]+)\/$/);
  if (!match) return "";
  return `${match[1]}:${match[2]}`;
}

function templeKeyFromHref(href = "") {
  try {
    return templeKeyFromPath(new URL(href, window.location.origin).pathname);
  } catch {
    return "";
  }
}

function getTempleOverride(content, key) {
  const override = content?.temples?.records?.[key] || content?.temples?.overrides?.[key];
  return override || null;
}

function imageVariantUrl(variant) {
  return typeof variant === "string" ? variant : variant?.url;
}

function applyPublishedImage(root, override, slot) {
  const image = root?.querySelector("img");
  if (!image) return;
  const desktop = imageVariantUrl(override.images?.[slot]?.desktop) ?? override.fields?.imageUrl;
  const mobile = imageVariantUrl(override.images?.[slot]?.mobile) ?? desktop;
  const placeholder = image.dataset.fallbackSrc || sitePlaceholderImage;
  if (desktop !== undefined) {
    const src = normalizePlaceholderImage(desktop) || placeholder;
    if (image.getAttribute("src") !== src) {
      image.src = src;
      image.dataset.fallbackApplied = "";
    }
    root.classList.toggle("is-placeholder", !desktop);
  }
  const source = root.querySelector("[data-temple-mobile-source]");
  if (source && mobile !== undefined) {
    const srcset = normalizePlaceholderImage(mobile) || placeholder;
    if (source.getAttribute("srcset") !== srcset) source.srcset = srcset;
  }
  if (override.fields?.imageAlt !== undefined) image.alt = override.fields.imageAlt;
}

function fieldValue(override, field, fallback = "") {
  return Object.prototype.hasOwnProperty.call(override?.fields || {}, field) ? override.fields[field] : fallback;
}

function splitTempleList(value = "") {
  return String(value || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function setText(selector, value, root = document) {
  const node = root.querySelector(selector);
  if (node && value !== undefined && value !== null) node.textContent = String(value);
}

function textFrom(selector, root = document) {
  return root.querySelector(selector)?.textContent?.trim() || "";
}

function metaValue(index, root = document) {
  return root.querySelectorAll(".temple-detail-meta div")[index]?.querySelector("dd")?.textContent?.trim() || "";
}

function applyTempleCardOverrides(content) {
  document.querySelectorAll("[data-popular-temple-card]").forEach((card) => {
    const detailHref = card.getAttribute("href") || card.querySelector("[data-popular-temple-detail]")?.getAttribute("href");
    const override = getTempleOverride(content, templeKeyFromHref(detailHref));
    if (!override) return;
    if (override.status === "deleted" || override.enabled === false) {
      card.remove();
      return;
    }
    const name = fieldValue(override, "name", card.dataset.name || "");
    const region = fieldValue(override, "region", card.dataset.region || "");
    const province = fieldValue(override, "province", card.dataset.province || "");
    const district = fieldValue(override, "district", card.dataset.district || "");
    const blessings = fieldValue(override, "blessings", card.dataset.blessings || "");
    const latitude = fieldValue(override, "latitude", card.dataset.latitude || "");
    const longitude = fieldValue(override, "longitude", card.dataset.longitude || "");

    card.dataset.name = String(name);
    card.dataset.region = String(region);
    card.dataset.province = String(province);
    card.dataset.district = String(district);
    card.dataset.blessings = String(blessings);
    card.dataset.latitude = String(latitude);
    card.dataset.longitude = String(longitude);
    card.dataset.searchText = `${name} ${region} ${province} ${district} ${blessings}`;
    setText(".popular-temple-card-body span", card.classList.contains("temple-collection-v2-card") ? province : region, card);
    setText(".popular-temple-card-body h3", name, card);
    setText(".popular-temple-card-body p", `${province}${district ? ` / ${district}` : ""}`, card);

    applyPublishedImage(card, override, "card");
  });
  document.dispatchEvent(new CustomEvent("mw:temple-overrides-applied"));
}

function normalizeVisitSection(section = {}, label) {
  const kind = label === "ค่าเข้าชม" ? "admission" : label === "ช่องทางติดต่อ" ? "contact" : "hours";
  const details = visitSectionDetails(section, kind);
  return {
    kind,
    label,
    status: section.status || (section.summary || details.length ? "verified" : "needs-direct-check"),
    summary: section.summary || "กรุณาตรวจสอบกับสถานที่ดังกล่าว",
    timetable: normalizeVisitTimetable(section.timetable || section.hoursRows),
    details,
  };
}

function renderVisitSection(section) {
  const className = section.status === "verified" ? "is-verified" : section.status === "listed" ? "is-listed" : "needs-check";
  const timetable = Array.isArray(section.timetable) ? section.timetable : [];
  const needsCheck = !["verified", "listed"].includes(section.status) || (!section.details.length && !timetable.length);
  return `<article class="temple-detail-visit-card temple-detail-visit-card--${escapeHtml(section.kind || "info")} ${className}">
    <span class="temple-detail-visit-card__label">${escapeHtml(section.label)}</span>
    ${needsCheck ? "<p>โปรดตรวจสอบกับสถานที่โดยตรง</p>" : ""}
    ${
      timetable.length
        ? `<table class="temple-detail-visit-timetable"><tbody>${timetable
            .map((row) => `<tr><th scope="row">${escapeHtml(row.day)}</th><td>${escapeHtml(row.time)}</td></tr>`)
            .join("")}</tbody></table>`
        : ""
    }
    ${
      section.details.length
        ? `<dl>${section.details.map((item) => `<div><dt>${escapeHtml(item.term)}</dt><dd>${renderVisitDetailValue(item)}</dd></div>`).join("")}</dl>`
        : ""
    }
  </article>`;
}

function renderVisitDetailValue(item) {
  if (!item.href) return escapeHtml(item.value);
  const href = escapeHtml(item.href);
  const externalAttrs = /^https?:\/\//iu.test(item.href) ? ' target="_blank" rel="noopener"' : "";
  return `<a href="${href}"${externalAttrs}>${escapeHtml(item.value)}</a>`;
}

function visitSectionDetails(section, kind) {
  if (kind === "admission") {
    const details = [];
    pushVisitDetail(details, "คนไทย", section.thai);
    pushVisitDetail(details, "ชาวต่างชาติ", section.foreign);
    const adult = cleanVisitDetailText(section.adult);
    const child = cleanVisitDetailText(section.child);
    const hasAudiencePrice = cleanVisitDetailText(section.thai) || cleanVisitDetailText(section.foreign);
    if (adult && child && comparableVisitText(adult) !== comparableVisitText(child)) {
      details.push({ term: "ผู้ใหญ่", value: adult }, { term: "เด็ก", value: child });
    } else if (!hasAudiencePrice) {
      pushVisitDetail(details, "ผู้ใหญ่", adult);
      pushVisitDetail(details, "เด็ก", child);
    }
    pushVisitDetail(details, "หมายเหตุ", section.notes);
    return details;
  }
  if (kind === "contact") {
    const details = [];
    pushVisitPhoneDetail(details, section.phone);
    pushVisitDetail(details, "LINE", section.line);
    pushVisitFacebookDetail(details, section.facebook);
    pushVisitEmailDetail(details, section.email);
    return details;
  }
  const details = [];
  if (!normalizeVisitTimetable(section.timetable || section.hoursRows).length) pushVisitDetail(details, "เวลาปกติ", section.regular);
  pushVisitDetail(details, "จำหน่ายบัตร", section.ticketOffice);
  pushVisitDetail(details, "วันหยุด", section.closed, { allowUnspecified: true });
  pushVisitDetail(details, "หมายเหตุ", section.holidayNotes || section.notes);
  return details;
}

function pushVisitDetail(details, term, value, options = {}) {
  const displayValue = cleanVisitDetailText(value, options);
  if (displayValue) details.push({ term, value: displayValue });
}

function pushVisitPhoneDetail(details, value) {
  const displayValue = cleanVisitDetailText(value);
  if (!displayValue) return;
  const phoneHref = displayValue.replace(/[^\d+]/gu, "");
  details.push({ term: "โทรศัพท์", value: displayValue, href: phoneHref ? `tel:${phoneHref}` : "" });
}

function pushVisitEmailDetail(details, value) {
  const displayValue = cleanVisitDetailText(value);
  if (!displayValue) return;
  details.push({ term: "อีเมล", value: displayValue, href: `mailto:${displayValue}` });
}

function pushVisitFacebookDetail(details, value) {
  const displayValue = cleanVisitDetailText(value);
  if (!displayValue) return;
  const facebook = formatVisitFacebookContact(displayValue);
  details.push({ term: "Facebook", value: facebook.label, href: facebook.href });
}

function cleanVisitDetailText(value, options = {}) {
  const text = String(value || "")
    .trim()
    .replace(/\s*ใน Wat Portal\s*/giu, "")
    .replace(/\s*ในแหล่งข้อมูล\s*/giu, "ในแหล่งข้อมูล")
    .trim();
  if (!text || (!options.allowUnspecified && /^ไม่ได้ระบุ/u.test(text)) || /^อ้างอิงลิงก์/u.test(text) || /Wat Portal เป็นแหล่งข้อมูล/u.test(text)) return "";
  return text;
}

function comparableVisitText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/gu, "")
    .replace(/สำหรับชาวต่างชาติ/gu, "")
    .replace(/เมื่อแสดงบัตรประชาชน/gu, "");
}

function formatVisitFacebookContact(value) {
  const text = String(value || "").trim();
  const href = normalizeVisitFacebookHref(text);
  if (!href) return { label: text, href: "" };

  try {
    const url = new URL(href);
    const pathParts = url.pathname
      .split("/")
      .map((item) => item.trim())
      .filter(Boolean);
    const handle = pathParts.find((part) => part !== "profile.php" && part !== "pages");
    return { label: handle || "Facebook", href };
  } catch {
    return { label: text, href: "" };
  }
}

function normalizeVisitFacebookHref(value) {
  const text = String(value || "").trim();
  if (!/facebook\.com/iu.test(text)) return "";
  if (/^https?:\/\//iu.test(text)) return text;
  return `https://${text.replace(/^\/+/u, "")}`;
}

function normalizeVisitTimetable(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => ({ day: String(row?.day || "").trim(), time: String(row?.time || "").trim() }))
    .filter((row) => row.day && row.time);
}

function applyTempleDetailOverride(content) {
  const key = templeKeyFromPath();
  const override = getTempleOverride(content, key);
  const root = document.querySelector(".temple-detail");
  if (!override || !root) return;
  if (override.status === "deleted" || override.enabled === false) {
    root.dispatchEvent(new CustomEvent("mw:place-detail-unavailable"));
    root.innerHTML = '<section class="section-shell" role="status"><h1>สถานที่นี้ไม่เปิดเผยแพร่</h1><a href="/temples/">ดูสถานที่อื่น</a></section>';
    return;
  }
  if (applyPlaceDetailOverride(root, override)) return;
  const name = fieldValue(override, "name", document.querySelector("#temple-detail-title")?.textContent || "");
  const mapElement = root.querySelector("[data-temple-detail-map]");
  const currentTags = [...root.querySelectorAll(".temple-detail-tags span")].map((item) => item.textContent.trim()).filter(Boolean);
  const currentBlessings = [...root.querySelectorAll(".temple-detail-chip-group span")].map((item) => item.textContent.trim()).join("; ");
  const currentObjects = [...root.querySelectorAll(".temple-detail-notes li")].map((item) => item.textContent.trim()).join("; ");
  const currentSourceLabel = textFrom(".temple-detail-hero__media figcaption", root) || "มงคลเวลา";
  const region = fieldValue(override, "region", metaValue(2, root) || currentTags[1] || "");
  const province = fieldValue(override, "province", metaValue(0, root) || currentTags[2] || "");
  const district = fieldValue(override, "district", metaValue(1, root).replace(/^-$|^–$/u, ""));
  const placeType = fieldValue(override, "placeType", currentTags[0] || "วัดและสถานที่ศักดิ์สิทธิ์");
  const blessings = fieldValue(override, "blessings", currentBlessings);
  const objectHero = fieldValue(override, "objectHero", currentObjects);
  const latitude = fieldValue(override, "latitude", mapElement?.dataset.lat || "");
  const longitude = fieldValue(override, "longitude", mapElement?.dataset.lng || "");
  const plusCode = String(fieldValue(override, "plusCode", mapElement?.dataset.mapLabel || "") || "").trim();
  const mapQuery = plusCode || (latitude !== "" && longitude !== "" ? `${latitude},${longitude}` : "");
  const mapHref = mapQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}` : "";
  const locationText = [region, province, district].filter(Boolean).join(" · ");

  setText("#temple-detail-title", name, root);
  document.title = document.title.replace(/^.*?\s\|/, `${name} |`);
  applyPublishedImage(root.querySelector(".temple-detail-hero__media"), override, "hero");
  setText(".temple-detail-hero__media figcaption", fieldValue(override, "imageSourceLabel", currentSourceLabel), root);

  const summary = splitTempleList(blessings).length
    ? `${name} เหมาะสำหรับ${splitTempleList(blessings).slice(0, 3).join(" · ")}`
    : `${name} หนึ่งในพิกัดแนะนำใน${province}`;
  setText(".temple-detail-hero__copy > p:not(.section-kicker)", summary, root);
  const tags = root.querySelector(".temple-detail-tags");
  if (tags) tags.innerHTML = [placeType, region, province].filter(Boolean).map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  const story = root.querySelector(".temple-detail-story > p:nth-of-type(2)");
  if (story) story.textContent = `${name} อยู่ใน${province}${district ? ` เขต/อำเภอ ${district}` : ""} เป็นหนึ่งในสถานที่ที่ถูกจัดไว้ในมงคลเวลา เพื่อช่วยเลือกเส้นทางไหว้พระและวางแผนการเดินทาง`;

  const chips = root.querySelector(".temple-detail-chip-group");
  const blessingItems = splitTempleList(blessings);
  if (chips) {
    chips.innerHTML = blessingItems.slice(0, 8).map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  } else if (blessingItems.length) {
    const storyIntro = root.querySelector(".temple-detail-story > p:nth-of-type(2)");
    storyIntro?.insertAdjacentHTML("afterend", `<div class="temple-detail-chip-group">${blessingItems.slice(0, 8).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`);
  }
  const objectItems = splitTempleList(objectHero);
  const notes = root.querySelector(".temple-detail-notes ul");
  if (notes) {
    notes.innerHTML = objectItems.slice(0, 6).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  } else if (objectItems.length) {
    root.querySelector(".temple-detail-chip-group, .temple-detail-story > p:nth-of-type(2)")?.insertAdjacentHTML(
      "afterend",
      `<div class="temple-detail-notes"><h3>สิ่งที่นิยมสักการะ</h3><ul>${objectItems.slice(0, 6).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>`,
    );
  }

  const visit = override.visitInfo || {};
  const visitGrid = root.querySelector(".temple-detail-visit__grid");
  if (visitGrid && Object.keys(visit).length) {
    visitGrid.innerHTML = [
      renderVisitSection(normalizeVisitSection(visit.admission, "ค่าเข้าชม")),
      renderVisitSection(normalizeVisitSection(visit.hours, "เวลาเปิด-ปิดและวันหยุด")),
      renderVisitSection(normalizeVisitSection(visit.contact, "ช่องทางติดต่อ")),
    ].join("");
  }
  if (mapElement) {
    mapElement.dataset.lat = String(latitude);
    mapElement.dataset.lng = String(longitude);
    mapElement.dataset.title = String(name);
    mapElement.dataset.mapUrl = mapHref;
    mapElement.dataset.mapLabel = plusCode || (latitude !== "" && longitude !== "" ? `${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}` : "");
    mapElement.setAttribute("aria-label", `ดูแผนที่ ${name}`);
  }
  root.querySelectorAll(".temple-detail-map-card__body a, .temple-detail-action--primary").forEach((link) => {
    if (mapHref) link.href = mapHref;
    else link.removeAttribute("href");
  });
  setText(".temple-detail-map-card__body p", locationText, root);
  const metaRows = root.querySelectorAll(".temple-detail-meta div");
  if (metaRows[0]) setText("dd", province, metaRows[0]);
  if (metaRows[1]) setText("dd", district || "-", metaRows[1]);
  if (metaRows[2]) setText("dd", region, metaRows[2]);
}

function applyTempleOverrides(content) {
  if (!content?.temples?.records && !content?.temples?.overrides) return;
  applyTempleCardOverrides(content);
  applyTempleDetailOverride(content);
}

function shouldTrackAnalytics(content) {
  if (document.body.dataset.analyticsDisabled === "true") return false;
  if (!content?.analytics?.enabled) return false;
  if (!content.site?.pdpa?.analyticsConsentRequired) return true;
  return localStorage.getItem(CMS_CONSENT_KEY) === "accepted";
}

function renderPdpaBanner(content) {
  document.querySelector(".pdpa-consent")?.remove();
  if (document.body.dataset.analyticsDisabled === "true") return;
  if (!content?.site?.pdpa?.analyticsConsentRequired) return;
  if (localStorage.getItem(CMS_CONSENT_KEY)) return;
  const pdpa = content.site.pdpa;
  const banner = document.createElement("aside");
  banner.className = "pdpa-consent";
  banner.setAttribute("aria-label", pdpa.titleText || "การใช้คุกกี้และข้อมูลการใช้งาน");
  const policyLink = pdpa.policyHref
    ? `<a class="pdpa-consent__link" href="${escapeHtml(resolveHref(pdpa.policyHref))}">${escapeHtml(
        pdpa.policyLabel || "นโยบายความเป็นส่วนตัว",
      )}</a>`
    : "";
  banner.innerHTML = `<div class="pdpa-consent__copy">
      <strong class="pdpa-consent__title">${escapeHtml(pdpa.titleText || "การใช้คุกกี้และข้อมูลการใช้งาน")}</strong>
      <p>${escapeHtml(pdpa.bannerText || "")}</p>
      ${policyLink}
    </div>
    <div class="pdpa-consent__actions">
      <button type="button" data-pdpa-accept>${escapeHtml(pdpa.acceptLabel || "ยอมรับ")}</button>
      <button type="button" data-pdpa-decline>${escapeHtml(pdpa.declineLabel || "ไม่ใช้งาน")}</button>
    </div>`;
  document.body.appendChild(banner);
  banner.querySelector("[data-pdpa-accept]")?.addEventListener("click", () => {
    localStorage.setItem(CMS_CONSENT_KEY, "accepted");
    banner.remove();
    trackPageview(content);
  });
  banner.querySelector("[data-pdpa-decline]")?.addEventListener("click", () => {
    localStorage.setItem(CMS_CONSENT_KEY, "declined");
    banner.remove();
  });
}

function trackPageview(content) {
  if (pageviewTracked || !shouldTrackAnalytics(content)) return;
  pageviewTracked = true;
  const payload = JSON.stringify({
    type: "pageview",
    path: normalizeRoute(),
    title: document.title,
  });
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/admin/analytics", new Blob([payload], { type: "application/json" }));
    return;
  }
  fetch("/api/admin/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }).catch(() => {});
}

async function bootCmsRuntime() {
  const request = contentRequests.start();
  contentLoading = true;
  try {
    const payload = await loadContent(request.signal);
    if (!request.isCurrent()) return;
    document.documentElement.dataset.cmsReady = "true";
    document.querySelector("[data-cms-load-error]")?.remove();
    if (payload.unchanged) {
      document.dispatchEvent(new CustomEvent("mw:cms-content-checked", { detail: { content: activeContent } }));
      return;
    }
    const { content } = payload;
    const previous = activeContent;
    if (!previous || !unchanged(previous.navigation, content.navigation)) applyNavigation(content);
    if (!previous || !unchanged(previous.temples, content.temples)) applyTempleOverrides(content);
    const page = pageForRoute(content);
    const previousPage = pageForRoute(previous);
    if (!previous || !unchanged(previousPage, page)) {
      if (!renderCustomPage(content) && !disablePage(page)) {
        if (page && (!previous || !unchanged(previousPage?.sections, page.sections))) applySections(page);
        applyPagePatches(page?.patches);
      }
    }
    if (!previous || !unchanged(previous.site?.pdpa, content.site?.pdpa)) renderPdpaBanner(content);
    activeContent = content;
    activeRevision = payload.revision;
    window.MongkolWelaCMS = {
      content: activeContent,
      reload: bootCmsRuntime,
      applyTempleOverrides: () => applyTempleOverrides(activeContent),
    };
    trackPageview(content);
    document.dispatchEvent(new CustomEvent("mw:cms-content-ready", { detail: { content: activeContent } }));
    document.dispatchEvent(new CustomEvent("mw:cms-content-checked", { detail: { content: activeContent } }));
  } catch (error) {
    if (!request.isCurrent()) return;
    document.documentElement.dataset.cmsReady = "false";
    if (!document.querySelector("[data-cms-load-error]")) {
      const notice = document.createElement("div");
      notice.dataset.cmsLoadError = "true";
      notice.className = "cms-load-error";
      notice.setAttribute("role", "status");
      notice.textContent = "ไม่สามารถยืนยันข้อมูลล่าสุดได้ ";
      const retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = "ลองใหม่";
      retry.addEventListener("click", bootCmsRuntime);
      notice.append(retry);
      document.querySelector("main")?.prepend(notice);
    }
    console.warn("CMS runtime unavailable", error);
  } finally {
    if (request.isCurrent()) {
      contentLoading = false;
      markCmsNavigationReady();
    }
  }
}

if (!document.body.classList.contains("admin-page")) {
  bootCmsRuntime();
  startContentRefresh(() => contentLoading ? undefined : bootCmsRuntime());
}
