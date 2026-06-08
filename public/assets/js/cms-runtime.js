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
