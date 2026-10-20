const test = require("node:test");
const assert = require("node:assert/strict");
const tasks = require("../js/domain/tasks.js");

let n = 0;
const createId = (prefix) => `${prefix}${++n}`;
const NOW = new Date(2026, 9, 20, 10).getTime();

test("moving to done sets completedAt once; leaving done clears it", () => {
  const task = tasks.createTask({ title: "Essay" }, NOW, createId);
  const done = tasks.moveTask(task, "done", NOW + 1000);
  assert.ok(done.completedAt);
  assert.equal(tasks.moveTask(done, "done", NOW + 5000), done);
  assert.equal(tasks.moveTask(done, "doing", NOW + 9000).completedAt, null);
});

test("ignores unknown statuses", () => {
  const task = tasks.createTask({ title: "x" }, NOW, createId);
  assert.equal(tasks.moveTask(task, "archived", NOW), task);
});

test("validates required fields and formats", () => {
  assert.deepEqual(tasks.validateTask({ title: "" }), ["titleRequired"]);
  assert.deepEqual(tasks.validateTask({ title: "ok", dueDate: "15/09" }), ["dateInvalid"]);
});

test("subject progress counts completed tasks, weights and tracked time without duplicates", () => {
  const list = [
    { id: "a", subjectId: "s", status: "done", weight: 25, estimateMinutes: 60 },
    { id: "b", subjectId: "s", status: "todo", weight: 30, estimateMinutes: 90 },
    { id: "c", subjectId: "other", status: "done" }
  ];
  const sessions = [
    { kind: "focus", taskId: "a", activeSeconds: 1500 },
    { kind: "focus", subjectId: "s", activeSeconds: 600 },
    { kind: "shortBreak", taskId: "a", activeSeconds: 300 }
  ];
  assert.deepEqual(tasks.subjectProgress("s", list, sessions), { total: 2, done: 1, percent: 50, weightTotal: 55, weightDone: 25, estimateMinutes: 150, trackedMinutes: 35 });
});

test("tracked minutes include only focus sessions", () => {
  assert.deepEqual(tasks.trackedMinutesByTask([{ kind: "focus", taskId: "a", activeSeconds: 600 }, { kind: "shortBreak", taskId: "a", activeSeconds: 300 }]), { a: 10 });
});

test("sorts by due date with undated tasks last", () => {
  const sorted = tasks.sortTasks([{ title: "c", priority: 2 }, { title: "a", dueDate: "2026-10-22", priority: 2 }, { title: "b", dueDate: "2026-10-21", priority: 1 }], "due");
  assert.deepEqual(sorted.map((t) => t.title), ["b", "a", "c"]);
});

test("contrast text picks a readable color", () => {
  assert.equal(tasks.contrastText("#FFFF00"), "#111111");
  assert.equal(tasks.contrastText("#3B6FB6"), "#ffffff");
});

test("assigns unused subject colors first", () => {
  assert.equal(tasks.nextSubjectColor([{ color: tasks.SUBJECT_COLORS[0] }]), tasks.SUBJECT_COLORS[1]);
});
