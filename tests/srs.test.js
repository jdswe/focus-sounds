const test = require("node:test");
const assert = require("node:assert/strict");
const srs = require("../js/domain/srs.js");

const DAY = 86400000;
const NOW = new Date(2026, 9, 20).getTime();

test("good reviews grow the interval 1 → 6 → 15 days", () => {
  let s = srs.review(null, "good", NOW);
  assert.equal(s.interval, 1);
  s = srs.review(s, "good", NOW + DAY);
  assert.equal(s.interval, 6);
  s = srs.review(s, "good", NOW + 7 * DAY);
  assert.equal(s.interval, 15);
  assert.equal(s.due, NOW + 7 * DAY + 15 * DAY);
});

test("forgetting resets repetitions, counts a lapse and lowers ease", () => {
  let s = srs.review(null, "good", NOW);
  s = srs.review(s, "good", NOW);
  const failed = srs.review(s, "again", NOW);
  assert.equal(failed.reps, 0);
  assert.equal(failed.lapses, 1);
  assert.ok(failed.ease < s.ease);
  assert.equal(failed.due, NOW + 10 * 60 * 1000);
});

test("ease never drops below 1.3", () => {
  let s = null;
  for (let i = 0; i < 20; i++) s = srs.review(s, "again", NOW);
  assert.equal(s.ease, 1.3);
});

test("unknown grades are rejected", () => {
  assert.throws(() => srs.review(null, "perfect", NOW));
});

test("due cards exclude drafts and future cards", () => {
  const cards = [
    { id: "a", srs: { due: NOW - 1 } },
    { id: "b", srs: { due: NOW + DAY } },
    { id: "c", draft: true },
    { id: "d" }
  ];
  assert.deepEqual(srs.dueCards(cards, NOW).map((c) => c.id), ["d", "a"]);
});

test("drafts cards from Q/A pairs and term–definition lines", () => {
  const drafts = srs.draftsFromText("Q: What is a derivative?\nA: The instantaneous rate of change.\nLimit — value a function approaches\nrandom sentence without pair");
  assert.deepEqual(drafts, [
    { front: "What is a derivative?", back: "The instantaneous rate of change." },
    { front: "Limit", back: "value a function approaches" }
  ]);
});

test("duplicate detection ignores accents and case within the same subject", () => {
  const cards = [{ id: "1", subjectId: "s", front: "¿Qué es una derivada?" }];
  assert.equal(srs.isDuplicate(cards, "que es una DERIVADA", "s"), true);
  assert.equal(srs.isDuplicate(cards, "que es una derivada", "other"), false);
  assert.equal(srs.isDuplicate(cards, "que es una derivada", "s", "1"), false);
});
