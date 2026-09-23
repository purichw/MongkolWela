import { renderIcon } from "../lib/ui-markup.js";

export function renderCardBack() {
  return `<img class="tarot-back-image" src="/assets/images/tarot/celestial-card-back.webp" alt="" aria-hidden="true" draggable="false" width="360" height="540">`;
}

export function renderCardFace(card, size = "result") {
  return `<span class="tarot-face tarot-face-${size}"><img class="tarot-card-image" src="${card.image}" alt="${card.thName} (${card.name})" decoding="async" loading="${size === "thumbnail" ? "lazy" : "eager"}"></span>`;
}

export function renderReadingSections(sections, prefix) {
  return `<div class="tarot-reading-list">${sections.map(({ label, text, icon }, index) => `<details class="tarot-reading-section" id="${prefix}-${index}"${typeof window === "undefined" || !window.matchMedia("(max-width: 720px)").matches ? " open" : ""}>
    <summary>${renderIcon(icon)}<span>${label}</span>${renderIcon("chevron-down")}</summary><p>${text}</p></details>`).join("")}</div>`;
}

export function renderSingleReading(card, { verdict, labels = {}, reading = card.interpretation, advice = card.advice, caution = card.caution, drawAgain = "จับไพ่ใหม่" } = {}) {
  return `<div class="tarot-result-card-wrap">${renderCardFace(card)}
      <a class="tarot-meaning-link" href="/tarot/meanings/${card.id}/">${renderIcon("book-open")}ความหมายไพ่ใบนี้${renderIcon("arrow-right")}</a></div>
    <article class="tarot-result-copy">
      <p class="section-kicker">ไพ่ที่คุณเลือก</p><h2>${card.thName}</h2><p class="tarot-result-name">${card.name}</p>
      <div class="tarot-meaning-tags"><span>${card.theme}</span></div>
      ${verdict ? `<div class="tarot-verdict"><span>${labels.verdict || "ผลโดยรวม"}</span><strong>${verdict.label}</strong><p>${verdict.copy}</p></div>` : ""}
      <blockquote class="tarot-reflection">${renderIcon("quote")}<p>${card.mantra}</p></blockquote>
      ${renderReadingSections([
        { label: labels.reading || "ความหมายโดยรวม", text: reading, icon: "book-open" },
        { label: labels.advice || "คำแนะนำ", text: advice, icon: "lightbulb" },
        { label: labels.caution || "ข้อควรระวัง", text: caution, icon: "info" },
      ], "reading")}
      <div class="tarot-auspicious-grid">
        <article><span>${labels.color || "สีมงคล"}</span><strong>${renderIcon("sunrise")}${card.color}</strong></article>
        <article><span>${labels.time || "ช่วงเวลามงคล"}</span><strong>${renderIcon("clock")}${card.time}</strong></article>
      </div>
      <p class="tarot-belief-note">สีและเวลาเป็นคำอ่านตามความเชื่อ ไม่ใช่การรับรองผลลัพธ์</p>
      ${renderReadingActions(drawAgain)}
    </article>`;
}

export function renderReadingActions(label = "จับไพ่ใหม่") {
  return `<div class="tarot-result-actions"><a class="primary-action" href="../">${label}${renderIcon("arrow-right")}</a><a class="secondary-action" href="/">กลับหน้าหลัก</a></div>`;
}

export function renderEmptyReading(title, copy) {
  return `<div class="tarot-empty-result">${renderIcon("layers-2")}<h2>${title}</h2><p>${copy}</p><a class="primary-action" href="../">กลับไปเลือกไพ่${renderIcon("arrow-right")}</a></div>`;
}
