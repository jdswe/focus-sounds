# Focus Sounds — Pre-change Audit

Audit date: 2026-10-20. Audited commit: `c1a4914` on `main`.

## Git state

| Item | Finding |
| --- | --- |
| Branches | Only `main` (local) tracking `origin/main`. No `develop`/`master`. |
| Source development branch | `main` — the only branch; all three commits land there directly. |
| Working tree | Clean: no staged, unstaged or untracked changes. |
| Remote | `origin` → `git@github.com:jdswe/focus-sounds.git` (SSH). |
| Recent history | `f7640ec Prepare Focus Sounds for GitHub`, `591108b Ignore VS Code settings`, `c1a4914 Add Focus Sounds favicon and polish project assets`. Plain sentence-case messages, no conventional-commit prefixes yet. |
| GitHub CLI | `gh` 2.102 installed but **not authenticated** — a draft PR cannot be created from this machine without `gh auth login`. |

## Architecture

- **Type**: static, client-only web page. No build step, no package manager, no backend.
- **Languages**: HTML5, CSS (custom properties, `color-mix`, `backdrop-filter`), vanilla ES2020+ JavaScript.
- **Dependencies**: none. Runtime calls to two free public APIs (BigDataCloud reverse geocoding, Open-Meteo weather) only after the user grants geolocation.
- **Module pattern**: each file in `js/` is an IIFE that registers itself on the global `window.StillApp` namespace; `app.js` calls each module's `init()`. Scripts load with `defer` in order.
- **Persistence**: `localStorage` keys `still-color-theme` and `still-clock-format` only, wrapped in `try/catch`.
- **Entry point**: `index.html` → single page, no routing.

| File | Responsibility |
| --- | --- |
| `index.html` | All markup: header, theme picker, 6 ambient + 5 instrument sound cards, clock/weather, Pomodoro, mixer. |
| `styles.css` | Five pastel "color moods" (`berry`, `spring`, `sage`, `sand`, `sky`) as CSS variable sets, liquid-glass panels, responsive breakpoints at 900/680/440 px, `prefers-reduced-motion`. |
| `js/audio-engine.js` | Procedural buffers: brown/pink/white noise, rain, ocean, wind, plus synthesized piano/guitar (Karplus–Strong)/flute/kalimba/handpan loops. |
| `js/sound-mixer.js` | Web Audio graph: per-sound gain → master gain; toggle, per-sound and master volume; mix status text. |
| `js/pomodoro.js` | 25/5 timer using an absolute `endTime` (`Date.now()`-based), start/pause/reset. |
| `js/clock.js` | Local clock with 12/24h toggle, locale country flag, optional geolocation weather. |
| `js/theme-picker.js` | Applies and saves the color mood; updates `<meta name="theme-color">`. |

## Feature status

| Feature | Status | Notes |
| --- | --- | --- |
| Ambient sounds (brown, pink, white, rain, ocean, wind) | 1 — Fully functional | Procedural, loops a 12 s buffer. |
| Instrument textures (5) | 1 — Fully functional | |
| Mixing multiple sounds + per-sound/master volume | 1 — Fully functional | Volumes are not persisted. |
| Five color moods, persisted | 1 — Fully functional | |
| Clock, 12/24h persisted, optional weather | 1 — Fully functional | Geolocation is requested automatically on load (not only on button press). |
| Pomodoro 25/5 | 2 — Partial | Fixed durations; no long breaks, history, notifications, persistence or recovery after reload; pausing/resetting loses everything. |
| Session tracking / history | 4 — Missing | |
| Light/dark mode | 4 — Missing | Only the five pastel moods exist; there is no dark appearance. |
| Saved soundscapes / favorites | 4 — Missing | |
| Library, café, forest, river sounds | 4 — Missing | |
| Academic planner, subjects, tasks, Kanban, calendar | 4 — Missing | |
| Syllabus/PDF import | 4 — Missing | |
| Notes, flashcards | 4 — Missing | |
| Companions | 4 — Missing | |
| Statistics, recommendations, motivation | 4 — Missing | |
| Authentication / profiles | 4 — Missing | No backend, no Supabase, no OAuth. |
| Google integrations (Sign-In, Drive) | 4 — Missing | |
| AI integrations | 4 — Missing | No env vars, no keys. |
| Internationalization | 4 — Missing | All copy hard-coded in English. |
| Tests, lint, type checks, CI | 4 — Missing | No `package.json`. `node --check` passes on every script. |
| Deployment workflow | 4 — Missing | README says "open `index.html`". |

No broken features were found (5 — none).

## Technical debt and limitations

1. Pomodoro state lives only in memory: a reload loses the session; no record of completed work.
2. Geolocation prompt fires on every page load, before the user asks.
3. Sound volumes and mixes are not persisted.
4. All UI copy is inline English; no i18n mechanism.
5. No automated tests or scripts at all.
6. Namespace is still `StillApp` / keys `still-*` (an earlier product name). Kept for backward compatibility of saved preferences.

## Must not break

- The no-build, open-the-file workflow (README promise: "No build step and no external audio files required").
- All 11 procedural sounds and the mixer behaviour.
- Five color moods and saved `still-color-theme` / `still-clock-format` values.
- Clock/weather panel and its privacy wording.
- Liquid-glass visual identity, responsive layout and reduced-motion support.

## Constraints that shape the plan

- **No backend.** Anything that needs secrets (Google OAuth client secret, refresh tokens, Drive access tokens kept off the browser, paid AI keys) cannot be implemented safely in this repository today. The plan builds a local-first data layer with a repository boundary so a backend (e.g. Supabase Auth with the Google provider + RLS) can be added later without rewriting features.
- **No build tooling.** New code follows the existing IIFE + `window.StillApp` pattern. Pure domain modules additionally export through CommonJS so Node's built-in test runner (`node --test`, Node ≥ 18) can test them with zero dependencies.
- **PDF parsing** requires a PDF library. pdf.js is loaded lazily from cdnjs only when the user picks a PDF; pasting text works fully offline. OCR is out of scope for this increment.

## Prioritized plan (this increment)

1. Local-first versioned store with migrations, cross-tab sync, JSON backup/restore.
2. i18n (English default, Spanish, Portuguese) and light/dark appearance on top of the existing moods.
3. Reliable focus sessions: timestamp segments, persistence, recovery rules, single-record finalization across tabs, configurable Pomodoro, task-linked sessions, history.
4. Subjects with colors and class schedules; tasks with Kanban/list/calendar views.
5. Syllabus import: paste text or PDF → rule-based extraction with page references → review → approve → tasks.
6. Study scheduler: availability windows, fixed classes/commitments, deadline-aware chunking, conflict warnings, approve/lock/regenerate.
7. Notes with autosave and flashcards with SM-2 spaced repetition.
8. Companion system: five species (Colombia, Mexico, Argentina, Brazil, Bolivia), slot/anchor compatibility, outfits, unlocks from real progress, animation states driven by app events.
9. Statistics, recommendations with reasons, optional non-repeating motivational messages.
10. New ambient sounds (river, forest, café, library, rain on window) and saved soundscapes.
11. Tests for all domain logic, documentation of blocked integrations.

## Risks

- `localStorage` quota (~5 MB): extracted document text is stored per page with a size cap; original PDF bytes are not stored.
- Rule-based extraction will miss items written in unusual formats; the review step is mandatory and nothing is created without approval.
- Browser timer throttling in background tabs: recovery uses persisted heartbeats rather than counters.
