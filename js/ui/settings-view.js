// Preferences, study availability, data backup and account status.
(function () {
  const app = window.StillApp;
  const { esc, option } = app.dom;
  const t = (key, params) => app.i18n.t(key, params);
  const root = () => document.querySelector('[data-view="settings"]');
  const store = () => app.store.app;
  const SOURCE = "settings";

  function windowRow(day, entry) {
    return `<div class="schedule-row" data-day="${day}"><input type="time" name="start" value="${esc(entry.start)}" aria-label="${esc(t("plan.start"))}"><input type="time" name="end" value="${esc(entry.end)}" aria-label="${esc(t("plan.end"))}"><button type="button" class="text-button" data-remove-window aria-label="${esc(t("action.delete"))}">×</button></div>`;
  }

  function number(name, value, min, max, step) {
    return `<input type="number" name="${name}" value="${esc(value)}" min="${min}" max="${max}" step="${step || 1}" required>`;
  }

  function render() {
    const prefs = store().get().preferences;
    const days = [1, 2, 3, 4, 5, 6, 0];
    const notificationState = "Notification" in window ? Notification.permission : "unsupported";

    root().innerHTML = `
      <div class="view-header"><div><span class="panel-kicker">${esc(t("settings.kicker"))}</span><h2 class="view-title">${esc(t("settings.title"))}</h2></div></div>
      <form class="view-grid two" data-settings-form>
        <section class="glass-panel pad">
          <h3 class="card-title">${esc(t("settings.general"))}</h3>
          <div class="form-grid">
            <label class="field"><span>${esc(t("settings.language"))}</span><select name="locale">${[["en", "English"], ["es", "Español"], ["pt", "Português"]].map(([value, label]) => option(value, label, prefs.locale === value)).join("")}</select></label>
            <label class="field"><span>${esc(t("settings.appearance"))}</span><select name="appearance">${["system", "light", "dark"].map((value) => option(value, t(`settings.appearance.${value}`), prefs.appearance === value)).join("")}</select></label>
            <label class="field"><span>${esc(t("settings.dailyGoal"))}</span>${number("dailyGoalMinutes", prefs.dailyGoalMinutes, 0, 960, 5)}</label>
            <label class="check-row span-2"><input type="checkbox" name="motivation" ${prefs.motivation ? "checked" : ""}> ${esc(t("settings.motivation"))}</label>
            <label class="check-row span-2"><input type="checkbox" name="notifications" ${prefs.notifications ? "checked" : ""}> ${esc(t("settings.notifications"))} <span class="muted-text">(${esc(t(`settings.permission.${notificationState}`))})</span></label>
          </div>
          <p class="hint">${esc(t("settings.themeHint"))}</p>
        </section>
        <section class="glass-panel pad">
          <h3 class="card-title">${esc(t("settings.timer"))}</h3>
          <div class="form-grid">
            <label class="field"><span>${esc(t("settings.focusMinutes"))}</span>${number("focusMinutes", prefs.focusMinutes, 1, 180)}</label>
            <label class="field"><span>${esc(t("settings.shortBreak"))}</span>${number("shortBreakMinutes", prefs.shortBreakMinutes, 1, 60)}</label>
            <label class="field"><span>${esc(t("settings.longBreak"))}</span>${number("longBreakMinutes", prefs.longBreakMinutes, 1, 90)}</label>
            <label class="field"><span>${esc(t("settings.longBreakEvery"))}</span>${number("longBreakEvery", prefs.longBreakEvery, 1, 12)}</label>
            <label class="check-row span-2"><input type="checkbox" name="autoStartBreaks" ${prefs.autoStartBreaks ? "checked" : ""}> ${esc(t("settings.autoBreaks"))}</label>
          </div>
          <p class="hint">${esc(t("settings.timerRule"))}</p>
        </section>
        <section class="glass-panel pad">
          <h3 class="card-title">${esc(t("settings.availability"))}</h3>
          <p class="hint">${esc(t("settings.availabilityHelp"))}</p>
          ${days.map((day) => `<div class="availability-day"><strong>${esc(app.i18n.weekdayName(day))}</strong><div data-windows="${day}">${(prefs.availability[day] || []).map((entry) => windowRow(day, entry)).join("")}</div><button type="button" class="small-button ghost" data-add-window="${day}">${esc(t("settings.addWindow"))}</button></div>`).join("")}
        </section>
        <section class="glass-panel pad">
          <h3 class="card-title">${esc(t("settings.planner"))}</h3>
          <div class="form-grid">
            <label class="field"><span>${esc(t("settings.maxSession"))}</span>${number("maxSessionMinutes", prefs.maxSessionMinutes, 15, 240, 5)}</label>
            <label class="field"><span>${esc(t("settings.minSession"))}</span>${number("minSessionMinutes", prefs.minSessionMinutes, 5, 120, 5)}</label>
            <label class="field"><span>${esc(t("settings.breakBetween"))}</span>${number("breakBetweenSessionsMinutes", prefs.breakBetweenSessionsMinutes, 0, 60, 5)}</label>
            <label class="field"><span>${esc(t("settings.perTaskDay"))}</span>${number("maxTaskMinutesPerDay", prefs.maxTaskMinutesPerDay, 15, 600, 15)}</label>
            <label class="field"><span>${esc(t("settings.horizon"))}</span>${number("planningHorizonDays", prefs.planningHorizonDays, 3, 120)}</label>
          </div>
          <div class="dialog-actions"><button type="submit" class="primary-button">${esc(t("settings.save"))}</button></div>
        </section>
      </form>
      <div class="view-grid two">
        <section class="glass-panel pad">
          <h3 class="card-title">${esc(t("settings.data"))}</h3>
          <p>${esc(t("settings.dataHelp"))}</p>
          <div class="button-row">
            <button type="button" class="ghost-button" data-action="export">${esc(t("settings.export"))}</button>
            <label class="ghost-button file-button">${esc(t("settings.import"))}<input type="file" accept="application/json,.json" data-import-backup hidden></label>
          </div>
        </section>
        <section class="glass-panel pad">
          <h3 class="card-title">${esc(t("settings.account"))}</h3>
          <p><strong>${esc(t("settings.guest"))}</strong></p>
          <p>${esc(t("settings.guestHelp"))}</p>
          <p class="hint">${esc(t("settings.googleStatus"))}</p>
        </section>
      </div>`;
  }

  function init() {
    root().addEventListener("click", async (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      if (button.dataset.addWindow) root().querySelector(`[data-windows="${button.dataset.addWindow}"]`).insertAdjacentHTML("beforeend", windowRow(button.dataset.addWindow, { start: "18:00", end: "20:00" }));
      else if (button.dataset.removeWindow != null) button.closest(".schedule-row").remove();
      else if (button.dataset.action === "export") {
        app.dom.download(`focus-sounds-backup-${app.scheduler.formatLocalDate(Date.now())}.json`, store().exportJson());
      }
    });
    root().addEventListener("change", async (event) => {
      if (event.target.matches("[data-import-backup]")) {
        const file = event.target.files[0];
        if (!file) return;
        if (!(await app.dom.confirmDialog(t("settings.importConfirm"), t("settings.import")))) return;
        try {
          store().importJson(await file.text());
          app.dom.toast(t("settings.imported"), "success");
        } catch (error) {
          console.error("Backup import failed:", error);
          app.dom.toast(t("settings.importFailed"), "error");
        }
      } else if (event.target.name === "notifications" && event.target.checked && "Notification" in window && Notification.permission === "default") {
        await Notification.requestPermission();
      }
    });
    root().addEventListener("submit", (event) => {
      if (!event.target.matches("[data-settings-form]")) return;
      event.preventDefault();
      const form = event.target;
      const data = Object.fromEntries(new FormData(form));
      const availability = {};
      let invalid = false;
      form.querySelectorAll("[data-windows]").forEach((container) => {
        availability[container.dataset.windows] = [...container.querySelectorAll(".schedule-row")].map((row) => ({
          start: row.querySelector('[name="start"]').value,
          end: row.querySelector('[name="end"]').value
        })).filter((entry) => {
          if (!entry.start || !entry.end) return false;
          if (entry.end <= entry.start) invalid = true;
          return true;
        });
      });
      if (invalid) { app.dom.toast(t("error.timeRange"), "error"); return; }
      if (Number(data.minSessionMinutes) > Number(data.maxSessionMinutes)) { app.dom.toast(t("error.sessionRange"), "error"); return; }
      const numbers = ["dailyGoalMinutes", "focusMinutes", "shortBreakMinutes", "longBreakMinutes", "longBreakEvery", "maxSessionMinutes", "minSessionMinutes", "breakBetweenSessionsMinutes", "maxTaskMinutesPerDay", "planningHorizonDays"];
      store().update((state) => {
        numbers.forEach((name) => { state.preferences[name] = Number(data[name]); });
        state.preferences.locale = data.locale;
        state.preferences.appearance = data.appearance;
        state.preferences.motivation = Boolean(data.motivation);
        state.preferences.notifications = Boolean(data.notifications);
        state.preferences.autoStartBreaks = Boolean(data.autoStartBreaks);
        state.preferences.availability = availability;
      }, SOURCE);
      app.dom.toast(t("settings.saved"), "success");
      render();
    });
  }

  (app.views = app.views || {}).settings = { init, render, ownSource: SOURCE };
})();
