import { commerceApi, productMarkup, campaignMarkup, channelMarkup, e } from "./commerce-ui.js";
import { startContentRefresh } from "./content-refresh.js";
for (const root of document.querySelectorAll("[data-temple-commerce]")) {
  const content = root.querySelector("[data-temple-commerce-content]");
  let previous = "";
  async function refresh() {
    try {
      const data = await commerceApi(null, `?templeId=${encodeURIComponent(root.dataset.templeCommerce)}`);
      root.hidden = false;
      const signature = JSON.stringify(data);
      if (signature === previous) return;
      previous = signature;
      content.innerHTML = `${data.products.length ? `<h3>วัตถุมงคลที่เกี่ยวข้อง</h3><div class="commerce-products">${data.products.slice(0, 3).map(p => productMarkup(p, data)).join("")}</div>` : '<p class="temple-commerce-notice">ยังไม่มีสินค้าที่เผยแพร่สำหรับสถานที่นี้</p>'}${data.campaigns.length ? `<h3>กฐินและร่วมบุญ</h3>${data.campaigns.slice(0, 3).map(c => campaignMarkup(c, data)).join("")}` : ""}<h3>ช่องทาง e-Donation</h3>${data.channels.length ? data.channels.map(channelMarkup).join("") : `<p>ยังไม่มีข้อมูลช่องทาง e-Donation ที่ตรวจสอบแล้ว</p><a href="${e(data.directoryUrl)}" target="_blank" rel="noopener noreferrer">ตรวจสอบรายชื่อหน่วยรับบริจาคกับกรมสรรพากร ↗</a>`}`;
    } catch (error) {
      previous = "";
      if (error.code === "COMMERCE_DISABLED") {
        root.hidden = false;
        content.innerHTML = '<p class="temple-commerce-notice">ร้านค้าและการร่วมบุญออนไลน์ยังไม่เปิดบริการ</p>';
        stopRefresh();
        return;
      }
      root.hidden = false;
      content.innerHTML = '<p>ยังโหลดข้อมูลร้านค้าและร่วมบุญไม่ได้</p><button type="button" class="commerce-button secondary" data-commerce-retry>ลองใหม่</button>';
    } finally {
      content.setAttribute("aria-busy", "false");
    }
  }
  root.addEventListener("click", event => { if (event.target.closest("[data-commerce-retry]")) refresh(); });
  const stopRefresh = startContentRefresh(refresh);
  refresh();
}
