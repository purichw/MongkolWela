const root = document.querySelector("[data-temple-directory]");
const quickSearchRoot = document.querySelector("[data-temple-quick-search]");

const columnIndexes = [0, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12];
const numericColumns = new Set([0, 6, 8, 12]);
const pageSize = 20;

const labels = {
  all: "-- ทั้งหมด --",
  chooseRegion: "-- เลือกภาค --",
  chooseRegionFirst: "-- เลือกภาคก่อน --",
  chooseProvinceFirst: "-- เลือกจังหวัดก่อน --",
  chooseDistrictFirst: "-- เลือกอำเภอก่อน --",
  loading: "กำลังโหลดข้อมูลวัด",
  loadError: "โหลดข้อมูลวัดไม่สำเร็จ",
  count: (shown, total) => `พบ ${shown.toLocaleString("th-TH")} จาก ${total.toLocaleString("th-TH")} วัด`,
  noResults: "ไม่พบวัดที่ตรงกับเงื่อนไขค้นหา",
  source: "แหล่งที่มา: ระบบทะเบียนวัด สำนักงานพระพุทธศาสนาแห่งชาติ",
  previous: "ก่อนหน้า",
  next: "ถัดไป",
  pageStatus: (page, pages) => `หน้า ${page.toLocaleString("th-TH")} / ${pages.toLocaleString("th-TH")}`,
};

const regionOrder = [
  "ภาคเหนือ",
  "ภาคกลาง",
  "ภาคตะวันออกเฉียงเหนือ",
  "ภาคตะวันออก",
  "ภาคตะวันตก",
  "ภาคใต้",
];

const regionProvinces = {
  "ภาคเหนือ": [
    "เชียงราย",
    "เชียงใหม่",
    "น่าน",
    "พะเยา",
    "แพร่",
    "แม่ฮ่องสอน",
    "ลำปาง",
    "ลำพูน",
    "อุตรดิตถ์",
  ],
  "ภาคกลาง": [
    "กรุงเทพมหานคร",
    "กำแพงเพชร",
    "ชัยนาท",
    "นครนายก",
    "นครปฐม",
    "นครสวรรค์",
    "นนทบุรี",
    "ปทุมธานี",
    "พระนครศรีอยุธยา",
    "พิจิตร",
    "พิษณุโลก",
    "เพชรบูรณ์",
    "ลพบุรี",
    "สมุทรปราการ",
    "สมุทรสงคราม",
    "สมุทรสาคร",
    "สระบุรี",
    "สิงห์บุรี",
    "สุโขทัย",
    "สุพรรณบุรี",
    "อ่างทอง",
    "อุทัยธานี",
  ],
  "ภาคตะวันออกเฉียงเหนือ": [
    "กาฬสินธุ์",
    "ขอนแก่น",
    "ชัยภูมิ",
    "นครพนม",
    "นครราชสีมา",
    "บึงกาฬ",
    "บุรีรัมย์",
    "มหาสารคาม",
    "มุกดาหาร",
    "ยโสธร",
    "ร้อยเอ็ด",
    "เลย",
    "ศรีสะเกษ",
    "สกลนคร",
    "สุรินทร์",
    "หนองคาย",
    "หนองบัวลำภู",
    "อำนาจเจริญ",
    "อุดรธานี",
    "อุบลราชธานี",
  ],
  "ภาคตะวันออก": [
    "จันทบุรี",
    "ฉะเชิงเทรา",
    "ชลบุรี",
    "ตราด",
    "ปราจีนบุรี",
    "ระยอง",
    "สระแก้ว",
  ],
  "ภาคตะวันตก": [
    "กาญจนบุรี",
    "ตาก",
    "ประจวบคีรีขันธ์",
    "เพชรบุรี",
    "ราชบุรี",
  ],
  "ภาคใต้": [
    "กระบี่",
    "ชุมพร",
    "ตรัง",
    "นครศรีธรรมราช",
    "นราธิวาส",
    "ปัตตานี",
    "พังงา",
    "พัทลุง",
    "ภูเก็ต",
    "ยะลา",
    "ระนอง",
    "สงขลา",
    "สตูล",
    "สุราษฎร์ธานี",
  ],
};

const provinceRegionMap = Object.fromEntries(
  Object.entries(regionProvinces).flatMap(([region, provinces]) => provinces.map((province) => [province, region])),
);

if (root) {
  initializeTempleDirectory(root);
}

if (quickSearchRoot) {
  initializeTempleQuickSearch(quickSearchRoot);
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
    renderHead(tableHead, headers);
    populateStaticOptions(form, rows, t);
    updateAreaOptions(form, rows, t);
    filteredRows = applySearchParams(form, rows, t) ? filterRows(form, rows) : rows;
    updateView();
    if (sourceNode) sourceNode.textContent = t.source;
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
    syncUrlFromForm(form);
    updateView();
  });

  bindAreaEvents(form, rows, t);

  clearButton.addEventListener("click", () => {
    form.reset();
    currentPage = 1;
    filteredRows = rows;
    updateAreaOptions(form, rows, t);
    clearSearchUrl();
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

async function initializeTempleQuickSearch(rootElement) {
  const t = labels;
  const form = rootElement.querySelector("[data-temple-form]");
  const clearButton = rootElement.querySelector("[data-temple-clear]");

  try {
    const response = await fetch("/assets/data/temples-thailand.json");
    if (!response.ok) throw new Error(`Temple data failed: ${response.status}`);
    const data = await response.json();
    const rows = data.rows || [];
    populateStaticOptions(form, rows, t);
    updateAreaOptions(form, rows, t);
    applySearchParams(form, rows, t);
    bindAreaEvents(form, rows, t);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      redirectToDirectory(form);
    });

    clearButton.addEventListener("click", () => {
      form.reset();
      updateAreaOptions(form, rows, t);
    });
  } catch (error) {
    console.error(error);
    form.querySelectorAll("input, select, button").forEach((element) => {
      element.disabled = true;
    });
  }
}

function bindAreaEvents(form, rows, t) {
  form.querySelector("[data-temple-region]").addEventListener("change", () => {
    form.querySelector("[data-temple-province]").value = "";
    form.querySelector("[data-temple-district]").value = "";
    form.querySelector("[data-temple-subdistrict]").value = "";
    updateAreaOptions(form, rows, t);
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
}

function renderHead(tableHead, headers) {
  tableHead.innerHTML = `
    <tr>
      ${columnIndexes.map((index) => `<th class="${getColumnClass(index)}">${escapeHtml(headers[index] || "")}</th>`).join("")}
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
        <td class="${getColumnClass(index)}" data-label="${escapeHtml(headers[index] || "")}">
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
  fillOptions(form.querySelector("[data-temple-region]"), getAvailableRegions(rows), t.chooseRegion);
}

function updateAreaOptions(form, rows, t) {
  const region = form.querySelector("[data-temple-region]").value;
  const provinceSelect = form.querySelector("[data-temple-province]");
  const province = form.querySelector("[data-temple-province]").value;
  const districtSelect = form.querySelector("[data-temple-district]");
  const subdistrictSelect = form.querySelector("[data-temple-subdistrict]");
  const district = districtSelect.value;

  if (!region) {
    fillOptions(provinceSelect, [], t.chooseRegionFirst, "");
    fillOptions(districtSelect, [], t.chooseProvinceFirst, "");
    fillOptions(subdistrictSelect, [], t.chooseDistrictFirst, "");
    provinceSelect.disabled = true;
    districtSelect.disabled = true;
    subdistrictSelect.disabled = true;
    return;
  }

  provinceSelect.disabled = false;
  const regionRows = rows.filter((row) => provinceRegionMap[row[11]] === region);
  const provinceOptions = unique(regionRows, 11);
  fillOptions(provinceSelect, provinceOptions, t.all, provinceOptions.includes(province) ? province : "");

  if (!province) {
    fillOptions(districtSelect, [], t.chooseProvinceFirst, "");
    fillOptions(subdistrictSelect, [], t.chooseDistrictFirst, "");
    districtSelect.disabled = true;
    subdistrictSelect.disabled = true;
    return;
  }

  districtSelect.disabled = false;
  const scopedRows = regionRows.filter((row) => row[11] === province);
  const districtOptions = unique(scopedRows, 10);
  fillOptions(districtSelect, districtOptions, t.all, districtOptions.includes(district) ? district : "");

  const activeDistrict = districtSelect.value;
  if (!activeDistrict) {
    fillOptions(subdistrictSelect, [], t.chooseDistrictFirst, "");
    subdistrictSelect.disabled = true;
    return;
  }

  subdistrictSelect.disabled = false;
  const subdistrictRows = scopedRows.filter((row) => row[10] === activeDistrict);
  const previousSubdistrict = subdistrictSelect.value;
  const subdistrictOptions = unique(subdistrictRows, 9);
  fillOptions(subdistrictSelect, subdistrictOptions, t.all, subdistrictOptions.includes(previousSubdistrict) ? previousSubdistrict : "");
}

function filterRows(form, rows) {
  const formData = new FormData(form);
  const name = normalize(formData.get("name"));
  const type = formData.get("type");
  const sect = formData.get("sect");
  const region = formData.get("region");
  const province = formData.get("province");
  const district = formData.get("district");
  const subdistrict = formData.get("subdistrict");
  const postalCode = normalize(formData.get("postalCode"));
  const wisung = formData.get("wisung");

  return rows.filter((row) => {
    if (name && !normalize(row[2]).includes(name)) return false;
    if (type && row[3] !== type) return false;
    if (sect && row[4] !== sect) return false;
    if (region && provinceRegionMap[row[11]] !== region) return false;
    if (province && row[11] !== province) return false;
    if (district && row[10] !== district) return false;
    if (subdistrict && row[9] !== subdistrict) return false;
    if (postalCode && !normalize(row[12]).includes(postalCode)) return false;
    if (wisung && row[7] !== wisung) return false;
    return true;
  });
}

function applySearchParams(form, rows, t) {
  const params = new URLSearchParams(window.location.search);
  if (!params.size) return false;

  setInputValue(form.elements.name, params.get("name"));
  setSelectValue(form.querySelector("[data-temple-type]"), params.get("type"));
  setSelectValue(form.querySelector("[data-temple-sect]"), params.get("sect"));
  setSelectValue(form.querySelector("[data-temple-region]"), params.get("region"));
  updateAreaOptions(form, rows, t);

  setSelectValue(form.querySelector("[data-temple-province]"), params.get("province"));
  updateAreaOptions(form, rows, t);

  setSelectValue(form.querySelector("[data-temple-district]"), params.get("district"));
  updateAreaOptions(form, rows, t);

  setSelectValue(form.querySelector("[data-temple-subdistrict]"), params.get("subdistrict"));
  setInputValue(form.elements.postalCode, params.get("postalCode"));
  setSelectValue(form.querySelector("[data-temple-wisung]"), params.get("wisung"));
  return true;
}

function redirectToDirectory(form) {
  const query = getSearchParams(form).toString();
  window.location.href = `/temples/thailand/${query ? `?${query}` : ""}`;
}

function syncUrlFromForm(form) {
  const query = getSearchParams(form).toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ""}`;
  window.history.replaceState({}, "", url);
}

function clearSearchUrl() {
  window.history.replaceState({}, "", window.location.pathname);
}

function getSearchParams(form) {
  const params = new URLSearchParams();
  new FormData(form).forEach((value, key) => {
    const text = String(value || "").trim();
    if (text) params.set(key, text);
  });
  return params;
}

function setInputValue(input, value) {
  if (input && value) input.value = value;
}

function setSelectValue(select, value) {
  if (!select || !value) return;
  const hasOption = [...select.options].some((option) => option.value === value);
  if (hasOption) select.value = value;
}

function unique(rows, index) {
  return [...new Set(rows.map((row) => row[index]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th"));
}

function getAvailableRegions(rows) {
  const rowRegions = new Set(rows.map((row) => provinceRegionMap[row[11]]).filter(Boolean));
  return regionOrder.filter((region) => rowRegions.has(region));
}

function fillOptions(select, options, allLabel, selected = select.value) {
  select.innerHTML = `<option value="">${allLabel}</option>${options.map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join("")}`;
  select.value = selected;
}

function getColumnClass(index) {
  return [
    `temple-cell-${index}`,
    numericColumns.has(index) ? "is-number" : "",
    index === 2 ? "" : "is-nowrap",
  ].filter(Boolean).join(" ");
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
