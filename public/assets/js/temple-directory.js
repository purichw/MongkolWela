const root = document.querySelector("[data-temple-directory]");
const quickSearchRoot = document.querySelector("[data-temple-quick-search]");
const popularTempleGrid = document.querySelector("[data-popular-temple-grid]");

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

if (popularTempleGrid) {
  initializePopularTempleGrid(popularTempleGrid);
}

function initializePopularTempleGrid(grid) {
  const cards = Array.from(grid.querySelectorAll("[data-popular-temple-card]"));
  const filterRoot = document.querySelector("[data-popular-temple-filter]");
  const filterForm = filterRoot?.querySelector("[data-popular-temple-filter-form]");
  const filterName = filterRoot?.querySelector("[data-popular-temple-filter-name]");
  const filterClear = filterRoot?.querySelector("[data-popular-temple-filter-clear]");
  const nearbyButton = filterRoot?.querySelector("[data-popular-temple-nearby]");
  const nearbyStatusNode = createNearbyStatusNode(nearbyButton);
  const regionTags = Array.from(filterRoot?.querySelectorAll("[data-popular-region-tag]") || []);
  const provinceFilter = filterRoot?.querySelector("[data-popular-province-filter]");
  const provinceTagsRoot = filterRoot?.querySelector("[data-popular-province-tags]");
  const purposeTags = Array.from(filterRoot?.querySelectorAll("[data-popular-purpose-tag]") || []);
  const countNode = document.querySelector("[data-popular-temple-count]");
  const emptyNode = document.querySelector("[data-popular-temple-empty]");
  const sentinel = document.querySelector("[data-popular-temple-sentinel]");
  const loadMoreButton = document.querySelector("[data-popular-temple-more]");
  const placeholderSrc = grid.dataset.placeholderSrc;
  const initialCount = readPositiveInteger(grid.dataset.initialCount, 9);
  const batchSize = readPositiveInteger(grid.dataset.batchSize, initialCount);
  const originalCardOrder = new Map(cards.map((card, index) => [card, index]));
  let filteredCards = cards;
  let visibleCount = 0;
  let activeRegion = "";
  let activeProvince = "";
  let activeNearby = false;
  let userLocation = null;
  let isRequestingLocation = false;
  let nearbyStatus = "";
  const activePurposes = new Set();

  if (!cards.length) return;

  countNode?.setAttribute("role", "status");
  countNode?.setAttribute("aria-live", "polite");
  emptyNode?.setAttribute("role", "status");
  nearbyButton?.setAttribute("aria-pressed", "false");
  updateRegionTags();
  updatePurposeTags();

  grid.addEventListener(
    "error",
    (event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement)) return;
      const fallbackSrc = image.dataset.fallbackSrc || placeholderSrc;
      if (!fallbackSrc || image.dataset.fallbackApplied === "true") return;

      image.dataset.fallbackApplied = "true";
      image.src = fallbackSrc;
      image.closest("[data-popular-temple-card]")?.classList.add("is-placeholder");
    },
    true,
  );

  cards.forEach((card) => {
    card.hidden = true;
  });

  applyPopularFilters();

  filterForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    applyPopularFilters();
  });

  document.addEventListener("mw:temple-overrides-applied", () => {
    updateProvinceTags();
    applyPopularFilters();
  });

  filterName?.addEventListener("input", () => {
    applyPopularFilters();
  });

  filterClear?.addEventListener("click", () => {
    if (filterName) filterName.value = "";
    activeRegion = "";
    activeProvince = "";
    activeNearby = false;
    activePurposes.clear();
    clearCardDistances();
    updateNearbyButton();
    updateRegionTags();
    updateProvinceTags();
    updatePurposeTags();
    applyPopularFilters();
  });

  regionTags.forEach((tag) => {
    tag.addEventListener("click", () => {
      activeRegion = tag.value || "";
      activeProvince = "";
      updateRegionTags();
      updateProvinceTags();
      applyPopularFilters();
    });
  });

  purposeTags.forEach((tag) => {
    tag.addEventListener("click", () => {
      const value = tag.value || "";
      if (!value) {
        activePurposes.clear();
      } else if (activePurposes.has(value)) {
        activePurposes.delete(value);
      } else {
        activePurposes.add(value);
      }
      updatePurposeTags();
      applyPopularFilters();
    });
  });

  loadMoreButton?.addEventListener("click", () => {
    revealNext(batchSize);
  });

  nearbyButton?.addEventListener("click", async () => {
    if (isRequestingLocation) return;

    if (activeNearby) {
      activeNearby = false;
      nearbyStatus = "";
      clearCardDistances();
      updateNearbyButton();
      applyPopularFilters();
      return;
    }

    nearbyStatus = "";
    if (!userLocation) {
      isRequestingLocation = true;
      updateNearbyButton();
      const location = await requestUserLocation();
      isRequestingLocation = false;

      if (!location) {
        activeNearby = false;
        clearCardDistances();
        updateNearbyButton();
        renderVisibleCards();
        return;
      }

      userLocation = location;
    }

    activeNearby = true;
    updateCardDistances();
    updateNearbyButton();
    applyPopularFilters();
  });

  if (!sentinel || !("IntersectionObserver" in window)) {
    updateLoadMoreButton();
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      revealNext(batchSize);
    },
    { rootMargin: "480px 0px" },
  );

  observer.observe(sentinel);

  function applyPopularFilters() {
    const query = normalize(filterName?.value || "");
    filteredCards = cards.filter((card) => {
      const matchesQuery = !query || normalize(card.dataset.searchText).includes(query);
      const matchesRegion = !activeRegion || card.dataset.region === activeRegion;
      const matchesProvince = !activeProvince || card.dataset.province === activeProvince;
      const matchesPurpose = !activePurposes.size || splitDataTags(card.dataset.blessings).some((tag) => activePurposes.has(tag));
      return matchesQuery && matchesRegion && matchesProvince && matchesPurpose;
    });
    sortFilteredCards();
    visibleCount = Math.min(initialCount, filteredCards.length);
    renderVisibleCards();
    document.dispatchEvent(new CustomEvent("mw:filter-change", {
      detail: {
        scope: "temple_cards",
        region: activeRegion || "all",
        province: activeProvince || "all",
        purposes: [...activePurposes],
        nearby: activeNearby,
        resultCount: filteredCards.length,
      },
    }));
  }

  function revealNext(count) {
    visibleCount = Math.min(filteredCards.length, visibleCount + count);
    renderVisibleCards();
  }

  function renderVisibleCards() {
    filteredCards.forEach((card) => {
      grid.appendChild(card);
    });

    cards.forEach((card) => {
      card.hidden = true;
    });

    filteredCards.slice(0, visibleCount).forEach((card) => {
      card.hidden = false;
    });

    if (countNode) {
      countNode.textContent = `แสดง ${filteredCards.length.toLocaleString("th-TH")} จาก ${cards.length.toLocaleString("th-TH")} พิกัด${activeNearby ? " · เรียงตามใกล้ฉัน" : ""}${nearbyStatus ? ` · ${nearbyStatus}` : ""}`;
    }

    if (emptyNode) {
      emptyNode.hidden = filteredCards.length > 0;
    }

    updateLoadMoreButton();
  }

  function updateRegionTags() {
    regionTags.forEach((tag) => {
      const isActive = (tag.value || "") === activeRegion;
      tag.classList.toggle("is-active", isActive);
      tag.setAttribute("aria-pressed", String(isActive));
    });
  }

  function updateProvinceTags() {
    if (!provinceFilter || !provinceTagsRoot) return;

    if (!activeRegion) {
      provinceFilter.hidden = true;
      provinceTagsRoot.innerHTML = "";
      return;
    }

    const provinces = uniqueSorted(
      cards.filter((card) => card.dataset.region === activeRegion).map((card) => card.dataset.province),
    );

    provinceFilter.hidden = provinces.length === 0;
    provinceTagsRoot.innerHTML = "";

    const allButton = createFilterTag("ทั้งหมด", "", !activeProvince);
    provinceTagsRoot.append(allButton, ...provinces.map((province) => createFilterTag(province, province, activeProvince === province)));
  }

  function updatePurposeTags() {
    purposeTags.forEach((tag) => {
      const value = tag.value || "";
      const isActive = value ? activePurposes.has(value) : activePurposes.size === 0;
      tag.classList.toggle("is-active", isActive);
      tag.setAttribute("aria-pressed", String(isActive));
    });
  }

  function createFilterTag(label, value, isActive) {
    const button = document.createElement("button");
    button.type = "button";
    button.value = value;
    button.setAttribute("data-popular-province-tag", "");
    button.textContent = label;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
    button.addEventListener("click", () => {
      activeProvince = value;
      updateProvinceTags();
      applyPopularFilters();
    });
    return button;
  }

  function updateLoadMoreButton() {
    if (!loadMoreButton) return;
    loadMoreButton.hidden = visibleCount >= filteredCards.length;
  }

  function sortFilteredCards() {
    filteredCards.sort((a, b) => {
      if (activeNearby) {
        const aDistance = readCardDistance(a);
        const bDistance = readCardDistance(b);
        if (Number.isFinite(aDistance) || Number.isFinite(bDistance)) {
          if (!Number.isFinite(aDistance)) return 1;
          if (!Number.isFinite(bDistance)) return -1;
          if (aDistance !== bDistance) return aDistance - bDistance;
        }
      }
      return (originalCardOrder.get(a) ?? 0) - (originalCardOrder.get(b) ?? 0);
    });
  }

  function updateNearbyButton() {
    if (!nearbyButton) return;
    nearbyButton.classList.toggle("is-active", activeNearby && !isRequestingLocation);
    nearbyButton.classList.toggle("is-locating", isRequestingLocation);
    nearbyButton.setAttribute("aria-pressed", String(activeNearby));
    nearbyButton.setAttribute("aria-busy", String(isRequestingLocation));
    nearbyButton.disabled = isRequestingLocation;
    nearbyButton.textContent = isRequestingLocation ? "กำลังหาตำแหน่ง..." : activeNearby ? "เรียงตามใกล้ฉัน" : nearbyStatus ? "ลองอีกครั้ง" : "พิกัดใกล้ฉัน";
    nearbyButton.title = nearbyStatus || "";
    if (nearbyStatusNode) {
      nearbyStatusNode.textContent = nearbyStatus;
      nearbyStatusNode.hidden = !nearbyStatus;
    }
  }

  function updateCardDistances() {
    if (!userLocation) return;

    cards.forEach((card) => {
      const distance = getCardDistance(userLocation, card);
      const distanceNode = card.querySelector("[data-popular-temple-distance]");
      if (!Number.isFinite(distance) || !distanceNode) return;

      card.dataset.distanceKm = String(distance);
      distanceNode.textContent = formatDistance(distance);
      distanceNode.hidden = false;
    });
  }

  function clearCardDistances() {
    cards.forEach((card) => {
      delete card.dataset.distanceKm;
      const distanceNode = card.querySelector("[data-popular-temple-distance]");
      if (!distanceNode) return;
      distanceNode.textContent = "";
      distanceNode.hidden = true;
    });
  }

  async function requestUserLocation() {
    if (!("geolocation" in navigator)) {
      nearbyStatus = "เบราว์เซอร์นี้ยังไม่รองรับการใช้ตำแหน่ง";
      return null;
    }

    try {
      const permissionState = await readGeolocationPermissionState();
      if (permissionState === "denied") {
        nearbyStatus = "ต้องอนุญาตตำแหน่งในเบราว์เซอร์ก่อน";
        return null;
      }

      let timeoutId = 0;
      const position = await new Promise((resolve, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(createLocationTimeoutError());
        }, 12000);

        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          maximumAge: 5 * 60 * 1000,
          timeout: 10000,
        });
      }).finally(() => {
        window.clearTimeout(timeoutId);
      });
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
    } catch (error) {
      nearbyStatus =
        error?.code === 1
          ? "ต้องอนุญาตการใช้ตำแหน่งก่อน"
          : error?.code === 3
            ? "หาตำแหน่งไม่ทันเวลา ลองกดอีกครั้ง"
            : "หาตำแหน่งไม่ได้ในขณะนี้";
      return null;
    }
  }

  function createNearbyStatusNode(button) {
    if (!button) return null;

    const statusNode = document.createElement("p");
    statusNode.className = "temple-nearby-status";
    statusNode.hidden = true;
    statusNode.setAttribute("role", "status");
    statusNode.setAttribute("aria-live", "polite");
    button.insertAdjacentElement("afterend", statusNode);
    return statusNode;
  }

  async function readGeolocationPermissionState() {
    if (!navigator.permissions?.query) return "";

    try {
      const permission = await navigator.permissions.query({ name: "geolocation" });
      return permission.state;
    } catch {
      return "";
    }
  }

  function createLocationTimeoutError() {
    const error = new Error("Location request timed out.");
    error.code = 3;
    return error;
  }
}

function splitDataTags(value) {
  return String(value || "")
    .split(";")
    .map((item) => item.trim())
    .filter((item) => item && item !== "0" && item.toLowerCase() !== "nan" && item.toLowerCase() !== "null");
}

function getCardDistance(userLocation, card) {
  const latitude = Number(card.dataset.latitude);
  const longitude = Number(card.dataset.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return Number.POSITIVE_INFINITY;
  return haversineDistance(userLocation.latitude, userLocation.longitude, latitude, longitude);
}

function readCardDistance(card) {
  const distance = Number(card.dataset.distanceKm);
  return Number.isFinite(distance) ? distance : Number.POSITIVE_INFINITY;
}

function haversineDistance(fromLatitude, fromLongitude, toLatitude, toLongitude) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(toLatitude - fromLatitude);
  const dLon = toRadians(toLongitude - fromLongitude);
  const lat1 = toRadians(fromLatitude);
  const lat2 = toRadians(toLatitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function formatDistance(distanceKm) {
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000).toLocaleString("th-TH")} ม.`;
  if (distanceKm < 10) return `${distanceKm.toLocaleString("th-TH", { maximumFractionDigits: 1 })} กม.`;
  return `${Math.round(distanceKm).toLocaleString("th-TH")} กม.`;
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
  const name = normalizeTempleName(formData.get("name"));
  const type = formData.get("type");
  const sect = formData.get("sect");
  const region = formData.get("region");
  const province = formData.get("province");
  const district = formData.get("district");
  const subdistrict = formData.get("subdistrict");
  const postalCode = normalize(formData.get("postalCode"));
  const wisung = formData.get("wisung");

  return rows.filter((row) => {
    if (name && !normalizeTempleName(row[2]).includes(name)) return false;
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

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "th"));
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

function normalizeTempleName(value) {
  return normalize(value).replace(/^วัด\s*/, "");
}

function readPositiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
