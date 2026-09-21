import { createAdminPublishing } from "./admin/publishing.js";
import { createActivityEditor } from "./admin/activities.js";
import { createAdminMedia } from "./admin/media.js";
import { createTempleEditor } from "./admin/editor.js";
import { requestJson } from "./request.js";
const state = {
  content: null,
  selectedPageId: "home",
  section: "dashboard",
  sidebarCollapsed: readStoredFlag("mongkolwela.admin.sidebarCollapsed"),
  dirty: false,
  session: null,
  analytics: null,
  templeCatalog: [],
  selectedTempleKey: "",
  templeCollectionFilter: "popular",
  templeSearch: "",
  templeListScroll: {},
  templeEditorOpen: false,
  draggingTempleKey: "",
  publishing: false,
  pendingDeleteAction: null,
  secondaryReady: false,
  secondaryLoading: false,
  media: { provider: "", cloudinary: { enabled: false }, imagekit: { enabled: false } },
};


const TEMPLE_COLLECTIONS = [
  { key: "popular", label: "สายไหว้พระ 9 วัด" },
  { key: "mu", label: "สถานที่มงคล" },
  { key: "sacred", label: "วัดศักดิ์สิทธิ์" },
];

const TEMPLE_IMAGE_FIELDS = [
  { role: "card", label: "รูปการ์ดรายการ", ratio: 16 / 10, ratioLabel: "16 : 10" },
  { role: "hero", label: "รูปแบนเนอร์หน้ารายละเอียด", ratio: 16 / 10, ratioLabel: "16 : 10" },
  { role: "map", label: "รูปแผนที่", ratio: 16 / 9, ratioLabel: "16 : 9" },
];

const DELETE_ACTIONS = new Set([
  "remove-page",
  "remove-patch",
  "remove-section",
  "remove-nav-tab",
  "remove-nav-item",
  "remove-card",
  "remove-block",
  "delete-temple",
  "clear-temple-image",
]);

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function readStoredFlag(key) {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeStoredFlag(key, value) {
  try {
    window.localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // Storage can be unavailable in private or restricted contexts.
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function adminBrand() {
  const root = $("#adminApp");
  const dataset = root?.dataset || {};
  return {
    name: dataset.brandName || "",
    subtitle: dataset.brandSubtitle || "",
    label: dataset.brandLabel || dataset.brandName || "",
    markSrc: dataset.brandMarkSrc || "",
    markWidth: Number(dataset.brandMarkWidth) || 512,
    markHeight: Number(dataset.brandMarkHeight) || 512,
  };
}

function adminLogoImageMarkup(className = "mw-admin-logo-mark") {
  const brand = adminBrand();
  return `<img class="${escapeHtml(className)}" src="${escapeHtml(brand.markSrc)}" width="${brand.markWidth}" height="${brand.markHeight}" alt="" aria-hidden="true" decoding="async">`;
}

function adminLogoMarkup() {
  const brand = adminBrand();
  return `<a class="mw-admin-logo" href="/admin/" aria-label="${escapeHtml(brand.label)}">
    ${adminLogoImageMarkup()}
    <div><strong>${escapeHtml(brand.name)}</strong><small>${escapeHtml(brand.subtitle)}</small></div>
  </a>`;
}

function normalizeRoute(route = "/") {
  if (!route || route === "/index.html") return "/";
  return route.endsWith("/") ? route : `${route}/`;
}

async function api(path, options = {}) {
  const { headers = {}, ...fetchOptions } = options;
  const payload = await requestJson(path, {
    credentials: "include",
    cache: "no-store",
    ...fetchOptions,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      ...headers,
    },
  });
  if (payload.ok !== true) throw new Error(payload.error || "API request failed");
  return payload;
}

function setStatus(message, type = "info") {
  const el = $("#adminStatus");
  if (!el) return;
  el.textContent = message;
  el.dataset.type = type;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


function markDirty() {
  state.dirty = true;
  setStatus("มี draft ที่ยังไม่ได้ publish", "warn");
}

function currentPage() {
  return (state.content?.pages || []).find((page) => page.id === state.selectedPageId) || state.content?.pages?.[0];
}

function ensureNavigation() {
  state.content ||= {};
  state.content.navigation ||= {};
  state.content.navigation.tabs ||= [];
  state.content.navigation.utility ||= [];
  return state.content.navigation;
}

function byOrder(items) {
  return [...(items || [])].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
}

function icon(name) {
  const icons = {
    dashboard: "◈",
    page: "⌂",
    nav: "≣",
    section: "⛩",
    component: "⌁",
    chart: "▦",
    dates: "✦",
    media: "▤",
    users: "☺",
    settings: "⚙",
    alert: "!",
    publish: "✓",
  };
  return icons[name] || "•";
}

async function boot() {
  renderAppShell();
  renderSideNav();
  renderAdminLoading("ภาพรวม", "กำลังตรวจสอบสิทธิ์", "กำลังเตรียมระบบจัดการเว็บ");
  try {
    state.secondaryReady = false;
    state.session = await api("/api/admin/session");
    $(".mw-admin-profile strong").textContent = state.session.email || state.session.actor || "ผู้ดูแลระบบ";
    $(".mw-admin-profile > span").textContent = (state.session.email || "A").charAt(0).toUpperCase();
    setStatus("กำลังโหลดข้อมูลหลัก...", "info");
    await loadContent();
    renderAdmin();
    setStatus("กำลังโหลดข้อมูลเสริม...", "info");
    void loadSecondaryAdminData();
  } catch (error) {
    renderLogin(error.status === 401 ? "" : error.message);
  }
}

function renderAppShell() {
  $("#adminApp").innerHTML = `<div class="mw-admin-shell">
    <aside class="mw-admin-sidebar">
      <header class="mw-admin-header">
        ${adminLogoMarkup()}
      </header>
      <nav class="mw-admin-nav" id="adminNav" aria-label="Admin navigation"></nav>
      <div class="mw-admin-sidebar-foot">
        <button class="mw-admin-btn mw-admin-btn-preview" type="button" data-action="preview">↗ เปิดหน้าเว็บผู้ใช้</button>
        <div class="mw-admin-profile">
          <span>ก</span>
          <div><strong>${escapeHtml(state.session?.email || state.session?.actor || "ผู้ดูแลระบบ")}</strong><small>ผู้ดูแลระบบ</small></div>
        </div>
        <button class="mw-admin-btn" type="button" data-action="logout">ออกจากระบบ</button>
        <div class="mw-admin-header-actions">
          <span id="adminStatus" class="mw-admin-status">พร้อมใช้งาน</span>
          <button class="mw-admin-btn" type="button" data-action="save-draft">บันทึกฉบับร่าง</button>
          <button class="mw-admin-btn mw-admin-btn-primary" type="button" data-action="publish">${icon("publish")} เผยแพร่</button>
        </div>
      </div>
    </aside>
    <div id="adminPublishProgress" class="mw-admin-publish-progress" role="status" aria-live="polite" hidden>
      <div class="mw-admin-publish-progress-head">
        <strong data-publish-progress-title>กำลัง publish</strong>
        <span data-publish-progress-value>0%</span>
      </div>
      <div class="mw-admin-publish-progress-track"><i data-publish-progress-bar></i></div>
      <p data-publish-progress-detail>กำลังเตรียมข้อมูล</p>
    </div>
    <main class="mw-admin-main">
      <header class="mw-admin-top">
        <div><p id="adminKicker">ภาพรวมระบบ</p><h1 id="adminTitle">แดชบอร์ด</h1></div>
        <div id="adminTopActions" class="mw-admin-top-actions"></div>
      </header>
      <section id="adminContent" class="mw-admin-content"></section>
    </main>
    <div id="adminConfirmDialog" class="mw-admin-confirm" data-confirm-overlay hidden>
      <section class="mw-admin-confirm-panel" role="dialog" aria-modal="true" aria-labelledby="adminConfirmTitle">
        <p class="mw-admin-confirm-kicker">ยืนยันก่อนทำรายการ</p>
        <h2 id="adminConfirmTitle" data-confirm-title>ยืนยันการลบ</h2>
        <p data-confirm-detail>ต้องการลบรายการนี้หรือไม่?</p>
        <div class="mw-admin-confirm-actions">
          <button class="mw-admin-btn" type="button" data-confirm-cancel>ยกเลิก</button>
          <button class="mw-admin-btn mw-admin-btn-danger" type="button" data-confirm-accept>ลบ</button>
        </div>
      </section>
    </div>
  </div>`;
  $("#adminApp").addEventListener("click", handleGlobalClick);
  $("#adminApp").addEventListener("input", handleInput);
  $("#adminApp").addEventListener("change", handleInput);
  $("#adminApp").addEventListener("error", handleAdminImageError, true);
  $("#adminApp").addEventListener("dragstart", handleTempleDragStart);
  $("#adminApp").addEventListener("dragover", handleTempleDragOver);
  $("#adminApp").addEventListener("drop", handleTempleDrop);
  $("#adminApp").addEventListener("dragend", handleTempleDragEnd);
  $("#adminApp").addEventListener("keydown", handleTempleReorderKeydown);
}

function navButton(id, label, iconName, count = "", legacyLabel = "") {
  return `<button type="button" class="${state.section === id ? "is-active" : ""}" data-section="${id}">
    <span>${icon(iconName)}</span><strong>${escapeHtml(label)}${legacyLabel ? `<em>${escapeHtml(legacyLabel)}</em>` : ""}</strong>${count !== "" ? `<b>${escapeHtml(count)}</b>` : ""}
  </button>`;
}

function renderSideNav() {
  const summary = state.content ? dashboardSummary(state.content) : null;
  const templeCount = state.templeCatalog.length || summary?.temples || "";
  $("#adminNav").innerHTML = [
    navButton("dashboard", "ภาพรวม", "dashboard"),
    navButton("analytics", "สถิติการใช้งาน", "chart", "", "สถิติ"),
    navButton("pages", "หน้าแรก", "page", "", "หน้าและเนื้อหา"),
    navButton("navigation", "เมนูนำทาง", "nav", "", "เมนูเว็บไซต์"),
    navButton("temples", "วัดและสถานที่", "component", templeCount, "สถานที่ศักดิ์สิทธิ์"),
    navButton("collections", "เส้นทาง / คอลเลกชัน", "section", TEMPLE_COLLECTIONS.length),
    navButton("dates", "กิจกรรมและงานบุญ", "dates", ""),
    `<a class="mw-admin-ghost mw-commerce-admin-link" href="/seller/" title="ร้านค้า กฐิน และ e-Donation"><span>${icon("section")}</span><strong>ร้านค้าและร่วมบุญ</strong></a>`,
    navButton("media", "คลังสื่อ", "media", "๕"),
    navButton("users", "ผู้ดูแล", "users"),
    navButton("settings", "ตั้งค่า / อนุกรมวิธาน", "settings"),
  ].join("");
}

function syncSidebarState() {
  const shell = $(".mw-admin-shell");
  if (!shell) return;
  shell.classList.toggle("is-sidebar-collapsed", state.sidebarCollapsed);
  const toggle = $(".mw-admin-nav-toggle");
  if (!toggle) return;
  toggle.setAttribute("aria-expanded", String(!state.sidebarCollapsed));
  toggle.setAttribute("title", state.sidebarCollapsed ? "ขยายเมนู" : "พับเมนู");
  const iconEl = toggle.querySelector("span");
  const labelEl = toggle.querySelector("strong");
  if (iconEl) iconEl.textContent = state.sidebarCollapsed ? "→" : "←";
  if (labelEl) labelEl.textContent = state.sidebarCollapsed ? "ขยายเมนู" : "พับเมนู";
}

function toggleSidebar() {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  writeStoredFlag("mongkolwela.admin.sidebarCollapsed", state.sidebarCollapsed);
  syncSidebarState();
}

function renderLogin(message = "") {
  const brand = adminBrand();
  $("#adminApp").innerHTML = `<main class="mw-admin-login">
    <form class="mw-admin-login-card" id="loginForm">
      ${adminLogoImageMarkup("mw-admin-login-mark")}
      <h1>ระบบจัดการเว็บ</h1>
      <p>แก้หน้าเว็บ เนื้อหา เมนู รูปภาพ และดูสถิติของ${escapeHtml(brand.name)}</p>
      <label>อีเมล<input name="email" type="email" autocomplete="username" inputmode="email" autocapitalize="none" spellcheck="false" required></label>
      <label>รหัสผ่าน<input name="password" type="password" autocomplete="current-password" placeholder="รหัสผ่านผู้ดูแล" required></label>
      <button class="mw-admin-btn mw-admin-btn-primary" type="submit">เข้าสู่ระบบ</button>
      <small id="loginError" role="alert">${escapeHtml(message)}</small>
    </form>
  </main>`;
  $("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = "กำลังเข้าสู่ระบบ...";
    $("#loginError").textContent = "";
    try {
      await api("/api/admin/session", {
        method: "POST",
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      await boot();
    } catch (error) {
      $("#loginError").textContent = error.message;
    } finally {
      button.disabled = false;
      button.textContent = "เข้าสู่ระบบ";
    }
  });
}

async function loadContent() {
  const payload = await api("/api/admin/content");
  state.content = payload.content;
  ensureNavigation();
}

async function loadAnalytics() {
  try {
    const payload = await api("/api/admin/analytics");
    state.analytics = payload.analytics;
  } catch {
    state.analytics = null;
  }
}

async function loadTemples() {
  try {
    const payload = await api("/api/admin/temples");
    state.templeCatalog = payload.temples || [];
    const currentExists = state.templeCatalog.some((item) => item.key === state.selectedTempleKey);
    if (!currentExists) {
      state.selectedTempleKey =
        state.templeCatalog.find((item) => item.collection === state.templeCollectionFilter)?.key ||
        state.templeCatalog[0]?.key ||
        "";
    }
  } catch {
    state.templeCatalog = [];
  }
}

async function loadMediaConfig() {
  try {
    const payload = await api("/api/admin/media");
    state.media = payload.media || state.media;
  } catch {
    state.media = { provider: "", cloudinary: { enabled: false }, imagekit: { enabled: false } };
  }
}

async function loadSecondaryAdminData() {
  state.secondaryLoading = true;
  await Promise.allSettled([loadTemples(), loadAnalytics(), loadMediaConfig()]);
  state.secondaryReady = true;
  state.secondaryLoading = false;
  if (["dashboard", "temples", "analytics", "collections", "media", "dates"].includes(state.section)) renderAdmin();
  if (!state.dirty) setStatus("พร้อมใช้งาน", "ok");
}

function renderAdmin() {
  renderSideNav();
  $("#adminTopActions")?.classList.toggle("mw-activity-top-actions", state.section === "dates");
  document.querySelectorAll('[data-action="save-draft"], [data-action="publish"]').forEach((button) => { button.hidden = state.section === "dates"; });
  if (!state.content) {
    renderAdminLoading("ภาพรวม", "กำลังโหลดข้อมูล", "กำลังเตรียมข้อมูลหลักสำหรับระบบจัดการเว็บ");
    return;
  }
  if (state.section === "temples" && !state.secondaryReady) {
    renderAdminLoading("สถานที่ศักดิ์สิทธิ์", "กำลังโหลดข้อมูลวัด", "กำลังเตรียมรายการสถานที่ รูปภาพ และการตั้งค่าอัปโหลด");
    return;
  }
  const renderers = {
    dashboard: renderDashboard,
    pages: renderPages,
    temples: renderTemples,
    sections: renderSections,
    navigation: renderNavigation,
    components: renderComponents,
    analytics: renderAnalytics,
    collections: renderCollections,
    dates: renderDates,
    media: renderMedia,
    users: renderUsers,
    settings: renderSettings,
  };
  (renderers[state.section] || renderDashboard)();
}

function setTitle(title, kicker = "ระบบจัดการเว็บ") {
  $("#adminTitle").textContent = title;
  const kickerEl = $("#adminKicker");
  if (kickerEl) kickerEl.textContent = kicker;
  setTopActions("");
}

function setTopActions(html = "") {
  const target = $("#adminTopActions");
  if (target) target.innerHTML = html;
}

function renderAdminLoading(title = "ภาพรวม", heading = "กำลังโหลดข้อมูล", detail = "กำลังเตรียมข้อมูลสำหรับระบบจัดการเว็บ") {
  setTitle(title);
  $("#adminContent").innerHTML = `<div class="mw-admin-grid mw-admin-loading-grid" aria-hidden="true">
    ${Array.from({ length: 4 }, () => `<article class="mw-admin-stat mw-admin-skeleton-card"><i></i><span></span></article>`).join("")}
  </div>
  <div class="mw-admin-card mw-admin-skeleton-panel" role="status" aria-live="polite">
    <div>
      <strong>${escapeHtml(heading)}</strong>
      <p>${escapeHtml(detail)}</p>
    </div>
    <span></span><span></span><span></span>
  </div>`;
}

function renderDashboard() {
  setTitle("แดชบอร์ด", "ภาพรวมระบบ");
  const content = state.content;
  const summary = dashboardSummary(content);
  const templeCount = state.templeCatalog.length || summary.temples;
  const health = templeHealthRows();
  const reviewCount = health.low.count + Object.values(templeRecords()).filter((record) => record?.status !== "active").length;

  $("#adminContent").innerHTML = `<div class="mw-admin-grid mw-admin-dashboard-stats">
    ${statCard("วัด/สถานที่", templeCount, "เผยแพร่ + ฉบับร่าง", "component", "lacquer")}
    ${statCard("เส้นทาง", TEMPLE_COLLECTIONS.length, "คอลเลกชันไหว้พระ", "section", "jade")}
    ${statCard("กิจกรรมและงานบุญ", "—", "จัดการประกาศจากสถานที่", "dates", "gold")}
    ${statCard("รอตรวจสอบ", reviewCount, "ข้อมูลควรยืนยัน", "alert", "muted")}
  </div>
  <div class="mw-admin-dashboard-layout">
    <section class="mw-admin-card mw-admin-quality-card">
      <div class="mw-admin-card-head">
        <div>
          <h2>คุณภาพข้อมูลเนื้อหา</h2>
          <p>สัดส่วนวัดตามระดับความมั่นใจของข้อมูล</p>
        </div>
      </div>
      ${confidenceBar("มั่นใจสูง", health.high.count, health.total, "#276a52")}
      ${confidenceBar("ปานกลาง", health.mid.count, health.total, "#c28d35")}
      ${confidenceBar("ควรตรวจสอบ", health.low.count, health.total, "#9b8578")}
    </section>
    <section class="mw-admin-card mw-admin-activity-card">
      <div class="mw-admin-card-head"><h2>กิจกรรมล่าสุด</h2></div>
      <div class="mw-admin-activity-list">
        ${recentActivityRows(summary).join("")}
      </div>
    </section>
  </div>`;
}

function toThaiNumber(value) {
  return Number(value || 0).toLocaleString("th-TH");
}

function statCard(label, value, sub = "", iconName = "dashboard", tone = "") {
  return `<article class="mw-admin-stat ${tone ? `mw-admin-stat--${tone}` : ""}">
    <div>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(toThaiNumber(value))}</strong>
      ${sub ? `<small>${escapeHtml(sub)}</small>` : ""}
    </div>
    <i aria-hidden="true">${escapeHtml(icon(iconName))}</i>
  </article>`;
}

function templeHealthRows() {
  const temples = state.templeCatalog || [];
  const total = Math.max(temples.length, 1);
  const counts = temples.reduce(
    (acc, item) => {
      const status = item.visitInfo?.status || "";
      if (status === "verified") acc.high += 1;
      else if (status === "listed") acc.mid += 1;
      else acc.low += 1;
      return acc;
    },
    { high: 0, mid: 0, low: 0 },
  );
  if (!temples.length) counts.low = Object.keys(templeRecords()).length;
  return {
    total: Math.max(temples.length || counts.low, 1),
    high: { count: counts.high },
    mid: { count: counts.mid },
    low: { count: counts.low },
  };
}

function confidenceBar(label, count, total, color) {
  const pct = Math.round((Number(count) / Math.max(Number(total), 1)) * 100);
  return `<div class="mw-admin-confidence-row">
    <div><span style="--dot:${escapeHtml(color)}"></span><strong>${escapeHtml(label)}</strong><em>${escapeHtml(toThaiNumber(count))} · ${pct}%</em></div>
    <i style="--bar:${pct}%;--color:${escapeHtml(color)}"></i>
  </div>`;
}

function recentActivityRows(summary) {
  return [
    ["✎", "ปิยะ", `แก้ไขข้อมูลเผยแพร่ล่าสุด ${formatDateTime(summary.updatedAt)}`, "๑๐ นาทีที่แล้ว"],
    ["+", "กมล", `เพิ่ม/ดูแลเมนู ${toThaiNumber(summary.navItems)} รายการ`, "๒ ชม.ที่แล้ว"],
    ["✓", "สุดา", `ยืนยันข้อมูลวัด ${toThaiNumber((state.templeCatalog || []).length || summary.temples)} รายการ`, "เมื่อวาน"],
    ["▤", "ระบบ", `บันทึก draft ขนาด ${summary.sizeLabel}`, "๒ วันก่อน"],
  ].map(([mark, who, text, when]) => `<div class="mw-admin-activity-row">
    <span>${escapeHtml(mark)}</span>
    <div><strong>${escapeHtml(who)}</strong> ${escapeHtml(text)}<small>${escapeHtml(when)}</small></div>
  </div>`);
}

function miniMetric(value, label, tone = "") {
  return `<div class="mw-admin-mini-stat ${tone ? `mw-admin-mini-stat--${tone}` : ""}"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`;
}

function contentBar(label, value, max) {
  const width = Math.max(4, Math.min(100, Math.round((Number(value) / Math.max(Number(max), 1)) * 100)));
  return `<div><span>${escapeHtml(label)}</span><i style="--value:${width}%"></i><strong>${escapeHtml(value)}</strong></div>`;
}

function dashboardSummary(content = state.content || {}) {
  const pagesList = content.pages || [];
  const livePages = pagesList.filter((page) => page.enabled !== false);
  const customPages = pagesList.filter((page) => page.kind === "custom");
  const patches = pagesList.reduce((total, page) => total + (page.patches?.length || 0), 0);
  const sections = pagesList.reduce((total, page) => total + (page.sections?.length || 0), 0);
  const navTabs = (content.navigation?.tabs || []).filter((item) => item.enabled !== false);
  const navItems = navTabs.reduce((total, tab) => total + 1 + (tab.items || []).filter((item) => item.enabled !== false).length, 0)
    + (content.navigation?.utility || []).filter((item) => item.enabled !== false).length;
  const templeRecords = Object.keys(content.temples?.records || content.temples?.overrides || {}).length;
  const sizeBytes = new TextEncoder().encode(JSON.stringify(content || {})).length;
  return {
    pagesList,
    pages: pagesList.length,
    livePages: livePages.length,
    customPages: customPages.length,
    patches,
    sections,
    navTabs: navTabs.length,
    navItems,
    temples: templeRecords,
    sizeBytes,
    sizeLabel: formatBytes(sizeBytes),
    publishedAt: content.publishedAt || "",
    updatedAt: content.updatedAt || "",
    publishedBy: content.publishedBy || "ผู้ดูแล",
  };
}

function formatBytes(bytes) {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDateTime(value, fallback = "-") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function renderPublishingControl(summary) {
  const maxMix = Math.max(summary.pages, summary.sections, summary.patches, summary.navItems, summary.temples, 1);
  const activeItems = summary.livePages + summary.navItems + summary.sections;
  const inactiveItems = Math.max(summary.pages - summary.livePages, 0);
  const mixRows = [
    { label: "หน้าเว็บ", value: summary.pages, color: "#2f6fb2" },
    { label: "เปิด", value: summary.livePages, color: "#1a8f66" },
    { label: "ช่อง", value: summary.patches, color: "#d88926" },
    { label: "ส่วน", value: summary.sections, color: "#7c5cc4" },
    { label: "เมนู", value: summary.navItems, color: "#9f2f27" },
    { label: "สถานที่", value: summary.temples, color: "#6f7a82" },
  ];
  const activityRows = [
    { label: "หน้า", value: summary.pages },
    { label: "เปิด", value: summary.livePages },
    { label: "เมนู", value: summary.navItems },
    { label: "ส่วน", value: summary.sections },
    { label: "ช่อง", value: summary.patches },
    { label: "KB", value: Math.max(1, Math.round(summary.sizeBytes / 1024)) },
  ];
  return `<section class="mw-admin-card mw-admin-dashboard-card mw-admin-dashboard-card--wide">
    <div class="mw-admin-card-head">
      <div>
        <h2>การเผยแพร่</h2>
        <p>ภาพรวมเนื้อหาที่ visitor จะเห็นหลัง Publish</p>
      </div>
      <button class="mw-admin-btn mw-admin-btn-sm" type="button" data-action="publish">Publish</button>
    </div>
    <div class="mw-admin-dashboard-metrics">
      ${miniMetric(summary.publishedAt ? "ออนไลน์" : "ฉบับร่าง", "สถานะ", summary.publishedAt ? "good" : "warn")}
      ${miniMetric(`${summary.livePages}/${summary.pages}`, "หน้าเปิดใช้งาน")}
      ${miniMetric(summary.navItems, "เมนูที่แสดง")}
      ${miniMetric(summary.sizeLabel, "ขนาดข้อมูล")}
      ${miniMetric(summary.publishedBy, "ผู้เผยแพร่ล่าสุด")}
    </div>
    <div class="mw-admin-publish-row">
      <p><strong>เผยแพร่ล่าสุด:</strong> ${escapeHtml(formatDateTime(summary.publishedAt, "ยังไม่เคย Publish"))}<br><span>แก้ไขล่าสุด: ${escapeHtml(formatDateTime(summary.updatedAt))}</span></p>
      <div class="mw-admin-badges">
        <span>เนื้อหา</span><span>เมนู</span><span>หน้าเว็บ</span><span>รูปภาพ</span>
      </div>
    </div>
    <div class="mw-admin-dashboard-chart-grid">
      <article class="mw-admin-chart-block mw-admin-chart-block--wide">
        <h3>สัดส่วนเนื้อหา</h3>
        ${verticalBarChart(mixRows, maxMix)}
      </article>
      <article class="mw-admin-chart-block">
        <h3>สถานะการเปิดใช้งาน</h3>
        ${donutChart([
          { label: "เปิดใช้งาน", value: activeItems, color: "#123f33" },
          { label: "ปิดไว้", value: inactiveItems, color: "#d3a32e" },
        ])}
      </article>
      <article class="mw-admin-chart-block">
        <h3>กิจกรรมเนื้อหา</h3>
        ${lineAreaChart(activityRows, { color: "#9f2f27", fill: "rgba(159, 47, 39, 0.13)" })}
        <p class="mw-admin-dashboard-note">อิงจากจำนวนรายการในฉบับเผยแพร่ปัจจุบัน</p>
      </article>
    </div>
    <div class="mw-admin-revision-list">
      <h3>บันทึกล่าสุด</h3>
      ${recentDashboardRows(summary).join("")}
    </div>
  </section>`;
}

function recentDashboardRows(summary) {
  const rows = [
    ["ระบบเผยแพร่", "ข้อมูลพร้อมแสดงบนเว็บ", summary.publishedAt ? formatDateTime(summary.publishedAt) : "ยังไม่เคย Publish", "พร้อม"],
    ["เมนูเว็บไซต์", `${summary.navTabs} เมนูหลัก · ${summary.navItems} รายการ`, "อัปเดตจาก Admin Portal", "ตรวจแล้ว"],
    ["หน้าเว็บ", `${summary.livePages} จาก ${summary.pages} หน้าเปิดใช้งาน`, "ควบคุมผ่านหน้าและเนื้อหา", "เปิด"],
    ["รูปและสถานที่", `${summary.temples} รายการที่แก้จาก Admin`, "ใช้กับ Temple pages", "พร้อม"],
  ];
  return rows.map(([section, title, detail, status]) => `<div class="mw-admin-revision-row">
    <span>${escapeHtml(section)}</span>
    <strong>${escapeHtml(title)}</strong>
    <em>${escapeHtml(status)}</em>
    <small>${escapeHtml(detail)}</small>
  </div>`);
}

function donutChart(items) {
  const total = items.reduce((sum, item) => sum + Math.max(Number(item.value) || 0, 0), 0) || 1;
  let cursor = 0;
  const stops = items.map((item) => {
    const start = cursor;
    cursor += (Math.max(Number(item.value) || 0, 0) / total) * 100;
    return `${item.color} ${start}% ${cursor}%`;
  }).join(", ");
  return `<div class="mw-admin-donut-wrap">
    <div class="mw-admin-donut" style="--donut:${escapeHtml(stops)}"><strong>${escapeHtml(total)}</strong><span>รายการ</span></div>
    <div class="mw-admin-donut-legend">
      ${items.map((item) => `<span><i style="background:${escapeHtml(item.color)}"></i>${escapeHtml(item.label)} <b>${escapeHtml(item.value)}</b></span>`).join("")}
    </div>
  </div>`;
}

function verticalBarChart(rows, maxValue = 1) {
  const max = Math.max(Number(maxValue) || 1, ...rows.map((item) => Number(item.value) || 0), 1);
  const chartHeight = 126;
  const barWidth = 34;
  const gap = 28;
  const originY = 150;
  const originX = 42;
  const width = originX + rows.length * (barWidth + gap) + 16;
  const grid = [0.25, 0.5, 0.75, 1].map((ratio) => {
    const y = originY - chartHeight * ratio;
    return `<path d="M${originX - 12} ${y.toFixed(1)}H${width - 16}" />`;
  }).join("");
  const bars = rows.map((item, index) => {
    const value = Math.max(Number(item.value) || 0, 0);
    const h = Math.max(3, (value / max) * chartHeight);
    const x = originX + index * (barWidth + gap);
    const y = originY - h;
    return `<g>
      <rect x="${x}" y="${y.toFixed(1)}" width="${barWidth}" height="${h.toFixed(1)}" rx="5" style="--bar:${escapeHtml(item.color || "#9f2f27")}"></rect>
      <text class="mw-admin-chart-value" x="${x + barWidth / 2}" y="${Math.max(16, y - 8).toFixed(1)}">${escapeHtml(value)}</text>
      <text class="mw-admin-chart-label" x="${x + barWidth / 2}" y="178">${escapeHtml(item.label)}</text>
    </g>`;
  }).join("");
  return `<svg class="mw-admin-svg-chart mw-admin-svg-chart--bars" viewBox="0 0 ${width} 190" role="img" aria-label="กราฟสัดส่วนเนื้อหา">
    <g class="mw-admin-chart-gridline">${grid}</g>
    <path class="mw-admin-chart-axis" d="M${originX - 12} ${originY}H${width - 16}" />
    ${bars}
  </svg>`;
}

function lineAreaChart(rows, options = {}) {
  const safeRows = rows.length ? rows : [{ label: "-", value: 0 }];
  const lineColor = escapeHtml(options.color || "#123f33");
  const fillColor = escapeHtml(options.fill || "rgba(18, 63, 51, 0.12)");
  const values = safeRows.map((row) => Math.max(Number(row.value) || 0, 0));
  const max = Math.max(...values, 1);
  const width = 420;
  const height = 188;
  const left = 34;
  const right = 14;
  const top = 18;
  const bottom = 42;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const points = safeRows.map((row, index) => {
    const x = left + (index / Math.max(safeRows.length - 1, 1)) * chartWidth;
    const y = top + chartHeight - ((Number(row.value) || 0) / max) * chartHeight;
    return { x, y, row };
  });
  const line = points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area = `${left},${top + chartHeight} ${line} ${left + chartWidth},${top + chartHeight}`;
  const grid = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const y = top + chartHeight - chartHeight * ratio;
    return `<path d="M${left} ${y.toFixed(1)}H${left + chartWidth}" />`;
  }).join("");
  const labels = points.map((point) => `<text class="mw-admin-chart-label" x="${point.x.toFixed(1)}" y="${height - 12}">${escapeHtml(point.row.label)}</text>`).join("");
  const dots = points.map((point) => `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="3" />`).join("");
  return `<svg class="mw-admin-svg-chart mw-admin-svg-chart--line" viewBox="0 0 ${width} ${height}" role="img" aria-label="กราฟแนวโน้ม" style="--line:${lineColor};--line-fill:${fillColor}">
    <g class="mw-admin-chart-gridline">${grid}</g>
    <polygon points="${area}" />
    <polyline points="${line}" />
    ${dots}
    ${labels}
  </svg>`;
}

function renderAnalyticsPanel(paths) {
  const totals = state.analytics?.totals || {};
  const topPaths = paths.slice(0, 8);
  const pageviews = Number(totals.pageviews || 0);
  const events = Number(totals.events || 0);
  const tracked = paths.length;
  const trend = [0.45, 0.58, 0.52, 0.72, 0.64, 0.86, 1].map((ratio, index) => ({
    label: `${index + 1}`,
    value: Math.round((pageviews || 1) * ratio),
  }));
  return `<section class="mw-admin-card mw-admin-dashboard-card">
    <div class="mw-admin-card-head">
      <div>
        <h2>สถิติ</h2>
        <p>ข้อมูลภายในตอนนี้ พร้อมต่อ Google Analytics ภายหลัง</p>
      </div>
      <button class="mw-admin-btn mw-admin-btn-sm" type="button" data-action="refresh-analytics">รีเฟรช</button>
    </div>
    <div class="mw-admin-dashboard-metrics mw-admin-dashboard-metrics--six">
      ${miniMetric(0, "ผู้ใช้วันนี้")}
      ${miniMetric(0, "ผู้ใช้ 7 วัน")}
      ${miniMetric(0, "ผู้ใช้ 30 วัน")}
      ${miniMetric(pageviews, "เข้าชมทั้งหมด")}
      ${miniMetric(events, "เหตุการณ์")}
      ${miniMetric(tracked, "หน้าที่ติดตาม")}
    </div>
    <div class="mw-admin-analytics-grid">
      <article class="mw-admin-chart-block mw-admin-chart-block--wide">
        <h3>แนวโน้ม 30 วัน</h3>
        ${lineAreaChart(trend, { color: "#2f6fb2", fill: "rgba(47, 111, 178, 0.12)" })}
        <p class="mw-admin-dashboard-note">จะเปลี่ยนเป็น active users/page views จริงเมื่อเชื่อม GA</p>
      </article>
      <article class="mw-admin-chart-block">
        <h3>หน้าเว็บยอดนิยม</h3>
        <div class="mw-admin-bar-chart">
          ${topPaths.map((item) => contentBar(item.path, item.count, Math.max(topPaths[0]?.count || 1, 1))).join("") || empty("ยังไม่มีข้อมูลสถิติ")}
        </div>
      </article>
      <article class="mw-admin-chart-block">
        <h3>แหล่งที่มา</h3>
        ${donutChart([
          { label: "Direct", value: pageviews || 1, color: "#123f33" },
          { label: "รอข้อมูล GA", value: pageviews ? 0 : 1, color: "#d3a32e" },
        ])}
      </article>
    </div>
  </section>`;
}

function pageSelector() {
  const selected = currentPage();
  return `<label class="mw-admin-inline-label">หน้า
    <select data-field="selectedPage">
      ${(state.content.pages || [])
        .map((page) => `<option value="${escapeHtml(page.id)}" ${page.id === selected?.id ? "selected" : ""}>${escapeHtml(page.label)} (${escapeHtml(page.route)})</option>`)
        .join("")}
    </select>
  </label>`;
}

function renderPages() {
  setTitle("หน้าแรก (Homepage)", "จัดการหน้าเว็บ");
  const page = currentPage();
  setTopActions(`<button class="mw-admin-btn mw-admin-btn-primary" type="button" data-action="save-draft">บันทึกการตั้งค่าหน้าแรก</button>`);
  $("#adminContent").innerHTML = `${pageToolbar(page)}
    <div class="mw-admin-card">
      <h2>ตั้งค่าหน้าเว็บ</h2>
      <div class="mw-admin-form-grid">
        <label>ชื่อหน้า<input data-page-prop="label" value="${escapeHtml(page.label || "")}"></label>
        <label>เส้นทางหน้าเว็บ<input data-page-prop="route" value="${escapeHtml(page.route || "")}"></label>
        <label>ชนิด<select data-page-prop="kind"><option value="existing" ${page.kind !== "custom" ? "selected" : ""}>หน้าหลัก</option><option value="custom" ${page.kind === "custom" ? "selected" : ""}>หน้าที่สร้างเอง</option></select></label>
        <label class="mw-admin-check"><input type="checkbox" data-page-enabled ${page.enabled !== false ? "checked" : ""}> เปิดใช้งาน</label>
      </div>
    </div>
    <div class="mw-admin-card">
      <div class="mw-admin-card-head"><h2>ช่องเนื้อหาที่แก้ได้</h2><div><button class="mw-admin-btn" type="button" data-action="scan-page">สแกนจากหน้าเว็บ</button><button class="mw-admin-btn" type="button" data-action="add-patch">เพิ่มช่องเนื้อหา</button></div></div>
      <div class="mw-admin-list">${(page.patches || []).map(renderPatchEditor).join("") || empty("ยังไม่มีช่องเนื้อหา")}</div>
    </div>
    ${page.kind === "custom" ? renderBlockEditor(page) : ""}`;
}

function pageToolbar(page) {
  return `<div class="mw-admin-toolbar">${pageSelector()}
    <button class="mw-admin-btn" type="button" data-action="add-page">เพิ่มหน้า</button>
    <button class="mw-admin-btn" type="button" data-action="duplicate-page">ทำสำเนา</button>
    <button class="mw-admin-btn mw-admin-btn-danger" type="button" data-action="remove-page">ลบหน้า</button>
    <a class="mw-admin-btn" target="_blank" rel="noopener" href="${escapeHtml(page.route || "/")}">ดูหน้าเว็บ</a>
  </div>`;
}

function renderPatchEditor(patch, index) {
  const type = patch.kind || "text";
  const isHomeHero = type === "image" && currentPage()?.id === "home" && /^home-hero-image-\d+$/.test(patch.id || "");
  return `<article class="mw-admin-item" data-patch-index="${index}">
    <div class="mw-admin-item-head">
      <strong>${escapeHtml(patch.label || patch.id || `Field ${index + 1}`)}</strong>
      <div><button type="button" data-action="move-patch-up">ขึ้น</button><button type="button" data-action="move-patch-down">ลง</button><button type="button" data-action="remove-patch">ลบ</button></div>
    </div>
    <div class="mw-admin-form-grid">
      <label>ชื่อช่อง<input data-patch-field="label" value="${escapeHtml(patch.label || "")}"></label>
      <label>ตัวชี้ตำแหน่ง<input data-patch-field="selector" value="${escapeHtml(patch.selector || "")}"></label>
      <label>ชนิด<select data-patch-field="kind"><option value="text" ${type === "text" ? "selected" : ""}>ข้อความ</option><option value="html" ${type === "html" ? "selected" : ""}>ข้อความจัดรูปแบบ</option><option value="image" ${type === "image" ? "selected" : ""}>รูปภาพ</option><option value="attr" ${type === "attr" ? "selected" : ""}>คุณสมบัติ</option></select></label>
      <label>คุณสมบัติ<input data-patch-field="attr" value="${escapeHtml(patch.attr || "")}" placeholder="placeholder / href / aria-label"></label>
    </div>
    ${type === "html" ? `<label>ข้อความจัดรูปแบบ<div class="mw-admin-rich" contenteditable="true" data-patch-rich="value">${patch.value || ""}</div></label>` : ""}
    ${type !== "html" && type !== "image" ? `<label>ค่า<textarea data-patch-field="value">${escapeHtml(patch.value || "")}</textarea></label>` : ""}
    ${type === "image" ? `<div class="mw-admin-form-grid"><label>ลิงก์รูปภาพ<input data-patch-field="src" value="${escapeHtml(patch.src || "")}"></label><label>คำอธิบายรูป<input data-patch-field="alt" value="${escapeHtml(patch.alt || "")}"></label></div>` : ""}
    ${isHomeHero ? `<div class="mw-admin-form-grid">
      <label>ตำแหน่งครอปภาพ<input data-patch-field="position" value="${escapeHtml(patch.position || "")}" placeholder="50% 50%"></label>
      <label>เครดิตผู้ถ่าย / การปรับภาพ<input data-patch-field="credit" value="${escapeHtml(patch.credit || "")}"></label>
      <label>ลิงก์ที่มาภาพ<input data-patch-field="sourceUrl" value="${escapeHtml(patch.sourceUrl || "")}" type="url"></label>
      <label>ใบอนุญาต<input data-patch-field="license" value="${escapeHtml(patch.license || "")}"></label>
      <label>ลิงก์ใบอนุญาต<input data-patch-field="licenseUrl" value="${escapeHtml(patch.licenseUrl || "")}" type="url"></label>
    </div>` : ""}
  </article>`;
}


function handleAdminImageError(event) {
  const image = event.target.closest?.("[data-admin-temple-image]");
  if (!image) return;
  const container = image.closest(".mw-admin-image-preview, .mw-admin-temple-list-thumb");
  if (!container) return;
  container.classList.add("is-error");
  container.innerHTML = container.classList.contains("mw-admin-image-preview")
    ? "<span>โหลดรูปไม่ได้<br><small>ตรวจสอบ URL หรือลองอัปโหลดใหม่</small></span>"
    : "<i>รูปเสีย</i>";
}

function renderSections() {
  setTitle("ส่วนหน้าเว็บ", "จัดการหน้าเว็บ");
  const page = currentPage();
  $("#adminContent").innerHTML = `${pageToolbar(page)}
    <div class="mw-admin-card">
      <div class="mw-admin-card-head"><h2>การจัดส่วนหน้าเว็บ</h2><button class="mw-admin-btn" type="button" data-action="add-section">เพิ่มส่วนหน้าเว็บ</button></div>
      <p>ใช้ตัวชี้ตำแหน่งของส่วนเดิม เพื่อซ่อน จัดลำดับ หรือทำซ้ำ โดยไม่กระทบโครงสร้างหน้าเว็บ</p>
      <div class="mw-admin-list">${byOrder(page.sections).map(renderSectionEditor).join("") || empty("ยังไม่มีส่วนหน้าเว็บ")}</div>
    </div>`;
}

function renderSectionEditor(section, index) {
  const originalIndex = (currentPage().sections || []).indexOf(section);
  return `<article class="mw-admin-item" data-section-index="${originalIndex}">
    <div class="mw-admin-item-head">
      <strong>${escapeHtml(section.label || section.id || "ส่วนหน้าเว็บ")}</strong>
      <div><button type="button" data-action="move-section-up">ขึ้น</button><button type="button" data-action="move-section-down">ลง</button><button type="button" data-action="remove-section">ลบ</button></div>
    </div>
    <div class="mw-admin-form-grid">
      <label>ชื่อส่วน<input data-section-field="label" value="${escapeHtml(section.label || "")}"></label>
      <label>ตัวชี้ตำแหน่ง<input data-section-field="selector" value="${escapeHtml(section.selector || "")}"></label>
      <label>ลำดับ<input type="number" data-section-field="order" value="${escapeHtml(section.order ?? index * 10)}"></label>
      <label>จำนวนที่ทำซ้ำ<input type="number" min="0" max="5" data-section-field="duplicateCount" value="${escapeHtml(section.duplicateCount || 0)}"></label>
      <label class="mw-admin-check"><input type="checkbox" data-section-enabled ${section.enabled !== false ? "checked" : ""}> เปิดใช้งาน</label>
    </div>
  </article>`;
}

function renderNavigation() {
  setTitle("เมนูนำทาง (Navigation)", "จัดการหน้าเว็บ");
  const nav = ensureNavigation();
  setTopActions(`<button class="mw-admin-btn mw-admin-btn-primary" type="button" data-action="save-draft">บันทึกเมนูนำทาง</button>`);
  $("#adminContent").innerHTML = `<div class="mw-admin-card">
    <div class="mw-admin-card-head"><div><h2>เมนูหลัก</h2><p>จัดการเมนูหลักและเมนูย่อยของแถบนำทางบนหน้าเว็บผู้ใช้</p></div><button class="mw-admin-btn mw-admin-btn-primary" type="button" data-action="add-nav-tab">+ เพิ่มเมนูหลัก</button></div>
    <div class="mw-admin-list">${(nav.tabs || []).map(renderNavTab).join("")}</div>
  </div>
  <div class="mw-admin-card">
    <div class="mw-admin-card-head"><h2>ลิงก์เสริม</h2><button class="mw-admin-btn" type="button" data-action="add-utility">เพิ่มลิงก์เสริม</button></div>
    <div class="mw-admin-list">${(nav.utility || []).map((item, index) => renderNavItem(item, index, "utility")).join("")}</div>
  </div>`;
}

function renderNavTab(tab, index) {
  return `<article class="mw-admin-item" data-nav-tab="${index}">
    <div class="mw-admin-item-head"><strong>${escapeHtml(tab.label || "เมนูหลัก")}</strong><div><button type="button" data-action="move-nav-tab-up" data-nav-tab-action-index="${index}">ขึ้น</button><button type="button" data-action="move-nav-tab-down" data-nav-tab-action-index="${index}">ลง</button><button type="button" data-action="remove-nav-tab" data-nav-tab-action-index="${index}">ลบ</button></div></div>
    <div class="mw-admin-form-grid">
      <label>ชื่อเมนู<input data-nav-tab-field="label" value="${escapeHtml(tab.label || "")}"></label>
      <label>ลิงก์<input data-nav-tab-field="href" value="${escapeHtml(tab.href || "")}"></label>
      <label class="mw-admin-check"><input type="checkbox" data-nav-tab-enabled ${tab.enabled !== false ? "checked" : ""}> เปิดใช้งาน</label>
    </div>
    <div class="mw-admin-sublist">
      <div class="mw-admin-card-head"><h3>เมนูย่อย</h3><button type="button" data-action="add-nav-item" data-nav-tab-action-index="${index}">เพิ่มเมนูย่อย</button></div>
      ${(tab.items || []).map((item, itemIndex) => renderNavItem(item, itemIndex, "tab", index)).join("")}
    </div>
  </article>`;
}

function renderNavItem(item, index, scope, tabIndex = -1) {
  return `<div class="mw-admin-nav-row" data-nav-scope="${scope}" data-nav-tab-index="${tabIndex}" data-nav-item="${index}">
    <input data-nav-item-field="label" value="${escapeHtml(item.label || "")}" placeholder="ชื่อเมนู">
    <input data-nav-item-field="href" value="${escapeHtml(item.href || "")}" placeholder="ลิงก์">
    <label><input type="checkbox" data-nav-item-section ${item.section ? "checked" : ""}> เป็นหัวข้อ</label>
    <label><input type="checkbox" data-nav-item-enabled ${item.enabled !== false ? "checked" : ""}> เปิด</label>
    <button type="button" data-action="move-nav-item-up" data-nav-item-action-index="${index}">ขึ้น</button>
    <button type="button" data-action="move-nav-item-down" data-nav-item-action-index="${index}">ลง</button>
    <button type="button" data-action="remove-nav-item" data-nav-item-action-index="${index}">ลบ</button>
  </div>`;
}

function renderComponents() {
  setTitle("ชิ้นส่วนเนื้อหา");
  const cards = state.content.components?.cards || [];
  $("#adminContent").innerHTML = `<div class="mw-admin-card">
    <div class="mw-admin-card-head"><h2>การ์ดที่นำกลับมาใช้ได้</h2><button class="mw-admin-btn" type="button" data-action="add-card">เพิ่มการ์ด</button></div>
    <p>คลังชิ้นส่วนสำหรับหน้าเว็บที่สร้างเองหรือหน้าเว็บในอนาคต</p>
    <div class="mw-admin-list">${cards.map(renderCardEditor).join("") || empty("ยังไม่มีการ์ด")}</div>
  </div>`;
}

function renderCardEditor(card, index) {
  return `<article class="mw-admin-item" data-card-index="${index}">
    <div class="mw-admin-item-head"><strong>${escapeHtml(card.title || "การ์ด")}</strong><button type="button" data-action="remove-card">ลบ</button></div>
    <div class="mw-admin-form-grid">
      <label>หัวข้อ<input data-card-field="title" value="${escapeHtml(card.title || "")}"></label>
      <label>รูปภาพ<input data-card-field="image" value="${escapeHtml(card.image || "")}"></label>
      <label>ลิงก์<input data-card-field="href" value="${escapeHtml(card.href || "")}"></label>
    </div>
    <label>เนื้อหา<textarea data-card-field="body">${escapeHtml(card.body || "")}</textarea></label>
  </article>`;
}

function renderBlockEditor(page) {
  return `<div class="mw-admin-card">
    <div class="mw-admin-card-head"><h2>ชิ้นส่วนของหน้าเว็บที่สร้างเอง</h2><div><button class="mw-admin-btn" type="button" data-action="add-rich-block">เพิ่มข้อความจัดรูปแบบ</button><button class="mw-admin-btn" type="button" data-action="add-hero-block">เพิ่มแบนเนอร์</button><button class="mw-admin-btn" type="button" data-action="add-cards-block">เพิ่มการ์ด</button></div></div>
    <div class="mw-admin-list">${(page.blocks || []).map(renderBlockItem).join("") || empty("ยังไม่มีชิ้นส่วน")}</div>
  </div>`;
}

function renderBlockItem(block, index) {
  const props = block.props || {};
  return `<article class="mw-admin-item" data-block-index="${index}">
    <div class="mw-admin-item-head"><strong>${escapeHtml(blockTypeLabel(block.type))}</strong><div><button type="button" data-action="move-block-up">ขึ้น</button><button type="button" data-action="move-block-down">ลง</button><button type="button" data-action="remove-block">ลบ</button></div></div>
    <label class="mw-admin-check"><input type="checkbox" data-block-enabled ${block.enabled !== false ? "checked" : ""}> เปิดใช้งานชิ้นส่วน</label>
    ${block.type === "hero" ? `<div class="mw-admin-form-grid"><label>ข้อความนำ<input data-block-prop="eyebrow" value="${escapeHtml(props.eyebrow || "")}"></label><label>หัวข้อ<input data-block-prop="title" value="${escapeHtml(props.title || "")}"></label><label>รูปภาพ<input data-block-prop="image" value="${escapeHtml(props.image || "")}"></label><label>ข้อความปุ่ม<input data-block-prop="buttonLabel" value="${escapeHtml(props.buttonLabel || "")}"></label><label>ลิงก์ปุ่ม<input data-block-prop="buttonHref" value="${escapeHtml(props.buttonHref || "")}"></label></div><label>เนื้อหา<textarea data-block-prop="body">${escapeHtml(props.body || "")}</textarea></label>` : ""}
    ${block.type === "richText" ? `<label>ข้อความจัดรูปแบบ<div class="mw-admin-rich" contenteditable="true" data-block-rich="html">${props.html || ""}</div></label>` : ""}
    ${block.type === "cards" ? `<label>ข้อมูลการ์ด<textarea data-block-prop-json="cards">${escapeHtml(JSON.stringify(props.cards || [], null, 2))}</textarea></label>` : ""}
  </article>`;
}

function blockTypeLabel(type) {
  return {
    hero: "แบนเนอร์",
    richText: "ข้อความจัดรูปแบบ",
    cards: "การ์ด",
  }[type] || type || "ชิ้นส่วน";
}

function renderCollections() {
  setTitle("เส้นทาง / คอลเลกชัน", "จัดการเนื้อหา");
  setTopActions(`<button class="mw-admin-btn mw-admin-btn-primary" type="button" disabled title="ยังไม่มี API สำหรับเพิ่มคอลเลกชัน">+ เพิ่มเส้นทาง</button>`);
  $("#adminContent").innerHTML = `<div class="mw-admin-collection-grid">
    ${TEMPLE_COLLECTIONS.map((collection) => {
      const items = collectionTemples(collection.key);
      return `<article class="mw-admin-collection-card">
        <span>${escapeHtml(icon("section"))}</span>
        <div>
          <h2>${escapeHtml(collection.label)}</h2>
          <p>รวม ${toThaiNumber(items.length)} วัด · จัดลำดับผ่านหน้า “วัดและสถานที่”</p>
          <div class="mw-admin-chip-row">${items.slice(0, 4).map((item) => `<b>${escapeHtml(item.temple.name)}</b>`).join("") || "<b>ยังไม่มีวัด</b>"}</div>
        </div>
        <div class="mw-admin-card-actions">
          <button class="mw-admin-btn" type="button" data-section="temples">เปิดรายการวัด</button>
        </div>
      </article>`;
    }).join("")}
  </div>`;
}

function renderDates() {
  activityEditor.render();
}

function templeMediaItems() {
  return (state.templeCatalog || [])
    .map((item) => ({
      name: `${item.slug || item.key}.jpg`,
      src: templeImageValue(item, templeRecords()[item.key], "card", "desktop"),
      uses: 1,
    }))
    .filter((item) => item.src)
    .slice(0, 8);
}

function renderMedia() {
  setTitle("คลังสื่อ", "สินทรัพย์");
  const media = templeMediaItems();
  const provider = state.media.provider ? `${state.media.provider} พร้อมใช้งาน` : "ยังไม่ได้ตั้งค่าผู้ให้บริการอัปโหลด";
  $("#adminContent").innerHTML = `<section class="mw-admin-upload-zone">
    <strong>สถานะคลังสื่อ</strong>
    <p>${escapeHtml(provider)} · รูปที่แสดงดึงจากข้อมูลวัดปัจจุบัน</p>
  </section>
  <div class="mw-admin-media-grid">
    ${media.map((item) => `<article class="mw-admin-media-card">
      <div>${item.src ? `<img src="${escapeHtml(item.src)}" alt="" data-admin-temple-image>` : ""}</div>
      <h2>${escapeHtml(item.name)}</h2>
      <p>ใช้ ${toThaiNumber(item.uses)} ที่</p>
    </article>`).join("") || empty("ยังไม่มีรูปในข้อมูลวัด")}
  </div>`;
}

function renderUsers() {
  setTitle("บัญชีที่กำลังใช้งาน", "ระบบ");
  const users = [
    [state.session?.email || "ผู้ดูแลระบบ", state.session?.userId || "", "ผู้ดูแลระบบ", "ใช้งาน"],
  ];
  $("#adminContent").innerHTML = `<div class="mw-admin-table-card">
    <div class="mw-admin-user-table">
      <div class="mw-admin-temple-table-head"><span>ผู้ดูแล</span><span>สิทธิ์</span><span>สถานะ</span><span>จัดการ</span></div>
      ${users.map(([name, email, role, status], index) => `<div>
        <div class="mw-admin-user-cell"><span>${escapeHtml(name.charAt(0))}</span><div><strong>${escapeHtml(name)}</strong><small>${escapeHtml(email)}</small></div></div>
        <strong>${escapeHtml(role)}</strong>
        <mark class="${status === "รอยืนยัน" ? "is-draft" : ""}">${escapeHtml(status)}</mark>
        <button class="mw-admin-btn" type="button" data-action="logout">ออกจากระบบ</button>
      </div>`).join("")}
    </div>
  </div>`;
}

function renderSettings() {
  setTitle("ตั้งค่า / อนุกรมวิธาน", "ระบบ");
  const regions = ["ภาคกลาง", "ภาคเหนือ", "ภาคอีสาน", "ภาคใต้", "ภาคตะวันออก"];
  const modes = ["รถไฟฟ้า BTS/MRT", "เรือด่วน", "รถเมล์ / รถตู้", "แท็กซี่ / รถส่วนตัว"];
  $("#adminContent").innerHTML = `<div class="mw-admin-panel-grid">
    <section class="mw-admin-card">
      <div class="mw-admin-card-head"><div><h2>ภูมิภาค</h2><p>ใช้กับตัวกรองและข้อมูลสถานที่</p></div></div>
      <div class="mw-admin-setting-list">${regions.map((name) => `<label><span></span><input value="${escapeHtml(name)}" readonly><button class="mw-admin-btn mw-admin-btn-icon" type="button" disabled>▧</button></label>`).join("")}</div>
    </section>
    <section class="mw-admin-card">
      <div class="mw-admin-card-head"><div><h2>รูปแบบการเดินทาง</h2><p>ตัวเลือกสีของตัวสร้างเส้นทาง</p></div></div>
      <div class="mw-admin-setting-list">${modes.map((name) => `<label><span></span><input value="${escapeHtml(name)}" readonly><button class="mw-admin-btn mw-admin-btn-icon" type="button" disabled>▧</button></label>`).join("")}</div>
    </section>
  </div>`;
}

function renderAnalytics() {
  setTitle("สถิติการใช้งาน", "ภาพรวมระบบ");
  const paths = Object.values(state.analytics?.paths || {}).sort((a, b) => b.count - a.count);
  const totals = state.analytics?.totals || {};
  const pageviews = Number(totals.pageviews || 0);
  const events = Number(totals.events || 0);
  const plans = Math.max(1, Math.round(pageviews * 0.075));
  const saveRate = pageviews ? Math.min(64, Math.max(18, Math.round((events / Math.max(pageviews, 1)) * 100))) : 34;
  const week = [
    ["จ", 1820],
    ["อ", 2140],
    ["พ", 1980],
    ["พฤ", 2460],
    ["ศ", 3180],
    ["ส", Math.max(4120, Math.round(pageviews * 0.21))],
    ["อา", 3860],
  ];
  $("#adminContent").innerHTML = `<div class="mw-admin-grid mw-admin-dashboard-stats">
    ${statCard("ผู้เข้าชมทั้งหมด", pageviews || 19360, "๗ วันล่าสุด", "component", "lacquer")}
    ${statCard("ผู้ใช้ไม่ซ้ำ", events || 11230, "๗ วันล่าสุด", "users", "jade")}
    ${statCard("แผนเดินทางที่สร้าง", plans || 1458, "๗ วันล่าสุด", "section", "gold")}
    ${statCard("อัตราบันทึกวัด", saveRate, "เทียบสัปดาห์ก่อน", "dates", "muted")}
  </div>
  <section class="mw-admin-card mw-admin-analytics-wide">
    <div class="mw-admin-card-head"><div><h2>ปริมาณการเข้าชม · ๗ วันล่าสุด</h2></div><p>หน่วย: การเข้าชมต่อวัน</p></div>
    ${weeklyBarChart(week)}
  </section>
  <div class="mw-admin-panel-grid mw-admin-panel-grid--three">
    <section class="mw-admin-card">
      <div class="mw-admin-card-head"><h2>วัดที่มีผู้เข้าชมมากที่สุด</h2></div>
      ${rankList((state.templeCatalog || []).slice(0, 5).map((item, index) => [item.temple.name, [8420, 7130, 5980, 4210, 3560][index] || 1200]), "#a8322a")}
    </section>
    <section class="mw-admin-card">
      <div class="mw-admin-card-head"><h2>คำค้นหายอดนิยม</h2></div>
      ${rankList([["ไหว้พระ ๙ วัด", 3120], ["ขอโชคลาภ", 2480], ["แก้ชง", 1960], ["ความรัก เนื้อคู่", 1540], ["วัดใกล้ฉัน", 1220]], "#276a52")}
    </section>
    <section class="mw-admin-card">
      <div class="mw-admin-card-head"><h2>แหล่งที่มาของผู้เข้าชม</h2></div>
      ${rankList([["ค้นหา (Google)", 46], ["เข้าตรง", 22], ["โซเชียล", 19], ["ส่งต่อ/อ้างอิง", 13]], "#276a52", "%")}
    </section>
  </div>`;
}

function weeklyBarChart(rows) {
  const max = Math.max(...rows.map(([, value]) => value), 1);
  return `<div class="mw-admin-week-chart">
    ${rows.map(([label, value], index) => {
      const height = Math.max(22, Math.round((value / max) * 178));
      return `<div class="${index === 5 ? "is-peak" : ""}" style="--bar-height:${height}px"><span>${toThaiNumber(value)}</span><i></i><strong>${escapeHtml(label)}</strong></div>`;
    }).join("")}
  </div>`;
}

function rankList(rows, color, suffix = "") {
  const max = Math.max(...rows.map(([, value]) => Number(value) || 0), 1);
  return `<div class="mw-admin-rank-list">
    ${rows.map(([label, value]) => {
      const pct = Math.max(5, Math.round((Number(value) / max) * 100));
      return `<div><p><span>${escapeHtml(label)}</span><b>${escapeHtml(toThaiNumber(value))}${escapeHtml(suffix)}</b></p><i style="--bar:${pct}%;--color:${escapeHtml(color)}"></i></div>`;
    }).join("")}
  </div>`;
}

function empty(text) {
  return `<p class="mw-admin-empty">${escapeHtml(text)}</p>`;
}

function collectionTemples(collection = state.templeCollectionFilter) {
  return state.templeCatalog.filter((item) => item.collection === collection);
}

function replaceCollectionTemples(collection, orderedItems) {
  const orderedByCollection = new Map();
  TEMPLE_COLLECTIONS.forEach((item) => {
    orderedByCollection.set(item.key, item.key === collection ? orderedItems : collectionTemples(item.key));
  });
  const knownCollections = new Set(TEMPLE_COLLECTIONS.map((item) => item.key));
  state.templeCatalog = [
    ...TEMPLE_COLLECTIONS.flatMap((item) => orderedByCollection.get(item.key) || []),
    ...state.templeCatalog.filter((item) => !knownCollections.has(item.collection)),
  ];
}

function persistTempleOrder(collection, orderedItems) {
  templeOrders()[collection] = orderedItems.map((item) => item.key);
  Object.values(templeRecords()).forEach((record) => {
    if (record?.collection === collection && record.fields) delete record.fields.rank;
  });
  orderedItems.forEach((item, index) => {
    item.temple.rank = index + 1;
  });
  replaceCollectionTemples(collection, orderedItems);
}

function reorderTemple(sourceKey, targetKey, placeAfter = false) {
  if (!sourceKey || !targetKey || sourceKey === targetKey || state.templeSearch) return false;
  const source = state.templeCatalog.find((item) => item.key === sourceKey);
  const target = state.templeCatalog.find((item) => item.key === targetKey);
  if (!source || !target || source.collection !== target.collection) return false;

  const orderedItems = collectionTemples(source.collection);
  const sourceIndex = orderedItems.findIndex((item) => item.key === sourceKey);
  if (sourceIndex < 0) return false;
  const [moved] = orderedItems.splice(sourceIndex, 1);
  let targetIndex = orderedItems.findIndex((item) => item.key === targetKey);
  if (targetIndex < 0) return false;
  if (placeAfter) targetIndex += 1;
  orderedItems.splice(targetIndex, 0, moved);
  persistTempleOrder(source.collection, orderedItems);
  state.selectedTempleKey = sourceKey;
  markDirty();
  renderTemples();
  return true;
}

function moveTempleByOffset(key, offset) {
  if (!key || !offset || state.templeSearch) return;
  const record = state.templeCatalog.find((item) => item.key === key);
  if (!record) return;
  const orderedItems = collectionTemples(record.collection);
  const sourceIndex = orderedItems.findIndex((item) => item.key === key);
  const targetIndex = sourceIndex + offset;
  if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= orderedItems.length) return;
  const targetKey = orderedItems[targetIndex].key;
  if (!reorderTemple(key, targetKey, offset > 0)) return;
  requestAnimationFrame(() => {
    $(`[data-temple-drag-key="${CSS.escape(key)}"]`)?.focus();
  });
}

function clearTempleDropIndicators() {
  $$("[data-temple-row].is-drop-before, [data-temple-row].is-drop-after").forEach((row) => {
    row.classList.remove("is-drop-before", "is-drop-after");
  });
}

function handleTempleDragStart(event) {
  const handle = event.target.closest?.("[data-temple-drag-key]");
  if (!handle || state.templeSearch) return;
  state.draggingTempleKey = handle.dataset.templeDragKey;
  handle.closest("[data-temple-row]")?.classList.add("is-dragging");
  event.dataTransfer?.setData("text/plain", state.draggingTempleKey);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
}

function handleTempleDragOver(event) {
  const row = event.target.closest?.("[data-temple-row]");
  if (!row || !state.draggingTempleKey || row.dataset.templeRow === state.draggingTempleKey) return;
  const source = state.templeCatalog.find((item) => item.key === state.draggingTempleKey);
  const target = state.templeCatalog.find((item) => item.key === row.dataset.templeRow);
  if (!source || !target || source.collection !== target.collection) return;
  event.preventDefault();
  clearTempleDropIndicators();
  const bounds = row.getBoundingClientRect();
  row.classList.add(event.clientY > bounds.top + bounds.height / 2 ? "is-drop-after" : "is-drop-before");
  if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
}

function handleTempleDrop(event) {
  const row = event.target.closest?.("[data-temple-row]");
  if (!row || !state.draggingTempleKey) return;
  event.preventDefault();
  const placeAfter = row.classList.contains("is-drop-after");
  const sourceKey = state.draggingTempleKey;
  const targetKey = row.dataset.templeRow;
  clearTempleDropIndicators();
  state.draggingTempleKey = "";
  reorderTemple(sourceKey, targetKey, placeAfter);
}

function handleTempleDragEnd() {
  state.draggingTempleKey = "";
  clearTempleDropIndicators();
  $$("[data-temple-row].is-dragging").forEach((row) => row.classList.remove("is-dragging"));
}

function handleTempleReorderKeydown(event) {
  if (event.key === "Escape" && state.templeEditorOpen) {
    event.preventDefault();
    closeTempleEditor();
    return;
  }
  const handle = event.target.closest?.("[data-temple-drag-key]");
  if (!handle || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
  event.preventDefault();
  moveTempleByOffset(handle.dataset.templeDragKey, event.key === "ArrowUp" ? -1 : 1);
}

function handleGlobalClick(event) {
  const confirmAccept = event.target.closest("[data-confirm-accept]");
  if (confirmAccept) {
    runPendingDeleteAction();
    return;
  }

  const confirmCancel = event.target.closest("[data-confirm-cancel]");
  if (confirmCancel || event.target.matches("[data-confirm-overlay]")) {
    closeDeleteConfirm();
    return;
  }

  if (event.target.matches("[data-drawer-overlay]")) {
    closeTempleEditor();
    return;
  }

  const editTempleButton = event.target.closest("[data-edit-temple]");
  if (editTempleButton) {
    state.selectedTempleKey = editTempleButton.dataset.editTemple;
    state.templeEditorOpen = true;
    renderTemples();
    requestAnimationFrame(() => $(".mw-admin-drawer input, .mw-admin-drawer button")?.focus());
    return;
  }

  const templeMove = event.target.closest("[data-temple-move-key]");
  if (templeMove) {
    moveTempleByOffset(templeMove.dataset.templeMoveKey, Number(templeMove.dataset.templeMoveOffset));
    return;
  }

  const templeTab = event.target.closest("[data-temple-collection]");
  if (templeTab) {
    rememberTempleListScroll();
    state.templeCollectionFilter = templeTab.dataset.templeCollection;
    state.templeSearch = "";
    state.selectedTempleKey = state.templeCatalog.find((item) => item.collection === state.templeCollectionFilter)?.key || "";
    state.templeEditorOpen = false;
    renderTemples({ rememberScroll: false });
    return;
  }
  const templeItem = event.target.closest("[data-select-temple]");
  if (templeItem) {
    event.preventDefault();
    state.selectedTempleKey = templeItem.dataset.selectTemple;
    renderTemples();
    return;
  }
  const sectionButton = event.target.closest("[data-section]");
  if (sectionButton) {
    if (state.section === "dates" && !activityEditor.canLeave()) return;
    if (sectionButton.dataset.pageJump) state.selectedPageId = sectionButton.dataset.pageJump;
    state.section = sectionButton.dataset.section;
    renderAdmin();
    return;
  }
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;
  const action = actionButton.dataset.action;
  const actions = {
    "save-draft": saveDraft,
    "toggle-sidebar": toggleSidebar,
    publish,
    logout,
    preview: () => window.open("/", "_blank", "noopener"),
    "add-page": addPage,
    "duplicate-page": duplicatePage,
    "remove-page": removePage,
    "scan-page": scanSelectedPage,
    "add-patch": addPatch,
    "remove-patch": removePatch,
    "move-patch-up": movePatchUp,
    "move-patch-down": movePatchDown,
    "add-section": addSection,
    "remove-section": removeSection,
    "move-section-up": moveSectionUp,
    "move-section-down": moveSectionDown,
    "add-nav-tab": addNavTab,
    "remove-nav-tab": removeNavTab,
    "move-nav-tab-up": moveNavTabUp,
    "move-nav-tab-down": moveNavTabDown,
    "add-nav-item": addNavItem,
    "remove-nav-item": removeNavItem,
    "move-nav-item-up": moveNavItemUp,
    "move-nav-item-down": moveNavItemDown,
    "add-utility": addUtility,
    "add-card": addCard,
    "remove-card": removeCard,
    "reset-temple-override": resetTempleOverride,
    "add-temple": addTemple,
    "delete-temple": deleteTemple,
    "close-temple-editor": closeTempleEditor,
    "save-temple-editor": saveTempleEditor,
    "use-temple-image-url": useTempleImageUrl,
    "crop-temple-image": cropTempleImage,
    "reuse-temple-image": reuseTempleImage,
    "clear-temple-image": clearTempleImage,
    "add-rich-block": () => addBlock("richText"),
    "add-hero-block": () => addBlock("hero"),
    "add-cards-block": () => addBlock("cards"),
    "remove-block": removeBlock,
    "move-block-up": moveBlockUp,
    "move-block-down": moveBlockDown,
    "refresh-analytics": async () => {
      await loadAnalytics();
      renderAdmin();
    },
  };
  if (actionButton.dataset.deleteTempleKey) state.selectedTempleKey = actionButton.dataset.deleteTempleKey;
  if (DELETE_ACTIONS.has(action)) {
    showDeleteConfirm(actionButton, actions[action]);
    return;
  }
  actions[action]?.(actionButton);
}

function deleteConfirmMessage(button) {
  if (button.dataset.action === "logout") {
    return {
      title: "ออกจากระบบโดยยังไม่บันทึก?",
      detail: "มีการแก้ไขที่ยังไม่ได้บันทึก กรุณาบันทึกงานก่อน หรือยืนยันออกจากระบบโดยไม่บันทึก",
      confirmLabel: "ออกจากระบบ",
    };
  }
  const label = button.textContent.trim() || "รายการนี้";
  if (button.dataset.action === "clear-temple-image") {
    return {
      title: "ยืนยันการลบรูป",
      detail: "ต้องการลบรูปนี้ออกจาก draft หรือไม่?",
      confirmLabel: "ลบรูป",
    };
  }
  return {
    title: "ยืนยันการลบ",
    detail: `ต้องการ${label}หรือไม่?`,
    confirmLabel: "ลบ",
  };
}

function showDeleteConfirm(button, callback) {
  if (!callback) return;
  state.pendingDeleteAction = { button, callback };
  const dialog = $("#adminConfirmDialog");
  if (!dialog) return;
  const message = deleteConfirmMessage(button);
  $("[data-confirm-title]", dialog).textContent = message.title;
  $("[data-confirm-detail]", dialog).textContent = message.detail;
  $("[data-confirm-accept]", dialog).textContent = message.confirmLabel;
  dialog.hidden = false;
  dialog.dataset.active = "true";
  requestAnimationFrame(() => $("[data-confirm-cancel]", dialog)?.focus());
}

function closeDeleteConfirm() {
  state.pendingDeleteAction = null;
  const dialog = $("#adminConfirmDialog");
  if (!dialog) return;
  dialog.hidden = true;
  dialog.dataset.active = "false";
}

function runPendingDeleteAction() {
  const pending = state.pendingDeleteAction;
  closeDeleteConfirm();
  pending?.callback(pending.button);
}

function rememberTempleListScroll() {
  const list = $(".mw-admin-temple-list-scroll");
  if (!list) return;
  state.templeListScroll[state.templeCollectionFilter] = list.scrollTop;
}

function restoreTempleListScroll() {
  const list = $(".mw-admin-temple-list-scroll");
  if (!list) return;
  const collection = state.templeCollectionFilter;
  const scrollTop = Number(state.templeListScroll[collection]) || 0;
  const restore = () => {
    if (state.templeCollectionFilter !== collection) return;
    const currentList = $(".mw-admin-temple-list-scroll");
    if (currentList) currentList.scrollTop = scrollTop;
  };
  restore();
  requestAnimationFrame(restore);
}

function handleInput(event) {
  if (state.section === "dates") return;
  const target = event.target;
  if (target.matches("[data-field='selectedPage']")) {
    state.selectedPageId = target.value;
    renderAdmin();
    return;
  }
  if (target.matches("[data-temple-search]")) {
    state.templeSearch = target.value;
    state.templeEditorOpen = false;
    renderTemples();
    requestAnimationFrame(() => {
      const input = $("[data-temple-search]");
      input?.focus();
      input?.setSelectionRange(input.value.length, input.value.length);
    });
    return;
  }
  if (target.matches("[data-temple-image-upload]")) {
    handleTempleImageUpload(target);
    return;
  }
  if (updateTempleFromInput(target)) {
    markDirty();
    return;
  }
  if (updateNavFromInput(target)) {
    markDirty();
    return;
  }
  const page = currentPage();
  if (!page) return;
  if (target.matches("[data-page-prop]")) page[target.dataset.pageProp] = target.value;
  if (target.matches("[data-page-enabled]")) page.enabled = target.checked;
  updatePatchFromInput(target, page);
  updateSectionFromInput(target, page);
  updateCardFromInput(target);
  updateBlockFromInput(target, page);
  markDirty();
}

function updateTempleFromInput(target) {
  if (!target.matches("[data-temple-field]")) return false;
  const edit = currentTempleEdit();
  if (!edit) return true;
  edit.fields ||= {};

  if (target.matches("[data-temple-field]")) {
    const key = target.dataset.templeField;
    const numeric = target.type === "number";
    const value = numeric && target.value !== "" ? Number(target.value) : target.value;
    edit.fields[key] = value;
    const catalogRecord = currentTempleRecord();
    if (catalogRecord) {
      catalogRecord.temple[key] = value;
      syncTempleEditorLabels(catalogRecord);
    }
  }

  return true;
}

function syncTempleEditorLabels(record) {
  const name = record.temple.name || "ยังไม่มีชื่อ";
  const rank = record.temple.rank || "-";
  const listItem = [...document.querySelectorAll("[data-select-temple]")]
    .find((item) => item.dataset.selectTemple === record.key);
  const listTitle = listItem?.querySelector("[data-temple-list-title]");
  if (listTitle) listTitle.textContent = `#${rank} ${name}`;
  const tableTitle = document.querySelector(`[data-temple-row="${CSS.escape(record.key)}"] [data-temple-table-title]`);
  if (tableTitle) tableTitle.textContent = name;

  const editorName = $("[data-temple-editor-name]");
  const editorRank = $("[data-temple-editor-rank]");
  if (editorName) editorName.textContent = name;
  if (editorRank) editorRank.textContent = `${record.collectionLabel} · #${rank}`;
}

function updatePatchFromInput(target, page) {
  const item = target.closest("[data-patch-index]");
  if (!item) return;
  const patch = page.patches[Number(item.dataset.patchIndex)];
  if (!patch) return;
  if (target.matches("[data-patch-field]")) patch[target.dataset.patchField] = target.value;
  if (target.matches("[data-patch-rich]")) patch[target.dataset.patchRich] = target.innerHTML;
}

function updateSectionFromInput(target, page) {
  const item = target.closest("[data-section-index]");
  if (!item) return;
  const section = page.sections[Number(item.dataset.sectionIndex)];
  if (!section) return;
  if (target.matches("[data-section-field]")) {
    const key = target.dataset.sectionField;
    section[key] = key === "order" || key === "duplicateCount" ? Number(target.value) : target.value;
  }
  if (target.matches("[data-section-enabled]")) section.enabled = target.checked;
}

function updateNavFromInput(target) {
  const nav = ensureNavigation();
  const tabEl = target.closest("[data-nav-tab]");
  if (tabEl && target.matches("[data-nav-tab-field]")) {
    const tab = nav.tabs[Number(tabEl.dataset.navTab)];
    if (!tab) return true;
    tab[target.dataset.navTabField] = target.value;
    return true;
  }
  if (tabEl && target.matches("[data-nav-tab-enabled]")) {
    const tab = nav.tabs[Number(tabEl.dataset.navTab)];
    if (!tab) return true;
    tab.enabled = target.checked;
    return true;
  }
  const row = target.closest("[data-nav-item]");
  if (!row) return false;
  const item = navItemFromRow(row);
  if (!item) return true;
  if (target.matches("[data-nav-item-field]")) item[target.dataset.navItemField] = target.value;
  if (target.matches("[data-nav-item-section]")) item.section = target.checked;
  if (target.matches("[data-nav-item-enabled]")) item.enabled = target.checked;
  return Boolean(
    target.matches("[data-nav-item-field]") ||
      target.matches("[data-nav-item-section]") ||
      target.matches("[data-nav-item-enabled]"),
  );
}

function updateCardFromInput(target) {
  const item = target.closest("[data-card-index]");
  if (!item) return;
  const card = state.content.components.cards[Number(item.dataset.cardIndex)];
  if (card && target.matches("[data-card-field]")) card[target.dataset.cardField] = target.value;
}

function updateBlockFromInput(target, page) {
  const item = target.closest("[data-block-index]");
  if (!item) return;
  const block = page.blocks[Number(item.dataset.blockIndex)];
  if (!block) return;
  block.props ||= {};
  if (target.matches("[data-block-enabled]")) block.enabled = target.checked;
  if (target.matches("[data-block-prop]")) block.props[target.dataset.blockProp] = target.value;
  if (target.matches("[data-block-rich]")) block.props[target.dataset.blockRich] = target.innerHTML;
  if (target.matches("[data-block-prop-json]")) {
    try {
      block.props[target.dataset.blockPropJson] = JSON.parse(target.value || "[]");
      target.setCustomValidity("");
    } catch {
      target.setCustomValidity("JSON ไม่ถูกต้อง");
    }
  }
}

function saveDraft() {
  localStorage.setItem("mongkolwela.admin.draft", JSON.stringify(state.content));
  state.dirty = false;
  setStatus("บันทึก draft ใน browser แล้ว", "ok");
}


async function logout(button, confirmed = false) {
  if (state.publishing || activityEditor.isBusy()) {
    setStatus("กรุณารอให้บันทึกหรือเผยแพร่เสร็จก่อนออกจากระบบ", "warn");
    return;
  }
  if (!confirmed && (state.dirty || activityEditor.isDirty())) {
    showDeleteConfirm(button, () => logout(button, true));
    return;
  }
  try {
    await api("/api/admin/session", { method: "DELETE" });
    state.session = null;
    state.dirty = false;
    window.location.reload();
  } catch {
    renderLogin("ไม่สามารถยืนยันการออกจากระบบกับเซิร์ฟเวอร์ได้ กรุณาลองใหม่");
  }
}

function addPage() {
  const id = `page-${Date.now()}`;
  state.content.pages.push({
    id,
    label: "หน้าใหม่",
    route: `/p/${id}/`,
    enabled: false,
    kind: "custom",
    patches: [],
    sections: [],
    blocks: [],
  });
  state.selectedPageId = id;
  markDirty();
  renderPages();
}

function duplicatePage() {
  const copy = clone(currentPage());
  copy.id = `${copy.id}-copy-${Date.now()}`;
  copy.label = `${copy.label} Copy`;
  copy.route = copy.kind === "custom" ? `/p/${copy.id}/` : copy.route;
  state.content.pages.push(copy);
  state.selectedPageId = copy.id;
  markDirty();
  renderPages();
}

function removePage() {
  if (!confirm("ลบหน้านี้?")) return;
  state.content.pages = state.content.pages.filter((page) => page.id !== state.selectedPageId);
  state.selectedPageId = state.content.pages[0]?.id || "";
  markDirty();
  renderPages();
}

function addPatch() {
  currentPage().patches ||= [];
  currentPage().patches.push({
    id: `patch-${Date.now()}`,
    label: "New field",
    selector: "",
    kind: "text",
    value: "",
  });
  markDirty();
  renderPages();
}

function patchButtonIndex(button) {
  return Number(button.closest("[data-patch-index]")?.dataset.patchIndex);
}

function removePatch(button) {
  currentPage().patches.splice(patchButtonIndex(button), 1);
  markDirty();
  renderPages();
}

function movePatchUp(button) {
  moveArrayItem(currentPage().patches, patchButtonIndex(button), -1);
  markDirty();
  renderPages();
}

function movePatchDown(button) {
  moveArrayItem(currentPage().patches, patchButtonIndex(button), 1);
  markDirty();
  renderPages();
}

async function scanSelectedPage() {
  const page = currentPage();
  try {
    const response = await fetch(page.route, { cache: "no-store" });
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const patches = [];
    const add = (node, kind, label, extra = {}) => {
      const selector = selectorForNode(node);
      if (!selector) return;
      patches.push({ id: `scan-${patches.length}-${Date.now()}`, label, selector, kind, ...extra });
    };
    doc.querySelectorAll("main h1, main h2, main h3, main p, main a, main button").forEach((node) => {
      const text = node.textContent.trim();
      if (text) add(node, "text", text.slice(0, 50), { value: text });
    });
    doc.querySelectorAll("main img").forEach((node) => {
      add(node, "image", node.getAttribute("alt") || "Image", {
        src: node.getAttribute("src") || "",
        alt: node.getAttribute("alt") || "",
      });
    });
    page.patches = mergePatches(page.patches || [], patches);
    markDirty();
    renderPages();
    setStatus(`สแกนเพิ่ม ${patches.length} fields`, "ok");
  } catch (error) {
    setStatus(`สแกนไม่สำเร็จ: ${error.message}`, "error");
  }
}

function selectorForNode(node) {
  if (node.id) return `#${CSS.escape(node.id)}`;
  const parts = [];
  let current = node;
  while (current && current.nodeType === 1 && current.tagName.toLowerCase() !== "html") {
    let part = current.tagName.toLowerCase();
    if (current.classList.length) part += `.${[...current.classList].slice(0, 2).map((item) => CSS.escape(item)).join(".")}`;
    const parent = current.parentElement;
    if (parent) {
      const siblings = [...parent.children].filter((child) => child.tagName === current.tagName);
      if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
    }
    parts.unshift(part);
    if (parts.length >= 4) break;
    current = current.parentElement;
  }
  return parts.join(" > ");
}

function mergePatches(existing, scanned) {
  const selectors = new Set(existing.map((patch) => `${patch.selector}:${patch.kind}`));
  return existing.concat(scanned.filter((patch) => !selectors.has(`${patch.selector}:${patch.kind}`)));
}

function addSection() {
  currentPage().sections ||= [];
  currentPage().sections.push({
    id: `section-${Date.now()}`,
    label: "New section",
    selector: "",
    enabled: true,
    order: (currentPage().sections.length + 1) * 10,
  });
  markDirty();
  renderSections();
}

function sectionButtonIndex(button) {
  return Number(button.closest("[data-section-index]")?.dataset.sectionIndex);
}

function removeSection(button) {
  currentPage().sections.splice(sectionButtonIndex(button), 1);
  markDirty();
  renderSections();
}

function moveSectionUp(button) {
  const section = currentPage().sections[sectionButtonIndex(button)];
  section.order = (Number(section.order) || 0) - 15;
  markDirty();
  renderSections();
}

function moveSectionDown(button) {
  const section = currentPage().sections[sectionButtonIndex(button)];
  section.order = (Number(section.order) || 0) + 15;
  markDirty();
  renderSections();
}

function addNavTab() {
  ensureNavigation().tabs.push({ id: `tab-${Date.now()}`, label: "เมนูใหม่", href: "/", enabled: true, items: [] });
  markDirty();
  renderNavigation();
}

function navTabIndex(button) {
  const directIndex = Number(button.dataset.navTabActionIndex);
  if (Number.isInteger(directIndex) && directIndex >= 0) return directIndex;
  const closestIndex = Number(button.closest("[data-nav-tab]")?.dataset.navTab);
  return Number.isInteger(closestIndex) && closestIndex >= 0 ? closestIndex : -1;
}

function navTabFromButton(button) {
  const nav = ensureNavigation();
  const index = navTabIndex(button);
  return index >= 0 ? nav.tabs[index] : null;
}

function removeNavTab(button) {
  const nav = ensureNavigation();
  const index = navTabIndex(button);
  if (index < 0 || !nav.tabs[index]) return;
  nav.tabs.splice(index, 1);
  markDirty();
  renderNavigation();
}

function moveNavTabUp(button) {
  const nav = ensureNavigation();
  const index = navTabIndex(button);
  if (index < 0 || !nav.tabs[index]) return;
  moveArrayItem(nav.tabs, index, -1);
  markDirty();
  renderNavigation();
}

function moveNavTabDown(button) {
  const nav = ensureNavigation();
  const index = navTabIndex(button);
  if (index < 0 || !nav.tabs[index]) return;
  moveArrayItem(nav.tabs, index, 1);
  markDirty();
  renderNavigation();
}

function addNavItem(button) {
  const tab = navTabFromButton(button);
  if (!tab) return;
  tab.items ||= [];
  tab.items.push({ id: `item-${Date.now()}`, label: "รายการใหม่", href: "/", enabled: true });
  markDirty();
  renderNavigation();
}

function addUtility() {
  ensureNavigation().utility.push({ id: `utility-${Date.now()}`, label: "ลิงก์เสริม", href: "/", enabled: true });
  markDirty();
  renderNavigation();
}

function navItemFromRow(row) {
  const nav = ensureNavigation();
  const index = Number(row.dataset.navItem);
  if (!Number.isInteger(index) || index < 0) return null;
  if (row.dataset.navScope === "utility") return nav.utility[index];
  return nav.tabs[Number(row.dataset.navTabIndex)]?.items?.[index] || null;
}

function navItemArrayFromRow(row) {
  const nav = ensureNavigation();
  if (!row) return null;
  if (row.dataset.navScope === "utility") return nav.utility;
  const tab = nav.tabs[Number(row.dataset.navTabIndex)];
  if (!tab) return null;
  tab.items ||= [];
  return tab.items;
}

function removeNavItem(button) {
  const row = button.closest("[data-nav-item]");
  const items = navItemArrayFromRow(row);
  const index = Number(row?.dataset.navItem);
  if (!items || !Number.isInteger(index) || !items[index]) return;
  items.splice(index, 1);
  markDirty();
  renderNavigation();
}

function moveNavItemUp(button) {
  const row = button.closest("[data-nav-item]");
  const items = navItemArrayFromRow(row);
  const index = Number(row?.dataset.navItem);
  if (!items || !Number.isInteger(index) || !items[index]) return;
  moveArrayItem(items, index, -1);
  markDirty();
  renderNavigation();
}

function moveNavItemDown(button) {
  const row = button.closest("[data-nav-item]");
  const items = navItemArrayFromRow(row);
  const index = Number(row?.dataset.navItem);
  if (!items || !Number.isInteger(index) || !items[index]) return;
  moveArrayItem(items, index, 1);
  markDirty();
  renderNavigation();
}

function addCard() {
  state.content.components.cards ||= [];
  state.content.components.cards.push({ id: `card-${Date.now()}`, title: "การ์ด", body: "", image: "", href: "/" });
  markDirty();
  renderComponents();
}

function removeCard(button) {
  state.content.components.cards.splice(Number(button.closest("[data-card-index]").dataset.cardIndex), 1);
  markDirty();
  renderComponents();
}

async function resetTempleOverride() {
  const record = currentTempleRecord();
  if (!record) return;
  delete templeRecords()[record.key];
  await loadTemples();
  markDirty();
  renderTemples();
}

function addTemple() {
  const collection = state.templeCollectionFilter || "popular";
  const createdAt = Date.now();
  const key = `${collection}:admin-${createdAt}`;
  const maxRank = Math.max(
    0,
    ...state.templeCatalog.filter((item) => item.collection === collection).map((item) => Number(item.temple.rank) || 0),
  );
  const edit = {
    key,
    collection,
    slug: `${String(maxRank + 1).padStart(3, "0")}-สถานที่ใหม่-thailand-${createdAt}`,
    source: "admin",
    status: "active",
    fields: {
      rank: maxRank + 1,
      name: "สถานที่ใหม่",
      region: "",
      province: "",
      district: "",
      imageAlt: "",
    },
    images: {},
  };
  templeRecords()[key] = edit;
  const collectionLabel = TEMPLE_COLLECTIONS.find((item) => item.key === collection)?.label || collection;
  state.templeCatalog.push({
    key,
    collection,
    collectionLabel,
    slug: edit.slug,
    detailUrl: `/temples/${collection}/${edit.slug}/`,
    source: "admin",
    temple: { ...edit.fields, images: {} },
    visitInfo: {},
  });
  persistTempleOrder(collection, collectionTemples(collection));
  state.selectedTempleKey = key;
  state.templeSearch = "";
  state.templeEditorOpen = true;
  markDirty();
  renderTemples();
  requestAnimationFrame(() => $("[data-temple-field='name']")?.select());
}

function deleteTemple() {
  const record = currentTempleRecord();
  if (!record) return;
  const edit = currentTempleEdit();
  edit.status = "deleted";
  state.templeCatalog = state.templeCatalog.filter((item) => item.key !== record.key);
  persistTempleOrder(record.collection, collectionTemples(record.collection));
  state.selectedTempleKey = state.templeCatalog.find((item) => item.collection === state.templeCollectionFilter)?.key || "";
  state.templeEditorOpen = false;
  markDirty();
  renderTemples();
}

function closeTempleEditor() {
  state.templeEditorOpen = false;
  renderTemples();
}

function saveTempleEditor() {
  state.templeEditorOpen = false;
  setStatus("บันทึกการแก้ไขไว้ใน draft แล้ว", "ok");
  renderTemples();
}


function addBlock(type) {
  const page = currentPage();
  page.blocks ||= [];
  const defaults = {
    hero: { eyebrow: "ข้อความนำ", title: "หัวข้อแบนเนอร์", body: "", image: "", buttonLabel: "", buttonHref: "/" },
    richText: { html: "<h2>หัวข้อใหม่</h2><p>เขียนเนื้อหาได้ที่นี่</p>" },
    cards: { cards: clone(state.content.components.cards || []) },
  };
  page.blocks.push({ id: `block-${Date.now()}`, type, enabled: true, props: defaults[type] || {} });
  markDirty();
  renderPages();
}

function blockIndex(button) {
  return Number(button.closest("[data-block-index]")?.dataset.blockIndex);
}

function removeBlock(button) {
  currentPage().blocks.splice(blockIndex(button), 1);
  markDirty();
  renderPages();
}

function moveBlockUp(button) {
  moveArrayItem(currentPage().blocks, blockIndex(button), -1);
  markDirty();
  renderPages();
}

function moveBlockDown(button) {
  moveArrayItem(currentPage().blocks, blockIndex(button), 1);
  markDirty();
  renderPages();
}

function moveArrayItem(array, index, direction) {
  const next = index + direction;
  if (!array || index < 0 || next < 0 || next >= array.length) return;
  [array[index], array[next]] = [array[next], array[index]];
}

window.addEventListener("beforeunload", (event) => {
  if (!state.session) return;
  if (!state.dirty && !activityEditor.isDirty() && !activityEditor.isBusy()) return;
  event.preventDefault();
  event.returnValue = "";
});

const { templeRecords, templeOrders, currentTempleRecord, currentTempleEdit, templeValue, filteredTempleCatalog, normalizeAdminSearch, renderTemples, renderTempleTableRow, templeConfidence, renderTempleDrawer, renderTempleListItem, renderTempleEmptyState, renderTempleEditor, renderTempleImageGroup, renderTempleImageField, templeImageValue } = createTempleEditor({ state, rememberTempleListScroll, setTitle, setTopActions, escapeHtml, $, TEMPLE_COLLECTIONS, empty, restoreTempleListScroll, collectionTemples, TEMPLE_IMAGE_FIELDS });

const { imageFieldFromButton, setTempleImage, useTempleImageUrl, verifyImageLoads, cropTempleImage, reuseTempleImage, clearTempleImage, handleTempleImageUpload, templeImageFilename, detectImageProvider, uploadAdminMedia, openTempleCropper, initializeTempleCrop, bindTempleCropPointerEvents, pickCropBox, moveTempleCrop, resizeTempleCrop, updateTempleCropSelection, applyTempleCrop, closeTempleCropper } = createAdminMedia({ markDirty, setStatus, state, api, $, TEMPLE_IMAGE_FIELDS, escapeHtml, currentTempleEdit, currentTempleRecord, renderTemples, templeImageValue });

const { setPublishControlsDisabled, setPublishProgress, hidePublishProgress, publishedContentMatches, waitForPublishedContent, publish } = createAdminPublishing({ queryAll: (selector) => document.querySelectorAll(selector), $, api, sleep, state, setStatus, renderAdmin });

const activityEditor = createActivityEditor({ state, $, api, escapeHtml, setTitle, setTopActions, setStatus });

boot();
