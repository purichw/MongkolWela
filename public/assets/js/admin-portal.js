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
  draggingTempleKey: "",
  publishing: false,
  pendingDeleteAction: null,
  secondaryReady: false,
  secondaryLoading: false,
  media: { provider: "", cloudinary: { enabled: false }, imagekit: { enabled: false } },
};

const PUBLISH_VERIFY_TIMEOUT_MS = 90000;
const PUBLISH_VERIFY_INTERVAL_MS = 600;

const TEMPLE_COLLECTIONS = [
  { key: "popular", label: "สายไหว้พระ 9 วัด" },
  { key: "mu", label: "สายมู" },
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

function normalizeRoute(route = "/") {
  if (!route || route === "/index.html") return "/";
  return route.endsWith("/") ? route : `${route}/`;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok !== true) throw new Error(payload.error || `API failed: ${response.status}`);
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

function setPublishControlsDisabled(disabled) {
  $$('[data-action="publish"]').forEach((button) => {
    button.disabled = disabled;
    button.setAttribute("aria-busy", disabled ? "true" : "false");
  });
}

function setPublishProgress(progress, title, detail = "") {
  const panel = $("#adminPublishProgress");
  if (!panel) return;
  const percent = Math.max(0, Math.min(100, Math.round(progress)));
  panel.hidden = false;
  panel.dataset.active = "true";
  $("[data-publish-progress-title]", panel).textContent = title;
  $("[data-publish-progress-value]", panel).textContent = `${percent}%`;
  $("[data-publish-progress-detail]", panel).textContent = detail;
  $("[data-publish-progress-bar]", panel).style.width = `${percent}%`;
}

function hidePublishProgress() {
  const panel = $("#adminPublishProgress");
  if (!panel) return;
  panel.hidden = true;
  panel.dataset.active = "false";
}

function publishedContentMatches(expected, actual) {
  if (!expected || !actual) return false;
  return Boolean(expected.publishedAt && actual.publishedAt === expected.publishedAt);
}

async function waitForPublishedContent(expectedContent) {
  const startedAt = Date.now();
  let attempt = 0;
  while (Date.now() - startedAt < PUBLISH_VERIFY_TIMEOUT_MS) {
    attempt += 1;
    const elapsed = Date.now() - startedAt;
    const progress = Math.min(96, 48 + (elapsed / PUBLISH_VERIFY_TIMEOUT_MS) * 48);
    setPublishProgress(
      progress,
      "กำลังตรวจหน้าเว็บจริง",
      attempt === 1 ? "กำลังอ่านข้อมูล live หลัง publish" : `รอตรวจซ้ำครั้งที่ ${attempt}`,
    );
    const payload = await api(`/api/admin/content?verify=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });
    if (publishedContentMatches(expectedContent, payload.content)) return payload.content;
    await sleep(PUBLISH_VERIFY_INTERVAL_MS);
  }
  throw new Error("Publish สำเร็จแล้ว แต่ยังตรวจไม่พบเวอร์ชันใหม่บนหน้าเว็บ");
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
    dashboard: "⌁",
    page: "▤",
    nav: "☰",
    section: "↕",
    component: "◇",
    chart: "◌",
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
    setStatus("กำลังโหลดข้อมูลหลัก...", "info");
    await loadContent();
    renderAdmin();
    setStatus("กำลังโหลดข้อมูลเสริม...", "info");
    void loadSecondaryAdminData();
  } catch {
    renderLogin();
  }
}

function renderAppShell() {
  $("#adminApp").innerHTML = `<div class="mw-admin-shell ${state.sidebarCollapsed ? "is-sidebar-collapsed" : ""}">
    <header class="mw-admin-header">
      <a class="mw-admin-logo" href="/admin/"><span>MW</span><strong>มงคลเวลา</strong><small>ระบบจัดการเนื้อหา</small></a>
      <div class="mw-admin-header-actions">
        <span id="adminStatus" class="mw-admin-status">พร้อมใช้งาน</span>
        <button class="mw-admin-btn" type="button" data-action="preview">เปิดเว็บ</button>
        <button class="mw-admin-btn" type="button" data-action="save-draft">บันทึกฉบับร่าง</button>
        <button class="mw-admin-btn mw-admin-btn-primary" type="button" data-action="publish">${icon("publish")} Publish</button>
      </div>
    </header>
    <div id="adminPublishProgress" class="mw-admin-publish-progress" role="status" aria-live="polite" hidden>
      <div class="mw-admin-publish-progress-head">
        <strong data-publish-progress-title>กำลัง publish</strong>
        <span data-publish-progress-value>0%</span>
      </div>
      <div class="mw-admin-publish-progress-track"><i data-publish-progress-bar></i></div>
      <p data-publish-progress-detail>กำลังเตรียมข้อมูล</p>
    </div>
    <nav class="mw-admin-nav" id="adminNav" aria-label="Admin navigation"></nav>
    <main class="mw-admin-main">
      <header class="mw-admin-top">
        <div><p>ระบบจัดการเว็บ</p><h1 id="adminTitle">ภาพรวม</h1></div>
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

function navButton(id, label, iconName) {
  return `<button type="button" class="${state.section === id ? "is-active" : ""}" data-section="${id}">
    <span>${icon(iconName)}</span><strong>${escapeHtml(label)}</strong>
  </button>`;
}

function renderSideNav() {
  $("#adminNav").innerHTML = [
    `<button class="mw-admin-nav-toggle" type="button" data-action="toggle-sidebar" aria-expanded="${String(!state.sidebarCollapsed)}" title="${state.sidebarCollapsed ? "ขยายเมนู" : "พับเมนู"}"><span>${state.sidebarCollapsed ? "→" : "←"}</span><strong>${state.sidebarCollapsed ? "ขยายเมนู" : "พับเมนู"}</strong></button>`,
    navButton("dashboard", "ภาพรวม", "dashboard"),
    navButton("pages", "หน้าและเนื้อหา", "page"),
    navButton("temples", "สถานที่ศักดิ์สิทธิ์", "component"),
    navButton("sections", "ส่วนหน้าเว็บ", "section"),
    navButton("navigation", "เมนูเว็บไซต์", "nav"),
    navButton("components", "ชิ้นส่วนเนื้อหา", "component"),
    navButton("analytics", "สถิติ", "chart"),
    `<button class="mw-admin-nav-logout" type="button" data-action="logout"><span>↩</span><strong>ออกจากระบบ</strong></button>`,
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

function renderLogin() {
  $("#adminApp").innerHTML = `<main class="mw-admin-login">
    <form class="mw-admin-login-card" id="loginForm">
      <span class="mw-admin-login-mark">MW</span>
      <h1>ระบบจัดการเว็บ</h1>
      <p>แก้หน้าเว็บ เนื้อหา เมนู รูปภาพ และดูสถิติของมงคลเวลา</p>
      <label>ชื่อผู้แก้ไข<input name="actor" autocomplete="username" value="Admin"></label>
      <label>รหัสผ่าน<input name="password" type="password" autocomplete="current-password" placeholder="รหัสผ่านผู้ดูแล" required></label>
      <button class="mw-admin-btn mw-admin-btn-primary" type="submit">เข้าสู่ระบบ</button>
      <small id="loginError"></small>
    </form>
  </main>`;
  $("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api("/api/admin/session", {
        method: "POST",
        body: JSON.stringify({
          actor: form.get("actor"),
          password: form.get("password"),
        }),
      });
      await boot();
    } catch (error) {
      $("#loginError").textContent = error.message;
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
  if (["dashboard", "temples", "analytics"].includes(state.section)) renderAdmin();
  if (!state.dirty) setStatus("พร้อมใช้งาน", "ok");
}

function renderAdmin() {
  renderSideNav();
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
  };
  (renderers[state.section] || renderDashboard)();
}

function setTitle(title) {
  $("#adminTitle").textContent = title;
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
  setTitle("ภาพรวม");
  const content = state.content;
  const summary = dashboardSummary(content);
  const paths = Object.values(state.analytics?.paths || {}).sort((a, b) => b.count - a.count);
  $("#adminContent").innerHTML = `<div class="mw-admin-grid mw-admin-dashboard-stats">
    ${statCard("หน้าเว็บ", summary.pages)}
    ${statCard("ส่วนหน้าเว็บ", summary.sections)}
    ${statCard("สถานที่", summary.temples)}
    ${statCard("รายการเมนู", summary.navItems)}
  </div>
  ${renderPublishingControl(summary)}
  ${renderAnalyticsPanel(paths)}
  <div class="mw-admin-card">
    <div class="mw-admin-card-head"><h2>ทางลัด</h2></div>
    <div class="mw-admin-quick-actions">
      <button class="mw-admin-btn mw-admin-btn-primary" type="button" data-section="pages">จัดการหน้าเว็บ</button>
      <button class="mw-admin-btn" type="button" data-section="sections">จัดการส่วนหน้าเว็บ</button>
      <button class="mw-admin-btn" type="button" data-section="navigation">จัดการเมนู</button>
      <button class="mw-admin-btn" type="button" data-section="components">จัดการชิ้นส่วน</button>
    </div>
  </div>
  <div class="mw-admin-card">
    <div class="mw-admin-card-head"><h2>หน้าเว็บล่าสุด</h2></div>
    <div class="mw-admin-data-table">
      <div class="mw-admin-data-head"><span>หน้าเว็บ</span><span>ชนิด</span><span>สถานะ</span><span>คำสั่ง</span></div>
      ${summary.pagesList.slice(0, 7).map((page) => `<div>
        <strong>${escapeHtml(page.label || page.id)}</strong>
        <span>${escapeHtml(page.kind === "custom" ? "สร้างเอง" : "หน้าหลัก")}</span>
        <span><mark>${page.enabled !== false ? "เปิด" : "ปิด"}</mark></span>
        <button class="mw-admin-btn mw-admin-btn-sm" type="button" data-section="pages" data-page-jump="${escapeHtml(page.id)}">แก้ไข</button>
      </div>`).join("")}
    </div>
  </div>`;
}

function statCard(label, value) {
  return `<article class="mw-admin-stat"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></article>`;
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
  setTitle("หน้าและเนื้อหา");
  const page = currentPage();
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
  </article>`;
}

function templeRecords() {
  state.content.temples ||= {};
  state.content.temples.records ||= {};
  return state.content.temples.records;
}

function templeOrders() {
  state.content.temples ||= {};
  state.content.temples.order ||= {};
  return state.content.temples.order;
}

function currentTempleRecord() {
  const visibleCatalog = filteredTempleCatalog();
  if (!state.selectedTempleKey) state.selectedTempleKey = visibleCatalog[0]?.key || "";
  return state.templeCatalog.find((item) => item.key === state.selectedTempleKey) || visibleCatalog[0] || null;
}

function currentTempleEdit({ create = true } = {}) {
  const record = currentTempleRecord();
  if (!record) return null;
  const records = templeRecords();
  if (!create) return records[record.key] || null;
  records[record.key] ||= {
    key: record.key,
    collection: record.collection,
    slug: record.slug,
    source: record.source || "dataset",
    status: "active",
    fields: {},
    images: {},
  };
  return records[record.key];
}

function templeValue(record, edit, field) {
  return edit?.fields?.[field] ?? record?.temple?.[field] ?? "";
}

function filteredTempleCatalog() {
  const query = normalizeAdminSearch(state.templeSearch);
  return state.templeCatalog.filter((item) => {
    if (item.collection !== state.templeCollectionFilter) return false;
    if (!query) return true;
    return normalizeAdminSearch(`${item.temple.name} ${item.temple.province} ${item.temple.district}`).includes(query);
  });
}

function normalizeAdminSearch(value = "") {
  return String(value).trim().toLocaleLowerCase("th").normalize("NFC");
}

function renderTemples({ rememberScroll = true } = {}) {
  if (rememberScroll) rememberTempleListScroll();
  setTitle("สถานที่ศักดิ์สิทธิ์");
  const collection = TEMPLE_COLLECTIONS.find((item) => item.key === state.templeCollectionFilter) || TEMPLE_COLLECTIONS[0];
  const visible = filteredTempleCatalog();
  const record = currentTempleRecord();
  const edit = currentTempleEdit({ create: false });
  const recordCount = Object.keys(templeRecords()).length;

  $("#adminContent").innerHTML = `
    <div class="mw-admin-temple-tabs" role="tablist" aria-label="หมวดสถานที่">
      ${TEMPLE_COLLECTIONS.map((item) => {
        const count = state.templeCatalog.filter((temple) => temple.collection === item.key).length;
        return `<button type="button" role="tab" aria-selected="${item.key === state.templeCollectionFilter}" class="${item.key === state.templeCollectionFilter ? "is-active" : ""}" data-temple-collection="${item.key}">
          <strong>${escapeHtml(item.label)}</strong><span>${count.toLocaleString("th-TH")}</span>
        </button>`;
      }).join("")}
    </div>
    <div class="mw-admin-temple-summary">
      <div><p>จัดการสถานที่</p><h2>${escapeHtml(collection.label)}</h2></div>
      <div>
        <span>${visible.length.toLocaleString("th-TH")} สถานที่</span>
        <span>${recordCount.toLocaleString("th-TH")} รายการที่แก้จาก Admin</span>
        <button class="mw-admin-btn mw-admin-btn-primary" type="button" data-action="add-temple">+ เพิ่มสถานที่</button>
      </div>
    </div>
    <div class="mw-admin-temple-workspace">
      <aside class="mw-admin-temple-list">
        <label class="mw-admin-temple-search">
          <span>ค้นหา</span>
          <input type="search" value="${escapeHtml(state.templeSearch)}" placeholder="ชื่อสถานที่ จังหวัด หรือเขต" data-temple-search>
        </label>
        <div class="mw-admin-temple-list-scroll">
          ${visible.map((item) => renderTempleListItem(item)).join("") || empty("ไม่พบสถานที่")}
        </div>
      </aside>
      <section class="mw-admin-temple-editor">
        ${record ? renderTempleEditor(record, edit) : renderTempleEmptyState()}
      </section>
    </div>`;
  restoreTempleListScroll();
}

function renderTempleListItem(record) {
  const image = templeImageValue(record, templeRecords()[record.key], "card", "desktop");
  const reorderDisabled = Boolean(state.templeSearch);
  const collectionItems = collectionTemples(record.collection);
  const collectionIndex = collectionItems.findIndex((item) => item.key === record.key);
  const isActive = record.key === state.selectedTempleKey;
  const disableMoveUp = reorderDisabled || collectionIndex <= 0;
  const disableMoveDown = reorderDisabled || collectionIndex < 0 || collectionIndex >= collectionItems.length - 1;
  return `<div class="mw-admin-temple-list-item ${record.key === state.selectedTempleKey ? "is-active" : ""}" data-temple-row="${escapeHtml(record.key)}">
    ${isActive ? `<span class="mw-admin-temple-move-controls" aria-label="เลื่อนอันดับ ${escapeHtml(record.temple.name || "สถานที่")}">
      <button type="button" data-temple-move-key="${escapeHtml(record.key)}" data-temple-move-offset="-1" aria-label="เลื่อนขึ้นหนึ่งอันดับ" title="${reorderDisabled ? "ล้างคำค้นหาเพื่อจัดลำดับ" : "เลื่อนขึ้นหนึ่งอันดับ"}" ${disableMoveUp ? "disabled" : ""}>↑</button>
      <button type="button" data-temple-move-key="${escapeHtml(record.key)}" data-temple-move-offset="1" aria-label="เลื่อนลงหนึ่งอันดับ" title="${reorderDisabled ? "ล้างคำค้นหาเพื่อจัดลำดับ" : "เลื่อนลงหนึ่งอันดับ"}" ${disableMoveDown ? "disabled" : ""}>↓</button>
    </span>` : ""}
    <button type="button" class="mw-admin-temple-list-select" data-select-temple="${escapeHtml(record.key)}">
      <span class="mw-admin-temple-list-thumb">${image ? `<img src="${escapeHtml(image)}" alt="" data-admin-temple-image>` : "<i>ไม่มีรูป</i>"}</span>
      <span><strong data-temple-list-title>#${escapeHtml(record.temple.rank || "-")} ${escapeHtml(record.temple.name || "ยังไม่มีชื่อ")}</strong><small>${escapeHtml([record.temple.province, record.temple.district].filter(Boolean).join(" / ") || "ยังไม่มีที่ตั้ง")}</small></span>
      ${record.source === "admin" ? '<b>ใหม่</b>' : ""}
    </button>
    <button type="button" class="mw-admin-temple-drag-handle" draggable="${reorderDisabled ? "false" : "true"}" data-temple-drag-key="${escapeHtml(record.key)}" aria-label="จัดลำดับ ${escapeHtml(record.temple.name || "สถานที่")}" title="${reorderDisabled ? "ล้างคำค้นหาเพื่อจัดลำดับ" : "ลากเพื่อจัดลำดับ ใช้ปุ่มลูกศรขึ้นลงบนคีย์บอร์ดได้"}" ${reorderDisabled ? "disabled" : ""}>⋮⋮</button>
  </div>`;
}

function renderTempleEmptyState() {
  return `<div class="mw-admin-temple-empty">
    <strong>ยังไม่มีสถานที่ในหมวดนี้</strong>
    <p>เริ่มสร้างสถานที่แรก แล้วเพิ่มรูปสำหรับหน้ารายการ แบนเนอร์ และแผนที่ได้ทันที</p>
    <button class="mw-admin-btn mw-admin-btn-primary" type="button" data-action="add-temple">+ เพิ่มสถานที่</button>
  </div>`;
}

function renderTempleEditor(record, edit) {
  const provider = state.media.provider
    ? "พร้อมอัปโหลดรูปเข้าระบบ"
    : "ยังไม่ได้ตั้งค่าระบบอัปโหลดรูป";
  const templeLocation = [record.temple.province, record.temple.district].filter(Boolean).join(" / ") || "ยังไม่มีที่ตั้ง";
  return `<div class="mw-admin-temple-editor-head">
    <div>
      <p data-temple-editor-rank>${escapeHtml(record.collectionLabel)} · #${escapeHtml(record.temple.rank || "-")}</p>
      <h2 data-temple-editor-name>${escapeHtml(templeValue(record, edit, "name") || "สถานที่ใหม่")}</h2>
      <small>${escapeHtml(templeLocation)}</small>
    </div>
    <div>
      <a class="mw-admin-btn" target="_blank" rel="noopener" href="${escapeHtml(record.detailUrl)}">เปิดหน้าจริง</a>
      ${record.source === "admin"
        ? '<button class="mw-admin-btn mw-admin-btn-danger" type="button" data-action="delete-temple">ลบสถานที่</button>'
        : '<button class="mw-admin-btn mw-admin-btn-danger" type="button" data-action="delete-temple">นำออกจากหมวด</button>'}
    </div>
  </div>
  <div class="mw-admin-temple-section">
    <div class="mw-admin-temple-section-head"><div><span>01</span><h3>ข้อมูลสถานที่</h3></div><p>ข้อมูลส่วนอื่นจะเพิ่มในเฟสถัดไป</p></div>
    <div class="mw-admin-form-grid mw-admin-form-grid--single">
      <label>ชื่อสถานที่<input data-temple-field="name" value="${escapeHtml(templeValue(record, edit, "name"))}" required></label>
    </div>
  </div>
  <div class="mw-admin-temple-section">
    <div class="mw-admin-temple-section-head">
      <div><span>02</span><h3>รูปภาพ</h3></div>
      <p class="${state.media.provider ? "is-ready" : "is-warning"}">${escapeHtml(provider)}</p>
    </div>
    <p class="mw-admin-temple-media-note">แต่ละตำแหน่งแยกเดสก์ท็อปและมือถือ เพื่อเลือกจุดครอปที่เหมาะกับหน้าจอจริง รูปแผนที่จะใช้รูปหน้ารายการเป็นค่าเริ่มต้นถ้ายังไม่ได้กำหนด</p>
    <div class="mw-admin-temple-image-groups">
      ${TEMPLE_IMAGE_FIELDS.map((field) => renderTempleImageGroup(record, edit, field)).join("")}
    </div>
  </div>`;
}

function renderTempleImageGroup(record, edit, field) {
  return `<section class="mw-admin-temple-image-group">
    <header><div><h4>${escapeHtml(field.label)}</h4><span>${escapeHtml(field.ratioLabel)}</span></div><small>${field.role === "card" ? "หน้ารายการ" : field.role === "hero" ? "หน้ารายละเอียด" : "เมื่อเลือกหมุดแผนที่"}</small></header>
    <div class="mw-admin-temple-image-variants">
      ${renderTempleImageField(record, edit, field, "desktop", "เดสก์ท็อปและแท็บเล็ต")}
      ${renderTempleImageField(record, edit, field, "mobile", "มือถือ")}
    </div>
  </section>`;
}

function renderTempleImageField(record, edit, field, viewport, label) {
  const url = templeImageValue(record, edit, field.role, viewport);
  const inputId = `temple-image-${field.role}-${viewport}`;
  return `<div class="mw-admin-image-field" data-image-role="${field.role}" data-image-viewport="${viewport}" data-image-ratio="${field.ratio}">
    <div class="mw-admin-image-field-head"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(field.ratioLabel)}</span></div>
    <div class="mw-admin-image-preview" style="aspect-ratio:${field.ratio}">
      ${url ? `<img src="${escapeHtml(url)}" alt="" data-admin-temple-image>` : `<span>ยังไม่มีรูป</span>`}
    </div>
    <div class="mw-admin-image-url-row">
      <input id="${inputId}" type="url" value="${escapeHtml(url)}" placeholder="วางลิงก์รูปภาพ HTTPS" data-image-url>
      <button class="mw-admin-btn mw-admin-btn-sm" type="button" data-action="use-temple-image-url">ใช้ลิงก์</button>
    </div>
    <div class="mw-admin-image-actions">
      <label class="mw-admin-btn mw-admin-btn-sm">อัปโหลด<input type="file" accept="image/*" data-temple-image-upload hidden></label>
      <button class="mw-admin-btn mw-admin-btn-sm" type="button" data-action="crop-temple-image" ${url ? "" : "disabled"}>ครอปรูป</button>
      <button class="mw-admin-btn mw-admin-btn-sm" type="button" data-action="reuse-temple-image">ใช้รูปเดิม</button>
      <button class="mw-admin-btn mw-admin-btn-sm mw-admin-btn-danger" type="button" data-action="clear-temple-image" ${url ? "" : "disabled"}>ลบรูป</button>
    </div>
  </div>`;
}

function templeImageValue(record, edit, role, viewport) {
  return (
    edit?.images?.[role]?.[viewport]?.url ??
    record?.temple?.images?.[role]?.[viewport]?.url ??
    (viewport === "mobile"
      ? edit?.images?.[role]?.desktop?.url ?? record?.temple?.images?.[role]?.desktop?.url
      : "") ??
    record?.temple?.imageUrl ??
    ""
  );
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
  setTitle("ส่วนหน้าเว็บ");
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
  setTitle("เมนูเว็บไซต์");
  const nav = ensureNavigation();
  $("#adminContent").innerHTML = `<div class="mw-admin-card">
    <div class="mw-admin-card-head"><h2>เมนูหลัก</h2><button class="mw-admin-btn" type="button" data-action="add-nav-tab">เพิ่มเมนูหลัก</button></div>
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

function renderAnalytics() {
  setTitle("สถิติ");
  const paths = Object.values(state.analytics?.paths || {}).sort((a, b) => b.count - a.count);
  $("#adminContent").innerHTML = renderAnalyticsPanel(paths);
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
  if (DELETE_ACTIONS.has(action)) {
    showDeleteConfirm(actionButton, actions[action]);
    return;
  }
  actions[action]?.(actionButton);
}

function deleteConfirmMessage(button) {
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
  const target = event.target;
  if (target.matches("[data-field='selectedPage']")) {
    state.selectedPageId = target.value;
    renderAdmin();
    return;
  }
  if (target.matches("[data-temple-search]")) {
    state.templeSearch = target.value;
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

async function publish() {
  if (state.publishing) return;
  state.publishing = true;
  setPublishControlsDisabled(true);
  try {
    setStatus("กำลัง publish...", "info");
    setPublishProgress(8, "กำลังส่งข้อมูล", "กำลังบันทึกข้อมูลใหม่");
    const payload = await api("/api/admin/content", {
      method: "POST",
      body: JSON.stringify({ content: state.content }),
    });
    setPublishProgress(
      payload.meta?.fast ? 52 : 42,
      "บันทึก publish แล้ว",
      payload.meta?.fast ? "กำลังตรวจว่า visitor อ่านข้อมูลใหม่ได้แล้ว" : "กำลังตรวจข้อมูล live",
    );
    state.content = payload.content;
    const verifiedContent = await waitForPublishedContent(payload.content);
    state.content = verifiedContent;
    state.dirty = false;
    setPublishProgress(100, "หน้าเว็บอัปเดตแล้ว", "visitor จะเห็นข้อมูลเวอร์ชันล่าสุดเมื่อเปิดหรือรีโหลดหน้า");
    setStatus("เผยแพร่แล้ว", "ok");
    renderAdmin();
    setPublishControlsDisabled(true);
    setTimeout(() => {
      hidePublishProgress();
      if (!state.publishing) setPublishControlsDisabled(false);
    }, 2400);
  } catch (error) {
    setStatus(error.message, "error");
    setPublishProgress(100, "Publish มีปัญหา", error.message);
  } finally {
    state.publishing = false;
    setPublishControlsDisabled(false);
  }
}

async function logout() {
  await api("/api/admin/session", { method: "DELETE" }).catch(() => {});
  renderLogin();
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
  markDirty();
  renderTemples();
  requestAnimationFrame(() => $("[data-temple-field='name']")?.select());
}

function deleteTemple() {
  const record = currentTempleRecord();
  if (!record) return;
  const message = record.source === "admin"
    ? `ลบ “${record.temple.name}” ออกจากระบบ?`
    : `นำ “${record.temple.name}” ออกจากหมวดนี้? ข้อมูลต้นฉบับจะไม่ถูกแก้ไข`;
  if (!confirm(message)) return;
  const edit = currentTempleEdit();
  edit.status = "deleted";
  state.templeCatalog = state.templeCatalog.filter((item) => item.key !== record.key);
  persistTempleOrder(record.collection, collectionTemples(record.collection));
  state.selectedTempleKey = state.templeCatalog.find((item) => item.collection === state.templeCollectionFilter)?.key || "";
  markDirty();
  renderTemples();
}

function imageFieldFromButton(button) {
  const root = button.closest("[data-image-role][data-image-viewport]");
  if (!root) return null;
  return {
    root,
    role: root.dataset.imageRole,
    viewport: root.dataset.imageViewport,
    ratio: Number(root.dataset.imageRatio) || 1,
  };
}

function setTempleImage(role, viewport, url, metadata = {}) {
  const edit = currentTempleEdit();
  const catalogRecord = currentTempleRecord();
  if (!edit || !catalogRecord) return;
  edit.images ||= {};
  edit.images[role] ||= {};
  edit.images[role][viewport] = { ...(edit.images[role][viewport] || {}), ...metadata, url };
  catalogRecord.temple.images ||= {};
  catalogRecord.temple.images[role] ||= {};
  catalogRecord.temple.images[role][viewport] = { ...(catalogRecord.temple.images[role][viewport] || {}), ...metadata, url };
  if (role === "card" && viewport === "desktop") catalogRecord.temple.imageUrl = url;
  markDirty();
}

async function useTempleImageUrl(button) {
  const field = imageFieldFromButton(button);
  if (!field) return;
  const input = field.root.querySelector("[data-image-url]");
  const sourceUrl = String(input?.value || "").trim();
  if (!/^https:\/\//iu.test(sourceUrl)) {
    setStatus("กรุณาใช้ HTTPS image URL", "error");
    input?.focus();
    return;
  }
  try {
    setStatus(state.media.provider ? "กำลังตรวจสอบและนำรูปเข้าระบบ..." : "กำลังตรวจสอบลิงก์รูปภาพ...", "info");
    await verifyImageLoads(sourceUrl);
    const result = state.media.provider ? await uploadAdminMedia(sourceUrl, templeImageFilename(field)) : sourceUrl;
    setTempleImage(field.role, field.viewport, result, {
      originalUrl: sourceUrl,
      provider: detectImageProvider(result),
    });
    setStatus("เพิ่มรูปแล้ว กดครอปรูปเพื่อปรับจุดภาพได้", "ok");
    renderTemples();
  } catch (error) {
    field.root.classList.add("is-error");
    setStatus(`ยังไม่บันทึกรูป: ${error.message}`, "error");
  }
}

function verifyImageLoads(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(url);
    image.onerror = () => reject(new Error("URL นี้เปิดเป็นรูปภาพไม่ได้ กรุณาตรวจสอบลิงก์"));
    image.src = url;
  });
}

function cropTempleImage(button) {
  const field = imageFieldFromButton(button);
  if (!field) return;
  const sourceUrl = field.root.querySelector("[data-image-url]")?.value || templeImageValue(currentTempleRecord(), currentTempleEdit({ create: false }), field.role, field.viewport);
  if (!sourceUrl) return;
  openTempleCropper(sourceUrl, field);
}

function reuseTempleImage(button) {
  const field = imageFieldFromButton(button);
  const record = currentTempleRecord();
  const edit = currentTempleEdit({ create: false });
  if (!field || !record) return;
  const candidates = [
    templeImageValue(record, edit, field.role, field.viewport === "mobile" ? "desktop" : "mobile"),
    templeImageValue(record, edit, "card", "desktop"),
    record.temple.imageUrl,
  ].filter(Boolean);
  if (!candidates.length) {
    setStatus("ยังไม่มีรูปต้นทางให้ใช้ซ้ำ", "warn");
    return;
  }
  setTempleImage(field.role, field.viewport, candidates[0], { provider: detectImageProvider(candidates[0]) });
  setStatus("ใช้รูปเดิมแล้ว สามารถครอปแยกสำหรับช่องนี้ได้", "ok");
  renderTemples();
}

function clearTempleImage(button) {
  const field = imageFieldFromButton(button);
  const edit = currentTempleEdit();
  if (!field || !edit) return;
  edit.images ||= {};
  edit.images[field.role] ||= {};
  edit.images[field.role][field.viewport] = { url: "" };
  const record = currentTempleRecord();
  if (record?.temple?.images?.[field.role]) record.temple.images[field.role][field.viewport] = { url: "" };
  markDirty();
  renderTemples();
}

function handleTempleImageUpload(input) {
  const field = imageFieldFromButton(input);
  const file = input.files?.[0];
  if (!field || !file) return;
  if (!file.type.startsWith("image/")) {
    setStatus("ไฟล์ที่เลือกไม่ใช่รูปภาพ", "error");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => openTempleCropper(String(reader.result || ""), { ...field, fileName: file.name });
  reader.onerror = () => setStatus("อ่านไฟล์รูปไม่สำเร็จ", "error");
  reader.readAsDataURL(file);
}

function templeImageFilename(field) {
  const record = currentTempleRecord();
  const safeName = String(record?.temple?.name || "temple")
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return `${safeName || "temple"}-${field.role}-${field.viewport}.jpg`;
}

function detectImageProvider(url = "") {
  if (/res\.cloudinary\.com/iu.test(url)) return "cloudinary";
  if (/ik\.imagekit\.io/iu.test(url) || /imagekit\.io/iu.test(url)) return "imagekit";
  if (/wikimedia\.org|wikipedia\.org/iu.test(url)) return "wikimedia";
  return "external";
}

async function uploadAdminMedia(fileValue, fileName) {
  if (state.media.provider === "cloudinary" && state.media.cloudinary?.enabled) {
    const form = new FormData();
    form.append("file", fileValue);
    form.append("upload_preset", state.media.cloudinary.uploadPreset);
    form.append("folder", "mongkolwela/temples");
    form.append("context", `source=admin_portal|temple=${currentTempleRecord()?.key || ""}`);
    const response = await fetch(`https://api.cloudinary.com/v1_1/${state.media.cloudinary.cloudName}/image/upload`, {
      method: "POST",
      body: form,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.secure_url) throw new Error("อัปโหลดรูปไม่สำเร็จ");
    return payload.secure_url;
  }
  if (state.media.provider === "imagekit" && state.media.imagekit?.enabled) {
    const auth = await api("/api/admin/media", {
      method: "POST",
      body: JSON.stringify({ action: "imagekit-auth" }),
    });
    const form = new FormData();
    form.append("file", fileValue);
    form.append("fileName", fileName || "temple-image.jpg");
    form.append("folder", "/mongkolwela/temples");
    form.append("useUniqueFileName", "true");
    form.append("publicKey", auth.authentication.publicKey);
    form.append("signature", auth.authentication.signature);
    form.append("expire", String(auth.authentication.expire));
    form.append("token", auth.authentication.token);
    const response = await fetch("https://upload.imagekit.io/api/v1/files/upload", { method: "POST", body: form });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.url) throw new Error("อัปโหลดรูปไม่สำเร็จ");
    return payload.url;
  }
  throw new Error("ยังไม่ได้ตั้งค่าระบบอัปโหลดรูป");
}

let templeCropState = null;

function openTempleCropper(src, field) {
  let overlay = $("#templeCropOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "templeCropOverlay";
    overlay.className = "mw-admin-crop-overlay";
    document.body.appendChild(overlay);
  }
  const fieldLabel = TEMPLE_IMAGE_FIELDS.find((item) => item.role === field.role);
  overlay.innerHTML = `<div class="mw-admin-crop-modal" role="dialog" aria-modal="true" aria-labelledby="templeCropTitle">
    <header><div><span>${escapeHtml(field.viewport === "mobile" ? "มือถือ" : "เดสก์ท็อปและแท็บเล็ต")}</span><h2 id="templeCropTitle">ครอปรูป ${escapeHtml(fieldLabel?.label || "รูปภาพ")} · ${escapeHtml(fieldLabel?.ratioLabel || "")}</h2></div><button type="button" data-crop-close aria-label="ปิด">×</button></header>
    <div class="mw-admin-crop-stage">
      <div class="mw-admin-crop-wrap" data-crop-wrap>
        <img ${/^data:/iu.test(src) ? "" : 'crossorigin="anonymous"'} src="${escapeHtml(src)}" alt="" data-crop-image>
        <div class="mw-admin-crop-selection" data-crop-selection><i data-crop-handle="nw"></i><i data-crop-handle="ne"></i><i data-crop-handle="sw"></i><i data-crop-handle="se"></i></div>
      </div>
    </div>
    <footer><p>ลากกรอบเพื่อเลือกภาพ ระบบจะบันทึกเป็น JPEG ตามสัดส่วนที่กำหนด</p><div><button class="mw-admin-btn" type="button" data-crop-close>ยกเลิก</button><button class="mw-admin-btn mw-admin-btn-primary" type="button" data-crop-apply>ครอปและบันทึก</button></div></footer>
  </div>`;
  overlay.classList.add("is-open");
  overlay.querySelectorAll("[data-crop-close]").forEach((button) => button.addEventListener("click", closeTempleCropper));
  overlay.querySelector("[data-crop-apply]")?.addEventListener("click", applyTempleCrop);
  const image = overlay.querySelector("[data-crop-image]");
  image.addEventListener("load", () => initializeTempleCrop(field, src));
  image.addEventListener("error", () => setStatus("โหลดรูปเพื่อครอปไม่สำเร็จ ลองอัปโหลดใหม่", "error"));
  if (image.complete && image.naturalWidth) initializeTempleCrop(field, src);
}

function initializeTempleCrop(field, src) {
  const overlay = $("#templeCropOverlay");
  const image = overlay?.querySelector("[data-crop-image]");
  const selection = overlay?.querySelector("[data-crop-selection]");
  if (!image || !selection) return;
  const width = image.clientWidth;
  const height = image.clientHeight;
  let cropWidth;
  let cropHeight;
  if (width / height > field.ratio) {
    cropHeight = height;
    cropWidth = cropHeight * field.ratio;
  } else {
    cropWidth = width;
    cropHeight = cropWidth / field.ratio;
  }
  templeCropState = {
    ...field,
    src,
    image,
    selection,
    displayWidth: width,
    displayHeight: height,
    x: (width - cropWidth) / 2,
    y: (height - cropHeight) / 2,
    width: cropWidth,
    height: cropHeight,
  };
  updateTempleCropSelection();
  bindTempleCropPointerEvents();
}

function bindTempleCropPointerEvents() {
  const state = templeCropState;
  if (!state) return;
  state.selection.onpointerdown = (event) => {
    event.preventDefault();
    const handle = event.target.dataset.cropHandle || "";
    const start = { x: event.clientX, y: event.clientY, ...pickCropBox(state) };
    state.selection.setPointerCapture?.(event.pointerId);
    const move = (moveEvent) => {
      const dx = moveEvent.clientX - start.x;
      const dy = moveEvent.clientY - start.y;
      if (!handle) moveTempleCrop(start, dx, dy);
      else resizeTempleCrop(handle, start, dx, dy);
      updateTempleCropSelection();
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
}

function pickCropBox(state) {
  return { cropX: state.x, cropY: state.y, cropWidth: state.width, cropHeight: state.height };
}

function moveTempleCrop(start, dx, dy) {
  const state = templeCropState;
  state.x = Math.max(0, Math.min(start.cropX + dx, state.displayWidth - state.width));
  state.y = Math.max(0, Math.min(start.cropY + dy, state.displayHeight - state.height));
}

function resizeTempleCrop(handle, start, dx, dy) {
  const state = templeCropState;
  const fromLeft = handle.includes("w");
  const fromTop = handle.includes("n");
  const anchorX = fromLeft ? start.cropX + start.cropWidth : start.cropX;
  const anchorY = fromTop ? start.cropY + start.cropHeight : start.cropY;
  let width = Math.max(60, fromLeft ? start.cropWidth - dx : start.cropWidth + dx);
  let height = width / state.ratio;
  if (height > state.displayHeight) {
    height = state.displayHeight;
    width = height * state.ratio;
  }
  let x = fromLeft ? anchorX - width : anchorX;
  let y = fromTop ? anchorY - height : anchorY;
  if (x < 0) {
    x = 0;
    width = anchorX;
    height = width / state.ratio;
    y = fromTop ? anchorY - height : anchorY;
  }
  if (y < 0) {
    y = 0;
    height = anchorY;
    width = height * state.ratio;
    x = fromLeft ? anchorX - width : anchorX;
  }
  if (x + width > state.displayWidth) {
    width = state.displayWidth - x;
    height = width / state.ratio;
  }
  if (y + height > state.displayHeight) {
    height = state.displayHeight - y;
    width = height * state.ratio;
    x = fromLeft ? anchorX - width : anchorX;
  }
  state.x = Math.max(0, x);
  state.y = Math.max(0, y);
  state.width = Math.max(1, width);
  state.height = Math.max(1, height);
}

function updateTempleCropSelection() {
  const state = templeCropState;
  if (!state) return;
  Object.assign(state.selection.style, {
    left: `${state.x}px`,
    top: `${state.y}px`,
    width: `${state.width}px`,
    height: `${state.height}px`,
  });
}

async function applyTempleCrop() {
  const state = templeCropState;
  if (!state) return;
  const button = $("#templeCropOverlay [data-crop-apply]");
  try {
    button.disabled = true;
    button.textContent = "กำลังบันทึก...";
    const scaleX = state.image.naturalWidth / state.displayWidth;
    const scaleY = state.image.naturalHeight / state.displayHeight;
    const outputWidth = Math.min(state.viewport === "mobile" ? 1080 : 1600, Math.round(state.width * scaleX));
    const outputHeight = Math.round(outputWidth / state.ratio);
    const canvas = document.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const context = canvas.getContext("2d");
    context.drawImage(
      state.image,
      state.x * scaleX,
      state.y * scaleY,
      state.width * scaleX,
      state.height * scaleY,
      0,
      0,
      outputWidth,
      outputHeight,
    );
    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    const url = await uploadAdminMedia(dataUrl, state.fileName || templeImageFilename(state));
    setTempleImage(state.role, state.viewport, url, {
      originalUrl: state.src,
      provider: detectImageProvider(url),
      width: outputWidth,
      height: outputHeight,
    });
    closeTempleCropper();
    setStatus("ครอปและบันทึกรูปแล้ว", "ok");
    renderTemples();
  } catch (error) {
    button.disabled = false;
    button.textContent = "ครอปและบันทึก";
    setStatus(`บันทึกรูปไม่สำเร็จ: ${error.message}`, "error");
  }
}

function closeTempleCropper() {
  $("#templeCropOverlay")?.classList.remove("is-open");
  templeCropState = null;
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
  if (!state.dirty) return;
  event.preventDefault();
  event.returnValue = "";
});

boot();
