---
Coding Project Note: true
Note Creation Date: "2026-11-14T15:59:27-03:00"
Note Modified Date:
  - "2026-11-14T15:59:27-03:00"
  - "2026-11-16T00:57:34-03:00"
---

# 2026-11-14T15:59:27-03:00 — Project Handover Scaffold: WaveSpeed Studio

> **Scaffold status:** Initial canonical handover scaffold created for review before expanding deep architectural walkthroughs or committing documentation changes to git.

# Recording timestamp — purpose

This timestamp records when the handover scaffold was created. It is not a runtime or source-event timestamp.

## What matters

**One-line result:** **WaveSpeed Studio** (`v1.0.2`) is a local-first Node.js (`>=22.5.0`) + SQLite + vanilla Web UI + Electron Windows desktop studio for WaveSpeed AI image/video generation, packaged via GitHub Actions into Windows `.exe`/`.msi` installers while preserving a separate personal localhost copy in `D:\Cocoding\Aimagen Nsfw`.

For the next AI or developer, the most important distinction is that **source code lives in one place**, **your live desktop settings/history live in Windows AppData**, **generated outputs save to your chosen folder (`D:\wvst`)**, and **your original personal workspace remains untouched in `D:\Cocoding\Aimagen Nsfw`**.

## Task boundary

- **Reason (User-stated):** Starting a fresh chat cleanly after building, packaging, debugging GPU/video preview corruption, and shipping `v1.0.0`–`v1.0.2`; user requested exact folder locations, a new-chat recommendation, and a scaffolded handover explaining the app and how it works.
- **Originating context:** Previous multi-compaction session that migrated/sanitized the studio into `D:\Cocoding\wavespeed-studio`, wrapped Electron, configured GitHub Actions releases, and published `v1.0.0`–`v1.0.2`.
- **Recipient target:** Fresh Antigravity chat opened with `D:\Cocoding\wavespeed-studio` set as the active workspace.
- **Origin recovery:** No private chat transcript is required; durable state lives in `D:\Cocoding\wavespeed-studio\documentation\PROJECT LOG.md` and git history (`49e5fbe` on `main`).

## Mission and authorization

- **Goal:** Maintain, extend, document, and release the standalone **WaveSpeed Studio** desktop & local web app cleanly without leaking secrets or spending real WaveSpeed API credits automatically.
- **Permitted automated operations:** Read-only WaveSpeed catalog/balance/RSC queries, local `npm test` (`verify_studio_isolated.js`), `node --check`, `--smoke-test` desktop harness launches, and secret scans.
- **Non-negotiable restrictions:**
  - **ZERO AUTOMATED SPEND:** Never call `POST https://api.wavespeed.ai/api/v3/{model_id}` or `POST http://localhost:3000/api/generate` from scripts, tests, or CLI tools.
  - **Secrets hygiene:** Never commit `.env`, `.studio-config.json`, SQLite files, logs, or generated media to git.
  - **Requires explicit user approval before running:** `git push`, `git tag`, overwriting personal files in `D:\Cocoding\Aimagen Nsfw`, or running any paid endpoint.

## Roots and authoritative files

### Exact Local Roots on This Machine

1. **Canonical Standalone Repo & Desktop App (USE THIS FOR DEVELOPMENT & RELEASES):**
   - `D:\Cocoding\wavespeed-studio`
2. **Original Personal Localhost Studio Workspace (DO NOT MIX WITH PUBLIC REPO):**
   - `D:\Cocoding\Aimagen Nsfw`
   - Holds personal API config, earlier Python audit/pricing scripts (`D:\Cocoding\Aimagen Nsfw\scripts\*.py`), local outputs (`D:\Cocoding\Aimagen Nsfw\outputs`), logs, and localhost `Launch Studio.cmd` workflow.
3. **Installed Desktop Application (`v1.0.0` currently observed on disk):**
   - `D:\wvst\WaveSpeed Studio\WaveSpeed Studio.exe`
   - Uninstaller: `D:\wvst\WaveSpeed Studio\Uninstall WaveSpeed Studio.exe`
   - Upgrade lookup key: `HKCU:\Software\77ead6d5-548f-54a6-b3e1-946daa575e20\InstallLocation`
4. **Live Desktop User Data (Config, SQLite History DB, Logs):**
   - `C:\Users\psyco\AppData\Roaming\wavespeed-studio`
   - Contains `.studio-config.json`, `database\studio_history.sqlite`, `logs\server.log`, `pricing-formulas.json`.
5. **Configured Desktop Generated Media Folder:**
   - `D:\wvst` (`D:\wvst\images`, `D:\wvst\metadata`, `D:\wvst\videos`; default fallback when unset is `E:\OneDrive\Documents\WaveSpeed Studio\outputs`).

### Compact Folder Tree (`D:\Cocoding\wavespeed-studio`)

```text
D:\Cocoding\wavespeed-studio\
├── .github\workflows\build-release.yml   # Ubuntu test + Windows NSIS/MSI build + smoke test + GitHub Release
├── assets\                               # icon.ico, icon.png
├── database\history_db.js                # Built-in node:sqlite schema, CRUD, CSV export, multi-root output lookup
├── dist\                                 # Gitignored local electron-builder outputs (currently local v1.0.0 build)
├── documentation\                        # Project notes (YAML + append-only timestamps)
│   ├── START HERE.md
│   ├── PROJECT LOG.md
│   └── PROJECT HANDOVER.md               # This handover scaffold
├── electron\
│   ├── main.js                           # Electron shell, embedded server, Chromium GPU flags, menus, updates
│   └── preload.js                        # Safe IPC bridge (window.waveSpeedDesktop.selectOutputsFolder)
├── public\
│   ├── index.html                        # Studio UI shell
│   ├── app.js                            # Frontend logic (tabs, pricing evaluation, mask canvas, history viewer)
│   └── style.css                         # Dark studio UI styles
├── scripts\
│   ├── generate_icon.js                  # Generates assets/icon.png and assets/icon.ico
│   ├── launch_studio.ps1                 # Safe Windows localhost launcher/status script
│   ├── sync_pricing_formulas.js          # Read-only WaveSpeed catalog + RSC pricing formula sync
│   ├── test_formula_eval.js              # Formula evaluator standalone test
│   └── verify_studio_isolated.js         # Isolated test suite (npm test, zero live spend)
├── AGENTS.md                             # Workspace agent rules & safety boundaries
├── Launch Studio.cmd / start.bat         # Windows localhost double-click launchers
├── package.json                          # Scripts, dependencies, electron-builder NSIS/MSI config (v1.0.2)
├── pricing-formulas.json                 # Cached JSONata pricing formulas + base prices + discounts
├── README.md                             # User/repo setup & build guide
└── server.js                             # Zero-dependency Node HTTP server, API proxy, media saver, /outputs/* streamer
```

### Authoritative Reading Order (Absolute Local Paths)

1. `D:\Cocoding\wavespeed-studio\AGENTS.md` — Mandatory zero-spend credit protection and secrets hygiene rules.
2. `D:\Cocoding\wavespeed-studio\documentation\PROJECT HANDOVER.md` — Canonical handover map, architecture, and next action.
3. `D:\Cocoding\wavespeed-studio\documentation\START HERE.md` — Quick orientation and runtime layout.
4. `D:\Cocoding\wavespeed-studio\documentation\PROJECT LOG.md` — Chronological history of releases `v1.0.0`–`v1.0.2`, fixes, and verification runs.
5. `D:\Cocoding\wavespeed-studio\package.json` — Version, scripts, and `electron-builder` packaging configuration.
6. `D:\Cocoding\wavespeed-studio\electron\main.js` — Desktop lifecycle, Chromium switches, menu actions, and AppData paths.
7. `D:\Cocoding\wavespeed-studio\server.js` — Core backend routes, `.studio-config.json`, `/outputs/*` streaming, and asset download pipeline.

### Optional Remote Mirror

- **GitHub Private Repository:** `https://github.com/Cameldroid/wavespeed-studio` (`main` branch, latest verified release tag `v1.0.2`).
- Treat local files under `D:\Cocoding\wavespeed-studio` as authoritative; GitHub is a remote mirror and CI build target.

## How the App Works (Architecture Scaffold)

> **Scaffold Note:** Outline established from observed files (`AGENTS.md`, `START HERE.md`, `package.json`, `PROJECT LOG.md`). Confirm with the user whether to expand each subsection into detailed endpoint/UI walkthroughs or keep concise.

1. **Two Ways to Run the Same Core Engine:**
   - **Desktop App Mode (`npm run desktop` or installed `WaveSpeed Studio.exe`):** `D:\Cocoding\wavespeed-studio\electron\main.js` boots, picks a free localhost port on `127.0.0.1`, points data storage to `%AppData%\wavespeed-studio`, launches `server.js` inside Electron's Node runtime, and opens a `BrowserWindow` pointed at that local server.
   - **Browser / Localhost Mode (`npm start` or `start.bat`):** `D:\Cocoding\wavespeed-studio\server.js` runs directly on `PORT` (default `3000`) and serves `D:\Cocoding\wavespeed-studio\public` to any browser.
2. **Backend & Data Flow (`server.js` + `database/history_db.js`):**
   - Loads API key and preferences (`apiKey`, `outputsDir`, `softwareGraphicsMode`) from `.env` and `.studio-config.json`.
   - Fetches WaveSpeed catalog/balance, syncs RSC JSONata pricing formulas into `pricing-formulas.json`, submits user-triggered jobs only on explicit UI click, polls results, downloads finished media locally to the configured outputs folder (`images/`, `videos/`, `metadata/`), and records runs/outputs in `studio_history.sqlite` (`node:sqlite`).
   - Serves saved media via `/outputs/*` with HTTP `HEAD`, byte `Range` requests, and aborted-stream cleanup.
3. **Frontend UI (`public/index.html`, `public/app.js`, `public/style.css`):**
   - Schema-driven workspace (Text-to-Image, Image Edit/Inpaint mask canvas, Video / I2V with audio toggle controls, Utilities).
   - Evaluates model pricing live per parameter selection, displays balance & history gallery, and supports custom outputs folder selection via `electron/preload.js` (`studio:select-outputs-folder`).
4. **Electron Graphics & Diagnostics (`electron/main.js`):**
   - Disables hardware video decode (`disable-accelerated-video-decode`) and GPU rasterization (`disable-gpu-rasterization`) at startup to prevent rainbow 16x16 macroblock artifacts on hybrid Intel/NVIDIA Windows GPUs.
   - Exposes `View -> Software Graphics Mode (Fix GPU Artifacts / Restart)`, `Help -> Graphics & Decoder Diagnostics`, and `Help -> Check for Updates...`.

## Current state and evidence

- **Observed latest code & release state (`wavespeed-studio`):**
  - Branch `main` at commit `49e5fbe`, tagged `v1.0.2`.
  - GitHub Actions run `43627568619` passed (`test` + `build-windows` with CI `--smoke-test`) and published `https://github.com/Cameldroid/wavespeed-studio/releases/tag/v1.0.2` (`WaveSpeed.Studio.Setup.1.0.2.exe`, `WaveSpeed.Studio.1.0.2.msi`, `SHA256SUMS.txt`).
  - Local checks run before pushing `v1.0.2`: `npm test` (`ALL_ISOLATED_TESTS_PASSED`), Electron `--smoke-test` (`SMOKE=0 DB_OK=True`), and secret scan (`ZERO_SECRET_HITS`).
- **Observed state on user's machine (`2026-11-14`):**
  - Installed copy at `D:\wvst\WaveSpeed Studio` is from earlier `v1.0.0` (while `v1.0.2` is live on GitHub Releases).
  - Local `D:\Cocoding\wavespeed-studio\dist` still holds earlier `1.0.0` local build artifacts (`dist/` is gitignored).
- **Deferred / pending real-world verification:**
  - User has **not yet installed `v1.0.2` on their laptop** to confirm in live usage that: (1) NSIS detects `D:\wvst\WaveSpeed Studio` via `HKCU` and upgrades cleanly preserving `%AppData%\wavespeed-studio` + `D:\wvst`, and (2) the rainbow macroblock viewer glitch stays eliminated during real video/image previews on their Intel HD 520 + NVIDIA 940M system.
- **Sibling repo state (`D:\Cocoding\Aimagen Nsfw`):**
  - Intact personal localhost setup; earlier received video audio option parity and `/outputs/*` streaming cleanup (`server.js`). Reconcile only if user asks to keep using both long-term.

## Interfaces and data contract

- **Desktop AppData config (`C:\Users\psyco\AppData\Roaming\wavespeed-studio\.studio-config.json`):** Stores local API key, custom `outputsDir`, and `softwareGraphicsMode` boolean. Preserved across NSIS upgrades/uninstalls (`"deleteAppDataOnUninstall": false` in `package.json`).
- **SQLite Ledger (`database/history_db.js`):** Zero-dependency `node:sqlite` (`DatabaseSync`) tracking runs, parameters, costs, and output paths across active and previously configured output folders.
- **Installer Upgrade Contract (`package.json` `build.nsis`):** Per-user NSIS (`perMachine: false`, `oneClick: false`, `allowToChangeInstallationDirectory: true`, `deleteAppDataOnUninstall: false`) writes/reads `InstallLocation` in `HKCU:\Software\77ead6d5-548f-54a6-b3e1-946daa575e20`.

## Implementation pipeline

1. Edit source in `D:\Cocoding\wavespeed-studio` (or sync shared backend/UI changes carefully if user still wants `D:\Cocoding\Aimagen Nsfw` updated).
2. Run zero-spend local verification:
   - `node --check server.js` and `node --check electron/main.js`
   - `npm test` (`node scripts/verify_studio_isolated.js`)
   - Electron headless smoke check (`--smoke-test`)
   - Secret scan confirming zero keys/configs tracked in git.
3. Update `package.json` version and append entry to `D:\Cocoding\wavespeed-studio\documentation\PROJECT LOG.md` (and `PROJECT HANDOVER.md` if architecture/state changed).
4. With user approval: commit, push `main`, and push annotated tag `vX.Y.Z` -> `.github/workflows/build-release.yml` automatically runs tests, builds Windows `.exe`/`.msi`, runs built-binary `--smoke-test`, generates `SHA256SUMS.txt`, and publishes GitHub Release.
5. Download & run `WaveSpeed.Studio.Setup.X.Y.Z.exe` to update `D:\wvst\WaveSpeed Studio` in place.

## Acceptance criteria

- Handover scaffold covers exact local paths, separation of concerns (`wavespeed-studio` vs `Aimagen Nsfw` vs AppData vs `D:\wvst`), safety boundaries, and starter architecture without unverified claims.
- *(Pending expansion/finalization after user confirms scaffold scope)* Fresh AI chat can open `D:\Cocoding\wavespeed-studio` and explain/maintain every subsystem cleanly using `PROJECT HANDOVER.md` alone.

## Exact next action

1. **User review of this scaffold:** Confirm what sections in `D:\Cocoding\wavespeed-studio\documentation\PROJECT HANDOVER.md` should be fleshed out next (e.g., full "How It Works" breakdown of UI tabs, API/pricing flow, Electron IPC, and NSIS update/diagnostics guide) before finalizing and committing it.
2. **After handover is finalized & user switches to a fresh chat:** Set `D:\Cocoding\wavespeed-studio` as the active workspace, download & install `v1.0.2` from GitHub Releases (`https://github.com/Cameldroid/wavespeed-studio/releases/tag/v1.0.2`) over `D:\wvst\WaveSpeed Studio`, and test real preview rendering + `Help -> Graphics & Decoder Diagnostics`.


# 2026-11-16T00:57:34-03:00 — v1.0.3 Update: R2V Multimodal Self-Upload, Timeline Frame Picker & Quality/Upscale Workflow

- **Supersedes in part:** Current state / feature map above moves from `v1.0.2` to **`v1.0.3`**.
- **What changed for `v1.0.3`:**
  - Dedicated **`🧬 Ref → Video`** (`ref-to-video`) tab in `D:\Cocoding\wavespeed-studio\public\index.html`, with universal schema mapping across `reference_videos`, `videos` (Kling 4.0 / PixVerse), `ref_videos` (SkyReels), and `reference_files` (Wan 2.6), plus `reference_audios`/`audios` uploads and numbered `Image 1`, `Video 1`, `Audio 1` chips & badges.
  - Added streaming binary `POST /api/upload-raw` (`up to 200 MB`) in `D:\Cocoding\wavespeed-studio\server.js` alongside `POST /api/upload` so video/audio files upload without base64 bloat.
  - Added `$0.00` **Video Timeline & Frame Picker** (8-frame thumbnail strip, scrubber, frame stepper, 1-click extraction to Source Image / End Frame / Ref Images) and **Resolution Mismatch Advisory** with optional `wavespeed-ai/real-esrgan` pre-upscale toggle + `✂️ Tools` routing for `upscale-video` (`target_resolution` support).
- **Updated Exact Next Action:** Run local verification + release build, update `D:\wvst\WaveSpeed Studio` cleanly to `v1.0.3`, and verify live desktop startup.
