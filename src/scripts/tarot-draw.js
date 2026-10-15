import { tarotCards } from "./tarot-data.js";
import { renderCardFace, renderCardBack } from "./tarot-view.js";
import { escapeHtml } from "../lib/ui-markup.js";

document.querySelectorAll("[data-tarot-draw]").forEach(initTarotDraw);

function initTarotDraw(form) {
  const type = form.dataset.spreadType;
  const required = Number(form.dataset.requiredCount);
  const mobile = matchMedia("(max-width: 720px)");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const baseDeck = ["daily", "monthly"].includes(type) ? tarotCards : tarotCards.filter(card => !card.suit);
  let deck = shuffle(baseDeck), selected = [], busy = false;
  const grid = form.querySelector("[data-tarot-deck]");
  const status = form.querySelector("[data-tarot-status]");
  const read = form.querySelector("[data-tarot-read]");
  const bottom = form.querySelector("[data-tarot-read-bottom]");

  function render() {
    grid.setAttribute("aria-busy", String(busy));
    grid.classList.toggle("has-selection", required === 1 && selected.length > 0);
    grid.innerHTML = deck.map((card, i) => {
      const picked = selected.findIndex(item => item.id === card.id);
      const selectedClass = picked >= 0 ? (required === 1 ? " is-selected" : " is-picked") : "";
      return `<button type="button" class="tarot-pick${selectedClass}" data-card-id="${escapeHtml(card.id)}" aria-label="${picked >= 0 ? `เลือกแล้วลำดับ ${picked + 1} ${escapeHtml(card.thName)}` : `เลือกไพ่ใบที่ ${i + 1}`}" ${picked >= 0 || selected.length >= required || busy ? "disabled" : ""}>
        ${picked >= 0 ? renderCardFace(card, "pick") : renderCardBack()}
        ${picked >= 0 ? `<span class="tarot-pick-number">${picked + 1}</span>` : ""}</button>`;
    }).join("");
    form.querySelector("[data-tarot-selected]").value = selected.map(c => c.id).join(",");
    form.querySelector("[data-tarot-count]").value = String(selected.length);
    read.disabled = bottom.disabled = busy || selected.length !== required;
    for (const button of form.querySelectorAll("[data-tarot-shuffle], [data-tarot-cut]")) button.disabled = busy;
    const strip = form.querySelector("[data-tarot-selection]");
    strip.hidden = !selected.length;
    strip.innerHTML = selected.map((card, i) => `<figure>${renderCardFace(card, "thumbnail")}<figcaption>${i + 1}. ${escapeHtml(card.thName)}</figcaption></figure>`).join("");
    form.querySelector("[data-tarot-selection-actions]").hidden = !selected.length;
    form.querySelector("[data-tarot-selection-count]").textContent = `เลือกแล้ว ${selected.length} / ${required} ใบ`;
    document.querySelector("[data-tarot-step-pick]")?.setAttribute("aria-current", selected.length < required ? "step" : "false");
    document.querySelector("[data-tarot-step-read]")?.setAttribute("aria-current", selected.length === required ? "step" : "false");
  }

  grid.addEventListener("click", event => {
    const target = event.target.closest("[data-card-id]");
    if (!target || busy || selected.length >= required) return;
    const card = deck.find(item => item.id === target.dataset.cardId);
    if (!card || selected.some(item => item.id === card.id)) return;
    selected.push(card);
    render();
    status.textContent = selected.length === required ? "เลือกครบแล้ว พร้อมเปิดคำทำนาย" : `เลือกแล้ว ${selected.length} / ${required} ใบ`;
    if (selected.length === required) read.focus({ preventScroll: true });
    else {
      const index = deck.indexOf(card);
      const buttons = [...grid.querySelectorAll("button")];
      const next = [...buttons.slice(index + 1), ...buttons.slice(0, index)].find(button => !button.disabled);
      next?.focus({ preventScroll: event.detail !== 0 });
    }
  });
  async function rearrange(cut) {
    if (busy) return;
    busy = true;
    status.textContent = cut ? "กำลังตัดไพ่…" : "กำลังสับไพ่…";
    render();
    grid.classList.add("is-shuffling");
    await new Promise(resolve => setTimeout(resolve, reduced.matches ? 0 : 520));
    if (cut) {
      const at = 1 + Math.floor(Math.random() * (deck.length - 1));
      deck = [...deck.slice(at), ...deck.slice(0, at)];
    } else deck = shuffle(deck);
    selected = []; busy = false;
    grid.classList.remove("is-shuffling");
    render();
    status.textContent = cut ? "ตัดไพ่แล้ว เลือกไพ่ที่สะดุดใจ" : "สับไพ่แล้ว ตั้งจิตและเลือกไพ่";
    form.querySelector(cut ? "[data-tarot-cut]" : "[data-tarot-shuffle]").focus({ preventScroll: true });
  }
  form.querySelector("[data-tarot-shuffle]").addEventListener("click", () => rearrange(false));
  form.querySelector("[data-tarot-cut]").addEventListener("click", () => rearrange(true));
  form.addEventListener("submit", event => {
    event.preventDefault();
    if (busy || selected.length !== required) return;
    const date = new Date().toISOString().slice(0, 10);
    const cardIds = selected.map(c => c.id);
    const reading = type === "daily" ? { cardId: cardIds[0], date, createdAt: Date.now() } : { cardIds, spreadType: type, date, createdAt: Date.now() };
    try { localStorage.setItem(form.dataset.storageKey, JSON.stringify(reading)); } catch { /* The URL preserves the reading when storage is unavailable. */ }
    const params = new URLSearchParams({ [type === "daily" ? "card" : "cards"]: cardIds.join(","), date });
    location.href = `./result/?${params}`;
  });
  if (mobile.matches) document.querySelector(".tarot-tips")?.removeAttribute("open");
  render();
}

function shuffle(cards) {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
