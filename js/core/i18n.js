// Interface translation. Academic content (course and assignment names) is never translated.
(function () {
  const { messages } = window.StillApp.i18nMessages;
  const SUPPORTED = ["en", "es", "pt"];
  const listeners = new Set();
  let locale = "en";

  function t(key, params) {
    const template = messages[locale]?.[key] ?? messages.en[key];
    if (template == null) {
      console.warn(`Missing translation: ${key}`);
      return key;
    }
    return template.replace(/\{(\w+)\}/g, (match, name) => (params && params[name] != null ? params[name] : match));
  }

  // Elements opt in with data-i18n="key" (text) and data-i18n-attr="aria-label:key;title:key".
  function apply(root) {
    const scope = root || document;
    scope.querySelectorAll("[data-i18n]").forEach((element) => { element.textContent = t(element.dataset.i18n); });
    scope.querySelectorAll("[data-i18n-attr]").forEach((element) => {
      element.dataset.i18nAttr.split(";").forEach((pair) => {
        const [attribute, key] = pair.split(":").map((part) => part.trim());
        if (attribute && key) element.setAttribute(attribute, t(key));
      });
    });
  }

  function setLocale(next) {
    locale = SUPPORTED.includes(next) ? next : "en";
    document.documentElement.lang = locale;
    apply();
    listeners.forEach((listener) => listener(locale));
  }

  const intlLocale = () => ({ en: "en-US", es: "es", pt: "pt-BR" })[locale];

  function formatDate(value, options) {
    if (!value) return "";
    const date = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)))
      : new Date(value);
    return new Intl.DateTimeFormat(intlLocale(), options || { weekday: "short", month: "short", day: "numeric" }).format(date);
  }

  function formatTime(value) {
    return new Intl.DateTimeFormat(intlLocale(), { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  }

  function formatMinutes(minutes) {
    const value = Math.max(0, Math.round(minutes || 0));
    if (value < 60) return t("unit.minutes", { n: value });
    const hours = Math.floor(value / 60);
    const rest = value % 60;
    return rest ? t("unit.hoursMinutes", { h: hours, m: rest }) : t("unit.hours", { h: hours });
  }

  function weekdayName(day, style) {
    // 2023-01-01 was a Sunday.
    return new Intl.DateTimeFormat(intlLocale(), { weekday: style || "long" }).format(new Date(2023, 0, 1 + Number(day)));
  }

  window.StillApp.i18n = {
    SUPPORTED, t, apply, setLocale, formatDate, formatTime, formatMinutes, weekdayName,
    getLocale: () => locale,
    intlLocale,
    onChange: (listener) => listeners.add(listener)
  };
})();
