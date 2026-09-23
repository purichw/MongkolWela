import { mountCommerceConsole } from "../commerce-console.js";
import { adminIcon } from "./design.js";

export function createCommerceEditor({ setTitle, setTopActions }) {
  let controller;
  let element;
  function render() {
    setTitle("ร้านค้าและร่วมบุญ", "จัดการข้อมูล");
    setTopActions(`<a class="mw-admin-btn" href="/shop/" target="_blank" rel="noopener">${adminIcon("external-link")}ดูหน้าร้าน</a><a class="mw-admin-btn" href="/merit/" target="_blank" rel="noopener">${adminIcon("external-link")}ดูหน้าร่วมบุญ</a>`);
    const container = document.querySelector("#adminContent");
    if (element?.isConnected) return;
    controller?.destroy();
    container.innerHTML = `<section class="commerce-console mw-admin-commerce" data-commerce-console>
      <p class="mw-admin-commerce-caption">สินค้า งานบุญ คำสั่งซื้อ และผู้ขาย</p>
      <div class="commerce-message" role="status" aria-live="polite" data-seller-message></div>
      <div data-seller-content aria-busy="true"><p role="status">กำลังโหลดข้อมูลร้านค้าและร่วมบุญ</p></div>
    </section>`;
    element = container.firstElementChild;
    controller = mountCommerceConsole(element, { embedded: true });
  }
  return {
    render,
    canLeave: () => !element?.isConnected || controller.canLeave(),
    isDirty: () => Boolean(element?.isConnected && controller?.isDirty()),
    destroy() { controller?.destroy(); controller = null; element = null; },
  };
}
