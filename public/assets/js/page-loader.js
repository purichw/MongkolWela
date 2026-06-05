const selectors = {
  loader: "[data-page-loader]",
  progress: "[data-loader-progress]",
};

let progress = 8;
let target = 86;
let frame = 0;
let hideTimer = 0;

export function initPageLoader() {
  const loader = document.querySelector(selectors.loader);
  const progressBar = document.querySelector(selectors.progress);
  const progressRoot = loader?.matches("[role='progressbar']") ? loader : null;

  if (!loader || !progressBar || !progressRoot) return;

  const state = { loader, progressBar, progressRoot };
  startLoader(state, "is-loading");

  if (document.readyState === "complete") {
    window.setTimeout(() => finishLoader(state), 220);
  } else {
    window.addEventListener("load", () => finishLoader(state), { once: true });
  }

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      finishLoader(state);
    }
  });

  document.addEventListener("click", (event) => {
    const targetElement = event.target instanceof Element ? event.target : null;
    const link = targetElement?.closest("a");
    if (!shouldShowNavigationLoader(event, link)) return;

    startLoader(state, "is-navigating");
  }, true);

  window.addEventListener("beforeunload", () => {
    startLoader(state, "is-navigating");
  });

  window.monkolWelaLoader = {
    show: () => startLoader(state, "is-navigating"),
    hide: () => finishLoader(state),
  };
}

function startLoader(state, className) {
  window.clearTimeout(hideTimer);
  document.documentElement.classList.add(className);
  state.loader.setAttribute("aria-hidden", "false");
  state.progressRoot.setAttribute("aria-valuenow", String(Math.round(progress)));
  target = className === "is-navigating" ? 92 : 86;
  progress = Math.max(progress, className === "is-navigating" ? 18 : 8);
  setProgress(state, progress);
  tickProgress(state);
}

function finishLoader(state) {
  target = 100;
  setProgress(state, 100);
  window.cancelAnimationFrame(frame);

  hideTimer = window.setTimeout(() => {
    document.documentElement.classList.remove("is-loading", "is-navigating");
    state.loader.setAttribute("aria-hidden", "true");
    progress = 8;
    target = 86;
    setProgress(state, progress);
  }, 360);
}

function tickProgress(state) {
  window.cancelAnimationFrame(frame);

  const update = () => {
    const distance = target - progress;
    const step = Math.max(0.08, distance * 0.022);
    progress = Math.min(target, progress + step);
    setProgress(state, progress);

    if (progress < target) {
      frame = window.requestAnimationFrame(update);
    }
  };

  frame = window.requestAnimationFrame(update);
}

function setProgress(state, value) {
  const nextValue = Math.max(0, Math.min(100, value));
  state.progressBar.style.width = `${nextValue}%`;
  state.progressRoot.setAttribute("aria-valuenow", String(Math.round(nextValue)));
}

function shouldShowNavigationLoader(event, link) {
  if (!link || event.defaultPrevented) return false;
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (link.target && link.target !== "_self") return false;
  if (link.hasAttribute("download")) return false;

  const href = link.getAttribute("href") || "";
  if (!href || href.startsWith("#")) return false;
  if (/^(mailto:|tel:|javascript:)/i.test(href)) return false;

  const url = new URL(link.href, window.location.href);
  if (url.origin !== window.location.origin) return false;

  const samePageHash =
    url.pathname === window.location.pathname &&
    url.search === window.location.search &&
    url.hash;

  return !samePageHash;
}
