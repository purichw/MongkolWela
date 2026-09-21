import { commerceApi, campaignMarkup, channelMarkup, e, money, orgName } from "./commerce-ui.js";
import { startContentRefresh } from "./content-refresh.js";
import { renderIcon } from "../lib/ui-markup.js";

const icon = name => renderIcon(name, "pd-icon");
function templeProductMarkup(product, data) {
  const href = `/shop/?product=${encodeURIComponent(product.id)}`;
  return `<article class="temple-shop-product" data-temple-product="${e(product.id)}">
    <a class="temple-shop-media" href="${e(href)}" aria-label="${e(product.title)}">
      ${renderIcon("shopping-bag", "temple-product-placeholder")}
      ${product.imageUrl ? `<img src="${e(product.imageUrl)}" alt="${e(product.imageAlt || product.title)}" width="320" height="320" loading="lazy" decoding="async" />` : ""}
      ${product.available ? "" : '<span class="temple-shop-stock">สินค้าหมด</span>'}
    </a>
    <div class="temple-shop-copy">
      <h3><a href="${e(href)}" title="${e(product.title)}">${e(product.title)}</a></h3>
      <small title="${e(orgName(data, product.orgId))}">${e(orgName(data, product.orgId))}</small>
      <div class="temple-shop-price"><strong>${money(product.priceSatang)}</strong></div>
      <a class="temple-shop-action" href="${e(href)}" aria-label="ดูสินค้า ${e(product.title)}" title="ดูสินค้า ${e(product.title)}">${icon("shopping-cart")}<span class="temple-card-action-label">ดูสินค้า</span></a>
    </div>
  </article>`;
}

for (const root of document.querySelectorAll("[data-temple-commerce]")) {
  const content = root.querySelector("[data-temple-commerce-content]");
  const emptyTemplate = root.querySelector("[data-commerce-empty]");
  const meritLink = root.querySelector("[data-temple-merit-link]");
  let previous = "";
  let catalog;
  let expandedProducts = false;

  function render() {
    const data = catalog;
    content.innerHTML = `${data.products.length ? `<div class="temple-shop-products">${data.products.slice(0, expandedProducts ? undefined : 4).map(p => templeProductMarkup(p, data)).join("")}</div>${data.products.length > 4 ? `<button class="temple-shop-more" type="button" data-temple-products-more aria-expanded="${expandedProducts}">${expandedProducts ? "แสดงน้อยลง" : `ดูสินค้าของสถานที่นี้ทั้งหมด (${data.products.length})`}</button>` : ""}` : emptyTemplate.innerHTML}
      <div class="temple-merit-content" id="temple-merit-details">
        ${data.campaigns.length ? `<h3>กฐินและร่วมบุญ</h3>${data.campaigns.slice(0, 3).map(c => campaignMarkup(c, data)).join("")}` : ""}
        <h3>ช่องทาง e-Donation</h3>
        ${data.channels.length ? data.channels.map(channelMarkup).join("") : `<p>ยังไม่มีข้อมูลช่องทาง e-Donation ที่ตรวจสอบแล้ว</p><a href="${e(data.directoryUrl)}" target="_blank" rel="noopener noreferrer">ตรวจสอบรายชื่อหน่วยรับบริจาคกับกรมสรรพากร ↗</a>`}
      </div>`;
    if (!data.products.length) {
      content.querySelector("[data-empty-title]").textContent = "ยังไม่มีสินค้าที่เผยแพร่สำหรับสถานที่นี้";
      content.querySelector("[data-empty-description]").textContent = "เมื่อมีสินค้าจากสถานที่นี้ จะแสดงรายละเอียดที่นี่";
    }
    meritLink.href = "#temple-merit-details";
    content.querySelectorAll(".temple-shop-media img").forEach(img => {
      const showFallback = () => { img.hidden = true; };
      const showImage = () => { img.previousElementSibling.hidden = true; };
      img.addEventListener("error", showFallback, { once: true });
      img.addEventListener("load", showImage, { once: true });
      if (img.complete) { if (img.naturalWidth) showImage(); else showFallback(); }
    });
  }

  async function refresh() {
    content.setAttribute("aria-busy", "true");
    try {
      const data = await commerceApi(null, `?templeId=${encodeURIComponent(root.dataset.templeCommerce)}`);
      root.hidden = false;
      const signature = JSON.stringify(data);
      if (signature === previous) return;
      previous = signature;
      catalog = data;
      render();
    } catch (error) {
      previous = "";
      meritLink.href = "/merit/";
      if (error.code === "COMMERCE_DISABLED") {
        root.hidden = false;
        content.innerHTML = emptyTemplate.innerHTML;
        stopRefresh();
        return;
      }
      root.hidden = false;
      content.innerHTML = '<div class="temple-commerce-error" role="status"><p>ยังโหลดข้อมูลร้านค้าและร่วมบุญไม่ได้</p><button type="button" class="commerce-button secondary" data-commerce-retry>ลองใหม่</button></div>';
    } finally {
      content.setAttribute("aria-busy", "false");
    }
  }
  root.addEventListener("click", event => {
    if (event.target.closest("[data-commerce-retry]")) refresh();
    if (event.target.closest("[data-temple-products-more]")) {
      expandedProducts = !expandedProducts;
      render();
      root.querySelector("[data-temple-products-more]")?.focus({ preventScroll: true });
    }
  });
  const stopRefresh = startContentRefresh(refresh);
  refresh();
}
