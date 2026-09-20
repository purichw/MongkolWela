import { commerceApi, e, money, thaiCommerceDate, COMMERCE_STATUS, orgName, productMarkup, campaignMarkup, channelMarkup, inputField } from "./commerce-ui.js";
import { startContentRefresh } from "./content-refresh.js";

const root = document.querySelector("[data-commerce-public]");
if (root) init(root);
function init(root) {
  const content = root.querySelector("[data-commerce-content]");
  const message = root.querySelector("[data-commerce-message]");
  const params = new URLSearchParams(location.search);
  const mode = root.dataset.commercePublic;
  let catalog;
  let busy = false;
  let receipt;
  let search = "";
  let sellerFilter = "";
  let cart;
  try { cart = JSON.parse(localStorage.getItem("mw-commerce-cart") || "[]"); if (!Array.isArray(cart)) cart = []; } catch { cart = []; }
  let secret;
  try { secret = sessionStorage.getItem("mw-commerce-access") || `${crypto.randomUUID()}${crypto.randomUUID()}`; sessionStorage.setItem("mw-commerce-access", secret); } catch { secret = `${crypto.randomUUID()}${crypto.randomUUID()}`; }
  let requestId = crypto.randomUUID();
  const notice = text => { message.textContent = text; };
  function saveCart() { try { localStorage.setItem("mw-commerce-cart", JSON.stringify(cart)); } catch { notice("ตะกร้าจะอยู่เฉพาะหน้านี้ เนื่องจากเบราว์เซอร์ไม่อนุญาตให้บันทึก"); } document.querySelectorAll("[data-cart-count]").forEach(el => { el.textContent = String(cart.reduce((n, l) => n + l.quantity, 0)); }); }
  const filters = () => `<div class="commerce-filters"><label>ค้นหา<input type="search" data-search value="${e(search)}" placeholder="ชื่อสินค้า งานบุญ หรือวัด" /></label><label>ผู้จำหน่าย / ผู้จัด<select data-seller><option value="">ทั้งหมด</option>${catalog.organizations.map(o => `<option value="${e(o.id)}" ${sellerFilter === o.id ? "selected" : ""}>${e(o.name)}</option>`).join("")}</select></label></div><div data-catalog-list></div>`;
  function renderList() {
    const target = content.querySelector("[data-catalog-list]");
    if (!target) return;
    const rows = (mode === "shop" ? catalog.products : catalog.campaigns).filter(row => (!sellerFilter || row.orgId === sellerFilter) && `${row.title} ${orgName(catalog, row.orgId)}`.toLowerCase().includes(search.toLowerCase()));
    target.innerHTML = rows.length ? `<div class="${mode === "shop" ? "commerce-products" : "commerce-campaigns"}">${rows.map(row => mode === "shop" ? productMarkup(row, catalog) : campaignMarkup(row, catalog)).join("")}</div>` : '<p class="commerce-empty">ยังไม่มีรายการที่ตรงกับเงื่อนไข</p>';
  }
  function render() {
    content.setAttribute("aria-busy", "false");
    if (receipt) return renderReceipt();
    if (params.get("view") === "cart") return renderCart();
    const product = catalog.products.find(p => p.id === params.get("product"));
    const campaign = catalog.campaigns.find(c => c.id === params.get("campaign"));
    if (params.has("product")) {
      if (!product) { content.innerHTML = '<p>สินค้านี้ไม่เปิดขายแล้ว</p><a href="/shop/">กลับไปหน้าร้าน</a>'; return; }
      const seller = catalog.organizations.find(o => o.id === product.orgId);
      content.innerHTML = `<a href="/shop/">กลับไปหน้าร้าน</a><div class="commerce-detail"><img src="${e(product.imageUrl)}" alt="${e(product.imageAlt)}" width="640" height="560" /><div><p>${e(seller.name)}</p><h2>${e(product.title)}</h2><strong class="commerce-price">${money(product.priceSatang)}</strong><p>${e(product.description)}</p><dl><dt>รุ่น / รหัสสินค้า</dt><dd>${e(product.sku)}</dd><dt>วัสดุ / ขนาด</dt><dd>${e([product.material, product.size].filter(Boolean).join(" / "))}</dd><dt>ผู้จัดส่ง</dt><dd>${e(seller.fulfillment)}</dd><dt>ค่าจัดส่งต่อคำสั่งซื้อ</dt><dd>${money(seller.shippingSatang)}</dd></dl><p>คงเหลือ ${product.available} ชิ้น</p><div class="commerce-inline"><label>จำนวน<input type="number" min="1" max="${Math.min(99, product.available)}" value="1" data-product-quantity /></label><button class="commerce-button" data-add="${e(product.id)}" ${product.available ? "" : "disabled"}>เพิ่มลงตะกร้า</button></div><p>${e(seller.returnPolicy)}</p><a href="${e(product.sourceUrl)}" target="_blank" rel="noopener noreferrer">แหล่งที่มาของสินค้า ↗</a></div></div>`;
      return;
    }
    if (params.has("campaign")) {
      if (!campaign) { content.innerHTML = '<p>ยังไม่เปิดรับรายการนี้</p><a href="/merit/">กลับไปรายการร่วมบุญ</a>'; return; }
      const channel = catalog.channels.find(c => c.id === campaign.channelId);
      const open = campaign.status === "published" && !campaign.closed && campaign.available > 0;
      content.innerHTML = `<a href="/merit/">กลับไปรายการร่วมบุญ</a><div class="commerce-detail commerce-merit-detail"><section><p>${e(orgName(catalog, campaign.orgId))}</p><h2>${e(campaign.title)}</h2><p>${e(campaign.description)}</p><dl><dt>วันจัดงาน</dt><dd>${e(thaiCommerceDate(campaign.eventDate))}</dd><dt>ปิดรับจอง</dt><dd>${e(thaiCommerceDate(campaign.closeDate))}</dd><dt>รูปแบบ</dt><dd>${campaign.kind === "host" ? "ขอเป็นเจ้าภาพหลัก โดยวัดพิจารณายืนยัน" : `${money(campaign.amountSatang)} / กอง · คงเหลือ ${campaign.available} กอง`}</dd></dl><p>${e(campaign.cancellationPolicy)}</p><a href="${e(campaign.sourceUrl)}" target="_blank" rel="noopener noreferrer">ประกาศจากผู้จัด ↗</a>${channel ? `<h3>ช่องทางบริจาค</h3>${channelMarkup(channel)}` : '<p>ยังไม่มีช่องทาง e-Donation ของรายการนี้ที่ตรวจสอบแล้ว</p>'}<p class="commerce-note">การจองไม่ใช่หลักฐานรับเงินหรือการบันทึก e-Donation</p></section>${open ? `<form data-request="booking"><h3>${campaign.kind === "host" ? "ส่งคำขอเป็นเจ้าภาพหลัก" : "จองร่วมเป็นเจ้าภาพ"}</h3>${inputField("ชื่อผู้ติดต่อ", "name")}${inputField("อีเมลหรือเบอร์โทร", "contact")}${campaign.kind === "fund" ? inputField("จำนวนกอง", "quantity", "number", true, `min="1" max="${Math.min(campaign.available, 99)}" value="1"`) : ""}${inputField("ข้อความถึงผู้จัด", "note", "textarea", false)}<p>ข้อมูลติดต่อเปิดเผยเฉพาะผู้จัดและผู้ดูแล ไม่แสดงในรายชื่อสาธารณะ</p><label class="commerce-check"><input type="checkbox" required /> ยอมรับเงื่อนไขการจองและการติดต่อจากผู้จัด</label><button class="commerce-button" type="submit">${campaign.kind === "host" ? "ส่งคำขอ" : "ยืนยันการจองชั่วคราว"}</button></form>` : `<p class="commerce-empty">${e(COMMERCE_STATUS[campaign.status] || "ปิดรับจอง")}${!campaign.available ? " · ครบจำนวนแล้ว" : ""}</p>`}</div>`;
      return;
    }
    content.innerHTML = `${filters()}${mode === "merit" ? `<section class="commerce-donations"><h2>ช่องทาง e-Donation ของวัด</h2>${catalog.channels.length ? catalog.channels.map(channelMarkup).join("") : '<p>ยังไม่มีช่องทางที่ผ่านการตรวจสอบ</p>'}<a href="${e(catalog.directoryUrl)}" target="_blank" rel="noopener noreferrer">ตรวจสอบรายชื่อหน่วยรับบริจาคกับกรมสรรพากร ↗</a></section>` : ""}`;
    renderList();
  }
  function renderCart() {
    const values = Object.fromEntries(new FormData(content.querySelector('form[data-request="order"]') || document.createElement("form")));
    const lines = cart.map(l => ({ ...l, product: catalog.products.find(p => p.id === l.productId) }));
    const missing = lines.some(l => !l.product || l.quantity > l.product.available);
    const seller = catalog.organizations.find(o => o.id === lines[0]?.product?.orgId);
    const mixed = new Set(lines.map(l => l.product?.orgId)).size > 1;
    content.innerHTML = `<h2>ตะกร้าของคุณ</h2>${!lines.length ? '<p class="commerce-empty">ยังไม่มีสินค้าในตะกร้า</p><a href="/shop/">เลือกสินค้า</a>' : `<div class="commerce-detail commerce-cart"><section>${lines.map(l => `<div class="commerce-cart-row"><div><strong>${e(l.product?.title || "สินค้าไม่เปิดขายแล้ว")}</strong><p>${l.product ? money(l.product.priceSatang) : ""}</p></div><label>จำนวน<input data-cart-quantity="${e(l.productId)}" type="number" min="1" max="99" value="${l.quantity}" /></label><button type="button" class="commerce-button secondary" data-remove="${e(l.productId)}">นำออก</button></div>`).join("")}<p>ค่าจัดส่ง ${money(seller?.shippingSatang)}</p><strong class="commerce-price">รวม ${money(lines.reduce((n, l) => n + (l.product?.priceSatang || 0) * l.quantity, seller?.shippingSatang || 0))}</strong><p>จัดส่งโดย ${e(seller?.fulfillment)}</p><p>${e(seller?.returnPolicy)}</p></section><form data-request="order"><h3>ส่งคำขอสั่งซื้อ</h3><p>ยังไม่รับชำระเงินออนไลน์ คำขอนี้ยังไม่สำรองสินค้าและไม่มีการเรียกเก็บเงิน</p>${inputField("ชื่อผู้รับ", "name")}${inputField("อีเมลหรือเบอร์โทร", "contact")}${inputField("ที่อยู่จัดส่งและรหัสไปรษณีย์", "address", "textarea")}<label class="commerce-check"><input type="checkbox" required /> ยินยอมส่งข้อมูลให้ผู้ขายเพื่อติดต่อเรื่องคำสั่งซื้อ</label>${missing || mixed ? '<p role="alert">กรุณานำสินค้าที่หมดหรือสินค้าจากผู้ขายอื่นออกก่อน</p>' : ""}<button type="submit" class="commerce-button" ${missing || mixed ? "disabled" : ""}>ส่งคำขอสั่งซื้อ</button><button type="button" class="commerce-button secondary" disabled>ชำระเงินออนไลน์: ยังไม่เปิดบริการ</button></form></div>`}`;
    const form = content.querySelector('form[data-request="order"]');
    if (form) for (const [key, value] of Object.entries(values)) { const input = form.elements.namedItem(key); if (input && input.type !== "checkbox") input.value = value; }
  }
  function updateCartTotals() {
    const lines = cart.map(line => ({ ...line, product: catalog.products.find(p => p.id === line.productId) }));
    const seller = catalog.organizations.find(o => o.id === lines[0]?.product?.orgId);
    const invalid = lines.some(l => !l.product || l.quantity > l.product.available) || new Set(lines.map(l => l.product?.orgId)).size > 1;
    const total = content.querySelector(".commerce-cart .commerce-price");
    if (total) total.textContent = `รวม ${money(lines.reduce((n, l) => n + (l.product?.priceSatang || 0) * l.quantity, seller?.shippingSatang || 0))}`;
    const submit = content.querySelector('form[data-request="order"] [type="submit"]');
    if (submit) submit.disabled = invalid;
    if (invalid) notice("จำนวนสินค้าไม่พอหรือมีสินค้าต่างร้าน กรุณาตรวจสอบตะกร้า");
  }
  async function refreshRequest() {
    const form = content.querySelector("form[data-request]");
    const values = form ? Object.fromEntries(new FormData(form)) : {};
    const current = await commerceApi();
    catalog = current;
    render();
    const next = content.querySelector("form[data-request]");
    if (next) for (const [key, value] of Object.entries(values)) { const input = next.elements.namedItem(key); if (input && input.type !== "checkbox") input.value = value; }
    requestId = crypto.randomUUID();
    notice("อัปเดตข้อมูลล่าสุดแล้ว กรุณาตรวจสอบราคาและเงื่อนไขก่อนยืนยันอีกครั้ง");
  }
  function renderReceipt() {
    const r = receipt.record;
    const temporary = ["held", "accepted"].includes(r.status);
    const seller = catalog?.organizations.find(o => o.id === r.orgId);
    content.innerHTML = `<section class="commerce-receipt">
      <p class="section-kicker">${receipt.table === "orders" ? "คำขอสั่งซื้อ" : "รายการร่วมบุญ"}</p>
      <h2>${e(COMMERCE_STATUS[r.status] || r.status)}</h2>
      <p class="commerce-record-id">เลขอ้างอิง ${e(r.id)}</p><h3>${e(r.campaignTitle || r.sellerName)}</h3>
      ${r.lines ? r.lines.map(l => `<p>${e(l.title)} × ${l.quantity} · ${money(l.priceSatang * l.quantity)}</p>`).join("") + `<strong>ยอดรวม ${money(r.totalSatang)}</strong><p>ยังไม่มีการชำระเงิน</p>` : `<p>${r.quantity} ${r.kind === "host" ? "คำขอเจ้าภาพหลัก" : "กอง"}</p><p>${r.donationReceived ? `ผู้จัดยืนยันรับเงิน ${money(r.receivedSatang)} · อ้างอิง ${e(r.receiptReference)}` : "ยังไม่มีการยืนยันรับเงิน"}</p><p>สถานะนี้ไม่ใช่หลักฐานการบันทึก e-Donation</p>`}
      ${r.expiresAt && temporary ? `<p>กำหนดยืนยัน ${e(new Date(r.expiresAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }))}</p>` : ""}
      <p>${e(r.statusNote || "")}</p>${seller?.contact ? `<p>ติดต่อผู้รับผิดชอบ: ${e(seller.contact)}</p>` : ""}
      ${r.campaignId ? `<p><a href="/merit/?campaign=${encodeURIComponent(r.campaignId)}">ดูรายละเอียดงานและช่องทางบริจาค</a></p>` : ""}
      <div class="commerce-actions"><button type="button" class="commerce-button secondary" data-receipt-refresh>ตรวจสอบสถานะ</button><button type="button" class="commerce-button secondary" data-copy-receipt>คัดลอกลิงก์ติดตามส่วนตัว</button>${["requested", "held"].includes(r.status) ? '<button type="button" class="commerce-button secondary" data-cancel-receipt>ยกเลิกรายการ</button>' : ""}</div>
      <p class="commerce-note">ลิงก์นี้ใช้เข้าถึงข้อมูลรายการของคุณ ไม่ควรเผยแพร่ต่อสาธารณะ</p>
    </section>`;
  }
  async function refreshReceipt() {
    const result = await commerceApi({ op: "guest.read", table: receipt.table, id: receipt.record.id, accessSecret: receipt.secret });
    receipt.record = result.record; renderReceipt();
  }
  async function load(silent = false) {
    if (busy || (silent && content.querySelector("form[data-request]"))) return;
    try { catalog = await commerceApi(); if (receipt) await refreshReceipt(); else render(); if (!silent) notice(""); }
    catch (error) { notice(error.message); if (!catalog || receipt) content.innerHTML = '<button class="commerce-button secondary" data-retry>ลองใหม่</button>'; }
  }
  content.addEventListener("input", event => {
    if (event.target.matches("[data-search]")) { search = event.target.value; renderList(); }
  });
  content.addEventListener("change", event => {
    if (event.target.matches("[data-seller]")) { sellerFilter = event.target.value; renderList(); }
    if (event.target.matches("[data-cart-quantity]")) { const quantity = Number(event.target.value); if (Number.isInteger(quantity) && quantity > 0 && quantity <= 99) { cart.find(l => l.productId === event.target.dataset.cartQuantity).quantity = quantity; saveCart(); updateCartTotals(); } else { event.target.value = cart.find(l => l.productId === event.target.dataset.cartQuantity).quantity; notice("จำนวนสินค้าต้องเป็นจำนวนเต็มระหว่าง 1–99"); } }
  });
  content.addEventListener("click", async event => {
    const button = event.target.closest("button"); if (!button || busy) return;
    try {
      if (button.hasAttribute("data-retry")) await load();
      if (button.hasAttribute("data-refresh-request")) await refreshRequest();
      if (button.dataset.add) {
        const p = catalog.products.find(p => p.id === button.dataset.add);
        const quantity = Number(content.querySelector("[data-product-quantity]").value);
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > p.available || quantity > 99) throw new Error("กรุณาตรวจสอบจำนวนสินค้า");
        if (cart.some(l => catalog.products.find(p => p.id === l.productId)?.orgId !== p.orgId)) throw new Error("ตะกร้ามีสินค้าจากผู้ขายอื่น กรุณาส่งคำขอหรือนำสินค้าเดิมออกก่อน");
        const existing = cart.find(l => l.productId === p.id);
        if ((existing?.quantity || 0) + quantity > Math.min(99, p.available)) throw new Error("จำนวนรวมเกินสินค้าที่มี");
        if (existing) existing.quantity += quantity; else cart.push({ productId: p.id, quantity });
        saveCart(); notice("เพิ่มสินค้าในตะกร้าแล้ว");
      }
      if (button.dataset.remove) { cart = cart.filter(l => l.productId !== button.dataset.remove); saveCart(); renderCart(); }
      if (button.hasAttribute("data-receipt-refresh")) await refreshReceipt();
      if (button.hasAttribute("data-copy-receipt")) { await navigator.clipboard.writeText(location.href); notice("คัดลอกลิงก์ติดตามส่วนตัวแล้ว"); }
      if (button.hasAttribute("data-cancel-receipt") && confirm("ยืนยันยกเลิกรายการนี้?")) { receipt.record = (await commerceApi({ op: "guest.cancel", table: receipt.table, id: receipt.record.id, accessSecret: receipt.secret })).record; renderReceipt(); }
    } catch (error) { notice(error.message); }
  });
  content.addEventListener("submit", async event => {
    const form = event.target.closest("[data-request]"); if (!form) return;
    event.preventDefault(); if (busy) return; busy = true;
    const submit = form.querySelector('[type="submit"]'); submit.disabled = true; notice("");
    const data = Object.fromEntries(new FormData(form));
    const order = form.dataset.request === "order";
    if (order) {
      data.lines = cart.map(l => ({ ...l, version: catalog.products.find(p => p.id === l.productId)?.version }));
      const orgId = catalog.products.find(p => p.id === cart[0]?.productId)?.orgId;
      data.sellerVersion = catalog.organizations.find(o => o.id === orgId)?.version;
    }
    else { data.campaignId = params.get("campaign"); data.version = catalog.campaigns.find(c => c.id === data.campaignId)?.version; data.quantity = Number(data.quantity || 1); }
    try {
      const result = await commerceApi({ op: order ? "order.create" : "booking.create", requestId, accessSecret: secret, data });
      receipt = { record: result.record, table: order ? "orders" : "bookings", secret };
      history.replaceState(null, "", `${location.pathname}#${new URLSearchParams({ table: receipt.table, id: receipt.record.id, key: secret })}`);
      if (order) { cart = []; saveCart(); }
      requestId = crypto.randomUUID(); renderReceipt(); message.scrollIntoView({ block: "center", behavior: "smooth" });
    } catch (error) {
      notice(`${error.message}${error.status === 409 ? " ข้อมูลที่กรอกยังอยู่ กรุณาตรวจสอบข้อมูลล่าสุดก่อนส่งอีกครั้ง" : ""}`);
      if (error.status === 409 && !form.querySelector("[data-refresh-request]")) form.insertAdjacentHTML("beforeend", '<button type="button" class="commerce-button secondary" data-refresh-request>ตรวจสอบข้อมูลล่าสุด</button>');
    }
    finally { busy = false; submit.disabled = false; }
  });
  const hash = new URLSearchParams(location.hash.slice(1));
  if (hash.get("id") && ["orders", "bookings"].includes(hash.get("table"))) receipt = { table: hash.get("table"), record: { id: hash.get("id") }, secret: hash.get("key") };
  saveCart(); load(); startContentRefresh(() => load(true));
}
