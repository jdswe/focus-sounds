// Syllabus import: paste text or pick a PDF/TXT → extract → review every item → create records.
// Nothing is created until the student confirms. Deadlines keep the document's original
// date/time and time zone, and are converted to the student's own time zone on import.
(function () {
  const app = window.StillApp;
  const { esc, option } = app.dom;
  const t = (key, params) => app.i18n.t(key, params);
  const root = () => document.querySelector('[data-view="import"]');
  const store = () => app.store.app;
  const MAX_FILE_BYTES = 15 * 1024 * 1024;
  const MAX_STORED_CHARS = 300000;
  const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
  const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const SUGGESTED_ESTIMATES = { exam: 360, project: 480, presentation: 180, assignment: 180, reading: 90, other: 60 };

  let draft = null;
  let busy = false;

  const localZone = () => app.timezones.localTimeZone();

  function supportedZone(zone) {
    return app.timezones.PRESETS.some((entry) => entry.id === zone) ? zone : "America/La_Paz";
  }

  function freshDraft() {
    const prefs = store().get().preferences;
    return {
      step: "source",
      text: "",
      docName: "",
      size: 0,
      sourceKind: "paste",
      pages: [],
      subjectChoice: "new",
      referenceDate: app.scheduler.formatLocalDate(Date.now()),
      dayFirst: app.i18n.getLocale() !== "en",
      timeZone: supportedZone(prefs.importTimeZone),
      defaultTime: prefs.importDefaultTime || "",
      error: ""
    };
  }

  // ---------- Text extraction ----------
  let pdfjsPromise;
  function loadPdfJs() {
    pdfjsPromise ??= new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = PDFJS;
      script.crossOrigin = "anonymous";
      script.referrerPolicy = "no-referrer";
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
        resolve(window.pdfjsLib);
      };
      script.onerror = () => { pdfjsPromise = null; reject(new Error("pdf.js could not be loaded")); };
      document.head.append(script);
    });
    return pdfjsPromise;
  }

  // Rebuilds visual lines from positioned text items (rows of a table stay on one line).
  async function extractPdf(file) {
    const pdfjs = await loadPdfJs();
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const content = await (await pdf.getPage(number)).getTextContent();
      const rows = [];
      content.items.forEach((item) => {
        if (!item.str?.trim()) return;
        const y = item.transform[5];
        const x = item.transform[4];
        let row = rows.find((candidate) => Math.abs(candidate.y - y) < 3);
        if (!row) { row = { y, parts: [] }; rows.push(row); }
        row.parts.push({ x, text: item.str });
      });
      rows.sort((a, b) => b.y - a.y);
      pages.push({ page: number, text: rows.map((row) => row.parts.sort((a, b) => a.x - b.x).map((part) => part.text).join(" ")).join("\n") });
    }
    return pages;
  }

  function splitPlainText(text) {
    // Form feeds mark page breaks in text exported from PDFs.
    return String(text).split("\f").map((page, index) => ({ page: index + 1, text: page }));
  }

  // ---------- Review helpers ----------
  function convertedDue(item) {
    if (!item.dueDate) return null;
    const time = item.dueTime || draft.defaultTime;
    if (!time) return { date: item.dueDate, time: "", converted: false };
    const result = app.timezones.convert(item.dueDate, time, draft.timeZone, localZone());
    return result ? { date: result.date, time: result.time, converted: draft.timeZone !== localZone(), dayShift: result.dayShift, assumedTime: !item.dueTime } : null;
  }

  // Weekly class times are written in the document's zone too; convert them using a date in
  // the semester (DST can differ per week, so the semester start is used as reference).
  function convertWeekly(entry) {
    const reference = app.scheduler.parseLocalDate(draft.referenceDate) ?? Date.now();
    const offset = (Number(entry.day) - new Date(reference).getDay() + 7) % 7;
    const date = app.scheduler.formatLocalDate(app.scheduler.addDays(reference, offset));
    const start = app.timezones.convert(date, entry.start, draft.timeZone, localZone());
    const end = app.timezones.convert(date, entry.end, draft.timeZone, localZone());
    if (!start || !end) return { day: Number(entry.day), start: entry.start, end: entry.end };
    const localDay = new Date(app.scheduler.parseLocalDate(start.date)).getDay();
    // A class that crosses midnight after conversion is kept on its starting day, ending at 24:00.
    return { day: localDay, start: start.time, end: end.date === start.date ? end.time : "24:00" };
  }

  function zoneLabel(zone) {
    const preset = app.timezones.PRESETS.find((entry) => entry.id === zone);
    return preset ? preset.label : `${zone} (${app.timezones.offsetLabel(zone)})`;
  }

  function dueLine(item) {
    const due = convertedDue(item);
    if (!due) return `<span class="warn-text">${esc(t("import.noDate"))}</span>`;
    if (!due.time) return `<span>${esc(t("import.dateOnly", { date: app.i18n.formatDate(item.dueDate, { weekday: "short", year: "numeric", month: "short", day: "numeric" }) }))}</span>`;
    const original = `${app.i18n.formatDate(item.dueDate, { weekday: "short", month: "short", day: "numeric" })} ${item.dueTime || draft.defaultTime}`;
    const local = `${app.i18n.formatDate(due.date, { weekday: "short", month: "short", day: "numeric" })} ${due.time}`;
    return `<span class="tz-pair">
      <span><span class="muted-text">${esc(t("import.originalTime"))}</span> ${esc(original)} · ${esc(zoneLabel(draft.timeZone))}</span>
      <span><span class="muted-text">${esc(t("import.yourTime"))}</span> <strong>${esc(local)}</strong> · ${esc(localZone())} (${esc(app.timezones.offsetLabel(localZone()))})${due.dayShift ? ` <span class="badge warn">${esc(t("import.dayShift", { n: due.dayShift > 0 ? `+${due.dayShift}` : due.dayShift }))}</span>` : ""}</span>
      ${due.assumedTime ? `<span class="muted-text">${esc(t("import.assumedTime"))}</span>` : ""}
    </span>`;
  }

  function flagBadges(item) {
    const badges = [];
    if (item.duplicateOf) badges.push(`<span class="badge warn">${esc(t("import.flag.duplicate"))}</span>`);
    if (item.flags.ambiguousDate) badges.push(`<span class="badge warn">${esc(t("import.flag.ambiguous"))}</span>`);
    if (item.flags.inferredYear) badges.push(`<span class="badge">${esc(t("import.flag.inferredYear"))}</span>`);
    if (item.flags.missingDate) badges.push(`<span class="badge warn">${esc(t("import.flag.missingDate"))}</span>`);
    if (item.flags.multipleDates) badges.push(`<span class="badge">${esc(t("import.flag.multipleDates", { dates: item.otherDates.join(", ") }))}</span>`);
    badges.push(`<span class="badge confidence-${item.confidence}">${esc(t(`import.confidence.${item.confidence}`))}</span>`);
    return badges.join(" ");
  }

  function itemCard(item, index) {
    const ambiguous = item.flags.ambiguousDate;
    return `<li class="review-item status-${item.status}" data-index="${index}">
      <div class="review-head">
        <select data-field="status" aria-label="${esc(t("import.decision"))}">${["approved", "rejected", "postponed"].map((status) => option(status, t(`import.status.${status}`), status === item.status)).join("")}</select>
        <span class="review-flags">${flagBadges(item)}</span>
      </div>
      <div class="form-grid compact">
        <label class="field span-2"><span>${esc(t("field.title"))}</span><input data-field="title" value="${esc(item.title)}" maxlength="140"></label>
        <label class="field"><span>${esc(t("field.kind"))}</span><select data-field="kind">${app.tasks.KINDS.map((kind) => option(kind, t(`kind.${kind}`), kind === item.kind)).join("")}</select></label>
        ${ambiguous
          ? `<label class="field"><span>${esc(t("import.chooseDate"))}</span><select data-field="dueDate">${option("", t("import.choose"), !item.dateConfirmed)}${item.dateOptions.map((date) => option(date, app.i18n.formatDate(date, { year: "numeric", month: "long", day: "numeric" }), item.dateConfirmed && date === item.dueDate)).join("")}</select></label>`
          : `<label class="field"><span>${esc(t("field.due"))}</span><input type="date" data-field="dueDate" value="${esc(item.dueDate)}"></label>`}
        <label class="field"><span>${esc(t("import.timeInDocument"))}</span><input type="time" data-field="dueTime" value="${esc(item.dueTime)}"></label>
        <label class="field"><span>${esc(t("field.weight"))}</span><input type="number" data-field="weight" min="0" max="100" step="0.5" value="${esc(item.weight ?? "")}"></label>
        <label class="field"><span>${esc(t("import.estimate"))}</span><input type="number" data-field="estimateMinutes" min="0" step="15" value="${esc(item.estimateMinutes ?? "")}"></label>
      </div>
      <div class="review-due">${dueLine(item)}</div>
      <p class="source-ref">${esc(t("import.sourceRef", { page: item.page, line: item.line }))}: <q>${esc(item.snippet)}</q></p>
      ${item.duplicateOf ? `<p class="warn-text">${esc(t("import.duplicateOf", { title: item.duplicateTitle }))}</p>` : ""}
    </li>`;
  }

  function renderSource(state) {
    return `<form class="glass-panel pad import-form" data-import-source>
      <h3 class="card-title">${esc(t("import.step1"))}</h3>
      <div class="form-grid">
        <label class="field span-2"><span>${esc(t("import.file"))}</span><input type="file" name="file" accept=".pdf,.txt,application/pdf,text/plain"><small class="muted-text">${esc(t("import.fileHelp"))}</small></label>
        <label class="field span-2"><span>${esc(t("import.paste"))}</span><textarea name="text" rows="8" placeholder="${esc(t("import.pastePlaceholder"))}">${esc(draft.text)}</textarea></label>
        <label class="field"><span>${esc(t("import.docName"))}</span><input name="docName" maxlength="120" value="${esc(draft.docName)}" placeholder="${esc(t("import.docNamePlaceholder"))}"></label>
        <label class="field"><span>${esc(t("field.subject"))}</span><select name="subjectChoice">${option("new", t("import.newSubject"), draft.subjectChoice === "new")}${state.subjects.map((subject) => option(subject.id, subject.name, subject.id === draft.subjectChoice)).join("")}</select></label>
        <label class="field"><span>${esc(t("import.referenceDate"))}</span><input type="date" name="referenceDate" value="${esc(draft.referenceDate)}"><small class="muted-text">${esc(t("import.referenceHelp"))}</small></label>
        <label class="field"><span>${esc(t("import.dateOrder"))}</span><select name="dayFirst">${option("1", t("import.dayFirst"), draft.dayFirst)}${option("0", t("import.monthFirst"), !draft.dayFirst)}</select></label>
      </div>
      <fieldset class="tz-fieldset"><legend>${esc(t("import.tzTitle"))}</legend>
        <p class="hint">${esc(t("import.tzHelp", { zone: localZone() }))}</p>
        <div class="form-grid">
          <label class="field"><span>${esc(t("import.sourceZone"))}</span><select name="timeZone">
            ${app.timezones.PRESETS.map((zone) => option(zone.id, zone.label, zone.id === draft.timeZone)).join("")}
          </select></label>
          <label class="field"><span>${esc(t("import.defaultTime"))}</span><input type="time" name="defaultTime" value="${esc(draft.defaultTime)}"><small class="muted-text">${esc(t("import.defaultTimeHelp"))}</small></label>
        </div>
      </fieldset>
      <p class="form-error" role="alert">${esc(draft.error)}</p>
      <div class="dialog-actions"><button type="submit" class="primary-button" ${busy ? "disabled" : ""}>${esc(busy ? t("import.reading") : t("import.extract"))}</button></div>
      <p class="hint">${esc(t("import.privacy"))}</p>
    </form>`;
  }

  function renderReview(state) {
    const approved = draft.items.filter((item) => item.status === "approved").length;
    return `<section class="glass-panel pad">
      <div class="panel-heading"><div><span class="panel-kicker">${esc(t("import.step2"))}</span><h3 class="card-title">${esc(draft.docName)}</h3></div>
        <button type="button" class="ghost-button" data-action="back">${esc(t("import.back"))}</button></div>
      <p class="hint">${esc(t("import.reviewHelp"))}</p>
      <p class="muted-text">${esc(t("import.tzSummary", { from: zoneLabel(draft.timeZone), to: localZone() }))}</p>
      <div class="form-grid">
        ${draft.subjectChoice === "new" ? `<label class="field"><span>${esc(t("import.subjectName"))}</span><input data-meta="subjectName" value="${esc(draft.subjectName)}" maxlength="100" placeholder="${esc(t("import.subjectNamePlaceholder"))}">
          <small class="muted-text">${esc(draft.result.subjectName ? t("import.foundOnPage", { page: draft.result.subjectName.page }) : t("import.notFound"))}</small></label>
          <label class="field"><span>${esc(t("field.instructor"))}</span><input data-meta="instructor" value="${esc(draft.instructor)}" maxlength="100">
          <small class="muted-text">${esc(draft.result.instructor ? t("import.foundOnPage", { page: draft.result.instructor.page }) : t("import.notFound"))}</small></label>` : `<p>${esc(t("field.subject"))}: ${app.dom.subjectChip(state.subjects.find((subject) => subject.id === draft.subjectChoice))}</p>`}
      </div>
      ${draft.schedules.length ? `<fieldset><legend>${esc(t("import.schedulesFound"))}</legend>${draft.schedules.map((entry, index) => { const local = convertWeekly(entry); const changed = local.day !== entry.day || local.start !== entry.start; return `<label class="check-row"><input type="checkbox" data-schedule="${index}" ${entry.approve ? "checked" : ""}> ${esc(app.i18n.weekdayName(entry.day))} ${esc(entry.start)}–${esc(entry.end)}${changed ? ` → <strong>${esc(app.i18n.weekdayName(local.day))} ${esc(local.start)}–${esc(local.end)}</strong> (${esc(localZone())})` : ""} <span class="muted-text">(${esc(t("task.sourcePage", { page: entry.page }))}: ${esc(entry.snippet)})</span></label>`; }).join("")}<p class="hint">${esc(t("import.scheduleTzNote"))}</p></fieldset>` : ""}
      <div class="button-row">
        <button type="button" class="small-button ghost" data-bulk="all">${esc(t("import.bulk.all"))}</button>
        <button type="button" class="small-button ghost" data-bulk="graded">${esc(t("import.bulk.graded"))}</button>
        <button type="button" class="small-button ghost" data-bulk="major">${esc(t("import.bulk.major"))}</button>
      </div>
      ${draft.items.length ? `<ol class="review-list">${draft.items.map(itemCard).join("")}</ol>` : `<p class="muted-text">${esc(t("import.nothingFound"))}</p>`}
      <p class="form-error" role="alert" data-review-error>${esc(draft.error)}</p>
      <div class="dialog-actions">
        <button type="button" class="ghost-button" data-action="cancel">${esc(t("action.cancel"))}</button>
        <button type="button" class="primary-button" data-action="confirm">${esc(t("import.confirm", { n: approved }))}</button>
      </div>
    </section>`;
  }

  function renderDone() {
    return `<section class="glass-panel pad">
      <h3 class="card-title">${esc(t("import.doneTitle"))}</h3>
      <p>${esc(t("import.doneBody", { created: draft.created, postponed: draft.postponedCount, skipped: draft.skippedCount }))}</p>
      <div class="button-row">
        <button type="button" class="primary-button" data-action="plan">${esc(t("import.generatePlan"))}</button>
        <a class="ghost-button" href="#/tasks">${esc(t("import.openBoard"))}</a>
        <button type="button" class="ghost-button" data-action="again">${esc(t("import.another"))}</button>
      </div>
    </section>`;
  }

  function renderHistory(state) {
    if (!state.documents.length) return "";
    return `<section class="glass-panel pad">
      <h3 class="card-title">${esc(t("import.history"))}</h3>
      <ul class="plain-list">${state.documents.map((doc) => {
        const extraction = state.extractions.find((entry) => entry.documentId === doc.id);
        const postponed = extraction?.items.filter((item) => item.status === "postponed").length || 0;
        const subject = state.subjects.find((entry) => entry.id === doc.subjectId);
        return `<li>📄 <strong>${esc(doc.name)}</strong> · ${app.dom.subjectChip(subject)} · ${esc(app.i18n.formatDate(doc.importedAt))} · ${esc(t("import.pages", { n: doc.pageCount }))}${doc.timeZone ? ` · ${esc(doc.timeZone)}` : ""}
          ${postponed ? `<button type="button" class="small-button ghost" data-reopen="${esc(extraction.id)}">${esc(t("import.reviewPostponed", { n: postponed }))}</button>` : ""}</li>`;
      }).join("")}</ul>
    </section>`;
  }

  function render() {
    draft ??= freshDraft();
    const state = store().get();
    root().innerHTML = `
      <div class="view-header"><div><span class="panel-kicker">${esc(t("import.kicker"))}</span><h2 class="view-title">${esc(t("import.title"))}</h2></div></div>
      ${draft.step === "source" ? renderSource(state) : draft.step === "review" ? renderReview(state) : renderDone()}
      ${renderHistory(state)}`;
  }

  // ---------- Actions ----------
  function prepareItems(result, state, subjectId) {
    const duplicates = app.syllabusParser.findDuplicates(result.items, state.tasks, subjectId);
    const titles = new Map(state.tasks.map((task) => [task.id, task.title]));
    return result.items.map((item) => ({
      ...item,
      status: duplicates[item.id] ? "rejected" : "approved",
      duplicateOf: duplicates[item.id] || null,
      duplicateTitle: titles.get(duplicates[item.id]) || "",
      dateConfirmed: !item.flags.ambiguousDate,
      dueDate: item.flags.ambiguousDate ? "" : item.dueDate,
      estimateMinutes: SUGGESTED_ESTIMATES[item.kind] || 60
    }));
  }

  async function extract(form) {
    const data = Object.fromEntries(new FormData(form));
    const file = form.querySelector('[name="file"]').files[0];
    draft.text = data.text;
    draft.docName = data.docName.trim();
    draft.subjectChoice = data.subjectChoice;
    draft.referenceDate = data.referenceDate || app.scheduler.formatLocalDate(Date.now());
    draft.dayFirst = data.dayFirst === "1";
    draft.timeZone = data.timeZone;
    draft.defaultTime = data.defaultTime;
    draft.error = "";

    if (!app.timezones.isValidTimeZone(draft.timeZone)) { draft.error = t("import.error.zone"); render(); return; }
    if (!file && !draft.text.trim()) { draft.error = t("import.error.empty"); render(); return; }
    if (file && file.size > MAX_FILE_BYTES) { draft.error = t("import.error.size", { mb: 15 }); render(); return; }
    const isPdf = file && (file.type === "application/pdf" || /\.pdf$/i.test(file.name));
    const isText = file && (file.type.startsWith("text/") || /\.txt$/i.test(file.name));
    if (file && !isPdf && !isText) { draft.error = t("import.error.type"); render(); return; }

    busy = true;
    render();
    try {
      if (isPdf) {
        draft.pages = await extractPdf(file);
        draft.sourceKind = "pdf";
      } else if (isText) {
        draft.pages = splitPlainText(await file.text());
        draft.sourceKind = "text-file";
      } else {
        draft.pages = splitPlainText(draft.text);
        draft.sourceKind = "paste";
      }
      draft.docName ||= file?.name || t("import.pastedDoc", { date: app.scheduler.formatLocalDate(Date.now()) });
      draft.size = file?.size || draft.text.length;
      const characters = draft.pages.reduce((sum, page) => sum + page.text.trim().length, 0);
      if (isPdf && characters < 30 * draft.pages.length) {
        draft.error = t("import.error.scanned");
        return;
      }
      draft.fingerprint = app.syllabusParser.fingerprintText(draft.pages.map((page) => page.text).join("\n"));
      const state = store().get();
      const sameDoc = state.documents.find((doc) => doc.fingerprint === draft.fingerprint);
      const result = app.syllabusParser.parseSyllabus(draft.pages, {
        referenceDate: app.scheduler.parseLocalDate(draft.referenceDate),
        dayFirst: draft.dayFirst,
        createId: app.store.createId
      });
      const subjectId = draft.subjectChoice === "new" ? null : draft.subjectChoice;
      draft.result = result;
      draft.subjectName = result.subjectName?.value || "";
      draft.instructor = result.instructor?.value || "";
      draft.schedules = result.schedules.map((entry) => ({ ...entry, approve: true }));
      draft.items = prepareItems(result, state, subjectId);
      draft.step = "review";
      draft.error = sameDoc ? t("import.sameDocument", { name: sameDoc.name }) : "";
      store().update((s) => { s.preferences.importTimeZone = draft.timeZone; s.preferences.importDefaultTime = draft.defaultTime; }, "import");
    } catch (error) {
      console.error("Import failed:", error);
      draft.error = isPdf ? t("import.error.pdf") : t("import.error.generic");
    } finally {
      busy = false;
      render();
    }
  }

  function bulk(mode) {
    draft.items.forEach((item) => {
      if (item.duplicateOf) return;
      if (mode === "all") item.status = "approved";
      else if (mode === "graded") item.status = Number(item.weight) > 0 ? "approved" : "rejected";
      else if (mode === "major") item.status = ["exam", "project"].includes(item.kind) ? "approved" : "rejected";
    });
    render();
  }

  function confirmImport() {
    const approved = draft.items.filter((item) => item.status === "approved");
    const problems = [];
    approved.forEach((item) => {
      if (!item.title.trim()) problems.push(t("import.error.title"));
      if (item.flags.ambiguousDate && !item.dateConfirmed) problems.push(t("import.error.ambiguous", { title: item.title }));
    });
    if (draft.subjectChoice === "new" && !draft.subjectName.trim() && approved.length) problems.push(t("import.error.subject"));
    if (problems.length) { draft.error = [...new Set(problems)].join(" "); render(); return; }

    const now = Date.now();
    const zone = localZone();
    store().update((state) => {
      let subjectId = draft.subjectChoice;
      if (draft.subjectChoice === "new") {
        subjectId = app.store.createId("subject");
        state.subjects.push({ id: subjectId, name: draft.subjectName.trim(), color: app.tasks.nextSubjectColor(state.subjects), instructor: draft.instructor.trim(), periodId: null, topics: [], schedule: [], createdAt: new Date(now).toISOString() });
      }
      const subject = state.subjects.find((entry) => entry.id === subjectId);
      draft.schedules.filter((entry) => entry.approve).map(convertWeekly).forEach((entry) => {
        const exists = (subject.schedule || []).some((s) => Number(s.day) === entry.day && s.start === entry.start && s.end === entry.end);
        if (!exists) subject.schedule = [...(subject.schedule || []), { day: entry.day, start: entry.start, end: entry.end, location: "" }];
      });

      let documentId = draft.reopenDocumentId;
      if (!documentId) {
        documentId = app.store.createId("doc");
        let budget = MAX_STORED_CHARS;
        state.documents.push({
          id: documentId, name: draft.docName, size: draft.size, pageCount: draft.pages.length, importedAt: new Date(now).toISOString(),
          fingerprint: draft.fingerprint, subjectId, source: draft.sourceKind, timeZone: draft.timeZone,
          pages: draft.pages.map((page) => { const text = page.text.slice(0, Math.max(0, budget)); budget -= text.length; return { page: page.page, text }; })
        });
      }

      const existingFingerprints = new Set(state.tasks.map(app.syllabusParser.taskFingerprint));
      let created = 0;
      approved.forEach((item) => {
        const due = convertedDue(item);
        const fingerprint = app.syllabusParser.taskFingerprint({ title: item.title, dueDate: due?.date || "" });
        if (existingFingerprints.has(fingerprint)) return;
        existingFingerprints.add(fingerprint);
        const originalTime = item.dueTime || draft.defaultTime;
        state.tasks.push(app.tasks.createTask({
          subjectId,
          title: item.title.trim(),
          kind: item.kind,
          dueDate: due?.date || "",
          dueTime: due?.time || "",
          weight: item.weight === "" || item.weight == null ? null : Number(item.weight),
          estimateMinutes: item.estimateMinutes,
          status: "todo",
          source: {
            documentId, documentName: draft.docName, page: item.page, line: item.line, snippet: item.snippet, confidence: item.confidence,
            originalDue: item.dueDate && originalTime ? { date: item.dueDate, time: originalTime, timeZone: draft.timeZone, assumedTime: !item.dueTime, convertedTo: zone } : null
          }
        }, now, app.store.createId));
        created++;
      });

      const record = { documentId, createdAt: new Date(now).toISOString(), timeZone: draft.timeZone, items: draft.items.map(({ id, title, kind, dueDate, dueTime, weight, page, line, snippet, status, flags, confidence, dateOptions, otherDates }) => ({ id, title, kind, dueDate, dueTime, weight, page, line, snippet, status, flags, confidence, dateOptions, otherDates })) };
      const previous = state.extractions.find((entry) => entry.id === draft.reopenExtractionId);
      if (previous) {
        // Keep earlier decisions and update only the re-reviewed items.
        record.items.forEach((item) => { const index = previous.items.findIndex((p) => p.id === item.id); if (index >= 0) previous.items[index] = item; });
      } else {
        state.extractions.push({ id: app.store.createId("extract"), ...record });
      }
      draft.created = created;
    }, "import");

    draft.postponedCount = draft.items.filter((item) => item.status === "postponed").length;
    draft.skippedCount = draft.items.filter((item) => item.status === "rejected").length;
    draft.step = "done";
    draft.error = "";
    render();
  }

  function reopen(extractionId) {
    const state = store().get();
    const extraction = state.extractions.find((entry) => entry.id === extractionId);
    const doc = state.documents.find((entry) => entry.id === extraction?.documentId);
    if (!extraction || !doc) return;
    draft = {
      ...freshDraft(),
      step: "review",
      docName: doc.name,
      pages: doc.pages,
      size: doc.size,
      fingerprint: doc.fingerprint,
      sourceKind: doc.source,
      timeZone: supportedZone(extraction.timeZone || doc.timeZone),
      subjectChoice: doc.subjectId,
      reopenDocumentId: doc.id,
      reopenExtractionId: extraction.id,
      result: { subjectName: null, instructor: null },
      schedules: [],
      items: extraction.items.filter((item) => item.status === "postponed").map((item) => ({
        ...item,
        status: "approved",
        dateConfirmed: !item.flags.ambiguousDate,
        dueDate: item.flags.ambiguousDate ? "" : item.dueDate,
        estimateMinutes: SUGGESTED_ESTIMATES[item.kind] || 60
      }))
    };
    render();
  }

  function init() {
    root().addEventListener("submit", (event) => {
      if (!event.target.matches("[data-import-source]")) return;
      event.preventDefault();
      void extract(event.target);
    });
    root().addEventListener("change", (event) => {
      const target = event.target;
      if (target.name === "file" && target.files[0] && !root().querySelector('[name="docName"]').value) {
        root().querySelector('[name="docName"]').value = target.files[0].name;
        return;
      }
      if (target.dataset.schedule != null) { draft.schedules[Number(target.dataset.schedule)].approve = target.checked; return; }
      const card = target.closest("[data-index]");
      if (!card || !target.dataset.field) return;
      const item = draft.items[Number(card.dataset.index)];
      const field = target.dataset.field;
      item[field] = field === "weight" ? (target.value === "" ? null : Number(target.value)) : field === "estimateMinutes" ? (Number(target.value) || null) : target.value;
      if (field === "dueDate" && item.flags.ambiguousDate) item.dateConfirmed = Boolean(target.value);
      if (["status", "dueDate", "dueTime", "kind"].includes(field)) {
        card.outerHTML = itemCard(item, Number(card.dataset.index));
        root().querySelector('[data-action="confirm"]').textContent = t("import.confirm", { n: draft.items.filter((entry) => entry.status === "approved").length });
      }
    });
    root().addEventListener("input", (event) => {
      const meta = event.target.dataset.meta;
      if (meta) draft[meta] = event.target.value;
      const card = event.target.closest("[data-index]");
      if (card && event.target.dataset.field === "title") draft.items[Number(card.dataset.index)].title = event.target.value;
    });
    root().addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      const action = button.dataset.action;
      if (action === "back") { draft.step = "source"; draft.error = ""; render(); }
      else if (action === "cancel" || action === "again") { draft = freshDraft(); render(); }
      else if (action === "confirm") confirmImport();
      else if (action === "plan") { app.planner.regenerate(); app.shell.navigate("plan"); }
      else if (button.dataset.bulk) bulk(button.dataset.bulk);
      else if (button.dataset.reopen) reopen(button.dataset.reopen);
    });
  }

  (app.views = app.views || {}).import = { init, render, ownSource: "import" };
})();
