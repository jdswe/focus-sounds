// Focus timer UI. Session timing lives in domain/focus-session.js; this file persists the
// active session (so reloads and other tabs see the same timer) and records history once.
(function () {
  const app = window.StillApp;
  const fs = app.focusSession;
  const { esc } = app.dom;
  const t = (key, params) => app.i18n.t(key, params);
  const ACTIVE_KEY = "still-active-session";
  const HEARTBEAT_MS = 5000;

  const el = {
    face: document.querySelector("#timerFace"),
    time: document.querySelector("#timerTime"),
    mode: document.querySelector("#timerMode"),
    status: document.querySelector("#timerStatus"),
    toggle: document.querySelector("#timerToggle"),
    finish: document.querySelector("#timerFinish"),
    reset: document.querySelector("#timerReset"),
    interruption: document.querySelector("#timerInterruption"),
    interruptionCount: document.querySelector("#interruptionCount"),
    config: document.querySelector("#timerConfig"),
    customField: document.querySelector("#customMinutesField"),
    customMinutes: document.querySelector("#customMinutes"),
    task: document.querySelector("#timerTask"),
    summary: document.querySelector("#sessionSummary"),
    modeButtons: [...document.querySelectorAll("[data-timer-mode]")]
  };

  // { session, mode, completedFocus, nextKind } — shared by every tab through localStorage.
  let active = { session: null, mode: "pomodoro", completedFocus: 0, nextKind: "focus" };
  let lastHeartbeat = 0;
  let statusKey = null;
  let finalizing = false;
  let lastSummary = null;

  const prefs = () => app.store.app.get().preferences;

  function readActive() {
    try {
      const parsed = JSON.parse(localStorage.getItem(ACTIVE_KEY) || "null");
      if (parsed && typeof parsed === "object") return { ...active, ...parsed };
    } catch (error) {
      console.warn("Could not read the active session:", error);
    }
    return active;
  }

  function writeActive() {
    try { localStorage.setItem(ACTIVE_KEY, JSON.stringify(active)); } catch (error) { console.warn("Could not save the active session:", error); }
  }

  function plannedSecondsFor(kind) {
    const p = prefs();
    if (kind === "shortBreak") return p.shortBreakMinutes * 60;
    if (kind === "longBreak") return p.longBreakMinutes * 60;
    if (active.mode === "free") return null;
    if (active.mode === "custom") return Math.min(240, Math.max(1, Number(el.customMinutes.value) || 25)) * 60;
    return p.focusMinutes * 60;
  }

  function formatClock(ms) {
    const total = Math.max(0, Math.round(ms / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");
    return hours ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  function taskById(id) {
    return app.store.app.get().tasks.find((task) => task.id === id);
  }

  function renderTaskOptions() {
    const state = app.store.app.get();
    const selected = active.session?.taskId ?? el.task.value;
    const subjects = new Map(state.subjects.map((subject) => [subject.id, subject]));
    const open = app.tasks.sortTasks(state.tasks.filter((task) => task.status !== "done" || task.id === selected), "due");
    el.task.innerHTML = app.dom.option("", t("timer.noTask"), !selected)
      + open.map((task) => app.dom.option(task.id, `${subjects.get(task.subjectId)?.name ? `${subjects.get(task.subjectId).name} · ` : ""}${task.title}`, task.id === selected)).join("");
  }

  function render() {
    const now = Date.now();
    const session = active.session;
    const kind = session?.kind || active.nextKind;
    const planned = session ? session.plannedSeconds : plannedSecondsFor(kind);
    const running = fs.isRunning(session);
    const elapsed = fs.activeMs(session, now);
    const remaining = planned == null ? null : Math.max(0, planned * 1000 - elapsed);
    const display = remaining == null ? elapsed : remaining;

    el.time.textContent = formatClock(display);
    el.mode.textContent = t(`timer.kind.${kind}`) + (active.mode === "pomodoro" && kind === "focus" ? ` · ${t("timer.cycle", { n: (active.completedFocus % prefs().longBreakEvery) + 1, total: prefs().longBreakEvery })}` : "");
    el.face.setAttribute("aria-label", t("timer.aria", { kind: t(`timer.kind.${kind}`), time: formatClock(display) }));
    el.face.style.setProperty("--timer-progress", planned ? `${Math.min(100, (elapsed / (planned * 1000)) * 100)}%` : running ? "100%" : "0%");
    el.toggle.textContent = running ? t("timer.pause") : session ? t("timer.resume") : t(kind === "focus" ? "timer.startFocus" : "timer.startBreak");
    el.finish.hidden = !session;
    el.interruption.hidden = !(session && kind === "focus");
    el.interruptionCount.textContent = String(session?.interruptions || 0);
    el.modeButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.timerMode === active.mode));
      button.disabled = Boolean(session);
    });
    el.customField.hidden = active.mode !== "custom";
    el.customMinutes.disabled = Boolean(session);
    el.task.disabled = Boolean(session);
    if (statusKey) el.status.textContent = t(statusKey.key, statusKey.params);
    document.title = running ? `${formatClock(display)} · ${t(`timer.kind.${kind}`)} · Focus Sounds` : "Focus Sounds";
  }

  function setStatus(key, params) {
    statusKey = { key, params };
  }

  function emitState() {
    app.dom.emit("timer:state", { kind: active.session?.kind || null, running: fs.isRunning(active.session) });
  }

  function start(kind) {
    const task = taskById(el.task.value);
    active.session = fs.start({
      id: app.store.createId("session"),
      kind,
      plannedSeconds: plannedSecondsFor(kind),
      taskId: kind === "focus" ? task?.id || null : null,
      subjectId: kind === "focus" ? task?.subjectId || null : null,
      now: Date.now()
    });
    el.summary.hidden = true;
    lastSummary = null;
    setStatus(kind === "focus" ? (task ? "timer.status.focusTask" : "timer.status.focus") : "timer.status.break", { task: task?.title || "" });
    if (kind === "focus" && task && task.status !== "doing" && task.status !== "done") {
      app.store.app.update((state) => {
        const index = state.tasks.findIndex((item) => item.id === task.id);
        if (index >= 0) state.tasks[index] = app.tasks.moveTask(state.tasks[index], "doing", Date.now());
      }, "timer");
    }
    writeActive();
    emitState();
    render();
  }

  function toggle() {
    const now = Date.now();
    if (!active.session) return start(active.nextKind);
    if (fs.isRunning(active.session)) {
      active.session = fs.pause(active.session, now);
      setStatus("timer.status.paused");
    } else {
      active.session = fs.resume(active.session, now);
      setStatus(active.session.kind === "focus" ? "timer.status.focus" : "timer.status.break");
    }
    writeActive();
    emitState();
    render();
  }

  function withLock(fn) {
    if (navigator.locks?.request) return navigator.locks.request("still-session-finalize", fn);
    return fn();
  }

  // Ends the active session. Safe to call from several tabs: the record id is checked under a
  // Web Lock against the freshest stored data, so history never gets a duplicate.
  async function finalize(reason) {
    if (finalizing || !active.session) return;
    finalizing = true;
    const sessionId = active.session.id;
    try {
      await withLock(async () => {
        const shared = readActive();
        if (shared.session?.id !== sessionId) { active = shared; return; }
        const ended = fs.finish(shared.session, Date.now(), reason);
        const record = { ...fs.toRecord(ended), mode: shared.mode, sounds: app.soundMixer.getActiveKinds() };
        const keep = ended.kind !== "focus" || ended.activeSeconds >= 60 || reason === "completed";
        app.store.app.reload("sync");
        if (keep) app.store.app.update((state) => { fs.appendRecord(state.focusSessions, record); }, "timer");

        const wasFocus = ended.kind === "focus";
        const completedFocus = shared.completedFocus + (wasFocus && reason === "completed" && shared.mode === "pomodoro" ? 1 : 0);
        const nextKind = shared.mode === "pomodoro" ? fs.nextPhase(ended.kind, completedFocus, prefs().longBreakEvery) : "focus";
        active = { session: null, mode: shared.mode, completedFocus, nextKind: reason === "abandoned" ? "focus" : nextKind };
        writeActive();

        if (keep && wasFocus) showSummary(record);
        if (reason === "completed") {
          notify(wasFocus ? t("timer.notify.focusDone") : t("timer.notify.breakDone"));
          setStatus(wasFocus ? (active.nextKind === "longBreak" ? "timer.status.longBreakNext" : "timer.status.breakNext") : "timer.status.focusNext");
          if (wasFocus) app.dom.emit("session:completed", record);
          if (wasFocus && prefs().autoStartBreaks && active.mode === "pomodoro") start(active.nextKind);
        } else {
          setStatus(keep ? "timer.status.saved" : "timer.status.discarded");
        }
      });
    } finally {
      finalizing = false;
      emitState();
      render();
    }
  }

  function showSummary(record) {
    lastSummary = record;
    const task = taskById(record.taskId);
    const minutes = Math.round(record.activeSeconds / 60);
    el.summary.hidden = false;
    el.summary.innerHTML = `
      <strong>${esc(t("timer.summary.title"))}</strong>
      <span>${esc(t("timer.summary.body", { time: app.i18n.formatMinutes(minutes), pauses: record.pauses, interruptions: record.interruptions }))}${task ? ` · ${esc(task.title)}` : ""}</span>
      <span class="rating" role="group" aria-label="${esc(t("timer.summary.ratingLabel"))}">${esc(t("timer.summary.rating"))}
        ${[1, 2, 3].map((value) => `<button type="button" class="small-button ghost" data-rate="${value}" data-record="${esc(record.id)}">${esc(t(`timer.rating.${value}`))}</button>`).join("")}
      </span>
      ${task && task.status !== "done" ? `<button type="button" class="small-button" data-complete-task="${esc(task.id)}">${esc(t("timer.summary.markDone"))}</button>` : ""}
      <span class="muted-text">${esc(motivationLine())}</span>`;
  }

  function motivationLine() {
    if (!prefs().motivation) return "";
    return app.shell?.nextMotivation("break") || "";
  }

  function notify(message) {
    if (!prefs().notifications || !("Notification" in window) || Notification.permission !== "granted") return;
    try { new Notification("Focus Sounds", { body: message, icon: "assets/favicon.svg", tag: "still-timer" }); } catch (error) { console.warn("Notification failed:", error); }
  }

  // Refreshes only the heartbeat of the shared session, so a stale copy in this tab never
  // overwrites a pause, resume or finish made in another tab.
  function writeHeartbeat(now) {
    const shared = readActive();
    if (!shared.session || shared.session.id !== active.session?.id || !fs.isRunning(shared.session)) {
      active = shared;
      return;
    }
    shared.session = fs.heartbeat(shared.session, now);
    active = shared;
    writeActive();
  }

  function tick() {
    const now = Date.now();
    const session = active.session;
    if (fs.isRunning(session)) {
      const completeAt = fs.completionTime(session);
      if (completeAt != null && now >= completeAt) { void finalize("completed"); return; }
      if (now - lastHeartbeat >= HEARTBEAT_MS) {
        lastHeartbeat = now;
        writeHeartbeat(now);
      }
    }
    render();
  }

  function recoverOnLoad() {
    active = readActive();
    if (!active.session) return;
    const { session, completed } = fs.recover(active.session, Date.now());
    if (completed) {
      // The planned time ran out while a tab was still open: finish() clamps the record to the
      // planned end, so the reload gap is not counted.
      void finalize("completed");
      return;
    }
    active.session = session;
    if (session.recovered) setStatus("timer.status.recovered", { time: app.i18n.formatMinutes(fs.activeMs(session, Date.now()) / 60000) });
    else setStatus(session.status === "paused" ? "timer.status.paused" : session.kind === "focus" ? "timer.status.focus" : "timer.status.break");
    writeActive();
  }

  function startForTask(taskId) {
    if (active.session) {
      app.dom.toast(t("timer.alreadyRunning"));
      return false;
    }
    renderTaskOptions();
    el.task.value = taskId;
    active.nextKind = "focus";
    start("focus");
    return true;
  }

  function init() {
    recoverOnLoad();
    renderTaskOptions();
    if (!statusKey) setStatus("timer.status.idle", { minutes: prefs().focusMinutes });

    el.toggle.addEventListener("click", toggle);
    el.finish.addEventListener("click", () => void finalize(active.session?.kind === "focus" ? "finished" : "completed"));
    el.reset.addEventListener("click", async () => {
      if (active.session && active.session.kind === "focus" && fs.activeMs(active.session, Date.now()) >= 60000) {
        if (!(await app.dom.confirmDialog(t("timer.resetConfirm"), t("timer.reset")))) return;
      }
      if (active.session) await finalize("abandoned");
      active = { ...active, session: null, completedFocus: 0, nextKind: "focus" };
      writeActive();
      setStatus("timer.status.idle", { minutes: prefs().focusMinutes });
      emitState();
      render();
    });
    el.interruption.addEventListener("click", () => {
      active.session = fs.addInterruption(active.session);
      writeActive();
      render();
    });
    el.modeButtons.forEach((button) => button.addEventListener("click", () => {
      if (active.session) return;
      active.mode = button.dataset.timerMode;
      active.nextKind = "focus";
      writeActive();
      render();
    }));
    el.customMinutes.addEventListener("input", render);
    el.summary.addEventListener("click", (event) => {
      const rate = event.target.closest("[data-rate]");
      const complete = event.target.closest("[data-complete-task]");
      if (rate) {
        app.store.app.update((state) => {
          const record = state.focusSessions.find((item) => item.id === rate.dataset.record);
          if (record) record.rating = Number(rate.dataset.rate);
        }, "timer");
        rate.parentElement.innerHTML = esc(t("timer.summary.thanks"));
      } else if (complete) {
        app.store.app.update((state) => {
          const index = state.tasks.findIndex((item) => item.id === complete.dataset.completeTask);
          if (index >= 0) state.tasks[index] = app.tasks.moveTask(state.tasks[index], "done", Date.now());
        }, "timer");
        complete.remove();
        app.dom.emit("task:completed");
      }
    });

    window.addEventListener("storage", (event) => {
      if (event.key !== ACTIVE_KEY) return;
      active = readActive();
      emitState();
      render();
    });
    window.addEventListener("pagehide", () => {
      if (fs.isRunning(active.session)) writeHeartbeat(Date.now());
    });
    app.store.app.subscribe(renderTaskOptions);
    app.i18n.onChange(() => { renderTaskOptions(); render(); if (!el.summary.hidden && lastSummary) showSummary(lastSummary); });

    window.setInterval(tick, 500);
    emitState();
    render();
  }

  app.focusTimer = { init, startForTask, isActive: () => Boolean(active.session) };
})();
