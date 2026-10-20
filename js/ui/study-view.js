// Study workspace: notes with autosave, and flashcards with SM-2 review.
(function () {
  const app = window.StillApp;
  const { esc, option } = app.dom;
  const t = (key, params) => app.i18n.t(key, params);
  const root = () => document.querySelector('[data-view="study"]');
  const store = () => app.store.app;
  const SOURCE = "study";
  const ui = { tab: "notes", noteId: null, query: "", subjectId: "", drafts: [], review: null, editingCard: null };

  // ---------- Notes ----------
  const saveNote = app.dom.debounce((noteId, fields) => {
    store().update((state) => {
      const note = state.notes.find((item) => item.id === noteId);
      if (note) Object.assign(note, fields, { updatedAt: new Date().toISOString() });
    }, SOURCE);
    const status = root().querySelector("[data-save-status]");
    if (status) status.textContent = t("notes.saved");
  }, 600);

  function readNoteForm() {
    const form = root().querySelector("[data-note-form]");
    if (!form) return null;
    const data = Object.fromEntries(new FormData(form));
    return {
      title: data.title.trim(),
      body: data.body,
      subjectId: data.subjectId || null,
      taskId: data.taskId || null,
      documentId: data.documentId || null,
      page: data.page ? Number(data.page) : null,
      tags: data.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
    };
  }

  function renderNotes(state) {
    const query = ui.query.toLowerCase();
    const notes = state.notes
      .filter((note) => (!ui.subjectId || note.subjectId === ui.subjectId) && (!query || `${note.title} ${note.body} ${(note.tags || []).join(" ")}`.toLowerCase().includes(query)))
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    const note = state.notes.find((item) => item.id === ui.noteId);
    const subjects = new Map(state.subjects.map((subject) => [subject.id, subject]));
    const doc = note?.documentId && state.documents.find((item) => item.id === note.documentId);
    const pageText = doc && note.page ? doc.pages?.find((page) => page.page === note.page)?.text : "";

    return `<div class="notes-layout">
      <aside class="glass-panel pad notes-list">
        <div class="button-row"><button type="button" class="primary-button" data-action="new-note">${esc(t("notes.new"))}</button></div>
        <label class="field"><span class="visually-hidden">${esc(t("notes.search"))}</span><input type="search" data-notes-search placeholder="${esc(t("notes.search"))}" value="${esc(ui.query)}"></label>
        <label class="field"><span>${esc(t("field.subject"))}</span><select data-notes-subject>${option("", t("tasks.allSubjects"), !ui.subjectId)}${state.subjects.map((subject) => option(subject.id, subject.name, subject.id === ui.subjectId)).join("")}</select></label>
        <ul class="note-items">${notes.map((item) => `<li><button type="button" class="note-item ${item.id === ui.noteId ? "active" : ""}" data-open-note="${esc(item.id)}">
          <strong>${esc(item.title || t("notes.untitled"))}</strong>
          <span class="muted-text">${app.dom.subjectChip(subjects.get(item.subjectId))} ${esc(app.i18n.formatDate(item.updatedAt))}</span>
        </button></li>`).join("") || `<li class="muted-text">${esc(t("notes.none"))}</li>`}</ul>
      </aside>
      <section class="glass-panel pad note-editor">
        ${note ? `<form data-note-form>
          <div class="form-grid">
            <label class="field span-2"><span>${esc(t("field.title"))}</span><input name="title" maxlength="140" value="${esc(note.title)}"></label>
            <label class="field"><span>${esc(t("field.subject"))}</span><select name="subjectId">${option("", t("subject.none"), !note.subjectId)}${state.subjects.map((subject) => option(subject.id, subject.name, subject.id === note.subjectId)).join("")}</select></label>
            <label class="field"><span>${esc(t("notes.task"))}</span><select name="taskId">${option("", t("timer.noTask"), !note.taskId)}${state.tasks.filter((task) => !note.subjectId || task.subjectId === note.subjectId).map((task) => option(task.id, task.title, task.id === note.taskId)).join("")}</select></label>
            <label class="field"><span>${esc(t("notes.document"))}</span><select name="documentId">${option("", "—", !note.documentId)}${state.documents.map((item) => option(item.id, item.name, item.id === note.documentId)).join("")}</select></label>
            <label class="field"><span>${esc(t("notes.page"))}</span><input type="number" name="page" min="1" value="${esc(note.page ?? "")}"></label>
            <label class="field span-2"><span>${esc(t("notes.tags"))}</span><input name="tags" value="${esc((note.tags || []).join(", "))}" placeholder="${esc(t("notes.tagsHint"))}"></label>
            <label class="field span-2"><span>${esc(t("notes.body"))}</span><textarea name="body" rows="14">${esc(note.body)}</textarea></label>
          </div>
          ${pageText ? `<details class="page-ref"><summary>${esc(t("notes.pageText", { name: doc.name, page: note.page }))}</summary><pre>${esc(pageText.slice(0, 4000))}</pre></details>` : ""}
          <div class="dialog-actions">
            <span class="muted-text" data-save-status aria-live="polite">${esc(t("notes.autosave"))}</span>
            <span class="spacer"></span>
            <button type="button" class="ghost-button" data-action="cards-from-note">${esc(t("notes.makeCards"))}</button>
            <button type="button" class="ghost-button danger" data-action="delete-note">${esc(t("action.delete"))}</button>
          </div>
          <p class="hint">${esc(t("notes.cardsHint"))}</p>
        </form>` : `<p class="muted-text">${esc(t("notes.pick"))}</p>`}
      </section>
    </div>`;
  }

  // ---------- Flashcards ----------
  function renderReview(state) {
    const card = state.cards.find((item) => item.id === ui.review.queue[0]);
    if (!card) {
      return `<section class="glass-panel pad review-done"><h3 class="card-title">${esc(t("cards.reviewDone"))}</h3><p>${esc(t("cards.reviewedCount", { n: ui.review.done }))}</p><button type="button" class="primary-button" data-action="end-review">${esc(t("cards.back"))}</button></section>`;
    }
    return `<section class="glass-panel pad flashcard-review" aria-live="polite">
      <p class="muted-text">${esc(t("cards.remaining", { n: ui.review.queue.length }))}</p>
      <div class="flashcard"><p class="flashcard-front">${esc(card.front)}</p>
        ${ui.review.revealed ? `<hr><p class="flashcard-back">${esc(card.back)}</p>` : ""}</div>
      ${ui.review.revealed
        ? `<p>${esc(t("cards.howWell"))}</p><div class="button-row grade-buttons">${["again", "hard", "good", "easy"].map((grade) => `<button type="button" class="small-button ${grade === "good" ? "" : "ghost"}" data-grade="${grade}">${esc(t(`cards.grade.${grade}`))}</button>`).join("")}</div>`
        : `<button type="button" class="primary-button" data-action="reveal">${esc(t("cards.reveal"))}</button>`}
      <button type="button" class="text-button" data-action="end-review">${esc(t("cards.stop"))}</button>
    </section>`;
  }

  function renderCards(state) {
    if (ui.review) return renderReview(state);
    const now = Date.now();
    const cards = state.cards.filter((card) => !ui.subjectId || card.subjectId === ui.subjectId);
    const summary = app.srs.summarize(cards, now);
    const subjects = new Map(state.subjects.map((subject) => [subject.id, subject]));
    const editing = state.cards.find((card) => card.id === ui.editingCard);

    return `<div class="view-grid two-one">
      <section class="glass-panel pad">
        <div class="panel-heading"><div><span class="panel-kicker">${esc(t("cards.kicker"))}</span><h3 class="card-title">${esc(t("cards.title"))}</h3></div>
          <label class="field field-inline"><span>${esc(t("field.subject"))}</span><select data-notes-subject>${option("", t("tasks.allSubjects"), !ui.subjectId)}${state.subjects.map((subject) => option(subject.id, subject.name, subject.id === ui.subjectId)).join("")}</select></label></div>
        <dl class="stat-pairs">
          <div><dt>${esc(t("cards.due"))}</dt><dd>${summary.due}</dd></div>
          <div><dt>${esc(t("cards.new"))}</dt><dd>${summary.newCards}</dd></div>
          <div><dt>${esc(t("cards.learned"))}</dt><dd>${summary.learned}</dd></div>
          <div><dt>${esc(t("cards.total"))}</dt><dd>${summary.total}</dd></div>
        </dl>
        <button type="button" class="primary-button" data-action="start-review" ${summary.due ? "" : "disabled"}>${esc(t("cards.review", { n: summary.due }))}</button>
        ${ui.drafts.length ? `<h4 class="subheading">${esc(t("cards.drafts"))}</h4><p class="hint">${esc(t("cards.draftsHint"))}</p>
          <ul class="draft-list">${ui.drafts.map((draft, index) => `<li data-draft="${index}">
            <label class="field"><span>${esc(t("cards.front"))}</span><input data-draft-field="front" value="${esc(draft.front)}"></label>
            <label class="field"><span>${esc(t("cards.back"))}</span><input data-draft-field="back" value="${esc(draft.back)}"></label>
            ${draft.duplicate ? `<span class="badge warn">${esc(t("cards.duplicate"))}</span>` : ""}
            <button type="button" class="text-button" data-discard-draft="${index}">${esc(t("cards.discard"))}</button>
          </li>`).join("")}</ul>
          <div class="button-row"><button type="button" class="small-button" data-action="accept-drafts">${esc(t("cards.acceptDrafts"))}</button><button type="button" class="small-button ghost" data-action="discard-drafts">${esc(t("cards.discardAll"))}</button></div>` : ""}
        <h4 class="subheading">${esc(t("cards.all"))}</h4>
        <ul class="card-list">${cards.map((card) => `<li>
          <span>${app.dom.subjectChip(subjects.get(card.subjectId))} <strong>${esc(card.front)}</strong> — ${esc(card.back)}</span>
          <span class="muted-text">${esc(card.topic || "")} ${card.srs?.due ? esc(t("cards.nextReview", { date: app.i18n.formatDate(card.srs.due) })) : esc(t("cards.notReviewed"))}${card.generated ? ` · ${esc(t("cards.fromNote"))}` : ""}</span>
          <span><button type="button" class="text-button" data-edit-card="${esc(card.id)}">${esc(t("action.edit"))}</button> <button type="button" class="text-button" data-delete-card="${esc(card.id)}">${esc(t("action.delete"))}</button></span>
        </li>`).join("") || `<li class="muted-text">${esc(t("cards.none"))}</li>`}</ul>
      </section>
      <section class="glass-panel pad">
        <h3 class="card-title">${esc(editing ? t("cards.edit") : t("cards.create"))}</h3>
        <form class="form-grid" data-card-form="${esc(editing?.id || "")}">
          <label class="field span-2"><span>${esc(t("cards.front"))}</span><textarea name="front" rows="2" required maxlength="500">${esc(editing?.front || "")}</textarea></label>
          <label class="field span-2"><span>${esc(t("cards.back"))}</span><textarea name="back" rows="3" required maxlength="1000">${esc(editing?.back || "")}</textarea></label>
          <label class="field"><span>${esc(t("field.subject"))}</span><select name="subjectId">${option("", t("subject.none"), !(editing?.subjectId ?? ui.subjectId))}${state.subjects.map((subject) => option(subject.id, subject.name, subject.id === (editing?.subjectId ?? ui.subjectId))).join("")}</select></label>
          <label class="field"><span>${esc(t("cards.topic"))}</span><input name="topic" maxlength="60" value="${esc(editing?.topic || "")}"></label>
          <p class="form-error span-2" data-form-error role="alert"></p>
          <div class="dialog-actions span-2">${editing ? `<button type="button" class="ghost-button" data-action="cancel-edit">${esc(t("action.cancel"))}</button>` : ""}<button type="submit" class="primary-button">${esc(editing ? t("action.save") : t("cards.add"))}</button></div>
        </form>
        ${editing ? `<p class="hint">${esc(t("cards.editKeepsHistory"))}</p>` : ""}
      </section>
    </div>`;
  }

  function render(params) {
    if (params?.[0] === "cards" || params?.[0] === "notes") ui.tab = params[0];
    const state = store().get();
    root().innerHTML = `
      <div class="view-header"><div><span class="panel-kicker">${esc(t("study.kicker"))}</span><h2 class="view-title">${esc(t("study.title"))}</h2></div>
        <div class="segmented" role="tablist">${["notes", "cards"].map((tab) => `<button type="button" role="tab" data-tab="${tab}" aria-selected="${ui.tab === tab}" aria-pressed="${ui.tab === tab}">${esc(t(`study.tab.${tab}`))}</button>`).join("")}</div></div>
      ${ui.tab === "notes" ? renderNotes(state) : renderCards(state)}`;
  }

  function addCard(state, fields, extra) {
    state.cards.push({ id: app.store.createId("card"), createdAt: new Date().toISOString(), history: [], srs: app.srs.initialState(), ...fields, ...extra });
  }

  function init() {
    root().addEventListener("click", async (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      const action = button.dataset.action;
      const state = store().get();
      if (button.dataset.tab) { ui.tab = button.dataset.tab; ui.review = null; render(); }
      else if (action === "new-note") {
        const id = app.store.createId("note");
        store().update((s) => { s.notes.push({ id, title: "", body: "", subjectId: ui.subjectId || null, tags: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); }, SOURCE);
        ui.noteId = id;
        render();
        root().querySelector('[name="title"]')?.focus();
      } else if (button.dataset.openNote) {
        const fields = readNoteForm();
        if (fields && ui.noteId) saveNote.flush(ui.noteId, fields);
        ui.noteId = button.dataset.openNote;
        render();
      } else if (action === "delete-note") {
        if (!(await app.dom.confirmDialog(t("notes.deleteConfirm"), t("action.delete")))) return;
        store().update((s) => { s.notes = s.notes.filter((note) => note.id !== ui.noteId); }, SOURCE);
        ui.noteId = null;
        render();
      } else if (action === "cards-from-note") {
        const fields = readNoteForm();
        const drafts = app.srs.draftsFromText(fields.body);
        if (!drafts.length) { app.dom.toast(t("notes.noPairs")); return; }
        ui.drafts = drafts.map((draft) => ({ ...draft, subjectId: fields.subjectId, noteId: ui.noteId, duplicate: app.srs.isDuplicate(state.cards, draft.front, fields.subjectId) }));
        ui.tab = "cards";
        render();
      } else if (button.dataset.discardDraft != null) { ui.drafts.splice(Number(button.dataset.discardDraft), 1); render(); }
      else if (action === "discard-drafts") { ui.drafts = []; render(); }
      else if (action === "accept-drafts") {
        let added = 0;
        store().update((s) => {
          ui.drafts.forEach((draft) => {
            if (!draft.front.trim() || !draft.back.trim() || app.srs.isDuplicate(s.cards, draft.front, draft.subjectId)) return;
            addCard(s, { front: draft.front.trim(), back: draft.back.trim(), subjectId: draft.subjectId, topic: "", noteId: draft.noteId }, { generated: true });
            added++;
          });
        }, SOURCE);
        ui.drafts = [];
        app.dom.toast(t("cards.added", { n: added }));
        render();
      } else if (action === "start-review") {
        const due = app.srs.dueCards(state.cards.filter((card) => !ui.subjectId || card.subjectId === ui.subjectId), Date.now());
        ui.review = { queue: due.map((card) => card.id), revealed: false, done: 0 };
        render();
      } else if (action === "reveal") { ui.review.revealed = true; render(); root().querySelector("[data-grade='good']")?.focus(); }
      else if (button.dataset.grade) {
        const id = ui.review.queue.shift();
        const now = Date.now();
        store().update((s) => {
          const card = s.cards.find((item) => item.id === id);
          if (!card) return;
          card.srs = app.srs.review(card.srs, button.dataset.grade, now);
          card.history = [...(card.history || []), { at: new Date(now).toISOString(), grade: button.dataset.grade }];
        }, SOURCE);
        // Forgotten cards come back at the end of this session.
        if (button.dataset.grade === "again") ui.review.queue.push(id);
        ui.review.done++;
        ui.review.revealed = false;
        render();
      } else if (action === "end-review") { ui.review = null; render(); }
      else if (button.dataset.editCard) { ui.editingCard = button.dataset.editCard; render(); }
      else if (action === "cancel-edit") { ui.editingCard = null; render(); }
      else if (button.dataset.deleteCard) {
        if (!(await app.dom.confirmDialog(t("cards.deleteConfirm"), t("action.delete")))) return;
        store().update((s) => { s.cards = s.cards.filter((card) => card.id !== button.dataset.deleteCard); }, SOURCE);
        render();
      }
    });

    root().addEventListener("input", (event) => {
      const target = event.target;
      if (target.closest("[data-note-form]")) {
        const status = root().querySelector("[data-save-status]");
        if (status) status.textContent = t("notes.saving");
        saveNote(ui.noteId, readNoteForm());
      } else if (target.matches("[data-notes-search]")) {
        ui.query = target.value;
        const position = target.selectionStart;
        render();
        const search = root().querySelector("[data-notes-search]");
        search.focus();
        search.setSelectionRange(position, position);
      } else if (target.dataset.draftField) {
        ui.drafts[Number(target.closest("[data-draft]").dataset.draft)][target.dataset.draftField] = target.value;
      }
    });
    root().addEventListener("change", (event) => {
      if (event.target.matches("[data-notes-subject]")) { ui.subjectId = event.target.value; render(); }
      else if (event.target.closest("[data-note-form]") && event.target.tagName === "SELECT") saveNote.flush(ui.noteId, readNoteForm());
    });
    root().addEventListener("submit", (event) => {
      if (!event.target.matches("[data-card-form]")) return;
      event.preventDefault();
      const form = event.target;
      const data = Object.fromEntries(new FormData(form));
      const id = form.dataset.cardForm;
      const fields = { front: data.front.trim(), back: data.back.trim(), subjectId: data.subjectId || null, topic: data.topic.trim() };
      if (app.srs.isDuplicate(store().get().cards, fields.front, fields.subjectId, id || undefined)) {
        form.querySelector("[data-form-error]").textContent = t("cards.duplicate");
        return;
      }
      store().update((s) => {
        const existing = s.cards.find((card) => card.id === id);
        // Editing text keeps the card's review history and schedule.
        if (existing) Object.assign(existing, fields, { updatedAt: new Date().toISOString() });
        else addCard(s, fields);
      }, SOURCE);
      ui.editingCard = null;
      render();
    });
    window.addEventListener("pagehide", () => { const fields = readNoteForm(); if (fields && ui.noteId) saveNote.flush(ui.noteId, fields); });
  }

  (app.views = app.views || {}).study = { init, render, ownSource: SOURCE };
})();
