// Converts deadlines written in a document's time zone (e.g. a university in Bolivia) into
// the student's own time zone, using the IANA database built into Intl.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.StillApp = root.StillApp || {}).timezones = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
  "use strict";

  // "Etc/GMT+3" is IANA's (sign-inverted) name for a fixed UTC−3 offset.
  const PRESETS = [
    { id: "America/La_Paz", label: "Bolivia — La Paz (UTC−4)" },
    { id: "Etc/GMT+3", label: "UTC−3 (fixed)" },
    { id: "America/Argentina/Buenos_Aires", label: "Argentina — Buenos Aires (UTC−3)" },
    { id: "America/Sao_Paulo", label: "Brazil — São Paulo (UTC−3)" },
    { id: "America/Bogota", label: "Colombia — Bogotá (UTC−5)" },
    { id: "America/Mexico_City", label: "Mexico — Mexico City (UTC−6)" }
  ];

  function localTimeZone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
  }

  function isValidTimeZone(timeZone) {
    try { new Intl.DateTimeFormat("en", { timeZone }); return true; } catch { return false; }
  }

  // Wall-clock parts of an instant in a time zone.
  function partsIn(instant, timeZone) {
    const parts = {};
    new Intl.DateTimeFormat("en-US", {
      timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit"
    }).formatToParts(new Date(instant)).forEach((part) => { parts[part.type] = part.value; });
    return { year: +parts.year, month: +parts.month, day: +parts.day, hour: +parts.hour % 24, minute: +parts.minute, second: +parts.second };
  }

  function offsetMinutes(instant, timeZone) {
    const p = partsIn(instant, timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return Math.round((asUtc - Math.floor(instant / 1000) * 1000) / 60000);
  }

  // Instant for a wall-clock date/time in `timeZone` (two passes handle DST edges).
  function zonedToInstant(date, time, timeZone) {
    const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || "");
    const t = /^(\d{2}):(\d{2})$/.exec(time || "");
    if (!d || !t) return null;
    const wall = Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2]);
    let instant = wall - offsetMinutes(wall, timeZone) * 60000;
    instant = wall - offsetMinutes(instant, timeZone) * 60000;
    return instant;
  }

  const pad = (value) => String(value).padStart(2, "0");

  /** Converts {date, time} from one zone to another. Returns null when the time is missing. */
  function convert(date, time, fromZone, toZone) {
    const instant = zonedToInstant(date, time, fromZone);
    if (instant == null) return null;
    const p = partsIn(instant, toZone);
    return {
      date: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
      time: `${pad(p.hour)}:${pad(p.minute)}`,
      instant,
      dayShift: Math.round((Date.UTC(p.year, p.month - 1, p.day) - Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10))) / 86400000)
    };
  }

  function offsetLabel(timeZone, instant) {
    const minutes = offsetMinutes(instant ?? Date.now(), timeZone);
    const sign = minutes < 0 ? "−" : "+";
    const abs = Math.abs(minutes);
    return `UTC${sign}${Math.floor(abs / 60)}${abs % 60 ? `:${pad(abs % 60)}` : ""}`;
  }

  return { PRESETS, localTimeZone, isValidTimeZone, offsetMinutes, zonedToInstant, convert, offsetLabel };
});
