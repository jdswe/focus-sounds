// Small DOM helpers shared by the views: escaping, toasts, dialogs and an event bus.
(function () {
  const app = window.StillApp;

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }

  function option(value, label, selected) {
    return `<option value="${esc(value)}"${selected ? " selected" : ""}>${esc(label)}</option>`;
  }

  const bus = new EventTarget();
  function emit(name, detail) { bus.dispatchEvent(new CustomEvent(name, { detail })); }
  function on(name, handler) { bus.addEventListener(name, (event) => handler(event.detail)); }

  function toast(message, tone) {
    const region = document.querySelector("#toastRegion");
    if (!region) return;
    const item = document.createElement("div");
    item.className = `toast ${tone ? `toast-${tone}` : ""}`;
    item.textContent = message;
    region.append(item);
    window.setTimeout(() => item.classList.add("leaving"), 4200);
    window.setTimeout(() => item.remove(), 4700);
  }

  // Promise-based confirmation using the shared <dialog>.
  function confirmDialog(message, confirmLabel) {
    const dialog = document.querySelector("#confirmDialog");
    dialog.querySelector("[data-confirm-message]").textContent = message;
    dialog.querySelector("[data-confirm-ok]").textContent = confirmLabel || app.i18n.t("action.confirm");
    dialog.showModal();
    return new Promise((resolve) => {
      dialog.addEventListener("close", () => resolve(dialog.returnValue === "ok"), { once: true });
    });
  }

  function subjectChip(subject) {
    if (!subject) return `<span class="subject-chip subject-none">${esc(app.i18n.t("subject.none"))}</span>`;
    const text = app.tasks.contrastText(subject.color);
    return `<span class="subject-chip" style="--subject:${esc(subject.color)};--subject-ink:${text}">${esc(subject.name)}</span>`;
  }

  function debounce(fn, wait) {
    let timer;
    const wrapped = (...args) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => fn(...args), wait);
    };
    wrapped.flush = (...args) => { window.clearTimeout(timer); fn(...args); };
    return wrapped;
  }

  function download(filename, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type: type || "application/json" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: filename });
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  app.dom = { esc, option, emit, on, toast, confirmDialog, subjectChip, debounce, download };
})();
