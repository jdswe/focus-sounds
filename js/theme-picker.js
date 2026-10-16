(function () {
  const themes = ["berry", "spring", "sage", "sand", "sky"];
  const buttons = [...document.querySelectorAll(".theme-choice")];
  const body = document.body;
  const themeColor = document.querySelector('meta[name="theme-color"]');

  function applyTheme(theme) {
    if (!themes.includes(theme)) return;
    body.dataset.theme = theme;
    buttons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.theme === theme));
    });

    const deepColor = getComputedStyle(body).getPropertyValue("--scene-deep").trim();
    if (themeColor && deepColor) themeColor.content = deepColor;
    try {
      localStorage.setItem("still-color-theme", theme);
    } catch (error) {
      console.warn("Could not save the selected color theme:", error);
    }
  }

  let savedTheme = "berry";
  try {
    savedTheme = localStorage.getItem("still-color-theme") || savedTheme;
  } catch (error) {
    console.warn("Could not read the saved color theme:", error);
  }
  applyTheme(savedTheme);

  buttons.forEach((button) => {
    button.addEventListener("click", () => applyTheme(button.dataset.theme));
  });

  window.StillApp = window.StillApp || {};
  window.StillApp.themePicker = { applyTheme };
})();
