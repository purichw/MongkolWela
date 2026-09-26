import { adminIcon } from "./design.js";
import { projectContentPatches, safeContentUrl } from "../../lib/content-patches.js";
import { homepageCollections, readHomepageCollections, validateHomepageContent } from "../../lib/homepage-content.js";
import { sitePlaceholderImage } from "../../lib/image-placeholder.js";

const sections = [
  ["hero", "ส่วนฮีโร่ (Hero Section)", "image", ".hero", "ภาพพื้นหลัง หัวข้อ และช่องค้นหา"],
  ["shortcuts", "ปุ่มทางลัดในส่วนฮีโร่", "route", ".hero-links", "วางแผนไหว้พระ เส้นทาง และค้นหาวัด"],
  ["daily", "ข้อมูลประจำวัน (Daily Panel)", "calendar-days", "#today", "ข้อความและปุ่มทางลัดด้านข้างฮีโร่"],
  ["stats", "สถิติ / ข้อมูลความน่าเชื่อถือ", "chart-no-axes-combined", ".home-stat-ticker", "ตัวเลขและข้อความใต้ส่วนฮีโร่"],
  ["intents", "หมวดหมู่ตามเป้าหมายชีวิต", "target", ".home-intent-panel", "เรื่องที่ต้องการวางแผน"],
  ["planner", "ส่วนเส้นทางไหว้พระ (แนะนำ)", "route", "#temple-routes", "พื้นหลังและตัวอย่างเส้นทาง"],
  ["categories", "หมวดหมู่หลัก", "layout-grid", "#collections", "หมวดสถานที่และฐานข้อมูลวัด"],
  ["tools", "เครื่องมือเสริม", "sparkles", "#supporting-tools", "ลิงก์เครื่องมือและบริการ"],
  ["closing", "ส่วนท้าย / ปิดท้าย", "quote", ".home-plan-quote", "ข้อความส่งเสริมและหมายเหตุเส้นทาง"],
];

export function createHomepageEditor({ state, escapeHtml: e, markDirty, setTitle, setTopActions, setStatus, uploadMedia }) {
  let source;
  let pageRegistry = [];
  let activeSlide = 0;
  let fieldDefinitions = new Map();
  let defaultCollections = {};
  let busy = false;
  let dragItem;
  let openSections = new Set(window.matchMedia("(max-width: 700px)").matches ? [] : ["settings", "hero", "shortcuts", "daily", "stats"]);
  const expandedCards = new Set();
  const owner = () => state.content.pages.find(page => page.id === "home");
  const iconButton = (icon, label, attributes = "") => `<button type="button" class="mw-admin-icon-button" aria-label="${e(label)}" title="${e(label)}" ${attributes}>${adminIcon(icon)}</button>`;
  const sectionEnabled = selector => owner()?.sections?.find(item => item.selector === selector)?.enabled !== false;
  const cards = key => owner()?.homepage?.collections?.[key] || defaultCollections[key] || [];
  const writableCards = key => {
    owner().homepage ||= { collections: {} };
    owner().homepage.collections ||= {};
    owner().homepage.collections[key] ||= structuredClone(defaultCollections[key] || []);
    return owner().homepage.collections[key];
  };

  function writePatch(definition, value) {
    const page = owner();
    page.patches ||= [];
    let patch = page.patches.find(item => item.id === definition.id);
    if (!patch && definition.kind === "image") {
      const image = source.querySelector(definition.selector);
      definition = { src: image?.getAttribute("data-carousel-src") || image?.getAttribute("src") || "", alt: image?.getAttribute("alt") || "", ...definition };
    }
    if (!patch) { patch = { ...definition }; page.patches.push(patch); }
    Object.assign(patch, value);
    markDirty();
  }

  function field(root, selector, label, { attr, rows = 1, max = 300, textNode = false } = {}) {
    const node = root.querySelector(selector);
    if (!node) return "";
    const nodeIndex = textNode ? [...node.childNodes].findIndex(child => child.nodeType === 3 && /\p{L}/u.test(child.textContent)) : undefined;
    const definition = { id: `homepage-${selector}-${attr || (textNode ? "node" : "text")}`, selector,
      kind: attr ? "attr" : textNode ? "text-node" : "html", ...(attr ? { attr } : {}), ...(textNode ? { nodeIndex } : {}), label };
    const value = attr ? node.getAttribute(attr) || "" : textNode ? node.childNodes[nodeIndex]?.textContent.trim() || "" : node.innerHTML.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
    const decoded = root.createElement("textarea"); decoded.innerHTML = value;
    fieldDefinitions.set(definition.id, definition);
    return `<label class="mw-home-field">${e(label)}${rows > 1 ? `<textarea rows="${rows}" data-home-field="${e(definition.id)}" maxlength="${max}">${e(decoded.value)}</textarea>` : `<input data-home-field="${e(definition.id)}" value="${e(attr ? value : decoded.value)}" maxlength="${max}">`}<small class="mw-home-counter" aria-hidden="true">${Array.from(value).length}/${max}</small></label>`;
  }

  function media(root, id, label, compact = false) {
    const node = root.querySelector(`#${id}`);
    const patch = owner().patches?.find(item => item.id === id) || {};
    const src = patch.src ?? node?.getAttribute("data-carousel-src") ?? node?.getAttribute("src") ?? "";
    const alt = patch.alt ?? node?.getAttribute("alt") ?? "";
    const providerReady = !!(state.media?.cloudinary?.enabled || state.media?.imagekit?.enabled);
    return `<div class="mw-home-media ${compact ? "is-compact" : ""}" data-home-media="${e(id)}"><div class="mw-home-media-frame"><img src="${e(src && safeContentUrl(src) ? src : sitePlaceholderImage)}" alt="${e(alt || label)}"><div class="mw-home-media-actions"><label class="mw-admin-btn ${busy || !providerReady ? "is-disabled" : ""}" title="${providerReady ? "" : "ยังไม่ได้เปิดผู้ให้บริการอัปโหลด ใช้ลิงก์รูปภาพด้านล่างได้"}">${adminIcon("image-plus")}เปลี่ยนรูปภาพ<input type="file" accept="image/jpeg,image/png,image/webp" data-home-upload="${e(id)}" ${busy || !providerReady ? "disabled" : ""}></label>${iconButton("trash-2", `ลบ${label}`, `data-home-clear-media="${e(id)}" ${busy ? "disabled" : ""}`)}</div></div>
      <small>${e(label)}${id.startsWith("home-hero") ? " · แนะนำ 1920 × 800 px" : ""} · JPG, PNG, WEBP</small>
      <details class="mw-home-media-details"><summary>ลิงก์รูปภาพและเครดิต</summary><label>ลิงก์รูปภาพ<input data-home-media-prop="src" value="${e(src)}"></label><label>คำอธิบายภาพ<input data-home-media-prop="alt" value="${e(alt)}"></label><label>ตำแหน่งภาพ<input data-home-media-prop="position" value="${e(patch.position || "50% 50%")}" placeholder="50% 50%"></label><label>เครดิตภาพ<input data-home-media-prop="credit" value="${e(patch.credit || "")}"></label><label>แหล่งที่มา<input data-home-media-prop="sourceUrl" value="${e(patch.sourceUrl || "")}"></label><label>สัญญาอนุญาต<input data-home-media-prop="license" value="${e(patch.license || "")}"></label><label>ลิงก์สัญญาอนุญาต<input data-home-media-prop="licenseUrl" value="${e(patch.licenseUrl || "")}"></label></details></div>`;
  }

  function list(key, label) {
    const definition = homepageCollections[key];
    const items = cards(key);
    const input = (item, prop, title, max = 200) => `<label>${title}<input data-home-card-prop="${prop}" value="${e(item[prop] || "")}" maxlength="${max}"></label>`;
    return `<div class="mw-home-card-list" data-home-list="${key}"><div class="mw-home-list-head"><strong>${e(label)} <small>(${items.length} รายการ)</small></strong><button class="mw-admin-btn mw-home-add" type="button" data-home-add="${key}" ${items.length >= definition.max ? "disabled" : ""}>${adminIcon("plus")}เพิ่ม${key === "stops" ? "สถานที่" : "การ์ด"}</button></div><div class="mw-home-card-grid ${["shortcuts", "daily"].includes(key) ? "is-three" : ""}">${items.map((item, index) => `<article class="mw-home-card" data-home-card="${e(item.id)}" data-home-collection="${key}"><details ${expandedCards.has(`${key}-${item.id}`) ? "open" : ""} data-home-card-details="${key}-${e(item.id)}"><summary><span class="mw-home-card-thumb">${definition.image ? `<img src="${e(item.image && safeContentUrl(item.image) ? item.image : sitePlaceholderImage)}" alt="" loading="lazy">` : adminIcon(definition.icon)}</span><span><strong data-home-card-title>${e(item.title || "การ์ดใหม่")}</strong><small data-home-card-description>${e(item.description || item.time || item.href || "")}</small></span>${adminIcon("pencil")}</summary><div class="mw-home-card-fields">${input(item, "title", "หัวข้อ")}${definition.mobileTitle ? input(item, "mobileTitle", "หัวข้อบนมือถือ") : ""}${definition.description ? input(item, "description", "คำอธิบาย", 1000) : ""}${definition.mobileDescription ? input(item, "mobileDescription", "คำอธิบายบนมือถือ", 1000) : ""}${definition.time ? input(item, "time", "เวลา", 20) : ""}${definition.image ? `${input(item, "image", "ลิงก์รูปภาพ", 2000)}${input(item, "alt", "คำอธิบายภาพ", 1000)}` : ""}<label>รูปแบบไอคอน / การ์ด<select data-home-card-prop="template">${(defaultCollections[key] || []).map((template, i) => `<option value="${i}" ${item.template === i ? "selected" : ""}>${e(template.title)}</option>`).join("")}</select></label></div></details><div class="mw-home-card-foot">${iconButton("grip-vertical", `ลากเพื่อเรียง ${item.title}`, `draggable="true" data-home-drag="${index}"`)}${definition.href ? `<label><span class="mw-admin-sr-only">ลิงก์ ${e(item.title)}</span><input data-home-card-prop="href" value="${e(item.href || "")}" placeholder="/" maxlength="2000"></label>` : `<small>${index + 1}</small>`}<div>${iconButton("chevron-up", `เลื่อนขึ้น ${item.title}`, `data-home-move="-1" ${index === 0 ? "disabled" : ""}`)}${iconButton("chevron-down", `เลื่อนลง ${item.title}`, `data-home-move="1" ${index === items.length - 1 ? "disabled" : ""}`)}${iconButton("trash-2", `ลบ ${item.title}`, 'data-home-remove')}</div></div></article>`).join("") || '<p class="mw-home-empty">ยังไม่มีรายการ</p>'}</div></div>`;
  }

  function section(id, number, title, icon, body, subtitle, selector) {
    return `<details class="mw-home-section" data-home-section="${id}" ${openSections.has(id) ? "open" : ""}><summary><span class="mw-home-section-number">${number}</span>${adminIcon(icon)}<span><strong>${e(title)}</strong><small>${e(subtitle || "")}</small></span>${adminIcon("chevron-down")}</summary><div class="mw-home-section-body">${selector ? `<label class="mw-home-toggle">เปิดใช้งานส่วนนี้<input type="checkbox" role="switch" data-home-section-toggle="${e(selector)}" aria-label="เปิดใช้งาน${e(title)}" ${sectionEnabled(selector) ? "checked" : ""}><span aria-hidden="true"></span></label>` : ""}${body}</div></details>`;
  }

  function render(documentSource, registry) {
    if (documentSource) source = documentSource;
    if (registry) pageRegistry = registry;
    if (!source) return;
    document.querySelectorAll("[data-home-section]").forEach(node => node.open ? openSections.add(node.dataset.homeSection) : openSections.delete(node.dataset.homeSection));
    document.querySelectorAll("[data-home-card-details]").forEach(node => node.open ? expandedCards.add(node.dataset.homeCardDetails) : expandedCards.delete(node.dataset.homeCardDetails));
    fieldDefinitions = new Map();
    const root = source.cloneNode(true);
    projectContentPatches(root, [...(state.content.site?.patches || []), ...(owner().patches || [])]);
    defaultCollections = readHomepageCollections(root);
    setTitle("จัดการหน้าแรก (Homepage)", "แผงควบคุม › จัดการเนื้อหา › หน้าแรก");
    document.querySelector("#adminDescription").textContent = "ปรับแต่งเนื้อหาบนหน้าแรกของเว็บไซต์มงคลเวลา";
    setTopActions(`<a class="mw-admin-btn" href="/" target="_blank" rel="noopener">${adminIcon("external-link")}ดูหน้าเว็บไซต์</a><button class="mw-admin-icon-button" type="button" data-page-content-advanced title="การตั้งค่าขั้นสูง" aria-label="การตั้งค่าขั้นสูง">${adminIcon("ellipsis")}</button>`);
    document.querySelector(".mw-admin-main").classList.add("is-home-editor");
    const f = (selector, label, options) => field(root, selector, label, options);
    const cf = (n, label, options) => f(`[data-cms-field="95d291e9-${n}"]`, label, options);
    const settings = `<div class="mw-home-settings"><label>เลือกหน้าเว็บไซต์<select data-page-content-select aria-label="หน้าเว็บไซต์">${pageRegistry.map(page => `<option value="${e(page.id)}" ${page.id === "home" ? "selected" : ""}>${e(page.label)}${page.id === "home" ? " (Homepage)" : ""}</option>`).join("")}</select></label><label>Slug / URL<input value="/" readonly aria-label="Slug / URL"><small>เส้นทางหน้าแรก</small></label>${f("title", "ชื่อหน้า (Title)", { max: 160 })}<label>สถานะ<select data-home-page-enabled aria-label="สถานะหน้าแรก"><option value="true" ${owner().enabled !== false ? "selected" : ""}>เปิดใช้งาน</option><option value="false" ${owner().enabled === false ? "selected" : ""}>ปิดใช้งานชั่วคราว</option></select><small>มีผลหลังเผยแพร่</small></label></div>`;
    const slides = [...root.querySelectorAll("[data-home-hero-image]")];
    const hero = `<div class="mw-home-hero-editor"><div>${media(root, slides[activeSlide]?.id || "home-hero-image-1", `ภาพสไลด์ ${activeSlide + 1}`)}<div class="mw-home-slides" role="group" aria-label="เลือกภาพสไลด์">${slides.map((slide, i) => `<button type="button" data-home-slide="${i}" aria-label="ภาพสไลด์ ${i + 1}" aria-pressed="${activeSlide === i}"><img src="${e(slide.getAttribute("data-carousel-src") || slide.getAttribute("src") || sitePlaceholderImage)}" alt=""><span>${i + 1}</span></button>`).join("")}</div></div><div>${cf(5, "ข้อความนำ (Eyebrow)", { max: 200 })}${cf(4, "หัวข้อหลัก", { max: 100 })}${cf(6, "คำอธิบาย", { rows: 4, max: 500 })}</div><div>${f('#site-search', "ข้อความในช่องค้นหา", { attr: "placeholder", max: 120 })}${f('.home-temple-search button[type="submit"]', "ป้ายปุ่มค้นหา", { max: 40 })}</div></div>`;
    const daily = `<div class="mw-home-daily"><div>${cf(10, "หัวข้อ", { max: 100 })}<label>วันที่และจันทรคติ<input readonly value="${e(root.querySelector("[data-topbar-realtime='solarToday']")?.textContent || "วันที่ปัจจุบัน")}"><small>อัปเดตอัตโนมัติจากปฏิทินไทย</small></label>${cf(16, "คำอธิบาย", { rows: 3, max: 500 })}</div>${list("daily", "ปุ่มทางลัด")}</div>`;
    const stats = `<div class="mw-home-stats">${[22, 24, 26, 27].map((n, i) => `<div>${adminIcon(["landmark", "map-pin", "route", "quote"][i])}${cf(n, ["ป้ายจำนวนวัด", "ป้ายจังหวัด", "ป้ายจำนวนสถานที่", "หัวข้อความน่าเชื่อถือ"][i], { textNode: true, max: 100 })}${i < 3 ? `<strong>${e(root.querySelectorAll(".home-stat-ticker dd")[i]?.textContent || "")}</strong><small>${i < 2 ? "อัปเดตจากฐานข้อมูล" : "จำนวนสถานที่ที่รองรับต่อแผน"}</small>` : cf(28, "ข้อความ", { rows: 2, max: 300 })}</div>`).join("")}</div>`;
    const intent = `<div class="mw-home-fields-two">${cf(29, "ข้อความนำ")}${cf(30, "หัวข้อ", { max: 100 })}</div>${list("intents", "รายการการ์ด")}`;
    const planner = `<div class="mw-home-fields-two">${media(root, "home-planner-background", "ภาพพื้นหลังเส้นทาง", true)}<div>${cf(35, "ข้อความนำ")}${cf(36, "หัวข้อ", { rows: 2 })}${cf(37, "คำอธิบาย", { rows: 3, max: 600 })}${cf(38, "ป้ายปุ่ม", { textNode: true })}${cf(38, "ลิงก์ปุ่ม", { attr: "href", max: 2000 })}</div></div><div class="mw-home-fields-two">${cf(39, "หัวข้อตัวอย่างเส้นทาง")}${cf(40, "ลิงก์จัดแผน", { attr: "href", max: 2000 })}</div>${list("stops", "สถานที่ในเส้นทางตัวอย่าง")}`;
    const categories = `<div class="mw-home-fields-two">${cf(46, "ข้อความนำ")}${cf(47, "หัวข้อ", { max: 100 })}</div>${list("categories", "การ์ดหมวดหมู่")}<div class="mw-home-directory"><strong>ฐานข้อมูลวัดทั่วประเทศ</strong><div class="mw-home-fields-two">${media(root, "home-directory-map", "ภาพฐานข้อมูล", true)}<div>${cf(51, "หัวข้อฐานข้อมูล")}${cf(54, "ป้ายปุ่ม", { textNode: true })}${cf(54, "ลิงก์ฐานข้อมูล", { attr: "href", max: 2000 })}</div></div></div>`;
    const tools = `<div class="mw-home-fields-two">${cf(55, "หัวข้อ")}${cf(56, "คำอธิบาย")}</div>${list("tools", "เครื่องมือ")}`;
    const closing = `<div class="mw-home-fields-two">${cf(43, "ข้อความปิดท้ายเส้นทาง", { rows: 4, max: 600 })}${cf(44, "หมายเหตุ", { textNode: true, rows: 4, max: 600 })}</div>${f('meta[name="description"]', "คำอธิบายหน้าแรก (SEO)", { attr: "content", rows: 3, max: 300 })}`;
    const bodies = { hero, shortcuts: list("shortcuts", "การ์ดทางลัด"), daily, stats, intents: intent, planner, categories, tools, closing };
    document.querySelector("#adminContent").innerHTML = `<div class="mw-home-editor">${section("settings", adminIcon("settings"), "ตั้งค่าหน้าเพจ", "page", settings, "ข้อมูลพื้นฐานของหน้าแรก")}${sections.map(([id, title, icon, selector, subtitle], i) => section(id, i + 1, title, icon, bodies[id], subtitle, selector)).join("")}<div class="mw-home-preview"><span>${adminIcon("eye")}ดูตัวอย่างหน้าแรก</span><a class="mw-admin-btn" href="/" target="_blank" rel="noopener">เปิดหน้าแรกในแท็บใหม่ ${adminIcon("external-link")}</a><small>แสดงฉบับที่เผยแพร่แล้ว</small></div><div class="mw-home-mobile-actions"><button class="mw-admin-btn" type="button" data-action="save-draft" ${state.publishing || busy ? "disabled" : ""}>${adminIcon("save")}บันทึกฉบับร่าง</button><button class="mw-admin-btn mw-admin-btn-primary" type="button" data-action="publish" ${state.publishing || busy ? "disabled" : ""}>${adminIcon("upload")}เผยแพร่</button></div><p class="mw-admin-sr-only" data-home-announcement role="status"></p></div>`;
    const container = document.querySelector("#adminContent");
    container.querySelectorAll("[data-home-field]").forEach(input => input.setAttribute("aria-label", fieldDefinitions.get(input.dataset.homeField).label));
    container.querySelectorAll("[data-home-card]").forEach(node => {
      const item = cards(node.dataset.homeCollection).find(card => card.id === node.dataset.homeCard);
      if (!homepageCollections[node.dataset.homeCollection].image) {
        const collectionIcons = { shortcuts: ["landmark", "route", "map-pin"], daily: ["calendar-days", "calendar-days", "landmark"] };
        const name = collectionIcons[node.dataset.homeCollection]?.[item.template];
        if (name) node.querySelector(".mw-home-card-thumb").innerHTML = adminIcon(name);
        return;
      }
      node.querySelector(".mw-home-card-fields").insertAdjacentHTML("beforeend", `<details class="mw-home-media-details"><summary>ตำแหน่งภาพและเครดิต</summary>${[["position", "ตำแหน่งภาพ"], ["credit", "เครดิตภาพ"], ["sourceUrl", "แหล่งที่มา"], ["license", "สัญญาอนุญาต"], ["licenseUrl", "ลิงก์สัญญาอนุญาต"]].map(([prop, title]) => `<label>${title}<input data-home-card-prop="${prop}" value="${e(item[prop] || "")}" maxlength="2000"></label>`).join("")}</details>`);
    });
    container.addEventListener("dragstart", dragStart);
    container.addEventListener("dragover", dragOver);
    container.addEventListener("drop", drop);
  }

  function move(key, from, to) {
    const items = writableCards(key);
    if (from === to || to < 0 || to >= items.length) return;
    const [item] = items.splice(from, 1); items.splice(to, 0, item);
    markDirty(); render();
    document.querySelector(`[data-home-collection="${key}"][data-home-card="${item.id}"] [data-home-drag]`)?.focus();
    document.querySelector("[data-home-announcement]").textContent = `ย้าย ${item.title} เป็นลำดับที่ ${to + 1}`;
  }
  function dragStart(event) {
    const handle = event.target.closest("[data-home-drag]");
    if (!handle) return;
    const card = handle.closest("[data-home-collection]");
    dragItem = { key: card.dataset.homeCollection, index: Number(handle.dataset.homeDrag) };
    event.dataTransfer.setData("text/plain", JSON.stringify(dragItem)); event.dataTransfer.effectAllowed = "move";
  }
  function dragOver(event) { if (dragItem && event.target.closest(`[data-home-collection="${dragItem.key}"]`)) event.preventDefault(); }
  function drop(event) {
    if (!dragItem) return;
    const card = event.target.closest(`[data-home-collection="${dragItem.key}"]`);
    if (card) { event.preventDefault(); const to = cards(dragItem.key).findIndex(item => item.id === card.dataset.homeCard); move(dragItem.key, dragItem.index, to); }
    dragItem = null;
  }

  function click(event) {
    if (!event.target.closest(".mw-home-editor")) return false;
    const slide = event.target.closest("[data-home-slide]");
    if (slide) { activeSlide = Number(slide.dataset.homeSlide); render(); return true; }
    const clear = event.target.closest("[data-home-clear-media]");
    if (clear) { if (confirm("ลบรูปนี้จากฉบับร่าง? คุณสามารถใส่รูปใหม่ได้ก่อนเผยแพร่")) { writePatch({ id: clear.dataset.homeClearMedia, selector: `#${clear.dataset.homeClearMedia}`, kind: "image" }, { src: "" }); render(); } return true; }
    const add = event.target.closest("[data-home-add]");
    if (add) {
      const key = add.dataset.homeAdd;
      const items = writableCards(key);
      if (items.length >= homepageCollections[key].max) return true;
      const item = { ...structuredClone(defaultCollections[key][0]), id: `card-${crypto.randomUUID()}`, title: "การ์ดใหม่", mobileTitle: "การ์ดใหม่", description: "", mobileDescription: "", ...(homepageCollections[key].href ? { href: "/" } : {}) };
      items.push(item); expandedCards.add(`${key}-${item.id}`); markDirty(); render();
      document.querySelector(`[data-home-card="${item.id}"] [data-home-card-prop="title"]`)?.focus(); return true;
    }
    const control = event.target.closest("[data-home-remove], [data-home-move]");
    if (control) {
      const card = control.closest("[data-home-collection]");
      const key = card.dataset.homeCollection;
      const index = cards(key).findIndex(item => item.id === card.dataset.homeCard);
      if (control.hasAttribute("data-home-move")) move(key, index, index + Number(control.dataset.homeMove));
      else if (confirm(`ลบการ์ด “${cards(key)[index].title}” จากฉบับร่าง?`)) { writableCards(key).splice(index, 1); markDirty(); render(); document.querySelector(`[data-home-add="${key}"]`)?.focus(); }
      return true;
    }
    return false;
  }

  async function upload(target) {
    const file = target.files?.[0];
    if (!file || busy) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) { setStatus("ใช้รูป JPG, PNG หรือ WEBP ขนาดไม่เกิน 10 MB", "error"); return; }
    busy = true; render(); setStatus("กำลังอัปโหลดภาพ", "warn");
    document.querySelectorAll('[data-action="publish"]').forEach(button => { button.disabled = true; });
    try {
      const url = await uploadMedia(file, file.name);
      if (!url || !safeContentUrl(url)) throw new Error("ผู้ให้บริการไม่ได้ส่งลิงก์รูปภาพที่ถูกต้อง");
      const id = target.dataset.homeUpload;
      writePatch({ id, selector: `#${id}`, kind: "image" }, { src: url });
    } catch (error) { setStatus(error.message || "อัปโหลดไม่สำเร็จ กรุณาลองอีกครั้ง", "error"); }
    finally { busy = false; if (state.section === "pages" && state.selectedPageId === "home") render(); document.querySelectorAll('[data-action="publish"]').forEach(button => { button.disabled = !!state.publishing; }); }
  }

  function input(event) {
    const target = event.target;
    if (!target.closest(".mw-home-editor")) return false;
    if (target.matches("[data-home-upload]")) { if (event.type === "change") upload(target); return true; }
    if (target.matches("[data-home-field]")) {
      const definition = fieldDefinitions.get(target.dataset.homeField);
      if (definition) { writePatch(definition, { value: definition.kind === "html" ? e(target.value).replace(/\n/g, "<br>") : target.value }); const counter = target.parentElement.querySelector(".mw-home-counter"); if (counter) counter.textContent = `${Array.from(target.value).length}/${target.maxLength}`; }
      return true;
    }
    if (target.matches("[data-home-media-prop]")) {
      const id = target.closest("[data-home-media]").dataset.homeMedia;
      writePatch({ id, selector: `#${id}`, kind: "image" }, { [target.dataset.homeMediaProp]: target.value });
      if (target.dataset.homeMediaProp === "src" && safeContentUrl(target.value)) target.closest("[data-home-media]").querySelector("img").src = target.value || sitePlaceholderImage;
      return true;
    }
    if (target.matches("[data-home-card-prop]")) {
      const node = target.closest("[data-home-collection]");
      const item = writableCards(node.dataset.homeCollection).find(item => item.id === node.dataset.homeCard);
      const prop = target.dataset.homeCardProp;
      item[prop] = prop === "template" ? Number(target.value) : target.value;
      if (["title", "description"].includes(prop)) node.querySelector(`[data-home-card-${prop}]`).textContent = target.value;
      if (prop === "image" && safeContentUrl(target.value)) node.querySelector(".mw-home-card-thumb img").src = target.value || sitePlaceholderImage;
      markDirty(); return true;
    }
    if (target.matches("[data-home-section-toggle]")) {
      owner().sections ||= [];
      let section = owner().sections.find(item => item.selector === target.dataset.homeSectionToggle);
      if (!section) { section = { id: `homepage-${target.closest("[data-home-section]").dataset.homeSection}`, selector: target.dataset.homeSectionToggle }; owner().sections.push(section); }
      section.enabled = target.checked; markDirty(); return true;
    }
    if (target.matches("[data-home-page-enabled]")) { owner().enabled = target.value === "true"; markDirty(); return true; }
    return false;
  }
  return { render, click, input, validate: () => validateHomepageContent(state.content) };
}
