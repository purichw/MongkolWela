const diagramNotes = {
  main: "เส้นหลักใช้เริ่มอ่านโครงเรื่องใหญ่ของชีวิต: หัวใจ สมอง และชีวิต",
  minor: "เส้นรองช่วยขยายบริบทเรื่องงาน ชื่อเสียง การสื่อสาร และความสัมพันธ์",
  mounts: "เนินมือใช้ดูพื้นที่พลังตามดาวทั้งเก้า ควรอ่านร่วมกับรูปมือและเส้นที่พาดผ่าน",
};

initPalmistryDiagram();

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
