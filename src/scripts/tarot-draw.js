import { tarotCards } from "./tarot-data.js";
import { renderCardFace, renderCardBack } from "./tarot-view.js";

document.querySelectorAll("[data-tarot-draw]").forEach(initTarotDraw);

function initTarotDraw(form) {
  const type = form.dataset.spreadType;
  const required = Number(form.dataset.requiredCount);
  const mobile = matchMedia("(max-width: 720px)");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const baseDeck = ["daily", "monthly"].includes(type) ? tarotCards : tarotCards.filter(card => !card.suit);
  let deck = shuffle(baseDeck), selected = [], page = 0, busy = false;
  const grid = form.querySelector("[data-tarot-deck]");
  const status = form.querySelector("[data-tarot-status]");
  const read = form.querySelector("[data-tarot-read]");
  const bottom = form.querySelector("[data-tarot-read-bottom]");
  const prev = form.querySelector("[data-tarot-prev]");
  const next = form.querySelector("[data-tarot-next]");
  const size = () => mobile.matches ? 9 : 13;

  function render() {
    const count = size();
    page = Math.min(page, Math.ceil(deck.length / count) - 1);
    grid.classList.toggle("has-selection", required === 1 && selected.length > 0);
    grid.innerHTML = deck.slice(page * count, (page + 1) * count).map((card, i, cards) => {
      const picked = selected.findIndex(item => item.id === card.id);
      const t = cards.length === 1 ? .5 : i / (cards.length - 1);
      const selectedClass = picked >= 0 ? (required === 1 ? " is-selected" : " is-picked") : "";
      return `<button type="button" class="tarot-pick${selectedClass}" data-card-id="${card.id}" style="--fan-x:${8 + t * 84}%;--fan-y:${35 + Math.sin(t * Math.PI) * 17}%;--fan-angle:${-13 + t * 26}deg;--fan-layer:${i + 1}" aria-label="${picked >= 0 ? `เลือกแล้วลำดับ ${picked + 1} ${card.thName}` : `เลือกไพ่ใบที่ ${page * count + i + 1}`}" ${picked >= 0 || selected.length >= required || busy ? "disabled" : ""}>
        ${picked >= 0 ? renderCardFace(card, "pick") : renderCardBack()}
        ${picked >= 0 ? `<span class="tarot-pick-number">${picked + 1}</span>` : ""}</button>`;
    }).join("");
    prev.disabled = busy || page === 0 || selected.length >= required;
    next.disabled = busy || (page + 1) * count >= deck.length || selected.length >= required;
    form.querySelector("[data-tarot-page]").textContent = `${page + 1} / ${Math.ceil(deck.length / count)}`;
    form.querySelector("[data-tarot-selected]").value = selected.map(c => c.id).join(",");
    form.querySelector("[data-tarot-count]").value = String(selected.length);
    read.disabled = bottom.disabled = busy || selected.length !== required;
    for (const button of form.querySelectorAll("[data-tarot-shuffle], [data-tarot-cut]")) button.disabled = busy;
    const strip = form.querySelector("[data-tarot-selection]");
    strip.hidden = required === 1 || !selected.length;
    strip.innerHTML = selected.map((card, i) => `<figure>${renderCardFace(card, "thumbnail")}<figcaption>${i + 1}. ${card.thName}</figcaption></figure>`).join("");
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
    if (selected.length === required) bottom.focus({ preventScroll: true });
    else (grid.querySelector("button:not(:disabled)") || next).focus({ preventScroll: true });
  });
  prev.addEventListener("click", () => { page--; render(); grid.querySelector("button:not(:disabled)")?.focus({ preventScroll: true }); });
  next.addEventListener("click", () => { page++; render(); grid.querySelector("button:not(:disabled)")?.focus({ preventScroll: true }); });
  mobile.addEventListener("change", () => {
    if (selected.length === 1 && required === 1) page = Math.floor(deck.findIndex(c => c.id === selected[0].id) / size());
    render();
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
    selected = []; page = 0; busy = false;
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
