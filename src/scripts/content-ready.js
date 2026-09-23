export function onCmsContent(callback, { once = false } = {}) {
  if (window.MongkolWelaCMS?.content) {
    callback(window.MongkolWelaCMS.content);
    if (once) return;
  }
  document.addEventListener("mw:cms-content-ready", event => callback(event.detail.content), { once });
}
