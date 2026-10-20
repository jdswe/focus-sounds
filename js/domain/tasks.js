// Task lifecycle and subject progress. Progress is always derived from tasks and recorded
// sessions, so moving a card to "done" twice can never double-count anything.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.StillApp = root.StillApp || {}).tasks = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
  "use strict";

  const STATUSES = ["inbox", "todo", "doing", "review", "done"];
  const KINDS = ["assignment", "exam", "project", "presentation", "reading", "other"];
  const SUBJECT_COLORS = ["#3B6FB6", "#2E8B57", "#7B4FB5", "#C2571A", "#B23A6B", "#1F8A8A", "#8A6D1F", "#4D5BA8", "#A33B3B", "#5E7D2A"];

  function createTask(fields, now, createId) {
    const timestamp = new Date(now).toISOString();
    return {
      id: createId("task"),
      subjectId: fields.subjectId || null,
      title: String(fields.title || "").trim(),
      description: fields.description || "",
      kind: KINDS.includes(fields.kind) ? fields.kind : "assignment",
      dueDate: fields.dueDate || "",
      dueTime: fields.dueTime || "",
      priority: [1, 2, 3].includes(Number(fields.priority)) ? Number(fields.priority) : 2,
      status: STATUSES.includes(fields.status) ? fields.status : "todo",
      estimateMinutes: Number(fields.estimateMinutes) > 0 ? Math.round(Number(fields.estimateMinutes)) : null,
      weight: fields.weight ?? null,
      subtasks: Array.isArray(fields.subtasks) ? fields.subtasks : [],
      notes: fields.notes || "",
      source: fields.source || null,
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: fields.status === "done" ? timestamp : null
    };
  }

  function validateTask(task) {
    const errors = [];
    if (!task.title) errors.push("titleRequired");
    if (task.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)) errors.push("dateInvalid");
    if (task.dueTime && !/^\d{2}:\d{2}$/.test(task.dueTime)) errors.push("timeInvalid");
    return errors;
  }

  function moveTask(task, status, now) {
    if (!STATUSES.includes(status) || task.status === status) return task;
    const timestamp = new Date(now).toISOString();
    return {
      ...task,
      status,
      updatedAt: timestamp,
      completedAt: status === "done" ? (task.completedAt || timestamp) : null
    };
  }

  function trackedMinutesByTask(focusSessions) {
    const result = {};
    focusSessions.forEach((session) => {
      if (session.kind !== "focus" || !session.taskId) return;
      result[session.taskId] = (result[session.taskId] || 0) + (session.activeSeconds || 0) / 60;
    });
    return result;
  }

  function subjectProgress(subjectId, tasks, focusSessions) {
    const own = tasks.filter((task) => task.subjectId === subjectId);
    const done = own.filter((task) => task.status === "done");
    const weighted = own.filter((task) => Number(task.weight) > 0);
    const trackedSeconds = focusSessions
      .filter((session) => session.kind === "focus" && (session.subjectId === subjectId || own.some((task) => task.id === session.taskId)))
      .reduce((sum, session) => sum + (session.activeSeconds || 0), 0);
    return {
      total: own.length,
      done: done.length,
      percent: own.length ? Math.round((done.length / own.length) * 100) : 0,
      weightTotal: weighted.reduce((sum, task) => sum + Number(task.weight), 0),
      weightDone: weighted.filter((task) => task.status === "done").reduce((sum, task) => sum + Number(task.weight), 0),
      estimateMinutes: own.reduce((sum, task) => sum + (Number(task.estimateMinutes) || 0), 0),
      trackedMinutes: Math.round(trackedSeconds / 60)
    };
  }

  function sortTasks(tasks, by) {
    const list = [...tasks];
    const dueValue = (task) => task.dueDate ? `${task.dueDate}T${task.dueTime || "23:59"}` : "9999";
    if (by === "priority") list.sort((a, b) => b.priority - a.priority || dueValue(a).localeCompare(dueValue(b)));
    else if (by === "title") list.sort((a, b) => a.title.localeCompare(b.title));
    else list.sort((a, b) => dueValue(a).localeCompare(dueValue(b)) || b.priority - a.priority);
    return list;
  }

  function filterTasks(tasks, filters) {
    const query = String(filters.query || "").toLowerCase().trim();
    return tasks.filter((task) => (!filters.subjectId || task.subjectId === filters.subjectId)
      && (!filters.status || task.status === filters.status)
      && (!query || `${task.title} ${task.description}`.toLowerCase().includes(query)));
  }

  function nextSubjectColor(subjects) {
    const used = new Set(subjects.map((subject) => subject.color));
    return SUBJECT_COLORS.find((color) => !used.has(color)) || SUBJECT_COLORS[subjects.length % SUBJECT_COLORS.length];
  }

  // Readable text color (black or white) for a subject color, using WCAG relative luminance.
  function contrastText(hex) {
    const match = /^#?([\da-f]{6})$/i.exec(hex || "");
    if (!match) return "#ffffff";
    const channels = [0, 2, 4].map((offset) => parseInt(match[1].slice(offset, offset + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    return (luminance + 0.05) / 0.05 > 1.05 / (luminance + 0.05) ? "#111111" : "#ffffff";
  }

  return { STATUSES, KINDS, SUBJECT_COLORS, createTask, validateTask, moveTask, trackedMinutesByTask, subjectProgress, sortTasks, filterTasks, nextSubjectColor, contrastText };
});
