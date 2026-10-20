const test = require("node:test");
const assert = require("node:assert/strict");
const sch = require("../js/domain/scheduler.js");

// Tuesday 20 Oct 2026, 08:00 local time.
const NOW = new Date(2026, 9, 20, 8, 0).getTime();
const weekdayEvenings = [{ start: "18:00", end: "21:00" }];
const prefs = (overrides) => ({
  availability: { 0: [], 1: weekdayEvenings, 2: weekdayEvenings, 3: weekdayEvenings, 4: weekdayEvenings, 5: weekdayEvenings, 6: [] },
  maxSessionMinutes: 50,
  minSessionMinutes: 25,
  breakBetweenSessionsMinutes: 10,
  maxTaskMinutesPerDay: 120,
  planningHorizonDays: 14,
  ...overrides
});
const hourOf = (iso) => new Date(iso).getHours() + new Date(iso).getMinutes() / 60;
const overlaps = (a, b) => new Date(a.start) < new Date(b.end) && new Date(a.end) > new Date(b.start);

test("parses local dates without UTC shifting", () => {
  const time = sch.parseLocalDate("2026-10-23");
  assert.equal(new Date(time).getDate(), 23);
  assert.equal(sch.formatLocalDate(time), "2026-10-23");
});

test("splits a large task across several days before the deadline", () => {
  const plan = sch.generatePlan({ now: NOW, preferences: prefs(), tasks: [{ id: "t1", estimateMinutes: 300, dueDate: "2026-10-26", priority: 2, status: "todo" }] });
  const total = plan.sessions.reduce((sum, s) => sum + s.minutes, 0);
  assert.equal(total, 300);
  const days = new Set(plan.sessions.map((s) => new Date(s.start).getDate()));
  assert.ok(days.size >= 3, `expected 3+ days, got ${days.size}`);
  plan.sessions.forEach((s) => assert.ok(new Date(s.end).getTime() <= sch.parseLocalDate("2026-10-26")));
  assert.deepEqual(plan.conflicts, []);
});

test("never schedules over classes or fixed commitments", () => {
  const plan = sch.generatePlan({
    now: NOW,
    preferences: prefs(),
    weeklySchedule: [{ day: 2, start: "18:00", end: "19:30" }],
    fixedEvents: [{ start: new Date(2026, 9, 21, 18, 0).toISOString(), end: new Date(2026, 9, 21, 21, 0).toISOString() }],
    tasks: [{ id: "t1", estimateMinutes: 100, dueDate: "2026-10-23", status: "todo" }]
  });
  assert.ok(plan.sessions.length > 0);
  plan.sessions.forEach((s) => {
    const day = new Date(s.start).getDate();
    if (day === 20) assert.ok(hourOf(s.start) >= 19.5);
    assert.notEqual(day, 21);
  });
});

test("earliest deadline goes first", () => {
  const plan = sch.generatePlan({ now: NOW, preferences: prefs(), tasks: [
    { id: "late", estimateMinutes: 50, dueDate: "2026-10-30", status: "todo" },
    { id: "soon", estimateMinutes: 50, dueDate: "2026-10-22", status: "todo" }
  ] });
  assert.equal(plan.sessions[0].taskId, "soon");
});

test("reports a conflict when work cannot fit before the deadline", () => {
  const plan = sch.generatePlan({ now: NOW, preferences: prefs(), tasks: [{ id: "big", estimateMinutes: 600, dueDate: "2026-10-22", status: "todo" }] });
  assert.equal(plan.conflicts.length, 1);
  assert.equal(plan.conflicts[0].taskId, "big");
  assert.ok(plan.conflicts[0].unscheduledMinutes > 0);
});

test("subtracts tracked time and approved sessions from the remaining work", () => {
  const locked = [{ taskId: "t1", start: new Date(2026, 9, 20, 18, 0).toISOString(), end: new Date(2026, 9, 20, 18, 50).toISOString() }];
  const plan = sch.generatePlan({ now: NOW, preferences: prefs(), trackedMinutes: { t1: 30 }, lockedSessions: locked, tasks: [{ id: "t1", estimateMinutes: 130, dueDate: "2026-10-28", status: "todo" }] });
  assert.equal(plan.sessions.reduce((sum, s) => sum + s.minutes, 0), 50);
  plan.sessions.forEach((s) => assert.ok(!overlaps(s, locked[0])));
});

test("skips done, overdue and unestimated tasks with explicit reporting", () => {
  const plan = sch.generatePlan({ now: NOW, preferences: prefs(), tasks: [
    { id: "done", estimateMinutes: 60, dueDate: "2026-10-25", status: "done" },
    { id: "over", estimateMinutes: 60, dueDate: "2026-10-19", status: "todo" },
    { id: "noest", dueDate: "2026-10-25", status: "todo" }
  ] });
  assert.deepEqual(plan.sessions, []);
  assert.deepEqual(plan.overdue, ["over"]);
  assert.deepEqual(plan.unestimated, ["noest"]);
});

test("respects a due time on the due date", () => {
  const plan = sch.generatePlan({ now: NOW, preferences: prefs(), tasks: [{ id: "t", estimateMinutes: 50, dueDate: "2026-10-20", dueTime: "20:00", status: "todo" }] });
  assert.equal(plan.sessions.length, 1);
  assert.ok(new Date(plan.sessions[0].end).getTime() <= new Date(2026, 9, 20, 20, 0).getTime());
});

test("generated sessions never overlap each other", () => {
  const plan = sch.generatePlan({ now: NOW, preferences: prefs(), tasks: [
    { id: "a", estimateMinutes: 200, dueDate: "2026-10-27", status: "todo" },
    { id: "b", estimateMinutes: 200, dueDate: "2026-10-28", status: "todo" }
  ] });
  for (let i = 0; i < plan.sessions.length; i++) {
    for (let j = i + 1; j < plan.sessions.length; j++) assert.ok(!overlaps(plan.sessions[i], plan.sessions[j]));
  }
});

test("mergePlan keeps approved and past sessions and only replaces future suggestions", () => {
  let n = 0;
  const createId = () => `p${++n}`;
  const future = new Date(NOW + 86400000).toISOString();
  const existing = [
    { id: "a", taskId: "t1", start: future, end: future, status: "approved" },
    { id: "b", taskId: "t1", start: future, end: future, status: "suggested" },
    { id: "c", taskId: "t2", start: future, end: future, status: "suggested" },
    { id: "d", taskId: "t1", start: new Date(NOW - 86400000).toISOString(), end: future, status: "suggested" }
  ];
  const merged = sch.mergePlan(existing, [{ taskId: "t1", start: future, end: future, minutes: 50 }], { now: NOW, createId, taskIds: ["t1"] });
  assert.deepEqual(merged.map((s) => s.id).sort(), ["a", "c", "d", "p1"]);
});
