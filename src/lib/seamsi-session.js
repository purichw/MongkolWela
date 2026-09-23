const textPresent = value => typeof value === "string" && value.trim().length > 0;
const validNumber = value => textPresent(value) || (typeof value === "number" && Number.isFinite(value));
const snapshot = intent => Object.freeze({ topicId: intent.topicId, topicLabel: intent.topicLabel, question: intent.question.trim() });
const sameIntent = (a, b) => a.topicId === b.topicId && a.question === b.question;

export function createLocalSeamsiSource(records, { randomIndex, readLastNumber, writeLastNumber }) {
  let previousNumber;
  const status = () => {
    if (!Array.isArray(records)) return "error";
    if (!records.length) return "empty";
    const ids = records.map(record => validNumber(record?.number) ? String(record.number) : null);
    return ids.includes(null) || new Set(ids).size !== ids.length ? "error" : "ready";
  };
  return {
    status,
    select() {
      if (status() !== "ready") throw new Error("Corpus unavailable");
      try { previousNumber = readLastNumber() || previousNumber; } catch { /* History is optional. */ }
      // Preserve the existing no-consecutive-repeat rule within this single corpus.
      const eligible = records.filter(record => String(record.number) !== String(previousNumber));
      const pool = eligible.length ? eligible : records;
      const record = pool[randomIndex(pool.length)];
      if (!record) throw new Error("Selection unavailable");
      previousNumber = String(record.number);
      try { writeLastNumber(previousNumber); } catch { /* Keep this visit's last number in memory. */ }
      return Object.freeze({ recordId: String(record.number), slipNumber: String(record.number) });
    },
    read(recordId) {
      const record = records.find(item => String(item.number) === recordId);
      if (!record || !textPresent(record.verse) || !textPresent(record.interpretation)) throw new Error("Reading unavailable");
      const reading = { recordId, slipNumber: String(record.number), verse: record.verse, generalReading: record.interpretation };
      for (const key of ["title", "tone", "advice", "caution", "blessing"]) {
        if (textPresent(record[key])) reading[key] = record[key];
      }
      return Object.freeze(reading);
    },
  };
}

// Draw identity and committed content outlive animation, draft edits and retries.
export function createSeamsiSession({ source, initialIntent, onChange = () => {} }) {
  let draft = snapshot(initialIntent);
  let phase = "ready";
  let active = null;
  let lastResult = null;
  let recoverable = null;
  let error = null;
  let armed = false;
  let sequence = 0;
  let disposed = false;
  let corpusStatus;
  try { corpusStatus = source.status(); } catch { corpusStatus = "error"; }
  if (corpusStatus !== "ready") phase = "unavailable";

  const state = () => Object.freeze({
    phase, corpusStatus, draft, lastResult, error,
    canRetry: Boolean(recoverable && !active),
    previous: Boolean(lastResult && (phase !== "revealed" || !sameIntent(draft, lastResult.intent))),
    dirty: Boolean(lastResult && !sameIntent(draft, lastResult.intent)),
    active: active ? Object.freeze({ id: active.id, kind: active.kind, intent: active.intent, selection: active.selection, visualFinished: active.visualFinished }) : null,
  });
  const emit = () => { if (!disposed) onChange(state()); };
  const current = operation => !disposed && active === operation;

  function commit(operation) {
    if (!current(operation) || !operation.reading || !operation.visualFinished) return;
    lastResult = Object.freeze({ operationId: operation.id, intent: operation.intent, reading: operation.reading });
    active = null;
    recoverable = null;
    error = null;
    armed = false;
    phase = sameIntent(draft, lastResult.intent) ? "revealed" : "ready";
    emit();
  }

  function fail(operation) {
    if (!current(operation)) return;
    recoverable = operation.selection ? Object.freeze({ selection: operation.selection, intent: operation.intent }) : null;
    error = operation.selection ? "reading" : "selection";
    active = null;
    phase = "error";
    emit();
  }

  async function read(operation) {
    try {
      const reading = await source.read(operation.selection.recordId);
      if (!current(operation)) return;
      if (!reading || reading.recordId !== operation.selection.recordId || reading.slipNumber !== operation.selection.slipNumber
        || !textPresent(reading.verse) || !textPresent(reading.generalReading)) throw new Error("Invalid reading identity or content");
      operation.reading = Object.freeze({ ...reading });
      commit(operation);
    } catch { fail(operation); }
  }

  async function select(operation) {
    try {
      const selected = await source.select();
      if (!current(operation)) return;
      if (!textPresent(selected?.recordId) || !textPresent(selected?.slipNumber)) throw new Error("Invalid selection identity");
      operation.selection = Object.freeze({ ...selected });
      emit();
      await read(operation);
    } catch { fail(operation); }
  }

  return {
    getState: state,
    changeIntent(intent) {
      if (disposed || active) return false;
      draft = snapshot(intent);
      if (!["error", "unavailable"].includes(phase)) phase = lastResult && !armed && sameIntent(draft, lastResult.intent) ? "revealed" : "ready";
      emit();
      return true;
    },
    invalidate() {
      if (disposed || active || phase === "unavailable") return;
      phase = "invalid";
      emit();
    },
    prepareQuestion() {
      if (disposed || active || phase !== "revealed") return false;
      draft = snapshot({ ...draft, question: "" });
      armed = true;
      phase = "ready";
      emit();
      return true;
    },
    begin(intent, { visualFinished = false } = {}) {
      if (disposed || active || corpusStatus !== "ready" || phase === "revealed") return false;
      draft = snapshot(intent);
      const operation = { id: ++sequence, kind: "draw", intent: draft, selection: null, reading: null, visualFinished };
      active = operation;
      recoverable = null;
      error = null;
      phase = visualFinished ? "awaiting-content" : "drawing";
      emit();
      void select(operation);
      return true;
    },
    finishVisual(id) {
      if (disposed || !active || active.id !== id || active.visualFinished) return;
      active.visualFinished = true;
      if (active.reading) commit(active);
      else { phase = "awaiting-content"; emit(); }
    },
    retry() {
      if (disposed || active || !recoverable) return false;
      const operation = { id: ++sequence, kind: "retry", intent: recoverable.intent, selection: recoverable.selection, reading: null, visualFinished: true };
      active = operation;
      error = null;
      phase = "awaiting-content";
      emit();
      void read(operation);
      return true;
    },
    dispose() { disposed = true; active = null; recoverable = null; },
  };
}
