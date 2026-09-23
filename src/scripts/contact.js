import { contactChannels, contactEmailHref, contactLineHref } from "../config/contact.js";

let copyAttempt = 0;
let renderedChannels = null;
let renderedRoot = null;

function currentChannels() {
  const root = document.querySelector("#contact-channel-data");
  return root ? contactChannels({ email: root.getAttribute("data-email"), lineId: root.getAttribute("data-line-id") }) : null;
}

function syncContactChannels() {
  const channels = currentChannels();
  if (!channels) return;
  const root = document.querySelector("#contact-channel-data");
  const changed = root !== renderedRoot || channels.email !== renderedChannels?.email || channels.lineId !== renderedChannels?.lineId;
  renderedChannels = channels;
  renderedRoot = root;
  if (changed) copyAttempt++;
  const values = { email: channels.email, line: channels.lineId };
  document.querySelectorAll("[data-contact-value]").forEach(node => {
    const kind = node.getAttribute("data-contact-value");
    const value = values[kind];
    if (node.textContent === (value || "ยังไม่เปิดให้ติดต่อ")) return;
    if (kind === "email" && value) {
      const [name, domain] = value.split("@");
      node.replaceChildren(`${name}@`, document.createElement("wbr"), domain);
    } else node.textContent = value || "ยังไม่เปิดให้ติดต่อ";
  });
  document.querySelectorAll("[data-contact-link]").forEach(node => {
    const kind = node.getAttribute("data-contact-link");
    const href = kind === "email" ? contactEmailHref(channels.email, node.getAttribute("data-email-subject") || "") : contactLineHref(channels.lineId);
    node.hidden = !href;
    if (href) node.setAttribute("href", href);
    else node.removeAttribute("href");
  });
  document.querySelectorAll("[data-contact-copy]").forEach(node => { node.hidden = !values[node.getAttribute("data-contact-copy")]; });
  document.querySelectorAll("[data-contact-unavailable]").forEach(node => { node.hidden = Boolean(values[node.getAttribute("data-contact-unavailable")]); });
  document.querySelectorAll("[data-contact-email-fallback]").forEach(node => { node.hidden = Boolean(channels.email); });
  const unavailable = document.querySelector("[data-contact-all-unavailable]");
  if (unavailable) unavailable.hidden = Boolean(channels.email || channels.lineId);
  const status = document.querySelector("[data-contact-status]");
  if (status && changed) status.textContent = "";
}

document.addEventListener("click", async event => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest("[data-contact-copy]");
  if (!button) return;
  const channels = currentChannels();
  const status = document.querySelector("[data-contact-status]");
  if (!channels || !status) return;
  const kind = button.getAttribute("data-contact-copy");
  const value = kind === "email" ? channels.email : channels.lineId;
  if (!value) return;
  const attempt = ++copyAttempt;
  status.textContent = "";
  try {
    await navigator.clipboard.writeText(value);
    if (attempt === copyAttempt) status.textContent = `คัดลอก${kind === "email" ? "อีเมล" : "LINE ID"}แล้ว`;
  } catch {
    if (attempt === copyAttempt) status.textContent = "ยังคัดลอกอัตโนมัติไม่ได้ กรุณาเลือกข้อความช่องทางติดต่อแล้วคัดลอก";
  }
});

// Reuse the existing CMS lifecycle; never fetch or cache a second content source.
document.addEventListener("mw:cms-content-ready", syncContactChannels);
syncContactChannels();
