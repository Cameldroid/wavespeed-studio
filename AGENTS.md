# AGENTS.md — WaveSpeed Studio

## 1. Critical Credit & API Protection Rule (ZERO AUTOMATED SPEND)
- **NEVER** execute test generations (`POST https://api.wavespeed.ai/api/v3/{model_id}` or `POST http://localhost:3000/api/generate`) from scripts, terminals, or automated tests.
- Every generation call spends real USD balance on the user's WaveSpeed account.
- Only **read-only** endpoints may be queried by agents or scripts:
  - `GET /api/config`
  - `GET /api/balance`
  - `GET /api/models`
  - `GET /api/model-pricing?id=<model_id>`
  - `POST /api/sync-prices` (read-only catalog + RSC formula sync)
  - `GET /api/outputs`
  - `GET /api/history/stats` and `GET /api/history/runs`

## 2. Project Structure
- `server.js`: Zero-dependency Node.js HTTP server (`node:http`, `node:sqlite`), WaveSpeed catalog & RSC formula pricing proxy, local asset auto-saver, and SQLite run ledger.
- `database/history_db.js`: SQLite (`node:sqlite` `DatabaseSync`) schema & CRUD/query/CSV-export helpers (`database/studio_history.sqlite`, gitignored).
- `pricing-formulas.json`: Verified WaveSpeed JSONata pricing formula cache, `base_price_micro`, `discount_rate`, and `price_inputs`.
- `public/`: Frontend Studio SPA (`index.html`, `style.css`, `app.js`).
- `scripts/verify_studio_isolated.js`: Isolated test suite (runs pricing formula matrix, simulated DOM checks, SQLite CRUD, and temp mock HTTP checks without touching live WaveSpeed credits).
- `scripts/sync_pricing_formulas.js`: Read-only WaveSpeed catalog & RSC pricing formula synchronizer.
- `scripts/launch_studio.ps1`: Safe Windows PowerShell launcher (health check, port-owner verification, optional `-Restart`, `-Stop`, `-Status`, `-Background`).

## 3. Secrets Hygiene
- Never commit API keys, `.env`, `.studio-config.json`, `outputs/`, `logs/`, or `database/*.sqlite*` files.
- API keys come only from `process.env.WAVESPEED_API_KEY`, gitignored `.env`, or gitignored `.studio-config.json` (set via `POST /api/config`).
