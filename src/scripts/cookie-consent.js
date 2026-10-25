import { analyticsConsentKey, resolveConsentCopy, validConsent } from "../lib/cookie-consent.js";
import { escapeHtml, renderIcon } from "../lib/ui-markup.js";

let memoryConsent = null;
let currentContent = null;
let onAccept = () => {};
let dialog = null;
let opener = null;
let listening = false;

export function getAnalyticsConsent() {
  if (memoryConsent) return memoryConsent;
  try { return validConsent(localStorage.getItem(analyticsConsentKey)); }
  catch { return memoryConsent; }
}

function isEnabled() {
  return document.body.dataset.analyticsDisabled !== "true" && currentContent?.site?.pdpa?.analyticsConsentRequired;
}

const emblem = '<img class="pdpa-emblem" src="/assets/images/cookie-lotus-medallion.webp" alt="" width="64" height="64" />';
const decoration = '<span class="pdpa-consent__ornament pdpa-consent__ornament--left" aria-hidden="true"></span><span class="pdpa-consent__ornament pdpa-consent__ornament--right" aria-hidden="true"></span>';

function policyLink() {
  const { policyHref, policyLabel } = currentContent?.site?.pdpa || {};
  if (!policyHref) return "";
  try {
    const url = new URL(policyHref, location.origin);
    if (!["https:", "http:"].includes(url.protocol)) return "";
    return `<a class="pdpa-policy" href="${escapeHtml(url.href)}">${escapeHtml(policyLabel || "นโยบายความเป็นส่วนตัว")}</a>`;
  } catch { return ""; }
}

function saveConsent(value) {
  memoryConsent = value;
  try { localStorage.setItem(analyticsConsentKey, value); }
  catch {
    // Honor this page's choice even when the browser disallows persistence.
    try { localStorage.removeItem(analyticsConsentKey); } catch { /* Storage can be unavailable entirely. */ }
    const status = document.querySelector("[data-pdpa-storage-status]");
    if (status) status.textContent = "เบราว์เซอร์ไม่อนุญาตให้บันทึกตัวเลือก ครั้งถัดไปคุณอาจต้องเลือกอีกครั้ง";
  }
  document.querySelector(".pdpa-consent")?.remove();
  if (dialog?.open) dialog.close();
  if (value === "accepted") onAccept();
}

function openSettings(trigger) {
  if (!isEnabled()) return;
  opener = trigger;
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.className = "pdpa-settings";
    dialog.setAttribute("aria-labelledby", "pdpa-settings-title");
    dialog.setAttribute("aria-describedby", "pdpa-settings-description");
    dialog.innerHTML = `<div class="pdpa-settings__header">${emblem}
      <h2 id="pdpa-settings-title" tabindex="-1">ตั้งค่าคุกกี้</h2>
      <button class="pdpa-settings__close" type="button" data-pdpa-close aria-label="ปิดการตั้งค่าคุกกี้" title="ปิดการตั้งค่าคุกกี้">${renderIcon("x")}</button>
    </div>
    <p id="pdpa-settings-description">เลือกการใช้ข้อมูลที่คุณยินยอม คุณเปลี่ยนตัวเลือกได้ทุกเมื่อจาก “ตั้งค่าคุกกี้” ที่ท้ายเว็บไซต์</p>
    <form data-pdpa-form>
      <div class="pdpa-settings__category">
        <div class="pdpa-settings__category-heading"><h3>คุกกี้ที่จำเป็น</h3><span class="pdpa-settings__required">${renderIcon("shield-check")}เปิดเสมอ</span></div>
        <p>ช่วยให้เว็บไซต์ทำงานได้ตามปกติ เช่น การจดจำตัวเลือกคุกกี้และการเข้าสู่ระบบ จึงไม่สามารถปิดได้</p>
      </div>
      <div class="pdpa-settings__category">
        <div class="pdpa-settings__category-heading"><label for="pdpa-analytics">การวิเคราะห์การใช้งาน</label>
          <span class="pdpa-switch"><input id="pdpa-analytics" type="checkbox" role="switch" aria-describedby="pdpa-analytics-description" /><span aria-hidden="true"></span></span>
        </div>
        <p id="pdpa-analytics-description">อนุญาตให้เก็บข้อมูลการใช้งานแบบไม่ระบุตัวตน เพื่อช่วยปรับปรุงเว็บไซต์และเครื่องมือของมงคลเวลา</p>
      </div>
      <div data-pdpa-policy></div>
      <button class="pdpa-button pdpa-button--primary pdpa-settings__save" type="submit">บันทึกการตั้งค่า</button>
    </form>`;
    document.body.appendChild(dialog);
    dialog.querySelector("[data-pdpa-close]").addEventListener("click", () => dialog.close());
    dialog.querySelector("[data-pdpa-form]").addEventListener("submit", event => {
      event.preventDefault();
      saveConsent(dialog.querySelector("#pdpa-analytics").checked ? "accepted" : "declined");
    });
    dialog.addEventListener("keydown", event => {
      if (event.key !== "Tab") return;
      const focusable = [...dialog.querySelectorAll("button, input, a[href]")].filter(node => !node.disabled && node.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement?.id === "pdpa-settings-title")) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    });
    dialog.addEventListener("close", () => {
      document.body.classList.remove("has-cookie-settings");
      const target = opener?.isConnected ? opener : document.querySelector("[data-pdpa-reopen]");
      target?.focus({ preventScroll: true });
    });
  }
  dialog.querySelector("#pdpa-settings-title").textContent = resolveConsentCopy(currentContent.site.pdpa).settingsLabel;
  dialog.querySelector("#pdpa-analytics").checked = getAnalyticsConsent() === "accepted";
  dialog.querySelector("[data-pdpa-policy]").innerHTML = policyLink();
  dialog.showModal();
  document.body.classList.add("has-cookie-settings");
  dialog.querySelector("#pdpa-settings-title").focus({ preventScroll: true });
}

function syncBanner() {
  const enabled = isEnabled();
  document.querySelectorAll("[data-pdpa-reopen]").forEach(button => { button.hidden = !enabled; });
  const existing = document.querySelector(".pdpa-consent");
  if (!enabled || getAnalyticsConsent()) {
    existing?.remove();
    if (!enabled && dialog?.open) dialog.close();
    return;
  }
  const copy = resolveConsentCopy(currentContent.site.pdpa);
  const banner = existing || document.createElement("aside");
  if (!existing) {
    banner.className = "pdpa-consent";
    banner.setAttribute("aria-labelledby", "pdpa-consent-title");
    banner.innerHTML = `${decoration}<div class="pdpa-consent__surface">
      ${emblem}<div class="pdpa-consent__copy"><h2 class="pdpa-consent__title" id="pdpa-consent-title" data-pdpa-copy="titleText"></h2></div>
      <p class="pdpa-consent__body" data-pdpa-copy="bannerText"></p>
      <div class="pdpa-consent__policy" data-pdpa-policy></div>
      <div class="pdpa-consent__actions">
        <button class="pdpa-button pdpa-button--primary" type="button" data-pdpa-accept data-pdpa-copy="acceptLabel"></button>
        <button class="pdpa-button pdpa-button--secondary" type="button" data-pdpa-decline data-pdpa-copy="declineLabel"></button>
        <button class="pdpa-button pdpa-button--settings" type="button" data-pdpa-settings aria-haspopup="dialog">${renderIcon("settings")}<span data-pdpa-copy="settingsLabel"></span></button>
      </div></div>`;
    banner.querySelector("[data-pdpa-accept]").addEventListener("click", () => saveConsent("accepted"));
    banner.querySelector("[data-pdpa-decline]").addEventListener("click", () => saveConsent("declined"));
    banner.querySelector("[data-pdpa-settings]").addEventListener("click", event => openSettings(event.currentTarget));
    document.body.appendChild(banner);
  }
  banner.querySelectorAll("[data-pdpa-copy]").forEach(node => { node.textContent = copy[node.dataset.pdpaCopy]; });
  banner.querySelector("[data-pdpa-policy]").innerHTML = policyLink();
}

export function renderCookieConsent(content, accept) {
  currentContent = content;
  onAccept = accept;
  if (!listening) {
    listening = true;
    document.querySelectorAll("[data-pdpa-reopen]").forEach(button => {
      button.addEventListener("click", event => openSettings(event.currentTarget));
    });
    window.addEventListener("storage", event => {
      if (event.key !== analyticsConsentKey && event.key !== null) return;
      memoryConsent = null;
      syncBanner();
      if (dialog?.open) dialog.querySelector("#pdpa-analytics").checked = getAnalyticsConsent() === "accepted";
      if (getAnalyticsConsent() === "accepted") onAccept();
    });
  }
  syncBanner();
}
