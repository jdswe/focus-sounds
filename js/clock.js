(function () {
  const t = (key, params) => window.StillApp.i18n.t(key, params);
  const timeElement = document.querySelector("#localTime");
  const dateElement = document.querySelector("#localDate");
  const flagElement = document.querySelector("#countryFlag");
  const locationElement = document.querySelector("#locationName");
  const weatherElement = document.querySelector("#weatherSummary");
  const locationButton = document.querySelector("#locationButton");
  const locationStatus = document.querySelector("#locationStatus");
  const formatButtons = [...document.querySelectorAll("[data-hour-format]")];
  let hourCycle = "h23";

  function updateClock() {
    const now = new Date();
    timeElement.dateTime = now.toISOString();
    timeElement.textContent = new Intl.DateTimeFormat(window.StillApp.i18n.intlLocale(), {
      hourCycle,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(now);
    dateElement.textContent = new Intl.DateTimeFormat(window.StillApp.i18n.intlLocale(), {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric"
    }).format(now);
  }

  function flagFromCountryCode(countryCode) {
    if (!countryCode || !/^[a-z]{2}$/i.test(countryCode)) return "◌";
    return [...countryCode.toUpperCase()]
      .map((letter) => String.fromCodePoint(letter.charCodeAt(0) + 127397))
      .join("");
  }

  function getLocaleCountry() {
    const region = new Intl.Locale(navigator.language || "en").region;
    if (!region) return;
    try {
      const country = new Intl.DisplayNames([navigator.language || "en"], { type: "region" }).of(region);
      flagElement.textContent = flagFromCountryCode(region);
      locationElement.textContent = country;
    } catch (error) {
      console.warn("Could not determine the device's country from its locale:", error);
    }
  }

  function describeWeather(code, isDay) {
    if (code === 0) return t(isDay ? "weather.clear" : "weather.clearNight");
    if ([1, 2].includes(code)) return t("weather.mostlyClear");
    if (code === 3) return t("weather.cloudy");
    if ([45, 48].includes(code)) return t("weather.fog");
    if ([51, 53, 55, 56, 57].includes(code)) return t("weather.drizzle");
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return t("weather.rain");
    if ([71, 73, 75, 77, 85, 86].includes(code)) return t("weather.snow");
    if ([95, 96, 99].includes(code)) return t("weather.storm");
    return t("weather.current");
  }

  async function getLocationDetails(latitude, longitude) {
    const url = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
    url.search = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      localityLanguage: window.StillApp.i18n.getLocale()
    });
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Location lookup failed (${response.status}).`);
    return response.json();
  }

  async function getWeather(latitude, longitude) {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.search = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      current: "temperature_2m,weather_code,is_day",
      timezone: "auto"
    });
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Weather lookup failed (${response.status}).`);
    return response.json();
  }

  async function updateLocalConditions(position) {
    const { latitude, longitude } = position.coords;
    locationStatus.textContent = t("clock.checking");
    const [placeResult, weatherResult] = await Promise.allSettled([
      getLocationDetails(latitude, longitude),
      getWeather(latitude, longitude)
    ]);

    if (placeResult.status === "fulfilled") {
      const place = placeResult.value;
      const city = place.city || place.locality || place.principalSubdivision || "";
      const country = place.countryName || "";
      const countryCode = place.countryCode;
      flagElement.textContent = flagFromCountryCode(countryCode);
      locationElement.textContent = [city, country].filter(Boolean).join(", ") || t("clock.localArea");
    }

    if (weatherResult.status === "fulfilled") {
      const weather = weatherResult.value.current;
      const unit = weatherResult.value.current_units?.temperature_2m || "°C";
      weatherElement.textContent = `${describeWeather(weather.weather_code, weather.is_day)} · ${Math.round(weather.temperature_2m)}${unit}`;
    }

    const failures = [placeResult, weatherResult]
      .filter((result) => result.status === "rejected")
      .map((result) => result.reason);
    if (failures.length) {
      failures.forEach((error) => console.error("Could not load a local condition:", error));
      locationStatus.textContent = weatherResult.status === "fulfilled"
        ? t("clock.placeFailed")
        : t("clock.someFailed");
    } else {
      locationStatus.textContent = t("clock.usedOnly");
    }
  }

  function requestLocation() {
    if (!navigator.geolocation) {
      locationStatus.textContent = t("clock.unavailable");
      return;
    }

    locationStatus.textContent = t("clock.waiting");
    navigator.geolocation.getCurrentPosition(
      (position) => { void updateLocalConditions(position); },
      (error) => {
        const messages = {
          1: t("clock.denied"),
          2: t("clock.notDetermined"),
          3: t("clock.timeout")
        };
        locationStatus.textContent = messages[error.code] || t("clock.noAccess");
      },
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 12000 }
    );
  }

  function init() {
    let preferredFormat = "24";
    try {
      preferredFormat = localStorage.getItem("still-clock-format") === "12" ? "12" : "24";
    } catch (error) {
      console.warn("Could not read the saved clock format:", error);
    }

    formatButtons.forEach((button) => {
      const selected = button.dataset.hourFormat === preferredFormat;
      button.setAttribute("aria-pressed", String(selected));
      if (selected) hourCycle = preferredFormat === "12" ? "h12" : "h23";
      button.addEventListener("click", () => {
        const format = button.dataset.hourFormat;
        hourCycle = format === "12" ? "h12" : "h23";
        formatButtons.forEach((choice) => {
          choice.setAttribute("aria-pressed", String(choice.dataset.hourFormat === format));
        });
        try {
          localStorage.setItem("still-clock-format", format);
        } catch (error) {
          console.warn("Could not save the selected clock format:", error);
        }
        updateClock();
      });
    });
    updateClock();
    getLocaleCountry();
    window.setInterval(updateClock, 1000);
    locationButton.addEventListener("click", requestLocation);
    window.StillApp.i18n.onChange(updateClock);
    // Only look up weather automatically when the browser already granted location access,
    // so the permission prompt never appears without a click.
    navigator.permissions?.query({ name: "geolocation" })
      .then((status) => { if (status.state === "granted") requestLocation(); })
      .catch(() => {});
  }

  window.StillApp = window.StillApp || {};
  window.StillApp.clock = { init };
})();
