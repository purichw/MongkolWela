import { palmLines } from "./palmistry-data.js";

const diagramNotes = {
  main: "เส้นหลักใช้เริ่มอ่านโครงเรื่องใหญ่ของชีวิต: หัวใจ สมอง และชีวิต",
  minor: "เส้นรองช่วยขยายบริบทเรื่องงาน ชื่อเสียง การสื่อสาร และความสัมพันธ์",
  mounts: "เนินมือใช้ดูพื้นที่พลังตามดาวทั้งเก้า ควรอ่านร่วมกับรูปมือและเส้นที่พาดผ่าน",
};

initPalmistryDiagram();
renderLineGuide(document.querySelector("[data-palm-line-guide]"));

function initPalmistryDiagram() {
  const diagram = document.querySelector("[data-palm-diagram]");
  if (!diagram) return;

  const buttons = [...diagram.querySelectorAll("[data-palm-view]")];
  const layers = [...diagram.querySelectorAll("[data-palm-layer]")];
  const note = diagram.querySelector("[data-palm-view-note]");
  const mountLegend = diagram.querySelector("[data-palm-mount-legend]");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const view = button.dataset.palmView || "main";

      buttons.forEach((item) => {
        item.setAttribute("aria-pressed", String(item === button));
      });

      layers.forEach((layer) => {
        const isActive = layer.dataset.palmLayer === view;
        layer.classList.toggle("is-hidden", !isActive);
        layer.classList.toggle("is-active", isActive);
        layer.setAttribute("aria-hidden", String(!isActive));
      });

      if (note) note.textContent = diagramNotes[view] || diagramNotes.main;
      if (mountLegend) mountLegend.hidden = view !== "mounts";
    });
  });
}

function renderLineGuide(container) {
  if (!container) return;

  container.innerHTML = palmLines
    .map(
      (line) => `
        <article class="palm-guide-card" data-guide-line="${escapeAttribute(line.id)}">
          <span>${escapeHtml(line.shortLabel)}</span>
          <h3>${escapeHtml(line.label)}</h3>
          <p>${escapeHtml(line.guide)}</p>
        </article>
      `,
    )
    .join("");
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
