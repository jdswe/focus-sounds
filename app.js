(function () {
  const app = window.StillApp;

  app.i18n.setLocale(app.store.app.get().preferences.locale);
  app.clock.init();
  app.soundMixer.init();
  app.focusTimer.init();
  app.companionView.init();
  Object.values(app.views).forEach((view) => view.init?.());
  app.shell.init();
})();
