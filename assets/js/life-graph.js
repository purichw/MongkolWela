import { renderLifeGraph } from "./life-graph-chart.js?v=20260605-16";
import { calculateLifeGraph } from "./life-graph-engine.js?v=20260605-16";
import { ThaiCalendarProvider } from "./thai-calendar-provider.js?v=20260605-16";

const selectors = {
  form: "[data-life-graph-form]",
  output: "[data-life-graph-output]",
  hourOptions: "[data-hour-options]",
  minuteOptions: "[data-minute-options]",
};

initLifeGraph();

function initLifeGraph() {
  const form = document.querySelector(selectors.form);
  const output = document.querySelector(selectors.output);
  const calendarProvider = new ThaiCalendarProvider();

  if (!form || !output) return;

  fillTimeOptions(form);
  setDefaultDates(form);
  renderFromForm(form, output, calendarProvider);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await renderFromForm(form, output, calendarProvider);
    output.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  output.addEventListener("click", (event) => {
    const point = event.target.closest("[data-life-house]");
    if (!point) return;
    focusHouseCard(output, point.dataset.lifeHouse);
  });
}

function fillTimeOptions(form) {
  const hourSelect = form.querySelector(selectors.hourOptions);
  const minuteSelect = form.querySelector(selectors.minuteOptions);

  if (hourSelect) {
    hourSelect.innerHTML = Array.from({ length: 24 }, (_, hour) => {
      const value = String(hour).padStart(2, "0");
      return `<option value="${hour}"${hour === 12 ? " selected" : ""}>${value}</option>`;
    }).join("");
  }

  if (minuteSelect) {
    minuteSelect.innerHTML = Array.from({ length: 12 }, (_, index) => {
      const minute = index * 5;
      const value = String(minute).padStart(2, "0");
      return `<option value="${minute}"${minute === 0 ? " selected" : ""}>${value}</option>`;
    }).join("");
  }
}

function setDefaultDates(form) {
  const today = new Date();
  const defaultBirth = new Date(today.getFullYear() - 30, today.getMonth(), today.getDate());
  const birthInput = form.elements.birthDate;
  const transitInput = form.elements.transitDate;

  if (birthInput && !birthInput.value) birthInput.value = toInputDate(defaultBirth);
  if (transitInput && !transitInput.value) transitInput.value = toInputDate(today);
}

async function renderFromForm(form, output, calendarProvider) {
  if (!form.checkValidity()) return;

  output.innerHTML = renderLoadingState();

  try {
    const result = await calculateLifeGraph(
      {
        name: form.elements.name.value,
        birthDate: form.elements.birthDate.value,
        birthHour: form.elements.birthHour.value,
        birthMinute: form.elements.birthMinute.value,
        transitDate: form.elements.transitDate.value,
      },
      calendarProvider,
    );

    output.innerHTML = renderLifeGraph(result);
  } catch {
    output.innerHTML = renderErrorState();
  }
}

function renderLoadingState() {
  return `
    <div class="output-empty">
      <span>๑๒</span>
      <strong>กำลังอ่านปฏิทินไทย</strong>
      <p>ระบบกำลังตรวจเดือนจันทรคติและปีนักษัตรก่อนวางเลขฐาน 12</p>
    </div>
  `;
}

function renderErrorState() {
  return `
    <div class="output-empty">
      <span>!</span>
      <strong>ยังคำนวณไม่ได้</strong>
      <p>กรุณาตรวจวันเกิดและลองใหม่อีกครั้ง</p>
    </div>
  `;
}

function focusHouseCard(output, houseId) {
  output.querySelectorAll(".life-house-card.is-focused").forEach((card) => {
    card.classList.remove("is-focused");
  });

  const card = output.querySelector(`[data-life-house-card="${houseId}"]`);
  if (!card) return;

  card.classList.add("is-focused");
  card.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function toInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
