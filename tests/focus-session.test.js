const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("../js/domain/focus-session.js");

const MIN = 60 * 1000;
const T0 = new Date(2026, 9, 20, 9, 0).getTime();

test("active time is the sum of segments, excluding pauses", () => {
  let s = fs.start({ id: "a", plannedSeconds: 25 * 60, now: T0 });
  s = fs.pause(s, T0 + 10 * MIN);
  s = fs.resume(s, T0 + 15 * MIN);
  assert.equal(fs.activeMs(s, T0 + 20 * MIN), 15 * MIN);
  assert.equal(fs.remainingMs(s, T0 + 20 * MIN), 10 * MIN);
});

test("completion time accounts for paused time", () => {
  let s = fs.start({ id: "a", plannedSeconds: 25 * 60, now: T0 });
  s = fs.pause(s, T0 + 10 * MIN);
  s = fs.resume(s, T0 + 15 * MIN);
  assert.equal(fs.completionTime(s), T0 + 30 * MIN);
});

test("finish never counts beyond the planned duration", () => {
  const s = fs.start({ id: "a", plannedSeconds: 25 * 60, now: T0 });
  const done = fs.finish(s, T0 + 40 * MIN, "completed");
  assert.equal(done.activeSeconds, 25 * 60);
  assert.equal(done.endedAt, T0 + 25 * MIN);
});

test("free-focus sessions (no planned duration) count until finished", () => {
  const s = fs.start({ id: "a", plannedSeconds: null, now: T0 });
  const done = fs.finish(s, T0 + 42 * MIN, "finished");
  assert.equal(done.activeSeconds, 42 * 60);
  assert.equal(fs.remainingMs(s, T0), null);
});

test("recovery after the page was closed stops counting at the last heartbeat", () => {
  let s = fs.start({ id: "a", plannedSeconds: 50 * 60, now: T0 });
  s = fs.heartbeat(s, T0 + 12 * MIN);
  const { session, completed } = fs.recover(s, T0 + 3 * 60 * MIN);
  assert.equal(completed, false);
  assert.equal(session.status, "paused");
  assert.equal(session.recovered, true);
  assert.equal(fs.activeMs(session, T0 + 3 * 60 * MIN), 12 * MIN);
});

test("recovery completes a session whose time elapsed while the page was open", () => {
  let s = fs.start({ id: "a", plannedSeconds: 25 * 60, now: T0 });
  s = fs.heartbeat(s, T0 + 26 * MIN);
  const { session, completed } = fs.recover(s, T0 + 26.5 * MIN);
  assert.equal(completed, true);
  assert.equal(session.activeSeconds, 25 * 60);
  assert.equal(session.status, "completed");
});

test("a simple reload keeps a running session running", () => {
  let s = fs.start({ id: "a", plannedSeconds: 25 * 60, now: T0 });
  s = fs.heartbeat(s, T0 + 5 * MIN);
  const { session } = fs.recover(s, T0 + 5 * MIN + 20 * 1000);
  assert.equal(session.status, "running");
});

test("records are appended once even if finalization runs twice", () => {
  const history = [];
  const record = fs.toRecord(fs.finish(fs.start({ id: "dup", plannedSeconds: 60, now: T0 }), T0 + MIN, "completed"));
  assert.equal(fs.appendRecord(history, record), true);
  assert.equal(fs.appendRecord(history, { ...record }), false);
  assert.equal(history.length, 1);
  assert.equal(record.pauses, 0);
});

test("pomodoro sequencing inserts a long break every N focus sessions", () => {
  assert.equal(fs.nextPhase("focus", 1, 4), "shortBreak");
  assert.equal(fs.nextPhase("focus", 4, 4), "longBreak");
  assert.equal(fs.nextPhase("shortBreak", 4, 4), "focus");
});
