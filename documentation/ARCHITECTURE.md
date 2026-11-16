---
Coding Project Note: true
Note Creation Date: "2026-11-16T03:08:00-03:00"
Note Modified Date:
  - "2026-11-16T03:08:00-03:00"
---

# 2026-11-16T03:08:00-03:00 — Architecture & How WaveSpeed Studio Works

## 1. Purpose & Design Philosophy
**WaveSpeed Studio** is a zero-runtime-dependency Node.js (`>=22.5.0`) + Electron desktop/web application wrapping WaveSpeedAI's REST API, live React Server Component (RSC) dynamic pricing formulas, local disk archival, and SQLite run ledger without hardcoding secrets or polluting git history.

## 2. Repository & Runtime File Map
- **`server.js`** — Core HTTP server (`PORT` default `3000`, host `localhost`):
  - Resolves `APP_RESOURCES_DIR` (`WAVESPEED_RESOURCES_DIR` or `__dirname`) for bundled read-only UI/assets, separate from `USER_DATA_DIR` (`WAVESPEED_USER_DATA_DIR` / `WAVESPEED_STUDIO_ROOT` or `__dirname`) for `.env`, `.studio-config.json`, `database/`, `logs/`, and `outputs/`.
  - `getModels()` fetches `GET /api/v3/models` + WaveSpeed public discount catalog, applies `PINNED_ORDER`, filters noisy LoRA/trainer entries, assigns readable labels (`getCleanModelTitle()`), and merges bundled `pricing-formulas.json`.
  - Media endpoints: `POST /api/upload` (base64) and `POST /api/upload-raw` (streaming binary up to 200 MB for R2V video/audio clips).
  - Generation lifecycle: `POST /api/generate` forwards to `https://api.wavespeed.ai/api/v3/{model_id}`, tracks job metadata in SQLite, polls `GET /api/task/:id`, downloads outputs via `saveOutputLocally()` into `<outputs>/images/` or `<outputs>/videos/` with `<outputs>/metadata/*.json`, and serves `<outputs>/*` with `HTTP 206 Partial Content` / `Accept-Ranges: bytes`.
- **`public/index.html`, `public/app.js`, `public/style.css`** — Vanilla frontend SPA:
  - **6 Studio Tabs:** `Text → Image` (`image-gen`), `Image Edit` (`image-edit`), `Image → Video` (`image-to-video`), `Ref → Video` (`ref-to-video`), `Video & Edit` (`video-gen`), `Tools` (`utility`).
  - **Schema-driven UI (`adaptUIForModel`):** Reads `model.schema.properties` & `required` dynamically to show/hide single image (`image` or `face_image`), `last_image`, `multiImageGroup` (`images` / `reference_images` / `reference_files`, badged `Image 1..N`), `refVideosGroup` (`reference_videos` / `videos` / `ref_videos` / `reference_files`), `refAudiosGroup` (`reference_audios` / `audios` / `audio`), mask canvas, audio toggle (`generate_audio` / `enable_audio` / `with_audio`), resolution, duration, aspect ratio, seed, and `USE_CASE_ADVISORY_MAP` workflow banners.
  - **Pricing & Cost Safety:** Evaluates WaveSpeed RSC pricing formulas client-side before clicking Run, enforces **Economy Defaults** (lowest non-duration tiers + silent audio by default), and triggers **Spend Guard** above the configurable dollar threshold.
  - **Local Video Timeline & Frame Picker (`openVideoInTimeline`, `generateTimelineFilmstrip`, `extractTimelineFrame`):** Scrub local or saved videos at `$0.00` API cost and send extracted PNG frames straight into Source Image, End Frame, or Reference Images. Includes **Resolution Mismatch Advisory** + optional `wavespeed-ai/real-esrgan` pre-upscale or `Tools` video upscaler routing.
- **`database/history_db.js`** — Uses Node built-in `node:sqlite` (`DatabaseSync`) + FTS5 full-text index (`studio_history.sqlite`) storing every run's payload, status, cost, local outputs, favorites, and notes, plus `/api/history` search & CSV export.
- **`electron/main.js` & `.github/workflows/release.yml`** — Boots `server.js` dynamically inside Electron (`--smoke-test` verified in CI) and builds unsigned Windows `.exe` (NSIS) + `.msi` + `SHA256SUMS.txt` on every pushed `v*` tag.

## 3. How to Run, Package & Recreate Locally
1. **Requirements:** Node.js `>=22.5.0` (for `node:sqlite`). No native C++ compilation needed.
2. **Run from source (Web):** `Launch Studio.cmd` (`scripts/launch_studio.ps1`) -> `http://localhost:3000`.
3. **Run from source (Desktop Electron):** `Launch Desktop.cmd` (`npm run desktop`).
4. **Verify safely without spend:** `npm test` (`scripts/verify_studio_isolated.js`) + `npx electron . --smoke-test`.
5. **Release to GitHub:** Bump `package.json`, update docs, commit on `main`, create annotated tag (`git tag -a v1.0.x -m "..."`), and `git push origin main --follow-tags`.
