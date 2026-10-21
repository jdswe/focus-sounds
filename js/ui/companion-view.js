// Companion rendering and customization. Every element with [data-companion-slot] shows the
// same companion, re-rendered whenever the store changes, so equipping an item updates it
// on every screen at once.
(function () {
  const app = window.StillApp;
  const { esc } = app.dom;
  const t = (key, params) => app.i18n.t(key, params);
  const store = () => app.store.app;
  const live = { timerKind: null, timerRunning: false, celebrating: false };
  let previewItem = null;
  let celebrateTimer;

  function counters() {
    return app.insights.progressCounters(store().get());
  }

  function currentLook() {
    const state = store().get();
    // Unknown species (e.g. one removed from the catalog) fall back to the capybara.
    const species = app.companions.getSpecies(state.companion.species).id;
    const equipped = app.companions.sanitizeEquipped(state.companion.equipped[species], species, counters());
    return { species, equipped };
  }

  function animationState() {
    return app.companions.stateFor({ ...live, now: Date.now() });
  }

  function renderEverywhere() {
    const { species, equipped } = currentLook();
    const label = t("companion.ariaLabel", { name: t(`species.${species}.name`) });
    document.querySelectorAll("[data-companion-slot]").forEach((slot) => {
      if (slot.dataset.companionSlot === "preview") return;
      slot.innerHTML = app.companionArt.render(species, equipped, { state: animationState(), label });
    });
    document.querySelectorAll(".companion-name").forEach((element) => { element.textContent = t(`species.${species}.name`); });
  }

  function setAnimationState() {
    const state = animationState();
    document.querySelectorAll("svg.companion").forEach((svg) => { svg.dataset.state = state; });
  }

  function celebrate() {
    live.celebrating = true;
    setAnimationState();
    window.clearTimeout(celebrateTimer);
    celebrateTimer = window.setTimeout(() => { live.celebrating = false; setAnimationState(); }, 2600);
  }

  function requirementText(item) {
    if (!item.unlock) return t("companion.starter");
    return t(`unlock.${item.unlock.metric}`, { n: item.unlock.count });
  }

  function progressText(item, values) {
    if (!item.unlock) return "";
    return t("companion.progress", { current: Math.min(values[item.unlock.metric] || 0, item.unlock.count), total: item.unlock.count });
  }

  function renderPage() {
    const root = document.querySelector('[data-view="companion"]');
    const { species, equipped } = currentLook();
    const values = counters();
    const items = app.companions.itemsFor(species);
    const shown = previewItem ? { ...equipped, [app.companions.getItem(previewItem).slot]: previewItem } : equipped;
    const slots = app.companions.getSpecies(species).slots;

    root.innerHTML = `
      <div class="view-grid companion-layout">
        <section class="glass-panel pad">
          <div class="panel-heading"><div><span class="panel-kicker">${esc(t("companion.collection"))}</span><h2>${esc(t("companion.chooseSpecies"))}</h2></div></div>
          <div class="species-grid">
            ${app.companions.SPECIES.map((entry) => `
              <button type="button" class="species-card" data-species="${entry.id}" aria-pressed="${entry.id === species}">
                <span class="species-art">${app.companionArt.render(entry.id, {}, { state: "idle", label: t(`species.${entry.id}.name`) })}</span>
                <span class="species-name">${esc(t(`species.${entry.id}.name`))}</span>
                <span class="species-country">${esc(t(`country.${entry.country}`))}</span>
              </button>`).join("")}
          </div>
          <p class="hint">${esc(t(`species.${species}.desc`))}</p>
          <p class="hint">${esc(t("companion.culturalNote"))}</p>
        </section>

        <section class="glass-panel pad companion-editor">
          <div class="panel-heading"><div><span class="panel-kicker">${esc(previewItem ? t("companion.previewing") : t("companion.wearing"))}</span><h2>${esc(t(`species.${species}.name`))}</h2></div>
            ${previewItem ? `<button type="button" class="ghost-button" data-action="end-preview">${esc(t("companion.endPreview"))}</button>` : ""}</div>
          <div class="companion-stage large" data-companion-slot="preview">${app.companionArt.render(species, shown, { state: "idle", label: t("companion.ariaLabel", { name: t(`species.${species}.name`) }) })}</div>

          <h3 class="subheading">${esc(t("companion.outfits"))}</h3>
          <div class="chip-list">
            ${app.companions.outfitsFor(species).map((outfit) => `<button type="button" class="chip-button" data-outfit="${outfit.id}">${esc(t(`outfit.${outfit.id}`))}</button>`).join("")}
          </div>

          ${slots.map((slot) => {
            const slotItems = items.filter((item) => item.slot === slot);
            if (!slotItems.length) return "";
            return `<h3 class="subheading">${esc(t(`slot.${slot}`))}${equipped[slot] ? ` <button type="button" class="text-button" data-unequip="${slot}">${esc(t("companion.remove"))}</button>` : ""}</h3>
              <div class="item-grid">${slotItems.map((item) => {
                const unlocked = app.companions.isUnlocked(item, values);
                const worn = equipped[slot] === item.id;
                return `<div class="item-card ${unlocked ? "" : "locked"} ${worn ? "worn" : ""}">
                  <span class="item-art">${app.companionArt.preview(item.id, species)}</span>
                  <span class="item-name">${esc(t(`item.${item.id}`))}</span>
                  <span class="item-meta">${esc(unlocked ? (worn ? t("companion.equipped") : requirementText(item)) : `${t("companion.locked")} · ${requirementText(item)} (${progressText(item, values)})`)}</span>
                  <span class="item-actions">
                    ${unlocked ? `<button type="button" class="small-button" data-equip="${item.id}" ${worn ? "disabled" : ""}>${esc(worn ? t("companion.equipped") : t("companion.equip"))}</button>` : ""}
                    <button type="button" class="small-button ghost" data-preview="${item.id}">${esc(t("companion.preview"))}</button>
                  </span>
                </div>`;
              }).join("")}</div>`;
          }).join("")}
          <p class="hint">${esc(t("companion.rewardsNote"))}</p>
        </section>
      </div>`;
  }

  function updateEquipped(mutate) {
    store().update((state) => {
      const species = state.companion.species;
      state.companion.equipped[species] = mutate(state.companion.equipped[species] || {}, species);
    }, "companion");
  }

  function bindPage() {
    const root = document.querySelector('[data-view="companion"]');
    root.addEventListener("click", (event) => {
      const target = event.target.closest("button");
      if (!target) return;
      const values = counters();
      if (target.dataset.species) {
        previewItem = null;
        store().update((state) => { state.companion.species = target.dataset.species; }, "companion");
      } else if (target.dataset.equip) {
        previewItem = null;
        updateEquipped((equipped, species) => app.companions.equip(equipped, target.dataset.equip, species, values).equipped);
      } else if (target.dataset.unequip) {
        updateEquipped((equipped) => app.companions.unequip(equipped, target.dataset.unequip));
      } else if (target.dataset.outfit) {
        let skipped = [];
        updateEquipped((equipped, species) => {
          const result = app.companions.equipOutfit(equipped, target.dataset.outfit, species, values);
          skipped = result.skipped;
          return result.equipped;
        });
        if (skipped.length) app.dom.toast(t("companion.outfitPartial", { items: skipped.map((id) => t(`item.${id}`)).join(", ") }));
      } else if (target.dataset.preview) {
        previewItem = target.dataset.preview;
        renderPage();
      } else if (target.dataset.action === "end-preview") {
        previewItem = null;
        renderPage();
      }
    });
  }

  // Celebrates items unlocked by real progress, once each.
  function checkUnlocks() {
    const state = store().get();
    const fresh = app.companions.newlyUnlocked(counters(), state.companion.celebratedUnlocks);
    if (!fresh.length) return;
    store().update((draft) => { draft.companion.celebratedUnlocks.push(...fresh); }, "companion-unlock");
    // On a brand-new install there is nothing to celebrate yet; this only fires after progress.
    fresh.forEach((id) => app.dom.toast(t("companion.unlocked", { item: t(`item.${id}`) }), "success"));
    celebrate();
  }

  function init() {
    bindPage();
    app.dom.on("timer:state", (detail) => {
      live.timerKind = detail.kind;
      live.timerRunning = detail.running;
      setAnimationState();
    });
    app.dom.on("task:completed", celebrate);
    app.dom.on("session:completed", celebrate);
    store().subscribe((state, source) => {
      if (source !== "companion-unlock") checkUnlocks();
      renderEverywhere();
      if (app.shell?.currentRoute() === "companion") renderPage();
    });
    app.i18n.onChange(() => { renderEverywhere(); if (app.shell?.currentRoute() === "companion") renderPage(); });
    // Re-evaluate sleep/idle as the clock passes 23:00 and 06:00.
    window.setInterval(setAnimationState, 60 * 1000);
    renderEverywhere();
  }

  app.companionView = { init, renderPage, renderEverywhere, celebrate };
})();
