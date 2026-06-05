const root = document.querySelector("[data-temple-directory]");

const columnIndexes = [0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12];
const numericColumns = new Set([0, 1, 6, 8, 12]);
const pageSize = 20;

const labels = {
  all: "-- ทั้งหมด --",
  loading: "กำลังโหลดข้อมูลวัด",
  loadError: "โหลดข้อมูลวัดไม่สำเร็จ",
  count: (shown, total) => `พบ ${shown.toLocaleString("th-TH")} จาก ${total.toLocaleString("th-TH")} วัด`,
  noResults: "ไม่พบวัดที่ตรงกับเงื่อนไขค้นหา",
  source: (count) => `ใช้ข้อมูลจากไฟล์ Report_Temple 2.numbers จำนวน ${count.toLocaleString("th-TH")} รายการ`,
  previous: "ก่อนหน้า",
  next: "ถัดไป",
  pageStatus: (page, pages) => `หน้า ${page.toLocaleString("th-TH")} / ${pages.toLocaleString("th-TH")}`,
};

if (root) {
  initializeTempleDirectory(root);
}

async function initializeTempleDirectory(rootElement) {
  const t = labels;
  const form = rootElement.querySelector("[data-temple-form]");
  const clearButton = rootElement.querySelector("[data-temple-clear]");
  const countNode = rootElement.querySelector("[data-temple-count]");
  const sourceNode = rootElement.querySelector("[data-temple-source]");
  const tableHead = rootElement.querySelector("[data-temple-table-head]");
  const tableBody = rootElement.querySelector("[data-temple-table-body]");
  const pagination = rootElement.querySelector("[data-temple-pagination]");

  let rows = [];
  let headers = [];
  let filteredRows = [];
  let currentPage = 1;

  try {
    const response = await fetch("/assets/data/temples-thailand.json");
    if (!response.ok) throw new Error(`Temple data failed: ${response.status}`);
    const data = await response.json();
    rows = data.rows || [];
    headers = data.meta?.columns || [];
    filteredRows = rows;
    renderHead(tableHead, headers);
    populateStaticOptions(form, rows, t);
    updateAreaOptions(form, rows, t);
    updateView();
    if (sourceNode) sourceNode.textContent = t.source(rows.length);
  } catch (error) {
    console.error(error);
    countNode.textContent = t.loadError;
    tableBody.innerHTML = `<tr><td class="temple-empty">${t.loadError}</td></tr>`;
    return;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    currentPage = 1;
    filteredRows = filterRows(form, rows);
    updateView();
  });

  form.querySelector("[data-temple-province]").addEventListener("change", () => {
    form.querySelector("[data-temple-district]").value = "";
    form.querySelector("[data-temple-subdistrict]").value = "";
    updateAreaOptions(form, rows, t);
  });

  form.querySelector("[data-temple-district]").addEventListener("change", () => {
    form.querySelector("[data-temple-subdistrict]").value = "";
    updateAreaOptions(form, rows, t);
  });

  clearButton.addEventListener("click", () => {
    form.reset();
    currentPage = 1;
    filteredRows = rows;
    updateAreaOptions(form, rows, t);
    updateView();
  });

  pagination.addEventListener("click", (event) => {
    const button = event.target.closest("[data-page]");
    if (!button) return;
    const page = Number(button.dataset.page);
    if (!Number.isFinite(page)) return;
    currentPage = page;
    updateView();
    rootElement.querySelector(".temple-results").scrollIntoView({ block: "start" });
  });

  function updateView() {
    const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
    currentPage = Math.min(currentPage, totalPages);
    countNode.textContent = t.count(filteredRows.length, rows.length);
    renderRows(tableBody, filteredRows, currentPage, headers, t);
    renderPagination(pagination, currentPage, totalPages, t);
  }
}

function renderHead(tableHead, headers) {
  tableHead.innerHTML = `
    <tr>
      ${columnIndexes.map((index) => `<th class="${numericColumns.has(index) ? "is-number" : ""}">${escapeHtml(headers[index] || "")}</th>`).join("")}
    </tr>
  `;
}

function renderRows(tableBody, rows, page, headers, t) {
  if (!rows.length) {
    tableBody.innerHTML = `<tr><td class="temple-empty" colspan="${columnIndexes.length}">${t.noResults}</td></tr>`;
    return;
  }

  const start = (page - 1) * pageSize;
  const visibleRows = rows.slice(start, start + pageSize);
  tableBody.innerHTML = visibleRows.map((row) => `
    <tr>
      ${columnIndexes.map((index) => `
        <td class="${numericColumns.has(index) ? "is-number" : ""}" data-label="${escapeHtml(headers[index] || "")}">
          ${escapeHtml(row[index] || "-")}
        </td>
      `).join("")}
    </tr>
  `).join("");
}

function renderPagination(pagination, page, totalPages, t) {
  if (totalPages <= 1) {
    pagination.innerHTML = "";
    return;
  }

  const candidates = new Set([1, totalPages, page - 2, page - 1, page, page + 1, page + 2]);
  const pages = [...candidates].filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b);
  const buttons = [];
  let previous = 0;

  for (const value of pages) {
    if (value - previous > 1) {
      buttons.push(`<span class="temple-page-status">...</span>`);
    }
    buttons.push(`<button class="temple-page-button ${value === page ? "is-active" : ""}" type="button" data-page="${value}">${value.toLocaleString()}</button>`);
    previous = value;
  }

  pagination.innerHTML = `
    <button class="temple-page-button" type="button" data-page="${page - 1}" ${page === 1 ? "disabled" : ""}>${t.previous}</button>
    ${buttons.join("")}
    <button class="temple-page-button" type="button" data-page="${page + 1}" ${page === totalPages ? "disabled" : ""}>${t.next}</button>
    <span class="temple-page-status">${t.pageStatus(page, totalPages)}</span>
  `;
}

function populateStaticOptions(form, rows, t) {
  fillOptions(form.querySelector("[data-temple-type]"), unique(rows, 3), t.all);
  fillOptions(form.querySelector("[data-temple-sect]"), unique(rows, 4), t.all);
  fillOptions(form.querySelector("[data-temple-province]"), unique(rows, 11), t.all);
}

function updateAreaOptions(form, rows, t) {
  const province = form.querySelector("[data-temple-province]").value;
  const districtSelect = form.querySelector("[data-temple-district]");
  const subdistrictSelect = form.querySelector("[data-temple-subdistrict]");
  const district = districtSelect.value;
  const scopedRows = province ? rows.filter((row) => row[11] === province) : rows;
  const districtOptions = unique(scopedRows, 10);
  fillOptions(districtSelect, districtOptions, t.all, districtOptions.includes(district) ? district : "");

  const activeDistrict = districtSelect.value;
  const subdistrictRows = activeDistrict ? scopedRows.filter((row) => row[10] === activeDistrict) : scopedRows;
  const previousSubdistrict = subdistrictSelect.value;
  const subdistrictOptions = unique(subdistrictRows, 9);
  fillOptions(subdistrictSelect, subdistrictOptions, t.all, subdistrictOptions.includes(previousSubdistrict) ? previousSubdistrict : "");
}

function filterRows(form, rows) {
  const formData = new FormData(form);
  const name = normalize(formData.get("name"));
  const type = formData.get("type");
  const sect = formData.get("sect");
  const province = formData.get("province");
  const district = formData.get("district");
  const subdistrict = formData.get("subdistrict");
  const postalCode = normalize(formData.get("postalCode"));
  const wisung = formData.get("wisung");

  return rows.filter((row) => {
    if (name && !normalize(row[2]).includes(name)) return false;
    if (type && row[3] !== type) return false;
    if (sect && row[4] !== sect) return false;
    if (province && row[11] !== province) return false;
    if (district && row[10] !== district) return false;
    if (subdistrict && row[9] !== subdistrict) return false;
    if (postalCode && !normalize(row[12]).includes(postalCode)) return false;
    if (wisung && row[7] !== wisung) return false;
    return true;
  });
}

function unique(rows, index) {
  return [...new Set(rows.map((row) => row[index]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th"));
}

function fillOptions(select, options, allLabel, selected = select.value) {
  select.innerHTML = `<option value="">${allLabel}</option>${options.map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join("")}`;
  select.value = selected;
}

function normalize(value) {
  return String(value || "").trim().toLocaleLowerCase("th-TH");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
