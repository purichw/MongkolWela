// Inlined in the head, before external styles or deferred route modules.
(() => {
  const root = document.documentElement;
  const options = document.currentScript.dataset;
  const pending = new Set(["document", "fonts"]);
  if (options.cms === "true") pending.add("cms");
  if (options.runtime === "true") pending.add("runtime");
  root.classList.add("page-fonts-pending");
  let finished = false, failedAsset = false, checking = false, shownAt = 0;
  let releaseTimer;
  const loader = () => document.querySelector("[data-page-loader]");
  const observer = new MutationObserver(check);
  observer.observe(document, { subtree: true, attributes: true, attributeFilter: ["data-page-pending"] });

  function recover() {
    if (finished) return;
    if (!document.body) { document.addEventListener("DOMContentLoaded", recover, { once: true }); return; }
    let notice = document.querySelector("[data-page-recovery]");
    if (!notice) {
      notice = document.createElement("section");
      notice.dataset.pageRecovery = "";
      notice.setAttribute("role", "status");
      notice.innerHTML = '<h1>ยังเตรียมหน้าเว็บไม่สำเร็จ</h1><p>การเชื่อมต่ออาจใช้เวลานานกว่าปกติ คุณสามารถรอต่อ หรือลองโหลดหน้าใหม่อีกครั้ง</p><button type="button">ลองโหลดใหม่</button>';
      notice.querySelector("button").addEventListener("click", () => location.reload());
      document.body.append(notice);
    }
    root.classList.add("page-load-stalled");
    loader()?.setAttribute("aria-hidden", "true");
  }

  function reveal() {
    if (finished || failedAsset || pending.size || document.querySelector("[data-page-pending]")) return;
    const remaining = shownAt ? Math.max(0, shownAt + 360 - performance.now()) : 0;
    if (remaining) { releaseTimer = setTimeout(reveal, remaining); return; }
    finished = true;
    clearTimeout(deadline); clearTimeout(loaderDelay); clearTimeout(releaseTimer);
    observer.disconnect();
    document.querySelectorAll("[data-page-inert]").forEach(element => { element.inert = false; element.removeAttribute("data-page-inert"); });
    root.classList.replace("page-fonts-pending", "page-fonts-ready");
    root.classList.remove("is-font-loading", "page-load-stalled");
    loader()?.setAttribute("aria-hidden", "true");
    loader()?.removeAttribute("aria-busy");
    document.dispatchEvent(new Event("mw:page-ready"));
  }

  function check() {
    if (finished || checking || failedAsset || pending.size || document.querySelector("[data-page-pending]")) return;
    checking = true;
    // CMS/route rendering may introduce new font weights. Wait for those too.
    loadFonts().then(() => {
      checking = false;
      reveal();
    }, fontFailure);
  }

  function fontFailure() {
    failedAsset = true;
    recover();
  }

  function loadFonts() {
    if (!document.fonts?.load) return Promise.resolve();
    const fonts = new Set();
    const elements = new Set([document.body, ...document.querySelectorAll("input, select, textarea")]);
    const texts = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (texts.nextNode()) {
      const parent = texts.currentNode.parentElement;
      if (texts.currentNode.textContent.trim() && parent && !parent.closest("script, style, noscript")) elements.add(parent);
    }
    for (const element of elements) {
      if (!element.getClientRects().length) continue;
      const style = getComputedStyle(element);
      fonts.add(`${style.fontStyle} ${style.fontWeight} 16px ${style.fontFamily}`);
    }
    // FontFaceSet.ready can wait for window.load (including unrelated images).
    // Explicit font loads wait for the rendered Thai/Latin faces instead.
    return Promise.all([...fonts].map(font => document.fonts.load(font, "มงคลเวลา ABCabc0123456789")));
  }

  window.MongkolWelaPageReady = {
    get ready() { return finished; },
    settle(name) { pending.delete(name); check(); },
  };
  const loaderDelay = setTimeout(() => {
    shownAt = performance.now();
    root.classList.add("is-font-loading");
    loader()?.setAttribute("aria-hidden", "false");
    loader()?.setAttribute("aria-busy", "true");
  }, 180);
  // Never reveal half-initialized content just because time elapsed.
  const deadline = setTimeout(recover, 30000);
  document.addEventListener("error", event => {
    if ((event.target instanceof HTMLLinkElement && event.target.rel === "stylesheet" && !event.target.hasAttribute("data-page-nonblocking")) ||
        (event.target instanceof HTMLScriptElement && event.target.type === "module")) {
      failedAsset = true;
      recover();
    }
  }, true);
  document.addEventListener("DOMContentLoaded", () => {
    for (const child of document.body.children) {
      if (!child.matches("[data-page-loader], [data-page-recovery], script, style") && !child.inert) {
        child.inert = true; child.setAttribute("data-page-inert", "");
      }
    }
    if ([...document.querySelectorAll('link[rel="stylesheet"]:not([data-page-nonblocking])')].some(link => !link.disabled && (!link.media || matchMedia(link.media).matches) && !link.sheet)) {
      failedAsset = true; recover();
    } else root.classList.add("page-styles-ready");
    pending.delete("document");
    loadFonts().then(() => window.MongkolWelaPageReady.settle("fonts"), fontFailure);
    check();
  }, { once: true });
})();
