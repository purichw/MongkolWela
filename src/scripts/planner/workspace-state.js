// Draft edits never mutate the committed route or its record/time snapshot.
export const copy = value => structuredClone(value);
export const sameIds = (left, right) => JSON.stringify(left) === JSON.stringify(right);

export function criteriaKey(criteria) {
  const { source, ...values } = criteria;
  const sort = value => value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sort(value[key])])) : value;
  return JSON.stringify(sort(values));
}

export function draftKey(state, criteria) {
  return JSON.stringify([criteriaKey(criteria), state.selected, state.manualSelectionOrder, state.originText || ""]);
}

export function observeDraft(state, criteria) {
  const key = draftKey(state, criteria);
  if (state.draftKey !== key) {
    state.draftVersion += 1;
    state.draftKey = key;
    state.replacement = null;
  }
  return state.draftVersion;
}

export function freshness(state, criteria) {
  if (!state.committed) return "empty";
  if (state.committed.revision !== state.revision) return "catalog-stale";
  return criteriaKey(state.committed.criteria) !== criteriaKey(criteria)
    || !sameIds(state.selected, state.committed.planIds)
    || state.originResolution === "unmatched" || state.originResolution === "ambiguous"
    ? "draft-changed" : "synced";
}

export function responseIsCurrent(state, submitted) {
  return state.requestToken === submitted.token
    && state.draftVersion === submitted.version
    && state.revision === submitted.revision;
}

export function validatePlan(payload, submitted, catalog) {
  const ids = payload.planIds;
  const stops = payload.details?.stops;
  if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length
    || ids.length > submitted.criteria.count || !ids.every(id => catalog.has(id))
    || !Array.isArray(stops) || !sameIds(ids, stops.map(stop => stop.itemId))) {
    throw new Error("ข้อมูลลำดับและเวลาไม่ครบถ้วน กรุณาจัดแผนอีกครั้ง");
  }
  if (submitted.mode === "manual" && !sameIds([...ids].sort(), [...submitted.selectedIds].sort())) {
    throw new Error("แผนที่ได้รับมีรายการไม่ตรงกับที่เลือก โปรดทบทวนรายการและจัดใหม่");
  }
  if (submitted.manualSelectionOrder && !sameIds(ids, submitted.selectedIds)) {
    throw new Error("ลำดับที่ได้รับไม่ตรงกับที่กำหนด กรุณาจัดแผนอีกครั้ง");
  }
  const details = payload.details;
  const numbers = ["startMinutes", "endMinutes", "totalTravel", "totalVisit", "totalMinutes", "totalRoadKm"];
  if (numbers.some(key => !Number.isFinite(details[key]) || details[key] < 0)
    || details.totalTravel + details.totalVisit !== details.totalMinutes
    || details.startMinutes + details.totalMinutes !== details.endMinutes
    || stops.some(stop => !Number.isFinite(stop.arrival) || !Number.isFinite(stop.departure)
      || stop.departure - stop.arrival !== stop.visitMinutes)) {
    throw new Error("ข้อมูลเวลาของแผนไม่สมบูรณ์ กรุณาจัดใหม่");
  }
  if (payload.revision && payload.revision !== submitted.revision) {
    throw new Error("ข้อมูลสถานที่เปลี่ยนระหว่างจัดแผน โปรดทบทวนอีกครั้ง");
  }
  return copy({ ...payload, revision: submitted.revision,
    items: ids.map(id => payload.items?.find(item => item.id === id) || catalog.get(id)),
    criteria: submitted.criteria, generatedAt: new Date().toISOString() });
}

export function stageReplacement(state, oldId, candidateId) {
  const replacement = state.replacement;
  if (!replacement || replacement.oldId !== oldId || replacement.version !== state.draftVersion
    || replacement.revision !== state.revision || state.selected[replacement.slot] !== oldId
    || state.selected.includes(candidateId) || !state.itemById.has(candidateId)) return false;
  const ids = [...state.selected];
  ids[replacement.slot] = candidateId;
  state.selected = ids;
  state.manualSelectionOrder = true;
  state.replacement = null;
  return true;
}
