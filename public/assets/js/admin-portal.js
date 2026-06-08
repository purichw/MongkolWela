const state = {
  content: null,
  selectedPageId: "home",
  section: "dashboard",
  dirty: false,
  session: null,
  analytics: null,
};

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
  if (!response.ok || payload.ok === false) throw new Error(payload.error || `API failed: ${response.status}`);
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
  try {
    state.session = await api("/api/admin/session");
    await loadContent();
    await loadAnalytics();
    renderAdmin();
  } catch {
    renderLogin();
  }
}

function renderAppShell() {
  $("#adminApp").innerHTML = `<div class="mw-admin-shell">
    <aside class="mw-admin-sidebar">
      <a class="mw-admin-logo" href="/admin/"><span>MW</span><strong>Admin Portal</strong></a>
      <nav id="adminNav"></nav>
      <div class="mw-admin-sidebar-foot">
        <button class="mw-admin-ghost" type="button" data-action="preview">เปิดเว็บ</button>
        <button class="mw-admin-ghost" type="button" data-action="logout">ออกจากระบบ</button>
      </div>
    </aside>
    <main class="mw-admin-main">
      <header class="mw-admin-top">
        <div><p>มงคลเวลา</p><h1 id="adminTitle">Admin Portal</h1></div>
        <div class="mw-admin-top-actions">
          <span id="adminStatus" class="mw-admin-status">พร้อมใช้งาน</span>
          <button class="mw-admin-btn" type="button" data-action="save-draft">Save draft</button>
          <button class="mw-admin-btn mw-admin-btn-primary" type="button" data-action="publish">${icon("publish")} Publish</button>
        </div>
      </header>
      <section id="adminContent" class="mw-admin-content"></section>
    </main>
  </div>`;
  $("#adminApp").addEventListener("click", handleGlobalClick);
  $("#adminApp").addEventListener("input", handleInput);
  $("#adminApp").addEventListener("change", handleInput);
}

function navButton(id, label, iconName) {
  return `<button type="button" class="${state.section === id ? "is-active" : ""}" data-section="${id}">
    <span>${icon(iconName)}</span>${escapeHtml(label)}
  </button>`;
}

function renderSideNav() {
  $("#adminNav").innerHTML = [
    navButton("dashboard", "Dashboard", "dashboard"),
    navButton("pages", "Pages & Content", "page"),
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

function renderAdmin() {
  renderSideNav();
  const renderers = {
    dashboard: renderDashboard,
    pages: renderPages,
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

function renderDashboard() {
  setTitle("Dashboard");
  const content = state.content;
  const pages = content.pages || [];
  const livePages = pages.filter((page) => page.enabled !== false);
  $("#adminContent").innerHTML = `<div class="mw-admin-grid">
    ${statCard("Pages", pages.length)}
    ${statCard("Live pages", livePages.length)}
    ${statCard("Nav tabs", content.navigation?.tabs?.length || 0)}
    ${statCard("Pageviews", state.analytics?.totals?.pageviews || 0)}
  </div>
  <div class="mw-admin-card">
    <h2>Phase Coverage</h2>
    <div class="mw-admin-phase-list">
      ${phase("1", "แก้ข้อความ รูป attr และ rich text ภายใน component เดิม", true)}
      ${phase("2", "add/remove/reorder/duplicate sections จาก selector ของ section เดิม", true)}
      ${phase("3", "add/modify/remove/toggle pages และ navbar tabs/items", true)}
      ${phase("4", "จัดการ reusable card components และ custom page blocks", true)}
      ${phase("5", "Analytics + PDPA consent", true)}
    </div>
  </div>
  <div class="mw-admin-card">
    <h2>Publishing</h2>
    <p>Local/dev publish จะเขียน <code>public/admin/content/live.json</code>. Production publish ใช้ <code>MONGKOLWELA_GITHUB_TOKEN</code> เพื่อ commit content กลับ GitHub แบบ server-side.</p>
    <p><strong>Published:</strong> ${escapeHtml(content.publishedAt || "ยังไม่เคย publish")}</p>
    <p><strong>Updated:</strong> ${escapeHtml(content.updatedAt || "-")}</p>
  </div>`;
}

function statCard(label, value) {
  return `<article class="mw-admin-stat"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></article>`;
}

function phase(number, text, done) {
  return `<div><span>${number}</span><p>${escapeHtml(text)}</p><strong>${done ? "พร้อม" : "รอ"}</strong></div>`;
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
  const sectionButton = event.target.closest("[data-section]");
  if (sectionButton) {
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
    "add-rich-block": () => addBlock("richText"),
    "add-hero-block": () => addBlock("hero"),
    "add-cards-block": () => addBlock("cards"),
    "remove-block": removeBlock,
    "move-block-up": moveBlockUp,
    "move-block-down": moveBlockDown,
    "refresh-analytics": async () => {
      await loadAnalytics();
      renderAnalytics();
    },
  };
  actions[action]?.(actionButton);
}

function handleInput(event) {
  const target = event.target;
  if (target.matches("[data-field='selectedPage']")) {
    state.selectedPageId = target.value;
    renderAdmin();
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
