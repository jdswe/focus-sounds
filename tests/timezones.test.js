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

test("a UTC−3 23:59 deadline is 03:59 the next day in Madrid and the day shift is reported", () => {
  const result = tz.convert("2026-11-20", "23:59", "Etc/GMT+3", "Europe/Madrid");
  assert.equal(result.date, "2026-11-21");
  assert.equal(result.time, "03:59");
  assert.equal(result.dayShift, 1);
});

test("same zone is a no-op and missing times are not converted", () => {
  assert.equal(tz.convert("2026-11-20", "08:00", "America/La_Paz", "America/La_Paz").time, "08:00");
  assert.equal(tz.convert("2026-11-20", "", "America/La_Paz", "UTC"), null);
});

test("handles a DST zone as target", () => {
  // São Paulo has no DST since 2019; New York does: 18:00 La Paz in July = 18:00 New York (both UTC−4).
  assert.equal(tz.convert("2026-07-15", "18:00", "America/La_Paz", "America/New_York").time, "18:00");
  assert.equal(tz.convert("2026-01-15", "18:00", "America/La_Paz", "America/New_York").time, "17:00");
});

test("validates zone names", () => {
  assert.equal(tz.isValidTimeZone("America/La_Paz"), true);
  assert.equal(tz.isValidTimeZone("Mars/Olympus"), false);
});
