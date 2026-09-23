import test from "node:test";
import assert from "node:assert/strict";
import { createLocalSeamsiSource, createSeamsiSession } from "../../src/lib/seamsi-session.js";

const intent = { topicId: "work", topicLabel: "การงาน", question: "คำถามสำหรับทดสอบ" };
const selected = { recordId: "007", slipNumber: "๐๗" };
const reading = { ...selected, title: "ข้อมูลทดสอบ", verse: "บรรทัดแรก\nบรรทัดถัดมา", generalReading: "ข้อมูลทดสอบ ไม่ใช่คำทำนายจริง" };
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; let reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; };
function fixture(overrides = {}) {
  let selections = 0;
  let reads = 0;
  const source = { status: () => "ready", select: () => { selections++; return selected; }, read: id => { reads++; assert.equal(id, selected.recordId); return reading; }, ...overrides };
  const changes = [];
  const session = createSeamsiSession({ source, initialIntent: intent, onChange: state => changes.push(state) });
  return { session, changes, count: () => ({ selections, reads }) };
}

test("one accepted draw selects once and commits an immutable matching snapshot once", async () => {
  const { session, changes, count } = fixture();
  const submitted = { ...intent };
  assert.equal(session.begin(submitted), true);
  const id = session.getState().active.id;
  for (let i = 0; i < 20; i++) assert.equal(session.begin(intent), false);
  submitted.question = "changed outside session";
  assert.equal(session.changeIntent({ ...intent, question: "changed while busy" }), false);
  await tick();
  assert.equal(session.getState().lastResult, null);
  session.finishVisual(id);
  session.finishVisual(id);
  assert.deepEqual(count(), { selections: 1, reads: 1 });
  const result = session.getState().lastResult;
  assert.equal(result.intent.question, intent.question);
  assert.equal(result.reading.slipNumber, "๐๗");
  assert.equal(result.reading.verse, reading.verse);
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.intent) && Object.isFrozen(result.reading));
  assert.equal(changes.filter(state => state.phase === "revealed").length, 1);
  assert.equal(session.begin(intent), false);
});

test("skip before selection or reading completes waits for the same operation", async () => {
  const selection = deferred();
  const content = deferred();
  let count = 0;
  const { session } = fixture({ select: () => { count++; return selection.promise; }, read: () => content.promise });
  session.begin(intent);
  const id = session.getState().active.id;
  session.finishVisual(id);
  assert.equal(session.getState().phase, "awaiting-content");
  selection.resolve(selected);
  await tick();
  assert.equal(session.getState().lastResult, null);
  content.resolve(reading);
  await tick();
  assert.equal(session.getState().phase, "revealed");
  assert.equal(count, 1);
  session.finishVisual(id);
  assert.equal(count, 1);
});

test("new question clears only the draft question and keeps the previous reading", async () => {
  const { session, count } = fixture();
  session.begin(intent, { visualFinished: true });
  await tick();
  const first = session.getState().lastResult;
  assert.equal(session.prepareQuestion(), true);
  assert.equal(session.getState().draft.question, "");
  assert.equal(session.getState().draft.topicId, intent.topicId);
  assert.equal(session.getState().lastResult, first);
  assert.equal(session.getState().previous, true);
  session.changeIntent({ ...intent, question: "draft to preserve" });
  assert.equal(session.prepareQuestion(), false);
  assert.equal(session.getState().draft.question, "draft to preserve");
  assert.deepEqual(count(), { selections: 1, reads: 1 });
});

test("draft edits never relabel the committed intent, returning to that intent restores revealed", async () => {
  const { session, count } = fixture();
  session.begin(intent, { visualFinished: true });
  await tick();
  session.changeIntent({ topicId: "love", topicLabel: "ความรัก", question: "new question" });
  assert.equal(session.getState().phase, "ready");
  assert.equal(session.getState().dirty, true);
  assert.equal(session.getState().lastResult.intent.topicId, "work");
  session.changeIntent(intent);
  assert.equal(session.getState().phase, "revealed");
  assert.equal(session.getState().dirty, false);
  assert.deepEqual(count(), { selections: 1, reads: 1 });
});

test("known record recovery reads the same identity and original intent without another draw", async () => {
  let readCount = 0;
  const { session, count } = fixture({ read: id => { assert.equal(id, selected.recordId); if (++readCount === 1) throw new Error("unavailable"); return reading; } });
  session.begin(intent, { visualFinished: true });
  await tick();
  assert.equal(session.getState().phase, "error");
  assert.equal(session.getState().canRetry, true);
  session.changeIntent({ ...intent, question: "a newer unsent question" });
  assert.equal(session.retry(), true);
  assert.equal(session.retry(), false);
  await tick();
  assert.equal(session.getState().lastResult.intent.question, intent.question);
  assert.equal(session.getState().draft.question, "a newer unsent question");
  assert.equal(session.getState().previous, true);
  assert.equal(session.getState().phase, "ready");
  assert.equal(count().selections, 1);
  assert.equal(readCount, 2);
});

test("missing content or mismatched identity cannot commit and leaves a previous result intact", async () => {
  let result = reading;
  const { session } = fixture({ read: () => result });
  session.begin(intent, { visualFinished: true });
  await tick();
  const first = session.getState().lastResult;
  session.prepareQuestion();
  result = { ...reading, recordId: "wrong-record" };
  session.begin(intent, { visualFinished: true });
  await tick();
  assert.equal(session.getState().error, "reading");
  assert.equal(session.getState().lastResult, first);
  result = { ...reading, verse: "" };
  session.retry();
  await tick();
  assert.equal(session.getState().lastResult, first);
  assert.equal(session.getState().error, "reading");
});

test("selection failure does not invent an outcome or silently retry", async () => {
  let count = 0;
  const { session } = fixture({ select: () => { count++; throw new Error("failed"); } });
  session.begin(intent);
  await tick();
  assert.equal(session.getState().error, "selection");
  assert.equal(session.getState().canRetry, false);
  assert.equal(session.getState().lastResult, null);
  assert.equal(session.retry(), false);
  assert.equal(count, 1);
});

test("disposed sessions ignore a late retry and all old visual callbacks", async () => {
  let calls = 0;
  const pending = deferred();
  const { session, changes } = fixture({ read: () => { if (++calls === 1) throw new Error("failed"); return pending.promise; } });
  session.begin(intent, { visualFinished: true });
  await tick();
  session.retry();
  const id = session.getState().active.id;
  session.dispose();
  const before = changes.length;
  pending.resolve(reading);
  session.finishVisual(id);
  await tick();
  assert.equal(changes.length, before);
  assert.equal(session.getState().lastResult, null);
  assert.equal(session.begin(intent), false);
});

test("unavailable corpus and invalid form states never draw", () => {
  for (const status of ["empty", "error"]) {
    const { session, count } = fixture({ status: () => status });
    assert.equal(session.getState().phase, "unavailable");
    assert.equal(session.begin(intent), false);
    assert.equal(count().selections, 0);
  }
  const { session, count } = fixture();
  session.invalidate();
  assert.equal(session.getState().phase, "invalid");
  assert.equal(count().selections, 0);
});

test("local adapter preserves slip formatting, corpus integrity and optional content", () => {
  const options = { randomIndex: () => 0, readLastNumber: () => null, writeLastNumber: () => {} };
  const record = { number: "๐๗", verse: "one\ntwo", interpretation: "fixture" };
  const source = createLocalSeamsiSource([record], options);
  assert.equal(source.status(), "ready");
  assert.deepEqual(source.select(), { recordId: "๐๗", slipNumber: "๐๗" });
  assert.equal(source.read("๐๗").verse, "one\ntwo");
  assert.equal(source.read("๐๗").advice, undefined);
  assert.equal(createLocalSeamsiSource([], options).status(), "empty");
  assert.equal(createLocalSeamsiSource([record, record], options).status(), "error");
  assert.equal(createLocalSeamsiSource([{ number: null }], options).status(), "error");
  assert.throws(() => createLocalSeamsiSource([{ number: 1 }], options).read("1"));
});

test("the existing no-repeat policy stores only the number and survives storage denial", () => {
  const records = [1, 2].map(number => ({ number, verse: "fixture", interpretation: "fixture" }));
  const saved = [];
  const source = createLocalSeamsiSource(records, { randomIndex: () => 0, readLastNumber: () => { throw new Error("denied"); }, writeLastNumber: value => { saved.push(value); throw new Error("denied"); } });
  assert.equal(source.select().slipNumber, "1");
  assert.equal(source.select().slipNumber, "2");
  assert.deepEqual(saved, ["1", "2"]);
});
