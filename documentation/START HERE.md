---
Coding Project Note: true
Note Creation Date: "2026-11-14T07:41:58-03:00"
Note Modified Date:
  - "2026-11-14T07:41:58-03:00"
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
