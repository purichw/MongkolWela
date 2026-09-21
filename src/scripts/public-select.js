let manager;
let loading;
let scheduled = false;

export function syncPublicSelects(root = document) {
  manager?.sync(root);
}

export function initPublicSelects() {
  const root = document.querySelector("main");
  if (!root || document.body.matches(".admin-page, .commerce-console")) return;

  const enhance = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(async () => {
      scheduled = false;
      if (!manager && !root.querySelector("select:not([multiple]):not([data-native-select])")) return;
      try {
        loading ||= import("./public-select-control.js");
        manager ||= await loading;
        manager.enhance(root);
      } catch (error) {
        loading = null;
        console.warn("Custom selects unavailable; keeping native controls", error);
      }
    });
  };

  enhance();
  new MutationObserver(records => {
    if (records.some(record => [...record.addedNodes, ...record.removedNodes].some(node =>
      node instanceof Element && (node.matches("select, .mw-select") || node.querySelector("select"))
    ))) enhance();
  }).observe(root, { childList: true, subtree: true });

  root.addEventListener("change", () => queueMicrotask(() => syncPublicSelects(root)));
  // A user-triggered reset applies native defaults after the event's microtasks.
  root.addEventListener("reset", () => setTimeout(() => syncPublicSelects(root), 0));
}
