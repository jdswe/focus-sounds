# Integrations, configuration and known limitations

Focus Sounds currently runs entirely in the browser with no backend. This document explains what that means, what is intentionally not implemented yet, and how to add the missing pieces safely.

## Current architecture

- **Storage**: one versioned JSON document in `localStorage` (`still-data`), plus small preference keys (`still-color-theme`, `still-clock-format`, `still-sound-volumes`, `still-active-session`, `still-motivation-cursor`). `js/core/store.js` owns the schema and `migrate()`; every future schema change adds a step there instead of rewriting data.
- **Data isolation**: data never leaves the device. Export/restore (Settings) produces a JSON backup.
- **External requests**:
  - `cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/` — loaded only when the user picks a PDF. The PDF bytes stay in the browser.
  - `api.bigdatacloud.net` and `api.open-meteo.com` — only after the user allows geolocation (unchanged from the original app).
- **No secrets** exist in the repository and none are needed.

## Timing rules (focus sessions)

- Active time is the sum of recorded segments (start/pause/resume timestamps), never a counter.
- While the page is open it writes a heartbeat every 5 s and on `pagehide`. If the page was closed, time after the last heartbeat is **not** counted; the session is restored as paused.
- If the planned duration elapsed while a tab was open, the session is recorded as completed at its planned end.
- Records are appended under a Web Lock and by session id, so several tabs cannot create duplicates.
- Sessions shorter than one minute that are finished early are discarded.

## Syllabus import

- Rule-based extraction (`js/domain/syllabus-parser.js`) — no AI service, no cost, works offline for pasted text.
- Recognizes English, Spanish and Portuguese keywords and dates. Ambiguous numeric dates (03/04) and inferred years are flagged and must be confirmed.
- **Time zones**: the source zone is chosen per import. Supported: Bolivia (America/La_Paz, UTC−4), fixed UTC−3, Argentina (Buenos Aires), Brazil (São Paulo), Colombia (Bogotá) and Mexico (Mexico City). Deadlines and class times are converted to the device's zone; the original date, time and zone are kept on each task (`task.source.originalDue`). An optional "closing time" (e.g. 23:59) is applied to activities without a time and is marked as assumed.
- **Not implemented**: OCR for scanned PDFs. Scanned files are detected and the user is asked to paste the text. A future option is Tesseract.js loaded on demand (~10 MB of language data per language).

## Google sign-in, cloud sync and Google Drive — blocked

These require a server component so OAuth tokens never live in client code. Nothing in the current UI pretends to offer them.

### Recommended setup (Supabase)

1. Create a Supabase project and enable **Authentication → Providers → Google**.
2. In Google Cloud Console create an OAuth client (Web application). Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`. Add your site URL (and `http://localhost:5173` for development) under Supabase **Authentication → URL configuration**.
3. Only the Supabase **anon key** and project URL go to the browser (`SUPABASE_URL`, `SUPABASE_ANON_KEY`); the Google client secret stays in Supabase.
4. Tables mirror the store collections (`subjects`, `tasks`, `focus_sessions`, `notes`, `cards`, …) with a `user_id uuid references auth.users` column and Row Level Security:

   ```sql
   alter table tasks enable row level security;
   create policy "own rows" on tasks for all
     using (auth.uid() = user_id) with check (auth.uid() = user_id);
   ```

5. Sync strategy: keep the local store as the source of truth for guests; after sign-in, upload local records once (ids are already globally unique) and then sync by `updatedAt` with last-write-wins per record. Focus-session records are append-only and keyed by id, so they cannot duplicate.

### Google Drive (optional)

- Use the **Google Picker** with the `https://www.googleapis.com/auth/drive.file` scope only — it grants access to files the user explicitly picks, not the whole Drive.
- Token exchange and file download should run in a Supabase Edge Function (or similar), which returns the PDF bytes to the browser for the existing import pipeline. Store imported files as copies; never modify or delete remote files.
- Required configuration: Google Cloud project with Drive API and Picker API enabled, an API key restricted to your domain, and the OAuth client from the step above.

## AI features — not used

Draft flashcards come from rules (Q/A pairs, "term — definition" lines), are labeled as drafts and must be accepted. No paid AI API is called. If an AI provider is added later (e.g. for summaries or smarter extraction), call it from a server function, keep the key server-side, show generated content as editable drafts, and keep the rule-based path as the free default.

## Known limitations

- Data lives in one browser profile until exported; clearing site data deletes it.
- `localStorage` holds about 5 MB; imported document text is capped at 300 000 characters per document.
- Background tabs may update the timer display less often (browser throttling); recorded time is unaffected because it uses timestamps.
- The companion animations respect `prefers-reduced-motion`.
