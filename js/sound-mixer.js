(function () {
  const cards = [...document.querySelectorAll(".sound-card")];
  const masterVolume = document.querySelector("#masterVolume");
  const masterVolumeValue = document.querySelector("#masterVolumeValue");
  const mixStatus = document.querySelector("#mixStatus");
  const mixDot = document.querySelector("#mixDot");
  const activeSounds = new Map();
  const pendingSounds = new Set();
  let audioContext;
  let masterGain;

  function updateMixStatus() {
    const names = [...activeSounds.keys()].map((kind) =>
      document.querySelector(`[data-sound="${kind}"] .sound-name`).textContent
    );
    mixDot.classList.toggle("playing", names.length > 0);
    mixStatus.textContent = names.length
      ? `Mixing: ${names.join(" + ")}`
      : "Your mix is silent. Tap a sound to begin.";
  }

  async function addSound(card) {
    const kind = card.dataset.sound;
    if (pendingSounds.has(kind)) return;
    pendingSounds.add(kind);
    try {
      audioContext ??= new AudioContext();
      if (audioContext.state === "suspended") await audioContext.resume();

      if (!masterGain) {
        masterGain = audioContext.createGain();
        masterGain.gain.value = Number(masterVolume.value) / 100 * 0.35;
        masterGain.connect(audioContext.destination);
      }

      const source = audioContext.createBufferSource();
      const soundGain = audioContext.createGain();
      source.buffer = window.StillApp.audioEngine.createSoundBuffer(audioContext, kind);
      source.loop = true;
      soundGain.gain.value = Number(card.querySelector(".sound-volume").value) / 100 * 0.45;
      source.connect(soundGain);
      soundGain.connect(masterGain);
      source.start();

      activeSounds.set(kind, { source, gain: soundGain });
      card.classList.add("active");
      card.querySelector(".sound-toggle").setAttribute("aria-pressed", "true");
      card.querySelector(".sound-state").textContent = "In your mix";
      updateMixStatus();
    } catch (error) {
      mixStatus.textContent = "Could not start audio. Check your browser's sound settings and try again.";
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
    card.classList.remove("active");
    card.querySelector(".sound-toggle").setAttribute("aria-pressed", "false");
    card.querySelector(".sound-state").textContent = "Tap to add";
    updateMixStatus();
  }

  function init() {
    cards.forEach((card) => {
      card.querySelector(".sound-toggle").addEventListener("click", () => {
        if (pendingSounds.has(card.dataset.sound)) return;
        if (activeSounds.has(card.dataset.sound)) removeSound(card);
        else void addSound(card);
      });

      card.querySelector(".sound-volume").addEventListener("input", (event) => {
        const sound = activeSounds.get(card.dataset.sound);
        if (sound && audioContext) {
          sound.gain.gain.setTargetAtTime(
            Number(event.currentTarget.value) / 100 * 0.45,
            audioContext.currentTime,
            0.03
          );
        }
      });
    });

    masterVolume.addEventListener("input", () => {
      const volume = Number(masterVolume.value);
      masterVolumeValue.value = `${volume}%`;
      masterVolumeValue.textContent = `${volume}%`;
      if (masterGain && audioContext) {
        masterGain.gain.setTargetAtTime(volume / 100 * 0.35, audioContext.currentTime, 0.03);
      }
    });
  }

  window.StillApp = window.StillApp || {};
  window.StillApp.soundMixer = { init };
})();
