const test = require("node:test");
const assert = require("node:assert/strict");
const store = require("../js/core/store.js");
const companions = require("../js/domain/companions.js");
const insights = require("../js/domain/insights.js");

function memoryStorage() {
  const data = new Map();
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), data };
}

test("migrate fills missing collections and keeps existing data", () => {
  const migrated = store.migrate({ schemaVersion: 0, tasks: [{ id: "t" }], preferences: { locale: "es" } });
  assert.equal(migrated.schemaVersion, store.SCHEMA_VERSION);
  assert.deepEqual(migrated.tasks, [{ id: "t" }]);
  assert.equal(migrated.preferences.locale, "es");
  assert.equal(migrated.preferences.focusMinutes, 25);
  store.COLLECTIONS.forEach((name) => assert.ok(Array.isArray(migrated[name])));
});

test("new installs default to English", () => {
  assert.equal(store.createEmptyState().preferences.locale, "en");
});

test("refuses data from a newer schema instead of corrupting it", () => {
  assert.throws(() => store.migrate({ schemaVersion: 999 }));
});

test("store persists updates and survives a reload", () => {
  const storage = memoryStorage();
  const a = store.createStore({ storage });
  a.update((state) => { state.tasks.push({ id: "t1", title: "Essay" }); });
  const b = store.createStore({ storage });
  assert.equal(b.get().tasks[0].title, "Essay");
});

test("a failing mutator does not change state", () => {
  const s = store.createStore({ storage: memoryStorage() });
  assert.throws(() => s.update((state) => { state.tasks.push({ id: "x" }); throw new Error("boom"); }));
  assert.equal(s.get().tasks.length, 0);
});

test("export/import round-trips data", () => {
  const s = store.createStore({ storage: memoryStorage() });
  s.update((state) => { state.notes.push({ id: "n1", body: "hello" }); });
  const t = store.createStore({ storage: memoryStorage() });
  t.importJson(s.exportJson());
  assert.equal(t.get().notes[0].body, "hello");
});

test("unique ids", () => {
  const ids = new Set(Array.from({ length: 1000 }, () => store.createId("x")));
  assert.equal(ids.size, 1000);
});

const lockedCounters = { focusSessions: 0, focusMinutes: 0, tasksCompleted: 0, cardsReviewed: 0, notesWritten: 0 };

test("species-specific items cannot be equipped on other species", () => {
  const result = companions.equip({}, "ruana", "macaw", lockedCounters);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "incompatible");
});

test("locked items cannot be equipped until progress unlocks them", () => {
  assert.equal(companions.equip({}, "aguadeno-hat", "capybara", lockedCounters).reason, "locked");
  const ok = companions.equip({}, "aguadeno-hat", "capybara", { ...lockedCounters, focusSessions: 3 });
  assert.equal(ok.ok, true);
  assert.equal(ok.equipped.head, "aguadeno-hat");
});

test("equipping an item replaces the item in the same slot only", () => {
  let eq = companions.equip({}, "round-glasses", "capybara", lockedCounters).equipped;
  eq = companions.equip(eq, "ruana", "capybara", lockedCounters).equipped;
  eq = companions.unequip(eq, "eyes");
  assert.deepEqual(eq, { body: "ruana" });
});

test("outfits equip only compatible, unlocked pieces", () => {
  const result = companions.equipOutfit({ eyes: "round-glasses" }, "coffee-region", "capybara", lockedCounters);
  assert.deepEqual(result.equipped, { eyes: "round-glasses", body: "ruana", hand: "coffee-cup" });
  assert.deepEqual(result.skipped, ["aguadeno-hat"]);
  const generic = companions.equipOutfit({}, "study-day", "llama", lockedCounters);
  assert.equal(generic.equipped.hand, undefined, "llamas have no hand slot");
});

test("companions come only from Colombia, Mexico, Argentina, Brazil and Bolivia", () => {
  assert.deepEqual(companions.SPECIES.map((species) => species.country).sort(), ["AR", "BO", "BR", "CO", "MX"]);
});

test("an unknown saved species falls back to the capybara", () => {
  assert.equal(companions.getSpecies("alpaca").id, "capybara");
});

test("every species has at least three cultural items and one default item", () => {
  companions.SPECIES.forEach((species) => {
    const own = companions.ITEMS.filter((item) => item.species.length === 1 && item.species[0] === species.id);
    assert.ok(own.length >= 3, `${species.id} has ${own.length}`);
    assert.ok(own.some((item) => !item.unlock), `${species.id} needs a starter item`);
  });
});

test("sanitize drops items that became invalid", () => {
  assert.deepEqual(companions.sanitizeEquipped({ head: "ruana", eyes: "round-glasses", hand: "ghost" }, "capybara", lockedCounters), { eyes: "round-glasses" });
});

test("newly unlocked lists only uncelebrated unlocks", () => {
  const counters = { ...lockedCounters, focusSessions: 1 };
  assert.deepEqual(companions.newlyUnlocked(counters, []), ["study-headphones"]);
  assert.deepEqual(companions.newlyUnlocked(counters, ["study-headphones"]), []);
});

test("companion state follows the timer", () => {
  const noon = new Date(2026, 9, 20, 12).getTime();
  assert.equal(companions.stateFor({ timerKind: "focus", timerRunning: true, now: noon }), "focus");
  assert.equal(companions.stateFor({ timerKind: "shortBreak", timerRunning: true, now: noon }), "break");
  assert.equal(companions.stateFor({ celebrating: true, now: noon }), "celebrate");
  assert.equal(companions.stateFor({ now: new Date(2026, 9, 20, 23, 30).getTime() }), "sleep");
});

const NOW = new Date(2026, 9, 20, 12).getTime();
const iso = (y, m, d, h, min) => new Date(y, m, d, h, min || 0).toISOString();

test("minutes by day split sessions crossing midnight", () => {
  const sessions = [{ kind: "focus", startedAt: iso(2026, 9, 19, 23, 30), activeSeconds: 3600, segments: [{ start: iso(2026, 9, 19, 23, 30), end: iso(2026, 9, 20, 0, 30) }] }];
  const days = insights.minutesByDay(sessions, NOW, 2);
  assert.deepEqual(days, [{ date: "2026-10-19", minutes: 30 }, { date: "2026-10-20", minutes: 30 }]);
});

test("recommendations explain why", () => {
  const recs = insights.recommend({ now: NOW, tasks: [
    { id: "a", title: "A", dueDate: "2026-10-21", priority: 3, status: "doing", estimateMinutes: 60 },
    { id: "b", title: "B", dueDate: "2026-12-30", priority: 1, status: "todo" },
    { id: "c", title: "C", dueDate: "2026-10-22", status: "done" }
  ] });
  assert.equal(recs[0].taskId, "a");
  assert.deepEqual(recs[0].reasons.map((r) => r.key), ["reason.dueSoon", "reason.highPriority", "reason.inProgress"]);
  assert.ok(!recs.some((r) => r.taskId === "c"));
});

test("progress counters ignore sub-minute sessions and breaks", () => {
  const state = store.createEmptyState();
  state.focusSessions = [
    { kind: "focus", status: "completed", activeSeconds: 1500 },
    { kind: "focus", status: "completed", activeSeconds: 20 },
    { kind: "shortBreak", status: "completed", activeSeconds: 300 }
  ];
  const counters = insights.progressCounters(state);
  assert.equal(counters.focusSessions, 1);
  assert.equal(counters.focusMinutes, 25);
});
