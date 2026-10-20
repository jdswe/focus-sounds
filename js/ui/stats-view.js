// Progress built only from recorded sessions, tasks and reviews. Estimates are labeled as such.
(function () {
  const app = window.StillApp;
  const { esc } = app.dom;
  const t = (key, params) => app.i18n.t(key, params);
  const root = () => document.querySelector('[data-view="stats"]');
  let range = 14;

  function bars(days, goal) {
    const max = Math.max(goal || 0, ...days.map((day) => day.minutes), 1);
    return `<div class="bar-chart" role="img" aria-label="${esc(t("stats.chartAria", { n: days.length }))}">
      ${goal ? `<span class="goal-line" style="bottom:${(goal / max) * 100}%" title="${esc(t("stats.goalLine"))}"></span>` : ""}
      ${days.map((day) => `<div class="bar-col" title="${esc(app.i18n.formatDate(day.date))}: ${esc(app.i18n.formatMinutes(day.minutes))}">
        <span class="bar" style="height:${(day.minutes / max) * 100}%"></span>
        <span class="bar-label">${esc(app.i18n.formatDate(day.date, days.length > 14 ? { day: "numeric" } : { weekday: "narrow", day: "numeric" }))}</span>
      </div>`).join("")}
    </div>`;
  }

  function render() {
    const state = app.store.app.get();
    const now = Date.now();
    const dayStart = app.insights.dayStart(now);
    const day = 86400000;
    const focus = state.focusSessions.filter((session) => session.kind === "focus");
    const days = app.insights.minutesByDay(state.focusSessions, now, range);
    const goal = state.preferences.dailyGoalMinutes;
    const bySubject = app.insights.minutesBySubject(state.focusSessions, state.tasks);
    const subjects = new Map(state.subjects.map((subject) => [subject.id, subject]));
    const maxSubject = Math.max(1, ...Object.values(bySubject));
    const tracked = app.tasks.trackedMinutesByTask(state.focusSessions);
    const comparison = app.insights.estimateVsActual(state.tasks, tracked);
    const byTask = new Map(state.tasks.map((task) => [task.id, task]));
    const cards = app.srs.summarize(state.cards, now);
    const done = state.tasks.filter((task) => task.status === "done").length;
    const goalDays = days.filter((entry) => entry.minutes >= goal).length;
    const month = new Date(now);
    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1).getTime();

    // Optional comparison of soundscapes using the student's own ratings.
    const soundStats = new Map();
    focus.forEach((session) => {
      const key = (session.sounds || []).slice().sort().join("+") || "silence";
      const entry = soundStats.get(key) || { sessions: 0, minutes: 0, ratings: [] };
      entry.sessions++;
      entry.minutes += session.activeSeconds / 60;
      if (session.rating) entry.ratings.push(session.rating);
      soundStats.set(key, entry);
    });
    const soundLabel = (key) => key === "silence" ? t("stats.silence") : key.split("+").map((kind) => t(`sound.${kind}`)).join(" + ");

    root().innerHTML = `
      <div class="view-header"><div><span class="panel-kicker">${esc(t("stats.kicker"))}</span><h2 class="view-title">${esc(t("stats.title"))}</h2></div>
        <div class="segmented" role="group" aria-label="${esc(t("stats.range"))}">${[7, 14, 30].map((value) => `<button type="button" data-range="${value}" aria-pressed="${value === range}">${esc(t("stats.days", { n: value }))}</button>`).join("")}</div></div>
      <div class="view-grid four">
        <section class="glass-panel pad stat-tile"><span class="panel-kicker">${esc(t("stats.today"))}</span><strong>${esc(app.i18n.formatMinutes(app.insights.totalMinutes(state.focusSessions, dayStart, dayStart + day)))}</strong></section>
        <section class="glass-panel pad stat-tile"><span class="panel-kicker">${esc(t("stats.week"))}</span><strong>${esc(app.i18n.formatMinutes(app.insights.totalMinutes(state.focusSessions, dayStart - 6 * day, dayStart + day)))}</strong></section>
        <section class="glass-panel pad stat-tile"><span class="panel-kicker">${esc(t("stats.month"))}</span><strong>${esc(app.i18n.formatMinutes(app.insights.totalMinutes(state.focusSessions, monthStart, dayStart + day)))}</strong></section>
        <section class="glass-panel pad stat-tile"><span class="panel-kicker">${esc(t("stats.tasks"))}</span><strong>${done} / ${state.tasks.length}</strong><span class="muted-text">${esc(t("stats.completed"))}</span></section>
      </div>
      <div class="view-grid two">
        <section class="glass-panel pad">
          <h3 class="card-title">${esc(t("stats.studyTime"))}</h3>
          ${bars(days, goal)}
          <p class="muted-text">${esc(t("stats.goalDays", { n: goalDays, total: range, goal: app.i18n.formatMinutes(goal) }))}</p>
          <p class="hint">${esc(t("stats.measuredNote"))}</p>
        </section>
        <section class="glass-panel pad">
          <h3 class="card-title">${esc(t("stats.bySubject"))}</h3>
          ${Object.keys(bySubject).length ? `<ul class="hbars">${Object.entries(bySubject).sort((a, b) => b[1] - a[1]).map(([id, minutes]) => {
            const subject = subjects.get(id);
            return `<li><span class="hbar-label">${subject ? app.dom.subjectChip(subject) : esc(t("stats.unassigned"))}</span><span class="hbar"><span style="width:${(minutes / maxSubject) * 100}%;background:${esc(subject?.color || "var(--accent)")}"></span></span><span>${esc(app.i18n.formatMinutes(minutes))}</span></li>`;
          }).join("")}</ul>` : `<p class="muted-text">${esc(t("stats.noSessions"))}</p>`}
        </section>
        <section class="glass-panel pad">
          <h3 class="card-title">${esc(t("stats.estimateVsActual"))}</h3>
          ${comparison.length ? `<table class="data-table"><thead><tr><th>${esc(t("field.title"))}</th><th>${esc(t("stats.estimated"))}</th><th>${esc(t("stats.measured"))}</th></tr></thead><tbody>${comparison.map((row) => `<tr><td>${esc(byTask.get(row.taskId)?.title || "")}</td><td>${esc(app.i18n.formatMinutes(row.estimate))}</td><td>${esc(app.i18n.formatMinutes(row.actual))}</td></tr>`).join("")}</tbody></table>` : `<p class="muted-text">${esc(t("stats.noComparison"))}</p>`}
        </section>
        <section class="glass-panel pad">
          <h3 class="card-title">${esc(t("stats.flashcards"))}</h3>
          <dl class="stat-pairs"><div><dt>${esc(t("cards.total"))}</dt><dd>${cards.total}</dd></div><div><dt>${esc(t("cards.due"))}</dt><dd>${cards.due}</dd></div><div><dt>${esc(t("cards.learned"))}</dt><dd>${cards.learned}</dd></div><div><dt>${esc(t("stats.reviews"))}</dt><dd>${cards.reviews}</dd></div></dl>
          <h3 class="card-title">${esc(t("stats.soundscapes"))}</h3>
          ${soundStats.size ? `<table class="data-table"><thead><tr><th>${esc(t("stats.mix"))}</th><th>${esc(t("stats.sessions"))}</th><th>${esc(t("stats.avgLength"))}</th><th>${esc(t("stats.avgRating"))}</th></tr></thead><tbody>${[...soundStats].map(([key, entry]) => `<tr><td>${esc(soundLabel(key))}</td><td>${entry.sessions}</td><td>${esc(app.i18n.formatMinutes(entry.minutes / entry.sessions))}</td><td>${entry.ratings.length ? (entry.ratings.reduce((a, b) => a + b, 0) / entry.ratings.length).toFixed(1) : "—"}</td></tr>`).join("")}</tbody></table><p class="hint">${esc(t("stats.soundNote"))}</p>` : `<p class="muted-text">${esc(t("stats.noSessions"))}</p>`}
        </section>
      </div>
      <section class="glass-panel pad">
        <h3 class="card-title">${esc(t("stats.history"))}</h3>
        ${state.focusSessions.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>${esc(t("stats.when"))}</th><th>${esc(t("stats.type"))}</th><th>${esc(t("stats.active"))}</th><th>${esc(t("stats.pauses"))}</th><th>${esc(t("stats.interruptions"))}</th><th>${esc(t("field.title"))}</th><th>${esc(t("field.status"))}</th></tr></thead><tbody>
          ${state.focusSessions.slice(-30).reverse().map((session) => `<tr><td>${esc(app.i18n.formatDate(session.startedAt))} ${esc(app.i18n.formatTime(session.startedAt))}</td><td>${esc(t(`timer.kind.${session.kind}`))}</td><td>${esc(app.i18n.formatMinutes(session.activeSeconds / 60))}</td><td>${session.pauses}</td><td>${session.interruptions || 0}</td><td>${esc(byTask.get(session.taskId)?.title || "—")}</td><td>${esc(t(`session.status.${session.status}`))}</td></tr>`).join("")}
        </tbody></table></div>` : `<p class="muted-text">${esc(t("stats.noSessions"))}</p>`}
      </section>`;
  }

  function init() {
    root().addEventListener("click", (event) => {
      const button = event.target.closest("[data-range]");
      if (button) { range = Number(button.dataset.range); render(); }
    });
  }

  (app.views = app.views || {}).stats = { init, render };
})();
