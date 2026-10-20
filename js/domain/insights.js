// Statistics and recommendations computed only from recorded sessions and saved tasks.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.StillApp = root.StillApp || {}).insights = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
  "use strict";

  const DAY = 24 * 60 * 60 * 1000;

  function localDay(time) {
    const date = new Date(time);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function dayStart(time) {
    const date = new Date(time);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  }

  function focusOnly(sessions) {
    return sessions.filter((session) => session.kind === "focus");
  }

  // Splits each session's active segments across calendar days.
  function minutesByDay(sessions, now, days) {
    const start = dayStart(now) - (days - 1) * DAY;
    const buckets = new Map();
    for (let i = 0; i < days; i++) {
      const day = new Date(start);
      day.setDate(day.getDate() + i);
      buckets.set(localDay(day), 0);
    }
    focusOnly(sessions).forEach((session) => {
      (session.segments || []).forEach((segment) => {
        let cursor = new Date(segment.start).getTime();
        const end = new Date(segment.end).getTime();
        while (cursor < end) {
          const next = Math.min(end, dayStart(cursor) + DAY);
          const key = localDay(cursor);
          if (buckets.has(key)) buckets.set(key, buckets.get(key) + (next - cursor) / 60000);
          cursor = next;
        }
      });
    });
    return [...buckets].map(([date, minutes]) => ({ date, minutes: Math.round(minutes) }));
  }

  function totalMinutes(sessions, from, to) {
    return Math.round(focusOnly(sessions)
      .filter((session) => {
        const started = new Date(session.startedAt).getTime();
        return started >= from && started < to;
      })
      .reduce((sum, session) => sum + (session.activeSeconds || 0), 0) / 60);
  }

  function minutesBySubject(sessions, tasks) {
    const subjectOfTask = new Map(tasks.map((task) => [task.id, task.subjectId]));
    const result = {};
    focusOnly(sessions).forEach((session) => {
      const subjectId = session.subjectId || subjectOfTask.get(session.taskId) || "none";
      result[subjectId] = (result[subjectId] || 0) + (session.activeSeconds || 0) / 60;
    });
    Object.keys(result).forEach((key) => { result[key] = Math.round(result[key]); });
    return result;
  }

  function upcomingDeadlines(tasks, now, days) {
    const today = localDay(now);
    const limit = localDay(now + days * DAY);
    return tasks
      .filter((task) => task.status !== "done" && task.dueDate && task.dueDate >= today && task.dueDate <= limit)
      .sort((a, b) => `${a.dueDate}${a.dueTime}`.localeCompare(`${b.dueDate}${b.dueTime}`));
  }

  function daysUntil(dueDate, now) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueDate || "");
    if (!match) return null;
    const due = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime();
    return Math.round((due - dayStart(now)) / DAY);
  }

  /**
   * Ranks open tasks. Each recommendation lists the reasons that produced its score as
   * translation keys so the interface can explain "why this task".
   */
  function recommend(input) {
    const { tasks, trackedMinutes = {}, plannedSessions = [], now } = input;
    const today = localDay(now);
    return tasks
      .filter((task) => task.status !== "done")
      .map((task) => {
        const reasons = [];
        let score = 0;
        const days = daysUntil(task.dueDate, now);
        if (days != null && days < 0) { score += 60; reasons.push({ key: "reason.overdue" }); }
        else if (days != null && days <= 7) { score += 45 - days * 5; reasons.push({ key: days === 0 ? "reason.dueToday" : "reason.dueSoon", params: { days } }); }
        else if (days != null && days <= 21) score += 10;
        if (task.priority === 3) { score += 15; reasons.push({ key: "reason.highPriority" }); }
        if (task.status === "doing") { score += 10; reasons.push({ key: "reason.inProgress" }); }
        if (Number(task.weight) >= 20) { score += 8; reasons.push({ key: "reason.weight", params: { weight: task.weight } }); }
        const remaining = (Number(task.estimateMinutes) || 0) - (trackedMinutes[task.id] || 0);
        if (remaining >= 180 && days != null && days <= 14) { score += 12; reasons.push({ key: "reason.heavy", params: { hours: Math.round(remaining / 60) } }); }
        if (plannedSessions.some((session) => session.taskId === task.id && localDay(new Date(session.start).getTime()) === today && session.status !== "skipped")) {
          score += 20;
          reasons.push({ key: "reason.plannedToday" });
        }
        return { taskId: task.id, score, reasons, remainingMinutes: Math.max(0, Math.round(remaining)) };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  function estimateVsActual(tasks, trackedMinutes) {
    return tasks
      .filter((task) => Number(task.estimateMinutes) > 0 && trackedMinutes[task.id])
      .map((task) => ({ taskId: task.id, estimate: Number(task.estimateMinutes), actual: Math.round(trackedMinutes[task.id]) }));
  }

  // Progress counters used by companion unlocks; all derived from saved records.
  function progressCounters(state) {
    const sessions = focusOnly(state.focusSessions).filter((session) => session.activeSeconds >= 60);
    return {
      focusSessions: sessions.filter((session) => session.status === "completed").length,
      focusMinutes: Math.round(sessions.reduce((sum, session) => sum + session.activeSeconds, 0) / 60),
      tasksCompleted: state.tasks.filter((task) => task.status === "done").length,
      cardsReviewed: state.cards.reduce((sum, card) => sum + (card.history?.length || 0), 0),
      notesWritten: state.notes.filter((note) => (note.body || "").trim().length >= 40).length,
      subjects: state.subjects.length
    };
  }

  return { minutesByDay, totalMinutes, minutesBySubject, upcomingDeadlines, daysUntil, recommend, estimateVsActual, progressCounters, localDay, dayStart };
});
