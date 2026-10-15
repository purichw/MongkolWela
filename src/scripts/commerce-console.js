import { COMMERCE_TYPES, COMMERCE_STATUS } from "../lib/commerce-format.js";
import { commerceApi, e, money, thaiCommerceDate } from "./commerce-ui.js";
import { renderIcon } from "../lib/ui-markup.js";
import { commerceDashboardHeader, commercePreparation, commerceSetupGuide } from "./admin/commerce-dashboard.js";
import { PRODUCT_CATEGORIES } from "../lib/commerce-catalog.js";
import { settlePageContent } from "./page-content-ready.js";

export function mountCommerceConsole(root, { embedded = false } = {}) {
  const lifecycle = new AbortController();
  const listen = (target, type, handler) => target?.addEventListener(type, handler, { signal: lifecycle.signal });
  const content = root.querySelector("[data-seller-content]");
  const message = root.querySelector("[data-seller-message]");
  let data;
  let serviceDisabled = false;
  let section = "products";
  let selectedOrg = "";
  let editing;
  let dirty = false;
  let busy = false;
  let search = "";
  const hash = new URLSearchParams(embedded ? "" : location.hash.slice(1));
  const invitation = hash.get("access_token") ? { accessToken: hash.get("access_token"), refreshToken: hash.get("refresh_token") } : null;
  if (invitation) history.replaceState(null, "", location.pathname);
  const notice = (text, tone = "error") => { message.textContent = text; message.dataset.tone = tone; };
  const label = row => row.title || row.name || row.recipientName || row.email || row.campaignTitle || row.sellerName || row.id;
  const allowLeave = () => !busy && (!dirty || confirm("มีข้อมูลที่ยังไม่ได้บันทึก ต้องการออกจากแบบฟอร์มนี้หรือไม่?"));
  listen(window, "beforeunload", event => { if (dirty || busy) { event.preventDefault(); event.returnValue = ""; } });
  async function session(body, method = "POST") {
    const response = await fetch("/api/commerce/session", { method, headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const payload = await response.json(); if (!response.ok) throw new Error(payload.error); return payload;
  }
  function login() {
    content.innerHTML = `<form class="commerce-login" data-seller-login><h1>${invitation ? "ตั้งรหัสผ่านผู้ขาย" : "เข้าสู่ระบบผู้ขาย"}</h1>${invitation ? '<p>ยืนยันบัญชีที่ได้รับเชิญและกำหนดรหัสผ่านใหม่</p>' : '<label class="commerce-field">อีเมล<input name="email" type="email" autocomplete="username" required /></label>'}<label class="commerce-field">${invitation ? "รหัสผ่านใหม่" : "รหัสผ่าน"}<input name="password" type="password" autocomplete="${invitation ? "new-password" : "current-password"}" ${invitation ? 'minlength="12"' : ""} required /></label><button class="commerce-button" type="submit">${invitation ? "ยืนยันบัญชี" : "เข้าสู่ระบบ"}</button><a href="/admin/">เข้าสู่ระบบผู้ดูแลส่วนกลาง</a></form>`;
    content.setAttribute("aria-busy", "false");
    settlePageContent(root);
  }
  async function load() {
    content.setAttribute("aria-busy", "true");
    notice("");
    try {
      const result = await commerceApi(null, "?view=manage");
      if (lifecycle.signal.aborted) return;
      if (!embedded && result.admin) { location.replace("/admin/?section=commerce"); return; }
      data = result;
      serviceDisabled = false;
      if (!data.organizations.some(o => o.id === selectedOrg)) selectedOrg = data.organizations[0]?.id || "";
      const logout = document.querySelector("[data-seller-logout]");
      if (logout) logout.hidden = data.admin;
      render();
    } catch (error) {
      if (lifecycle.signal.aborted) return;
      if ([401, 403].includes(error.status) && !embedded) login();
      else {
        const disabled = error.code === "COMMERCE_DISABLED";
        serviceDisabled = disabled;
        data = undefined;
        const denied = [401, 403].includes(error.status);
        content.innerHTML = `<section class="commerce-service-state" data-commerce-state="${disabled ? "disabled" : denied ? "denied" : "error"}">
          <div class="commerce-service-symbol">${renderIcon(disabled ? "shopping-bag" : "info")}</div>
          <h2>${disabled ? "ร้านค้าและร่วมบุญยังไม่เปิดบริการ" : denied ? "ไม่สามารถเข้าถึงส่วนจัดการร้านค้า" : "ยังโหลดข้อมูลร้านค้าไม่ได้"}</h2>
          <p>${disabled ? "ยังไม่มีการเปิดรับคำสั่งซื้อหรือการจองร่วมบุญผ่านระบบ" : e(error.message)}</p>
          <div class="commerce-actions"><button class="commerce-button secondary" data-reload>${renderIcon("rotate-ccw")}ลองใหม่</button><a class="commerce-button secondary" href="/shop/">${renderIcon("external-link")}ดูหน้าร้าน</a></div>
        </section>`;
        if (embedded && disabled) content.innerHTML = commercePreparation(section);
      }
      content.setAttribute("aria-busy", "false");
    } finally {
      settlePageContent(root);
    }
  }
  function render() {
    content.setAttribute("aria-busy", "false");
    const tabs = Object.entries(COMMERCE_TYPES).filter(([key]) => data.admin || !["organizations", "members"].includes(key));
    if (!tabs.some(([key]) => key === section)) section = "products";
    content.innerHTML = `<header class="commerce-console-title"><div><p>${data.admin ? "ผู้ดูแลส่วนกลาง" : "พื้นที่ผู้ขาย"}${data.localPreview ? " · ข้อมูลทดสอบในเครื่อง" : ""}</p><h1>${COMMERCE_TYPES[section]}</h1></div><div class="commerce-actions"><button class="commerce-button secondary" data-reload>โหลดล่าสุด</button>${!["orders", "bookings"].includes(section) ? `<button class="commerce-button" data-create ${!selectedOrg && section !== "organizations" ? "disabled" : ""}>เพิ่ม${section === "organizations" ? "ร้านค้า / วัด" : "รายการ"}</button>` : ""}</div></header><nav class="commerce-console-tabs" aria-label="ส่วนจัดการ">${tabs.map(([key, title]) => `<button type="button" data-section="${key}" aria-current="${section === key ? "page" : "false"}">${title}</button>`).join("")}</nav><div class="commerce-filters"><label>ร้านค้า / ผู้จัด<select data-organization><option value="">${data.admin ? "ทุกร้าน" : "เลือกร้าน"}</option>${data.organizations.map(o => `<option value="${o.id}" ${selectedOrg === o.id ? "selected" : ""}>${e(o.name)}</option>`).join("")}</select></label><label>ค้นหา<input type="search" data-search value="${e(search)}" /></label></div><div data-management-view></div>`;
    if (editing) renderEditor(); else renderRows();
    if (embedded) {
      content.insertAdjacentHTML("afterbegin", commerceDashboardHeader(data, section));
      content.insertAdjacentHTML("beforeend", '<div data-commerce-guide-panel></div>');
    }
  }
  function renderRows() {
    const rows = data[section].filter(row => (!selectedOrg || (section === "organizations" ? row.id : row.orgId) === selectedOrg) && `${label(row)} ${row.contact || ""}`.toLowerCase().includes(search.toLowerCase()));
    content.querySelector("[data-management-view]").innerHTML = rows.length ? `<div class="commerce-table-wrap"><table class="commerce-table"><thead><tr><th>รายการ</th><th>ร้านค้า / ผู้จัด</th><th>สถานะ</th><th>ข้อมูล</th><th><span class="commerce-sr-only">จัดการ</span></th></tr></thead><tbody>${rows.map(row => `<tr><td><strong>${e(label(row))}</strong><small>${e(row.sku || row.contact || row.province || "")}</small></td><td>${e(data.organizations.find(o => o.id === (section === "organizations" ? row.id : row.orgId))?.name || "")}</td><td><span class="commerce-status">${e(COMMERCE_STATUS[row.status] || row.status)}</span></td><td>${section === "products" ? `${money(row.priceSatang)} · ${row.stock} ชิ้น` : section === "orders" ? money(row.totalSatang) : section === "bookings" ? `${row.quantity} ${row.kind === "host" ? "คำขอ" : "กอง"}${row.donationReceived ? " · รับเงินแล้ว" : ""}` : section === "campaigns" ? thaiCommerceDate(row.eventDate) : thaiCommerceDate(row.updatedAt)}</td><td><button class="commerce-button secondary" data-edit="${row.id}">${["orders", "bookings"].includes(section) ? "ดูรายการ" : "แก้ไข"}</button></td></tr>`).join("")}</tbody></table></div>` : '<p class="commerce-empty">ยังไม่มีรายการ</p>';
  }
  function options(values, current) { return values.map(([value, title]) => `<option value="${e(value)}" ${String(current) === String(value) ? "selected" : ""}>${e(title)}</option>`).join(""); }
  function field(name, title, type = "text", { required = true, values = [], max = 2000, min = "", step = "" } = {}) {
    const value = editing[name] ?? "";
    return `<label class="commerce-field ${type === "textarea" ? "wide" : ""}">${e(title)}${type === "select" ? `<select name="${name}" aria-label="${e(title)}" ${required ? "required" : ""}>${options(values, value)}</select>` : type === "textarea" ? `<textarea name="${name}" rows="3" maxlength="${max}" ${required ? "required" : ""}>${e(value)}</textarea>` : `<input name="${name}" type="${type}" value="${e(value)}" ${required ? "required" : ""} maxlength="${max}" ${min !== "" ? `min="${min}"` : ""} ${step ? `step="${step}"` : ""} />`}</label>`;
  }
  function renderEditor() {
    const target = content.querySelector("[data-management-view]");
    if (["orders", "bookings"].includes(section)) {
      const r = editing;
      target.innerHTML = `<section class="commerce-editor"><header class="commerce-section-heading"><h2>${e(label(r))}</h2><button class="commerce-button secondary" data-close>กลับไปรายการ</button></header><p>${e(COMMERCE_STATUS[r.status])} · ${e(r.id)}</p><dl><dt>ผู้ติดต่อ</dt><dd>${e(r.name)}</dd><dt>ช่องทางติดต่อ</dt><dd>${e(r.contact)}</dd>${r.address ? `<dt>ที่อยู่จัดส่ง</dt><dd>${e(r.address)}</dd>` : ""}</dl>${r.lines ? r.lines.map(l => `<p>${e(l.title)} (${e(l.sku)}) × ${l.quantity} · ${money(l.priceSatang * l.quantity)}</p>`).join("") + `<strong>รวม ${money(r.totalSatang)}</strong><p>ยังไม่มีการรับชำระเงินออนไลน์</p>` : `<p>${r.quantity} ${r.kind === "host" ? "คำขอเจ้าภาพหลัก" : "กอง"} · ${money(r.pledgedSatang)}</p><p>${e(r.note)}</p><p>${r.donationReceived ? `ผู้จัดรับรองการรับเงิน ${money(r.receivedSatang)} อ้างอิง ${e(r.receiptReference)}` : "ยังไม่ได้รับรองการรับเงิน"}</p>`}<p>${e(r.statusNote)}</p>${!["cancelled", "expired"].includes(r.status) ? `<form data-transition><label class="commerce-field">หมายเหตุการดำเนินการ<textarea name="note" required maxlength="500"></textarea></label>${section === "bookings" && r.status === "confirmed" && !r.donationReceived ? '<div class="commerce-form-grid"><label class="commerce-field">ยอดรับเงินจริง (บาท)<input type="number" name="receivedBaht" min="0.01" step="0.01" /></label><label class="commerce-field">หลักฐานอ้างอิง<input name="reference" maxlength="200" /></label></div>' : ""}<div class="commerce-actions">${section === "orders" && r.status === "requested" ? '<button class="commerce-button" type="submit" name="action" value="accept">ยืนยันสินค้าและสำรอง 24 ชั่วโมง</button>' : ""}${section === "bookings" && ["requested", "held"].includes(r.status) ? '<button class="commerce-button" type="submit" name="action" value="confirm">ยืนยันการจอง</button>' : ""}${section === "bookings" && r.status === "confirmed" && !r.donationReceived ? '<button class="commerce-button" type="submit" name="action" value="receipt">รับรองว่าได้รับเงินจริง</button>' : ""}<button class="commerce-button secondary" type="submit" name="action" value="cancel">ยกเลิกรายการ</button></div></form>` : ""}</section>`;
      return;
    }
    const organization = data.organizations.find(o => o.id === (editing.orgId || selectedOrg));
    const temples = data.temples.filter(t => data.admin || organization?.templeIds.includes(t.id));
    const templeValues = [["", "ไม่เชื่อมกับวัด"], ...temples.map(t => [t.id, `${t.name} · ${t.province}`])];
    let fields = "";
    if (section === "organizations") fields = field("name", "ชื่อร้านค้า / วัด") + field("kind", "ประเภท", "select", { values: [["platform", "มงคลเวลาจำหน่าย"], ["temple", "วัด"], ["shop", "ร้านค้าอิสระ"]] }) + field("contact", "ช่องทางติดต่อ") + field("fulfillment", "ผู้รับผิดชอบการจัดส่ง") + field("shippingBaht", "ค่าจัดส่งต่อคำสั่งซื้อ (บาท)", "number", { min: 0, step: "0.01" }) + field("returnPolicy", "เงื่อนไขจัดส่ง / คืนสินค้า", "textarea") + `<fieldset class="commerce-temple-list wide"><legend>วัดที่ตรวจสอบความเกี่ยวข้องแล้ว</legend>${data.temples.map(t => `<label class="commerce-check"><input type="checkbox" name="templeIds" value="${e(t.id)}" ${editing.templeIds?.includes(t.id) ? "checked" : ""} />${e(t.name)} · ${e(t.province)}</label>`).join("")}</fieldset>`;
    if (section === "products") fields = field("title", "ชื่อสินค้า") + field("sku", "SKU / รุ่น") + field("description", "รายละเอียดและแหล่งที่มา", "textarea") + field("priceBaht", "ราคาต่อชิ้น (บาท)", "number", { min: "0.01", step: "0.01" }) + field("stock", "สต็อกรวม (รวมที่สำรองไว้)", "number", { min: 0 }) + field("material", "วัสดุ", "text", { required: false }) + field("size", "ขนาด / ตัวเลือก", "text", { required: false }) + field("imageUrl", "URL หรือพาธรูปสินค้า", "text", { required: false }) + field("imageAlt", "คำบรรยายภาพ", "text", { required: false }) + field("sourceUrl", "URL แหล่งที่มาสินค้า", "url", { required: false }) + field("templeId", "วัดที่เกี่ยวข้อง", "select", { required: false, values: templeValues });
    if (section === "campaigns") fields = field("title", "ชื่องาน / รายการ") + field("templeId", "วัดที่จัดงาน", "select", { values: templeValues }) + field("kind", "ประเภทการจอง", "select", { values: [["fund", "ร่วมเป็นเจ้าภาพรายกอง"], ["host", "ขอเป็นเจ้าภาพหลัก"]] }) + field("eventDate", "วันที่จัดงาน", "date") + field("closeDate", "วันปิดรับจอง", "date") + field("capacity", "จำนวนกอง / เจ้าภาพหลัก 1 ราย", "number", { min: 1 }) + field("amountBaht", "ยอดร่วมบุญต่อกอง (บาท)", "number", { min: 0, step: "0.01" }) + field("description", "วัตถุประสงค์และรายละเอียด", "textarea") + field("sourceUrl", "URL ประกาศผู้จัด", "url") + field("cancellationPolicy", "เงื่อนไขยกเลิกหรือเลื่อนงาน", "textarea") + field("channelId", "ช่องทางบริจาคที่ผ่านการตรวจสอบ", "select", { required: false, values: [["", "ยังไม่เชื่อมช่องทาง"], ...data.channels.filter(c => c.status === "published").map(c => [c.id, c.recipientName])] });
    if (section === "channels") fields = field("templeId", "วัดผู้รับบริจาค", "select", { values: templeValues }) + field("recipientName", "ชื่อหน่วยรับบริจาค") + field("province", "จังหวัด") + field("recipientId", "เลขหน่วยรับบริจาค 13 หลัก", "text", { required: false, max: 13 }) + field("destinationKind", "ประเภทปลายทาง", "select", { values: [["temple", "หน้ารับบริจาคของวัด"], ["provider", "หน้ารับบริจาคของธนาคาร / หน่วยงาน"], ["registry", "ทะเบียนกลาง: สำหรับตรวจสอบเท่านั้น"]] }) + field("url", "URL ปลายทาง", "url") + field("sourceUrl", "URL หลักฐานยืนยันความเกี่ยวข้อง", "url") + field("verifiedAt", "วันที่ตรวจสอบ", "date", { required: false });
    if (section === "members") fields = field("email", "อีเมล", "email") + field("userId", "รหัสผู้ใช้ Supabase Auth (สำหรับบัญชีเดิม)", "text", { required: false });
    if (section === "products") fields += field("category", "หมวดสินค้า", "select", { required: false, values: [["", "ยังไม่ระบุหมวด"], ...PRODUCT_CATEGORIES.map(category => [category.id, category.label])] });
    const statuses = { organizations: ["draft", "active", "suspended"], products: ["draft", "published", "archived"], campaigns: ["draft", "published", "paused", "closed", "cancelled", "archived"], channels: data.admin ? ["draft", "review", "published", "archived"] : ["review"], members: ["active", "suspended"] }[section];
    fields += field("status", "สถานะ", "select", { values: statuses.map(s => [s, COMMERCE_STATUS[s]]) });
    target.innerHTML = `<form class="commerce-editor" data-editor><header class="commerce-section-heading"><h2>${editing.id ? "แก้ไขรายการ" : "เพิ่มรายการ"}</h2><button type="button" class="commerce-button secondary" data-close>ยกเลิก</button></header>${section !== "organizations" ? `<p>ร้านค้า / ผู้จัด: <strong>${e(organization?.name || "กรุณาเลือกร้านค้าก่อน")}</strong></p>` : ""}<div class="commerce-form-grid">${fields}</div>${section === "channels" && data.admin ? '<label class="commerce-check"><input type="checkbox" name="reviewConfirmed" /> ตรวจสอบชื่อวัด จังหวัด เลขหน่วยรับบริจาค และปลายทางแล้ว (ต้องยืนยันก่อนเผยแพร่)</label>' : ""}<div class="commerce-actions"><button type="submit" class="commerce-button">บันทึกรายการ</button>${section === "members" && !editing.id ? `<button type="button" class="commerce-button secondary" data-invite ${data.localPreview ? "disabled" : ""}>ส่งอีเมลเชิญ${data.localPreview ? " (ไม่ส่งใน local)" : ""}</button>` : ""}</div></form>`;
  }
  function edit(row = {}) {
    editing = { orgId: selectedOrg, status: section === "members" ? "active" : section === "channels" && !data.admin ? "review" : "draft", kind: section === "organizations" ? "shop" : "fund", capacity: 1, stock: 0, destinationKind: "temple", ...row, priceBaht: (row.priceSatang || 0) / 100, shippingBaht: (row.shippingSatang || 0) / 100, amountBaht: (row.amountSatang || 0) / 100 };
    dirty = false; renderEditor();
  }
  listen(content, "input", event => { if (event.target.matches("[data-search]")) { search = event.target.value; if (!editing) renderRows(); } else if (event.target.closest("form")) dirty = true; });
  listen(content, "change", event => { if (event.target.matches("[data-organization]")) { if (!allowLeave()) { event.target.value = selectedOrg; return; } selectedOrg = event.target.value; editing = null; dirty = false; render(); } else if (event.target.closest("form")) dirty = true; });
  listen(content, "click", async event => {
    const button = event.target.closest("button"); if (!button || busy) return;
    if (button.hasAttribute("data-commerce-guide")) {
      const value = button.dataset.commerceGuide;
      const step = value === "all" ? "all" : Number(value);
      if (serviceDisabled) content.innerHTML = commercePreparation(section, step);
      else if (data) content.querySelector("[data-commerce-guide-panel]").innerHTML = commerceSetupGuide(data, step);
      const details = content.querySelector(`[data-commerce-step="${step === "all" ? 0 : step}"]`);
      details?.scrollIntoView({ block: "center", behavior: "smooth" });
      details?.querySelector("summary")?.focus({ preventScroll: true });
      return;
    }
    if (button.dataset.commerceSection) {
      if (!allowLeave()) return;
      section = button.dataset.commerceSection; editing = null; dirty = false; search = "";
      if (serviceDisabled) content.innerHTML = commercePreparation(section);
      else if (data) render();
      return;
    }
    if (button.dataset.section) {
      // These tabs belong to commerce, not the enclosing admin portal router.
      event.stopPropagation();
      if (!allowLeave()) return;
      section = button.dataset.section; editing = null; dirty = false; search = ""; render();
    }
    if (button.hasAttribute("data-create")) { if (!allowLeave()) return; edit(); }
    if (button.dataset.edit) { if (!allowLeave()) return; edit(data[section].find(r => r.id === button.dataset.edit)); }
    if (button.hasAttribute("data-close")) { if (!allowLeave()) return; editing = null; dirty = false; renderRows(); }
    if (button.hasAttribute("data-reload")) { if (!allowLeave()) return; editing = null; dirty = false; await load(); }
    if (button.hasAttribute("data-invite")) {
      const email = content.querySelector('[name="email"]').value;
      if (!confirm(`ส่งอีเมลเชิญ ${email} เข้าร้านค้านี้?`)) return;
      busy = true; button.disabled = true;
      try { await commerceApi({ op: "invite", orgId: selectedOrg, email }); dirty = false; editing = null; await load(); notice("ส่งคำเชิญแล้ว", "success"); } catch (error) { notice(error.message); } finally { busy = false; button.disabled = false; }
    }
  });
  listen(content, "submit", async event => {
    event.preventDefault(); if (busy) return; const form = event.target;
    const values = Object.fromEntries(new FormData(form));
    if (form.matches("[data-editor]") && section === "channels" && values.status === "published" && !values.reviewConfirmed) { notice("กรุณายืนยันการตรวจสอบก่อนเผยแพร่"); return; }
    const action = event.submitter?.value;
    if (form.matches("[data-transition]") && ["cancel", "receipt"].includes(action) && !confirm(action === "receipt" ? "ยืนยันว่าได้ตรวจสอบและรับเงินจริงแล้ว? ไม่ใช่เพียงได้รับสลิป" : "ยืนยันยกเลิกรายการ? เงินที่รับแล้วต้องดำเนินการกับผู้รับเงินแยกต่างหาก")) return;
    busy = true; const submit = event.submitter; if (submit) submit.disabled = true; notice("");
    try {
      if (form.matches("[data-seller-login]")) { await session(invitation ? { ...invitation, newPassword: values.password } : values); dirty = false; await load(); }
      else if (form.matches("[data-editor]")) {
        const payload = { ...values, orgId: editing.orgId || selectedOrg };
        for (const [source, dest] of [["priceBaht", "priceSatang"], ["shippingBaht", "shippingSatang"], ["amountBaht", "amountSatang"]]) if (source in payload) payload[dest] = Math.round(Number(payload[source]) * 100);
        if (section === "organizations") payload.templeIds = new FormData(form).getAll("templeIds");
        await commerceApi({ op: "save", table: section, id: editing.id, expectedVersion: editing.version, data: payload });
        dirty = false; editing = null; await load(); notice("บันทึกแล้ว", "success");
      } else if (form.matches("[data-transition]")) {
        await commerceApi({ op: "transition", table: section, id: editing.id, expectedVersion: editing.version, action, note: values.note, reference: values.reference, receivedSatang: Math.round(Number(values.receivedBaht) * 100) });
        dirty = false; editing = null; await load(); notice("บันทึกสถานะแล้ว", "success");
      }
    } catch (error) { notice(error.message); }
    finally { busy = false; if (submit) submit.disabled = false; }
  });
  if (!embedded) listen(document.querySelector("[data-seller-logout]"), "click", async () => { if (!allowLeave()) return; try { await session(null, "DELETE"); dirty = false; location.reload(); } catch (error) { notice(error.message); } });
  if (invitation) login(); else load();
  return { canLeave: allowLeave, isDirty: () => dirty || busy, destroy: () => lifecycle.abort() };
}
