const test = require("node:test");
const assert = require("node:assert/strict");
const tz = require("../js/domain/timezones.js");

test("Bolivia is UTC−4 and Etc/GMT+3 is a fixed UTC−3", () => {
  const instant = Date.UTC(2026, 9, 20, 12);
  assert.equal(tz.offsetMinutes(instant, "America/La_Paz"), -240);
  assert.equal(tz.offsetMinutes(instant, "Etc/GMT+3"), -180);
  assert.equal(tz.offsetLabel("America/La_Paz", instant), "UTC−4");
});

test("a Bolivian 23:59 deadline is 22:59 the same day in Bogotá", () => {
  assert.deepEqual(
    (({ date, time, dayShift }) => ({ date, time, dayShift }))(tz.convert("2026-11-20", "23:59", "America/La_Paz", "America/Bogota")),
    { date: "2026-11-20", time: "22:59", dayShift: 0 }
  );
});

test("a Bogotá 22:30 deadline is 00:30 the next day in São Paulo and the day shift is reported", () => {
  const result = tz.convert("2026-11-20", "22:30", "America/Bogota", "America/Sao_Paulo");
  assert.equal(result.date, "2026-11-21");
  assert.equal(result.time, "00:30");
  assert.equal(result.dayShift, 1);
});

test("a UTC−3 00:30 deadline is the previous evening in Mexico City", () => {
  const result = tz.convert("2026-11-20", "00:30", "Etc/GMT+3", "America/Mexico_City");
  assert.equal(result.date, "2026-11-19");
  assert.equal(result.time, "21:30");
  assert.equal(result.dayShift, -1);
});

test("same zone is a no-op and missing times are not converted", () => {
  assert.equal(tz.convert("2026-11-20", "08:00", "America/La_Paz", "America/La_Paz").time, "08:00");
  assert.equal(tz.convert("2026-11-20", "", "America/La_Paz", "America/Bogota"), null);
});

test("Buenos Aires and São Paulo are one hour ahead of Bolivia all year", () => {
  assert.equal(tz.convert("2026-07-15", "18:00", "America/La_Paz", "America/Argentina/Buenos_Aires").time, "19:00");
  assert.equal(tz.convert("2026-01-15", "18:00", "America/La_Paz", "America/Sao_Paulo").time, "19:00");
});

test("only the five supported countries (plus fixed UTC−3) are offered", () => {
  assert.deepEqual(tz.PRESETS.map((zone) => zone.id), [
    "America/La_Paz", "Etc/GMT+3", "America/Argentina/Buenos_Aires", "America/Sao_Paulo", "America/Bogota", "America/Mexico_City"
  ]);
});

test("validates zone names", () => {
  assert.equal(tz.isValidTimeZone("America/La_Paz"), true);
  assert.equal(tz.isValidTimeZone("Mars/Olympus"), false);
});
