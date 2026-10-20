// Rule-based syllabus extraction. It only reports what is literally written in the document:
// every item keeps its page, line and original snippet, and anything guessed (year, ambiguous
// day/month order, missing date) is flagged so the student must confirm it before import.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.StillApp = root.StillApp || {}).syllabusParser = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
  "use strict";

  const MONTHS = {
    january: 1, jan: 1, enero: 1, ene: 1, janeiro: 1,
    february: 2, feb: 2, febrero: 2, fevereiro: 2, fev: 2,
    march: 3, mar: 3, marzo: 3, marco: 3,
    april: 4, apr: 4, abril: 4, abr: 4,
    may: 5, mayo: 5, maio: 5, mai: 5,
    june: 6, jun: 6, junio: 6, junho: 6,
    july: 7, jul: 7, julio: 7, julho: 7,
    august: 8, aug: 8, agosto: 8, ago: 8,
    september: 9, sept: 9, sep: 9, septiembre: 9, setiembre: 9, setembro: 9, set: 9,
    october: 10, oct: 10, octubre: 10, outubro: 10, out: 10,
    november: 11, nov: 11, noviembre: 11, novembro: 11,
    december: 12, dec: 12, diciembre: 12, dic: 12, dezembro: 12, dez: 12
  };

  const WEEKDAYS = {
    sunday: 0, domingo: 0, sun: 0,
    monday: 1, lunes: 1, segunda: 1, mon: 1,
    tuesday: 2, martes: 2, terca: 2, tue: 2, tues: 2,
    wednesday: 3, miercoles: 3, quarta: 3, wed: 3,
    thursday: 4, jueves: 4, quinta: 4, thu: 4, thurs: 4,
    friday: 5, viernes: 5, sexta: 5, fri: 5,
    saturday: 6, sabado: 6, sat: 6
  };

  // Keywords are matched on accent-free lowercase text.
  const KIND_KEYWORDS = [
    ["exam", ["final exam", "midterm", "exam", "examen", "parcial", "quiz", "quices", "prueba", "prova", "test"]],
    ["project", ["project", "proyecto", "projeto"]],
    ["presentation", ["presentation", "exposicion", "sustentacion", "apresentacao", "seminario", "seminar"]],
    ["assignment", ["assignment", "homework", "deliverable", "tarea", "taller", "entrega", "informe", "ensayo", "essay", "report", "trabajo", "trabalho", "relatorio", "lista de exercicios", "exercicio", "laboratorio", "lab", "practica", "workshop"]]
  ];

  const SUBJECT_LABEL = /^\s*(?:course(?: name)?|subject|asignatura|materia|curso|disciplina|componente curricular|unidad curricular)\s*[:\-–]\s*(.{2,120})$/i;
  const INSTRUCTOR_LABEL = /^\s*(?:instructor|professor(?:a)?|profesor(?:a)?|docente|teacher|lecturer)\s*[:\-–]\s*(.{2,120})$/i;

  function fold(text) {
    return String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  function normalizeTitle(text) {
    return fold(text).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  }

  const monthPattern = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");
  const ISO_DATE = /(?<!\d)(\d{4})-(\d{1,2})-(\d{1,2})(?!\d)/g;
  const NUMERIC_DATE = /(?<![\d/.-])(\d{1,2})([/.-])(\d{1,2})(?:\2(\d{4}|\d{2}))?(?![\d/]|\.\d)/g;
  const DAY_MONTH = new RegExp(`(?<![\\p{L}\\d])(\\d{1,2})(?:st|nd|rd|th|º|°)?\\s+(?:de\\s+|of\\s+)?(${monthPattern})\\.?(?![\\p{L}])(?:,?\\s+(?:de\\s+|del\\s+)?(\\d{4}))?`, "giu");
  // "set 5" / "out 10" read as ordinary English words, so those abbreviations only count day-first.
  const monthFirstPattern = Object.keys(MONTHS).filter((name) => !["set", "out", "mai"].includes(name))
    .sort((a, b) => b.length - a.length).join("|");
  const MONTH_DAY = new RegExp(`(?<![\\p{L}])(${monthFirstPattern})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?![\\d\\p{L}])(?:,?\\s+(\\d{4}))?`, "giu");
  const TIME = /(?<![\d:])(\d{1,2})(?::|h)(\d{2})\s*(am|pm|a\.m\.|p\.m\.)?(?![\d])/i;
  const WEIGHT = /(?<![\d.,])(\d{1,3}(?:[.,]\d{1,2})?)\s?%/;
  const TIME_RANGE = /(\d{1,2})(?::|h)?(\d{2})?\s*(am|pm)?\s*(?:-|–|—|to|a|às|as|until|hasta|ate)\s*(\d{1,2})(?::|h)?(\d{2})?\s*(am|pm)?/i;

  function isValidDate(year, month, day) {
    if (month < 1 || month > 12 || day < 1 || day > 31) return false;
    const date = new Date(year, month - 1, day);
    return date.getMonth() === month - 1 && date.getDate() === day;
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function isoDate(year, month, day) {
    return `${year}-${pad(month)}-${pad(day)}`;
  }

  // Picks the year closest after the reference (semester start) when the text omits it.
  function inferYear(month, day, reference) {
    const ref = new Date(reference);
    const year = ref.getFullYear();
    const candidate = new Date(year, month - 1, day).getTime();
    const sixtyDays = 60 * 24 * 3600 * 1000;
    return candidate < ref.getTime() - sixtyDays ? year + 1 : year;
  }

  function fullYear(text) {
    if (!text) return null;
    const year = Number(text);
    return text.length === 2 ? 2000 + year : year;
  }

  // Finds dates in a line. Returns [{ date, raw, index, ambiguous, alternatives, inferredYear }].
  function findDates(line, options) {
    const found = [];
    const taken = [];
    const free = (index, length) => !taken.some(([s, e]) => index < e && index + length > s);
    const take = (match) => taken.push([match.index, match.index + match[0].length]);
    const reference = options.referenceDate;

    for (const match of line.matchAll(ISO_DATE)) {
      const [raw, y, m, d] = match;
      if (!isValidDate(+y, +m, +d)) continue;
      take(match);
      found.push({ date: isoDate(+y, +m, +d), raw, index: match.index, ambiguous: false, inferredYear: false });
    }

    for (const regex of [DAY_MONTH, MONTH_DAY]) {
      for (const match of line.matchAll(regex)) {
        if (!free(match.index, match[0].length)) continue;
        const dayFirst = regex === DAY_MONTH;
        const day = Number(dayFirst ? match[1] : match[2]);
        const month = MONTHS[fold(dayFirst ? match[2] : match[1])];
        let year = fullYear(match[3]);
        const inferredYear = !year;
        if (!year) year = inferYear(month, day, reference);
        if (!month || !isValidDate(year, month, day)) continue;
        take(match);
        found.push({ date: isoDate(year, month, day), raw: match[0], index: match.index, ambiguous: false, inferredYear });
      }
    }

    for (const match of line.matchAll(NUMERIC_DATE)) {
      if (!free(match.index, match[0].length)) continue;
      const [raw, first, separator, second, yearText] = match;
      // Without a year only "dd/mm" with a slash is treated as a date ("8-10" is usually a time range).
      if (!yearText && separator !== "/") continue;
      const a = Number(first);
      const b = Number(second);
      let year = fullYear(yearText);
      const inferredYear = !year;
      const options2 = [];
      const pushOption = (day, month) => {
        const y = year || inferYear(month, day, reference);
        if (isValidDate(y, month, day)) options2.push(isoDate(y, month, day));
      };
      const dayFirst = options.dayFirst !== false;
      if (dayFirst) { pushOption(a, b); pushOption(b, a); } else { pushOption(b, a); pushOption(a, b); }
      const unique = [...new Set(options2)];
      if (!unique.length) continue;
      take(match);
      found.push({
        date: unique[0],
        raw,
        index: match.index,
        ambiguous: unique.length > 1 && a !== b,
        alternatives: unique,
        inferredYear
      });
    }

    return found.sort((x, y) => x.index - y.index);
  }

  function findTime(line) {
    const match = TIME.exec(line);
    if (!match) return null;
    let hours = Number(match[1]);
    const minutes = Number(match[2]);
    const meridiem = (match[3] || "").replace(/\./g, "").toLowerCase();
    if (meridiem === "pm" && hours < 12) hours += 12;
    if (meridiem === "am" && hours === 12) hours = 0;
    if (hours > 23 || minutes > 59) return null;
    return { time: `${pad(hours)}:${pad(minutes)}`, raw: match[0] };
  }

  function detectKind(foldedLine) {
    for (const [kind, words] of KIND_KEYWORDS) {
      for (const word of words) {
        if (new RegExp(`(?<![a-z])${word}(?![a-z])`).test(foldedLine)) return { kind, keyword: word };
      }
    }
    return null;
  }

  function cleanTitle(line, removals) {
    let title = line;
    removals.filter(Boolean).forEach((raw) => { title = title.replace(raw, " "); });
    return title
      .replace(/\b(?:due|deadline|fecha(?: de entrega)?|entrega:|prazo|date|el|on|em|para el|para)\s*[:\-–]?\s*$/i, "")
      .replace(/^[\s•▪◦●\-–—*·|>]+|^\(?\d{1,2}[.)]\s+/g, "")
      .replace(/[\s:;,|\-–—()]+$/g, "")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, 140);
  }

  function parseWeekdaySchedule(line, page) {
    const folded = fold(line);
    const day = Object.keys(WEEKDAYS).sort((a, b) => b.length - a.length)
      .find((name) => new RegExp(`(?<![a-z])${name}(?![a-z])`).test(folded));
    if (day == null) return null;
    const range = TIME_RANGE.exec(line);
    if (!range) return null;
    const toMinutes = (h, m, meridiem) => {
      let hours = Number(h);
      if (/pm/i.test(meridiem || "") && hours < 12) hours += 12;
      return hours * 60 + Number(m || 0);
    };
    const start = toMinutes(range[1], range[2], range[3] || range[6]);
    const end = toMinutes(range[4], range[5], range[6]);
    if (!(end > start) || end > 24 * 60) return null;
    const hm = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
    return { day: WEEKDAYS[day], start: hm(start), end: hm(end), page, snippet: line.trim().slice(0, 200) };
  }

  /**
   * @param {Array<{page:number, text:string}>} pages
   * @param {{referenceDate:number, dayFirst?:boolean, createId?:Function}} options
   */
  function parseSyllabus(pages, options) {
    const opts = { referenceDate: Date.now(), dayFirst: true, ...options };
    const createId = opts.createId || ((prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`);
    const items = [];
    const schedules = [];
    const seen = new Set();
    let subjectName = null;
    let instructor = null;

    pages.forEach(({ page, text }) => {
      String(text || "").split(/\r?\n/).forEach((rawLine, lineIndex) => {
        const line = rawLine.replace(/\s+/g, " ").trim();
        if (line.length < 3) return;

        const subjectMatch = !subjectName && SUBJECT_LABEL.exec(line);
        if (subjectMatch) { subjectName = { value: subjectMatch[1].trim(), page }; return; }
        const instructorMatch = !instructor && INSTRUCTOR_LABEL.exec(line);
        if (instructorMatch) { instructor = { value: instructorMatch[1].trim(), page }; return; }

        const folded = fold(line);
        const kind = detectKind(folded);
        const dates = findDates(line, opts);
        const weightMatch = WEIGHT.exec(line);
        const weight = weightMatch ? Number(weightMatch[1].replace(",", ".")) : null;

        if (!kind) {
          const schedule = dates.length === 0 && parseWeekdaySchedule(line, page);
          if (schedule) schedules.push(schedule);
          return;
        }
        // A keyword with neither a date nor a weight is usually prose ("homework is important").
        if (!dates.length && (weight == null || line.length > 90)) return;

        const time = dates.length ? findTime(line) : null;
        const date = dates[0] || null;
        const title = cleanTitle(line, [...dates.map((d) => d.raw), weightMatch?.[0], time?.raw]) || line.slice(0, 140);
        const fingerprint = `${normalizeTitle(title)}|${date?.date || ""}`;
        if (seen.has(fingerprint)) return;
        seen.add(fingerprint);

        const flags = {
          missingDate: !date,
          ambiguousDate: Boolean(date?.ambiguous),
          inferredYear: Boolean(date?.inferredYear),
          multipleDates: dates.length > 1
        };
        const needsReview = flags.missingDate || flags.ambiguousDate || flags.inferredYear || flags.multipleDates;
        items.push({
          id: createId("extract"),
          kind: kind.kind,
          keyword: kind.keyword,
          title,
          dueDate: date?.date || "",
          dueTime: time?.time || "",
          dateOptions: date?.alternatives || (date ? [date.date] : []),
          otherDates: dates.slice(1).map((d) => d.date),
          weight,
          page,
          line: lineIndex + 1,
          snippet: line.slice(0, 240),
          flags,
          confidence: !date ? "low" : needsReview ? "medium" : "high",
          status: "pending"
        });
      });
    });

    return { subjectName, instructor, items, schedules };
  }

  function taskFingerprint(task) {
    return `${normalizeTitle(task.title)}|${task.dueDate || ""}`;
  }

  // Maps extracted item id → existing task id when the same activity was already imported.
  function findDuplicates(items, tasks, subjectId) {
    const byFingerprint = new Map();
    const byTitle = new Map();
    tasks.forEach((task) => {
      byFingerprint.set(taskFingerprint(task), task.id);
      if (!subjectId || task.subjectId === subjectId) byTitle.set(normalizeTitle(task.title), task.id);
    });
    const result = {};
    items.forEach((item) => {
      const match = byFingerprint.get(taskFingerprint(item)) || (subjectId ? byTitle.get(normalizeTitle(item.title)) : null);
      if (match) result[item.id] = match;
    });
    return result;
  }

  // Simple content hash so re-importing the same file is detected.
  function fingerprintText(text) {
    let hash = 2166136261;
    const value = String(text);
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  }

  return { parseSyllabus, findDates, findTime, detectKind, findDuplicates, taskFingerprint, fingerprintText, normalizeTitle, fold, parseWeekdaySchedule };
});
