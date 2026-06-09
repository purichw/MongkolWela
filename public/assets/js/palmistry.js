import { palmLines, palmistryRules, palmistrySources } from "./palmistry-data.js";

const selectors = {
  form: "[data-palmistry-form]",
  result: "[data-palmistry-result]",
  summary: "[data-palmistry-summary]",
  reset: "[data-palmistry-reset]",
  lineGuide: "[data-palm-line-guide]",
};

const confidenceLabels = {
  high: "สูง",
  medium: "กลาง",
  low: "ต่ำ",
};

const traditionLabels = {
  thai: "ไทย-first",
  western: "ตำราตะวันตก",
  shared: "โครงร่วม",
};

initPalmistry();

function initPalmistry() {
  const form = document.querySelector(selectors.form);
  const result = document.querySelector(selectors.result);
  const summary = document.querySelector(selectors.summary);
  if (!form || !result || !summary) return;

  renderLineGuide(document.querySelector(selectors.lineGuide));
  renderEmpty(result, summary);

  form.addEventListener("change", () => renderReading(form, result, summary));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    renderReading(form, result, summary);
    result.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  form.querySelector(selectors.reset)?.addEventListener("click", () => {
    form.reset();
    renderEmpty(result, summary);
  });
}

function renderLineGuide(container) {
  if (!container) return;
  container.innerHTML = palmLines
    .map((line) => {
      const sourceLabels = line.sourceIds.map((sourceId) => palmistrySources[sourceId]?.label).filter(Boolean);
      return `
        <article class="palm-guide-card" data-guide-line="${line.id}">
          <span>${line.shortLabel}</span>
          <h3>${line.label}</h3>
          <p>${line.guide}</p>
          <small>อ้างอิง: ${sourceLabels.map(escapeHtml).join(", ")}</small>
        </article>
      `;
    })
    .join("");
}

function renderReading(form, result, summary) {
  const selectedIds = getSelectedRuleIds(form);
  const selectedRules = selectedIds
    .map((id) => palmistryRules.find((rule) => rule.id === id))
    .filter(Boolean);

  if (!selectedRules.length) {
    renderEmpty(result, summary);
    return;
  }

  const selectedLines = new Set(selectedRules.map((rule) => rule.lineId));
  const sourceIds = unique(selectedRules.flatMap((rule) => rule.sourceIds));
  const lowConfidenceCount = selectedRules.filter((rule) => rule.confidence === "low").length;
  const handRole = getHandRole(form);

  summary.innerHTML = `
    <strong>${selectedRules.length} ข้ออ่าน</strong>
    <span>${selectedLines.size}/4 เส้นหลัก</span>
    <span>${sourceIds.length} แหล่งอ้างอิง</span>
    <span>${handRole}</span>
  `;

  result.innerHTML = `
    <section class="palm-reading-head">
      <div>
        <p class="section-kicker">ผลอ่านแบบตรวจย้อนกลับได้</p>
        <h2>อ่านจากเส้นที่คุณยืนยันเอง</h2>
        <p>
          ระบบแสดงเฉพาะ rule ที่มีแหล่งอ้างอิงผูกไว้ และใช้คำแปลผลเชิงความเชื่อ/ทบทวนตัวเอง
          ไม่ใช่คำวินิจฉัยสุขภาพ จิตวิทยา หรืออนาคตแบบฟันธง
        </p>
      </div>
      <div class="palm-proof-badge">
        <span>ความระวัง</span>
        <strong>${lowConfidenceCount ? `${lowConfidenceCount} ข้อต้องอ่านเบา ๆ` : "ผ่านฐานกลาง"}</strong>
      </div>
    </section>

    <div class="palm-reading-grid">
      ${selectedRules.map(renderRuleCard).join("")}
    </div>

    <section class="palm-source-panel">
      <div>
        <p class="section-kicker">แหล่งข้อมูลที่ใช้ยืนยัน</p>
        <h3>rule ทุกข้อโยงกลับมาที่ชุดนี้</h3>
      </div>
      <div class="palm-source-list">
        ${sourceIds.map(renderSourceLink).join("")}
      </div>
    </section>
  `;
}

function renderRuleCard(rule) {
  const line = palmLines.find((item) => item.id === rule.lineId);
  return `
    <article class="palm-reading-card">
      <div class="palm-reading-card-head">
        <span>${escapeHtml(line?.label || "เส้นลายมือ")}</span>
        <strong>${escapeHtml(rule.featureLabel)}</strong>
      </div>
      <dl>
        <div>
          <dt>อ่านจากอะไร</dt>
          <dd>${escapeHtml(rule.observation)}</dd>
        </div>
        <div>
          <dt>คำอ่าน</dt>
          <dd>${escapeHtml(rule.reading)}</dd>
        </div>
        <div>
          <dt>คำแนะนำ</dt>
          <dd>${escapeHtml(rule.advice)}</dd>
        </div>
      </dl>
      <div class="palm-reading-meta">
        <span>${traditionLabels[rule.tradition] || "ตรวจสอบได้"}</span>
        <span>ความมั่นใจ ${confidenceLabels[rule.confidence] || "กลาง"}</span>
        <span>${rule.sourceIds.length} source</span>
      </div>
    </article>
  `;
}

function renderSourceLink(sourceId) {
  const source = palmistrySources[sourceId];
  if (!source) return "";
  return `
    <a href="${escapeAttribute(source.href)}" target="_blank" rel="noreferrer">
      <strong>${escapeHtml(source.label)}</strong>
      <span>${escapeHtml(source.note)}</span>
    </a>
  `;
}

function renderEmpty(result, summary) {
  summary.innerHTML = `
    <strong>ยังไม่ได้เลือกเส้น</strong>
    <span>เลือกเฉพาะจุดที่เห็นชัด</span>
    <span>ไม่ชัดให้เว้นไว้</span>
  `;
  result.innerHTML = `
    <div class="palm-empty">
      <span>ฝ่ามือ</span>
      <strong>เริ่มจากระบุเส้นก่อนอ่านผล</strong>
      <p>
        เลือกมือที่ต้องการอ่าน แล้วติ๊กเฉพาะลักษณะของเส้นที่เห็นชัด
        ผลอ่านจะปรากฏพร้อมเหตุผลและแหล่งอ้างอิงของ rule นั้น
      </p>
    </div>
  `;
}

function getSelectedRuleIds(form) {
  return [...form.querySelectorAll('input[name="palmFeatures"]:checked')].map((input) => input.value);
}

function getHandRole(form) {
  const value = form.querySelector('input[name="handRole"]:checked')?.value || "dominant";
  if (value === "left") return "มือซ้าย";
  if (value === "right") return "มือขวา";
  return "มือถนัด";
}

function unique(items) {
  return [...new Set(items)];
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
