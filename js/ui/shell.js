// Hash routing, language and appearance. Views register with `app.views[name] = { render, ownSource }`.
(function () {
  const app = window.StillApp;
  const ROUTES = ["today", "focus", "tasks", "plan", "subjects", "import", "study", "companion", "stats", "settings"];
  const MOTIVATION_COUNT = 14;
  const MOTIVATION_KEY = "still-motivation-cursor";
  const store = () => app.store.app;
  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  let route = "today";

  app.views = app.views || {};

  function currentRoute() {
    return route;
  }

  function parseRoute() {
    const [name, ...rest] = location.hash.replace(/^#\/?/, "").split("/");
    return { name: ROUTES.includes(name) ? name : "today", params: rest };
  }

  function show() {
    const { name, params } = parseRoute();
    route = name;
    document.querySelectorAll("[data-view]").forEach((view) => { view.hidden = view.dataset.view !== name; });
    document.querySelectorAll("[data-route]").forEach((link) => {
      if (link.dataset.route === name) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    app.views[name]?.render?.(params);
    if (name === "companion") app.companionView.renderPage();
  }

  function applyAppearance() {
    const preference = store().get().preferences.appearance;
    const dark = preference === "dark" || (preference === "system" && darkQuery.matches);
    document.body.dataset.appearance = dark ? "dark" : "light";
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  }

  // Original messages, rotated without repeats until all have been shown.
  function nextMotivation() {
    if (!store().get().preferences.motivation) return "";
    let cursor = 0;
    try { cursor = Number(localStorage.getItem(MOTIVATION_KEY)) || 0; } catch { /* storage unavailable */ }
    const message = app.i18n.t(`motivation.${(cursor % MOTIVATION_COUNT) + 1}`);
    try { localStorage.setItem(MOTIVATION_KEY, String(cursor + 1)); } catch { /* storage unavailable */ }
    return message;
  }

  function renderFocusMotivation() {
    const element = document.querySelector("#focusMotivation");
    if (element) element.textContent = store().get().preferences.motivation ? nextMotivation() : "";
  }

  function navigate(name, params) {
    location.hash = `#/${[name, ...(params || [])].join("/")}`;
  }

  function init() {
    const language = document.querySelector("#languageSelect");
    language.value = store().get().preferences.locale;
    language.addEventListener("change", () => {
      store().update((state) => { state.preferences.locale = language.value; }, "shell");
    });

    let lastLocale = store().get().preferences.locale;
    let lastAppearance = store().get().preferences.appearance;
    store().subscribe((state, source) => {
      if (state.preferences.locale !== lastLocale) {
        lastLocale = state.preferences.locale;
        language.value = lastLocale;
        app.i18n.setLocale(lastLocale);
        show();
        return;
      }
      if (state.preferences.appearance !== lastAppearance) {
        lastAppearance = state.preferences.appearance;
        applyAppearance();
      }
      const view = app.views[route];
      if (view?.render && source !== view.ownSource) view.render(parseRoute().params);
    });

    darkQuery.addEventListener?.("change", applyAppearance);
    window.addEventListener("hashchange", show);
    window.addEventListener("still:storage-error", () => app.dom.toast(app.i18n.t("error.storageFull"), "error"));
    applyAppearance();
    renderFocusMotivation();
    show();
  }

  app.shell = { init, currentRoute, navigate, nextMotivation };
})();
