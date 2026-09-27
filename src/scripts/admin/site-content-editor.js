import { adminIcon } from "./design.js";
import { safeContentUrl } from "../../lib/content-patches.js";

const categories = {
  header: { label: "ส่วนหัว (Header)", icon: "monitor", tone: "jade" },
  navigation: { label: "เมนูมือถือ", icon: "list-filter", tone: "blue" },
  search: { label: "ค้นหา (Search)", icon: "search", tone: "blue" },
  cta: { label: "ปุ่ม (CTA)", icon: "arrow-right", tone: "jade" },
  footer: { label: "ส่วนท้าย (Footer)", icon: "file-text", tone: "blue" },
  shared: { label: "เนื้อหาส่วนกลาง", icon: "layers-2", tone: "gold" },
};

const fieldNames = {
  "cef92c86-1": "ชื่อเว็บไซต์ (ภาษาไทย)",
  "cef92c86-2": "ชื่อเว็บไซต์ (ภาษาอังกฤษ)",
  "cef92c86-5": "ชื่อเมนูหลัก",
  "cef92c86-6": "ข้อความนำเมนู",
  "cef92c86-7": "หัวข้อเมนูมือถือ",
  "cef92c86-8": "คำอธิบายเมนูมือถือ",
  "cef92c86-9": "ปุ่มค้นหาในเมนู",
  "cef92c86-10": "ข้อความปิดท้ายเมนู",
  "786048e5-1": "ข้อความนำส่วนค้นหา",
  "786048e5-2": "หัวข้อส่วนค้นหา",
  "786048e5-3": "หัวข้อหมวดค้นหา",
  "786048e5-5": "ดูสถานที่ทั้งหมด",
  "e5245a14-1": "ชื่อช่องค้นหา",
  "e5245a14-2": "ข้อความในช่องค้นหา",
  "e5245a14-3": "ข้อความปุ่มค้นหา",
  "e5245a14-4": "ข้อความปุ่มลองอีกครั้ง",
  "e5245a14-5": "ดูผลค้นหาทั้งหมด",
  "9f7d7eae-1": "คำอธิบายเว็บไซต์",
  "9f7d7eae-2": "หัวข้อเมนูส่วนท้าย",
  "9f7d7eae-3": "หัวข้อเส้นทางและสถานที่",
  "9f7d7eae-5": "หัวข้อเครื่องมือเสริม",
  "9f7d7eae-8": "หัวข้อปุ่มวางแผน",
  "9f7d7eae-9": "ปุ่มวางแผนไหว้พระ",
  "9f7d7eae-10": "ปุ่มปฏิทินไทย",
  "9f7d7eae-11": "ข้อความลิขสิทธิ์",
  "9f7d7eae-12": "ข้อความหมายเหตุส่วนท้าย",
};

export const sameContentField = (patch, field) => patch.id === field.id || (
  patch.selector === field.selector && patch.kind === field.kind
  && patch.nodeIndex === field.nodeIndex && patch.attr === field.attr
);

function describeField(field, document) {
  const node = document?.querySelector(field.selector);
  const category = node?.closest(".site-footer-home-action a") || node?.closest("button") ? "cta"
    : node?.closest("footer") ? "footer"
    : node?.closest("#temple-search-dialog") ? "search"
    : node?.closest(".mw-fallback, [data-header-drawer-content]") ? "navigation"
    : node?.closest("header, .topbar") ? "header" : "shared";
  const key = node?.getAttribute("data-cms-field");
  let title = fieldNames[key] || field.label;
  if (field.attr === "href" && fieldNames[key]) title = `ลิงก์${title}`;
  const multiline = field.kind !== "attr" && (node?.matches("p") || String(field.value || "").trim().length > 90 || String(field.value || "").trim().includes("\n"));
  const type = field.kind === "image" ? ["รูปภาพ", "image"] : field.attr === "href" ? ["ลิงก์", "link"]
    : multiline ? ["ข้อความยาว", "scroll-text"] : ["ข้อความสั้น", "file-text"];
  const context = category === "header" ? "แบรนด์ในส่วนหัวเว็บไซต์"
    : category === "navigation" ? "ข้อความประกอบเมนูบนมือถือ"
    : category === "footer" ? node?.closest("nav")?.getAttribute("aria-label") || "ส่วนท้ายของทุกหน้า"
    : category === "search" ? "หน้าต่างค้นหาวัดและสถานที่"
    : category === "cta" ? node?.closest("footer") ? "ปุ่มในส่วนท้ายเว็บไซต์" : "ปุ่มในหน้าต่างค้นหา" : "องค์ประกอบที่ใช้ร่วมกัน";
  const line = ["cef92c86-7", "cef92c86-10"].includes(key) ? ` · บรรทัดที่ ${field.nodeIndex === 0 ? 1 : 2}` : "";
  return { field, category, title: title + line, context, multiline, type };
}

export function createSiteContentEditor({ state, escapeHtml: e, setTitle }) {
  let search = "";
  let category = "all";
  let pageNumber = 1;
  let view;
  const pageSize = 8;
  const active = () => state.section === "siteContent";
  const valueOf = field => (state.content.site?.patches || []).findLast(patch => patch.enabled !== false && sameContentField(patch, field)) || field;
  const closeOptions = except => document.querySelectorAll(".mw-site-field-options[open]").forEach(menu => { if (menu !== except) menu.open = false; });
  document.addEventListener("keydown", event => {
    if (!active() || event.key !== "Escape") return;
    const open = document.querySelector(".mw-site-field-options[open]");
    if (open) { closeOptions(); open.querySelector("summary")?.focus(); event.preventDefault(); }
  });

  function row(meta) {
    const { field, title, context, type, multiline } = meta;
    const badge = categories[meta.category];
    const patch = valueOf(field);
    const id = `site-content-${field.id}`;
    const control = field.kind === "image"
      ? `<div class="mw-site-image">${patch.src && safeContentUrl(patch.src) ? `<img src="${e(patch.src)}" alt="${e(patch.alt || "")}" loading="lazy">` : ""}<label for="${e(id)}">ลิงก์รูปภาพ</label><input id="${e(id)}" data-page-content-value="src" value="${e(patch.src || "")}"><label for="${e(id)}-alt">คำอธิบายภาพ</label><input id="${e(id)}-alt" data-page-content-value="alt" value="${e(patch.alt || "")}"></div>`
      : multiline ? `<textarea id="${e(id)}" data-page-content-value="value" rows="2">${e(patch.value ?? "")}</textarea>`
        : `<input id="${e(id)}" data-page-content-value="value" value="${e(patch.value ?? "")}" ${field.attr === "href" ? 'inputmode="url" spellcheck="false"' : ""}>`;
    return `<article class="mw-site-field" data-page-content-id="${e(field.id)}" data-site-category="${meta.category}">
      <span class="mw-site-category ${badge.tone}">${adminIcon(badge.icon)}${badge.label}</span>
      <div class="mw-site-field-title"><label for="${e(id)}">${e(title)}</label><p>${e(context)}</p></div>
      <span class="mw-site-field-type">${adminIcon(type[1])}${type[0]}</span>
      <div class="mw-site-field-control">${control}</div>
      <details class="mw-site-field-options"><summary aria-label="ตัวเลือก ${e(title)}" title="ตัวเลือก ${e(title)}">${adminIcon("ellipsis")}</summary><div>
        <button type="button" data-site-copy="value">${adminIcon("copy")}คัดลอกค่า</button>
        <button type="button" data-site-copy="id">${adminIcon("link")}คัดลอกรหัสช่อง</button>
      </div></details>
    </article>`;
  }

  function render(data = view) {
    view = data;
    setTitle("ส่วนกลางเว็บไซต์", "ส่วนกลางเว็บไซต์");
    document.querySelector(".mw-admin-main")?.classList.add("is-site-content");
    document.querySelector("#adminTitle").innerHTML = `<span class="mw-site-title-icon" aria-hidden="true">${adminIcon("layers-2")}</span><span>ส่วนกลางเว็บไซต์</span><span class="mw-site-title-tag">จัดการเนื้อหาส่วนกลาง</span>`;
    document.querySelector("#adminDescription").textContent = "ส่วนหัว เมนูค้นหา ปุ่ม และส่วนท้ายที่ใช้ร่วมกันในเว็บไซต์";
    const published = state.content.publishedAt;
    const date = published && Number.isFinite(Date.parse(published)) ? new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(published)) : "";
    document.querySelector(".mw-admin-header-actions").insertAdjacentHTML("beforeend", `<a class="mw-admin-btn mw-site-open" data-site-content-header href="/" target="_blank" rel="noopener">${adminIcon("external-link")}เปิดหน้าเว็บไซต์</a>${date ? `<time class="mw-site-updated" data-site-content-header datetime="${e(published)}">เผยแพร่ล่าสุด ${e(date)}</time>` : ""}`);
    const root = document.querySelector("#adminContent");
    if (!data.fields) {
      root.innerHTML = `<div class="mw-site-state" role="status">${adminIcon(data.error ? "info" : "layers-2")}<h2>${data.error ? "โหลดเนื้อหาไม่สำเร็จ" : "กำลังโหลดเนื้อหาส่วนกลาง"}</h2>${data.error ? `<p>${e(data.error)}</p><button type="button" class="mw-admin-btn" data-page-content-retry>${adminIcon("rotate-ccw")}ลองอีกครั้ง</button>` : '<span class="mw-site-loading" aria-hidden="true"></span>'}</div>`;
      return;
    }
    const fields = data.fields.map(field => describeField(field, data.document));
    const counts = Object.fromEntries(Object.keys(categories).map(key => [key, fields.filter(item => item.category === key).length]));
    const query = search.trim().toLocaleLowerCase("th");
    const filtered = fields.filter(item => {
      const patch = valueOf(item.field);
      return (category === "all" || item.category === category) && `${item.title} ${item.context} ${categories[item.category].label} ${item.field.label} ${patch.value ?? ""} ${patch.src || ""} ${patch.alt || ""}`.toLocaleLowerCase("th").includes(query);
    });
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    pageNumber = Math.max(1, Math.min(pages, pageNumber));
    const start = (pageNumber - 1) * pageSize;
    const shown = filtered.slice(start, start + pageSize);
    const center = Math.max(2, Math.min(pages - 1, pageNumber));
    const pageNumbers = [...new Set([1, pages, ...Array.from({ length: 3 }, (_, index) => center + index - 1).filter(value => value > 0 && value <= pages)])].sort((a, b) => a - b);
    root.innerHTML = `<div class="mw-site-filters mw-page-content-filters">
      <label>เลือกหมวดหมู่<select data-site-category-filter aria-label="เลือกหมวดหมู่"><option value="all">ทุกหมวดหมู่</option>${Object.entries(categories).filter(([key]) => counts[key]).map(([key, item]) => `<option value="${key}" ${category === key ? "selected" : ""}>${item.label} (${counts[key]})</option>`).join("")}</select></label>
      <label>ค้นหาข้อความ<span class="mw-site-search">${adminIcon("search")}<input type="search" data-page-content-search value="${e(search)}" placeholder="ค้นหาชื่อหัวข้อ ข้อความ หรือรูป..." aria-label="ค้นหาข้อความ"></span></label>
      <span class="mw-site-result-count" role="status">${filtered.length} รายการ${category !== "all" || query ? ` จาก ${fields.length}` : ""}</span>
      <button class="mw-admin-btn mw-site-reset" type="button" data-site-reset>${adminIcon("rotate-ccw")}ล้างตัวกรอง</button>
    </div>
    <p class="mw-site-feedback" role="status" data-site-feedback></p>
    <div class="mw-site-fields mw-page-content-fields">${shown.map(row).join("") || `<div class="mw-site-state" role="status">${adminIcon("search")}<h2>ไม่พบเนื้อหาที่ตรงกัน</h2><button class="mw-admin-btn" type="button" data-site-reset>ล้างตัวกรอง</button></div>`}</div>
    <footer class="mw-site-pagination"><span>แสดง ${filtered.length ? start + 1 : 0}${shown.length > 1 ? `–${start + shown.length}` : ""} จาก ${filtered.length} รายการ</span><nav aria-label="หน้ารายการเนื้อหาส่วนกลาง">
      <button class="mw-admin-btn mw-admin-btn-icon" type="button" data-site-page="${pageNumber - 1}" ${pageNumber === 1 ? "disabled" : ""} aria-label="หน้าก่อนหน้า" title="หน้าก่อนหน้า">${adminIcon("chevron-left")}</button>
      ${pageNumbers.map((number, index) => `${index > 0 && number - pageNumbers[index - 1] > 1 ? '<span class="mw-site-page-gap" aria-hidden="true">…</span>' : ""}<button class="mw-admin-btn mw-admin-btn-icon" type="button" data-site-page="${number}" ${pageNumber === number ? 'aria-current="page"' : ""} aria-label="หน้า ${number}">${number}</button>`).join("")}
      <button class="mw-admin-btn mw-admin-btn-icon" type="button" data-site-page="${pageNumber + 1}" ${pageNumber === pages ? "disabled" : ""} aria-label="หน้าถัดไป" title="หน้าถัดไป">${adminIcon("chevron-right")}</button>
    </nav></footer>`;
  }

  function click(event) {
    if (!active()) return false;
    const menu = event.target.closest(".mw-site-field-options");
    closeOptions(menu);
    const pagination = event.target.closest("[data-site-page]");
    if (pagination) {
      pageNumber = Number(pagination.dataset.sitePage); render();
      document.querySelector('.mw-site-pagination [aria-current="page"]')?.focus({ preventScroll: true });
      document.querySelector(".mw-site-filters")?.scrollIntoView({ block: "start" });
      return true;
    }
    if (event.target.closest("[data-site-reset]")) {
      search = ""; category = "all"; pageNumber = 1; render();
      document.querySelector("[data-page-content-search]")?.focus({ preventScroll: true });
      return true;
    }
    const copy = event.target.closest("[data-site-copy]");
    if (copy) {
      const id = copy.closest("[data-page-content-id]").dataset.pageContentId;
      const field = view.fields.find(item => item.id === id);
      const patch = valueOf(field);
      const value = copy.dataset.siteCopy === "id" ? field.id : patch.value ?? patch.src ?? "";
      const summary = menu.querySelector("summary");
      closeOptions(); summary.focus();
      const announce = text => { const feedback = active() && document.querySelector("[data-site-feedback]"); if (feedback) feedback.textContent = text; };
      const copying = navigator.clipboard ? navigator.clipboard.writeText(String(value)) : Promise.reject();
      copying.then(() => announce("คัดลอกแล้ว")).catch(() => announce("คัดลอกไม่สำเร็จ กรุณาเลือกข้อความแล้วคัดลอกอีกครั้ง"));
      return true;
    }
    return false;
  }

  function input(event) {
    if (!active()) return false;
    const target = event.target;
    if (target.matches("[data-site-category-filter]")) {
      category = target.value; pageNumber = 1; render();
      requestAnimationFrame(() => { if (active()) document.querySelector('[data-site-category-filter]')?.closest('.mw-select')?.focus(); });
      return true;
    }
    if (!target.matches("[data-page-content-search]")) return false;
    if (event.isComposing) return true;
    search = target.value; pageNumber = 1;
    const caret = target.selectionStart;
    render();
    const input = document.querySelector("[data-page-content-search]");
    input?.focus({ preventScroll: true });
    input?.setSelectionRange(caret, caret);
    return true;
  }
  return { render, click, input };
}
