// Subjects with configurable colors, class schedules, topics and academic periods.
(function () {
  const app = window.StillApp;
  const { esc, option } = app.dom;
  const t = (key, params) => app.i18n.t(key, params);
  const root = () => document.querySelector('[data-view="subjects"]');
  const store = () => app.store.app;
  let editingId = null;

  function scheduleRow(entry) {
    const days = [1, 2, 3, 4, 5, 6, 0];
    return `<div class="schedule-row">
      <select name="day" aria-label="${esc(t("plan.weekday"))}">${days.map((day) => option(day, app.i18n.weekdayName(day), Number(entry.day) === day)).join("")}</select>
      <input type="time" name="start" value="${esc(entry.start || "")}" aria-label="${esc(t("plan.start"))}">
      <input type="time" name="end" value="${esc(entry.end || "")}" aria-label="${esc(t("plan.end"))}">
      <input name="location" value="${esc(entry.location || "")}" placeholder="${esc(t("subjects.room"))}" maxlength="40">
      <button type="button" class="text-button" data-remove-row aria-label="${esc(t("action.delete"))}">×</button>
    </div>`;
  }

  function editor(subject, state) {
    return `<form class="glass-panel pad subject-form" data-subject-form="${esc(subject.id || "")}">
      <h3 class="card-title">${esc(subject.id ? t("subjects.edit") : t("subjects.new"))}</h3>
      <div class="form-grid">
        <label class="field span-2"><span>${esc(t("field.name"))}</span><input name="name" required maxlength="100" value="${esc(subject.name || "")}"></label>
        <label class="field"><span>${esc(t("field.color"))}</span><input type="color" name="color" value="${esc(subject.color)}"></label>
        <label class="field"><span>${esc(t("field.instructor"))}</span><input name="instructor" maxlength="100" value="${esc(subject.instructor || "")}"></label>
        <label class="field"><span>${esc(t("field.period"))}</span><select name="periodId">${option("", t("subjects.noPeriod"), !subject.periodId)}${state.periods.map((period) => option(period.id, period.name, period.id === subject.periodId)).join("")}</select></label>
        <label class="field span-2"><span>${esc(t("field.topics"))}</span><textarea name="topics" rows="3" placeholder="${esc(t("subjects.topicsHint"))}">${esc((subject.topics || []).join("\n"))}</textarea></label>
      </div>
      <fieldset><legend>${esc(t("subjects.schedule"))}</legend>
        <div data-schedule-rows>${(subject.schedule || []).map(scheduleRow).join("")}</div>
        <button type="button" class="small-button ghost" data-add-row>${esc(t("subjects.addClass"))}</button>
      </fieldset>
      <p class="form-error" data-form-error role="alert"></p>
      <div class="dialog-actions">
        <button type="button" class="ghost-button" data-cancel>${esc(t("action.cancel"))}</button>
        <button type="submit" class="primary-button">${esc(t("action.save"))}</button>
      </div>
    </form>`;
  }

  function render() {
    const state = store().get();
    const periods = new Map(state.periods.map((period) => [period.id, period]));
    const editing = editingId === "new"
      ? { color: app.tasks.nextSubjectColor(state.subjects), schedule: [] }
      : state.subjects.find((subject) => subject.id === editingId);

    root().innerHTML = `
      <div class="view-header">
        <div><span class="panel-kicker">${esc(t("subjects.kicker"))}</span><h2 class="view-title">${esc(t("subjects.title"))}</h2></div>
        <button type="button" class="primary-button" data-action="new">${esc(t("subjects.new"))}</button>
      </div>
      ${editing ? editor(editing, state) : ""}
      <div class="subject-grid">
        ${state.subjects.map((subject) => {
          const progress = app.tasks.subjectProgress(subject.id, state.tasks, state.focusSessions);
          const docs = state.documents.filter((doc) => doc.subjectId === subject.id);
          const exams = state.tasks.filter((task) => task.subjectId === subject.id && task.kind === "exam" && task.status !== "done");
          const next = app.tasks.sortTasks(state.tasks.filter((task) => task.subjectId === subject.id && task.status !== "done" && task.dueDate), "due")[0];
          return `<article class="glass-panel pad subject-card" style="--subject:${esc(subject.color)}">
            <header>${app.dom.subjectChip(subject)}<span class="muted-text">${esc(periods.get(subject.periodId)?.name || "")}</span></header>
            ${subject.instructor ? `<p>${esc(t("field.instructor"))}: ${esc(subject.instructor)}</p>` : ""}
            ${(subject.schedule || []).length ? `<p class="muted-text">${esc(subject.schedule.map((entry) => `${app.i18n.weekdayName(entry.day, "short")} ${entry.start}–${entry.end}${entry.location ? ` (${entry.location})` : ""}`).join(" · "))}</p>` : ""}
            <div class="progress-bar" role="img" aria-label="${esc(t("subjects.progressAria", { percent: progress.percent }))}"><span style="width:${progress.percent}%;background:${esc(subject.color)}"></span></div>
            <dl class="stat-pairs">
              <div><dt>${esc(t("subjects.tasksDone"))}</dt><dd>${progress.done}/${progress.total}</dd></div>
              <div><dt>${esc(t("subjects.tracked"))}</dt><dd>${esc(app.i18n.formatMinutes(progress.trackedMinutes))}</dd></div>
              <div><dt>${esc(t("subjects.estimated"))}</dt><dd>${esc(app.i18n.formatMinutes(progress.estimateMinutes))}</dd></div>
              ${progress.weightTotal ? `<div><dt>${esc(t("subjects.gradeDone"))}</dt><dd>${progress.weightDone}% / ${progress.weightTotal}%</dd></div>` : ""}
            </dl>
            ${next ? `<p>${esc(t("subjects.next"))}: <button type="button" class="text-button" data-open-task="${esc(next.id)}">${esc(next.title)}</button> · ${esc(app.i18n.formatDate(next.dueDate))}</p>` : ""}
            ${exams.length ? `<p class="muted-text">${esc(t("subjects.examsLeft", { n: exams.length }))}</p>` : ""}
            ${(subject.topics || []).length ? `<details><summary>${esc(t("field.topics"))} (${subject.topics.length})</summary><ul>${subject.topics.map((topic) => `<li>${esc(topic)}</li>`).join("")}</ul></details>` : ""}
            ${docs.length ? `<p class="muted-text">📄 ${esc(docs.map((doc) => doc.name).join(", "))}</p>` : ""}
            <div class="button-row">
              <button type="button" class="small-button ghost" data-edit="${esc(subject.id)}">${esc(t("action.edit"))}</button>
              <button type="button" class="small-button ghost" data-add-task="${esc(subject.id)}">${esc(t("tasks.new"))}</button>
              <button type="button" class="small-button ghost danger" data-delete="${esc(subject.id)}">${esc(t("action.delete"))}</button>
            </div>
          </article>`;
        }).join("") || `<p class="muted-text">${esc(t("subjects.none"))}</p>`}
      </div>

      <section class="glass-panel pad periods">
        <h3 class="card-title">${esc(t("periods.title"))}</h3>
        <ul class="plain-list">${state.periods.map((period) => `<li><strong>${esc(period.name)}</strong> ${esc(period.start ? app.i18n.formatDate(period.start) : "")} – ${esc(period.end ? app.i18n.formatDate(period.end) : "")} <button type="button" class="text-button" data-delete-period="${esc(period.id)}">${esc(t("action.delete"))}</button></li>`).join("") || `<li class="muted-text">${esc(t("periods.none"))}</li>`}</ul>
        <form class="form-grid" data-period-form>
          <label class="field"><span>${esc(t("field.name"))}</span><input name="name" required maxlength="60" placeholder="2026-2"></label>
          <label class="field"><span>${esc(t("periods.start"))}</span><input type="date" name="start"></label>
          <label class="field"><span>${esc(t("periods.end"))}</span><input type="date" name="end"></label>
          <button type="submit" class="ghost-button">${esc(t("periods.add"))}</button>
        </form>
      </section>`;
  }

  function init() {
    root().addEventListener("click", async (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      if (button.dataset.action === "new") { editingId = "new"; render(); }
      else if (button.dataset.edit) { editingId = button.dataset.edit; render(); }
      else if (button.dataset.cancel != null) { editingId = null; render(); }
      else if (button.dataset.addRow != null) button.parentElement.querySelector("[data-schedule-rows]").insertAdjacentHTML("beforeend", scheduleRow({ day: 1 }));
      else if (button.dataset.removeRow != null) button.closest(".schedule-row").remove();
      else if (button.dataset.addTask) app.taskDialog.open(null, { subjectId: button.dataset.addTask });
      else if (button.dataset.openTask) app.taskDialog.open(button.dataset.openTask);
      else if (button.dataset.delete) {
        const subject = store().get().subjects.find((item) => item.id === button.dataset.delete);
        if (!(await app.dom.confirmDialog(t("subjects.deleteConfirm", { name: subject.name }), t("action.delete")))) return;
        store().update((state) => {
          state.subjects = state.subjects.filter((item) => item.id !== subject.id);
          state.tasks.forEach((task) => { if (task.subjectId === subject.id) task.subjectId = null; });
        }, "subjects");
      } else if (button.dataset.deletePeriod) {
        store().update((state) => {
          state.periods = state.periods.filter((period) => period.id !== button.dataset.deletePeriod);
          state.subjects.forEach((subject) => { if (subject.periodId === button.dataset.deletePeriod) subject.periodId = null; });
        }, "subjects");
      }
    });

    root().addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.target;
      if (form.dataset.periodForm != null) {
        const data = Object.fromEntries(new FormData(form));
        if (data.start && data.end && data.end < data.start) { app.dom.toast(t("error.periodRange"), "error"); return; }
        store().update((state) => { state.periods.push({ id: app.store.createId("period"), name: data.name.trim(), start: data.start, end: data.end }); }, "subjects");
        return;
      }
      if (form.dataset.subjectForm == null) return;
      const data = Object.fromEntries(new FormData(form));
      const schedule = [...form.querySelectorAll(".schedule-row")].map((row) => ({
        day: Number(row.querySelector('[name="day"]').value),
        start: row.querySelector('[name="start"]').value,
        end: row.querySelector('[name="end"]').value,
        location: row.querySelector('[name="location"]').value.trim()
      })).filter((entry) => entry.start && entry.end);
      if (schedule.some((entry) => entry.end <= entry.start)) { form.querySelector("[data-form-error]").textContent = t("error.timeRange"); return; }
      const fields = {
        name: data.name.trim(),
        color: data.color,
        instructor: data.instructor.trim(),
        periodId: data.periodId || null,
        topics: data.topics.split("\n").map((line) => line.trim()).filter(Boolean),
        schedule
      };
      store().update((state) => {
        const existing = state.subjects.find((subject) => subject.id === form.dataset.subjectForm);
        if (existing) Object.assign(existing, fields);
        else state.subjects.push({ id: app.store.createId("subject"), createdAt: new Date().toISOString(), ...fields });
      }, "subjects");
      editingId = null;
      render();
    });
  }

  (app.views = app.views || {}).subjects = { init, render, ownSource: "subjects-editor" };
})();
