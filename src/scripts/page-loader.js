const selectors = {
  loader: "[data-page-loader]",
  progress: "[data-loader-progress]",
  status: "[data-loader-status]",
  timeout: "[data-loader-timeout]",
};

const SESSION_KEY = "mongkolwela.loader.v2.seen";
const FIRST_SESSION_DURATION = 3000;
const SLOW_LOAD_DELAY = 850;
const NAVIGATION_DELAY = 260;
const TIMEOUT_DELAY = 4200;
const LONG_TIMEOUT_DELAY = 9000;

const messages = {
  intro: "กำลังเตรียมข้อมูลมงคล",
  slow: "กำลังเตรียมข้อมูลให้พร้อม",
  navigation: "กำลังเปิดหน้าถัดไป",
  timeout: "โหลดนานกว่าปกติเล็กน้อย กำลังรอข้อมูลให้พร้อม",
  longTimeout: "การเชื่อมต่ออาจช้า ระบบยังพยายามโหลดหน้าเว็บอยู่",
};

export function initPageLoader() {
  const loader = document.querySelector(selectors.loader);
  const progressBar = document.querySelector(selectors.progress);
  const status = document.querySelector(selectors.status);
  const timeout = document.querySelector(selectors.timeout);
  const progressRoot = loader?.matches("[role='progressbar']") ? loader : null;

  if (!loader || !progressBar || !progressRoot) return;

  const state = {
    loader,
    progressBar,
    progressRoot,
    status,
    timeout,
    frame: 0,
    hideTimer: 0,
    slowTimer: 0,
    navigationTimer: 0,
    timeoutTimer: 0,
    longTimeoutTimer: 0,
    progress: 8,
    target: 86,
    visible: false,
    minVisibleUntil: 0,
    finishRequested: false,
  };

  const firstSession = shouldShowFirstSessionLoader();

  if (firstSession) {
    markSessionSeen();
    startLoader(state, {
      className: "is-loading",
      minDuration: FIRST_SESSION_DURATION,
      statusText: messages.intro,
      target: 92,
    });
  } else {
    document.documentElement.classList.remove("is-loading");
    scheduleSlowLoad(state);
  }

  if (document.readyState === "complete") {
    finishLoader(state);
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

    scheduleNavigationLoader(state);
  }, true);

  window.addEventListener("beforeunload", () => {
    startLoader(state, {
      className: "is-navigating",
      minDuration: 0,
      statusText: messages.navigation,
      target: 94,
    });
  });

  window.monkolWelaLoader = {
    show: () => startLoader(state, {
      className: "is-navigating",
      minDuration: 0,
      statusText: messages.navigation,
      target: 94,
    }),
    hide: () => finishLoader(state),
  };
}

function startLoader(state, options) {
  window.clearTimeout(state.hideTimer);
  window.clearTimeout(state.slowTimer);
  window.clearTimeout(state.navigationTimer);
  window.clearTimeout(state.timeoutTimer);
  window.clearTimeout(state.longTimeoutTimer);
  document.documentElement.classList.add(options.className);
  state.loader.classList.remove("has-timeout", "has-long-timeout");
  state.loader.setAttribute("aria-hidden", "false");
  state.progressRoot.setAttribute("aria-busy", "true");
  state.progressRoot.setAttribute("aria-valuenow", String(Math.round(state.progress)));
  state.visible = true;
  state.finishRequested = false;
  state.minVisibleUntil = performance.now() + (options.minDuration || 0);
  state.target = options.target || 86;
  state.progress = Math.max(state.progress, options.className === "is-navigating" ? 18 : 8);
  setText(state.status, options.statusText || messages.slow);
  setText(state.timeout, messages.timeout);
  setProgress(state, state.progress);
  tickProgress(state);
  scheduleTimeoutMessages(state);
}

function finishLoader(state) {
  window.clearTimeout(state.slowTimer);
  window.clearTimeout(state.navigationTimer);
  state.finishRequested = true;

  if (!state.visible) {
    resetLoader(state);
    return;
  }

  const wait = Math.max(0, state.minVisibleUntil - performance.now());
  if (wait > 0) {
    window.clearTimeout(state.hideTimer);
    state.hideTimer = window.setTimeout(() => finishLoader(state), wait);
    return;
  }

  state.target = 100;
  setProgress(state, 100);
  window.cancelAnimationFrame(state.frame);

  state.hideTimer = window.setTimeout(() => {
    document.documentElement.classList.remove("is-loading", "is-navigating");
    resetLoader(state);
  }, 360);
}

function resetLoader(state) {
  window.clearTimeout(state.timeoutTimer);
  window.clearTimeout(state.longTimeoutTimer);
  window.cancelAnimationFrame(state.frame);
  state.visible = false;
  state.finishRequested = false;
  state.minVisibleUntil = 0;
  state.loader.classList.remove("has-timeout", "has-long-timeout");
  state.progressRoot.removeAttribute("aria-busy");
  state.progressRoot.setAttribute("aria-valuenow", "8");
  state.loader.setAttribute("aria-hidden", "true");
  state.progress = 8;
  state.target = 86;
  setProgress(state, state.progress);
  setText(state.status, messages.intro);
  setText(state.timeout, messages.timeout);
}

function scheduleSlowLoad(state) {
  if (document.readyState === "complete") return;

  window.clearTimeout(state.slowTimer);
  state.slowTimer = window.setTimeout(() => {
    if (document.readyState === "complete" || state.visible) return;

    startLoader(state, {
      className: "is-loading",
      minDuration: 650,
      statusText: messages.slow,
      target: 88,
    });
  }, SLOW_LOAD_DELAY);
}

function scheduleNavigationLoader(state) {
  window.clearTimeout(state.navigationTimer);
  state.navigationTimer = window.setTimeout(() => {
    startLoader(state, {
      className: "is-navigating",
      minDuration: 0,
      statusText: messages.navigation,
      target: 94,
    });
  }, NAVIGATION_DELAY);
}

function scheduleTimeoutMessages(state) {
  state.timeoutTimer = window.setTimeout(() => {
    if (!state.visible) return;
    state.loader.classList.add("has-timeout");
    setText(state.status, messages.slow);
    setText(state.timeout, messages.timeout);
  }, TIMEOUT_DELAY);

  state.longTimeoutTimer = window.setTimeout(() => {
    if (!state.visible) return;
    state.loader.classList.add("has-long-timeout");
    setText(state.timeout, messages.longTimeout);
  }, LONG_TIMEOUT_DELAY);
}

function shouldShowFirstSessionLoader() {
  try {
    return window.sessionStorage.getItem(SESSION_KEY) !== "1";
  } catch {
    return true;
  }
}

function markSessionSeen() {
  try {
    window.sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    // If sessionStorage is blocked, the intro loader remains per page.
  }
}

function setText(element, text) {
  if (element) {
    element.textContent = text;
  }
}

function tickProgress(state) {
  window.cancelAnimationFrame(state.frame);

  const update = () => {
    const distance = state.target - state.progress;
    const step = Math.max(0.08, distance * 0.022);
    state.progress = Math.min(state.target, state.progress + step);
    setProgress(state, state.progress);

    if (state.progress < state.target) {
      state.frame = window.requestAnimationFrame(update);
    }
  };

  state.frame = window.requestAnimationFrame(update);
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
