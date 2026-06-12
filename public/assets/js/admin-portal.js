const state = {
  content: null,
  selectedPageId: "home",
  section: "dashboard",
  dirty: false,
  session: null,
  analytics: null,
  templeCatalog: [],
  selectedTempleKey: "",
  templeCollectionFilter: "popular",
  templeSearch: "",
  templeListScroll: {},
  secondaryReady: false,
  secondaryLoading: false,
  media: { provider: "", cloudinary: { enabled: false }, imagekit: { enabled: false } },
};

const TEMPLE_COLLECTIONS = [
  { key: "popular", label: "สายไหว้พระ 9 วัด" },
  { key: "mu", label: "สายมู" },
  { key: "sacred", label: "วัดศักดิ์สิทธิ์" },
];

const TEMPLE_IMAGE_FIELDS = [
  { role: "card", label: "รูปหน้า Overview List", ratio: 16 / 10, ratioLabel: "16 : 10" },
  { role: "hero", label: "รูป Banner หน้ารายละเอียด", ratio: 16 / 10, ratioLabel: "16 : 10" },
  { role: "map", label: "รูปใน Maps", ratio: 16 / 9, ratioLabel: "16 : 9" },
];

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

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

function markDirty() {
  state.dirty = true;
  setStatus("มี draft ที่ยังไม่ได้ publish", "warn");
}

function currentPage() {
  return (state.content?.pages || []).find((page) => page.id === state.selectedPageId) || state.content?.pages?.[0];
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
  renderAdminLoading("Dashboard", "กำลังตรวจสอบสิทธิ์", "กำลังเตรียมข้อมูลสำหรับ Admin Portal");
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
  $("#adminApp").innerHTML = `<div class="mw-admin-shell">
    <header class="mw-admin-header">
      <a class="mw-admin-logo" href="/admin/"><span>MW</span><strong>มงคลเวลา</strong><small>Content Management</small></a>
      <div class="mw-admin-header-actions">
        <span id="adminStatus" class="mw-admin-status">พร้อมใช้งาน</span>
        <button class="mw-admin-btn" type="button" data-action="preview">เปิดเว็บ</button>
        <button class="mw-admin-btn mw-admin-btn-primary" type="button" data-action="publish">${icon("publish")} Publish</button>
      </div>
    </header>
    <nav class="mw-admin-nav" id="adminNav" aria-label="Admin navigation"></nav>
    <main class="mw-admin-main">
      <header class="mw-admin-top">
        <div><p>Admin Portal</p><h1 id="adminTitle">Dashboard</h1></div>
        <div class="mw-admin-top-actions">
          <button class="mw-admin-btn" type="button" data-action="save-draft">Save draft</button>
          <button class="mw-admin-btn" type="button" data-action="logout">ออกจากระบบ</button>
        </div>
      </header>
      <section id="adminContent" class="mw-admin-content"></section>
    </main>
  </div>`;
  $("#adminApp").addEventListener("click", handleGlobalClick);
  $("#adminApp").addEventListener("input", handleInput);
  $("#adminApp").addEventListener("change", handleInput);
  $("#adminApp").addEventListener("error", handleAdminImageError, true);
}

function navButton(id, label, iconName) {
  return `<button type="button" class="${state.section === id ? "is-active" : ""}" data-section="${id}">
    <span>${icon(iconName)}</span><strong>${escapeHtml(label)}</strong>
  </button>`;
}

function renderSideNav() {
  $("#adminNav").innerHTML = [
    navButton("dashboard", "Dashboard", "dashboard"),
    navButton("pages", "Pages & Content", "page"),
    navButton("temples", "Temples", "component"),
    navButton("sections", "Sections", "section"),
    navButton("navigation", "Navigation", "nav"),
    navButton("components", "Components", "component"),
    navButton("analytics", "Analytics", "chart"),
  ].join("");
}

function renderLogin() {
  $("#adminApp").innerHTML = `<main class="mw-admin-login">
    <form class="mw-admin-login-card" id="loginForm">
      <span class="mw-admin-login-mark">MW</span>
      <h1>Admin Portal</h1>
      <p>แก้ content, sections, pages, components และดู analytics ของมงคลเวลา</p>
      <label>ชื่อผู้แก้ไข<input name="actor" autocomplete="username" value="Admin"></label>
      <label>รหัสผ่าน<input name="password" type="password" autocomplete="current-password" placeholder="local dev: admin" required></label>
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
    renderAdminLoading("Dashboard", "กำลังโหลดข้อมูล", "กำลังเตรียมข้อมูลหลักสำหรับ Admin Portal");
    return;
  }
  if (state.section === "temples" && !state.secondaryReady) {
    renderAdminLoading("Temples", "กำลังโหลดข้อมูลวัด", "กำลังเตรียมรายการสถานที่ รูปภาพ และการตั้งค่าอัปโหลด");
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

function renderAdminLoading(title = "Dashboard", heading = "กำลังโหลดข้อมูล", detail = "กำลังเตรียมข้อมูลสำหรับ Admin Portal") {
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
  setTitle("Dashboard");
  const content = state.content;
  const pages = content.pages || [];
  const livePages = pages.filter((page) => page.enabled !== false);
  const customPages = pages.filter((page) => page.kind === "custom");
  const patchCount = pages.reduce((total, page) => total + (page.patches?.length || 0), 0);
  const sectionCount = pages.reduce((total, page) => total + (page.sections?.length || 0), 0);
  const navItems = (content.navigation?.tabs || []).reduce((total, tab) => total + (tab.items?.length || 0), 0) + (content.navigation?.utility?.length || 0);
  const paths = Object.values(state.analytics?.paths || {}).sort((a, b) => b.count - a.count);
  $("#adminContent").innerHTML = `<div class="mw-admin-grid">
    ${statCard("Pages", pages.length)}
    ${statCard("Live pages", livePages.length)}
    ${statCard("Nav items", navItems)}
    ${statCard("Pageviews", state.analytics?.totals?.pageviews || 0)}
  </div>
  <div class="mw-admin-card">
    <div class="mw-admin-card-head"><h2>Publishing Control</h2><button class="mw-admin-btn mw-admin-btn-sm" type="button" data-action="publish">Publish</button></div>
    <div class="mw-admin-metrics">
      ${miniMetric(content.publishedAt ? "Online" : "Draft", "Status", content.publishedAt ? "good" : "warn")}
      ${miniMetric(patchCount, "Editable fields")}
      ${miniMetric(sectionCount, "Section controls")}
      ${miniMetric(customPages.length, "Custom pages")}
      ${miniMetric(content.publishedBy || "admin", "Last editor")}
    </div>
    <div class="mw-admin-publish-row">
      <p><strong>Published:</strong> ${escapeHtml(content.publishedAt || "ยังไม่เคย publish")}<br><span>Updated: ${escapeHtml(content.updatedAt || "-")}</span></p>
      <div class="mw-admin-badges">
        <span>content</span><span>navigation</span><span>pages</span><span>analytics</span>
      </div>
    </div>
    <div class="mw-admin-content-mix" aria-label="Content mix">
      ${contentBar("Pages", pages.length, pages.length)}
      ${contentBar("Live", livePages.length, pages.length)}
      ${contentBar("Fields", patchCount, Math.max(patchCount, sectionCount, navItems, 1))}
      ${contentBar("Sections", sectionCount, Math.max(patchCount, sectionCount, navItems, 1))}
      ${contentBar("Nav", navItems, Math.max(patchCount, sectionCount, navItems, 1))}
    </div>
  </div>
  <div class="mw-admin-card">
    <div class="mw-admin-card-head"><h2>Analytics</h2><button class="mw-admin-btn mw-admin-btn-sm" type="button" data-action="refresh-analytics">Refresh</button></div>
    <div class="mw-admin-metrics mw-admin-metrics--compact">
      ${miniMetric(state.analytics?.totals?.pageviews || 0, "Pageviews")}
      ${miniMetric(state.analytics?.totals?.events || 0, "Events")}
      ${miniMetric(paths.length, "Tracked paths")}
    </div>
    <div class="mw-admin-table mw-admin-table--dashboard">
      ${paths.slice(0, 5).map((item) => `<div><strong>${escapeHtml(item.path)}</strong><span>${escapeHtml(item.title || "")}</span><b>${item.count}</b></div>`).join("") || empty("ยังไม่มีข้อมูล analytics")}
    </div>
  </div>
  <div class="mw-admin-card">
    <div class="mw-admin-card-head"><h2>Quick actions</h2></div>
    <div class="mw-admin-quick-actions">
      <button class="mw-admin-btn mw-admin-btn-primary" type="button" data-section="pages">Manage pages</button>
      <button class="mw-admin-btn" type="button" data-section="sections">Manage sections</button>
      <button class="mw-admin-btn" type="button" data-section="navigation">Manage navigation</button>
      <button class="mw-admin-btn" type="button" data-section="components">Manage components</button>
    </div>
  </div>
  <div class="mw-admin-card">
    <div class="mw-admin-card-head"><h2>Latest pages</h2></div>
    <div class="mw-admin-data-table">
      <div class="mw-admin-data-head"><span>Page</span><span>Type</span><span>Status</span><span>Action</span></div>
      ${pages.slice(0, 7).map((page) => `<div>
        <strong>${escapeHtml(page.label || page.id)}</strong>
        <span>${escapeHtml(page.kind || "existing")}</span>
        <span><mark>${page.enabled !== false ? "Live" : "Off"}</mark></span>
        <button class="mw-admin-btn mw-admin-btn-sm" type="button" data-section="pages" data-page-jump="${escapeHtml(page.id)}">Edit</button>
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
  setTitle("Pages & Content");
  const page = currentPage();
  $("#adminContent").innerHTML = `${pageToolbar(page)}
    <div class="mw-admin-card">
      <h2>Page Settings</h2>
      <div class="mw-admin-form-grid">
        <label>ชื่อหน้า<input data-page-prop="label" value="${escapeHtml(page.label || "")}"></label>
        <label>Route<input data-page-prop="route" value="${escapeHtml(page.route || "")}"></label>
        <label>ชนิด<select data-page-prop="kind"><option value="existing" ${page.kind !== "custom" ? "selected" : ""}>Existing page</option><option value="custom" ${page.kind === "custom" ? "selected" : ""}>Custom page</option></select></label>
        <label class="mw-admin-check"><input type="checkbox" data-page-enabled ${page.enabled !== false ? "checked" : ""}> เปิดใช้งาน</label>
      </div>
    </div>
    <div class="mw-admin-card">
      <div class="mw-admin-card-head"><h2>Editable Fields</h2><div><button class="mw-admin-btn" type="button" data-action="scan-page">สแกนจากหน้าเว็บ</button><button class="mw-admin-btn" type="button" data-action="add-patch">เพิ่ม field</button></div></div>
      <div class="mw-admin-list">${(page.patches || []).map(renderPatchEditor).join("") || empty("ยังไม่มี field")}</div>
    </div>
    ${page.kind === "custom" ? renderBlockEditor(page) : ""}`;
}

function pageToolbar(page) {
  return `<div class="mw-admin-toolbar">${pageSelector()}
    <button class="mw-admin-btn" type="button" data-action="add-page">เพิ่มหน้า</button>
    <button class="mw-admin-btn" type="button" data-action="duplicate-page">Duplicate</button>
    <button class="mw-admin-btn mw-admin-btn-danger" type="button" data-action="remove-page">ลบหน้า</button>
    <a class="mw-admin-btn" target="_blank" rel="noopener" href="${escapeHtml(page.route || "/")}">Preview</a>
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
      <label>Label<input data-patch-field="label" value="${escapeHtml(patch.label || "")}"></label>
      <label>CSS selector<input data-patch-field="selector" value="${escapeHtml(patch.selector || "")}"></label>
      <label>ชนิด<select data-patch-field="kind"><option value="text" ${type === "text" ? "selected" : ""}>Text</option><option value="html" ${type === "html" ? "selected" : ""}>Rich HTML</option><option value="image" ${type === "image" ? "selected" : ""}>Image</option><option value="attr" ${type === "attr" ? "selected" : ""}>Attribute</option></select></label>
      <label>Attribute<input data-patch-field="attr" value="${escapeHtml(patch.attr || "")}" placeholder="placeholder / href / aria-label"></label>
    </div>
    ${type === "html" ? `<label>Rich text<div class="mw-admin-rich" contenteditable="true" data-patch-rich="value">${patch.value || ""}</div></label>` : ""}
    ${type !== "html" && type !== "image" ? `<label>Value<textarea data-patch-field="value">${escapeHtml(patch.value || "")}</textarea></label>` : ""}
    ${type === "image" ? `<div class="mw-admin-form-grid"><label>Image URL<input data-patch-field="src" value="${escapeHtml(patch.src || "")}"></label><label>Alt<input data-patch-field="alt" value="${escapeHtml(patch.alt || "")}"></label></div>` : ""}
  </article>`;
}

function templeRecords() {
  state.content.temples ||= {};
  state.content.temples.records ||= {};
  return state.content.temples.records;
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
  setTitle("Temples");
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
  return `<button type="button" class="mw-admin-temple-list-item ${record.key === state.selectedTempleKey ? "is-active" : ""}" data-select-temple="${escapeHtml(record.key)}">
    <span class="mw-admin-temple-list-thumb">${image ? `<img src="${escapeHtml(image)}" alt="" data-admin-temple-image>` : "<i>ไม่มีรูป</i>"}</span>
    <span><strong data-temple-list-title>#${escapeHtml(record.temple.rank || "-")} ${escapeHtml(record.temple.name || "ยังไม่มีชื่อ")}</strong><small>${escapeHtml([record.temple.province, record.temple.district].filter(Boolean).join(" / ") || "ยังไม่มีที่ตั้ง")}</small></span>
    ${record.source === "admin" ? '<b>ใหม่</b>' : ""}
  </button>`;
}

function renderTempleEmptyState() {
  return `<div class="mw-admin-temple-empty">
    <strong>ยังไม่มีสถานที่ในหมวดนี้</strong>
    <p>เริ่มสร้างสถานที่แรก แล้วเพิ่มรูปสำหรับหน้า Overview, Banner และ Maps ได้ทันที</p>
    <button class="mw-admin-btn mw-admin-btn-primary" type="button" data-action="add-temple">+ เพิ่มสถานที่</button>
  </div>`;
}

function renderTempleEditor(record, edit) {
  const provider = state.media.provider
    ? `อัปโหลดตรงไป ${state.media.provider === "cloudinary" ? "Cloudinary" : "ImageKit"}`
    : "ยังไม่ได้ตั้งค่า Cloudinary หรือ ImageKit";
  return `<div class="mw-admin-temple-editor-head">
    <div>
      <p data-temple-editor-rank>${escapeHtml(record.collectionLabel)} · #${escapeHtml(record.temple.rank || "-")}</p>
      <h2 data-temple-editor-name>${escapeHtml(templeValue(record, edit, "name") || "สถานที่ใหม่")}</h2>
      <small>${escapeHtml(record.key)}</small>
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
    <div class="mw-admin-form-grid">
      <label>ชื่อสถานที่<input data-temple-field="name" value="${escapeHtml(templeValue(record, edit, "name"))}" required></label>
      <label>อันดับในหมวด<input type="number" min="1" data-temple-field="rank" value="${escapeHtml(templeValue(record, edit, "rank"))}"></label>
    </div>
  </div>
  <div class="mw-admin-temple-section">
    <div class="mw-admin-temple-section-head">
      <div><span>02</span><h3>รูปภาพ</h3></div>
      <p class="${state.media.provider ? "is-ready" : "is-warning"}">${escapeHtml(provider)}</p>
    </div>
    <p class="mw-admin-temple-media-note">แต่ละตำแหน่งแยก Desktop และ Mobile เพื่อเลือกจุดครอปที่เหมาะกับหน้าจอจริง รูปใน Maps จะใช้รูป Overview เป็นค่าเริ่มต้นถ้ายังไม่ได้กำหนด</p>
    <div class="mw-admin-temple-image-groups">
      ${TEMPLE_IMAGE_FIELDS.map((field) => renderTempleImageGroup(record, edit, field)).join("")}
    </div>
  </div>`;
}

function renderTempleImageGroup(record, edit, field) {
  return `<section class="mw-admin-temple-image-group">
    <header><div><h4>${escapeHtml(field.label)}</h4><span>${escapeHtml(field.ratioLabel)}</span></div><small>${field.role === "card" ? "หน้า Cards" : field.role === "hero" ? "Banner หน้ารายละเอียด" : "Popup เมื่อเลือกหมุด"}</small></header>
    <div class="mw-admin-temple-image-variants">
      ${renderTempleImageField(record, edit, field, "desktop", "Desktop / Tablet")}
      ${renderTempleImageField(record, edit, field, "mobile", "Mobile")}
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
      <input id="${inputId}" type="url" value="${escapeHtml(url)}" placeholder="Wikimedia, Cloudinary, ImageKit หรือ HTTPS URL" data-image-url>
      <button class="mw-admin-btn mw-admin-btn-sm" type="button" data-action="use-temple-image-url">ใช้ URL</button>
    </div>
    <div class="mw-admin-image-actions">
      <label class="mw-admin-btn mw-admin-btn-sm">อัปโหลด<input type="file" accept="image/*" data-temple-image-upload hidden></label>
      <button class="mw-admin-btn mw-admin-btn-sm" type="button" data-action="crop-temple-image" ${url ? "" : "disabled"}>Crop</button>
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
  setTitle("Sections");
  const page = currentPage();
  $("#adminContent").innerHTML = `${pageToolbar(page)}
    <div class="mw-admin-card">
      <div class="mw-admin-card-head"><h2>Section Controls</h2><button class="mw-admin-btn" type="button" data-action="add-section">เพิ่ม section control</button></div>
      <p>ใช้ selector ของ section เดิม เพื่อ hide/reorder/duplicate โดย component render แบบเดิม</p>
      <div class="mw-admin-list">${byOrder(page.sections).map(renderSectionEditor).join("") || empty("ยังไม่มี section control")}</div>
    </div>`;
}

function renderSectionEditor(section, index) {
  const originalIndex = (currentPage().sections || []).indexOf(section);
  return `<article class="mw-admin-item" data-section-index="${originalIndex}">
    <div class="mw-admin-item-head">
      <strong>${escapeHtml(section.label || section.id || "Section")}</strong>
      <div><button type="button" data-action="move-section-up">ขึ้น</button><button type="button" data-action="move-section-down">ลง</button><button type="button" data-action="remove-section">ลบ</button></div>
    </div>
    <div class="mw-admin-form-grid">
      <label>Label<input data-section-field="label" value="${escapeHtml(section.label || "")}"></label>
      <label>Selector<input data-section-field="selector" value="${escapeHtml(section.selector || "")}"></label>
      <label>Order<input type="number" data-section-field="order" value="${escapeHtml(section.order ?? index * 10)}"></label>
      <label>Duplicate count<input type="number" min="0" max="5" data-section-field="duplicateCount" value="${escapeHtml(section.duplicateCount || 0)}"></label>
      <label class="mw-admin-check"><input type="checkbox" data-section-enabled ${section.enabled !== false ? "checked" : ""}> เปิดใช้งาน</label>
    </div>
  </article>`;
}

function renderNavigation() {
  setTitle("Navigation");
  const nav = state.content.navigation;
  $("#adminContent").innerHTML = `<div class="mw-admin-card">
    <div class="mw-admin-card-head"><h2>Navbar Tabs</h2><button class="mw-admin-btn" type="button" data-action="add-nav-tab">เพิ่ม tab</button></div>
    <div class="mw-admin-list">${(nav.tabs || []).map(renderNavTab).join("")}</div>
  </div>
  <div class="mw-admin-card">
    <div class="mw-admin-card-head"><h2>Utility Links</h2><button class="mw-admin-btn" type="button" data-action="add-utility">เพิ่ม utility</button></div>
    <div class="mw-admin-list">${(nav.utility || []).map((item, index) => renderNavItem(item, index, "utility")).join("")}</div>
  </div>`;
}

function renderNavTab(tab, index) {
  return `<article class="mw-admin-item" data-nav-tab="${index}">
    <div class="mw-admin-item-head"><strong>${escapeHtml(tab.label || "Tab")}</strong><div><button type="button" data-action="move-nav-tab-up">ขึ้น</button><button type="button" data-action="move-nav-tab-down">ลง</button><button type="button" data-action="remove-nav-tab">ลบ</button></div></div>
    <div class="mw-admin-form-grid">
      <label>Label<input data-nav-tab-field="label" value="${escapeHtml(tab.label || "")}"></label>
      <label>Href<input data-nav-tab-field="href" value="${escapeHtml(tab.href || "")}"></label>
      <label class="mw-admin-check"><input type="checkbox" data-nav-tab-enabled ${tab.enabled !== false ? "checked" : ""}> เปิดใช้งาน</label>
    </div>
    <div class="mw-admin-sublist">
      <div class="mw-admin-card-head"><h3>Items</h3><button type="button" data-action="add-nav-item">เพิ่ม item</button></div>
      ${(tab.items || []).map((item, itemIndex) => renderNavItem(item, itemIndex, "tab", index)).join("")}
    </div>
  </article>`;
}

function renderNavItem(item, index, scope, tabIndex = -1) {
  return `<div class="mw-admin-nav-row" data-nav-scope="${scope}" data-nav-tab-index="${tabIndex}" data-nav-item="${index}">
    <input data-nav-item-field="label" value="${escapeHtml(item.label || "")}" placeholder="Label">
    <input data-nav-item-field="href" value="${escapeHtml(item.href || "")}" placeholder="Href">
    <label><input type="checkbox" data-nav-item-section ${item.section ? "checked" : ""}> section</label>
    <label><input type="checkbox" data-nav-item-enabled ${item.enabled !== false ? "checked" : ""}> on</label>
    <button type="button" data-action="move-nav-item-up">ขึ้น</button>
    <button type="button" data-action="move-nav-item-down">ลง</button>
    <button type="button" data-action="remove-nav-item">ลบ</button>
  </div>`;
}

function renderComponents() {
  setTitle("Components");
  const cards = state.content.components?.cards || [];
  $("#adminContent").innerHTML = `<div class="mw-admin-card">
    <div class="mw-admin-card-head"><h2>Reusable Cards</h2><button class="mw-admin-btn" type="button" data-action="add-card">เพิ่ม card</button></div>
    <p>Phase 4 registry สำหรับ card/component ที่ custom pages หรือหน้าในอนาคตเรียกใช้ได้</p>
    <div class="mw-admin-list">${cards.map(renderCardEditor).join("") || empty("ยังไม่มี card")}</div>
  </div>`;
}

function renderCardEditor(card, index) {
  return `<article class="mw-admin-item" data-card-index="${index}">
    <div class="mw-admin-item-head"><strong>${escapeHtml(card.title || "Card")}</strong><button type="button" data-action="remove-card">ลบ</button></div>
    <div class="mw-admin-form-grid">
      <label>Title<input data-card-field="title" value="${escapeHtml(card.title || "")}"></label>
      <label>Image<input data-card-field="image" value="${escapeHtml(card.image || "")}"></label>
      <label>Href<input data-card-field="href" value="${escapeHtml(card.href || "")}"></label>
    </div>
    <label>Body<textarea data-card-field="body">${escapeHtml(card.body || "")}</textarea></label>
  </article>`;
}

function renderBlockEditor(page) {
  return `<div class="mw-admin-card">
    <div class="mw-admin-card-head"><h2>Custom Page Blocks</h2><div><button class="mw-admin-btn" type="button" data-action="add-rich-block">เพิ่ม Rich Text</button><button class="mw-admin-btn" type="button" data-action="add-hero-block">เพิ่ม Hero</button><button class="mw-admin-btn" type="button" data-action="add-cards-block">เพิ่ม Cards</button></div></div>
    <div class="mw-admin-list">${(page.blocks || []).map(renderBlockItem).join("") || empty("ยังไม่มี block")}</div>
  </div>`;
}

function renderBlockItem(block, index) {
  const props = block.props || {};
  return `<article class="mw-admin-item" data-block-index="${index}">
    <div class="mw-admin-item-head"><strong>${escapeHtml(block.type)}</strong><div><button type="button" data-action="move-block-up">ขึ้น</button><button type="button" data-action="move-block-down">ลง</button><button type="button" data-action="remove-block">ลบ</button></div></div>
    <label class="mw-admin-check"><input type="checkbox" data-block-enabled ${block.enabled !== false ? "checked" : ""}> เปิดใช้งาน block</label>
    ${block.type === "hero" ? `<div class="mw-admin-form-grid"><label>Eyebrow<input data-block-prop="eyebrow" value="${escapeHtml(props.eyebrow || "")}"></label><label>Title<input data-block-prop="title" value="${escapeHtml(props.title || "")}"></label><label>Image<input data-block-prop="image" value="${escapeHtml(props.image || "")}"></label><label>Button label<input data-block-prop="buttonLabel" value="${escapeHtml(props.buttonLabel || "")}"></label><label>Button href<input data-block-prop="buttonHref" value="${escapeHtml(props.buttonHref || "")}"></label></div><label>Body<textarea data-block-prop="body">${escapeHtml(props.body || "")}</textarea></label>` : ""}
    ${block.type === "richText" ? `<label>Rich text<div class="mw-admin-rich" contenteditable="true" data-block-rich="html">${props.html || ""}</div></label>` : ""}
    ${block.type === "cards" ? `<label>Cards JSON<textarea data-block-prop-json="cards">${escapeHtml(JSON.stringify(props.cards || [], null, 2))}</textarea></label>` : ""}
  </article>`;
}

function renderAnalytics() {
  setTitle("Analytics");
  const paths = Object.values(state.analytics?.paths || {}).sort((a, b) => b.count - a.count);
  $("#adminContent").innerHTML = `<div class="mw-admin-grid">
    ${statCard("Pageviews", state.analytics?.totals?.pageviews || 0)}
    ${statCard("Events", state.analytics?.totals?.events || 0)}
    ${statCard("Tracked paths", paths.length)}
  </div>
  <div class="mw-admin-card">
    <div class="mw-admin-card-head"><h2>Top Pages</h2><button class="mw-admin-btn" type="button" data-action="refresh-analytics">Refresh</button></div>
    <div class="mw-admin-table">${paths.map((item) => `<div><strong>${escapeHtml(item.path)}</strong><span>${escapeHtml(item.title || "")}</span><b>${item.count}</b></div>`).join("") || empty("ยังไม่มีข้อมูล analytics")}</div>
  </div>`;
}

function empty(text) {
  return `<p class="mw-admin-empty">${escapeHtml(text)}</p>`;
}

function handleGlobalClick(event) {
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
  actions[action]?.(actionButton);
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
  const page = currentPage();
  if (!page) return;
  if (target.matches("[data-page-prop]")) page[target.dataset.pageProp] = target.value;
  if (target.matches("[data-page-enabled]")) page.enabled = target.checked;
  updatePatchFromInput(target, page);
  updateSectionFromInput(target, page);
  updateNavFromInput(target);
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
  const tabEl = target.closest("[data-nav-tab]");
  if (tabEl && target.matches("[data-nav-tab-field]")) {
    state.content.navigation.tabs[Number(tabEl.dataset.navTab)][target.dataset.navTabField] = target.value;
  }
  if (tabEl && target.matches("[data-nav-tab-enabled]")) {
    state.content.navigation.tabs[Number(tabEl.dataset.navTab)].enabled = target.checked;
  }
  const row = target.closest("[data-nav-item]");
  if (!row) return;
  const item = navItemFromRow(row);
  if (!item) return;
  if (target.matches("[data-nav-item-field]")) item[target.dataset.navItemField] = target.value;
  if (target.matches("[data-nav-item-section]")) item.section = target.checked;
  if (target.matches("[data-nav-item-enabled]")) item.enabled = target.checked;
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
  try {
    setStatus("กำลัง publish...", "info");
    const payload = await api("/api/admin/content", {
      method: "POST",
      body: JSON.stringify({ content: state.content }),
    });
    state.content = payload.content;
    state.dirty = false;
    setStatus(`Published (${payload.meta?.mode || "content"})`, "ok");
    renderAdmin();
  } catch (error) {
    setStatus(error.message, "error");
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
  state.content.navigation.tabs.push({ id: `tab-${Date.now()}`, label: "เมนูใหม่", href: "/", enabled: true, items: [] });
  markDirty();
  renderNavigation();
}

function navTabIndex(button) {
  return Number(button.closest("[data-nav-tab]")?.dataset.navTab);
}

function removeNavTab(button) {
  state.content.navigation.tabs.splice(navTabIndex(button), 1);
  markDirty();
  renderNavigation();
}

function moveNavTabUp(button) {
  moveArrayItem(state.content.navigation.tabs, navTabIndex(button), -1);
  markDirty();
  renderNavigation();
}

function moveNavTabDown(button) {
  moveArrayItem(state.content.navigation.tabs, navTabIndex(button), 1);
  markDirty();
  renderNavigation();
}

function addNavItem(button) {
  const tab = state.content.navigation.tabs[navTabIndex(button)];
  tab.items ||= [];
  tab.items.push({ id: `item-${Date.now()}`, label: "รายการใหม่", href: "/", enabled: true });
  markDirty();
  renderNavigation();
}

function addUtility() {
  state.content.navigation.utility.push({ id: `utility-${Date.now()}`, label: "Utility", href: "/", enabled: true });
  markDirty();
  renderNavigation();
}

function navItemFromRow(row) {
  const index = Number(row.dataset.navItem);
  if (row.dataset.navScope === "utility") return state.content.navigation.utility[index];
  return state.content.navigation.tabs[Number(row.dataset.navTabIndex)]?.items?.[index];
}

function navItemArrayFromRow(row) {
  if (row.dataset.navScope === "utility") return state.content.navigation.utility;
  return state.content.navigation.tabs[Number(row.dataset.navTabIndex)]?.items || [];
}

function removeNavItem(button) {
  const row = button.closest("[data-nav-item]");
  navItemArrayFromRow(row).splice(Number(row.dataset.navItem), 1);
  markDirty();
  renderNavigation();
}

function moveNavItemUp(button) {
  const row = button.closest("[data-nav-item]");
  moveArrayItem(navItemArrayFromRow(row), Number(row.dataset.navItem), -1);
  markDirty();
  renderNavigation();
}

function moveNavItemDown(button) {
  const row = button.closest("[data-nav-item]");
  moveArrayItem(navItemArrayFromRow(row), Number(row.dataset.navItem), 1);
  markDirty();
  renderNavigation();
}

function addCard() {
  state.content.components.cards ||= [];
  state.content.components.cards.push({ id: `card-${Date.now()}`, title: "Card", body: "", image: "", href: "/" });
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
    setStatus(state.media.provider ? "กำลังตรวจสอบและนำรูปเข้า Media Library..." : "กำลังตรวจสอบ URL...", "info");
    await verifyImageLoads(sourceUrl);
    const result = state.media.provider ? await uploadAdminMedia(sourceUrl, templeImageFilename(field)) : sourceUrl;
    setTempleImage(field.role, field.viewport, result, {
      originalUrl: sourceUrl,
      provider: detectImageProvider(result),
    });
    setStatus("เพิ่มรูปแล้ว กด Crop เพื่อปรับจุดภาพได้", "ok");
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
  setStatus("ใช้รูปเดิมแล้ว สามารถ Crop แยกสำหรับช่องนี้ได้", "ok");
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
    if (!response.ok || !payload.secure_url) throw new Error(payload.error?.message || "Cloudinary upload failed");
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
    if (!response.ok || !payload.url) throw new Error(payload.message || "ImageKit upload failed");
    return payload.url;
  }
  throw new Error("ยังไม่ได้ตั้งค่า Cloudinary หรือ ImageKit");
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
    <header><div><span>${escapeHtml(field.viewport === "mobile" ? "Mobile" : "Desktop / Tablet")}</span><h2 id="templeCropTitle">Crop ${escapeHtml(fieldLabel?.label || "รูปภาพ")} · ${escapeHtml(fieldLabel?.ratioLabel || "")}</h2></div><button type="button" data-crop-close aria-label="ปิด">×</button></header>
    <div class="mw-admin-crop-stage">
      <div class="mw-admin-crop-wrap" data-crop-wrap>
        <img ${/^data:/iu.test(src) ? "" : 'crossorigin="anonymous"'} src="${escapeHtml(src)}" alt="" data-crop-image>
        <div class="mw-admin-crop-selection" data-crop-selection><i data-crop-handle="nw"></i><i data-crop-handle="ne"></i><i data-crop-handle="sw"></i><i data-crop-handle="se"></i></div>
      </div>
    </div>
    <footer><p>ลากกรอบเพื่อเลือกภาพ ระบบจะบันทึกเป็น JPEG ตามสัดส่วนที่กำหนด</p><div><button class="mw-admin-btn" type="button" data-crop-close>ยกเลิก</button><button class="mw-admin-btn mw-admin-btn-primary" type="button" data-crop-apply>Crop และบันทึก</button></div></footer>
  </div>`;
  overlay.classList.add("is-open");
  overlay.querySelectorAll("[data-crop-close]").forEach((button) => button.addEventListener("click", closeTempleCropper));
  overlay.querySelector("[data-crop-apply]")?.addEventListener("click", applyTempleCrop);
  const image = overlay.querySelector("[data-crop-image]");
  image.addEventListener("load", () => initializeTempleCrop(field, src));
  image.addEventListener("error", () => setStatus("โหลดรูปเพื่อ Crop ไม่สำเร็จ ลอง import เข้า Media Library ก่อน", "error"));
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
    setStatus("Crop และบันทึกรูปแล้ว", "ok");
    renderTemples();
  } catch (error) {
    button.disabled = false;
    button.textContent = "Crop และบันทึก";
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
    hero: { eyebrow: "Section", title: "Hero title", body: "", image: "", buttonLabel: "", buttonHref: "/" },
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
