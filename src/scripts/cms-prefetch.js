// Inlined before styles/modules: overlap the authoritative read with asset loading.
(() => {
  const path = window.location.pathname;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  const promise = fetch(`/api/admin/content?path=${encodeURIComponent(path)}`, {
    cache: "no-store", signal: controller.signal,
  }).then(async response => {
    const payload = await response.json();
    if (!response.ok) throw Object.assign(new Error(payload?.error || `Request failed (${response.status})`), { status: response.status });
    return { payload };
  }).catch(error => ({ error })).finally(() => clearTimeout(timer));
  // Resolve failures as data until the runtime can display its normal retry state.
  window.MongkolWelaCMSRequest = { path, promise };
})();
