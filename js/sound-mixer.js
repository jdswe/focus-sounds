(function () {
  const app = window.StillApp;
  const cards = [...document.querySelectorAll(".sound-card")];
  const masterVolume = document.querySelector("#masterVolume");
  const masterVolumeValue = document.querySelector("#masterVolumeValue");
  const mixStatus = document.querySelector("#mixStatus");
  const mixDot = document.querySelector("#mixDot");
  const stopAllButton = document.querySelector("#stopAllSounds");
  const saveButton = document.querySelector("#saveSoundscape");
  const soundscapeList = document.querySelector("#soundscapeList");
  const activeSounds = new Map();
  const pendingSounds = new Set();
  const bufferCache = new Map();
  const VOLUME_KEY = "still-sound-volumes";
  let audioContext;
  let masterGain;

  const t = (key, params) => app.i18n.t(key, params);
  const cardFor = (kind) => cards.find((card) => card.dataset.sound === kind);

  function updateMixStatus() {
    const names = [...activeSounds.keys()].map((kind) => t(`sound.${kind}`));
    mixDot.classList.toggle("playing", names.length > 0);
    mixStatus.textContent = names.length ? t("mixer.mixing", { names: names.join(" + ") }) : t("mixer.silent");
    stopAllButton.disabled = names.length === 0;
    saveButton.disabled = names.length === 0;
  }

  function updateCardState(card) {
    const active = activeSounds.has(card.dataset.sound);
    card.classList.toggle("active", active);
    card.querySelector(".sound-toggle").setAttribute("aria-pressed", String(active));
    card.querySelector(".sound-state").textContent = active ? t("sound.inMix") : t("sound.tapToAdd");
  }

  function saveVolumes() {
    const volumes = { master: Number(masterVolume.value) };
    cards.forEach((card) => { volumes[card.dataset.sound] = Number(card.querySelector(".sound-volume").value); });
    try { localStorage.setItem(VOLUME_KEY, JSON.stringify(volumes)); } catch (error) { console.warn("Could not save sound volumes:", error); }
  }

  function restoreVolumes() {
    try {
      const volumes = JSON.parse(localStorage.getItem(VOLUME_KEY) || "{}");
      if (Number.isFinite(volumes.master)) masterVolume.value = volumes.master;
      cards.forEach((card) => {
        const value = volumes[card.dataset.sound];
        if (Number.isFinite(value)) card.querySelector(".sound-volume").value = value;
      });
    } catch (error) {
      console.warn("Could not read saved sound volumes:", error);
    }
    renderMaster();
  }

  function renderMaster() {
    const volume = Number(masterVolume.value);
    masterVolumeValue.value = `${volume}%`;
    masterVolumeValue.textContent = `${volume}%`;
  }

  async function addSound(card) {
    const kind = card.dataset.sound;
    if (pendingSounds.has(kind) || activeSounds.has(kind)) return;
    pendingSounds.add(kind);
    try {
      audioContext ??= new AudioContext();
      if (audioContext.state === "suspended") await audioContext.resume();

      if (!masterGain) {
        masterGain = audioContext.createGain();
        masterGain.gain.value = Number(masterVolume.value) / 100 * 0.35;
        masterGain.connect(audioContext.destination);
      }

      if (!bufferCache.has(kind)) bufferCache.set(kind, app.audioEngine.createSoundBuffer(audioContext, kind));
      const source = audioContext.createBufferSource();
      const soundGain = audioContext.createGain();
      source.buffer = bufferCache.get(kind);
      source.loop = true;
      soundGain.gain.value = Number(card.querySelector(".sound-volume").value) / 100 * 0.45;
      source.connect(soundGain);
      soundGain.connect(masterGain);
      source.start();

      activeSounds.set(kind, { source, gain: soundGain });
      updateCardState(card);
      updateMixStatus();
    } catch (error) {
      mixStatus.textContent = t("mixer.error");
      console.error("Could not start sound:", error);
    } finally {
      pendingSounds.delete(kind);
    }
  }

  function removeSound(card) {
    const kind = card.dataset.sound;
    const sound = activeSounds.get(kind);
    if (!sound) return;

    sound.source.stop();
    sound.source.disconnect();
    sound.gain.disconnect();
    activeSounds.delete(kind);
    updateCardState(card);
    updateMixStatus();
  }

  function stopAll() {
    cards.forEach((card) => removeSound(card));
  }

  async function playMix(preset) {
    stopAll();
    if (Number.isFinite(preset.master)) {
      masterVolume.value = preset.master;
      masterVolume.dispatchEvent(new Event("input"));
    }
    for (const [kind, volume] of Object.entries(preset.mix || {})) {
      const card = cardFor(kind);
      if (!card) continue;
      card.querySelector(".sound-volume").value = volume;
      await addSound(card);
    }
    saveVolumes();
  }

  function currentMix() {
    const mix = {};
    activeSounds.forEach((sound, kind) => { mix[kind] = Number(cardFor(kind).querySelector(".sound-volume").value); });
    return mix;
  }

  function renderSoundscapes() {
    const { esc } = app.dom;
    const presets = app.store.app.get().soundPresets;
    soundscapeList.innerHTML = presets.length
      ? presets.map((preset) => `<span class="chip"><button type="button" data-play-preset="${esc(preset.id)}">${esc(preset.name)}</button><button type="button" class="chip-remove" data-delete-preset="${esc(preset.id)}" aria-label="${esc(t("mixer.deletePreset", { name: preset.name }))}">×</button></span>`).join("")
      : `<span class="muted-text">${esc(t("mixer.noPresets"))}</span>`;
  }

  function init() {
    restoreVolumes();
    cards.forEach((card) => {
      updateCardState(card);
      card.querySelector(".sound-toggle").addEventListener("click", () => {
        if (pendingSounds.has(card.dataset.sound)) return;
        if (activeSounds.has(card.dataset.sound)) removeSound(card);
        else void addSound(card);
      });

      card.querySelector(".sound-volume").addEventListener("input", (event) => {
        const sound = activeSounds.get(card.dataset.sound);
        if (sound && audioContext) {
          sound.gain.gain.setTargetAtTime(Number(event.currentTarget.value) / 100 * 0.45, audioContext.currentTime, 0.03);
        }
      });
      card.querySelector(".sound-volume").addEventListener("change", saveVolumes);
    });

    masterVolume.addEventListener("input", () => {
      renderMaster();
      if (masterGain && audioContext) {
        masterGain.gain.setTargetAtTime(Number(masterVolume.value) / 100 * 0.35, audioContext.currentTime, 0.03);
      }
    });
    masterVolume.addEventListener("change", saveVolumes);
    stopAllButton.addEventListener("click", stopAll);

    saveButton.addEventListener("click", () => {
      const names = Object.keys(currentMix()).map((kind) => t(`sound.${kind}`));
      const name = window.prompt(t("mixer.presetName"), names.join(" + ").slice(0, 40));
      if (!name || !name.trim()) return;
      app.store.app.update((state) => {
        state.soundPresets.push({ id: app.store.createId("mix"), name: name.trim().slice(0, 40), mix: currentMix(), master: Number(masterVolume.value) });
      }, "mixer");
      app.dom.toast(t("mixer.saved"));
    });

    soundscapeList.addEventListener("click", (event) => {
      const play = event.target.closest("[data-play-preset]");
      const remove = event.target.closest("[data-delete-preset]");
      if (play) {
        const preset = app.store.app.get().soundPresets.find((item) => item.id === play.dataset.playPreset);
        if (preset) void playMix(preset);
      } else if (remove) {
        app.store.app.update((state) => { state.soundPresets = state.soundPresets.filter((item) => item.id !== remove.dataset.deletePreset); }, "mixer");
      }
    });

    app.store.app.subscribe(renderSoundscapes);
    app.i18n.onChange(() => { cards.forEach(updateCardState); updateMixStatus(); renderSoundscapes(); });
    renderSoundscapes();
    updateMixStatus();
  }

  window.StillApp = window.StillApp || {};
  window.StillApp.soundMixer = { init, stopAll, getActiveKinds: () => [...activeSounds.keys()] };
})();
