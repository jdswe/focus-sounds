// Tasks: Kanban board, list and calendar views over the same task records, plus the editor.
(function () {
  const app = window.StillApp;
  const { esc, option } = app.dom;
  const t = (key, params) => app.i18n.t(key, params);
  const root = () => document.querySelector('[data-view="tasks"]');
  const store = () => app.store.app;
  const ui = { mode: "board", subjectId: "", query: "", sort: "due", month: null, selectedDay: null };

  function setStatus(taskId, status) {
    let completed = false;
    store().update((state) => {
      const index = state.tasks.findIndex((task) => task.id === taskId);
      if (index < 0) return;
      completed = status === "done" && state.tasks[index].status !== "done";
      state.tasks[index] = app.tasks.moveTask(state.tasks[index], status, Date.now());
    }, "tasks");
    if (completed) app.dom.emit("task:completed", { taskId });
  }

  function dueLabel(task) {
    if (!task.dueDate) return t("task.noDate");
    return `${app.i18n.formatDate(task.dueDate)}${task.dueTime ? ` ${task.dueTime}` : ""}`;
  }

  function card(task, subjects, tracked) {
    const subject = subjects.get(task.subjectId);
    const days = app.insights.daysUntil(task.dueDate, Date.now());
    const doneSubtasks = task.subtasks.filter((sub) => sub.done).length;
    return `<article class="task-card" draggable="true" data-task-id="${esc(task.id)}" style="--subject:${esc(subject?.color || "transparent")}">
      <div class="task-card-head">${app.dom.subjectChip(subject)}<span class="priority p${task.priority}">${esc(t(`priority.${task.priority}`))}</span></div>
      <button type="button" class="task-card-title" data-open-task="${esc(task.id)}">${esc(task.title)}</button>
      <div class="task-card-meta">
        <span>${esc(t(`kind.${task.kind}`))}</span>
        <span class="${days != null && days < 0 && task.status !== "done" ? "warn-text" : ""}">${esc(dueLabel(task))}</span>
        ${task.estimateMinutes ? `<span title="${esc(t("task.estimateVsTracked"))}">${esc(app.i18n.formatMinutes(tracked[task.id] || 0))} / ${esc(app.i18n.formatMinutes(task.estimateMinutes))}</span>` : ""}
        ${task.subtasks.length ? `<span>☑ ${doneSubtasks}/${task.subtasks.length}</span>` : ""}
        ${task.source?.documentName ? `<span title="${esc(task.source.snippet || "")}">📄 ${esc(t("task.sourcePage", { page: task.source.page }))}</span>` : ""}
      </div>
      <div class="task-card-actions">
        <label class="visually-hidden" for="move-${esc(task.id)}">${esc(t("task.moveTo"))}</label>
        <select id="move-${esc(task.id)}" data-move="${esc(task.id)}">${app.tasks.STATUSES.map((status) => option(status, t(`status.${status}`), status === task.status)).join("")}</select>
        ${task.status !== "done" ? `<button type="button" class="small-button ghost" data-focus-task="${esc(task.id)}">${esc(t("today.startFocus"))}</button>` : ""}
      </div>
    </article>`;
  }

  function renderBoard(tasks, subjects, tracked) {
    return `<div class="kanban">${app.tasks.STATUSES.map((status) => {
      const column = tasks.filter((task) => task.status === status);
      return `<section class="kanban-column" data-drop-status="${status}" aria-label="${esc(t(`status.${status}`))}">
        <h3>${esc(t(`status.${status}`))} <span class="count">${column.length}</span></h3>
        <div class="kanban-cards">${column.map((task) => card(task, subjects, tracked)).join("") || `<p class="muted-text drop-hint">${esc(t("tasks.dropHere"))}</p>`}</div>
      </section>`;
    }).join("")}</div>`;
  }

  function renderList(tasks, subjects, tracked) {
    if (!tasks.length) return `<p class="muted-text">${esc(t("tasks.none"))}</p>`;
    return `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>${esc(t("field.title"))}</th><th>${esc(t("field.subject"))}</th><th>${esc(t("field.kind"))}</th><th>${esc(t("field.due"))}</th><th>${esc(t("field.priority"))}</th><th>${esc(t("field.status"))}</th><th>${esc(t("task.estimateVsTracked"))}</th></tr></thead>
      <tbody>${tasks.map((task) => `<tr>
        <td><button type="button" class="text-button" data-open-task="${esc(task.id)}">${esc(task.title)}</button></td>
        <td>${app.dom.subjectChip(subjects.get(task.subjectId))}</td>
        <td>${esc(t(`kind.${task.kind}`))}</td>
        <td>${esc(dueLabel(task))}</td>
        <td>${esc(t(`priority.${task.priority}`))}</td>
        <td><select data-move="${esc(task.id)}" aria-label="${esc(t("task.moveTo"))}">${app.tasks.STATUSES.map((status) => option(status, t(`status.${status}`), status === task.status)).join("")}</select></td>
        <td>${esc(app.i18n.formatMinutes(tracked[task.id] || 0))}${task.estimateMinutes ? ` / ${esc(app.i18n.formatMinutes(task.estimateMinutes))}` : ""}</td>
      </tr>`).join("")}</tbody></table></div>`;
  }

  function renderCalendar(tasks, subjects, state) {
    const now = new Date();
    ui.month ??= { year: now.getFullYear(), month: now.getMonth() };
    const { year, month } = ui.month;
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7; // weeks start on Monday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) cells.push(app.scheduler.formatLocalDate(new Date(year, month, day).getTime()));
    const today = app.insights.localDay(Date.now());
    const sessionsByDay = new Map();
    state.plannedSessions.filter((session) => session.status !== "skipped").forEach((session) => {
      const key = app.insights.localDay(new Date(session.start).getTime());
      sessionsByDay.set(key, (sessionsByDay.get(key) || 0) + 1);
    });
    const selected = ui.selectedDay || today;
    const selectedTime = app.scheduler.parseLocalDate(selected);
    const weekday = new Date(selectedTime).getDay();
    const classes = state.subjects.flatMap((subject) => (subject.schedule || []).filter((entry) => Number(entry.day) === weekday).map((entry) => ({ ...entry, subject })));
    const events = state.events.filter((event) => (event.repeat === "weekly" ? Number(event.day) === weekday : event.date === selected));
    const daySessions = state.plannedSessions.filter((session) => app.insights.localDay(new Date(session.start).getTime()) === selected && session.status !== "skipped");
    const dayTasks = tasks.filter((task) => task.dueDate === selected);
    const byId = new Map(state.tasks.map((task) => [task.id, task]));

    return `<div class="calendar-toolbar">
        <button type="button" class="ghost-button" data-cal="-1" aria-label="${esc(t("calendar.previous"))}">‹</button>
        <h3>${esc(new Intl.DateTimeFormat(app.i18n.intlLocale(), { month: "long", year: "numeric" }).format(first))}</h3>
        <button type="button" class="ghost-button" data-cal="1" aria-label="${esc(t("calendar.next"))}">›</button>
        <button type="button" class="ghost-button" data-cal="0">${esc(t("calendar.today"))}</button>
      </div>
      <div class="calendar-grid" role="grid">
        ${[1, 2, 3, 4, 5, 6, 0].map((day) => `<div class="calendar-head" role="columnheader">${esc(app.i18n.weekdayName(day, "short"))}</div>`).join("")}
        ${cells.map((date) => {
          if (!date) return `<div class="calendar-cell empty"></div>`;
          const due = tasks.filter((task) => task.dueDate === date);
          const sessions = sessionsByDay.get(date) || 0;
          return `<button type="button" class="calendar-cell ${date === today ? "today" : ""} ${date === selected ? "selected" : ""}" data-day="${date}" aria-label="${esc(app.i18n.formatDate(date, { weekday: "long", month: "long", day: "numeric" }))}">
            <span class="calendar-date">${Number(date.slice(8))}</span>
            ${due.slice(0, 3).map((task) => `<span class="calendar-item" style="--subject:${esc(subjects.get(task.subjectId)?.color || "var(--accent)")}">${esc(task.title)}</span>`).join("")}
            ${due.length > 3 ? `<span class="calendar-more">+${due.length - 3}</span>` : ""}
            ${sessions ? `<span class="calendar-sessions">${esc(t("calendar.sessions", { n: sessions }))}</span>` : ""}
          </button>`;
        }).join("")}
      </div>
      <section class="agenda">
        <h3 class="subheading">${esc(app.i18n.formatDate(selected, { weekday: "long", month: "long", day: "numeric" }))}</h3>
        <ul class="plain-list">
          ${classes.map((entry) => `<li><span class="badge">${esc(t("calendar.class"))}</span> ${esc(entry.start)}–${esc(entry.end)} ${app.dom.subjectChip(entry.subject)}</li>`).join("")}
          ${events.map((event) => `<li><span class="badge">${esc(t("calendar.commitment"))}</span> ${esc(event.start)}–${esc(event.end)} ${esc(event.title)}</li>`).join("")}
          ${daySessions.map((session) => `<li><span class="badge">${esc(t(`plan.status.${session.status}`))}</span> ${esc(app.i18n.formatTime(session.start))}–${esc(app.i18n.formatTime(session.end))} ${esc(byId.get(session.taskId)?.title || "")}</li>`).join("")}
          ${dayTasks.map((task) => `<li><span class="badge">${esc(t("calendar.due"))}</span> ${task.dueTime ? esc(task.dueTime) : ""} ${app.dom.subjectChip(subjects.get(task.subjectId))} <button type="button" class="text-button" data-open-task="${esc(task.id)}">${esc(task.title)}</button></li>`).join("")}
          ${!classes.length && !events.length && !daySessions.length && !dayTasks.length ? `<li class="muted-text">${esc(t("calendar.nothing"))}</li>` : ""}
        </ul>
      </section>`;
  }

  function render() {
    const state = store().get();
    const subjects = new Map(state.subjects.map((subject) => [subject.id, subject]));
    const tracked = app.tasks.trackedMinutesByTask(state.focusSessions);
    const tasks = app.tasks.sortTasks(app.tasks.filterTasks(state.tasks, { subjectId: ui.subjectId, query: ui.query }), ui.sort);
    const focused = document.activeElement?.id === "taskSearch";

    root().innerHTML = `
      <div class="view-header">
        <div><span class="panel-kicker">${esc(t("tasks.kicker"))}</span><h2 class="view-title">${esc(t("tasks.title"))}</h2></div>
        <button type="button" class="primary-button" data-action="new-task">${esc(t("tasks.new"))}</button>
      </div>
      <div class="glass-panel toolbar">
        <div class="segmented" role="group" aria-label="${esc(t("tasks.viewLabel"))}">
          ${["board", "list", "calendar"].map((mode) => `<button type="button" data-mode="${mode}" aria-pressed="${ui.mode === mode}">${esc(t(`tasks.mode.${mode}`))}</button>`).join("")}
        </div>
        <label class="field field-inline"><span>${esc(t("field.subject"))}</span><select data-filter="subject">${option("", t("tasks.allSubjects"), !ui.subjectId)}${state.subjects.map((subject) => option(subject.id, subject.name, subject.id === ui.subjectId)).join("")}</select></label>
        <label class="field field-inline"><span>${esc(t("tasks.sort"))}</span><select data-filter="sort">${["due", "priority", "title"].map((sort) => option(sort, t(`tasks.sort.${sort}`), sort === ui.sort)).join("")}</select></label>
        <label class="field field-inline grow"><span class="visually-hidden">${esc(t("tasks.search"))}</span><input id="taskSearch" type="search" placeholder="${esc(t("tasks.search"))}" value="${esc(ui.query)}"></label>
      </div>
      <div class="glass-panel pad">
        ${ui.mode === "board" ? renderBoard(tasks, subjects, tracked) : ui.mode === "list" ? renderList(tasks, subjects, tracked) : renderCalendar(tasks, subjects, state)}
      </div>`;
    if (focused) {
      const search = root().querySelector("#taskSearch");
      search.focus();
      search.setSelectionRange(search.value.length, search.value.length);
    }
  }

  function init() {
    root().addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      if (button.dataset.action === "new-task") taskDialog.open(null, { subjectId: ui.subjectId });
      else if (button.dataset.mode) { ui.mode = button.dataset.mode; render(); }
      else if (button.dataset.openTask) taskDialog.open(button.dataset.openTask);
      else if (button.dataset.focusTask) { if (app.focusTimer.startForTask(button.dataset.focusTask)) app.shell.navigate("focus"); }
      else if (button.dataset.cal != null) {
        const step = Number(button.dataset.cal);
        const now = new Date();
        if (step === 0) ui.month = { year: now.getFullYear(), month: now.getMonth() };
        else {
          const next = new Date(ui.month.year, ui.month.month + step, 1);
          ui.month = { year: next.getFullYear(), month: next.getMonth() };
        }
        render();
      } else if (button.dataset.day) { ui.selectedDay = button.dataset.day; render(); }
    });
    root().addEventListener("change", (event) => {
      const target = event.target;
      if (target.dataset.move) setStatus(target.dataset.move, target.value);
      else if (target.dataset.filter === "subject") { ui.subjectId = target.value; render(); }
      else if (target.dataset.filter === "sort") { ui.sort = target.value; render(); }
    });
    root().addEventListener("input", app.dom.debounce((event) => {
      if (event.target.id === "taskSearch") { ui.query = event.target.value; render(); }
    }, 200));

    root().addEventListener("dragstart", (event) => {
      const cardElement = event.target.closest("[data-task-id]");
      if (!cardElement) return;
      event.dataTransfer.setData("text/plain", cardElement.dataset.taskId);
      event.dataTransfer.effectAllowed = "move";
      cardElement.classList.add("dragging");
    });
    root().addEventListener("dragend", (event) => event.target.closest?.("[data-task-id]")?.classList.remove("dragging"));
    root().addEventListener("dragover", (event) => {
      const column = event.target.closest("[data-drop-status]");
      if (!column) return;
      event.preventDefault();
      root().querySelectorAll(".drop-target").forEach((element) => element.classList.remove("drop-target"));
      column.classList.add("drop-target");
    });
    root().addEventListener("drop", (event) => {
      const column = event.target.closest("[data-drop-status]");
      if (!column) return;
      event.preventDefault();
      const taskId = event.dataTransfer.getData("text/plain");
      if (taskId) setStatus(taskId, column.dataset.dropStatus);
    });
  }

  // ---------- Task editor dialog ----------
  const taskDialog = {
    open(taskId, defaults) {
      const dialog = document.querySelector("#taskDialog");
      const state = store().get();
      const existing = state.tasks.find((task) => task.id === taskId);
      const task = existing || { title: "", description: "", kind: "assignment", dueDate: "", dueTime: "", priority: 2, status: "todo", estimateMinutes: 60, weight: null, subtasks: [], notes: "", subjectId: defaults?.subjectId || "", ...defaults };
      const doc = task.source?.documentId && state.documents.find((item) => item.id === task.source.documentId);

      dialog.innerHTML = `<form method="dialog" class="task-form" data-task-form="${esc(existing?.id || "")}">
        <h2>${esc(existing ? t("tasks.edit") : t("tasks.new"))}</h2>
        <div class="form-grid">
          <label class="field span-2"><span>${esc(t("field.title"))}</span><input name="title" required maxlength="140" value="${esc(task.title)}"></label>
          <label class="field"><span>${esc(t("field.subject"))}</span><select name="subjectId">${option("", t("subject.none"), !task.subjectId)}${state.subjects.map((subject) => option(subject.id, subject.name, subject.id === task.subjectId)).join("")}</select></label>
          <label class="field"><span>${esc(t("field.kind"))}</span><select name="kind">${app.tasks.KINDS.map((kind) => option(kind, t(`kind.${kind}`), kind === task.kind)).join("")}</select></label>
          <label class="field"><span>${esc(t("field.due"))}</span><input type="date" name="dueDate" value="${esc(task.dueDate)}"></label>
          <label class="field"><span>${esc(t("field.dueTime"))}</span><input type="time" name="dueTime" value="${esc(task.dueTime)}"></label>
          <label class="field"><span>${esc(t("field.priority"))}</span><select name="priority">${[1, 2, 3].map((p) => option(p, t(`priority.${p}`), p === task.priority)).join("")}</select></label>
          <label class="field"><span>${esc(t("field.status"))}</span><select name="status">${app.tasks.STATUSES.map((status) => option(status, t(`status.${status}`), status === task.status)).join("")}</select></label>
          <label class="field"><span>${esc(t("field.estimate"))}</span><input type="number" name="estimateMinutes" min="0" max="6000" step="5" value="${esc(task.estimateMinutes ?? "")}"></label>
          <label class="field"><span>${esc(t("field.weight"))}</span><input type="number" name="weight" min="0" max="100" step="0.5" value="${esc(task.weight ?? "")}"></label>
          <label class="field span-2"><span>${esc(t("field.description"))}</span><textarea name="description" rows="3">${esc(task.description)}</textarea></label>
          <label class="field span-2"><span>${esc(t("field.notes"))}</span><textarea name="notes" rows="2">${esc(task.notes)}</textarea></label>
        </div>
        <fieldset class="subtasks"><legend>${esc(t("field.subtasks"))}</legend>
          <ul data-subtask-list>${task.subtasks.map((sub) => subtaskRow(sub)).join("")}</ul>
          <div class="inline-add"><input data-new-subtask placeholder="${esc(t("tasks.addSubtask"))}" maxlength="120"><button type="button" class="small-button ghost" data-add-subtask>${esc(t("action.add"))}</button></div>
        </fieldset>
        ${task.source ? `<p class="source-ref">📄 ${esc(t("task.source"))}: ${esc(task.source.documentName || doc?.name || "")} · ${esc(t("task.sourcePage", { page: task.source.page }))}${task.source.snippet ? `<br><q>${esc(task.source.snippet)}</q>` : ""}${task.source.originalDue ? `<br>${esc(t("task.originalDue", { date: task.source.originalDue.date, time: task.source.originalDue.time, zone: task.source.originalDue.timeZone }))}` : ""}</p>` : ""}
        <p class="form-error" data-form-error role="alert"></p>
        <div class="dialog-actions">
          ${existing ? `<button type="button" class="ghost-button danger" data-delete-task>${esc(t("action.delete"))}</button>` : ""}
          <span class="spacer"></span>
          <button value="cancel" formnovalidate class="ghost-button">${esc(t("action.cancel"))}</button>
          <button type="submit" value="save" class="primary-button">${esc(t("action.save"))}</button>
        </div>
      </form>`;
      dialog.showModal();
      bindDialog(dialog, existing);
    }
  };

  function subtaskRow(sub) {
    return `<li data-subtask-id="${esc(sub.id)}"><label><input type="checkbox" ${sub.done ? "checked" : ""}> <span>${esc(sub.title)}</span></label><button type="button" class="text-button" data-remove-subtask aria-label="${esc(t("action.delete"))}">×</button></li>`;
  }

  function bindDialog(dialog, existing) {
    const form = dialog.querySelector("form");
    const list = form.querySelector("[data-subtask-list]");
    const addSubtask = () => {
      const input = form.querySelector("[data-new-subtask]");
      if (!input.value.trim()) return;
      list.insertAdjacentHTML("beforeend", subtaskRow({ id: app.store.createId("sub"), title: input.value.trim(), done: false }));
      input.value = "";
      input.focus();
    };
    form.querySelector("[data-add-subtask]").addEventListener("click", addSubtask);
    form.querySelector("[data-new-subtask]").addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); addSubtask(); } });
    list.addEventListener("click", (event) => { if (event.target.closest("[data-remove-subtask]")) event.target.closest("li").remove(); });
    form.querySelector("[data-delete-task]")?.addEventListener("click", async () => {
      dialog.close();
      if (!(await app.dom.confirmDialog(t("tasks.deleteConfirm", { title: existing.title }), t("action.delete")))) return;
      store().update((state) => {
        state.tasks = state.tasks.filter((task) => task.id !== existing.id);
        state.plannedSessions = state.plannedSessions.filter((session) => session.taskId !== existing.id || session.status === "done");
      }, "tasks");
    });

    form.addEventListener("submit", (event) => {
      if (event.submitter?.value !== "save") return;
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      const subtasks = [...list.querySelectorAll("li")].map((li) => ({ id: li.dataset.subtaskId, title: li.querySelector("span").textContent, done: li.querySelector("input").checked }));
      const fields = {
        title: data.title.trim(),
        subjectId: data.subjectId || null,
        kind: data.kind,
        dueDate: data.dueDate,
        dueTime: data.dueTime,
        priority: Number(data.priority),
        status: data.status,
        estimateMinutes: Number(data.estimateMinutes) > 0 ? Math.round(Number(data.estimateMinutes)) : null,
        weight: data.weight === "" ? null : Number(data.weight),
        description: data.description,
        notes: data.notes,
        subtasks
      };
      const errors = app.tasks.validateTask(fields);
      if (errors.length) { form.querySelector("[data-form-error]").textContent = errors.map((code) => t(`error.${code}`)).join(" "); return; }
      let completed = false;
      store().update((state) => {
        if (existing) {
          const index = state.tasks.findIndex((task) => task.id === existing.id);
          if (index < 0) return;
          const moved = app.tasks.moveTask(state.tasks[index], fields.status, Date.now());
          completed = fields.status === "done" && state.tasks[index].status !== "done";
          state.tasks[index] = { ...moved, ...fields, completedAt: moved.completedAt, updatedAt: new Date().toISOString() };
        } else {
          state.tasks.push(app.tasks.createTask(fields, Date.now(), app.store.createId));
          completed = fields.status === "done";
        }
      }, "tasks");
      dialog.close();
      if (completed) app.dom.emit("task:completed");
    });
  }

  app.taskDialog = taskDialog;
  (app.views = app.views || {}).tasks = { init, render };
})();
