// Research notes belong to the editor, not the visitor content payload.
export function withoutHistoryResearch(content) {
  if (!content?.temples?.records) return content;
  return {
    ...content,
    temples: {
      ...content.temples,
      records: Object.fromEntries(Object.entries(content.temples.records).map(([key, record]) => {
        if (!record || typeof record !== "object") return [key, record];
        const { historyResearch, ...publicRecord } = record;
        return [key, publicRecord];
      })),
    },
  };
}

export function synchronizePlaceHistories(next, previous) {
  const content = structuredClone(next);
  const records = content.temples?.records || {};
  const groups = new Map();
  for (const [key, before] of Object.entries(previous.temples?.records || {})) {
    const identity = before?.historyResearch?.key;
    if (!identity) continue;
    if (!content.temples) content.temples = {};
    if (!content.temples.records) content.temples.records = records;
    // A pre-import draft has no record at all; omission must not erase live history.
    if (!records[key]) records[key] = structuredClone(before);
    // Keep the reviewed identity and evidence even when restoring an older draft.
    records[key].historyResearch = structuredClone(before.historyResearch);
    if (!groups.has(identity)) groups.set(identity, []);
    groups.get(identity).push(key);
  }
  for (const keys of groups.values()) {
    const changed = keys.filter(key => Object.hasOwn(records[key].fields || {}, "description")
      && records[key].fields.description !== previous.temples.records[key].fields?.description);
    const values = [...new Set(changed.map(key => records[key].fields.description))];
    if (values.length > 1) {
      throw Object.assign(new Error("ประวัติของสถานที่เดียวกันถูกแก้ไขต่างกันในหลายหมวด กรุณาตรวจให้ตรงกันก่อนเผยแพร่"), { statusCode: 400 });
    }
    if (values.length === 1) for (const key of keys) {
      records[key].fields = { ...records[key].fields, description: values[0] };
    }
    else for (const key of keys) {
      if (!Object.hasOwn(records[key].fields || {}, "description")) {
        records[key].fields = { ...records[key].fields, description: previous.temples.records[key].fields?.description ?? "" };
      }
    }
  }
  return content;
}
