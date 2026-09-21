import { renderIcon } from "../lib/ui-markup.js";
import { initializePopularFilters, filterSnapshotKey } from "./popular-filters.js";

const root = document.querySelector("[data-temple-directory]");
const quickSearchRoot = document.querySelector("[data-temple-quick-search]");
const popularTempleGrid = document.querySelector("[data-popular-temple-grid]");

const columnIndexes = [0, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12];
const summaryColumns = [0, 2, 3, 4, 5, 6, 8];
const tableColumnCount = summaryColumns.length + 1;
const numericColumns = new Set([0, 6, 8, 12]);
const pageSize = 20;
const thailandIndexUrl = "/assets/data/temples-thailand-index.json";
const thailandDataUrl = "/assets/data/temples-thailand.json";

const labels = {
  all: "-- ทั้งหมด --",
  chooseRegion: "-- เลือกภาค --",
  chooseRegionFirst: "-- เลือกภาคก่อน --",
  chooseProvinceFirst: "-- เลือกจังหวัดก่อน --",
  chooseDistrictFirst: "-- เลือกอำเภอก่อน --",
  loading: "กำลังโหลดข้อมูลวัด",
  loadingFull: "กำลังโหลดฐานข้อมูลฉบับเต็ม",
  loadError: "โหลดข้อมูลวัดไม่สำเร็จ",
  count: (shown, total) => `พบ ${shown.toLocaleString("th-TH")} จาก ${total.toLocaleString("th-TH")} วัด`,
  previewCount: (shown, total) =>
    `แสดงตัวอย่าง ${shown.toLocaleString("th-TH")} จาก ${total.toLocaleString("th-TH")} วัด · กดค้นหาเพื่อโหลดผลลัพธ์เต็ม`,
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
  let cards = Array.from(grid.querySelectorAll("[data-popular-temple-card]"));
  const filterRoot = document.querySelector("[data-popular-temple-filter]");
  const compact = Boolean(filterRoot?.hasAttribute("data-compact-filters"));
  const filterForm = filterRoot?.querySelector("[data-popular-temple-filter-form]");
  const filterName = filterRoot?.querySelector("[data-popular-temple-filter-name]");
  const filterClear = filterRoot?.querySelector("[data-popular-temple-filter-clear]");
  const nearbyButton = filterRoot?.querySelector("[data-popular-temple-nearby]");
  const nearbyStatusNode = compact ? null : createNearbyStatusNode(nearbyButton);
  const regionTags = Array.from(filterRoot?.querySelectorAll("[data-popular-region-tag]") || []);
  const provinceFilter = filterRoot?.querySelector("[data-popular-province-filter]");
  const provinceTagsRoot = filterRoot?.querySelector("[data-popular-province-tags]");
  const provinceSummary = filterRoot?.querySelector("[data-temple-province-summary]");
  const purposeTags = Array.from(filterRoot?.querySelectorAll("[data-popular-purpose-tag]") || []);
  const purposeSummary = filterRoot?.querySelector("[data-temple-purpose-summary]");
  const countNode = document.querySelector("[data-popular-temple-count]");
  const emptyNode = document.querySelector("[data-popular-temple-empty]");
  const loadMoreButton = document.querySelector("[data-popular-temple-more]");
  const placeholderSrc = grid.dataset.placeholderSrc;
  const initialCount = readPositiveInteger(grid.dataset.initialCount, 9);
  const batchSize = readPositiveInteger(grid.dataset.batchSize, initialCount);
  const useVisibleFilteredCount = grid.dataset.countMode === "visible-filtered";
  let originalCardOrder = new Map(cards.map((card, index) => [card, index]));
  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  let filteredCards = cards;
  let visibleCount = 0;
  const activeRegions = new Set();
  const activeProvinces = new Set();
  const appliedRegions = new Set();
  const appliedProvinces = new Set();
  const appliedPurposes = new Set();
  let activeNearby = false;
  let userLocation = null;
  let isRequestingLocation = false;
  let nearbyStatus = "";
  const activePurposes = new Set();
  let appliedQuery = "";
  let hasLoadedCollectionData = false;
  let collectionDataLoad = null;
  let compactView = null;
  let facetOptions = { provinces: new Set(), purposes: new Set() };
  let loadState = "idle";
  let filterNotice = "";
  let requestId = 0;
  let catalogRevision = 0;
  let lastDraftKey = "";

  if (!cards.length && !compact) return;

  if (compact) {
    compactView = initializePopularFilters(filterRoot, {
      read: () => ({
        draft: readDraft(),
        applied: { query: appliedQuery, regions: appliedRegions, provinces: appliedProvinces, purposes: appliedPurposes },
        catalog: readCatalog(), available: facetOptions, loadState,
        notice: filterNotice || nearbyStatus, nearby: activeNearby,
      }),
      setGroup: (group, values) => {
        if (group === "provinces") {
          for (const province of values) {
            if (activeProvinces.has(province)) continue;
            const region = cards.find(card => card.dataset.province === province)?.dataset.region;
            if (region) activeRegions.add(region);
          }
        }
        replaceSet(group === "provinces" ? activeProvinces : activePurposes, values);
        updateFacetOptions();
      },
      restore: () => {
        filterName.value = appliedQuery;
        replaceSet(activeRegions, appliedRegions);
        replaceSet(activeProvinces, appliedProvinces);
        replaceSet(activePurposes, appliedPurposes);
        updateFacetOptions();
      },
      retry: () => loadCollectionCards(),
    });
    filterName?.addEventListener("input", refreshCompactView);
  }

  initializeSmoothFilterAccordions(filterRoot);
  countNode?.setAttribute("role", "status");
  countNode?.setAttribute("aria-live", "polite");
  emptyNode?.setAttribute("role", "status");
  nearbyButton?.setAttribute("aria-pressed", "false");
  updateFacetOptions();
  applyInitialCollectionSearchParams();

  grid.addEventListener(
    "error",
    (event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement)) return;
      applyImageFallback(image);
    },
    true,
  );
  repairBrokenCardImages();
  window.addEventListener("load", repairBrokenCardImages, { once: true });
  document.addEventListener("mw:temple-overrides-applied", () => {
    repairBrokenCardImages();
    window.setTimeout(repairBrokenCardImages, 250);
  });

  cards.forEach((card) => {
    card.hidden = true;
  });

  applyPopularFilters();

  filterForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (compact) { await runCompactSearch(false); return; }
    await loadCollectionCards({ applyFilters: false });
    commitDraftFilters();
    applyPopularFilters();
    scrollToPopularResults();
  });

  document.addEventListener("mw:temple-overrides-applied", () => {
    cards = Array.from(grid.querySelectorAll("[data-popular-temple-card]"));
    catalogRevision++;
    updateFacetOptions();
    applyPopularFilters();
  });

  filterClear?.addEventListener("click", () => {
    if (compact) {
      compactView.cancel();
      requestId++;
      isRequestingLocation = false;
      nearbyStatus = "";
      filterNotice = "";
    }
    if (filterName) filterName.value = "";
    activeRegions.clear();
    activeProvinces.clear();
    appliedRegions.clear();
    appliedProvinces.clear();
    appliedPurposes.clear();
    appliedQuery = "";
    activeNearby = false;
    activePurposes.clear();
    clearCardDistances();
    updateNearbyButton();
    updateFacetOptions();
    applyPopularFilters();
  });

  regionTags.forEach((tag) => {
    tag.addEventListener("click", () => {
      const value = tag.value || "";
      const previousProvinceCount = activeProvinces.size;
      if (!value) {
        activeRegions.clear();
        activeProvinces.clear();
      } else if (activeRegions.has(value)) {
        activeRegions.delete(value);
      } else {
        activeRegions.add(value);
      }
      const allowedProvinces = new Set(
        cards.filter((card) => !activeRegions.size || activeRegions.has(card.dataset.region)).map((card) => card.dataset.province),
      );
      [...activeProvinces].forEach((province) => {
        if (!allowedProvinces.has(province)) activeProvinces.delete(province);
      });
      updateFacetOptions();
      if (compact && activeProvinces.size < previousProvinceCount) {
        filterNotice = "นำจังหวัดนอกภาคที่เลือกออกแล้ว · กดค้นหาเพื่อใช้เงื่อนไขใหม่";
        compactView.refresh();
      }
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
      updateFacetOptions();
    });
  });

  loadMoreButton?.addEventListener("click", async () => {
    await loadCollectionCards({ applyFilters: false });
    revealNext(batchSize);
  });

  nearbyButton?.addEventListener("click", async () => {
    if (compact) { await runCompactSearch(true); return; }
    if (isRequestingLocation) return;
    await loadCollectionCards({ applyFilters: false });

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
    commitDraftFilters();
    updateCardDistances();
    updateNearbyButton();
    applyPopularFilters();
    scrollToPopularResults();
  });

  updateLoadMoreButton();
  loadCollectionCards({ applyFilters: true });

  function readDraft() {
    return { query: filterName?.value || "", regions: new Set(activeRegions), provinces: new Set(activeProvinces), purposes: new Set(activePurposes) };
  }

  function readCatalog() {
    const purposes = uniqueSorted(cards.flatMap(card => splitDataTags(card.dataset.blessings)));
    const order = compact ? JSON.parse(filterRoot.dataset.purposeOrder || "[]") : [];
    return {
      provinces: uniqueSorted(cards.map(card => card.dataset.province)),
      purposes: [...order.filter(value => purposes.includes(value)), ...purposes.filter(value => !order.includes(value))],
    };
  }

  function refreshCompactView() {
    if (!compactView) return;
    const key = filterSnapshotKey(readDraft());
    if (lastDraftKey && lastDraftKey !== key) {
      requestId++;
      isRequestingLocation = false;
      filterNotice = "";
      nearbyStatus = "";
      updateNearbyButton();
    }
    lastDraftKey = key;
    compactView.refresh();
  }

  async function runCompactSearch(nearby) {
    compactView.cancel();
    const id = ++requestId;
    const snapshot = readDraft();
    const key = filterSnapshotKey(snapshot);
    const current = () => id === requestId && key === filterSnapshotKey(readDraft());
    filterNotice = "";
    nearbyStatus = "";
    isRequestingLocation = false;
    updateNearbyButton();
    const loaded = await loadCollectionCards({ applyFilters: false });
    if (!current() || !loaded) return;
    if (nearby && activeNearby) {
      activeNearby = false;
      clearCardDistances();
      updateNearbyButton();
      applyPopularFilters();
      return;
    }
    const catalog = readCatalog();
    if (["provinces", "purposes"].some(group => [...snapshot[group]].some(value => !catalog[group].includes(value)))) {
      filterNotice = "บางตัวเลือกไม่มีในข้อมูลล่าสุด กรุณาตรวจสอบตัวกรอง";
      refreshCompactView();
      return;
    }
    const revision = catalogRevision;
    const valid = () => current() && revision === catalogRevision;
    if (nearby && !activeNearby && !userLocation) {
      isRequestingLocation = true;
      updateNearbyButton();
      const location = await requestUserLocation(valid);
      if (!current()) return;
      isRequestingLocation = false;
      if (!valid()) {
        filterNotice = "ข้อมูลสถานที่เปลี่ยนแล้ว กรุณาค้นหาอีกครั้ง";
        updateNearbyButton(); refreshCompactView(); return;
      }
      if (!location) { updateNearbyButton(); refreshCompactView(); return; }
      userLocation = location;
    }
    if (nearby) activeNearby = !activeNearby;
    if (activeNearby) updateCardDistances(); else clearCardDistances();
    commitDraftFilters(snapshot);
    updateNearbyButton();
    applyPopularFilters();
    scrollToPopularResults();
  }

  function applyPopularFilters() {
    filteredCards = cards.filter((card) => {
      const matchesQuery = !appliedQuery || normalize(getCardSearchText(card)).includes(appliedQuery);
      const matchesRegion = !appliedRegions.size || appliedRegions.has(card.dataset.region);
      const matchesProvince = !appliedProvinces.size || appliedProvinces.has(card.dataset.province);
      const matchesPurpose = !appliedPurposes.size || splitDataTags(card.dataset.blessings).some((tag) => appliedPurposes.has(tag));
      return matchesQuery && matchesRegion && matchesProvince && matchesPurpose;
    });
    sortFilteredCards();
    visibleCount = Math.min(initialCount, filteredCards.length);
    renderVisibleCards({ animateAll: true });
    refreshCompactView();
    document.dispatchEvent(new CustomEvent("mw:filter-change", {
      detail: {
        scope: "temple_cards",
        region: appliedRegions.values().next().value || "all",
        province: appliedProvinces.values().next().value || "all",
        regions: [...appliedRegions],
        provinces: [...appliedProvinces],
        purposes: [...appliedPurposes],
        nearby: activeNearby,
        resultCount: filteredCards.length,
      },
    }));
  }

  function revealNext(count) {
    visibleCount = Math.min(filteredCards.length, visibleCount + count);
    renderVisibleCards({ animateAll: false });
  }

  function renderVisibleCards({ animateAll = false } = {}) {
    const previouslyVisible = new Set(cards.filter((card) => !card.hidden));

    filteredCards.forEach((card) => {
      grid.appendChild(card);
    });

    cards.forEach((card) => {
      card.hidden = true;
      card.classList.remove("is-reveal-ready", "is-revealed");
      card.style.removeProperty("--temple-card-reveal-delay");
    });

    const visibleCards = filteredCards.slice(0, visibleCount);
    const revealCards = [];

    visibleCards.forEach((card) => {
      card.hidden = false;
      if (animateAll || !previouslyVisible.has(card)) {
        revealCards.push(card);
      } else {
        card.classList.add("is-revealed");
      }
    });

    queueCardReveal(revealCards);

    if (countNode) {
      const shownCount = useVisibleFilteredCount ? visibleCards.length : filteredCards.length;
      const totalCount = useVisibleFilteredCount ? filteredCards.length : cards.length;
      countNode.textContent = `แสดง ${shownCount.toLocaleString("th-TH")} จาก ${totalCount.toLocaleString("th-TH")} พิกัด${activeNearby ? " · เรียงตามใกล้ฉัน" : ""}${nearbyStatus ? ` · ${nearbyStatus}` : ""}`;
    }

    if (emptyNode) {
      emptyNode.hidden = filteredCards.length > 0;
    }

    updateLoadMoreButton();
  }

  function queueCardReveal(revealCards) {
    if (!revealCards.length) return;

    if (prefersReducedMotion) {
      revealCards.forEach((card) => {
        card.classList.add("is-revealed");
      });
      return;
    }

    revealCards.forEach((card) => {
      card.classList.add("is-reveal-ready");
      card.classList.remove("is-revealed");
    });

    window.requestAnimationFrame(() => {
      assignRevealDelays(revealCards);
      window.requestAnimationFrame(() => {
        revealCards.forEach((card) => {
          card.classList.add("is-revealed");
        });
      });
    });
  }

  function assignRevealDelays(revealCards) {
    const sortedCards = [...revealCards].sort((a, b) => {
      const aRect = a.getBoundingClientRect();
      const bRect = b.getBoundingClientRect();
      if (Math.abs(aRect.top - bRect.top) > 8) return aRect.top - bRect.top;
      return aRect.left - bRect.left;
    });
    let rowTop = null;
    let rowIndex = -1;
    let columnIndex = 0;

    sortedCards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      if (rowTop === null || Math.abs(rect.top - rowTop) > 8) {
        rowTop = rect.top;
        rowIndex += 1;
        columnIndex = 0;
      }

      const delay = rowIndex * 120 + columnIndex * 24;
      card.style.setProperty("--temple-card-reveal-delay", `${delay}ms`);
      columnIndex += 1;
    });
  }

  function commitDraftFilters(snapshot = readDraft()) {
    appliedQuery = normalize(snapshot.query);
    replaceSet(appliedRegions, snapshot.regions);
    replaceSet(appliedProvinces, snapshot.provinces);
    replaceSet(appliedPurposes, snapshot.purposes);
  }

  function applyInitialCollectionSearchParams() {
    if (!filterName) return;

    const params = new URLSearchParams(window.location.search);
    const query = params.get("name") || params.get("q");
    if (!query) return;

    filterName.value = query;
    appliedQuery = normalize(query);
  }

  function replaceSet(target, source) {
    target.clear();
    source.forEach((value) => target.add(value));
  }

  function scrollToPopularResults() {
    grid.closest(".temples-section")?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function updateFacetOptions() {
    const availableRegions = new Set(
      cards
        .filter(
          (card) =>
            (!activeProvinces.size || activeProvinces.has(card.dataset.province)) &&
            matchesCardPurposes(card),
        )
        .map((card) => card.dataset.region),
    );
    const availableProvinces = new Set(
      cards
        .filter(
          (card) =>
            (!activeRegions.size || activeRegions.has(card.dataset.region)) &&
            matchesCardPurposes(card),
        )
        .map((card) => card.dataset.province),
    );
    const availablePurposes = new Set(
      cards
        .filter(
          (card) =>
            (!activeRegions.size || activeRegions.has(card.dataset.region)) &&
            (!activeProvinces.size || activeProvinces.has(card.dataset.province)),
        )
        .flatMap((card) => splitDataTags(card.dataset.blessings)),
    );

    updateRegionTags(availableRegions);
    updateProvinceTags(availableProvinces);
    updatePurposeTags(availablePurposes);
    facetOptions = { provinces: availableProvinces, purposes: availablePurposes };
    refreshCompactView();
  }

  function matchesCardPurposes(card) {
    return !activePurposes.size || splitDataTags(card.dataset.blessings).some((purpose) => activePurposes.has(purpose));
  }

  function updateRegionTags(availableRegions) {
    regionTags.forEach((tag) => {
      const value = tag.value || "";
      const isActive = value ? activeRegions.has(value) : activeRegions.size === 0;
      tag.classList.toggle("is-active", isActive);
      tag.setAttribute("aria-pressed", String(isActive));
      tag.hidden = Boolean(value) && !isActive && !availableRegions.has(value);
    });
  }

  function updateProvinceTags(availableProvinces) {
    if (!provinceFilter || !provinceTagsRoot) return;

    const provinces = uniqueSorted([...availableProvinces, ...activeProvinces]);

    provinceTagsRoot.innerHTML = "";

    const allButton = createFilterTag("ทั้งหมด", "", activeProvinces.size === 0);
    provinceTagsRoot.append(allButton, ...provinces.map((province) => createFilterTag(province, province, activeProvinces.has(province))));
    if (provinceSummary) {
      provinceSummary.textContent = activeProvinces.size
        ? `เลือกแล้ว ${activeProvinces.size.toLocaleString("th-TH")}`
        : "ทั้งหมด";
    }
  }

  function updatePurposeTags(availablePurposes) {
    purposeTags.forEach((tag) => {
      const value = tag.value || "";
      const isActive = value ? activePurposes.has(value) : activePurposes.size === 0;
      tag.classList.toggle("is-active", isActive);
      tag.setAttribute("aria-pressed", String(isActive));
      tag.hidden = Boolean(value) && !isActive && !availablePurposes.has(value);
    });
    if (purposeSummary) {
      purposeSummary.textContent = activePurposes.size
        ? `เลือกแล้ว ${activePurposes.size.toLocaleString("th-TH")}`
        : "ทั้งหมด";
    }
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
      if (!value) {
        activeProvinces.clear();
      } else if (activeProvinces.has(value)) {
        activeProvinces.delete(value);
      } else {
        activeProvinces.add(value);
        const matchingCard = cards.find((card) => card.dataset.province === value);
        if (matchingCard?.dataset.region) activeRegions.add(matchingCard.dataset.region);
      }
      updateFacetOptions();
    });
    return button;
  }

  function updateLoadMoreButton() {
    if (!loadMoreButton) return;
    loadMoreButton.hidden = visibleCount >= filteredCards.length;
  }

  async function loadCollectionCards({ applyFilters = true } = {}) {
    if (hasLoadedCollectionData) return true;
    const dataSrc = grid.dataset.collectionDataSrc;
    if (!dataSrc) return false;

    if (!collectionDataLoad) {
      loadState = "loading";
      refreshCompactView();
      collectionDataLoad = fetch(`${dataSrc}${dataSrc.includes("?") ? "&" : "?"}ts=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      }).then((response) => {
        if (!response.ok) throw new Error(`Collection data failed: ${response.status}`);
        return response.json();
      });
    }

    try {
      const payload = await collectionDataLoad;
      if (compact && !Array.isArray(payload?.items)) throw new Error("Invalid collection payload");
      if (!compact || !hasLoadedCollectionData) {
        hydrateCollectionCards(Array.isArray(payload?.items) ? payload.items : []);
        hasLoadedCollectionData = true;
        catalogRevision++;
        window.MongkolWelaCMS?.applyTempleOverrides?.();
      }
      loadState = "ready";
      if (activeNearby) updateCardDistances();
      updateFacetOptions();
      if (applyFilters || compact) applyPopularFilters();
      else renderVisibleCards();
      return true;
    } catch (error) {
      console.warn("โหลดข้อมูลพิกัดเพิ่มเติมไม่สำเร็จ", error);
      collectionDataLoad = null;
      loadState = "error";
      refreshCompactView();
      return false;
    }
  }

  function hydrateCollectionCards(items) {
    if (!items.length) return;

    const existingKeys = new Set(cards.map((card) => card.dataset.cardKey || `${grid.dataset.collection}:${card.dataset.rank}`));
    const fragment = document.createDocumentFragment();

    items.forEach((item) => {
      const key = String(item.key || `${item.collection || grid.dataset.collection}:${item.rank || ""}`);
      if (!key || existingKeys.has(key)) return;
      const card = createPopularTempleCard(item);
      card.hidden = true;
      fragment.appendChild(card);
      existingKeys.add(key);
    });

    if (fragment.childNodes.length) grid.appendChild(fragment);
    cards = Array.from(grid.querySelectorAll("[data-popular-temple-card]"));
    filteredCards = cards;
    originalCardOrder = new Map(cards.map((card, index) => [card, index]));
    repairBrokenCardImages();
  }

  function createPopularTempleCard(item) {
    const hasTempleImage = Boolean(item.hasTempleImage) && item.imageUrl && item.imageUrl !== placeholderSrc;
    const imageUrl = hasTempleImage ? String(item.imageUrl) : placeholderSrc;
    const mobileSrc = String(item.imageMobileUrl || imageUrl);
    const confidence = item.confidence || { key: "check", label: "ควรตรวจสอบ" };
    const card = document.createElement("article");
    card.className = `popular-temple-card temple-collection-v2-card${hasTempleImage ? "" : " is-placeholder"}`;
    card.dataset.rank = String(item.rank || "");
    card.dataset.name = String(item.name || "");
    card.dataset.region = String(item.region || "");
    card.dataset.province = String(item.province || "");
    card.dataset.district = String(item.district || "");
    card.dataset.blessings = String(item.blessings || "");
    card.dataset.placeType = String(item.placeType || "");
    card.dataset.searchText = String(item.searchText || "");
    card.dataset.latitude = String(item.latitude ?? "");
    card.dataset.longitude = String(item.longitude ?? "");
    card.dataset.cardKey = String(item.key || `${item.collection || grid.dataset.collection}:${item.rank || ""}`);
    card.setAttribute("data-popular-temple-card", "");
    if (!hasTempleImage) card.setAttribute("data-image-placeholder", "true");

    card.innerHTML = `
      <figure>
        <picture class="temple-responsive-picture">
          ${mobileSrc && mobileSrc !== imageUrl ? `<source media="(max-width: 767px)" srcset="${escapeHtml(mobileSrc)}" data-temple-mobile-source>` : ""}
          <img
            src="${escapeHtml(imageUrl)}"
            alt="${escapeHtml(item.imageAlt || `${item.name || ""} ${item.province || ""}`)}"
            loading="lazy"
            decoding="async"
            data-fallback-src="${escapeHtml(placeholderSrc || "")}"
            data-temple-desktop-image
          />
        </picture>
        <figcaption>${Number(item.rank || 0).toLocaleString("th-TH-u-nu-thai")}</figcaption>
        <span class="temple-collection-v2-confidence is-${escapeHtml(confidence.key || "check")}">
          <span aria-hidden="true"></span>
          ${escapeHtml(confidence.label || "ควรตรวจสอบ")}
        </span>
        <span class="popular-temple-distance" data-popular-temple-distance hidden></span>
      </figure>
      <div class="popular-temple-card-body">
        <span>${escapeHtml(item.province || "")}</span>
        <h3>${escapeHtml(item.name || "")}</h3>
        <p>${escapeHtml(`${item.province || ""}${item.district ? ` / ${item.district}` : ""}`)}</p>
        <strong>${escapeHtml(item.intent || item.placeType || "สิริมงคล")}</strong>
        <div class="temple-collection-v2-card-meta">
          <small>ข้อมูลชุดปัจจุบัน</small>
          <a href="#consult">แจ้งแก้ไขข้อมูล</a>
        </div>
        <div class="temple-collection-v2-card-actions">
          <a class="temple-collection-v2-card-plan" href="${escapeHtml(item.plannerUrl || "/temples/planner/")}">เพิ่มลงแผน</a>
          <a class="temple-collection-v2-card-detail" href="${escapeHtml(item.detailUrl || "#")}" data-popular-temple-detail>รายละเอียด</a>
        </div>
      </div>
    `;
    return card;
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
    const label = isRequestingLocation ? "กำลังหาตำแหน่ง..." : activeNearby ? "เรียงตามใกล้ฉัน" : nearbyStatus ? "ลองอีกครั้ง" : compact ? "ใกล้ตำแหน่งปัจจุบัน" : "พิกัดใกล้ฉัน";
    if (compact) nearbyButton.lastElementChild.textContent = label;
    else nearbyButton.textContent = label;
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

  async function requestUserLocation(isCurrent = () => true) {
    if (!("geolocation" in navigator)) {
      if (isCurrent()) nearbyStatus = "เบราว์เซอร์นี้ยังไม่รองรับการใช้ตำแหน่ง";
      return null;
    }

    try {
      const permissionState = await readGeolocationPermissionState();
      if (permissionState === "denied") {
        if (isCurrent()) nearbyStatus = "ต้องอนุญาตตำแหน่งในเบราว์เซอร์ก่อน";
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
      if (isCurrent()) nearbyStatus =
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

  function repairBrokenCardImages() {
    cards.forEach((card) => {
      const image = card.querySelector("img");
      if (!(image instanceof HTMLImageElement)) return;
      if (image.dataset.fallbackApplied === "true" || isFallbackImage(image)) {
        card.classList.add("is-placeholder");
      }
      if (image.complete && image.naturalWidth === 0) applyImageFallback(image);
    });
  }

  function applyImageFallback(image) {
    const fallbackSrc = image.dataset.fallbackSrc || placeholderSrc;
    if (!fallbackSrc || image.dataset.fallbackApplied === "true") return;

    image.dataset.fallbackApplied = "true";
    image.src = fallbackSrc;
    image.closest("[data-popular-temple-card]")?.classList.add("is-placeholder");
  }

  function isFallbackImage(image) {
    const fallbackSrc = image.dataset.fallbackSrc || placeholderSrc;
    if (!fallbackSrc) return false;
    const currentSrc = image.currentSrc || image.src || "";
    return currentSrc.endsWith(fallbackSrc) || currentSrc.includes(fallbackSrc);
  }
}

function splitDataTags(value) {
  return String(value || "")
    .split(";")
    .map((item) => item.trim())
    .filter((item) => item && item !== "0" && item.toLowerCase() !== "nan" && item.toLowerCase() !== "null");
}

function getCardSearchText(card) {
  return [
    card.dataset.searchText,
    card.dataset.name,
    card.dataset.region,
    card.dataset.province,
    card.dataset.district,
    card.dataset.blessings,
    card.dataset.placeType,
  ].filter(Boolean).join(" ");
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

async function fetchTempleThailandIndex() {
  const response = await fetch(`${thailandIndexUrl}?v=1`, {
    cache: "force-cache",
  });
  if (!response.ok) throw new Error(`Temple index failed: ${response.status}`);
  return response.json();
}

async function fetchTempleThailandData() {
  const response = await fetch(thailandDataUrl, {
    cache: "force-cache",
  });
  if (!response.ok) throw new Error(`Temple data failed: ${response.status}`);
  return response.json();
}

function getThailandColumns(payload) {
  return payload?.meta?.columns || payload?.columns || [];
}

function formatThailandSource(payload, t) {
  const sourceLabel = payload?.meta?.sourceLabel || "";
  return sourceLabel ? `แหล่งที่มา: ${sourceLabel}` : t.source;
}

function hasSearchParams() {
  return new URLSearchParams(window.location.search).size > 0;
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
  const loadAll = rootElement.querySelector("[data-temple-load-all]");
  const tableWrap = rootElement.querySelector(".temple-table-wrap");
  let searching = false;

  let rows = [];
  let headers = [];
  let indexPayload = null;
  let fullDataLoad = null;
  let hasFullData = false;
  let totalRows = 0;
  let filteredRows = [];
  let currentPage = 1;
  let isPreview = false;

  try {
    indexPayload = await fetchTempleThailandIndex();
    rows = Array.isArray(indexPayload.previewRows) ? indexPayload.previewRows : [];
    headers = getThailandColumns(indexPayload);
    totalRows = Number(indexPayload.meta?.rowCount) || rows.length;
    renderHead(tableHead, headers);
    populateStaticOptions(form, indexPayload, t);
    updateAreaOptions(form, indexPayload, t);
    updateSource(indexPayload);

    if (hasSearchParams()) {
      await ensureFullData();
      applySearchParams(form, rows, t);
      filteredRows = filterRows(form, rows);
    } else {
      filteredRows = rows;
      isPreview = true;
    }

    updateView();
  } catch (error) {
    try {
      await ensureFullData();
      renderHead(tableHead, headers);
      populateStaticOptions(form, rows, t);
      updateAreaOptions(form, rows, t);
      filteredRows = applySearchParams(form, rows, t) ? filterRows(form, rows) : rows;
      updateView();
      if (sourceNode) sourceNode.textContent = t.source;
    } catch (fullDataError) {
      console.error(error, fullDataError);
      countNode.textContent = t.loadError;
      showFailure();
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (searching) return;
    searching = true;
    form.querySelector('[type="submit"]').disabled = true;
    clearButton.disabled = true;
    loadAll.disabled = true;
    tableWrap.setAttribute("aria-busy", "true");
    try {
      await ensureFullData({ showLoading: true });
      currentPage = 1;
      isPreview = false;
      filteredRows = filterRows(form, rows);
      syncUrlFromForm(form);
      updateView();
    } catch (error) {
      console.error(error);
      showFailure();
    } finally {
      searching = false;
      form.querySelector('[type="submit"]').disabled = false;
      clearButton.disabled = false;
      loadAll.disabled = false;
      tableWrap.setAttribute("aria-busy", "false");
    }
  });

  loadAll.addEventListener("click", () => form.requestSubmit());
  tableBody.addEventListener("click", (event) => {
    if (event.target.closest("[data-temple-retry]")) { form.requestSubmit(); return; }
    const button = event.target.closest("[data-registry-row]");
    if (!button) return;
    const detail = document.getElementById(button.getAttribute("aria-controls"));
    const open = button.getAttribute("aria-expanded") !== "true";
    button.setAttribute("aria-expanded", String(open));
    detail.hidden = !open;
  });
  const sourceInfo = rootElement.querySelector(".registry-source-info");
  document.addEventListener("click", event => { if (!sourceInfo.contains(event.target)) sourceInfo.open = false; });
  sourceInfo.addEventListener("keydown", event => {
    if (event.key === "Escape") { sourceInfo.open = false; sourceInfo.querySelector("summary").focus(); }
  });

  bindAreaEvents(form, () => (hasFullData ? rows : indexPayload || rows), t);

  clearButton.addEventListener("click", () => {
    form.reset();
    currentPage = 1;
    isPreview = !hasFullData && Boolean(indexPayload);
    filteredRows = isPreview ? (indexPayload.previewRows || []) : rows;
    updateAreaOptions(form, hasFullData ? rows : indexPayload || rows, t);
    clearSearchUrl();
    updateView();
  });

  pagination.addEventListener("click", (event) => {
    const button = event.target.closest("[data-page]");
    if (!button) return;
    const page = Number(button.dataset.page);
    if (!Number.isFinite(page)) return;
    goToPage(page);
  });
  pagination.addEventListener("submit", event => {
    event.preventDefault();
    goToPage(Number(new FormData(event.target).get("page")));
  });
  window.matchMedia("(max-width: 720px)").addEventListener("change", () => {
    if (!searching && pagination.querySelector(".registry-page-controls")) {
      renderPagination(pagination, currentPage, Math.max(1, Math.ceil(filteredRows.length / pageSize)), t, filteredRows.length, isPreview);
    }
  });

  function goToPage(page) {
    if (searching || !Number.isInteger(page) || page < 1 || page > Math.ceil(filteredRows.length / pageSize)) return;
    currentPage = page;
    updateView();
    pagination.querySelector('[aria-current="page"]')?.focus({ preventScroll: true });
    rootElement.querySelector(".temple-results").scrollIntoView({ block: "start" });
  }

  function updateView() {
    const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
    currentPage = Math.min(currentPage, totalPages);
    countNode.textContent = isPreview ? t.previewCount(filteredRows.length, totalRows) : t.count(filteredRows.length, rows.length);
    renderRows(tableBody, filteredRows, currentPage, headers, t);
    renderPagination(pagination, currentPage, totalPages, t, filteredRows.length, isPreview);
    tableWrap.scrollTop = 0;
    loadAll.hidden = !isPreview;
    rootElement.querySelector("[data-temple-load-label]").textContent = `ค้นหาจากทะเบียนทั้งหมด ${totalRows.toLocaleString("th-TH")} วัด`;
  }

  function showFailure() {
    countNode.textContent = t.loadError;
    tableBody.innerHTML = `<tr><td class="temple-empty" colspan="${tableColumnCount}">${t.loadError}<br /><button class="temple-page-button registry-retry" type="button" data-temple-retry>ลองใหม่</button></td></tr>`;
    pagination.innerHTML = "";
    loadAll.hidden = true;
  }

  function updateSource(payload) {
    if (sourceNode) sourceNode.textContent = formatThailandSource(payload, t);
    const value = payload?.meta?.generatedAt;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? new Date(`${value}T12:00:00+07:00`) : null;
    const text = date && Number.isFinite(date.getTime()) ? `ชุดข้อมูล: ${new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" }).format(date)}` : "";
    rootElement.querySelectorAll("[data-temple-dataset-date]").forEach(node => { node.textContent = text; });
  }

  async function ensureFullData({ showLoading = false } = {}) {
    if (hasFullData) return;
    if (showLoading) {
      countNode.textContent = t.loadingFull;
      tableBody.innerHTML = `<tr><td class="temple-empty" colspan="${tableColumnCount}">${t.loadingFull}</td></tr>`;
    }

    if (!fullDataLoad) fullDataLoad = fetchTempleThailandData().catch(error => { fullDataLoad = null; throw error; });
    const data = await fullDataLoad;
    rows = data.rows || [];
    headers = getThailandColumns(data);
    totalRows = Number(data.meta?.rowCount) || rows.length;
    hasFullData = true;
    isPreview = false;
    renderHead(tableHead, headers);
    populateStaticOptions(form, rows, t);
    updateAreaOptions(form, rows, t);
    updateSource(data);
  }
}

async function initializeTempleQuickSearch(rootElement) {
  const t = labels;
  const form = rootElement.querySelector("[data-temple-form]");
  const clearButton = rootElement.querySelector("[data-temple-clear]");
  let optionSource = null;

  try {
    optionSource = await fetchTempleThailandIndex();
    populateStaticOptions(form, optionSource, t);
    updateAreaOptions(form, optionSource, t);
    applySearchParams(form, optionSource, t);
    bindAreaEvents(form, () => optionSource, t);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      redirectToDirectory(form);
    });

    clearButton.addEventListener("click", () => {
      form.reset();
      updateAreaOptions(form, optionSource, t);
    });
  } catch (error) {
    console.error(error);
    form.querySelectorAll("input, select, button").forEach((element) => {
      element.disabled = true;
    });
  }
}

function bindAreaEvents(form, source, t) {
  const getSource = typeof source === "function" ? source : () => source;

  form.querySelector("[data-temple-region]").addEventListener("change", () => {
    form.querySelector("[data-temple-province]").value = "";
    form.querySelector("[data-temple-district]").value = "";
    form.querySelector("[data-temple-subdistrict]").value = "";
    updateAreaOptions(form, getSource(), t);
  });

  form.querySelector("[data-temple-province]").addEventListener("change", () => {
    form.querySelector("[data-temple-district]").value = "";
    form.querySelector("[data-temple-subdistrict]").value = "";
    updateAreaOptions(form, getSource(), t);
  });

  form.querySelector("[data-temple-district]").addEventListener("change", () => {
    form.querySelector("[data-temple-subdistrict]").value = "";
    updateAreaOptions(form, getSource(), t);
  });
}

function renderHead(tableHead, headers) {
  tableHead.innerHTML = `
    <tr>
      ${summaryColumns.map((index) => `<th scope="col" class="${getColumnClass(index)}"${index === 0 ? ' aria-label="ลำดับ"' : ""}>${index === 0 ? "#" : escapeHtml(headers[index] || "")}</th>`).join("")}
      <th scope="col" class="registry-expand-cell"><span class="registry-sr-only">ข้อมูลวัด</span></th>
    </tr>
  `;
}

function renderRows(tableBody, rows, page, headers, t) {
  if (!rows.length) {
    tableBody.innerHTML = `<tr><td class="temple-empty" colspan="${tableColumnCount}">${t.noResults}</td></tr>`;
    return;
  }

  const start = (page - 1) * pageSize;
  const visibleRows = rows.slice(start, start + pageSize);
  tableBody.innerHTML = visibleRows.map((row, offset) => `
    <tr class="registry-summary-row">
      ${summaryColumns.map((index) => `
        <td class="${getColumnClass(index)}" data-label="${escapeHtml(headers[index] || "")}">
          ${escapeHtml(row[index] || "-")}
        </td>
      `).join("")}
      <td class="registry-expand-cell"><button class="registry-row-toggle" type="button" data-registry-row aria-expanded="false" aria-controls="registry-row-${start + offset}" aria-label="ข้อมูลวัด ${escapeHtml(row[2])}">${renderIcon("chevron-right", "registry-icon")}</button></td>
    </tr>
    <tr class="registry-detail-row" id="registry-row-${start + offset}" hidden><td colspan="${tableColumnCount}"><dl class="registry-row-details">${columnIndexes.filter(index => ![0, 2].includes(index)).map(index => `<div><dt>${escapeHtml(headers[index] || "")}</dt><dd>${escapeHtml(row[index] || "-")}</dd></div>`).join("")}</dl></td></tr>
  `).join("");
}

function renderPagination(pagination, page, totalPages, t, count, isPreview) {
  const candidates = new Set(window.matchMedia("(max-width: 720px)").matches
    ? [1, page, totalPages]
    : [1, totalPages, page - 2, page - 1, page, page + 1, page + 2]);
  const pages = [...candidates].filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b);
  const buttons = [];
  let previous = 0;

  for (const value of pages) {
    if (value - previous > 1) {
      buttons.push(`<span class="temple-page-status">...</span>`);
    }
    buttons.push(`<button class="temple-page-button ${value === page ? "is-active" : ""}" type="button" data-page="${value}" aria-label="หน้า ${value}" ${value === page ? 'aria-current="page"' : ""}>${value.toLocaleString("th-TH")}</button>`);
    previous = value;
  }

  pagination.innerHTML = `
    <p class="registry-page-summary">แสดง ${count ? (page - 1) * pageSize + 1 : 0}–${Math.min(page * pageSize, count).toLocaleString("th-TH")} จาก <strong>${count.toLocaleString("th-TH")}</strong> ${isPreview ? "รายการตัวอย่าง" : "รายการ"}</p>
    ${totalPages > 1 ? `<nav class="registry-page-controls" aria-label="หน้าผลการค้นหา"><button class="temple-page-button" type="button" data-page="${page - 1}" aria-label="${t.previous}" title="${t.previous}" ${page === 1 ? "disabled" : ""}>${renderIcon("chevron-left", "registry-icon")}</button>
    ${buttons.join("")}
    <button class="temple-page-button" type="button" data-page="${page + 1}" aria-label="${t.next}" title="${t.next}" ${page === totalPages ? "disabled" : ""}>${renderIcon("chevron-right", "registry-icon")}</button></nav>
    <form class="registry-page-jump"><label for="registry-page-number">ไปหน้าที่</label><input id="registry-page-number" name="page" type="number" inputmode="numeric" min="1" max="${totalPages}" value="${page}" required /><button class="temple-page-button" type="submit">ไป</button></form>` : ""}
  `;
}

function populateStaticOptions(form, source, t) {
  const facets = getThailandFacets(source);
  if (facets) {
    fillOptions(form.querySelector("[data-temple-type]"), facets.types || [], t.all);
    fillOptions(form.querySelector("[data-temple-sect]"), facets.sects || [], t.all);
    fillOptions(form.querySelector("[data-temple-region]"), getFacetRegions(facets), t.chooseRegion);
    return;
  }

  const rows = Array.isArray(source) ? source : [];
  fillOptions(form.querySelector("[data-temple-type]"), unique(rows, 3), t.all);
  fillOptions(form.querySelector("[data-temple-sect]"), unique(rows, 4), t.all);
  fillOptions(form.querySelector("[data-temple-region]"), getAvailableRegions(rows), t.chooseRegion);
}

function updateAreaOptions(form, source, t) {
  const facets = getThailandFacets(source);
  if (facets) {
    updateAreaOptionsFromFacets(form, facets, t);
    return;
  }

  const rows = Array.isArray(source) ? source : [];
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

function updateAreaOptionsFromFacets(form, facets, t) {
  const region = form.querySelector("[data-temple-region]").value;
  const provinceSelect = form.querySelector("[data-temple-province]");
  const province = provinceSelect.value;
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

  const regionFacet = getRegionFacet(facets, region);
  const provinceOptions = (regionFacet?.provinces || []).map((item) => item.name).filter(Boolean);
  provinceSelect.disabled = false;
  fillOptions(provinceSelect, provinceOptions, t.all, provinceOptions.includes(province) ? province : "");

  if (!provinceSelect.value) {
    fillOptions(districtSelect, [], t.chooseProvinceFirst, "");
    fillOptions(subdistrictSelect, [], t.chooseDistrictFirst, "");
    districtSelect.disabled = true;
    subdistrictSelect.disabled = true;
    return;
  }

  const provinceFacet = getProvinceFacet(facets, region, provinceSelect.value);
  const districtOptions = (provinceFacet?.districts || []).map((item) => item.name).filter(Boolean);
  districtSelect.disabled = false;
  fillOptions(districtSelect, districtOptions, t.all, districtOptions.includes(district) ? district : "");

  if (!districtSelect.value) {
    fillOptions(subdistrictSelect, [], t.chooseDistrictFirst, "");
    subdistrictSelect.disabled = true;
    return;
  }

  const districtFacet = getDistrictFacet(facets, region, provinceSelect.value, districtSelect.value);
  const previousSubdistrict = subdistrictSelect.value;
  const subdistrictOptions = districtFacet?.subdistricts || [];
  subdistrictSelect.disabled = false;
  fillOptions(
    subdistrictSelect,
    subdistrictOptions,
    t.all,
    subdistrictOptions.includes(previousSubdistrict) ? previousSubdistrict : "",
  );
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

function getThailandFacets(source) {
  return source && !Array.isArray(source) && source.facets ? source.facets : null;
}

function getFacetRegions(facets) {
  const availableRegions = new Set((facets.regions || []).map((item) => item.name).filter(Boolean));
  return regionOrder.filter((region) => availableRegions.has(region));
}

function getRegionFacet(facets, region) {
  return (facets.regions || []).find((item) => item.name === region);
}

function getProvinceFacet(facets, region, province) {
  return getRegionFacet(facets, region)?.provinces?.find((item) => item.name === province);
}

function getDistrictFacet(facets, region, province, district) {
  return getProvinceFacet(facets, region, province)?.districts?.find((item) => item.name === district);
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

function initializeSmoothFilterAccordions(scope = document) {
  const accordions = scope?.querySelectorAll?.(".temple-province-accordion, .temple-purpose-accordion") || [];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  accordions.forEach((details) => {
    if (details.dataset.smoothAccordion === "true") return;

    const summary = details.querySelector("summary");
    const content = summary?.nextElementSibling;
    if (!summary || !content) return;

    details.dataset.smoothAccordion = "true";

    if (reduceMotion || !details.animate) return;

    let animation = null;
    let closing = false;

    summary.addEventListener("click", (event) => {
      event.preventDefault();
      details.style.overflow = "hidden";

      if (closing || !details.open) {
        openDetails();
      } else {
        closeDetails();
      }
    });

    function openDetails() {
      details.style.height = `${details.offsetHeight}px`;
      details.open = true;
      window.requestAnimationFrame(() => {
        const startHeight = details.style.height;
        const endHeight = `${summary.offsetHeight + content.offsetHeight}px`;
        runAnimation(startHeight, endHeight, true);
      });
    }

    function closeDetails() {
      closing = true;
      runAnimation(`${details.offsetHeight}px`, `${summary.offsetHeight}px`, false);
    }

    function runAnimation(startHeight, endHeight, shouldOpen) {
      animation?.cancel();
      animation = details.animate(
        { height: [startHeight, endHeight] },
        { duration: 240, easing: "cubic-bezier(0.2, 0, 0.2, 1)" },
      );
      animation.onfinish = () => finishAnimation(shouldOpen);
      animation.oncancel = () => {
        closing = false;
      };
    }

    function finishAnimation(shouldOpen) {
      details.open = shouldOpen;
      animation = null;
      closing = false;
      details.style.height = "";
      details.style.overflow = "";
    }
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
