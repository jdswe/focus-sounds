// Companion catalog and customization rules. Items declare which species they fit, so a
// hat drawn for a capybara never ends up on the macaw. Unlocks are derived from real
// progress counters every time, so they can never be lost and never punish rest days.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.StillApp = root.StillApp || {}).companions = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
  "use strict";

  const SLOTS = ["background", "back", "body", "neck", "eyes", "head", "ears", "hand", "effect"];

  const SPECIES = [
    { id: "capybara", country: "CO", slots: SLOTS },
    { id: "axolotl", country: "MX", slots: ["background", "back", "neck", "eyes", "head", "ears", "hand", "effect"] },
    { id: "carpincho", country: "AR", slots: SLOTS },
    { id: "alpaca", country: "PE", slots: ["background", "back", "body", "neck", "eyes", "head", "ears", "effect"] },
    { id: "macaw", country: "BR", slots: ["background", "back", "neck", "eyes", "head", "ears", "hand", "effect"] },
    { id: "llama", country: "BO", slots: ["background", "back", "body", "neck", "eyes", "head", "ears", "effect"] }
  ];

  const ALL = SPECIES.map((species) => species.id);
  const HOLDERS = ["capybara", "axolotl", "carpincho", "macaw"];

  // unlock: null = available from the start; otherwise { metric, count } from progressCounters().
  const ITEMS = [
    { id: "round-glasses", slot: "eyes", species: ALL, unlock: null },
    { id: "study-headphones", slot: "ears", species: ALL, unlock: { metric: "focusSessions", count: 1 } },
    { id: "school-backpack", slot: "back", species: ALL, unlock: { metric: "tasksCompleted", count: 1 } },
    { id: "notebook", slot: "hand", species: HOLDERS, unlock: null },
    { id: "focus-sparkles", slot: "effect", species: ALL, unlock: { metric: "focusMinutes", count: 120 } },
    { id: "bg-study-room", slot: "background", species: ALL, unlock: null },
    { id: "bg-mountains", slot: "background", species: ALL, unlock: { metric: "focusMinutes", count: 300 } },
    { id: "bg-night-sky", slot: "background", species: ALL, unlock: { metric: "focusSessions", count: 10 } },

    { id: "ruana", slot: "body", species: ["capybara"], unlock: null },
    { id: "aguadeno-hat", slot: "head", species: ["capybara"], unlock: { metric: "focusSessions", count: 3 } },
    { id: "vueltiao-hat", slot: "head", species: ["capybara"], unlock: { metric: "focusMinutes", count: 180 } },
    { id: "coffee-cup", slot: "hand", species: ["capybara"], unlock: null },
    { id: "mochila-bag", slot: "back", species: ["capybara"], unlock: { metric: "tasksCompleted", count: 3 } },
    { id: "tricolor-scarf", slot: "neck", species: ["capybara"], unlock: { metric: "cardsReviewed", count: 20 } },
    { id: "orange-hat", slot: "head", species: ["capybara", "carpincho"], unlock: { metric: "notesWritten", count: 1 } },

    { id: "marigold-crown", slot: "head", species: ["axolotl"], unlock: null },
    { id: "sarape-scarf", slot: "neck", species: ["axolotl"], unlock: { metric: "focusSessions", count: 3 } },
    { id: "taco", slot: "hand", species: ["axolotl"], unlock: { metric: "tasksCompleted", count: 2 } },
    { id: "bg-papel-picado", slot: "background", species: ["axolotl"], unlock: { metric: "focusMinutes", count: 240 } },

    { id: "mate-set", slot: "hand", species: ["carpincho"], unlock: null },
    { id: "celeste-scarf", slot: "neck", species: ["carpincho"], unlock: { metric: "focusSessions", count: 3 } },
    { id: "boina", slot: "head", species: ["carpincho"], unlock: { metric: "focusMinutes", count: 180 } },
    { id: "striped-jersey", slot: "body", species: ["carpincho"], unlock: { metric: "tasksCompleted", count: 3 } },

    { id: "chullo", slot: "head", species: ["alpaca"], unlock: null },
    { id: "andean-poncho", slot: "body", species: ["alpaca"], unlock: { metric: "focusSessions", count: 3 } },
    { id: "woven-bag", slot: "neck", species: ["alpaca"], unlock: { metric: "tasksCompleted", count: 2 } },

    { id: "green-yellow-bandana", slot: "neck", species: ["macaw"], unlock: null },
    { id: "tropical-flower", slot: "head", species: ["macaw"], unlock: { metric: "focusSessions", count: 3 } },
    { id: "pandeiro", slot: "hand", species: ["macaw"], unlock: { metric: "focusMinutes", count: 180 } },

    { id: "lluchu-hat", slot: "head", species: ["llama"], unlock: null },
    { id: "aguayo-shawl", slot: "body", species: ["llama"], unlock: { metric: "focusSessions", count: 3 } },
    { id: "chuspa-pouch", slot: "neck", species: ["llama"], unlock: { metric: "tasksCompleted", count: 2 } }
  ];

  const OUTFITS = [
    { id: "coffee-region", species: "capybara", items: ["aguadeno-hat", "ruana", "coffee-cup"] },
    { id: "caribbean-coast", species: "capybara", items: ["vueltiao-hat", "mochila-bag"] },
    { id: "marigold-festival", species: "axolotl", items: ["marigold-crown", "sarape-scarf"] },
    { id: "taco-break", species: "axolotl", items: ["taco", "sarape-scarf", "bg-papel-picado"] },
    { id: "mate-time", species: "carpincho", items: ["boina", "celeste-scarf", "mate-set"] },
    { id: "match-day", species: "carpincho", items: ["striped-jersey", "celeste-scarf"] },
    { id: "highlands", species: "alpaca", items: ["chullo", "andean-poncho", "woven-bag", "bg-mountains"] },
    { id: "carnival-colors", species: "macaw", items: ["tropical-flower", "green-yellow-bandana", "pandeiro"] },
    { id: "altiplano", species: "llama", items: ["lluchu-hat", "aguayo-shawl", "chuspa-pouch", "bg-mountains"] },
    { id: "study-day", species: "*", items: ["round-glasses", "study-headphones", "school-backpack", "notebook", "bg-study-room"] }
  ];

  const itemById = new Map(ITEMS.map((item) => [item.id, item]));

  function getItem(id) {
    return itemById.get(id) || null;
  }

  function getSpecies(id) {
    return SPECIES.find((species) => species.id === id) || SPECIES[0];
  }

  function isCompatible(item, speciesId) {
    return Boolean(item) && item.species.includes(speciesId) && getSpecies(speciesId).slots.includes(item.slot);
  }

  function isUnlocked(item, counters) {
    if (!item) return false;
    if (!item.unlock) return true;
    return (counters[item.unlock.metric] || 0) >= item.unlock.count;
  }

  function itemsFor(speciesId) {
    return ITEMS.filter((item) => isCompatible(item, speciesId));
  }

  function outfitsFor(speciesId) {
    return OUTFITS.filter((outfit) => outfit.species === speciesId || outfit.species === "*");
  }

  // Returns a new equipped map (slot → itemId). Refuses incompatible or locked items.
  function equip(equipped, itemId, speciesId, counters) {
    const item = getItem(itemId);
    if (!isCompatible(item, speciesId)) return { equipped, ok: false, reason: "incompatible" };
    if (!isUnlocked(item, counters)) return { equipped, ok: false, reason: "locked" };
    return { equipped: { ...equipped, [item.slot]: item.id }, ok: true };
  }

  function unequip(equipped, slot) {
    const next = { ...equipped };
    delete next[slot];
    return next;
  }

  // Equips every compatible, unlocked piece of an outfit; other slots stay as they were.
  function equipOutfit(equipped, outfitId, speciesId, counters) {
    const outfit = OUTFITS.find((entry) => entry.id === outfitId);
    if (!outfit) return { equipped, applied: [], skipped: [] };
    let next = { ...equipped };
    const applied = [];
    const skipped = [];
    outfit.items.forEach((itemId) => {
      const result = equip(next, itemId, speciesId, counters);
      if (result.ok) { next = result.equipped; applied.push(itemId); }
      else if (getSpecies(speciesId).slots.includes(getItem(itemId)?.slot) && getItem(itemId)?.species.includes(speciesId)) skipped.push(itemId);
    });
    return { equipped: next, applied, skipped };
  }

  // Drops anything that is no longer valid (e.g. catalog changes) so rendering stays safe.
  function sanitizeEquipped(equipped, speciesId, counters) {
    const clean = {};
    Object.entries(equipped || {}).forEach(([slot, itemId]) => {
      const item = getItem(itemId);
      if (item && item.slot === slot && isCompatible(item, speciesId) && isUnlocked(item, counters)) clean[slot] = itemId;
    });
    return clean;
  }

  function newlyUnlocked(counters, celebrated) {
    const seen = new Set(celebrated || []);
    return ITEMS.filter((item) => item.unlock && isUnlocked(item, counters) && !seen.has(item.id)).map((item) => item.id);
  }

  // Maps real app events to an animation state.
  function stateFor(context) {
    if (context.celebrating) return "celebrate";
    if (context.timerKind === "focus" && context.timerRunning) return "focus";
    if (context.timerKind && context.timerKind !== "focus" && context.timerRunning) return "break";
    const hour = new Date(context.now).getHours();
    if (hour >= 23 || hour < 6) return "sleep";
    return "idle";
  }

  return { SLOTS, SPECIES, ITEMS, OUTFITS, getItem, getSpecies, isCompatible, isUnlocked, itemsFor, outfitsFor, equip, unequip, equipOutfit, sanitizeEquipped, newlyUnlocked, stateFor };
});
