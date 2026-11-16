---
Coding Project Note: true
Note Creation Date: "2026-11-14T07:41:58-03:00"
Note Modified Date:
  - "2026-11-14T07:41:58-03:00"
  - "2026-11-14T07:49:36-03:00"
  - "2026-11-14T08:06:13-03:00"
  - "2026-11-14T08:42:43-03:00"
  - "2026-11-14T08:58:44-03:00"
  - "2026-11-14T13:49:12-03:00"
  - "2026-11-14T15:21:45-03:00"
  - "2026-11-14T15:36:03-03:00"
  - "2026-11-14T15:59:27-03:00"
  - "2026-11-16T00:57:34-03:00"
  - "2026-11-16T01:45:03-03:00"
  - "2026-11-16T01:59:25-03:00"
  - "2026-11-16T02:20:00-03:00"
  - "2026-11-16T03:08:00-03:00"
---

# 2026-11-14T07:41:58-03:00 — Initial Standalone Repository Creation

- **Summary:** Created clean standalone repository `wavespeed-studio` from the working studio application with all API keys, personal filesystem paths, private history, SQLite runtime files, logs, and generated media excluded.
- **Key Implementation Changes:**
  - `server.js`: Replaced hardcoded fallback key and canonical path with `.env` + `.studio-config.json` loading, `WAVESPEED_STUDIO_ROOT` / `__dirname` portable resolution, `requireApiKey()` 401 guard, `hasApiKey` flag on `GET /api/config`, and cross-platform `/api/open-folder` support.
  - `public/index.html` & `public/app.js`: Cleared default key input value, updated output folder placeholders to `./outputs`, and added clean `"No Key"` balance state when no API key is configured.
  - Added `.gitignore`, `.env.example`, `package.json`, `LICENSE`, `README.md`, `AGENTS.md`, and `documentation/START HERE.md`.
- **Verification:** Pending final secret audit, syntax checks, `npm test`, unauthenticated server smoke test, and private GitHub push.
- **Next Action:** Run secret scan, verification suite, and push initial `main` branch to private GitHub repository.


# 2026-11-14T07:49:36-03:00 — Pre-Release Secret Audit, Public Catalog Fallback & Test Verification

- **Summary:** Fixed unauthenticated catalog browsing and verified the clean standalone repo passes all checks with zero hardcoded keys, paths, databases, or generated outputs.
- **Fixes Applied:**
  - `server.js`: Extended `fetchCatalogDiscounts()` to return `{ catalogMap, catalogItems }` so `getModels()` falls back cleanly to the public `wavespeed.ai/api/models` catalog whenever `WAVESPEED_API_KEY` is not yet configured.
  - `public/app.js`: Reloads `fetchModels()` immediately after saving a new API key in Settings so full endpoint schemas populate seamlessly.
  - `scripts/verify_studio_isolated.js`: Sets a mock test key environment variable inside `runMockOutputAndServerTests()` before requiring `server.js` so isolated mock upload checks pass without `.env`.
- **Verification:**
  - Recursive secret scan: `0` matches for real API keys, tokens, or personal paths (`ZERO_SECRET_HITS`).
  - `node --check` passed on `server.js`, `public/app.js`, `database/history_db.js`, `scripts/verify_studio_isolated.js`, and `scripts/sync_pricing_formulas.js`.
  - `npm test`: Exited `0` (`ALL_ISOLATED_TESTS_PASSED`, 209 models x 7 resolutions matrix, simulated DOM, SQLite FTS5 CRUD, mock HTTP `/outputs/*` & traversal tests).
  - Unauthenticated port 3099 smoke test: `hasApiKey=False`, `/api/outputs` count `0`, `/api/balance` returned `401`, `/api/models` returned `762` curated models.
- **Next Action:** Initialize Git (`main` branch) and push initial commit to private GitHub repo `Cameldroid/wavespeed-studio`.


# 2026-11-14T08:06:13-03:00 — First-Run API Key Onboarding Modal & Dashboard Link

- **Summary:** Updated the Studio UI so first-time users without an API key automatically see an API key prompt on startup with a clickable link to generate their WaveSpeed key.
- **Changes (`public/index.html`, `public/app.js`):**
  - Added clickable `https://wavespeed.ai/accesskey` link (`#apiKeyGetLink`) and concise step-by-step instructions directly inside the API Settings modal.
  - Added `openApiKeyModal(isOnboarding)` in `public/app.js` and auto-opened it once on initial load whenever `/api/config` reports `hasApiKey === false` (or `/api/balance` returns `401`), while keeping `"Browse Models First"` dismissal optional.
- **Verification:** `node --check public/app.js` and `npm test` (`ALL_ISOLATED_TESTS_PASSED`) passed after edits with zero live API spend.
- **Next Action:** Decide on desktop packaging format (e.g., Electron `.exe`/`.msi` installer vs portable bundle) if distributing to non-technical users.


# 2026-11-14T08:42:43-03:00 — Electron Desktop Wrapper & Windows `.exe` / `.msi` Installers

- **Summary:** Wrapped WaveSpeed Studio in Electron (`^45.3.2`, bundled Node `v24.22.2` with verified native `node:sqlite`) and configured `electron-builder` (`^26.18.0`) to produce standalone Windows NSIS (`.exe`) and Windows Installer (`.msi`) packages alongside automated GitHub Actions CI & Releases.
- **Key Additions & Changes:**
  - `electron/main.js` & `electron/preload.js`: Single-instance Electron shell (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`), external browser routing (`wavespeed.ai/accesskey` via `shell.openExternal`), stable localhost port `38442` with ephemeral fallback, `--smoke-test` mode, and clean WAL-checkpoint shutdown.
  - `server.js` & `database/history_db.js`: Decoupled read-only resources (`APP_RESOURCES_DIR`) from writable `%AppData%\WaveSpeed Studio` (`USER_DATA_DIR`) and `Documents\WaveSpeed Studio\outputs` (`OUTPUTS_DIR`), fixed `PORT=0`, added `pricing-formulas.json` read-fallback + writable cache, expanded case-insensitive path guards (`isPathInside`), exported `startServer()` / `stopServer()` / `historyDb.close()`, and deferred startup DB sync off the critical boot path.
  - `public/app.js`: Removed `target="_blank"` download spawns, switched history CSV/JSON exports to `fetch` + `Blob` downloads, and replaced clipboard `alert()` with non-blocking toast.
  - `scripts/generate_icon.js`, `assets/icon.png`, `assets/icon.ico`: Zero-dependency multi-frame Windows ICO (`16/32/48/256`) and PNG icon assets.
  - `package.json`, `.gitignore`, `.github/workflows/build-release.yml`, `README.md`: Configured `nsis` (`oneClick: false`, `allowToChangeInstallationDirectory: true`, Desktop & Start Menu shortcuts) + `msi`, ignored `dist/`, and added automated test + Windows release artifact CI workflow.
- **Verification (Zero Live API Spend):**
  - Electron `node:sqlite` check: `ELECTRON_NODE v24.22.2 SQLITE_OK function`.
  - Built Windows installers cleanly via `npx electron-builder --win nsis msi --publish never`: `dist/WaveSpeed Studio Setup 1.0.0.exe` (`121,606,684` bytes) and `dist/WaveSpeed Studio 1.0.0.msi` (`127,131,648` bytes).
  - Packaged executable `dist\win-unpacked\WaveSpeed Studio.exe --smoke-test` exited `0`, initialized SQLite DB in temp `USER_DATA_DIR`, and rendered SPA cleanly.
- **Next Action:** Push commit to `main` (triggering GitHub Actions `test` CI) and optionally push a `v1.0.0` tag whenever ready to publish an automated GitHub Release with `.exe` and `.msi` installers.


# 2026-11-14T08:58:44-03:00 — Configurable Outputs Folder & Transparent Video Audio Controls

- **Summary:** Added a user-configurable **Outputs Save Folder** setting (with native Electron folder picker) persisted across restarts, and upgraded video audio controls across all models so audio toggle availability and cost impact are always visible on video tabs.
- **Changes Applied:**
  - `server.js`, `database/history_db.js`, `electron/preload.js`, `electron/main.js`: Updated `POST /api/config` to accept `outputsDir`, persist it to `.studio-config.json`, update active output directories and SQLite DB sync (`setOutputsDirs`), expose `getOutputsDir()`, and register the `studio:select-outputs-folder` native dialog IPC handler.
  - `public/index.html` & `public/app.js`: Added `#outputsDirInput` and `#browseOutputsDirBtn` to Settings (`#apiKeyModal`), added `getAudioSchemaKey()` supporting `generate_audio`, `sound`, `save_audio`, `keep_audio`, and `keep_original_sound`, and kept `#audioRow` visible on all video-tab models (showing `"Uncheck saves 33–50%"` when pricing formula uses the toggle, `"Same price (uncheck for silent)"` when free, `"Fixed audio / no toggle on model API"` disabled state when absent, or `"Enter API key to load toggles"` when unauthenticated).
- **Verification (Zero Live API Spend):**
  - `node --check` passed on `server.js`, `database/history_db.js`, `public/app.js`, `electron/main.js`, `electron/preload.js`, and `scripts/generate_icon.js`.
  - `npm test` (`scripts/verify_studio_isolated.js`): Exited `0` (`ALL_ISOLATED_TESTS_PASSED`).
  - Dynamic `POST /api/config` `outputsDir` persistence test (`CONFIG_OUTPUTS_DIR_TEST_OK`) and secret/personal-path scan (`ZERO_SECRET_HITS`) passed.
  - Electron dev smoke test (`DEV_SMOKE_EXIT=0 DB_EXISTS=True`), Windows installer rebuild (`npm run dist:win` -> `WaveSpeed Studio Setup 1.0.0.exe` `121,608,301` bytes + `WaveSpeed Studio 1.0.0.msi` `127,127,552` bytes), and packaged `WaveSpeed Studio.exe --smoke-test` (`PKG_EXIT=0 DB_CREATED=True`) passed.
- **Next Action:** Push to `origin/main` and publish a `v1.0.0` release tag whenever ready to attach `.exe` and `.msi` installers on GitHub Releases.


# 2026-11-14T13:49:12-03:00 — Hardened GitHub Release Pipeline & Tagged `v1.0.0`

- **Summary:** Updated the GitHub Actions release workflow to smoke-test the packaged Windows executable on CI, generate `SHA256SUMS.txt` checksums, and include clear first-time installer notes, then tagged and pushed `v1.0.0` to publish downloadable installers on GitHub Releases.
- **Changes Applied:**
  - `.github/workflows/build-release.yml`: Added packaged `WaveSpeed Studio.exe --smoke-test` verification step in `build-windows`, added `SHA256SUMS.txt` generation and artifact/release upload, and enabled `generate_release_notes: true` with user setup instructions (unsigned SmartScreen instructions, `https://wavespeed.ai/accesskey` link, and configurable outputs folder).
  - `README.md`: Documented customizable **Outputs Save Folder** in Settings.
- **Verification:** `npm test` (`ALL_ISOLATED_TESTS_PASSED`); committing, pushing `main`, pushing tag `v1.0.0`, and monitoring the GitHub Actions `Build and Release` workflow to completion.
- **Next Action:** Switch `Cameldroid/wavespeed-studio` visibility from Private to Public in GitHub repository settings whenever ready to share Releases with external users (kept Private by default).


# 2026-11-14T15:21:45-03:00 — Fix Chromium GPU/Video Rainbow Block Corruption (`v1.0.1`)

- **Summary:** Diagnosed rainbow checkerboard macroblock artifacts in Output viewer/gallery `<video>` and GPU-rasterized images (occurring on both `localhost` browsers and Electron on Intel HD Graphics 520 `31.0.101.2115` + NVIDIA 940M hybrid GPUs while external media files played cleanly), applied Electron GPU decoder/rasterization mitigations, hardened `/outputs/*` Range streaming, and bumped version to `1.0.1`.
- **Changes Applied:**
  - `electron/main.js`: Added startup switches `disable-accelerated-video-decode` and `disable-gpu-rasterization` before `app.whenReady()`, plus `View -> Software Graphics Mode (Fix GPU Artifacts / Restart)` menu checkbox persisted in `.studio-config.json` (`softwareGraphicsMode` -> `app.disableHardwareAcceleration()`).
  - `server.js`: Added `HEAD` support, proper suffix/bounds `Range` parsing, and `res.on('close')` stream cleanup on `/outputs/*`, and exported `saveStudioConfig`.
  - `package.json`: Bumped version to `1.0.1`.
- **Verification (Zero Live API Spend):**
  - `node --check` passed on `server.js` and `electron/main.js`.
  - `npm test` (`ALL_ISOLATED_TESTS_PASSED`).
  - Dual Electron `--smoke-test` (`SMOKE1=0` default + `SMOKE2=0` `softwareGraphicsMode: true`, `DB_OK=True`) and secret scan (`ZERO_SECRET_HITS`) passed.
- **Next Action:** Push `main` and tag `v1.0.1` so GitHub Actions builds and publishes updated installers.


# 2026-11-14T15:36:03-03:00 — In-App Update Check, Graphics Diagnostics & Seamless Upgrade Config (`v1.0.2`)

- **Summary:** Verified NSIS upgrade-in-place behavior (`HKCU\Software\77ead6d5-548f-54a6-b3e1-946daa575e20\InstallLocation`), explicitly preserved AppData across NSIS operations, and added in-app update checking + GPU decoder diagnostics (`v1.0.2`).
- **Changes Applied:**
  - `package.json`: Set `"deleteAppDataOnUninstall": false` inside `"nsis"` and bumped version to `1.0.2`.
  - `electron/main.js`: Added `Help -> Check for Updates...` (checks GitHub Releases API or opens Releases page directly while Private, explaining in-place NSIS upgrades preserve settings/DB) and `Help -> Graphics & Decoder Diagnostics` (displays live `app.getGPUFeatureStatus()` + `app.getGPUInfo('basic')` inside the desktop session).
- **Verification (Zero Live API Spend):**
  - `node --check electron/main.js`, `npm test` (`ALL_ISOLATED_TESTS_PASSED`), Electron `--smoke-test` (`SMOKE=0 DB_OK=True`), and secret scan (`ZERO_SECRET_HITS`) passed.
- **Next Action:** Push `main` and tag `v1.0.2` to publish updated Windows installers on GitHub Releases.


# 2026-11-14T15:59:27-03:00 — Initial Handover Scaffold Created

- **Summary:** Created initial scaffold `documentation/PROJECT HANDOVER.md` mapping exact local roots (`D:\Cocoding\wavespeed-studio`, `D:\Cocoding\Aimagen Nsfw`, `D:\wvst\WaveSpeed Studio`, `D:\wvst`, `C:\Users\psyco\AppData\Roaming\wavespeed-studio`), architecture blocks, release state (`v1.0.2` published on GitHub), and verification boundaries.
- **Documentation Changed:**
  - Created [PROJECT HANDOVER.md](file:///D:/Cocoding/wavespeed-studio/documentation/PROJECT%20HANDOVER.md) (scaffold awaiting user confirmation on depth/expansion before finalizing and committing).
  - Updated [PROJECT LOG.md](file:///D:/Cocoding/wavespeed-studio/documentation/PROJECT%20LOG.md).
- **Verification:** No application source modified; directory tree and authoritative files inspected directly prior to scaffolding.
- **Next Action:** Review handover scaffold scope with user, expand requested "How It Works" sections if needed, and prepare the fresh chat continuation prompt with `D:\Cocoding\wavespeed-studio` as active workspace.


# 2026-11-16T00:57:34-03:00 — R2V Multimodal Self-Upload, Timeline Frame Picker, Quality Advisory & Pre-Upscale (`v1.0.3`)

- **Summary:** Added dedicated `🧬 Ref → Video` tab, full self-upload/drag-drop + raw binary streaming for R2V reference videos & audios across all WaveSpeed schemas (`reference_videos`, `videos`, `ref_videos`, `reference_files`, `reference_audios`, `audios`), interactive `$0.00` Video Timeline & Frame Picker with 8-frame filmstrip thumbnails, resolution mismatch advisory with optional `wavespeed-ai/real-esrgan` pre-upscale toggle, `target_resolution` support, and moved video upscalers into `✂️ Tools` (`v1.0.3`).
- **Changes Applied:**
  - `server.js`: Added `parseRawBody()` + `POST /api/upload-raw` (up to 200 MB streaming binary uploads), `isReferenceToVideo` -> `ref-to-video` category, routed `upscale-video` / `video-tools` to `utility` (`Tools`), and extended `resolvePayloadMedia` with `ref_videos` & `audios`.
  - `public/index.html`, `public/style.css`, `public/app.js`: Added `🧬 Ref → Video` mode tab, `Image 1`/`Video 1`/`Audio 1` quick chips & slot badges, R2V video/audio upload dropzones + card lists, interactive `#videoTimelineGroup` scrubber + filmstrip + frame extraction buttons, `#inputQualityAdvisory` + optional Real-ESRGAN pre-upscale toggle integrated with pricing/Spend Guard, and `target_resolution` parameter support.
  - `scripts/verify_studio_isolated.js`: Added `POST /api/upload-raw`, `ref_videos`/`audios`, `ref-to-video` (`wan-3.0` + `kling-v4.0`), and `video-upscaler` (`target_resolution`) automated isolated assertions.
  - `package.json`: Bumped version to `1.0.3`.
- **Verification (Zero Live API Spend):** `node --check` passed on `server.js`, `public/app.js`, and `electron/main.js`; `npm test` (`ALL_ISOLATED_TESTS_PASSED`).
- **Next Action:** Run Electron `--smoke-test` + secret scan, commit & push `main` + tag `v1.0.3` for GitHub Actions release, build Windows installer, and update `D:\wvst\WaveSpeed Studio`.


# 2026-11-16T01:45:03-03:00 — Unified App Data Storage, Non-Destructive Legacy Merge & Playwright UI Fixes (`v1.0.4`)

- **Summary:** Consolidated personal localhost & desktop usage into the single `D:\Cocoding\wavespeed-studio` repo with external `%AppData%\wavespeed-studio` + `D:\wvst` storage, non-destructively copied/merged 82 legacy generations and 78 outputs from `D:\Cocoding\Aimagen Nsfw`, fixed two live-browser issues caught via Playwright (6-tab topbar clipping at `1536px` & `/favicon.ico` 404 console error), and added `Launch Desktop.cmd` so edits run directly from the repo without rebuilding installers (`v1.0.4`).
- **Changes Applied:**
  - `Launch Desktop.cmd` & `scripts/launch_studio.ps1`: Shared `%APPDATA%\wavespeed-studio` external user-data root across localhost (`Launch Studio.cmd`), live repo Electron (`Launch Desktop.cmd`), and installed `.exe`; fixed `Test-StudioHealth` for custom `D:\wvst` output folders.
  - `scripts/import_legacy_studio.js`: Added zero-secret, non-destructive migration script; merged `82` generations (`61` images, `17` videos, `78` metadata JSONs, `0` collisions) into `C:\Users\psyco\AppData\Roaming\wavespeed-studio\database\studio_history.sqlite` (`84` total runs, `80` outputs; pre-merge `.bak` saved).
  - `public/style.css`, `public/index.html`, `public/app.js`, `server.js`: Fixed topbar tab overflow (`clippedBtns: []`), added `/favicon.ico` + `/assets/icon.png` + audio MIME types, and synced timeline timecode readout on stepper clicks.
  - `package.json`: Bumped version to `1.0.4`.
- **Verification:** Playwright DOM/geometry/console/timeline inspection passed (`0` console errors/warnings, `topbarOverflow: false`, 8/8 filmstrip thumbnails, extracted frame -> `Image 1`); re-running `npm test`, `--smoke-test`, and secret scan before pushing `main` + `v1.0.4`.
- **Next Action:** Commit, push `main` + tag `v1.0.4` for GitHub Release CI, and confirm user's preference on keeping vs retiring `D:\Cocoding\Aimagen Nsfw`.


# 2026-11-16T01:59:25-03:00 — Video-Edit + Reference Images Support, Accurate Source-Clip Pricing & `face_image` Schema Support (`v1.0.5`)

- **Summary:** Improved Video-Edit (`alibaba/wan-3.0/video-edit`, `bytedance/seedance-2.5/video-edit`, `kwaivgi/kling-v4.0/video-edit`, `wavespeed-ai/openjutsu/character-swap`) visibility, pricing accuracy when schemas omit `duration`, and `face_image` upload slot mapping (`v1.0.5`).
- **Changes Applied:**
  - `server.js`: Added readable titles and `PINNED_ORDER` placement in `🎬 Video & Edit` for `alibaba/wan-3.0/video-edit`, `bytedance/seedance-2.5/video-edit`, `kwaivgi/kling-v4.0/video-edit`, and `wavespeed-ai/openjutsu/character-swap`.
  - `public/app.js`: Fixed `duration` fallback (`0` instead of `5` when `duration` is absent from schema) so Wan 3.0 Video-Edit evaluates source-clip duration accurately (`5s @ 480p = $0.50`, `15s @ 480p = $1.50`); added `getSingleImageSchemaKey()` (`image` | `face_image`); enabled `+ Image 1` reference chips & prompt guidance when Video-Edit schemas expose `reference_images`/`images`.
  - `scripts/verify_studio_isolated.js`: Added isolated pricing and simulated DOM tests for `alibaba/wan-3.0/video-edit` (`480p` default + ref images/audios + 5s/15s pricing) and `wavespeed-ai/video-face-swap` (`face_image` slot).
  - `package.json`: Bumped version to `1.0.5`.
- **Verification (Zero Live API Spend):** Re-ran `npm test` (`ALL_ISOLATED_TESTS_PASSED`), Electron `--smoke-test` (`SMOKE=0`), and secret scan (`ZERO_LIVE_SECRET_HITS`).
- **Next Action:** Push `main` + tag `v1.0.5`; user runs `Launch Desktop.cmd` directly from `D:\Cocoding\wavespeed-studio` or downloads `v1.0.5` from GitHub Releases when sharing with testers.


# 2026-11-16T02:20:00-03:00 — Default Preset Removal, Video-Edit + Ref Image Drag-and-Drop & Workflow Guidance, Zero-Spend Emulation (`v1.0.6`)

- **Summary:** Removed all built-in style/motion preset chips across menus while preserving R2V `+ Image 1` / `+ Video 1` / `+ Audio 1` insertion chips and `+ Save Preset`, added explicit step-by-step workflow guidance & drag-and-drop image support for `alibaba/wan-3.0/video-edit` (≤15s clip + Reference Images @ `480p`) and `reference-to-video` models, and verified end-to-end payload construction via zero-spend Playwright + isolated DOM tests (`v1.0.6`).
- **Changes Applied:**
  - `public/index.html` & `public/app.js`: Removed default style chips (`Cinematic`, `Cyberpunk`, `Portrait`, `Anime`) and `#videoMotionChips` (`Fluid Motion`, `Handheld`, `Slow Push-In`, `Slow-Mo`), keeping `#r2vRefChips`, `#customPromptChips`, and `#savePresetChipBtn`.
  - `public/app.js` & `public/style.css`: Added drag-and-drop image upload listeners & `.input-group.dragover` highlight on `#multiImageGroup`; added 15s clip auto-trim subtext on Wan 3.0 video inputs and step-by-step `USE_CASE_ADVISORY_MAP` guidance for `alibaba/wan-3.0/video-edit`, `alibaba/wan-3.0/reference-to-video`, generic `/video-edit`, and `/reference-to-video` models.
  - `scripts/verify_studio_isolated.js`: Added assertions verifying zero default presets remain and testing full zero-spend emulated `/api/generate` payload capture (`model_id: alibaba/wan-3.0/video-edit`, `video`, `reference_images`, `resolution: 480p`, `generate_audio: false`).
  - `package.json`: Bumped version to `1.0.6`.
- **Verification (Zero Live API Spend):** Re-ran `npm test` (`ALL_ISOLATED_TESTS_PASSED`), Chromium Playwright route-mocked E2E check against temporary port `39111` (`0` page errors, `0` clipped tabs, exact `wan-3.0/video-edit` payload captured cleanly), Electron `--smoke-test` (`SMOKE=0`), and live secret scan (`ZERO_LIVE_SECRET_HITS`).
- **Next Action:** Push `main` + tag `v1.0.6` for GitHub Releases CI and restart local port `3000` daemon so `http://localhost:3000` serves `v1.0.6`.


# 2026-11-16T03:08:00-03:00 — Log Rollover to V2

- `PROJECT LOG.md` exceeded 8,000 characters (`21,912` bytes through `v1.0.6`).
- All subsequent project log entries continue chronologically in [PROJECT LOG V2.md](PROJECT%20LOG%20V2.md).
