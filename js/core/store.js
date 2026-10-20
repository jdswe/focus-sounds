// Local-first, versioned data store. All academic data lives in one JSON document in
// localStorage so it survives reloads and can be exported, restored or synced later.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.StillApp = root.StillApp || {}).store = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
  "use strict";

  const STORAGE_KEY = "still-data";
  const SCHEMA_VERSION = 1;

  const COLLECTIONS = [
    "periods", "subjects", "documents", "extractions", "tasks", "events",
    "plannedSessions", "focusSessions", "notes", "cards", "soundPresets"
  ];

  const DEFAULT_PREFERENCES = {
    locale: "en",
    appearance: "system",
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    longBreakEvery: 4,
    autoStartBreaks: false,
    notifications: false,
    motivation: true,
    dailyGoalMinutes: 120,
    maxSessionMinutes: 50,
    minSessionMinutes: 25,
    breakBetweenSessionsMinutes: 10,
    maxTaskMinutesPerDay: 120,
    planningHorizonDays: 21,
    // Weekday (0 = Sunday) → study windows. Users edit these in Settings.
    availability: {
      0: [],
      1: [{ start: "18:00", end: "20:00" }],
      2: [{ start: "18:00", end: "20:00" }],
      3: [{ start: "18:00", end: "20:00" }],
      4: [{ start: "18:00", end: "20:00" }],
      5: [{ start: "16:00", end: "18:00" }],
      6: [{ start: "10:00", end: "12:00" }]
    }
  };

  let idCounter = 0;
  function createId(prefix) {
    idCounter = (idCounter + 1) % 1679616;
    const random = Math.random().toString(36).slice(2, 8);
    return `${prefix || "id"}_${Date.now().toString(36)}${idCounter.toString(36)}${random}`;
  }

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function createEmptyState(now) {
    const timestamp = new Date(now ?? Date.now()).toISOString();
    const state = {
      schemaVersion: SCHEMA_VERSION,
      profile: { id: createId("profile"), name: "", mode: "guest", createdAt: timestamp },
      preferences: clone(DEFAULT_PREFERENCES),
      companion: { species: "capybara", equipped: {}, celebratedUnlocks: [] },
      meta: { createdAt: timestamp, updatedAt: timestamp, motivationCursor: 0 }
    };
    COLLECTIONS.forEach((name) => { state[name] = []; });
    return state;
  }

  // Upgrades any previously saved document to the current schema without dropping data.
  // Future migrations append a step: `if (state.schemaVersion < 2) { ...; state.schemaVersion = 2; }`.
  function migrate(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return createEmptyState();
    if (Number(raw.schemaVersion) > SCHEMA_VERSION) {
      throw new Error(`Data was saved by a newer version of Focus Sounds (schema ${raw.schemaVersion}).`);
    }
    const state = clone(raw);
    const empty = createEmptyState();
    state.schemaVersion = SCHEMA_VERSION;
    state.profile = { ...empty.profile, ...(state.profile || {}) };
    state.preferences = { ...empty.preferences, ...(state.preferences || {}) };
    state.preferences.availability = { ...empty.preferences.availability, ...(state.preferences.availability || {}) };
    state.companion = { ...empty.companion, ...(state.companion || {}) };
    state.companion.equipped = state.companion.equipped || {};
    state.meta = { ...empty.meta, ...(state.meta || {}) };
    COLLECTIONS.forEach((name) => {
      if (!Array.isArray(state[name])) state[name] = [];
    });
    return state;
  }

  function createStore(options) {
    const storage = options?.storage;
    const key = options?.key || STORAGE_KEY;
    const onError = options?.onError || (() => {});
    const listeners = new Set();
    let state = load();

    function load() {
      try {
        const text = storage?.getItem(key);
        return text ? migrate(JSON.parse(text)) : createEmptyState();
      } catch (error) {
        onError(error, "load");
        return createEmptyState();
      }
    }

    function persist() {
      try {
        storage?.setItem(key, JSON.stringify(state));
        return true;
      } catch (error) {
        onError(error, "save");
        return false;
      }
    }

    function emit(source) {
      listeners.forEach((listener) => {
        try { listener(state, source); } catch (error) { onError(error, "listener"); }
      });
    }

    return {
      key,
      get: () => state,
      // Mutators receive a working copy; the store only commits it when the mutator succeeds.
      update(mutator, source) {
        const draft = clone(state);
        const result = mutator(draft);
        draft.meta.updatedAt = new Date().toISOString();
        state = draft;
        persist();
        emit(source || "local");
        return result;
      },
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      // Called when another tab changed the same key.
      reload(source) {
        state = load();
        emit(source || "external");
      },
      exportJson() {
        return JSON.stringify({ app: "focus-sounds", exportedAt: new Date().toISOString(), data: state }, null, 2);
      },
      importJson(text) {
        const parsed = JSON.parse(text);
        const data = parsed && parsed.app === "focus-sounds" ? parsed.data : parsed;
        state = migrate(data);
        persist();
        emit("import");
        return state;
      }
    };
  }

  const api = { STORAGE_KEY, SCHEMA_VERSION, COLLECTIONS, DEFAULT_PREFERENCES, createId, createEmptyState, migrate, createStore, clone };

  if (typeof window !== "undefined" && typeof module === "undefined") {
    let storage;
    try { storage = window.localStorage; } catch (error) { console.warn("Local storage is unavailable:", error); }
    const store = createStore({
      storage,
      onError(error, phase) {
        console.error(`Store ${phase} failed:`, error);
        if (phase === "save") window.dispatchEvent(new CustomEvent("still:storage-error", { detail: error }));
      }
    });
    window.addEventListener("storage", (event) => {
      if (event.key === store.key) store.reload("external");
    });
    api.app = store;
  }

  return api;
});
