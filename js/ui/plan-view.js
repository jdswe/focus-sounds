// Study plan: commitments, generated sessions and conflict warnings. Suggested sessions are
// clearly separated from fixed events; approved or edited sessions are never moved.
(function () {
  const app = window.StillApp;
  const { esc, option } = app.dom;
  const t = (key, params) => app.i18n.t(key, params);
  const root = () => document.querySelector('[data-view="plan"]');
  const store = () => app.store.app;

  function isReplaceable(session, now) {
    return session.status === "suggested" && new Date(session.start).getTime() >= now;
  }

  function buildInput(state, now, onlyTaskIds) {
    const replaceable = (session) => isReplaceable(session, now) && (!onlyTaskIds || onlyTaskIds.includes(session.taskId));
    const weekly = [
      ...state.subjects.flatMap((subject) => subject.schedule || []),
      ...state.events.filter((event) => event.repeat === "weekly")
    ];
    const dated = state.events.filter((event) => event.repeat !== "weekly" && event.date).map((event) => {
      const day = app.scheduler.parseLocalDate(event.date);
      const start = app.scheduler.parseTime(event.start);
      const end = app.scheduler.parseTime(event.end);
      return { start: day + start * 60000, end: day + end * 60000 };
    }).filter((event) => event.end > event.start);
    return {
      now,
      preferences: state.preferences,
      tasks: state.tasks.filter((task) => !onlyTaskIds || onlyTaskIds.includes(task.id)),
      trackedMinutes: app.tasks.trackedMinutesByTask(state.focusSessions),
      lockedSessions: state.plannedSessions.filter((session) => session.status !== "skipped" && session.status !== "done" && !replaceable(session)),
      weeklySchedule: weekly,
      fixedEvents: dated
    };
  }

  // Conflicts and warnings for the current state, without changing anything.
  function preview(state, now) {
    return app.scheduler.generatePlan(buildInput(state, now));
  }

  function regenerate(onlyTaskIds) {
    const now = Date.now();
    let result;
    store().update((state) => {
      result = app.scheduler.generatePlan(buildInput(state, now, onlyTaskIds));
      state.plannedSessions = app.scheduler.mergePlan(state.plannedSessions, result.sessions, { now, createId: app.store.createId, taskIds: onlyTaskIds });
    }, "planner");
    app.dom.toast(t("plan.generated", { n: result.sessions.length }));
    return result;
  }

  function render() {
    const state = store().get();
    const now = Date.now();
    const plan = preview(state, now);
    const byId = new Map(state.tasks.map((task) => [task.id, task]));
    const subjects = new Map(state.subjects.map((subject) => [subject.id, subject]));
    const upcoming = state.plannedSessions.filter((session) => new Date(session.end).getTime() >= app.insights.dayStart(now));
    const days = new Map();
    upcoming.forEach((session) => {
      const key = app.insights.localDay(new Date(session.start).getTime());
      if (!days.has(key)) days.set(key, []);
      days.get(key).push(session);
    });
    const suggested = upcoming.filter((session) => session.status === "suggested").length;
    const weekdays = [1, 2, 3, 4, 5, 6, 0];

    root().innerHTML = `
      <div class="view-header">
        <div><span class="panel-kicker">${esc(t("plan.kicker"))}</span><h2 class="view-title">${esc(t("plan.title"))}</h2></div>
        <div class="button-row">
          <button type="button" class="primary-button" data-action="regenerate">${esc(t(upcoming.length ? "plan.regenerate" : "plan.generate"))}</button>
          ${suggested ? `<button type="button" class="ghost-button" data-action="approve-all">${esc(t("plan.approveAll", { n: suggested }))}</button>` : ""}
        </div>
      </div>
      <p class="hint">${esc(t("plan.explain"))}</p>
      <div class="view-grid two-one">
        <section class="glass-panel pad">
          ${plan.conflicts.length ? `<div class="notice warn" role="note"><strong>${esc(t("plan.conflictsTitle"))}</strong><ul>${plan.conflicts.map((conflict) => `<li>${esc(byId.get(conflict.taskId)?.title || "")}: ${esc(t("plan.conflictLine", { missing: app.i18n.formatMinutes(conflict.unscheduledMinutes), needed: app.i18n.formatMinutes(conflict.neededMinutes), date: app.i18n.formatDate(conflict.deadline) }))} <button type="button" class="text-button" data-open-task="${esc(conflict.taskId)}">${esc(t("action.edit"))}</button></li>`).join("")}</ul><p>${esc(t("plan.conflictHelp"))}</p></div>` : ""}
          ${plan.overdue.length ? `<div class="notice" role="note"><strong>${esc(t("plan.overdueTitle"))}</strong> ${plan.overdue.map((id) => `<button type="button" class="text-button" data-open-task="${esc(id)}">${esc(byId.get(id)?.title || "")}</button>`).join(", ")}</div>` : ""}
          ${plan.unestimated.length ? `<div class="notice" role="note"><strong>${esc(t("plan.unestimatedTitle"))}</strong> ${esc(t("plan.unestimatedHelp"))} ${plan.unestimated.map((id) => `<button type="button" class="text-button" data-open-task="${esc(id)}">${esc(byId.get(id)?.title || "")}</button>`).join(", ")}</div>` : ""}
          ${days.size ? [...days].map(([day, sessions]) => `
            <h3 class="subheading">${esc(app.i18n.formatDate(day, { weekday: "long", month: "long", day: "numeric" }))}</h3>
            <ul class="plan-sessions">${sessions.map((session) => {
              const task = byId.get(session.taskId);
              const subject = subjects.get(task?.subjectId);
              const date = app.insights.localDay(new Date(session.start).getTime());
              const hm = (iso) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
              return `<li class="plan-session status-${session.status}" style="--subject:${esc(subject?.color || "var(--accent)")}">
                <form class="plan-session-time" data-session-form="${esc(session.id)}">
                  <input type="date" name="date" value="${date}" aria-label="${esc(t("plan.date"))}">
                  <input type="time" name="start" value="${hm(session.start)}" aria-label="${esc(t("plan.start"))}">
                  <input type="time" name="end" value="${hm(session.end)}" aria-label="${esc(t("plan.end"))}">
                  <button type="submit" class="small-button ghost">${esc(t("action.save"))}</button>
                </form>
                <div class="plan-session-main">${app.dom.subjectChip(subject)} <strong>${esc(task?.title || t("task.deleted"))}</strong>
                  <span class="badge">${esc(t(`plan.status.${session.status}`))}</span>${session.edited ? `<span class="badge">${esc(t("plan.edited"))}</span>` : ""}</div>
                <div class="button-row">
                  ${session.status === "suggested" ? `<button type="button" class="small-button" data-approve="${esc(session.id)}">${esc(t("plan.approve"))}</button>` : ""}
                  ${task && task.status !== "done" ? `<button type="button" class="small-button ghost" data-focus-task="${esc(task.id)}">${esc(t("today.startFocus"))}</button>` : ""}
                  ${session.status !== "skipped" ? `<button type="button" class="small-button ghost" data-skip="${esc(session.id)}">${esc(t("plan.skip"))}</button>` : ""}
                  <button type="button" class="small-button ghost" data-delete-session="${esc(session.id)}">${esc(t("action.delete"))}</button>
                </div>
              </li>`;
            }).join("")}</ul>`).join("") : `<p class="muted-text">${esc(t("plan.empty"))}</p>`}
        </section>

        <aside class="stack">
          <section class="glass-panel pad">
            <h3 class="card-title">${esc(t("plan.availability"))}</h3>
            <ul class="plain-list">${weekdays.map((day) => {
              const windows = state.preferences.availability[day] || [];
              return `<li><strong>${esc(app.i18n.weekdayName(day, "short"))}</strong> ${windows.length ? esc(windows.map((w) => `${w.start}–${w.end}`).join(", ")) : `<span class="muted-text">${esc(t("plan.noStudy"))}</span>`}</li>`;
            }).join("")}</ul>
            <a class="text-link" href="#/settings">${esc(t("plan.editAvailability"))}</a>
          </section>
          <section class="glass-panel pad">
            <h3 class="card-title">${esc(t("plan.commitments"))}</h3>
            <p class="hint">${esc(t("plan.commitmentsHelp"))}</p>
            <ul class="plain-list">${state.events.map((event) => `<li>${esc(event.title)} · ${esc(event.repeat === "weekly" ? app.i18n.weekdayName(event.day) : app.i18n.formatDate(event.date))} ${esc(event.start)}–${esc(event.end)} <button type="button" class="text-button" data-delete-event="${esc(event.id)}">${esc(t("action.delete"))}</button></li>`).join("") || `<li class="muted-text">${esc(t("plan.noCommitments"))}</li>`}</ul>
            <form class="form-grid" data-form="event">
              <label class="field"><span>${esc(t("field.title"))}</span><input name="title" required maxlength="80"></label>
              <label class="field"><span>${esc(t("plan.repeat"))}</span><select name="repeat">${option("once", t("plan.once"), true)}${option("weekly", t("plan.weekly"))}</select></label>
              <label class="field"><span>${esc(t("plan.date"))}</span><input type="date" name="date"></label>
              <label class="field"><span>${esc(t("plan.weekday"))}</span><select name="day">${weekdays.map((day) => option(day, app.i18n.weekdayName(day))).join("")}</select></label>
              <label class="field"><span>${esc(t("plan.start"))}</span><input type="time" name="start" required></label>
              <label class="field"><span>${esc(t("plan.end"))}</span><input type="time" name="end" required></label>
              <button type="submit" class="ghost-button">${esc(t("plan.addCommitment"))}</button>
            </form>
          </section>
        </aside>
      </div>`;
  }

  function updateSession(id, mutate) {
    store().update((state) => {
      const session = state.plannedSessions.find((item) => item.id === id);
      if (session) mutate(session);
    }, "planner");
  }

  function init() {
    root().addEventListener("click", async (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      if (button.dataset.action === "regenerate") regenerate();
      else if (button.dataset.action === "approve-all") {
        store().update((state) => { state.plannedSessions.forEach((session) => { if (session.status === "suggested") session.status = "approved"; }); }, "planner");
      } else if (button.dataset.approve) updateSession(button.dataset.approve, (session) => { session.status = "approved"; });
      else if (button.dataset.skip) updateSession(button.dataset.skip, (session) => { session.status = "skipped"; });
      else if (button.dataset.deleteSession) {
        store().update((state) => { state.plannedSessions = state.plannedSessions.filter((session) => session.id !== button.dataset.deleteSession); }, "planner");
      } else if (button.dataset.deleteEvent) {
        if (await app.dom.confirmDialog(t("plan.deleteEventConfirm"))) {
          store().update((state) => { state.events = state.events.filter((item) => item.id !== button.dataset.deleteEvent); }, "planner");
        }
      } else if (button.dataset.focusTask) {
        if (app.focusTimer.startForTask(button.dataset.focusTask)) app.shell.navigate("focus");
      } else if (button.dataset.openTask) app.taskDialog.open(button.dataset.openTask);
    });

    root().addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.target;
      const data = Object.fromEntries(new FormData(form));
      if (form.dataset.sessionForm) {
        const day = app.scheduler.parseLocalDate(data.date);
        const start = app.scheduler.parseTime(data.start);
        const end = app.scheduler.parseTime(data.end);
        if (day == null || start == null || end == null || end <= start) { app.dom.toast(t("error.timeRange"), "error"); return; }
        // A manual edit pins the session: regeneration will not move it.
        updateSession(form.dataset.sessionForm, (session) => {
          session.start = new Date(day + start * 60000).toISOString();
          session.end = new Date(day + end * 60000).toISOString();
          session.minutes = end - start;
          session.status = session.status === "skipped" ? "approved" : session.status === "suggested" ? "approved" : session.status;
          session.edited = true;
        });
      } else if (form.dataset.form === "event") {
        const start = app.scheduler.parseTime(data.start);
        const end = app.scheduler.parseTime(data.end);
        if (start == null || end == null || end <= start) { app.dom.toast(t("error.timeRange"), "error"); return; }
        if (data.repeat === "once" && !data.date) { app.dom.toast(t("error.dateRequired"), "error"); return; }
        store().update((state) => {
          state.events.push({ id: app.store.createId("event"), title: data.title.trim(), repeat: data.repeat, date: data.repeat === "once" ? data.date : "", day: Number(data.day), start: data.start, end: data.end });
        }, "planner");
      }
    });
  }

  app.planner = { buildInput, preview, regenerate };
  (app.views = app.views || {}).plan = { init, render };
})();
