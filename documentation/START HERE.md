---
Coding Project Note: true
Note Creation Date: "2026-11-14T07:41:58-03:00"
Note Modified Date:
  - "2026-11-14T07:41:58-03:00"
  - "2026-11-16T03:08:00-03:00"
---

# 2026-11-14T07:41:58-03:00 — START HERE: WaveSpeed Studio

## Purpose
Standalone, clean-room distribution of **WaveSpeed Studio** — a zero-dependency Node.js (>=22.5.0) + built-in `node:sqlite` + vanilla Web UI studio for WaveSpeed AI image generation, editing, masking, and video workflows.

## Runtime Layout
- `server.js`: HTTP server (`PORT` default `3000`), WaveSpeed catalog & RSC pricing formula proxy, local `.env` / `.studio-config.json` API key loader, local asset auto-downloader, and SQLite run ledger.
- `database/history_db.js`: SQLite schema & queries (`database/studio_history.sqlite` created automatically at runtime, gitignored).
- `public/`: Frontend SPA (`index.html`, `style.css`, `app.js`).
- `pricing-formulas.json`: Verified WaveSpeed pricing formula cache.
- `scripts/verify_studio_isolated.js`: Isolated verification suite (`npm test`) — zero live API spend.
- `scripts/sync_pricing_formulas.js`: Read-only formula sync script (`npm run sync-prices`).

## Quick Verification
Run `npm test` to execute formula evaluation, UI simulation, SQLite CRUD, and mock HTTP tests cleanly in temporary directories.

## API Key Handling
Never hardcode API keys in tracked files. Provide `WAVESPEED_API_KEY` via `.env` / environment variable, or enter it in the **🔑 Key** modal (saved locally to gitignored `.studio-config.json`).


# 2026-11-16T03:08:00-03:00 — Updated Navigation & Single-Feature Pipeline Index

For any fresh chat working on **WaveSpeed Studio** (`v1.0.6+`), read in this order before touching code:
1. [PROJECT HANDOVER V2.md](PROJECT%20HANDOVER%20V2.md) — Current shipped version, storage layout, verification rules, and immediate priorities.
2. [ARCHITECTURE.md](ARCHITECTURE.md) — Complete technical walkthrough of server, UI tabs/schemas, timeline extractor, SQLite ledger, Electron wrapper, pricing engine, and CI build/release.
3. [PROJECT LOG V2.md](PROJECT%20LOG%20V2.md) — Append-only chronological history from `v1.0.6` onward (older `v1.0.0`–`v1.0.6` history lives in [PROJECT LOG.md](PROJECT%20LOG.md)).
4. [FEATURE PIPELINE.md](FEATURE%20PIPELINE.md) — Standard 1-feature-per-chat workflow, per-feature folder rules (`documentation/features/<NN-slug>/`), and copy-paste kickoff prompt.
5. [features/01-timeline-performance-fix/SPEC.md](features/01-timeline-performance-fix/SPEC.md) — Next queued feature/fix spec ready for an isolated chat.
