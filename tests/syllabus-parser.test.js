const test = require("node:test");
const assert = require("node:assert/strict");
const p = require("../js/domain/syllabus-parser.js");

const REF = new Date(2026, 7, 1).getTime(); // semester starts 1 Aug 2026

test("extracts assignments and exams with dates, weights and page references", () => {
  const result = p.parseSyllabus([
    { page: 1, text: "Asignatura: Cálculo Diferencial\nProfesor: Ana Gómez\nLunes 8:00 - 10:00\nMiércoles 8:00-10:00" },
    { page: 2, text: "Evaluación\n- Parcial 1 (25%): 15/09/2026\n- Taller 2 — entrega 3 de octubre\n- Proyecto final 30% 2026-11-20\nThe homework policy is explained in class and late work loses points." }
  ], { referenceDate: REF });
  assert.equal(result.subjectName.value, "Cálculo Diferencial");
  assert.equal(result.instructor.value, "Ana Gómez");
  assert.equal(result.schedules.length, 2);
  assert.deepEqual(result.schedules[0], { day: 1, start: "08:00", end: "10:00", page: 1, snippet: "Lunes 8:00 - 10:00" });
  assert.equal(result.items.length, 3);
  const [exam, workshop, project] = result.items;
  assert.equal(exam.kind, "exam");
  assert.equal(exam.dueDate, "2026-09-15");
  assert.equal(exam.weight, 25);
  assert.equal(exam.page, 2);
  assert.equal(exam.title, "Parcial 1");
  assert.equal(exam.confidence, "high");
  assert.equal(workshop.kind, "assignment");
  assert.equal(workshop.dueDate, "2026-10-03");
  assert.equal(workshop.flags.inferredYear, true);
  assert.equal(workshop.confidence, "medium");
  assert.equal(project.kind, "project");
  assert.equal(project.dueDate, "2026-11-20");
  assert.equal(project.weight, 30);
});

test("flags ambiguous numeric dates and offers both readings", () => {
  const { items } = p.parseSyllabus([{ page: 1, text: "Quiz 1 on 03/04/2027" }], { referenceDate: REF, dayFirst: true });
  assert.equal(items[0].flags.ambiguousDate, true);
  assert.deepEqual(items[0].dateOptions, ["2027-04-03", "2027-03-04"]);
});

test("reads English month-first dates and times", () => {
  const { items } = p.parseSyllabus([{ page: 3, text: "Midterm exam: October 14, 2026 at 2:30 pm" }], { referenceDate: REF, dayFirst: false });
  assert.equal(items[0].dueDate, "2026-10-14");
  assert.equal(items[0].dueTime, "14:30");
});

test("reads Portuguese dates", () => {
  const { items } = p.parseSyllabus([{ page: 1, text: "Trabalho em grupo – 12 de novembro de 2026 (20%)" }], { referenceDate: REF });
  assert.equal(items[0].kind, "assignment");
  assert.equal(items[0].dueDate, "2026-11-12");
  assert.equal(items[0].weight, 20);
});

test("keeps weighted activities without a date but flags the missing date", () => {
  const { items } = p.parseSyllabus([{ page: 1, text: "Exposición final 15%" }], { referenceDate: REF });
  assert.equal(items.length, 1);
  assert.equal(items[0].flags.missingDate, true);
  assert.equal(items[0].confidence, "low");
});

test("drops a trailing 'entrega' (due) before the date from titles", () => {
  const { items } = p.parseSyllabus([{ page: 1, text: "Taller 2 entrega 3 de noviembre de 2026" }], { referenceDate: REF });
  assert.equal(items[0].title, "Taller 2");
});

test("does not invent items from ordinary prose or schedules", () => {
  const { items } = p.parseSyllabus([{ page: 1, text: "Office hours on Tuesday.\nWelcome to the course!\nRead chapter 2 before class." }], { referenceDate: REF });
  assert.equal(items.length, 0);
});

test("does not read 'set 5' as September in English text", () => {
  assert.equal(p.findDates("Homework set 5 problems", { referenceDate: REF }).length, 0);
});

test("detects duplicates against existing tasks", () => {
  const { items } = p.parseSyllabus([{ page: 1, text: "Parcial 1 (25%): 15/09/2026" }], { referenceDate: REF });
  const dupes = p.findDuplicates(items, [{ id: "task1", title: "parcial 1", dueDate: "2026-09-15", subjectId: "s" }], "s");
  assert.equal(dupes[items[0].id], "task1");
});

test("removes repeated lines within the same document", () => {
  const { items } = p.parseSyllabus([{ page: 1, text: "Quiz 1 15/09/2026" }, { page: 4, text: "Quiz 1 15/09/2026" }], { referenceDate: REF });
  assert.equal(items.length, 1);
});

test("fingerprints identical text identically", () => {
  assert.equal(p.fingerprintText("abc"), p.fingerprintText("abc"));
  assert.notEqual(p.fingerprintText("abc"), p.fingerprintText("abd"));
});
