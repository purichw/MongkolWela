import { sitePlaceholderImage } from "../lib/image-placeholder.js";
import { renderIcon, escapeHtml } from "../lib/ui-markup.js";
import { readingForContext } from "../data/tarot-editorial.js";

export function renderCardBack() {
  return `<img class="tarot-back-image" src="/assets/images/tarot/celestial-card-back.webp" alt="" aria-hidden="true" draggable="false" width="360" height="540">`;
}

export function renderCardFace(card, size = "result") {
  return `<span class="tarot-face tarot-face-${size}"><img class="tarot-card-image" src="${escapeHtml(card.image || sitePlaceholderImage)}" data-fallback-src="${sitePlaceholderImage}" alt="${escapeHtml(card.thName)} (${escapeHtml(card.name)})" decoding="async" loading="${size === "thumbnail" ? "lazy" : "eager"}"></span>`;
}

export function renderReadingSections(sections, prefix) {
  return `<div class="tarot-reading-list">${sections.map(({ label, text, icon }, index) => `<details class="tarot-reading-section" id="${prefix}-${index}"${typeof window === "undefined" || !window.matchMedia("(max-width: 720px)").matches ? " open" : ""}>
    <summary>${renderIcon(icon)}<span>${escapeHtml(label)}</span>${renderIcon("chevron-down")}</summary><p>${escapeHtml(text)}</p></details>`).join("")}</div>`;
}

export function renderSingleReading(card, { verdict, labels = {}, reading = card.interpretation, advice = card.advice, caution = card.caution, drawAgain = "จับไพ่ใหม่" } = {}) {
  return `<div class="tarot-result-card-wrap">${renderCardFace(card)}
      <a class="tarot-meaning-link" href="/tarot/meanings/${card.id}/">${renderIcon("book-open")}ความหมายไพ่ใบนี้${renderIcon("arrow-right")}</a></div>
    <article class="tarot-result-copy">
      <p class="section-kicker">ไพ่ที่คุณเลือก</p><h2>${escapeHtml(card.thName)}</h2><p class="tarot-result-name">${escapeHtml(card.name)}</p>
      <div class="tarot-meaning-tags"><span>${escapeHtml(card.theme)}</span></div>
      ${verdict ? `<div class="tarot-verdict"><span>${labels.verdict || "ผลโดยรวม"}</span><strong>${escapeHtml(verdict.label)}</strong><p>${escapeHtml(verdict.copy)}</p></div>` : ""}
      <blockquote class="tarot-reflection">${renderIcon("quote")}<p>${escapeHtml(card.mantra)}</p></blockquote>
      ${renderReadingSections([
        { label: labels.reading || "ความหมายโดยรวม", text: reading, icon: "book-open" },
        { label: labels.advice || "คำแนะนำ", text: advice, icon: "lightbulb" },
        { label: labels.caution || "ข้อควรระวัง", text: caution, icon: "info" },
      ], "reading")}
      <div class="tarot-auspicious-grid">
        <article><span>${labels.color || "สีมงคล"}</span><strong>${renderIcon("sunrise")}${escapeHtml(card.color)}</strong></article>
        <article><span>${labels.time || "ช่วงเวลามงคล"}</span><strong>${renderIcon("clock")}${escapeHtml(card.time)}</strong></article>
      </div>
      <p class="tarot-belief-note">สีและเวลาเป็นคำอ่านตามความเชื่อ ไม่ใช่การรับรองผลลัพธ์</p>
      ${renderReadingActions(drawAgain)}
    </article>`;
}

export function renderReadingActions(label = "จับไพ่ใหม่") {
  return `<div class="tarot-result-actions"><a class="primary-action" href="../">${escapeHtml(label)}${renderIcon("arrow-right")}</a><a class="secondary-action" href="/">กลับหน้าหลัก</a></div>`;
}

export function renderMonthlyCard(card, position, index) {
  const reading = readingForContext(card, "monthly");
  return `<article class="tarot-monthly-card" data-monthly-position="${escapeHtml(position.id)}">
    <header><span class="tarot-position-number">${String(index + 1).padStart(2, "0")}</span><div><h3>${escapeHtml(position.title)}</h3><p>${escapeHtml(position.focus)}</p></div></header>
    <div class="tarot-monthly-content"><a class="tarot-monthly-image" href="/tarot/meanings/${card.id}/" aria-label="ความหมายไพ่ ${escapeHtml(card.thName)}">${renderCardFace(card, "spread")}</a>
      <div><h4>${escapeHtml(card.thName)}</h4><p class="tarot-result-name">${escapeHtml(card.name)}</p><p class="tarot-card-theme">${escapeHtml(card.theme)}</p>
      ${renderReadingSections([
        { label: "คำอ่านรายเดือน", text: reading.reading, icon: "book-open" },
        { label: "คำแนะนำ", text: reading.advice, icon: "lightbulb" },
        { label: "ข้อควรระวัง", text: reading.caution, icon: "info" },
        { label: "ทบทวนตำแหน่งนี้", text: position.advice, icon: "message-circle" },
      ], `position-${index}`)}</div></div>
  </article>`;
}

export function renderEmptyReading(title, copy) {
  return `<div class="tarot-empty-result">${renderIcon("layers-2")}<h2>${escapeHtml(title)}</h2><p>${escapeHtml(copy)}</p><a class="primary-action" href="../">กลับไปเลือกไพ่${renderIcon("arrow-right")}</a></div>`;
}
