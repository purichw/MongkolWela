import { prepareContentFields, scanContentFields } from "../../lib/page-content-fields.js";
import { projectContentPatches, safeContentUrl } from "../../lib/content-patches.js";
import { adminIcon } from "./design.js";
import defaults from "../../../public/admin/content/default.json";
import { tarotMeaningCards } from "../../data/tarot-meanings.js";
import { createHomepageEditor } from "./homepage-editor.js";
import { createSiteContentEditor, sameContentField } from "./site-content-editor.js";

const additionalPages = [401, 403, 404, 429, 500, 502, 503, 504].map(code => ({ id: `error${code}`, route: [404, 500].includes(code) ? `/${code}.html` : `/${code}/`, label: `หน้าข้อผิดพลาด ${code}` }));
additionalPages.push(...tarotMeaningCards.map(card => ({ id: `meaning-${card.slug}`, route: `/tarot/meanings/${card.slug}/`, label: `ความหมายไพ่ ${card.thName}` })));
for (const name of ["daily", "monthly", "love", "money", "career", "luck"]) additionalPages.push({ id: `tarot-${name}-result`, route: `/tarot/${name}/result/`, label: `ผลไพ่ ${name}` });
additionalPages.push({ id: "login", route: "/login/", label: "เลือกช่องทางเข้าสู่ระบบ" });

export function createPageContentEditor({ state, escapeHtml: e, markDirty, setTitle, setTopActions, setStatus, renderAdvanced, uploadMedia }) {
  const homepageEditor = createHomepageEditor({ state, escapeHtml: e, markDirty, setTitle, setTopActions, setStatus, uploadMedia });
  const siteEditor = createSiteContentEditor({ state, escapeHtml: e, setTitle });
  const documents = new Map();
  const blueprints = new Map();
  const failures = new Map();
  const pending = new Set();
  let search = "";
  let group = "all";
  let pageNumber = 1;
  const pageSize = 12;
  const shared = () => state.section === "siteContent";
  const registry = () => {
    const pages = [...(state.content.pages || [])];
    const routes = new Set(pages.map(page => page.route));
    for (const page of [...defaults.pages.filter(page => page.kind !== "custom"), ...additionalPages]) {
      if (!routes.has(page.route)) { pages.push({ id: page.id, route: page.route, label: page.label, enabled: true, patches: [], sections: [], kind: "existing" }); routes.add(page.route); }
    }
    return pages;
  };
  const current = () => registry().find(page => page.id === state.selectedPageId) || registry()[0];
  const key = () => shared() ? "shared" : current()?.route;
  const patches = () => shared() ? state.content.site?.patches || [] : state.content.pages.find(page => page.id === current()?.id)?.patches || [];

  async function load() {
    const isShared = shared();
    const route = isShared ? "/" : current()?.route;
    const cacheKey = key();
    if (!route || pending.has(cacheKey)) return;
    pending.add(cacheKey); failures.delete(cacheKey); render();
    try {
      if (!route.startsWith("/") || route.startsWith("//")) throw new Error("เปิดได้เฉพาะหน้าภายในเว็บไซต์");
      const response = await fetch(route, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok && !/^\/404(?:\/|\.html)?$/.test(route)) throw new Error(`โหลดหน้าเว็บไม่สำเร็จ (${response.status})`);
      const document = new DOMParser().parseFromString(await response.text(), "text/html");
      if (!document.querySelector("[data-cms-page]")) throw new Error("หน้านี้ไม่มีแม่แบบเนื้อหาที่รองรับ");
      prepareContentFields(document);
      documents.set(cacheKey, document.cloneNode(true));
      if (!isShared) projectContentPatches(document, [...(state.content.site?.patches || []), ...(state.content.pages.find(page => page.route === route)?.patches || [])]);
      const fields = scanContentFields(document);
      blueprints.set(cacheKey, fields.filter(field => {
        const node = document.querySelector(field.selector);
        const global = !node?.closest("main");
        return isShared ? global : !global;
      }));
    } catch (error) { failures.set(cacheKey, error.message); }
    finally { pending.delete(cacheKey); if (["pages", "siteContent"].includes(state.section)) render(); }
  }

  function render() {
    if (shared()) {
      const fields = blueprints.get("shared");
      siteEditor.render({ fields, document: documents.get("shared"), error: failures.get("shared") });
      if (!fields && !pending.has("shared") && !failures.has("shared")) load();
      return;
    }
    const page = current();
    if (!page) return renderAdvanced();
    if (!shared() && page.id === "home" && documents.has(key())) {
      if (!state.content.pages.some(item => item.id === "home")) state.content.pages.push(structuredClone(page));
      homepageEditor.render(documents.get(key()), registry());
      return;
    }
    document.querySelector(".mw-admin-main")?.classList.remove("is-home-editor");
    setTitle(shared() ? "ส่วนกลางเว็บไซต์" : "หน้าและเนื้อหา", shared() ? "ส่วนหัวและส่วนท้าย" : "เนื้อหารายหน้า");
    setTopActions("");
    const root = document.querySelector("#adminContent");
    const cacheKey = key();
    const fields = blueprints.get(cacheKey);
    const fieldGroups = [...new Set((fields || []).map(field => field.context))];
    const selected = group === "all" || fieldGroups.includes(group) ? group : "all";
    const visible = (fields || []).filter(field => (selected === "all" || selected === field.context) && `${field.label} ${field.context}`.toLocaleLowerCase("th").includes(search.toLocaleLowerCase("th")));
    const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
    pageNumber = Math.min(pageNumber, pageCount);
    root.innerHTML = `<div class="mw-page-content-toolbar">${shared() ? '<h2>เนื้อหาที่ใช้ร่วมกันทุกหน้า</h2>' : `<label>หน้าเว็บไซต์<select data-page-content-select aria-label="หน้าเว็บไซต์">${registry().map(item => `<option value="${e(item.id)}" ${item.id === page.id ? "selected" : ""}>${e(item.label)}</option>`).join("")}</select></label>`}
      <a class="mw-admin-btn" href="${e(shared() ? "/" : page.route)}" target="_blank" rel="noopener">${adminIcon("external-link")} เปิดหน้าเว็บ</a>
      ${shared() ? "" : '<button class="mw-admin-btn" data-page-content-advanced>ตั้งค่าหน้า / โครงสร้าง</button>'}</div>
      <div class="mw-library-intro"><div><h2>${shared() ? "ส่วนหัว · ส่วนท้าย · ข้อความส่วนกลาง" : e(page.label)}</h2><p>${shared() ? "แก้ครั้งเดียว แสดงเหมือนกันทุกหน้า" : e(page.route)}</p></div>${fields ? `<span>${fields.length} ช่องเนื้อหา</span>` : ""}</div>
      ${fields ? `<div class="mw-page-content-filters"><label>ส่วนของหน้า<select data-page-content-group><option value="all">ทุกส่วน</option>${fieldGroups.map(value => `<option value="${e(value)}" ${selected === value ? "selected" : ""}>${e(value.slice(0, 80))}</option>`).join("")}</select></label><label>ค้นหาช่องเนื้อหา<input type="search" data-page-content-search value="${e(search)}" placeholder="ค้นหาหัวข้อ ข้อความ หรือรูป"></label></div>
      <div class="mw-page-content-fields">${visible.slice((pageNumber - 1) * pageSize, pageNumber * pageSize).map(field => fieldEditor(field)).join("") || '<p class="mw-library-message">ไม่พบช่องเนื้อหาในส่วนนี้</p>'}</div>
      <div class="mw-library-pagination"><span>${visible.length} ช่อง · หน้า ${pageNumber} / ${pageCount}</span><button class="mw-admin-btn mw-admin-btn-icon" data-page-content-page="${pageNumber - 1}" ${pageNumber === 1 ? "disabled" : ""} aria-label="หน้าก่อนหน้า" title="หน้าก่อนหน้า">${adminIcon("chevron-left")}</button><button class="mw-admin-btn mw-admin-btn-icon" data-page-content-page="${pageNumber + 1}" ${pageNumber === pageCount ? "disabled" : ""} aria-label="หน้าถัดไป" title="หน้าถัดไป">${adminIcon("chevron-right")}</button></div>`
        : `<div class="mw-library-message" role="status">${pending.has(cacheKey) ? "กำลังโหลดเนื้อหาจากแม่แบบหน้าเว็บ" : e(failures.get(cacheKey) || "กำลังเตรียมเนื้อหา")}${failures.has(cacheKey) ? '<p><button class="mw-admin-btn" data-page-content-retry>ลองอีกครั้ง</button></p>' : ""}</div>`}`;
    if (!fields && !pending.has(cacheKey) && !failures.has(cacheKey)) load();
  }

  function fieldEditor(field) {
    const patch = patches().find(item => item.id === field.id)
      || patches().find(item => item.selector === field.selector && item.kind === field.kind && item.nodeIndex === field.nodeIndex && item.attr === field.attr)
      || field;
    return `<div class="mw-page-content-field" data-page-content-id="${e(field.id)}"><div><small>${e(field.context)}</small><strong>${e(field.label)}</strong><span>${field.kind === "image" ? "รูปภาพ" : field.attr === "href" ? "ลิงก์" : "ข้อความ"}</span></div><div>${field.kind === "image"
      ? `${patch.src && safeContentUrl(patch.src) ? `<img class="mw-page-content-image" src="${e(patch.src)}" alt="${e(patch.alt || "ภาพตัวอย่าง")}" loading="lazy">` : ""}<label>ลิงก์รูปภาพ<input data-page-content-value="src" value="${e(patch.src || "")}"></label><label>คำอธิบายภาพ<input data-page-content-value="alt" value="${e(patch.alt || "")}"></label>`
      : `<label><span class="mw-admin-sr-only">${e(field.label)}</span>${field.attr ? `<input data-page-content-value="value" value="${e(patch.value ?? "")}">` : `<textarea data-page-content-value="value" rows="${String(patch.value || "").length > 150 ? 4 : 2}">${e(patch.value ?? "")}</textarea>`}</label>`}</div></div>`;
  }

  function click(event) {
    if (siteEditor.click(event)) return true;
    if (homepageEditor.click(event)) return true;
    const pagination = event.target.closest("[data-page-content-page]");
    if (pagination) { pageNumber = Number(pagination.dataset.pageContentPage); render(); document.querySelector(".mw-page-content-filters")?.scrollIntoView({ block: "start" }); return true; }
    if (event.target.closest("[data-page-content-retry]")) { load(); return true; }
    if (event.target.closest("[data-page-content-advanced]")) {
      if (!state.content.pages.some(page => page.id === current().id)) state.content.pages.push(structuredClone(current()));
      renderAdvanced(); return true;
    }
    return false;
  }
  function input(event) {
    const target = event.target;
    if (siteEditor.input(event)) return true;
    if (homepageEditor.input(event)) return true;
    if (target.matches("[data-page-content-select]")) { state.selectedPageId = target.value; search = ""; group = "all"; pageNumber = 1; render(); return true; }
    if (target.matches("[data-page-content-group]")) { group = target.value; pageNumber = 1; render(); return true; }
    if (target.matches("[data-page-content-search]")) { search = target.value; pageNumber = 1; render(); document.querySelector("[data-page-content-search]")?.focus(); return true; }
    if (!target.matches("[data-page-content-value]")) return false;
    const id = target.closest("[data-page-content-id]").dataset.pageContentId;
    const field = blueprints.get(key())?.find(item => item.id === id);
    if (!field) return true;
    let owner;
    if (shared()) { state.content.site ||= {}; owner = state.content.site; }
    else {
      owner = state.content.pages.find(page => page.id === current().id);
      if (!owner) { owner = structuredClone(current()); state.content.pages.push(owner); }
    }
    owner.patches ||= [];
    let patch = owner.patches.findLast(item => item.enabled !== false && sameContentField(item, field))
      || owner.patches.findLast(item => sameContentField(item, field));
    if (!patch) { patch = { ...field }; delete patch.context; owner.patches.push(patch); }
    if (patch.enabled === false) patch.enabled = true;
    patch[target.dataset.pageContentValue] = target.value;
    markDirty(); return true;
  }
  return { render, click, input };
}
