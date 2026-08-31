const DEFAULT_VISIT_MINUTES = 45;
const MAX_PLAN_COUNT = 9;

function normalize(value) {
  return String(value || "").normalize("NFC").trim().toLocaleLowerCase("th");
}

function getThailandNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(new Date())
    .reduce((values, part) => {
      if (part.type !== "literal") values[part.type] = part.value;
      return values;
    }, {});

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

function normalizeLocation(location) {
  if (!location) return null;
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    id: String(location.id || "current-location"),
    name: String(location.name || "ตำแหน่งปัจจุบัน"),
    latitude,
    longitude,
  };
}

export function sanitizePlannerCriteria(criteria = {}) {
  const now = getThailandNow();
  return {
    count: Math.min(Math.max(Number(criteria.count || MAX_PLAN_COUNT), 1), MAX_PLAN_COUNT),
    budget: String(criteria.budget || "300"),
    startDate: String(criteria.startDate || now.date),
    startTime: String(criteria.startTime || "09:00"),
    radius: String(criteria.radius ?? "100"),
    query: String(criteria.query || ""),
    start: String(criteria.start || ""),
    regions: Array.isArray(criteria.regions) ? criteria.regions.map(String).filter(Boolean).sort() : [],
    provinces: Array.isArray(criteria.provinces) ? criteria.provinces.map(String).filter(Boolean).sort() : [],
    purposes: Array.isArray(criteria.purposes) ? criteria.purposes.map(String).filter(Boolean).sort() : [],
    nearbyMode: Boolean(criteria.nearbyMode),
    currentLocation: normalizeLocation(criteria.currentLocation),
  };
}

function itemById(items) {
  return new Map(items.map((item) => [item.id, item]));
}

function matchesSearch(item, query) {
  if (!query) return true;
  return normalize(`${item.name} ${item.region} ${item.province} ${item.district} ${item.blessings.join(" ")} ${item.objectHero.join(" ")}`).includes(query);
}

function getCriteriaRadiusKm(criteria) {
  const radius = criteria?.radius ?? "100";
  if (radius === "") return Number.POSITIVE_INFINITY;
  const radiusKm = Number(radius);
  return Number.isFinite(radiusKm) && radiusKm > 0 ? radiusKm : 100;
}

function getItemsByCriteria(items, criteria) {
  const query = normalize(criteria.query);
  if (criteria.nearbyMode && criteria.currentLocation) {
    const radiusKm = getCriteriaRadiusKm(criteria);
    return items
      .filter((item) => {
        if (Number.isFinite(radiusKm) && haversineKm(criteria.currentLocation, item) > radiusKm) return false;
        return matchesSearch(item, query);
      })
      .sort((left, right) => haversineKm(criteria.currentLocation, left) - haversineKm(criteria.currentLocation, right));
  }

  const regions = new Set(criteria.regions || []);
  const provinces = new Set(criteria.provinces || []);
  const purposes = new Set(criteria.purposes || []);
  return items.filter((item) => {
    if (regions.size && !regions.has(item.region)) return false;
    if (provinces.size && !provinces.has(item.province)) return false;
    if (purposes.size && !item.blessings.some((purpose) => purposes.has(purpose))) return false;
    return matchesSearch(item, query);
  });
}

function getPinnedStartItem(itemsById, criteria) {
  return criteria.start ? itemsById.get(criteria.start) || null : null;
}

function getStartPoint(itemsById, criteria) {
  return criteria.currentLocation || getPinnedStartItem(itemsById, criteria);
}

function getPrimaryPurpose(criteria) {
  return criteria.purposes?.[0] || "";
}

function pickFirstCandidate(candidates, anchor, purpose) {
  if (anchor) {
    return [...candidates].sort((left, right) => haversineKm(anchor, left) - haversineKm(anchor, right))[0];
  }
  return [...candidates].sort((left, right) => {
    const purposeDifference = Number(right.blessings.includes(purpose)) - Number(left.blessings.includes(purpose));
    return purposeDifference || left.globalRank - right.globalRank || right.globalMentions - left.globalMentions;
  })[0];
}

function automaticCandidateScore(current, item, purpose) {
  const leg = current ? estimateLeg(current, item) : { midpointMinutes: 0, directKm: 0 };
  const distancePenalty = leg.midpointMinutes > 180 ? 10000 : leg.midpointMinutes > 90 ? 900 : leg.midpointMinutes;
  const purposeBonus = purpose && item.blessings.includes(purpose) ? -45 : 0;
  const rankPenalty = Math.min(item.globalRank, 200) * 0.45;
  return distancePenalty + rankPenalty + purposeBonus + leg.directKm * 0.2;
}

function optimizeOrder(items, anchor) {
  const remaining = [...items];
  const ordered = [];
  let current = anchor;

  if (!current && remaining.length) {
    remaining.sort((left, right) => left.globalRank - right.globalRank);
    current = remaining.shift();
    ordered.push(current);
  }

  while (remaining.length) {
    const nextIndex = remaining
      .map((item, index) => ({ index, distance: haversineKm(current, item) }))
      .sort((left, right) => left.distance - right.distance)[0].index;
    const [next] = remaining.splice(nextIndex, 1);
    ordered.push(next);
    current = next;
  }
  return ordered;
}

function createAutomaticPlan(items, criteria) {
  const itemsById = itemById(items);
  const candidates = getItemsByCriteria(items, criteria);
  const pinnedStart = getPinnedStartItem(itemsById, criteria);
  const target = criteria.count || MAX_PLAN_COUNT;
  const selectedIds = new Set();
  const anchor = getStartPoint(itemsById, criteria);
  const chosen = [];

  if (!candidates.length && !pinnedStart) {
    return { error: "ไม่พบสถานที่ตามเงื่อนไขที่เลือก" };
  }

  if (pinnedStart) {
    chosen.push(pinnedStart);
    selectedIds.add(pinnedStart.id);
  } else {
    const first = pickFirstCandidate(candidates, anchor, getPrimaryPurpose(criteria));
    if (first) {
      chosen.push(first);
      selectedIds.add(first.id);
    }
  }

  while (chosen.length < target) {
    const current = chosen.at(-1) || anchor;
    const next = candidates
      .filter((item) => !selectedIds.has(item.id))
      .map((item) => ({ item, score: automaticCandidateScore(current, item, getPrimaryPurpose(criteria)) }))
      .sort((left, right) => left.score - right.score)[0]?.item;
    if (!next) break;
    chosen.push(next);
    selectedIds.add(next.id);
  }

  return { plan: optimizeOrder(chosen, anchor) };
}

function createManualPlan(items, criteria, selectedIds = [], manualSelectionOrder = false) {
  const itemsById = itemById(items);
  const pinnedStart = getPinnedStartItem(itemsById, criteria);
  const ids = Array.isArray(selectedIds) ? selectedIds.map(String).filter((id) => itemsById.has(id)) : [];
  const uniqueIds = Array.from(new Set(pinnedStart ? [pinnedStart.id, ...ids.filter((id) => id !== pinnedStart.id)] : ids)).slice(0, criteria.count);
  const selectedItems = uniqueIds.map((id) => itemsById.get(id)).filter(Boolean);

  if (!selectedItems.length) return createAutomaticPlan(items, criteria);

  return {
    plan: manualSelectionOrder ? selectedItems : optimizeOrder(selectedItems, getStartPoint(itemsById, criteria)),
  };
}

export function createTemplePlannerPlan(payload, request = {}) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const criteria = sanitizePlannerCriteria(request.criteria);
  const mode = request.mode === "manual" ? "manual" : "auto";
  const result = mode === "manual"
    ? createManualPlan(items, criteria, request.selectedIds, Boolean(request.manualSelectionOrder))
    : createAutomaticPlan(items, criteria);

  if (result.error) {
    return { ok: false, error: result.error };
  }

  const plan = Array.isArray(result.plan) ? result.plan.filter(Boolean).slice(0, criteria.count) : [];
  if (!plan.length) {
    return { ok: false, error: "ไม่สามารถจัดแผนจากเงื่อนไขที่เลือกได้" };
  }

  const planCriteria = { ...criteria, source: mode };
  return {
    ok: true,
    mode,
    selectedIds: plan.map((item) => item.id),
    planIds: plan.map((item) => item.id),
    criteria: planCriteria,
    details: calculatePlan(plan, items, planCriteria),
  };
}

function calculatePlan(plan, items, criteria) {
  const itemsById = itemById(items);
  const startPoint = getStartPoint(itemsById, criteria);
  const startMinutes = parseTime(criteria.startTime || "09:00");
  const legs = [];
  let cursor = startMinutes;
  let previous = startPoint;
  let totalTravel = 0;
  let totalVisit = 0;

  const stops = plan.map((item, index) => {
    const before = previous && previous.id !== item.id ? estimateLeg(previous, item) : null;
    if (before) {
      cursor += before.midpointMinutes;
      totalTravel += before.midpointMinutes;
      legs.push({ fromId: previous.id || "origin", toId: item.id, ...before });
    }
    const arrival = cursor;
    const visitMinutes = Number(item.visitMinutes || DEFAULT_VISIT_MINUTES);
    cursor += visitMinutes;
    totalVisit += visitMinutes;
    const nextItem = plan[index + 1];
    const nextLeg = nextItem ? estimateLeg(item, nextItem) : null;
    previous = item;
    return { itemId: item.id, arrival, departure: cursor, visitMinutes, before, nextLeg };
  });

  const totalMinutes = totalTravel + totalVisit;
  const totalRoadKm = legs.reduce((sum, leg) => sum + leg.roadKm, 0);
  const warnings = buildWarnings(legs, totalTravel, totalMinutes, Number(criteria.budget || 300), plan.length);

  return { startMinutes, endMinutes: cursor, stops, legs, totalTravel, totalVisit, totalMinutes, totalRoadKm, warnings };
}

function buildWarnings(legs, totalTravel, totalMinutes, budget, stopCount) {
  const warnings = [];
  const longLegs = legs.filter((leg) => leg.midpointMinutes > 90);
  const veryLongLegs = legs.filter((leg) => leg.midpointMinutes > 180);
  if (veryLongLegs.length) warnings.push(`มี ${veryLongLegs.length.toLocaleString("th-TH")} ช่วงที่ใช้เวลาเกิน 3 ชั่วโมง เหมาะกับการแยกวันมากกว่า`);
  else if (longLegs.length) warnings.push(`มี ${longLegs.length.toLocaleString("th-TH")} ช่วงที่ใช้เวลาเกิน 1 ชั่วโมง 30 นาที`);
  if (totalTravel > 240) warnings.push("เวลาเดินทางรวมเกิน 4 ชั่วโมง ควรลดจำนวนสถานที่หรือจำกัดพื้นที่ให้แคบลง");
  if (totalMinutes > budget) warnings.push(`แผนยาวกว่าเวลาที่เลือกประมาณ ${formatMinutes(totalMinutes - budget)}`);
  if (stopCount < 3) warnings.push("จำนวนสถานที่น้อยกว่า 3 แห่ง ลองขยายพื้นที่หรือลดตัวกรอง");
  return warnings;
}

function estimateLeg(from, to) {
  const directKm = haversineKm(from, to);
  const sameProvince = from.province && to.province && from.province === to.province;
  const sameDistrict = sameProvince && from.district && to.district && from.district === to.district;
  const isBangkok = from.province === "กรุงเทพมหานคร" || to.province === "กรุงเทพมหานคร";
  const roadFactor = sameDistrict ? 1.32 : sameProvince ? 1.24 : 1.14;
  const roadKm = directKm * roadFactor;
  let speed = 62;
  if (isBangkok && directKm < 35) speed = 20;
  else if (directKm < 8) speed = 24;
  else if (sameProvince && directKm < 45) speed = 38;
  else if (directKm < 80) speed = 48;
  const accessMinutes = directKm < 20 ? 10 : directKm < 100 ? 15 : 25;
  const midpointMinutes = Math.max(10, Math.round(((roadKm / speed) * 60 + accessMinutes) / 5) * 5);
  const uncertainty = directKm < 10 ? 10 : directKm < 50 ? 20 : directKm < 150 ? 30 : 50;
  return {
    directKm,
    roadKm,
    midpointMinutes,
    lowMinutes: Math.max(10, midpointMinutes - Math.round(uncertainty * 0.45)),
    highMinutes: midpointMinutes + uncertainty,
    lowKm: roadKm * 0.9,
    highKm: roadKm * 1.12,
  };
}

function haversineKm(left, right) {
  if (!left || !right) return Number.POSITIVE_INFINITY;
  const earthRadius = 6371;
  const latitudeDistance = toRadians(Number(right.latitude) - Number(left.latitude));
  const longitudeDistance = toRadians(Number(right.longitude) - Number(left.longitude));
  const leftLatitude = toRadians(Number(left.latitude));
  const rightLatitude = toRadians(Number(right.latitude));
  const value =
    Math.sin(latitudeDistance / 2) ** 2 +
    Math.cos(leftLatitude) * Math.cos(rightLatitude) * Math.sin(longitudeDistance / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function toRadians(degrees) {
  return (Number(degrees) * Math.PI) / 180;
}

function parseTime(value) {
  const [hours, minutes] = String(value).split(":").map(Number);
  return (Number.isFinite(hours) ? hours : 8) * 60 + (Number.isFinite(minutes) ? minutes : 0);
}

function formatMinutes(minutes) {
  const rounded = Math.max(0, Math.round(minutes / 5) * 5);
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  if (!hours) return `${remainder.toLocaleString("th-TH")} นาที`;
  if (!remainder) return `${hours.toLocaleString("th-TH")} ชม.`;
  return `${hours.toLocaleString("th-TH")} ชม. ${remainder.toLocaleString("th-TH")} นาที`;
}
