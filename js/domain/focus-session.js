// Timestamp-based focus session model. Active time is the sum of closed segments, so the
// result never depends on how often a browser timer happened to fire.
//
// Recovery rule: while the page is open it records a heartbeat (`lastSeenAt`). If the page
// was closed, time after the last heartbeat is NOT counted: the open segment is closed at the
// heartbeat and the session is left paused so the student decides whether to continue.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.StillApp = root.StillApp || {}).focusSession = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
  "use strict";

  const HEARTBEAT_GRACE_MS = 90 * 1000;

  function start(options) {
    const now = options.now;
    return {
      id: options.id,
      kind: options.kind || "focus",
      plannedSeconds: options.plannedSeconds ?? null,
      taskId: options.taskId || null,
      subjectId: options.subjectId || null,
      startedAt: now,
      lastSeenAt: now,
      segments: [{ start: now, end: null }],
      interruptions: 0,
      status: "running",
      recovered: false
    };
  }

  function isRunning(session) {
    return Boolean(session) && session.status === "running";
  }

  function activeMs(session, now) {
    if (!session) return 0;
    return session.segments.reduce((total, segment) => {
      const end = segment.end ?? now;
      return total + Math.max(0, end - segment.start);
    }, 0);
  }

  function remainingMs(session, now) {
    if (!session || session.plannedSeconds == null) return null;
    return Math.max(0, session.plannedSeconds * 1000 - activeMs(session, now));
  }

  // The instant at which a running session reaches its planned duration.
  function completionTime(session) {
    if (!isRunning(session) || session.plannedSeconds == null) return null;
    const open = session.segments[session.segments.length - 1];
    const closedMs = activeMs({ segments: session.segments.slice(0, -1) }, 0);
    return open.start + Math.max(0, session.plannedSeconds * 1000 - closedMs);
  }

  function closeOpenSegment(session, at) {
    const open = session.segments[session.segments.length - 1];
    if (open && open.end == null) open.end = Math.max(open.start, at);
  }

  function pause(session, now) {
    if (!isRunning(session)) return session;
    const next = copy(session);
    closeOpenSegment(next, now);
    next.status = "paused";
    next.lastSeenAt = now;
    return next;
  }

  function resume(session, now) {
    if (!session || session.status !== "paused") return session;
    const next = copy(session);
    next.segments.push({ start: now, end: null });
    next.status = "running";
    next.lastSeenAt = now;
    next.recovered = false;
    return next;
  }

  function heartbeat(session, now) {
    if (!isRunning(session)) return session;
    return { ...session, lastSeenAt: now };
  }

  function addInterruption(session) {
    if (!session) return session;
    return { ...session, interruptions: (session.interruptions || 0) + 1 };
  }

  // Ends a session. `reason` is "completed" (planned time reached), "finished" (stopped early
  // by the student, work still counts) or "abandoned".
  function finish(session, now, reason) {
    const next = copy(session);
    const completeAt = completionTime(session);
    closeOpenSegment(next, completeAt != null ? Math.min(now, completeAt) : now);
    next.status = reason || "finished";
    next.endedAt = next.segments[next.segments.length - 1]?.end ?? now;
    next.activeSeconds = Math.round(activeMs(next, next.endedAt) / 1000);
    return next;
  }

  // Applies the recovery rule after a reload. Returns { session, completed } where `completed`
  // is true when the planned duration elapsed while the page was still open.
  function recover(session, now) {
    if (!isRunning(session)) return { session, completed: false };
    const completeAt = completionTime(session);
    const lastSeen = session.lastSeenAt ?? session.startedAt;
    const pageWasAlive = now - lastSeen <= HEARTBEAT_GRACE_MS;

    if (completeAt != null && completeAt <= (pageWasAlive ? now : lastSeen)) {
      return { session: finish(session, completeAt, "completed"), completed: true };
    }
    if (pageWasAlive) return { session: heartbeat(session, now), completed: false };

    const next = copy(session);
    closeOpenSegment(next, lastSeen);
    next.status = "paused";
    next.recovered = true;
    return { session: next, completed: false };
  }

  // Converts a finished session into the persisted history record.
  function toRecord(session) {
    return {
      id: session.id,
      kind: session.kind,
      taskId: session.taskId,
      subjectId: session.subjectId,
      plannedSeconds: session.plannedSeconds,
      startedAt: new Date(session.startedAt).toISOString(),
      endedAt: new Date(session.endedAt).toISOString(),
      activeSeconds: session.activeSeconds,
      pauses: Math.max(0, session.segments.length - 1),
      segments: session.segments.map((segment) => ({
        start: new Date(segment.start).toISOString(),
        end: new Date(segment.end).toISOString()
      })),
      interruptions: session.interruptions || 0,
      status: session.status
    };
  }

  // Idempotent append: a record whose id already exists is never added twice.
  function appendRecord(history, record) {
    if (history.some((item) => item.id === record.id)) return false;
    history.push(record);
    return true;
  }

  // Pomodoro sequencing: which phase comes after the given one.
  function nextPhase(currentKind, completedFocusCount, longBreakEvery) {
    if (currentKind !== "focus") return "focus";
    return completedFocusCount > 0 && completedFocusCount % Math.max(1, longBreakEvery) === 0
      ? "longBreak"
      : "shortBreak";
  }

  function copy(session) {
    return { ...session, segments: session.segments.map((segment) => ({ ...segment })) };
  }

  return {
    HEARTBEAT_GRACE_MS, start, pause, resume, heartbeat, finish, recover, activeMs, remainingMs,
    completionTime, addInterruption, toRecord, appendRecord, nextPhase, isRunning
  };
});
