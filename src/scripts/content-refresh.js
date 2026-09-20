export function startContentRefresh(refresh, { intervalMs = 60000, eventDelayMs = 250 } = {}) {
  let timer;
  let busy = false;
  let stopped = false;

  function schedule(delay = intervalMs) {
    clearTimeout(timer);
    if (!stopped && document.visibilityState === "visible") timer = setTimeout(check, delay);
  }

  async function check() {
    if (stopped || busy || document.visibilityState !== "visible") return;
    busy = true;
    try {
      await refresh();
    } finally {
      busy = false;
      schedule();
    }
  }

  // Focus and visibility commonly fire together; combine them into one request.
  const resume = () => schedule(eventDelayMs);
  const pageShow = (event) => { if (event.persisted) resume(); };
  const pageHide = () => clearTimeout(timer);
  document.addEventListener("visibilitychange", resume);
  window.addEventListener("focus", resume);
  window.addEventListener("online", resume);
  window.addEventListener("pageshow", pageShow);
  window.addEventListener("pagehide", pageHide);
  schedule();

  return () => {
    stopped = true;
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", resume);
    window.removeEventListener("focus", resume);
    window.removeEventListener("online", resume);
    window.removeEventListener("pageshow", pageShow);
    window.removeEventListener("pagehide", pageHide);
  };
}
