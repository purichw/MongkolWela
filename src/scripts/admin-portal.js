import { applyImageFallback } from "../lib/image-placeholder.js";
import { createAdminPublishing } from "./admin/publishing.js";
import { createContentLibrary } from "./admin/content-library.js";
import { createPageContentEditor } from "./admin/page-content.js";
import { createNavigationEditor } from "./admin/navigation-editor.js";
import { createCommerceEditor } from "./admin/commerce.js";
import { initPublicSelects } from "./public-select.js";
import { updateVisitContent } from "./admin/visit-content.js";
import { createActivityEditor } from "./admin/activities.js";
import { createAdminMedia } from "./admin/media.js";
import { createMediaLibrary } from "./admin/media-library.js";
import { createAdminAnalytics } from "./admin/analytics.js";
import { createTempleEditor } from "./admin/editor.js";
import { requestJson } from "./request.js";
import { settlePageContent } from "./page-content-ready.js";
import { initPageLoader } from "./page-loader.js";
import { adminIcon, createAdminDesign } from "./admin/design.js";
import { catalogTaxonomy, mediaProviderStatus } from "./admin/data.js";
const state = {
  content: null,
  baseRevision: "",
  selectedPageId: "home",
  section: ["commerce", "analytics"].includes(new URLSearchParams(location.search).get("section")) ? new URLSearchParams(location.search).get("section") : "dashboard",
  sidebarCollapsed: readStoredFlag("mongkolwela.admin.sidebarCollapsed"),
  mobileNavOpen: false,
  dirty: false,
  session: null,
  analytics: null,
  templeLoadError: false,
  mediaLoadError: false,
  templeCatalog: [],
  publishedTempleRecords: {},
  publishedTempleKeys: new Set(),
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
  { key: "popular", label: "วัดดังน่าไป" },
  { key: "mu", label: "พิกัดสายมู" },
  { key: "sacred", label: "วัดเด่นขอพร" },
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
// Reuse the server-rendered pending screen on each session check, including sign-in.
const authPendingScreen = $("[data-admin-auth-pending]").cloneNode(true);

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
    <div><strong>${escapeHtml(brand.name)}</strong><small>MONGKOL WELA</small><small>${escapeHtml(brand.subtitle)}</small></div>
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
  const editorStatus = $("[data-temple-editor-status]");
  if (editorStatus) { editorStatus.textContent = message; editorStatus.dataset.type = type; }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


function markDirty() {
  state.dirty = true;
  setStatus("มีการแก้ไขที่ยังไม่ได้เผยแพร่", "warn");
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
  return adminIcon(name);
}

async function boot() {
  state.session = null;
  $("#adminApp").replaceChildren(authPendingScreen.cloneNode(true));
  try {
    state.secondaryReady = false;
    state.session = await api("/api/admin/session");
    renderAppShell();
    renderSideNav();
    renderAdminLoading("ภาพรวม", "กำลังโหลดข้อมูล", "กำลังเตรียมระบบจัดการเว็บ");
    $(".mw-admin-profile strong").textContent = state.session.email || state.session.actor || "ผู้ดูแลระบบ";
    $(".mw-admin-profile > span").textContent = (state.session.email || "A").charAt(0).toUpperCase();
    setStatus("กำลังโหลดข้อมูลหลัก...", "info");
    await loadContent();
    renderAdmin();
    setStatus("กำลังโหลดข้อมูลเสริม...", "info");
    await loadSecondaryAdminData();
  } catch (error) {
    renderLogin(error.status === 401 ? "" : error.message);
  } finally {
    settlePageContent($("#adminApp"));
  }
}

function renderAppShell() {
  $("#adminApp").innerHTML = `<div class="mw-admin-shell">
    <aside class="mw-admin-sidebar" id="adminSidebar" aria-label="เมนูระบบจัดการ">
      <header class="mw-admin-header">
        ${adminLogoMarkup()}
        <button class="mw-admin-icon-button mw-admin-sidebar-close" type="button" data-action="toggle-sidebar" aria-label="ปิดเมนู">${icon("x")}</button>
      </header>
      <nav class="mw-admin-nav" id="adminNav" aria-label="Admin navigation"></nav>
      <div class="mw-admin-sidebar-foot">
        <button class="mw-admin-btn mw-admin-btn-preview" type="button" data-action="preview" title="เปิดหน้าเว็บไซต์">${icon("external-link")}<span><strong>เปิดหน้าเว็บไซต์</strong><small>ไปยังเว็บไซต์มงคลเวลา</small></span>${icon("arrow-right")}</button>
        <div class="mw-admin-sidebar-art" aria-hidden="true"></div>
        <p class="mw-admin-sidebar-motto">สืบสานศรัทธา<br>เชื่อมผู้คน สู่สิ่งดีงาม</p>
      </div>
    </aside>
    <button type="button" class="mw-admin-nav-backdrop" data-action="toggle-sidebar" aria-label="ปิดเมนู" hidden></button>
    <div id="adminPublishProgress" class="mw-admin-publish-progress" role="status" aria-live="polite" hidden>
      <div class="mw-admin-publish-progress-head">
        <strong data-publish-progress-title>กำลัง publish</strong>
        <span data-publish-progress-value>0%</span>
        <button class="mw-admin-icon-button" type="button" data-action="dismiss-publish-progress" aria-label="ปิดสถานะการเผยแพร่" title="ปิดสถานะการเผยแพร่" hidden>${icon("x")}</button>
      </div>
      <div class="mw-admin-publish-progress-track"><i data-publish-progress-bar></i></div>
      <p data-publish-progress-detail>กำลังเตรียมข้อมูล</p>
    </div>
    <main class="mw-admin-main">
      <div class="mw-admin-commandbar">
        <button class="mw-admin-icon-button mw-admin-nav-toggle" type="button" data-action="toggle-sidebar" aria-controls="adminSidebar" aria-expanded="true" aria-label="พับเมนู" title="พับเมนู">${icon("menu")}</button>
        <div class="mw-admin-global-search">
          ${icon("search")}<input id="adminGlobalSearch" type="search" placeholder="ค้นหาวัด สถานที่ หรือหน้าเว็บ..." aria-label="ค้นหาในระบบจัดการ" aria-controls="adminSearchResults" autocomplete="off">
          <div id="adminSearchResults" class="mw-admin-search-results" role="region" aria-label="ผลการค้นหา" hidden></div>
        </div>
        <details class="mw-admin-account"><summary aria-label="บัญชีผู้ดูแล"><span class="mw-admin-profile"><span>A</span><span><strong>${escapeHtml(state.session?.email || state.session?.actor || "ผู้ดูแลระบบ")}</strong><small>ผู้ดูแลระบบ</small></span></span>${icon("chevron-down")}</summary><div><button type="button" class="mw-admin-btn" data-action="logout">${icon("log-out")}ออกจากระบบ</button></div></details>
      </div>
      <div class="mw-admin-breadcrumb"><span>มงคลเวลา</span>${icon("chevron-right")}<span id="adminKicker">ภาพรวม</span></div>
      <header class="mw-admin-top">
        <div><h1 id="adminTitle">ภาพรวมระบบ</h1><p id="adminDescription"></p></div>
        <div class="mw-admin-header-actions">
          <span id="adminStatus" class="mw-admin-status" role="status" aria-live="polite">กำลังโหลด</span>
          <button class="mw-admin-btn" type="button" data-action="save-draft">${icon("save")}บันทึกฉบับร่าง</button>
          <button class="mw-admin-btn mw-admin-btn-primary" type="button" data-action="publish">${icon("publish")}เผยแพร่</button>
        </div>
      </header>
      <div class="mw-admin-section-tools">
        <div id="adminTopActions" class="mw-admin-top-actions"></div>
      </div>
      <section id="adminContent" class="mw-admin-content"></section>
      <div id="adminDraftNotice" class="mw-admin-draft-notice" role="status" hidden></div>
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
  syncSidebarState();
  initPublicSelects({ root: $(".mw-admin-main"), includeAdmin: true });
  if ($("#adminApp").dataset.eventsBound) return;
  $("#adminApp").dataset.eventsBound = "true";
  $("#adminApp").addEventListener("click", handleGlobalClick);
  $("#adminApp").addEventListener("input", handleInput);
  $("#adminApp").addEventListener("change", handleInput);
  $("#adminApp").addEventListener("submit", event => templeList.submit(event));
  $("#adminApp").addEventListener("error", handleAdminImageError, true);
  $("#adminApp").addEventListener("dragstart", handleTempleDragStart);
  $("#adminApp").addEventListener("dragover", handleTempleDragOver);
  $("#adminApp").addEventListener("drop", handleTempleDrop);
  $("#adminApp").addEventListener("dragend", handleTempleDragEnd);
  $("#adminApp").addEventListener("keydown", handleTempleReorderKeydown);
}

function navButton(id, label, iconName, count = "", legacyLabel = "") {
  return `<button type="button" class="${state.section === id ? "is-active" : ""}" data-section="${id}" title="${escapeHtml(label)}" ${state.section === id ? 'aria-current="page"' : ""}>
    <span>${icon(iconName)}</span><strong>${escapeHtml(label)}${legacyLabel ? `<em>${escapeHtml(legacyLabel)}</em>` : ""}</strong>${count !== "" ? `<b>${escapeHtml(count)}</b>` : ""}
  </button>`;
}

function renderSideNav() {
  const templeCount = state.secondaryReady && !state.templeLoadError ? state.templeCatalog.length : "";
  $("#adminNav").innerHTML = [
    navButton("dashboard", "ภาพรวม", "dashboard"),
    '<p class="mw-admin-nav-group">จัดการข้อมูล</p>',
    navButton("temples", "วัดและสถานที่", "component", templeCount, "สถานที่ศักดิ์สิทธิ์"),
    navButton("collections", "เส้นทาง / คอลเลกชัน", "section", TEMPLE_COLLECTIONS.length),
    navButton("dates", "กิจกรรมและงานบุญ", "dates", ""),
    navButton("commerce", "ร้านค้าและร่วมบุญ", "shopping-bag"),
    navButton("pages", "จัดการหน้าแรก", "page", "", "หน้าและเนื้อหา"),
    navButton("contentLibrary", "คลังคำทำนาย", "book-open"),
    navButton("siteContent", "ส่วนกลางเว็บไซต์", "section"),
    navButton("navigation", "เมนูนำทาง", "nav", "", "เมนูเว็บไซต์"),
    navButton("media", "คลังสื่อ", "media"),
    '<p class="mw-admin-nav-group">ผู้ใช้งาน</p>',
    navButton("analytics", "สถิติการใช้งาน", "chart", "", "สถิติ"),
    navButton("users", "ผู้ดูแล", "users"),
    '<p class="mw-admin-nav-group">ระบบ</p>',
    navButton("settings", "ตั้งค่า / อนุกรมวิธาน", "settings"),
  ].join("");
}

function syncSidebarState() {
  const shell = $(".mw-admin-shell");
  if (!shell) return;
  const mobile = window.matchMedia("(max-width: 900px)").matches;
  shell.classList.toggle("is-sidebar-collapsed", !mobile && state.sidebarCollapsed);
  shell.classList.toggle("is-mobile-nav-open", mobile && state.mobileNavOpen);
  $(".mw-admin-nav-backdrop").hidden = !(mobile && state.mobileNavOpen);
  $(".mw-admin-sidebar").inert = state.templeEditorOpen || (mobile && !state.mobileNavOpen);
  $(".mw-admin-main").inert = mobile && state.mobileNavOpen;
  document.body.classList.toggle("mw-admin-nav-locked", mobile && state.mobileNavOpen);
  const toggle = $(".mw-admin-nav-toggle");
  if (!toggle) return;
  const expanded = mobile ? state.mobileNavOpen : !state.sidebarCollapsed;
  toggle.setAttribute("aria-expanded", String(expanded));
  toggle.setAttribute("aria-label", expanded ? "พับเมนู" : "เปิดเมนู");
  toggle.setAttribute("title", expanded ? "พับเมนู" : "เปิดเมนู");
}

function toggleSidebar() {
  if (window.matchMedia("(max-width: 900px)").matches) {
    state.mobileNavOpen = !state.mobileNavOpen;
    syncSidebarState();
    requestAnimationFrame(() => (state.mobileNavOpen ? $(".mw-admin-sidebar-close") : $(".mw-admin-nav-toggle"))?.focus());
    return;
  }
  state.sidebarCollapsed = !state.sidebarCollapsed;
  writeStoredFlag("mongkolwela.admin.sidebarCollapsed", state.sidebarCollapsed);
  syncSidebarState();
}

function renderLogin(message = "") {
  state.session = null;
  state.mobileNavOpen = false;
  document.body.classList.remove("mw-admin-nav-locked");
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
  state.publishedTempleRecords = structuredClone(payload.content.temples?.records || {});
  state.baseRevision = payload.revision || "";
  ensureNavigation();
  try {
    const saved = JSON.parse(localStorage.getItem("mongkolwela.admin.draft") || "null");
    if (saved && Array.isArray(saved.pages)) {
      const notice = $("#adminDraftNotice");
      notice.hidden = false;
      notice.innerHTML = '<span>มีฉบับร่างที่บันทึกไว้ในเบราว์เซอร์นี้</span><button class="mw-admin-btn" data-action="restore-draft">เปิดฉบับร่าง</button><button class="mw-admin-btn" data-action="dismiss-draft">ซ่อน</button>';
    }
  } catch { /* An invalid local draft must not block the published content. */ }
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
    state.templeLoadError = false;
    state.templeCatalog = payload.temples || [];
    state.publishedTempleKeys = new Set(state.templeCatalog.map(record => record.key));
    const currentExists = state.templeCatalog.some((item) => item.key === state.selectedTempleKey);
    if (!currentExists) {
      state.selectedTempleKey =
        state.templeCatalog.find((item) => item.collection === state.templeCollectionFilter)?.key ||
        state.templeCatalog[0]?.key ||
        "";
    }
  } catch {
    state.templeLoadError = true;
    state.templeCatalog = [];
  }
}

async function loadMediaConfig() {
  try {
    const payload = await api("/api/admin/media");
    state.media = payload.media || state.media;
    state.mediaLoadError = false;
  } catch {
    state.mediaLoadError = true;
    state.media = { provider: "", cloudinary: { enabled: false }, imagekit: { enabled: false } };
  }
}

async function loadSecondaryAdminData() {
  state.secondaryLoading = true;
  await Promise.allSettled([loadTemples(), loadAnalytics(), loadMediaConfig()]);
  state.secondaryReady = true;
  state.secondaryLoading = false;
  if (["dashboard", "temples", "analytics", "collections", "media", "dates", "settings"].includes(state.section)) renderAdmin();
  if (!state.dirty) setStatus(state.templeLoadError || state.mediaLoadError || !state.analytics ? "ข้อมูลบางส่วนโหลดไม่สำเร็จ" : "พร้อมใช้งาน", state.templeLoadError || state.mediaLoadError || !state.analytics ? "warn" : "ok");
}

function renderAdmin() {
  renderSideNav();
  $("#adminTopActions")?.classList.toggle("mw-activity-top-actions", state.section === "dates");
  document.querySelectorAll('[data-action="save-draft"], [data-action="publish"]').forEach((button) => { button.hidden = ["dates", "commerce", "media", "analytics"].includes(state.section); });
  if (!state.content) {
    renderAdminLoading("ภาพรวม", "กำลังโหลดข้อมูล", "กำลังเตรียมข้อมูลหลักสำหรับระบบจัดการเว็บ");
    return;
  }
  if (state.section === "temples" && !state.secondaryReady) {
    renderAdminLoading("สถานที่ศักดิ์สิทธิ์", "กำลังโหลดข้อมูลวัด", "กำลังเตรียมรายการสถานที่ รูปภาพ และการตั้งค่าอัปโหลด");
    return;
  }
  const renderers = {
    dashboard: design.renderDashboard,
    pages: renderPages,
    contentLibrary: contentLibrary.render,
    commerce: commerceEditor.render,
    siteContent: pageContentEditor.render,
    temples: renderTemples,
    sections: renderSections,
    navigation: renderNavigation,
    components: renderComponents,
    analytics: analyticsView.render,
    collections: renderCollections,
    dates: renderDates,
    media: renderMedia,
    users: renderUsers,
    settings: renderSettings,
  };
  (renderers[state.section] || design.renderDashboard)();
}

function setTitle(title, kicker = "ระบบจัดการเว็บ") {
  document.querySelectorAll('[data-action="save-draft"], [data-action="publish"]').forEach(button => { button.hidden = ["dates", "commerce", "media", "analytics"].includes(state.section); });
  $(".mw-admin-main")?.classList.remove("is-home-editor", "is-menu-editor", "is-commerce-editor", "is-temple-list", "has-temple-draft", "is-site-content", "is-activity-view", "is-activity-editing", "is-media-library", "is-analytics", "is-library-editor");
  document.querySelectorAll("[data-site-content-header], [data-activity-header], [data-media-header], [data-analytics-header], [data-library-header]").forEach(node => node.remove());
  $("#adminContent").classList.remove("is-overview");
  $("#adminTitle").textContent = title;
  $("#adminDescription").textContent = "";
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

function toThaiNumber(value) {
  return Number(value || 0).toLocaleString("th-TH");
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
  return {
    total: temples.length,
    high: { count: counts.high },
    mid: { count: counts.mid },
    low: { count: counts.low },
  };
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
    publishedBy: content.publishedBy || "",
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
  const totals = state.analytics?.totals;
  const topPaths = paths.slice(0, 8);
  const pageviews = totals?.pageviews ?? "—";
  const events = totals?.events ?? "—";
  const tracked = paths.length;
  return `<section class="mw-admin-card mw-admin-dashboard-card">
    <div class="mw-admin-card-head">
      <div>
        <h2>สถิติ</h2>
        <p>ข้อมูลภายในตอนนี้ พร้อมต่อ Google Analytics ภายหลัง</p>
      </div>
      <button class="mw-admin-btn mw-admin-btn-sm" type="button" data-action="refresh-analytics">รีเฟรช</button>
    </div>
    <div class="mw-admin-dashboard-metrics mw-admin-dashboard-metrics--six">
      ${miniMetric("—", "ผู้ใช้วันนี้")}
      ${miniMetric("—", "ผู้ใช้ 7 วัน")}
      ${miniMetric("—", "ผู้ใช้ 30 วัน")}
      ${miniMetric(pageviews, "เข้าชมทั้งหมด")}
      ${miniMetric(events, "เหตุการณ์")}
      ${miniMetric(tracked, "หน้าที่ติดตาม")}
    </div>
    <div class="mw-admin-analytics-grid">
      <article class="mw-admin-chart-block mw-admin-chart-block--wide">
        <h3>แนวโน้ม 30 วัน</h3>
        ${empty("ยังไม่มีข้อมูลสถิติรายวัน")}
      </article>
      <article class="mw-admin-chart-block">
        <h3>หน้าเว็บยอดนิยม</h3>
        <div class="mw-admin-bar-chart">
          ${topPaths.map((item) => contentBar(item.path, item.count, Math.max(topPaths[0]?.count || 1, 1))).join("") || empty("ยังไม่มีข้อมูลสถิติ")}
        </div>
      </article>
      <article class="mw-admin-chart-block">
        <h3>แหล่งที่มา</h3>
        ${empty("ยังไม่มีข้อมูลแหล่งที่มา")}
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
  pageContentEditor.render();
}

function renderAdvancedPages() {
  setTitle("หน้าและเนื้อหา", "จัดการหน้าเว็บ");
  const page = currentPage();
  if (!page) { renderNoPages(); return; }
  setTopActions(`<button class="mw-admin-btn mw-admin-btn-primary" type="button" data-action="save-draft">บันทึกการตั้งค่าหน้าเว็บ</button>`);
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

function renderNoPages() {
  $("#adminContent").innerHTML = `<section class="mw-admin-card">${empty("ยังไม่มีหน้าเว็บใน CMS")}<button class="mw-admin-btn mw-admin-btn-primary" type="button" data-action="add-page">เพิ่มหน้า</button></section>`;
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
  if (image.matches("[data-fallback-src]")) {
    applyImageFallback(image);
    return;
  }
  const overview = image.closest(".mw-overview-thumb");
  if (overview) {
    overview.innerHTML = icon("component");
    overview.title = "ยังไม่มีภาพสถานที่ที่โหลดได้";
    return;
  }
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
  if (!page) { renderNoPages(); return; }
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
  navigationEditor.render();
}

function renderLegacyNavigation() {
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
        <span>${icon("section")}</span>
        <div>
          <h2>${escapeHtml(collection.label)}</h2>
          <p>${state.templeLoadError ? "ยังไม่สามารถโหลดรายการสถานที่ได้" : !state.secondaryReady ? "กำลังโหลดรายการสถานที่" : `รวม ${toThaiNumber(items.length)} สถานที่`}</p>
          <div class="mw-admin-chip-row">${items.slice(0, 4).map((item) => `<b>${escapeHtml(item.temple.name)}</b>`).join("") || (!state.templeLoadError && state.secondaryReady ? "<b>ยังไม่มีสถานที่</b>" : "")}</div>
        </div>
        <div class="mw-admin-card-actions">
          <button class="mw-admin-btn" type="button" data-section="temples" data-collection-jump="${collection.key}">เปิดรายการวัด</button>
        </div>
      </article>`;
    }).join("")}
  </div>`;
}

function renderDates() {
  activityEditor.render();
}

function renderMedia() {
  mediaLibrary.render();
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
  const { regions, modes } = catalogTaxonomy(state.templeCatalog);
  const list = (rows) => `<div class="mw-admin-setting-list">${rows.map(row => `<div class="mw-admin-taxonomy-row"><strong>${escapeHtml(row.label)}</strong><span>${toThaiNumber(row.count)} สถานที่</span></div>`).join("") || empty(state.templeLoadError ? "ยังไม่สามารถโหลดข้อมูลสถานที่ได้" : !state.secondaryReady ? "กำลังโหลดข้อมูลสถานที่" : "ยังไม่มีข้อมูลในรายการสถานที่")}</div>`;
  setTopActions(`<button class="mw-admin-btn" type="button" data-action="refresh-admin-data">${adminIcon("rotate-ccw")}โหลดข้อมูลอีกครั้ง</button>`);
  $("#adminContent").innerHTML = `<div class="mw-admin-panel-grid">
    <section class="mw-admin-card">
      <div class="mw-admin-card-head"><div><h2>ภูมิภาค</h2><p>สรุปจากรายการสถานที่ใน CMS</p></div></div>
      ${list(regions)}
    </section>
    <section class="mw-admin-card">
      <div class="mw-admin-card-head"><div><h2>รูปแบบการเดินทาง</h2><p>ข้อมูลที่ใช้บนหน้ารายละเอียดสถานที่</p></div></div>
      ${list(modes)}
    </section>
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
  if (templeList.keydown(event)) return;
  if (state.templeEditorOpen) return;
  const handle = event.target.closest?.("[data-temple-drag-key]");
  if (!handle || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
  event.preventDefault();
  moveTempleByOffset(handle.dataset.templeDragKey, event.key === "ArrowUp" ? -1 : 1);
}

function handleGlobalClick(event) {
  if (templeEditorControls.click(event)) return;
  const visitRow = event.target.closest("[data-visit-row]");
  if (visitRow) {
    const index = visitRow.dataset.visitRow;
    updateVisitContent(currentTempleEdit(), currentTempleRecord(), `hours/timetable/${index}${index === "add" ? "" : "/remove"}`, "");
    markDirty();
    renderTemples();
    document.querySelector('[data-visit-row="add"]')?.focus();
    return;
  }
  if (templeList.click(event)) return;
  if (navigationEditor.click(event)) return;
  if (contentLibrary.click(event)) return;
  if (pageContentEditor.click(event)) return;
  if (!event.target.closest(".mw-admin-global-search")) design.closeSearch();
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
    if (state.section === "commerce" && !commerceEditor.canLeave()) return;
    if (state.section === "commerce") commerceEditor.destroy();
    if (state.section === "dates" && !activityEditor.canLeave()) return;
    design.closeSearch();
    state.section = "temples";
    state.selectedTempleKey = editTempleButton.dataset.editTemple;
    state.templeCollectionFilter = state.templeCatalog.find(item => item.key === state.selectedTempleKey)?.collection || state.templeCollectionFilter;
    templeEditorControls.begin();
    state.templeEditorOpen = true;
    if (state.mobileNavOpen) { state.mobileNavOpen = false; syncSidebarState(); }
    renderSideNav();
    renderTemples();
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
    if (sectionButton.closest("[data-commerce-console]")) return;
    if (state.section === "commerce" && !commerceEditor.canLeave()) return;
    if (state.section === "commerce") commerceEditor.destroy();
    if (state.section === "dates" && !activityEditor.canLeave()) return;
    if (sectionButton.dataset.pageJump) state.selectedPageId = sectionButton.dataset.pageJump;
    else if (sectionButton.dataset.section === "pages") state.selectedPageId = "home";
    if (sectionButton.dataset.collectionJump) {
      state.templeCollectionFilter = sectionButton.dataset.collectionJump;
      state.templeSearch = "";
      state.templeEditorOpen = false;
    }
    state.section = sectionButton.dataset.section;
    design.closeSearch();
    if (state.mobileNavOpen) { state.mobileNavOpen = false; syncSidebarState(); $(".mw-admin-nav-toggle")?.focus(); }
    renderAdmin();
    return;
  }
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;
  const action = actionButton.dataset.action;
  const actions = {
    "save-draft": saveDraft,
    "dismiss-publish-progress": () => { if (!state.publishing) hidePublishProgress(); },
    "dismiss-draft": () => { $("#adminDraftNotice").hidden = true; },
    "restore-draft": () => {
      if (state.publishing || !commerceEditor.canLeave() || (state.section === "dates" && !activityEditor.canLeave()) || (state.dirty && !confirm("เปิดฉบับร่างที่บันทึกไว้แทนข้อมูลที่กำลังแก้ไข?"))) return;
      try {
        const saved = JSON.parse(localStorage.getItem("mongkolwela.admin.draft") || "null");
        if (!saved || !Array.isArray(saved.pages)) throw new Error();
        state.content = saved;
        state.baseRevision = localStorage.getItem("mongkolwela.admin.draftRevision") || "";
        state.dirty = true;
        $("#adminDraftNotice").hidden = true;
        renderAdmin();
        setStatus("เปิดฉบับร่างแล้ว ยังไม่เผยแพร่", "info");
      } catch { setStatus("ไม่สามารถเปิดฉบับร่างได้", "error"); }
    },
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
    "refresh-admin-data": async () => {
      // Keep local edits: refresh only the independent failed resources.
      await Promise.allSettled([state.templeLoadError ? loadTemples() : Promise.resolve(), loadMediaConfig(), loadAnalytics()]);
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
  if (templeList.input(event)) return;
  if (navigationEditor.input(event)) return;
  if (event.target.closest("[data-commerce-console]")) return;
  if (contentLibrary.input(event)) return;
  if (pageContentEditor.input(event)) return;
  if (event.target.id === "adminGlobalSearch") {
    if (event.type === "input") design.renderSearch(event.target.value);
    return;
  }
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
    if (event.type === "change") templeEditorControls.changed(target);
    return;
  }
  if (updateNavFromInput(target)) {
    markDirty();
    return;
  }
  if (!target.matches("[data-page-prop], [data-page-enabled], [data-patch-field], [data-patch-rich], [data-section-field], [data-section-enabled], [data-card-field], [data-block-enabled], [data-block-prop], [data-block-rich], [data-block-prop-json]")) return;
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
  if (target.matches("[data-temple-slug], [data-temple-slug-mode]")) return updateTempleSlug(target);
  if (!target.matches("[data-temple-field], [data-temple-visit]")) return false;
  const edit = currentTempleEdit();
  if (!edit) return true;
  if (target.matches("[data-temple-visit]")) {
    updateVisitContent(edit, currentTempleRecord(), target.dataset.templeVisit, target.value);
    return true;
  }
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
      updateTempleSlug(target);
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
  try {
    localStorage.setItem("mongkolwela.admin.draft", JSON.stringify(state.content));
    localStorage.setItem("mongkolwela.admin.draftRevision", state.baseRevision);
    state.dirty = false;
    setStatus("บันทึกฉบับร่างในเบราว์เซอร์แล้ว ยังไม่เผยแพร่", "ok");
  } catch { setStatus("บันทึกฉบับร่างไม่ได้ ข้อมูลที่แก้ไขยังอยู่ในหน้านี้", "error"); }
}


async function logout(button, confirmed = false) {
  if (!confirmed && !commerceEditor.canLeave()) return;
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
  templeEditorControls.begin();
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
    slug: "new-place",
    slugMode: "auto",
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
    slugMode: edit.slugMode,
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
  templeEditorControls.finish();
  syncSidebarState();
  markDirty();
  renderTemples();
}

function closeTempleEditor() {
  state.templeEditorOpen = false;
  templeEditorControls.finish(true);
  syncSidebarState();
  setStatus(state.dirty ? "มีการแก้ไขที่ยังไม่ได้เผยแพร่" : "ยกเลิกการแก้ไขแล้ว", state.dirty ? "warn" : "ok");
  renderTemples();
}

async function saveTempleEditor() {
  if (!await prepareTempleSlug()) return;
  if (!templeEditorControls.validate()) return;
  state.templeEditorOpen = false;
  templeEditorControls.finish();
  syncSidebarState();
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
  if (!state.dirty && !activityEditor.isDirty() && !activityEditor.isBusy() && !commerceEditor.isDirty() && !mediaLibrary.isBusy() && !mediaLibrary.isDirty()) return;
  event.preventDefault();
  event.returnValue = "";
});

const { templeRecords, templeOrders, currentTempleRecord, currentTempleEdit, templeValue, filteredTempleCatalog, normalizeAdminSearch, renderTemples, renderTempleTableRow, templeConfidence, renderTempleDrawer, renderTempleListItem, renderTempleEmptyState, renderTempleEditor, renderTempleImageGroup, renderTempleImageField, templeImageValue, templeList, templeEditorControls, updateTempleSlug, prepareTempleSlug } = createTempleEditor({ state, rememberTempleListScroll, setTitle, setTopActions, setStatus, closeTempleEditor, escapeHtml, $, TEMPLE_COLLECTIONS, empty, restoreTempleListScroll, collectionTemples, TEMPLE_IMAGE_FIELDS });

const { imageFieldFromButton, setTempleImage, useTempleImageUrl, verifyImageLoads, cropTempleImage, reuseTempleImage, clearTempleImage, handleTempleImageUpload, templeImageFilename, detectImageProvider, uploadAdminMedia, openTempleCropper, initializeTempleCrop, bindTempleCropPointerEvents, pickCropBox, moveTempleCrop, resizeTempleCrop, updateTempleCropSelection, applyTempleCrop, closeTempleCropper } = createAdminMedia({ markDirty, setStatus, state, api, $, TEMPLE_IMAGE_FIELDS, escapeHtml, currentTempleEdit, currentTempleRecord, renderTemples, templeImageValue });

const { setPublishControlsDisabled, setPublishProgress, hidePublishProgress, publishedContentMatches, waitForPublishedContent, publish } = createAdminPublishing({ queryAll: (selector) => document.querySelectorAll(selector), $, api, sleep, state, setStatus, renderAdmin });

const activityEditor = createActivityEditor({ state, $, api, escapeHtml, setTitle, setTopActions, setStatus, uploadMedia: uploadAdminMedia });
const mediaLibrary = createMediaLibrary({ state, api, escapeHtml, setTitle, setTopActions, templeImageValue, uploadMedia: uploadAdminMedia });
const contentLibrary = createContentLibrary({ state, api, escapeHtml, setTitle, setTopActions, markDirty, setStatus });
const pageContentEditor = createPageContentEditor({ state, escapeHtml, markDirty, setTitle, setTopActions, setStatus, renderAdvanced: renderAdvancedPages, uploadMedia: uploadAdminMedia });
const navigationEditor = createNavigationEditor({ state, escapeHtml, markDirty, setTitle, setTopActions, setStatus, uploadMedia: uploadAdminMedia });
const commerceEditor = createCommerceEditor({ setTitle, setTopActions });

const design = createAdminDesign({ state, $, escapeHtml, dashboardSummary, templeHealthRows, formatDateTime, setTitle, setTopActions });
const analyticsView = createAdminAnalytics({ state, api, escapeHtml, setTitle, setTopActions, formatDateTime });
window.matchMedia("(max-width: 900px)").addEventListener("change", () => { state.mobileNavOpen = false; syncSidebarState(); });
document.addEventListener("keydown", event => {
  if (!$("#adminGlobalSearch")) return;
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); if (state.mobileNavOpen) toggleSidebar(); $("#adminGlobalSearch").focus(); }
  if (event.key === "Escape") {
    if (state.mobileNavOpen) { event.preventDefault(); toggleSidebar(); }
    if (!$("#adminSearchResults").hidden) { design.closeSearch(); $("#adminGlobalSearch").focus(); }
    $(".mw-admin-account")?.removeAttribute("open");
  }
  if (event.key === "ArrowDown" && event.target.id === "adminGlobalSearch" && !$("#adminSearchResults").hidden) { event.preventDefault(); $("#adminSearchResults button")?.focus(); }
  if (event.key === "Tab" && state.mobileNavOpen) {
    const controls = $$("a[href], button:not(:disabled)", $(".mw-admin-sidebar"));
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
});

initPageLoader();
boot();
