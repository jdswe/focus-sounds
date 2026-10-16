(function () {
  const timerFace = document.querySelector("#timerFace");
  const timerTime = document.querySelector("#timerTime");
  const timerMode = document.querySelector("#timerMode");
  const timerStatus = document.querySelector("#timerStatus");
  const toggleButton = document.querySelector("#timerToggle");
  const resetButton = document.querySelector("#timerReset");

  const durations = { focus: 25 * 60, break: 5 * 60 };
  let mode = "focus";
  let remainingSeconds = durations[mode];
  let endTime = 0;
  let intervalId;

  function render() {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    timerTime.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    timerMode.textContent = mode === "focus" ? "Focus session" : "Short break";
    timerFace.setAttribute("aria-label", `${mode === "focus" ? "Focus" : "Break"} timer, ${minutes} minutes ${seconds} seconds remaining`);
    timerFace.style.setProperty(
      "--timer-progress",
      `${((durations[mode] - remainingSeconds) / durations[mode]) * 100}%`
    );
    toggleButton.textContent = intervalId
      ? "Pause"
      : mode === "focus" ? "Start focus" : "Start break";
  }

  function stop() {
    window.clearInterval(intervalId);
    intervalId = undefined;
  }

  function tick() {
    remainingSeconds = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    if (remainingSeconds === 0) {
      stop();
      mode = mode === "focus" ? "break" : "focus";
      remainingSeconds = durations[mode];
      timerStatus.textContent = mode === "break"
        ? "Focus session complete. Take a gentle five-minute break."
        : "Break complete. Ready for another focus session?";
    }
    render();
  }

  toggleButton.addEventListener("click", () => {
    if (intervalId) {
      remainingSeconds = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      stop();
      timerStatus.textContent = "Timer paused. Resume whenever you are ready.";
      render();
      return;
    }

    endTime = Date.now() + remainingSeconds * 1000;
    intervalId = window.setInterval(tick, 250);
    timerStatus.textContent = mode === "focus"
      ? "A calm 25-minute focus session is underway."
      : "Enjoy a gentle five-minute break.";
    render();
  });

  resetButton.addEventListener("click", () => {
    stop();
    mode = "focus";
    remainingSeconds = durations.focus;
    timerStatus.textContent = "Focus for 25 minutes, then take a short break.";
    render();
  });

  function init() {
    render();
  }

  window.StillApp = window.StillApp || {};
  window.StillApp.pomodoro = { init };
})();
