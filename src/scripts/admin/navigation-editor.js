import { adminIcon } from "./design.js";
import { editableNavigationGroups, navigationModel, renderDesktopNavigation, renderMobileNavigation } from "../../lib/site-navigation.js";
import headerStyles from "../../styles/header.css?url";
import templeArt from "../../assets/loading/temple.png?url";
import lotusArt from "../../assets/loading/lotus.png?url";

const icons = ["", "landmark", "route", "map-pin", "calendar-days", "sparkles", "store", "book-open", "star", "heart", "hand", "layers-2", "coins"];
const iconLabels = ["อัตโนมัติ", "วัด", "เส้นทาง", "สถานที่", "ปฏิทิน", "เครื่องมือ", "ร้านค้า", "บทความ", "ดาว", "หัวใจ", "ลายมือ", "ไพ่", "ร่วมบุญ"];

export function createNavigationEditor({ state, escapeHtml: e, setTitle, setTopActions, markDirty, setStatus, uploadMedia }) {
  let selected = 0;
  let pane = "info";
  let previewMode = "desktop";
  let mobileDetail = false;
  let collapsed = false;
  let uploading = false;
  let drag;
  const normalizedDocuments = new WeakSet();
  const tabs = () => state.content.navigation.tabs;
  const nodeAt = path => path.split(".").reduce((value, key) => value?.[key], state.content.navigation);
  const parentAt = path => nodeAt(path.split(".").slice(0, -1).join("."));
  const button = (icon, label, attr = "") => `<button type="button" class="mw-admin-icon-button" title="${e(label)}" aria-label="${e(label)}" ${attr}>${adminIcon(icon)}</button>`;
  const field = (item, path, prop, label, fallback = "", area = false) => `<label>${e(label)}${area ? `<textarea rows="2" data-menu-field="${prop}" data-menu-path="${path}" maxlength="600">${e(item[prop] ?? fallback)}</textarea>` : `<input data-menu-field="${prop}" data-menu-path="${path}" value="${e(item[prop] ?? fallback)}" maxlength="${prop === "href" || prop === "image" ? 2000 : 200}">`}</label>`;
  const toggle = (item, path, prop, label) => `<label class="mw-menu-toggle"><input type="checkbox" role="switch" data-menu-field="${prop}" data-menu-path="${path}" aria-label="${e(label)}" ${item[prop] !== false ? "checked" : ""}><span aria-hidden="true"></span>${e(label)}</label>`;
  const iconPicker = (item, path) => `<label>ไอคอน<span class="mw-menu-icon-picker">${adminIcon(item.icon || "landmark")}<select data-menu-field="icon" data-menu-path="${path}" aria-label="ไอคอน ${e(item.label)}">${icons.map((icon, i) => `<option value="${icon}" ${item.icon === icon || (!item.icon && !icon) ? "selected" : ""}>${iconLabels[i]}</option>`).join("")}</select></span></label>`;

  function reorderControls(path, label, length) {
    const index = Number(path.split(".").at(-1));
    return `<span class="mw-menu-reorder">${button("grip-vertical", `ลาก ${label}`, `draggable="true" data-menu-drag="${path}"`)}${button("chevron-up", `เลื่อนขึ้น ${label}`, `data-menu-move="-1" data-menu-path="${path}" ${index === 0 ? "disabled" : ""}`)}${button("chevron-down", `เลื่อนลง ${label}`, `data-menu-move="1" data-menu-path="${path}" ${index === length - 1 ? "disabled" : ""}`)}${button("trash-2", `ลบ ${label}`, `data-menu-delete="${path}"`)}</span>`;
  }

  function itemRow(item, path, length) {
    return `<div class="mw-menu-item" data-menu-record="${path}"><div class="mw-menu-item-main">${field(item, path, "label", "ชื่อเมนูย่อย")}${toggle(item, path, "enabled", `เปิด ${item.label}`)}${reorderControls(path, item.label, length)}</div><details class="mw-menu-item-settings"><summary>${adminIcon("link")}<span>${e(item.href || "ตั้งค่าลิงก์และการแสดงผล")}</span>${adminIcon("chevron-down")}</summary><div class="mw-menu-two">${field(item, path, "href", "URL")}${iconPicker(item, path)}${field(item, path, "description", "คำอธิบาย", "", true)}</div><div class="mw-menu-toggles">${toggle(item, path, "desktop", "แสดงบน Desktop")}${toggle(item, path, "mobile", "แสดงบน Mobile")}</div></details></div>`;
  }

  function groupCard(item, path, children, letter) {
    const title = item.label || "กลุ่มเมนู";
    const fallback = item.id === "temple-featured-section" ? "วัดดังน่าไป วัดเด่นขอพร และพิกัดสายมู" : "";
    return `<section class="mw-menu-group" data-menu-record="${path}"><header><span class="mw-menu-letter">${letter}</span>${adminIcon(item.icon || "landmark")}<h3>${e(title)}</h3>${reorderControls(path, title, parentAt(path).length)}</header><div class="mw-menu-two">${field(item, path, "label", "ชื่อกลุ่ม")}${field(item, path, "description", "คำอธิบาย", fallback)}</div><div class="mw-menu-toggles">${toggle(item, path, "enabled", "เปิดใช้งานกลุ่ม")}${toggle(item, path, "desktop", "Desktop")}${toggle(item, path, "mobile", "Mobile")}</div><div class="mw-menu-subitems"><h4>เมนูย่อยในกลุ่ม <small>(${children.length} รายการ)</small></h4>${children.map(({ item: child, path: childPath }) => itemRow(child, childPath, parentAt(childPath).length)).join("")}</div><button type="button" class="mw-admin-btn" data-menu-add-child="${path}">${adminIcon("plus")}เพิ่มเมนูย่อย</button></section>`;
  }

  function itemGroups(tab, index) {
    const result = [];
    let group;
    (tab.items || []).forEach((item, i) => {
      const path = `tabs.${index}.items.${i}`;
      if (item.section || item.items?.length) {
        group = { item, path, children: (item.items || []).map((child, j) => ({ item: child, path: `${path}.items.${j}` })) };
        result.push(group);
      } else { group = null; result.push({ item, path }); }
    });
    return result.map(({ item, path, children }, i) => {
      const letter = String.fromCharCode(65 + i);
      if (children) return groupCard(item, path, children, letter);
      const feature = item.href?.replace(/^\//, "") === "temples/planner/";
      const providerReady = !!(state.media?.cloudinary?.enabled || state.media?.imagekit?.enabled);
      return `<section class="mw-menu-group" data-menu-record="${path}"><header><span class="mw-menu-letter">${letter}</span>${adminIcon(feature ? "landmark" : item.icon || "map-pin")}<h3>${feature ? "เนื้อหาแนะนำหลัก" : `ลิงก์เดี่ยว · ${e(item.label)}`}</h3>${reorderControls(path, item.label, tab.items.length)}</header><div class="mw-menu-two">${feature ? field(item, path, "eyebrow", "ข้อความหัวข้อเล็ก (Eyebrow)", "MONGKOL WELA") : ""}${field(item, path, "label", "หัวข้อ")}${field(item, path, "href", "URL")}${field(item, path, "description", "คำอธิบาย", feature ? "ค้นหาวัดและเส้นทางมงคล วางแผนการเดินทางได้ง่าย ๆ" : "", true)}${iconPicker(item, path)}</div>${feature ? `<div class="mw-menu-feature-media"><img src="${e(item.image || templeArt)}" alt="ภาพประกอบเมนู"><div>${field(item, path, "image", "ลิงก์ภาพประกอบ")}<label class="mw-admin-btn ${!providerReady || uploading ? "is-disabled" : ""}">${adminIcon("image-plus")}เปลี่ยนภาพ<input type="file" accept="image/jpeg,image/png,image/webp" data-menu-upload="${path}" ${!providerReady || uploading ? "disabled" : ""}></label>${button("trash-2", "ลบภาพประกอบ", `data-menu-clear-image="${path}"`)}</div></div>` : ""}<div class="mw-menu-toggles">${toggle(item, path, "desktop", "แสดงบน Desktop")}${toggle(item, path, "mobile", "แสดงบน Mobile")}${toggle(item, path, "enabled", "เปิดใช้งาน")}</div></section>`;
    }).join("");
  }

  function render() {
    state.content.navigation ||= { tabs: [], utility: [] };
    state.content.navigation.tabs ||= [];
    state.content.navigation.utility ||= [];
    if (!normalizedDocuments.has(state.content.navigation)) {
      tabs().forEach(tab => { tab.items = editableNavigationGroups(tab.items); });
      normalizedDocuments.add(state.content.navigation);
    }
    selected = Math.max(0, Math.min(selected, tabs().length - 1));
    setTitle("เมนูนำทาง (Navigation)", "แผงควบคุม › จัดการเมนู");
    document.querySelector(".mw-admin-main").classList.add("is-menu-editor");
    document.querySelector("#adminDescription").textContent = "จัดการเมนูหลักและเมนูย่อยของเว็บไซต์ กำหนดการแสดงผลและเนื้อหาในแถบเมนู";
    setTopActions(`<button type="button" class="mw-admin-btn" data-menu-preview>${adminIcon("eye")}ดูตัวอย่างเมนู</button><button class="mw-admin-btn" type="button" data-menu-add-tab>${adminIcon("plus")}เพิ่มเมนูหลัก</button>`);
    const tab = tabs()[selected];
    document.querySelector("#adminContent").innerHTML = `<div class="mw-menu-editor ${mobileDetail ? "is-detail" : ""}" data-menu-pane="${pane}"><div class="mw-menu-mobile-heading"><button class="mw-admin-icon-button" type="button" data-menu-back aria-label="กลับรายการเมนู">${adminIcon("arrow-left")}</button><span>เมนูนำทาง › ${e(tab?.label || "")}</span></div><div class="mw-menu-layout"><div class="mw-menu-editor-column">${tabs().map((item, index) => {
      const path = `tabs.${index}`;
      const active = selected === index && !collapsed;
      const count = (item.items || []).reduce((sum, child) => sum + (child.section ? (child.items || []).length : 1), 0);
      return `<section class="mw-menu-tab ${active ? "is-open" : ""}" data-menu-index="${index}"><header><button type="button" class="mw-menu-tab-heading" data-menu-open="${index}" aria-expanded="${active}"><span class="mw-menu-letter">${index + 1}</span><strong>${e(item.label)}</strong>${adminIcon("chevron-down")}</button>${toggle(item, path, "enabled", `เปิดใช้งาน ${item.label}`)}</header><div class="mw-menu-mobile-summary">${adminIcon(item.icon || ["landmark", "calendar-days", "route", "store"][index % 4])}<div><strong>${item.layout === "link" || !item.items?.length ? "เมนูปกติ (ลิงก์เดี่ยว)" : "เมนูแบบกลุ่ม"}</strong><small>เมนูย่อย ${count} รายการ · ลำดับที่ ${index + 1}</small></div></div>${active ? `<div class="mw-menu-tab-body"><div class="mw-menu-mobile-tabs" role="tablist" aria-label="แก้ไขเมนู"><button type="button" role="tab" aria-selected="${pane === "info"}" data-menu-pane-button="info">ข้อมูลเมนู</button><button type="button" role="tab" aria-selected="${pane === "items"}" data-menu-pane-button="items">เมนูย่อย</button><button type="button" role="tab" aria-selected="${pane === "preview"}" data-menu-pane-button="preview">ตัวอย่าง</button></div><section class="mw-menu-basic" data-menu-pane-content="info"><h2>ตั้งค่าเมนูหลัก</h2><div class="mw-menu-two">${field(item, path, "label", "ชื่อเมนูหลัก *")}${field(item, path, "href", "Slug / URL *")}</div><div class="mw-menu-three"><label>รูปแบบเมนู<select data-menu-field="layout" data-menu-path="${path}" aria-label="รูปแบบเมนู"><option value="auto" ${!item.layout || item.layout === "auto" ? "selected" : ""}>อัตโนมัติตามเว็บไซต์</option><option value="mega" ${item.layout === "mega" ? "selected" : ""}>Mega Menu</option><option value="columns" ${item.layout === "columns" ? "selected" : ""}>Mega Menu (จัดกลุ่มสองคอลัมน์)</option><option value="link" ${item.layout === "link" ? "selected" : ""}>เมนูปกติ (ลิงก์เดี่ยว)</option></select></label><label>ลำดับการแสดงผล<select data-menu-order="${index}" aria-label="ลำดับการแสดงผล">${tabs().map((_, i) => `<option value="${i}" ${i === index ? "selected" : ""}>${i + 1}</option>`).join("")}</select></label>${iconPicker(item, path)}</div><div class="mw-menu-toggles">${toggle(item, path, "desktop", "แสดงบน Desktop")}${toggle(item, path, "mobile", "แสดงบน Mobile")}</div><h3>ข้อความที่แสดงบนหน้าเว็บไซต์</h3><div class="mw-menu-two">${field(item, path, "desktopLabel", "ชื่อเมนู (Desktop)", item.label)}${field(item, path, "mobileLabel", "ชื่อเมนู (Mobile)", item.label)}</div></section><section class="mw-menu-items-panel" data-menu-pane-content="items"><div class="mw-menu-subheading"><h2>เนื้อหาเมนู (Mega Menu)</h2>${button("eye", "ดูตัวอย่างเมนูนี้", "data-menu-preview")}</div>${item.layout === "link" ? '<p class="mw-menu-notice">ใช้ลิงก์หลักโดยตรง เมนูย่อยยังเก็บไว้แต่ไม่แสดงบนเว็บไซต์</p>' : ""}${itemGroups(item, index)}<div class="mw-menu-add-row"><button type="button" class="mw-admin-btn" data-menu-add-item="${index}">${adminIcon("plus")}เพิ่มลิงก์</button><button type="button" class="mw-admin-btn" data-menu-add-group="${index}">${adminIcon("plus")}เพิ่มกลุ่ม</button></div></section><div class="mw-menu-delete-tab">${button("trash-2", "ลบเมนูหลักนี้", `data-menu-delete="${path}"`)}</div></div>` : ""}</section>`;
    }).join("") || '<p class="mw-menu-notice">ยังไม่มีเมนูหลัก</p>'}<details class="mw-menu-utilities"><summary>ลิงก์เสริม <span>${state.content.navigation.utility.length} รายการ</span></summary>${state.content.navigation.utility.map((item, i) => itemRow(item, `utility.${i}`, state.content.navigation.utility.length)).join("")}<button class="mw-admin-btn" type="button" data-menu-add-utility>${adminIcon("plus")}เพิ่มลิงก์เสริม</button></details></div><aside class="mw-menu-preview"><h2>ตัวอย่างเมนูบนเว็บไซต์</h2><p>ตัวอย่างจากฉบับร่าง ยังไม่เผยแพร่</p><div class="mw-menu-preview-tabs" role="tablist" aria-label="ขนาดตัวอย่าง"><button type="button" role="tab" data-menu-preview-mode="desktop" aria-selected="${previewMode === "desktop"}">Desktop (แถบเมนู)</button><button type="button" role="tab" data-menu-preview-mode="mobile" aria-selected="${previewMode === "mobile"}">Mobile (เมนูมือถือ)</button></div><div data-menu-preview-host="desktop" ${previewMode !== "desktop" ? "hidden" : ""}></div><h3>Mobile (เมนูมือถือ)</h3><div data-menu-preview-host="mobile"></div></aside></div><div class="mw-home-mobile-actions"><button type="button" class="mw-admin-btn" data-action="save-draft">${adminIcon("save")}บันทึกฉบับร่าง</button><button type="button" class="mw-admin-btn mw-admin-btn-primary" data-action="publish" ${state.publishing || uploading ? "disabled" : ""}>${adminIcon("upload")}เผยแพร่</button></div><p class="mw-admin-sr-only" data-menu-announcement role="status"></p></div>`;
    document.querySelector("#adminContent").addEventListener("dragstart", dragStart);
    document.querySelector("#adminContent").addEventListener("dragover", dragOver);
    document.querySelector("#adminContent").addEventListener("drop", drop);
    document.querySelector("#adminContent").addEventListener("keydown", tabKeydown);
    if (matchMedia("(max-width: 700px)").matches && !mobileDetail) {
      document.querySelectorAll("[data-menu-open]").forEach(button => button.setAttribute("aria-expanded", "false"));
    }
    document.querySelectorAll('.mw-menu-editor [role="tab"]').forEach(button => {
      button.tabIndex = button.getAttribute("aria-selected") === "true" ? 0 : -1;
    });
    renderPreview();
  }

  function tabKeydown(event) {
    const tab = event.target.closest('.mw-menu-editor [role="tab"]');
    if (!tab || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const peers = [...tab.parentElement.querySelectorAll('[role="tab"]')];
    const index = peers.indexOf(tab);
    const next = event.key === "Home" ? 0 : event.key === "End" ? peers.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + peers.length) % peers.length;
    const attribute = tab.hasAttribute("data-menu-pane-button") ? "data-menu-pane-button" : "data-menu-preview-mode";
    const value = peers[next].getAttribute(attribute);
    event.preventDefault();
    peers[next].click();
    document.querySelector(`[${attribute}="${value}"]`)?.focus();
  }

  function renderPreview() {
    const model = navigationModel(state.content.navigation);
    const options = { location: "/", assets: { temple: templeArt, lotus: lotusArt } };
    document.querySelectorAll("[data-menu-preview-host]").forEach(host => {
      const mobile = host.dataset.menuPreviewHost === "mobile";
      const shadow = host.shadowRoot || host.attachShadow({ mode: "open" });
      const html = mobile ? renderMobileNavigation(model, options) : renderDesktopNavigation(model, options);
      shadow.innerHTML = `<link rel="stylesheet" href="${headerStyles}"><style>:host{display:block;font-family:'Noto Sans Thai',sans-serif;font-size:14px;color:#1e2b25}*{box-sizing:border-box}a{text-decoration:none}button{font:inherit} .ui-icon-mask{display:inline-block;background:currentColor;mask-position:center;mask-repeat:no-repeat;mask-size:contain} .mw-header{position:static;box-shadow:none;border:0;--font-thai:'Noto Sans Thai',sans-serif;--mw-temple-art:url('${templeArt}')} .preview-nav{display:flex;flex-wrap:wrap;gap:0 12px;padding:8px;background:#fffdf6}.mw-nav-item{position:static}.mw-top-link{font-size:12px}.mw-disclosure>summary{min-height:38px}.mw-panel{position:static;width:100%;max-width:none;max-height:none;margin-top:8px;padding:16px;border-radius:7px;box-shadow:none}.mw-disclosure[open]{display:contents}.mw-nav-item:has(.mw-disclosure[open]){display:contents}.mw-panel--tools{gap:10px;grid-template-columns:1fr 1fr}.mw-header h3,.mw-directory-link .mw-link-copy{font-size:14px}.mw-feature-link .mw-link-copy>span{font-size:18px}.mw-link-copy small,.mw-group-heading p,.mw-child-link{font-size:12px}.mw-collection-links{grid-template-columns:1fr}.mw-feature-image{position:absolute;right:0;top:0;width:70px;height:70px;object-fit:contain;opacity:.3}.mobile-frame{padding:12px;background:#fffefa;border:1px solid #e9e0d3;border-radius:8px}.mobile-heading{padding:0 8px 14px;border-bottom:1px solid #e9e0d3;display:flex;justify-content:space-between}.mw-mobile-row,.mw-mobile-group>summary{font-size:13px}.mw-mobile-children{margin-left:16px}.mw-icon{width:22px;height:22px}.preview-background{background:url('/assets/images/home-hero-golden-sanctuary.webp') center/cover;padding:12px;border-radius:8px}.mw-mobile-temples{padding-top:10px}</style><div class="${mobile ? "mobile-frame" : "preview-background"}"><header class="mw-header" data-header-mode="${mobile ? "compact" : "wide"}">${mobile ? '<div class="mobile-heading"><span>‹ เมนู</span><span aria-hidden="true">×</span></div>' : ""}<nav class="${mobile ? "preview-mobile" : "preview-nav"}" aria-label="ตัวอย่าง${mobile ? "มือถือ" : "เดสก์ท็อป"}">${html}</nav></header></div>`;
      if (!mobile) {
        const compactStyle = document.createElement("style");
        compactStyle.textContent = `.preview-nav{gap:0 5px}.mw-nav-item,.mw-disclosure{display:contents}.mw-top-link{font-size:11px;min-height:34px}.mw-disclosure>summary{min-height:34px;width:14px}.mw-panel{order:2;flex:0 0 100%;padding:12px;margin-top:4px}.mw-panel--temples .mw-collection-links{grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}.mw-collection-links .mw-child-link{font-size:11px;padding:8px 0;gap:3px}.mw-feature-link{min-height:52px}.mw-panel-feature{padding-bottom:12px}.mw-temple-group{padding-block:12px}.mw-directory-link{padding-block:12px}.mw-icon{color:#a57526}`;
        shadow.append(compactStyle);
        const disclosure = shadow.querySelector(`[data-nav-item-id="${CSS.escape(tabs()[selected]?.id || "")}"] details`);
        if (disclosure) {
          disclosure.setAttribute("open", "");
          const panel = disclosure.querySelector(".mw-panel");
          if (panel) shadow.querySelector(".preview-nav").append(panel);
        }
      }
      shadow.addEventListener("click", previewClick);
    });
  }
  function previewClick(event) {
    const summary = event.target.closest(".mw-disclosure > summary");
    if (summary) {
      event.preventDefault();
      selected = tabs().findIndex(item => item.id === summary.closest("[data-nav-item-id]").dataset.navItemId);
      collapsed = false;
      render();
      return;
    }
    const link = event.target.closest("a");
    if (link) { event.preventDefault(); setStatus(`ลิงก์ตัวอย่าง: ${link.getAttribute("href")}`, "info"); }
  }
  function move(path, to) {
    const list = parentAt(path), from = Number(path.split(".").at(-1));
    if (to < 0 || to >= list.length || from === to) return;
    const [item] = list.splice(from, 1); list.splice(to, 0, item);
    if (path.startsWith("tabs.") && path.split(".").length === 2) selected = to;
    markDirty(); render();
    document.querySelector("[data-menu-announcement]").textContent = `ย้าย ${item.label} เป็นลำดับที่ ${to + 1}`;
  }
  function newLink() { return { id: `menu-${crypto.randomUUID()}`, label: "เมนูใหม่", href: "/", enabled: true }; }
  function click(event) {
    const target = event.target;
    const open = target.closest("[data-menu-open]");
    if (open) {
      const next = Number(open.dataset.menuOpen);
      collapsed = !matchMedia("(max-width: 700px)").matches && next === selected && !collapsed;
      selected = next; mobileDetail = true; pane = "info"; render(); return true;
    }
    if (target.closest("[data-menu-back]")) { mobileDetail = false; render(); return true; }
    const paneButton = target.closest("[data-menu-pane-button]");
    if (paneButton) { pane = paneButton.dataset.menuPaneButton; render(); return true; }
    const mode = target.closest("[data-menu-preview-mode]");
    if (mode) { previewMode = mode.dataset.menuPreviewMode; render(); return true; }
    if (target.closest("[data-menu-preview]")) { pane = "preview"; mobileDetail = true; collapsed = false; render(); document.querySelector(".mw-menu-preview")?.scrollIntoView({ block: "start", behavior: "smooth" }); return true; }
    if (target.closest("[data-menu-add-tab]")) { tabs().push({ ...newLink(), items: [] }); selected = tabs().length - 1; mobileDetail = true; collapsed = false; markDirty(); render(); return true; }
    if (target.closest("[data-menu-add-utility]")) { state.content.navigation.utility.push(newLink()); markDirty(); render(); document.querySelector(".mw-menu-utilities").open = true; return true; }
    const add = target.closest("[data-menu-add-item], [data-menu-add-group], [data-menu-add-child]");
    if (add) {
      if (add.hasAttribute("data-menu-add-child")) {
        const parent = nodeAt(add.dataset.menuAddChild);
        parent.items ||= []; parent.items.push(newLink());
      } else {
        const index = Number(add.dataset.menuAddItem ?? add.dataset.menuAddGroup);
        tabs()[index].items ||= [];
        tabs()[index].items.push(add.hasAttribute("data-menu-add-group") ? { ...newLink(), label: "กลุ่มใหม่", href: "", section: true, items: [newLink()] } : newLink());
      }
      markDirty(); render(); return true;
    }
    const remove = target.closest("[data-menu-delete]");
    if (remove) { const path = remove.dataset.menuDelete; const item = nodeAt(path); if (confirm(`ลบ “${item.label}” จากฉบับร่าง?${item.section || item.items?.length ? " เมนูย่อยในกลุ่มนี้จะถูกลบด้วย" : ""}`)) { const list = parentAt(path); const index = Number(path.split(".").at(-1)); list.splice(index, 1); markDirty(); render(); } return true; }
    const moveButton = target.closest("[data-menu-move]");
    if (moveButton) { const path = moveButton.dataset.menuPath; move(path, Number(path.split(".").at(-1)) + Number(moveButton.dataset.menuMove)); return true; }
    const clear = target.closest("[data-menu-clear-image]");
    if (clear) { nodeAt(clear.dataset.menuClearImage).image = ""; markDirty(); render(); return true; }
    return false;
  }
  function input(event) {
    const target = event.target;
    if (target.matches("[data-menu-field]")) {
      const item = nodeAt(target.dataset.menuPath);
      item[target.dataset.menuField] = target.type === "checkbox" ? target.checked : target.value;
      markDirty(); renderPreview();
      if (target.dataset.menuField === "layout" && event.type === "change") render();
      return true;
    }
    if (target.matches("[data-menu-order]")) { if (event.type === "change") move(`tabs.${target.dataset.menuOrder}`, Number(target.value)); return true; }
    if (target.matches("[data-menu-upload]")) { if (event.type === "change") upload(target); return true; }
    return false;
  }
  async function upload(target) {
    const file = target.files?.[0];
    if (!file || uploading) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) { setStatus("ใช้รูป JPG, PNG หรือ WEBP ไม่เกิน 10 MB", "error"); return; }
    const item = nodeAt(target.dataset.menuUpload);
    uploading = true; render();
    document.querySelectorAll('[data-action="publish"]').forEach(button => { button.disabled = true; });
    try { item.image = await uploadMedia(file, file.name); markDirty(); }
    catch (error) { setStatus(error.message || "อัปโหลดไม่สำเร็จ", "error"); }
    finally { uploading = false; if (state.section === "navigation") render(); document.querySelectorAll('[data-action="publish"]').forEach(button => { button.disabled = !!state.publishing; }); }
  }
  function dragStart(event) { const handle = event.target.closest("[data-menu-drag]"); if (handle) { drag = handle.dataset.menuDrag; event.dataTransfer.setData("text/plain", drag); event.dataTransfer.effectAllowed = "move"; } }
  function dragOver(event) { const node = event.target.closest("[data-menu-record]"); if (drag && node && parentAt(drag) === parentAt(node.dataset.menuRecord)) event.preventDefault(); }
  function drop(event) { const node = event.target.closest("[data-menu-record]"); if (drag && node && parentAt(drag) === parentAt(node.dataset.menuRecord)) { event.preventDefault(); move(drag, Number(node.dataset.menuRecord.split(".").at(-1))); } drag = null; }
  return { render, input, click };
}
