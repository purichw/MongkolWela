import { renderLifeGraph, renderLifeChart, createShareText } from "./life-graph-chart.js";
import { calculateLifeGraph } from "./life-graph-engine.js";
import { ThaiCalendarProvider } from "./thai-calendar-provider.js";
import { renderIcon } from "../lib/ui-markup.js";
import { onCmsContent } from "./content-ready.js";
import { settlePageContent } from "./page-content-ready.js";

const form = document.querySelector("[data-life-graph-form]");
const output = document.querySelector("[data-life-graph-output]");
onCmsContent(() => { if (form && output) initLifeGraph(form, output); }, { once: true, onUnavailable: () => {
  if (!output) return;
  output.innerHTML = `<div class="output-empty" role="status">${renderIcon("info")}<strong>ยังเตรียมกราฟชีวิตไม่ได้</strong><p>ไม่สามารถโหลดคำอ่านล่าสุดได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง</p></div>`;
  output.setAttribute("aria-busy", "false");
  settlePageContent(output);
} });

function initLifeGraph(form, output) {
  const provider = new ThaiCalendarProvider();
  const compact = matchMedia("(max-width: 767px)");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const submit = form.querySelector('[type="submit"]');
  let result = null;
  let request = 0;

  fillTimeOptions(form);
  setDefaultDates(form);
  calculate(true);

  async function calculate(sample = false) {
    if (!form.reportValidity()) return;
    const current = ++request;
    output.setAttribute("aria-busy", "true");
    submit.disabled = true;
    setStatus("กำลังคำนวณกราฟชีวิต…");
    const input = {
      name: form.elements.name.value,
      birthDate: form.elements.birthDate.value,
      birthHour: form.elements.birthHour.value,
      birthMinute: form.elements.birthMinute.value,
      transitDate: form.elements.transitDate.value,
    };
    try {
      const next = await calculateLifeGraph(input, provider);
      if (current !== request) return;
      result = next;
      output.innerHTML = renderLifeGraph(result, { compact: compact.matches, sample });
      output.dataset.origin = sample ? "sample" : "user";
      const editedWhileCalculating = Object.entries(input).some(([key, value]) => form.elements[key].value !== value);
      output.dataset.state = editedWhileCalculating ? "dirty" : "ready";
      if (editedWhileCalculating) setStatus("ข้อมูลถูกแก้ไขแล้ว กดคำนวณเพื่ออัปเดตผลลัพธ์");
      if (!sample && !editedWhileCalculating) {
        const heading = output.querySelector("#life-result-title");
        heading.focus({ preventScroll: true });
        output.scrollIntoView({ behavior: reducedMotion.matches ? "instant" : "smooth", block: "start" });
      }
    } catch {
      if (current !== request) return;
      output.dataset.state = "error";
      if (!result) output.innerHTML = `<div class="output-empty" role="alert">${renderIcon("info")}<strong>ยังคำนวณไม่ได้</strong><p>ข้อมูลที่กรอกยังอยู่ กรุณาลองอีกครั้ง</p><button type="button" class="primary-action" data-life-retry>ลองอีกครั้ง</button></div>`;
      else setStatus("ยังคำนวณไม่ได้ แสดงผลครั้งก่อนอยู่ กรุณาตรวจข้อมูลแล้วลองอีกครั้ง");
    } finally {
      if (current === request) {
        submit.disabled = false;
        output.setAttribute("aria-busy", "false");
        settlePageContent(output);
      }
    }
  }

  function setStatus(message) {
    const status = output.querySelector("[data-life-status]");
    if (status) status.textContent = message;
  }

  function activatePoint(point) {
    output.querySelectorAll(".life-house-card.is-focused").forEach(card => card.classList.remove("is-focused"));
    const card = output.querySelector(`[data-life-house-card="${point.dataset.lifeHouse}"]`);
    if (!card) return;
    card.open = true;
    card.classList.add("is-focused");
    card.querySelector("summary").focus({ preventScroll: true });
    card.scrollIntoView({ behavior: reducedMotion.matches ? "instant" : "smooth", block: "nearest" });
  }

  form.addEventListener("submit", event => { event.preventDefault(); calculate(); });
  form.addEventListener("input", () => {
    if (result) {
      output.dataset.state = "dirty";
      setStatus("ข้อมูลถูกแก้ไขแล้ว กดคำนวณเพื่ออัปเดตผลลัพธ์");
    }
  });
  form.addEventListener("change", () => {
    if (result) {
      output.dataset.state = "dirty";
      setStatus("ข้อมูลถูกแก้ไขแล้ว กดคำนวณเพื่ออัปเดตผลลัพธ์");
    }
  });
  compact.addEventListener("change", () => {
    if (result) output.querySelector("[data-life-plot]").innerHTML = renderLifeChart(result, compact.matches);
  });

  document.querySelector("[data-life-edit]")?.addEventListener("click", () => {
    form.scrollIntoView({ behavior: reducedMotion.matches ? "instant" : "smooth", block: "start" });
    form.elements.birthDate.focus({ preventScroll: true });
  });

  output.addEventListener("keydown", event => {
    const point = event.target.closest("[data-life-house]");
    if (point && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      activatePoint(point);
    }
  });
  output.addEventListener("click", async event => {
    const point = event.target.closest("[data-life-house]");
    if (point) activatePoint(point);
    if (event.target.closest("[data-life-retry]")) calculate();
    if (event.target.closest("[data-life-share]")) output.querySelector(".life-share-dialog").showModal();
    const confirm = event.target.closest("[data-life-share-confirm]");
    if (!confirm || !result) return;
    const dialog = output.querySelector(".life-share-dialog");
    const status = dialog.querySelector("[data-life-share-status]");
    const text = createShareText(result);
    try {
      if (navigator.share) {
        await navigator.share({ title: "กราฟชีวิต · มงคลเวลา", text });
        status.textContent = "แชร์ผลลัพธ์แล้ว";
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        status.textContent = "คัดลอกผลลัพธ์แล้ว";
      } else {
        dialog.querySelector("textarea").select();
        status.textContent = "เลือกข้อความไว้แล้ว สามารถคัดลอกผลลัพธ์ได้";
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        dialog.querySelector("textarea").select();
        status.textContent = "แชร์ไม่สำเร็จ สามารถคัดลอกข้อความด้านบนแทนได้";
      }
    }
  });
}

function fillTimeOptions(form) {
  form.querySelector("[data-hour-options]").innerHTML = Array.from({ length: 24 }, (_, hour) =>
    `<option value="${hour}"${hour === 12 ? " selected" : ""}>${String(hour).padStart(2, "0")}</option>`).join("");
  form.querySelector("[data-minute-options]").innerHTML = Array.from({ length: 12 }, (_, i) =>
    `<option value="${i * 5}">${String(i * 5).padStart(2, "0")}</option>`).join("");
}

function setDefaultDates(form) {
  const today = new Date();
  const birth = new Date(today.getFullYear() - 30, today.getMonth(), today.getDate());
  if (!form.elements.birthDate.value) form.elements.birthDate.value = toInputDate(birth);
  if (!form.elements.transitDate.value) form.elements.transitDate.value = toInputDate(today);
}

function toInputDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
