// Spaced repetition based on SM-2. Grades: "again" (forgot), "hard", "good", "easy".
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.StillApp = root.StillApp || {}).srs = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
  "use strict";

  const DAY = 24 * 60 * 60 * 1000;
  const QUALITY = { again: 1, hard: 3, good: 4, easy: 5 };

  function initialState() {
    return { ease: 2.5, interval: 0, reps: 0, lapses: 0, due: null, lastReviewedAt: null };
  }

  function review(state, grade, now) {
    const quality = QUALITY[grade];
    if (quality == null) throw new Error(`Unknown grade: ${grade}`);
    const current = { ...initialState(), ...(state || {}) };
    let { ease, interval, reps, lapses } = current;

    if (quality < 3) {
      reps = 0;
      lapses += 1;
      interval = 0;
    } else {
      reps += 1;
      if (reps === 1) interval = grade === "easy" ? 3 : 1;
      else if (reps === 2) interval = grade === "hard" ? 3 : 6;
      else interval = Math.round(interval * ease * (grade === "hard" ? 0.8 : grade === "easy" ? 1.3 : 1));
    }
    ease = Math.max(1.3, ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

    // "Again" cards come back in ten minutes within the same study day.
    const due = interval === 0 ? now + 10 * 60 * 1000 : now + interval * DAY;
    return { ease: Math.round(ease * 100) / 100, interval, reps, lapses, due, lastReviewedAt: now };
  }

  function isDue(card, now) {
    if (card.draft) return false;
    const due = card.srs?.due;
    return due == null || due <= now;
  }

  function dueCards(cards, now) {
    return cards.filter((card) => isDue(card, now))
      .sort((a, b) => (a.srs?.due ?? 0) - (b.srs?.due ?? 0));
  }

  // A card counts as "learned" once it has survived an interval of at least three weeks.
  function summarize(cards, now) {
    const active = cards.filter((card) => !card.draft);
    return {
      total: active.length,
      due: active.filter((card) => isDue(card, now)).length,
      newCards: active.filter((card) => !card.srs?.lastReviewedAt).length,
      learned: active.filter((card) => (card.srs?.interval || 0) >= 21).length,
      reviews: active.reduce((sum, card) => sum + (card.history?.length || 0), 0)
    };
  }

  // Draft cards from note text. Supports "Q: … / A: …" pairs and "term — definition" lines.
  function draftsFromText(text) {
    const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const drafts = [];
    for (let i = 0; i < lines.length; i++) {
      const question = /^(?:q|p|question|pregunta|pergunta)\s*[:.)-]\s*(.+)$/i.exec(lines[i]);
      const answer = question && /^(?:a|r|answer|respuesta|resposta)\s*[:.)-]\s*(.+)$/i.exec(lines[i + 1] || "");
      if (question && answer) {
        drafts.push({ front: question[1], back: answer[1] });
        i++;
        continue;
      }
      const pair = /^[-•*]?\s*([^:—–]{2,80}?)\s+(?:—|–|-|::)\s+(.{2,})$/.exec(lines[i]) || /^[-•*]?\s*([^:]{2,60}):\s+(.{2,})$/.exec(lines[i]);
      if (pair) drafts.push({ front: pair[1].trim(), back: pair[2].trim() });
    }
    return drafts;
  }

  function normalizeFront(text) {
    return String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  }

  function isDuplicate(cards, front, subjectId, ignoreId) {
    const key = normalizeFront(front);
    return cards.some((card) => card.id !== ignoreId && (card.subjectId || null) === (subjectId || null) && normalizeFront(card.front) === key);
  }

  return { QUALITY, initialState, review, isDue, dueCards, summarize, draftsFromText, isDuplicate, normalizeFront };
});
