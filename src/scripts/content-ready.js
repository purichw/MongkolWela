export function onCmsContent(callback, { once = false, onUnavailable } = {}) {
  let received = false;
  const receive = content => { received = true; callback(content); };
  const unavailable = () => { if (!received) onUnavailable?.(); };
  if (window.MongkolWelaCMS?.content) {
    receive(window.MongkolWelaCMS.content);
    if (once) return;
  }
  if (document.documentElement.dataset.cmsReady === "false") unavailable();
  document.addEventListener("mw:cms-content-failed", unavailable);
  document.addEventListener("mw:cms-content-ready", event => {
    document.removeEventListener("mw:cms-content-failed", unavailable);
    receive(event.detail.content);
  }, { once });
}
