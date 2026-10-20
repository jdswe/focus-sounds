// Home dashboard: what is due, what to study next, and progress — all from saved data.
(function () {
  const app = window.StillApp;
  const { esc } = app.dom;
  const t = (key, params) => app.i18n.t(key, params);
  const root = () => document.querySelector('[data-view="today"]');
  let motivation = null;
  let motivationLocale = null;

  // One message per visit (not per re-render), refreshed when the language changes.
  function motivationText() {
    if (motivation == null || motivationLocale !== app.i18n.getLocale()) {
      motivation = app.shell.nextMotivation();
      motivationLocale = app.i18n.getLocale();
    }
    return motivation;
  }

  function relativeDue(task) {
    const days = app.insights.daysUntil(task.dueDate, Date.now());
    if (days == null) return t("task.noDate");
    if (days < 0) return t("due.overdue", { n: -days });
    if (days === 0) return t("due.today");
    if (days === 1) return t("due.tomorrow");
    return t("due.inDays", { n: days });
  }

  function taskLine(task, subjects, extra) {
    return `<li class="task-line">
      <span class="task-line-main">${app.dom.subjectChip(subjects.get(task.subjectId))}<button type="button" class="text-button task-title" data-open-task="${esc(task.id)}">${esc(task.title)}</button></span>
      <span class="task-line-meta">${esc(t(`kind.${task.kind}`))} · <span class="${app.insights.daysUntil(task.dueDate, Date.now()) < 0 ? "warn-text" : ""}">${esc(relativeDue(task))}</span>${extra || ""}</span>
    </li>`;
  }

  function render() {
    const state = app.store.app.get();
    const now = Date.now();
    const subjects = new Map(state.subjects.map((subject) => [subject.id, subject]));
    const tracked = app.tasks.trackedMinutesByTask(state.focusSessions);
    const open = state.tasks.filter((task) => task.status !== "done");
    const overdue = open.filter((task) => (app.insights.daysUntil(task.dueDate, now) ?? 1) < 0);
    const upcoming = app.insights.upcomingDeadlines(state.tasks, now, 7);
    const recommendations = app.insights.recommend({ tasks: state.tasks, trackedMinutes: tracked, plannedSessions: state.plannedSessions, now }).slice(0, 3);
    const today = app.insights.localDay(now);
    const todaySessions = state.plannedSessions.filter((session) => app.insights.localDay(new Date(session.start).getTime()) === today && session.status !== "skipped");
    const dayStart = app.insights.dayStart(now);
    const todayMinutes = app.insights.totalMinutes(state.focusSessions, dayStart, dayStart + 86400000);
    const weekMinutes = app.insights.totalMinutes(state.focusSessions, dayStart - 6 * 86400000, dayStart + 86400000);
    const goal = state.preferences.dailyGoalMinutes;
    const doneThisWeek = state.tasks.filter((task) => task.completedAt && new Date(task.completedAt).getTime() >= dayStart - 6 * 86400000).length;
    const dueCards = app.srs.dueCards(state.cards, now).length;
    const plan = app.planner.preview(state, now);
    const byId = new Map(state.tasks.map((task) => [task.id, task]));
    const empty = !state.subjects.length && !state.tasks.length;

    root().innerHTML = `
      <div class="view-header">
        <div><span class="panel-kicker">${esc(app.i18n.formatDate(now, { weekday: "long", month: "long", day: "numeric" }))}</span><h2 class="view-title">${esc(t("today.title"))}</h2></div>
        ${state.preferences.motivation ? `<p class="motivation">${esc(motivationText())}</p>` : ""}
      </div>
      ${empty ? `
        <section class="glass-panel pad empty-state">
          <h3>${esc(t("today.emptyTitle"))}</h3>
          <p>${esc(t("today.emptyBody"))}</p>
          <div class="button-row">
            <a class="primary-button" href="#/import">${esc(t("today.importSyllabus"))}</a>
            <a class="ghost-button" href="#/subjects">${esc(t("today.addSubject"))}</a>
            <a class="ghost-button" href="#/focus">${esc(t("today.justFocus"))}</a>
          </div>
        </section>` : ""}
      <div class="view-grid three">
        <section class="glass-panel pad">
          <span class="panel-kicker">${esc(t("today.q1kicker"))}</span>
          <h3 class="card-title">${esc(t("today.q1"))}</h3>
          ${overdue.length ? `<p class="warn-text">${esc(t("today.overdueCount", { n: overdue.length }))}</p><ul class="task-list">${overdue.slice(0, 4).map((task) => taskLine(task, subjects)).join("")}</ul>` : ""}
          ${upcoming.length ? `<ul class="task-list">${upcoming.slice(0, 6).map((task) => taskLine(task, subjects)).join("")}</ul>` : `<p class="muted-text">${esc(t("today.nothingDue"))}</p>`}
          ${plan.conflicts.length ? `<div class="notice warn" role="note"><strong>${esc(t("plan.conflictsTitle"))}</strong> ${esc(t("today.conflicts", { n: plan.conflicts.length }))} <a href="#/plan">${esc(t("today.reviewPlan"))}</a></div>` : ""}
          <a class="text-link" href="#/tasks">${esc(t("today.allTasks"))}</a>
        </section>

        <section class="glass-panel pad">
          <span class="panel-kicker">${esc(t("today.q2kicker"))}</span>
          <h3 class="card-title">${esc(t("today.q2"))}</h3>
          ${recommendations.length ? `<ol class="recommendations">${recommendations.map((rec) => {
            const task = byId.get(rec.taskId);
            return `<li>
              <div class="task-line-main">${app.dom.subjectChip(subjects.get(task.subjectId))}<strong>${esc(task.title)}</strong></div>
              <p class="reason">${esc(t("today.because"))} ${esc(rec.reasons.map((reason) => t(reason.key, reason.params)).join(" · ") || t("reason.open"))}</p>
              <button type="button" class="small-button" data-focus-task="${esc(task.id)}">${esc(t("today.startFocus"))}</button>
            </li>`;
          }).join("")}</ol><p class="hint">${esc(t("today.suggestionNote"))}</p>` : `<p class="muted-text">${esc(t("today.noRecommendations"))}</p>`}
          ${todaySessions.length ? `<h4 class="subheading">${esc(t("today.plannedToday"))}</h4><ul class="session-list">${todaySessions.map((session) => {
            const task = byId.get(session.taskId);
            return `<li><span>${esc(app.i18n.formatTime(session.start))}–${esc(app.i18n.formatTime(session.end))}</span> <span>${esc(task?.title || t("task.deleted"))}</span> <span class="badge">${esc(t(`plan.status.${session.status}`))}</span></li>`;
          }).join("")}</ul>` : ""}
          ${dueCards ? `<p><a class="text-link" href="#/study/cards">${esc(t("today.cardsDue", { n: dueCards }))}</a></p>` : ""}
        </section>

        <section class="glass-panel pad">
          <span class="panel-kicker">${esc(t("today.q3kicker"))}</span>
          <h3 class="card-title">${esc(t("today.q3"))}</h3>
          <div class="goal-meter" role="img" aria-label="${esc(t("today.goalAria", { done: todayMinutes, goal }))}">
            <div class="goal-bar"><span style="width:${Math.min(100, goal ? (todayMinutes / goal) * 100 : 0)}%"></span></div>
            <span>${esc(t("today.goal", { done: app.i18n.formatMinutes(todayMinutes), goal: app.i18n.formatMinutes(goal) }))}</span>
          </div>
          <dl class="stat-pairs">
            <div><dt>${esc(t("today.week"))}</dt><dd>${esc(app.i18n.formatMinutes(weekMinutes))}</dd></div>
            <div><dt>${esc(t("today.doneWeek"))}</dt><dd>${doneThisWeek}</dd></div>
            <div><dt>${esc(t("today.open"))}</dt><dd>${open.length}</dd></div>
          </dl>
          ${state.subjects.length ? `<ul class="subject-progress">${state.subjects.map((subject) => {
            const progress = app.tasks.subjectProgress(subject.id, state.tasks, state.focusSessions);
            return `<li>${app.dom.subjectChip(subject)}<div class="progress-bar" role="img" aria-label="${esc(t("subjects.progressAria", { percent: progress.percent }))}"><span style="width:${progress.percent}%;background:${esc(subject.color)}"></span></div><span class="muted-text">${progress.done}/${progress.total}</span></li>`;
          }).join("")}</ul>` : ""}
          <p class="hint">${esc(t("today.measuredNote"))}</p>
        </section>
      </div>`;
  }

  function init() {
    root().addEventListener("click", (event) => {
      const focus = event.target.closest("[data-focus-task]");
      const open = event.target.closest("[data-open-task]");
      if (focus && app.focusTimer.startForTask(focus.dataset.focusTask)) app.shell.navigate("focus");
      if (open) app.taskDialog.open(open.dataset.openTask);
    });
  }

  (app.views = app.views || {}).today = { init, render };
})();
