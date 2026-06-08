const CMS_CONTENT_URL = "/api/admin/content";
const CMS_FALLBACK_URL = "/admin/content/default.json";
const CMS_STORAGE_KEY = "mongkolwela.cms.content";
const CMS_CONSENT_KEY = "mongkolwela.pdpa.analytics";

let activeContent = null;

async function fetchJson(url) {
  const response = await fetch(`${url}${url.includes("?") ? "&" : "?"}ts=${Date.now()}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
  return response.json();
}

async function loadContent() {
  try {
    const payload = await fetchJson(CMS_CONTENT_URL);
    if (payload.content) {
      localStorage.setItem(CMS_STORAGE_KEY, JSON.stringify(payload.content));
      return payload.content;
    }
  } catch {
    // Fall through to bundled/default content.
  }
  try {
    const content = await fetchJson(CMS_FALLBACK_URL);
    localStorage.setItem(CMS_STORAGE_KEY, JSON.stringify(content));
    return content;
  } catch {
    const cached = localStorage.getItem(CMS_STORAGE_KEY);
    return cached ? JSON.parse(cached) : null;
  }
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
  const navMenu = document.querySelector(".nav-menu");
  if (!navMenu || !content?.navigation) return;
  const tabs = (content.navigation.tabs || []).filter((item) => item.enabled !== false);
  const utility = (content.navigation.utility || []).filter((item) => item.enabled !== false);
  navMenu.innerHTML = `${tabs
    .map((item) => {
      const children = (item.items || []).filter((child) => child.enabled !== false);
      return `<div class="nav-item">
        <a href="${escapeHtml(resolveHref(item.href))}">${escapeHtml(item.label)}</a>
        <div class="mega-panel">
          ${children
            .map((child) =>
              child.section
                ? `<span class="mega-panel-section">${escapeHtml(child.label)}</span>`
                : `<a href="${escapeHtml(resolveHref(child.href))}">${escapeHtml(child.label)}</a>`,
            )
            .join("")}
        </div>
      </div>`;
    })
    .join("")}
    ${utility
      .map((item) => `<a class="plain-link" href="${escapeHtml(resolveHref(item.href))}">${escapeHtml(item.label)}</a>`)
      .join("")}`;
}

function applyPatch(patch) {
  if (!patch?.selector || patch.enabled === false) return;
  document.querySelectorAll(patch.selector).forEach((node) => {
    if (patch.kind === "image") {
      if ("src" in node && patch.src) node.setAttribute("src", patch.src);
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

function applySections(page) {
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
  if (!page || page.enabled !== false) return false;
  const main = document.querySelector("main");
  if (!main) return true;
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
      <img src="${escapeHtml(props.src || "/assets/images/temple-placeholder-auspicious.png")}" alt="${escapeHtml(props.alt || "")}">
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
  const override = content?.temples?.overrides?.[key];
  if (!override || override.enabled === false) return null;
  return override;
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
    const override = getTempleOverride(content, templeKeyFromHref(card.getAttribute("href")));
    if (!override) return;
    const fields = override.fields || {};
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
    setText(".popular-temple-card-body span", region, card);
    setText(".popular-temple-card-body h3", name, card);
    setText(".popular-temple-card-body p", `${province}${district ? ` / ${district}` : ""}`, card);

    const image = card.querySelector("img");
    if (image && fields.imageUrl) {
      image.src = fields.imageUrl;
      image.dataset.fallbackApplied = "";
      card.classList.remove("is-placeholder");
      card.removeAttribute("data-image-placeholder");
    }
    if (image && fields.imageAlt !== undefined) image.alt = fields.imageAlt;
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
  return `<article class="temple-detail-visit-card temple-detail-visit-card--${escapeHtml(section.kind || "info")} ${className}">
    <span class="temple-detail-visit-card__label">${escapeHtml(section.label)}</span>
    <p>${escapeHtml(section.summary)}</p>
    ${
      timetable.length
        ? `<table class="temple-detail-visit-timetable"><tbody>${timetable
            .map((row) => `<tr><th scope="row">${escapeHtml(row.day)}</th><td>${escapeHtml(row.time)}</td></tr>`)
            .join("")}</tbody></table>`
        : ""
    }
    ${
      section.details.length
        ? `<dl>${section.details.map((item) => `<div><dt>${escapeHtml(item.term)}</dt><dd>${escapeHtml(item.value)}</dd></div>`).join("")}</dl>`
        : ""
    }
  </article>`;
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
    pushVisitDetail(details, "โทรศัพท์", section.phone);
    pushVisitDetail(details, "LINE", section.line);
    pushVisitDetail(details, "Facebook", section.facebook);
    pushVisitDetail(details, "อีเมล", section.email);
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
  const fields = override.fields || {};
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
  const image = root.querySelector(".temple-detail-hero__media img");
  if (image && fields.imageUrl) image.src = fields.imageUrl;
  if (image && fields.imageAlt !== undefined) image.alt = fields.imageAlt;
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
  const sourceList = root.querySelector(".temple-detail-visit-sources ul");
  if (sourceList && Array.isArray(visit.sources)) {
    sourceList.innerHTML = visit.sources
      .map((source) => `<li><a href="${escapeHtml(source.url || "#")}" target="_blank" rel="noopener">${escapeHtml(source.label || source.url || "แหล่งข้อมูล")}</a></li>`)
      .join("");
  } else if (Array.isArray(visit.sources) && visit.sources.length) {
    root.querySelector(".temple-detail-visit__notice")?.remove();
    root.querySelector(".temple-detail-visit__grid")?.insertAdjacentHTML(
      "afterend",
      `<details class="temple-detail-visit-sources"><summary>แหล่งข้อมูลที่ใช้ยืนยัน</summary><ul>${visit.sources
        .map((source) => `<li><a href="${escapeHtml(source.url || "#")}" target="_blank" rel="noopener">${escapeHtml(source.label || source.url || "แหล่งข้อมูล")}</a></li>`)
        .join("")}</ul></details>`,
    );
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
  });
  setText(".temple-detail-map-card__body p", locationText, root);
  const metaRows = root.querySelectorAll(".temple-detail-meta div");
  if (metaRows[0]) setText("dd", province, metaRows[0]);
  if (metaRows[1]) setText("dd", district || "-", metaRows[1]);
  if (metaRows[2]) setText("dd", region, metaRows[2]);
}

function applyTempleOverrides(content) {
  if (!content?.temples?.overrides) return;
  applyTempleCardOverrides(content);
  applyTempleDetailOverride(content);
}

function shouldTrackAnalytics(content) {
  if (!content?.analytics?.enabled) return false;
  if (!content.site?.pdpa?.analyticsConsentRequired) return true;
  return localStorage.getItem(CMS_CONSENT_KEY) === "accepted";
}

function renderPdpaBanner(content) {
  if (!content?.site?.pdpa?.analyticsConsentRequired) return;
  if (localStorage.getItem(CMS_CONSENT_KEY)) return;
  const pdpa = content.site.pdpa;
  const banner = document.createElement("aside");
  banner.className = "pdpa-consent";
  banner.innerHTML = `<p>${escapeHtml(pdpa.bannerText || "")}</p>
    <div>
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
  if (!shouldTrackAnalytics(content)) return;
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
  const content = await loadContent();
  if (!content) return;
  activeContent = content;
  document.documentElement.dataset.cmsReady = "true";
  applyNavigation(content);
  applyTempleOverrides(content);
  if (!renderCustomPage(content)) {
    const page = pageForRoute(content);
    if (!disablePage(page) && page) {
      applySections(page);
      (page.patches || []).forEach(applyPatch);
    }
  }
  renderPdpaBanner(content);
  trackPageview(content);
  window.MongkolWelaCMS = { content: activeContent, reload: bootCmsRuntime };
}

bootCmsRuntime();
