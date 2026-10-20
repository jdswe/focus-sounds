// Study-plan generator. Fills the student's free study windows (availability minus classes,
// commitments and already-approved sessions) with suggested sessions using earliest-deadline
// first, so large tasks are spread over several days before they are due.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.StillApp = root.StillApp || {}).scheduler = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
  "use strict";

  const MINUTE = 60 * 1000;
  const DAY = 24 * 60 * MINUTE;

  function parseTime(value) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || "").trim());
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 24 || minutes > 59) return null;
    return hours * 60 + minutes;
  }

  // "YYYY-MM-DD" in local time (new Date("YYYY-MM-DD") would be UTC midnight).
  function parseLocalDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime();
  }

  function formatLocalDate(time) {
    const date = new Date(time);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function startOfDay(time) {
    const date = new Date(time);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  }

  function addDays(dayStart, days) {
    const date = new Date(dayStart);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days).getTime();
  }

  function atMinutes(dayStart, minutes) {
    const date = new Date(dayStart);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, minutes).getTime();
  }

  // Date-only deadlines mean "have it ready when that day starts"; a due time is respected exactly.
  function taskDeadline(task) {
    const day = parseLocalDate(task.dueDate);
    if (day == null) return Infinity;
    const minutes = parseTime(task.dueTime);
    return minutes == null ? day : atMinutes(day, minutes);
  }

  // Expands weekly class schedules into concrete busy blocks inside [from, to).
  function expandWeekly(schedule, from, to) {
    const blocks = [];
    for (let day = startOfDay(from); day < to; day = addDays(day, 1)) {
      const weekday = new Date(day).getDay();
      schedule.forEach((entry) => {
        if (Number(entry.day) !== weekday) return;
        const start = parseTime(entry.start);
        const end = parseTime(entry.end);
        if (start == null || end == null || end <= start) return;
        blocks.push({ start: atMinutes(day, start), end: atMinutes(day, end) });
      });
    }
    return blocks;
  }

  function subtractBlocks(window, blocks) {
    let pieces = [window];
    blocks.forEach((block) => {
      pieces = pieces.flatMap((piece) => {
        if (block.end <= piece.start || block.start >= piece.end) return [piece];
        const parts = [];
        if (block.start > piece.start) parts.push({ start: piece.start, end: block.start });
        if (block.end < piece.end) parts.push({ start: block.end, end: piece.end });
        return parts;
      });
    });
    return pieces;
  }

  function buildFreeSlots(options) {
    const { availability, busy, from, to } = options;
    const slots = [];
    for (let day = startOfDay(from); day < to; day = addDays(day, 1)) {
      const windows = availability[new Date(day).getDay()] || [];
      windows.forEach((window) => {
        const start = parseTime(window.start);
        const end = parseTime(window.end);
        if (start == null || end == null || end <= start) return;
        const piece = { start: Math.max(atMinutes(day, start), from), end: Math.min(atMinutes(day, end), to) };
        if (piece.end > piece.start) slots.push(...subtractBlocks(piece, busy));
      });
    }
    return slots.sort((a, b) => a.start - b.start);
  }

  function compareTasks(a, b) {
    return a.deadline - b.deadline
      || (b.priority || 2) - (a.priority || 2)
      || String(a.id).localeCompare(String(b.id));
  }

  /**
   * @param {object} input
   * @param {number} input.now                Current time (ms).
   * @param {Array}  input.tasks              Tasks with id, estimateMinutes, dueDate, dueTime, priority, status.
   * @param {object} input.trackedMinutes     taskId → minutes already studied (measured).
   * @param {Array}  input.lockedSessions     Approved/edited sessions {taskId, start, end} — never moved.
   * @param {Array}  input.fixedEvents        One-off commitments {start, end} (ISO or ms).
   * @param {Array}  input.weeklySchedule     Class times {day, start, end}.
   * @param {object} input.preferences        availability, durations and caps.
   */
  function generatePlan(input) {
    const prefs = input.preferences;
    const now = input.now;
    const horizonEnd = addDays(startOfDay(now), (prefs.planningHorizonDays || 21) + 1);
    const maxChunk = prefs.maxSessionMinutes || 50;
    const minChunk = prefs.minSessionMinutes || 25;
    const breakMinutes = prefs.breakBetweenSessionsMinutes ?? 10;
    const dailyCap = prefs.maxTaskMinutesPerDay || 120;

    const toMs = (value) => (typeof value === "number" ? value : new Date(value).getTime());
    const locked = (input.lockedSessions || []).map((s) => ({ ...s, start: toMs(s.start), end: toMs(s.end) }));
    const busy = [
      ...expandWeekly(input.weeklySchedule || [], now, horizonEnd),
      ...(input.fixedEvents || []).map((event) => ({ start: toMs(event.start), end: toMs(event.end) })),
      ...locked
    ];

    const unestimated = [];
    const overdue = [];
    const work = [];
    (input.tasks || []).forEach((task) => {
      if (task.status === "done") return;
      const deadline = taskDeadline(task);
      if (!(Number(task.estimateMinutes) > 0)) { unestimated.push(task.id); return; }
      const tracked = (input.trackedMinutes || {})[task.id] || 0;
      const lockedAhead = locked
        .filter((s) => s.taskId === task.id && s.end > now)
        .reduce((sum, s) => sum + (s.end - Math.max(s.start, now)) / MINUTE, 0);
      const remaining = Math.max(0, Math.round(Number(task.estimateMinutes) - tracked - lockedAhead));
      if (deadline <= now) { if (remaining > 0) overdue.push(task.id); return; }
      if (remaining > 0) work.push({ id: task.id, priority: Number(task.priority) || 2, deadline, remaining, initial: remaining });
    });

    const dayUsage = new Map();
    const usageKey = (taskId, time) => `${taskId}|${startOfDay(time)}`;
    const sessions = [];
    const slots = buildFreeSlots({ availability: prefs.availability || {}, busy, from: now, to: horizonEnd });

    slots.forEach((slot) => {
      let cursor = slot.start;
      for (;;) {
        const slotLeft = (slot.end - cursor) / MINUTE;
        if (slotLeft <= 0) break;
        const choice = work
          .filter((item) => item.remaining > 0 && item.deadline > cursor)
          .sort(compareTasks)
          .map((item) => {
            const used = dayUsage.get(usageKey(item.id, cursor)) || 0;
            const untilDeadline = (item.deadline - cursor) / MINUTE;
            const minutes = Math.floor(Math.min(maxChunk, item.remaining, slotLeft, dailyCap - used, untilDeadline));
            return { item, minutes };
          })
          .find(({ item, minutes }) => minutes > 0 && minutes >= Math.min(minChunk, item.remaining));
        if (!choice) break;

        const start = cursor;
        const end = start + choice.minutes * MINUTE;
        sessions.push({ taskId: choice.item.id, start: new Date(start).toISOString(), end: new Date(end).toISOString(), minutes: choice.minutes });
        choice.item.remaining -= choice.minutes;
        const key = usageKey(choice.item.id, start);
        dayUsage.set(key, (dayUsage.get(key) || 0) + choice.minutes);
        cursor = end + breakMinutes * MINUTE;
      }
    });

    const conflicts = work
      .filter((item) => item.remaining > 0 && item.deadline <= horizonEnd)
      .map((item) => ({ taskId: item.id, unscheduledMinutes: item.remaining, neededMinutes: item.initial, deadline: new Date(item.deadline).toISOString() }));
    const beyondHorizon = work.filter((item) => item.remaining > 0 && item.deadline > horizonEnd).map((item) => item.id);

    return { sessions, conflicts, overdue, unestimated, beyondHorizon };
  }

  // Keeps every approved or manually edited session and replaces only future suggestions,
  // optionally limited to some tasks ("regenerate only the affected portion").
  function mergePlan(existing, generated, options) {
    const now = options.now;
    const onlyTasks = options.taskIds ? new Set(options.taskIds) : null;
    const replaceable = (session) => session.status === "suggested"
      && new Date(session.start).getTime() >= now
      && (!onlyTasks || onlyTasks.has(session.taskId));
    const kept = existing.filter((session) => !replaceable(session));
    const added = generated
      .filter((session) => !onlyTasks || onlyTasks.has(session.taskId))
      .map((session) => ({ id: options.createId("plan"), ...session, status: "suggested" }));
    return [...kept, ...added].sort((a, b) => new Date(a.start) - new Date(b.start));
  }

  return { parseTime, parseLocalDate, formatLocalDate, startOfDay, addDays, taskDeadline, expandWeekly, buildFreeSlots, generatePlan, mergePlan, DAY, MINUTE };
});
