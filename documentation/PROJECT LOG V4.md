---
Coding Project Note: true
Note Creation Date: "2026-11-18T11:17:54-03:00"
Note Modified Date:
  - "2026-11-18T11:17:54-03:00"
---

# 2026-11-18T11:17:54-03:00 — Project Log V4 (Continuation — `v1.3.1`)

- **Continued From:** [PROJECT LOG V3.md](PROJECT%20LOG%20V3.md) (through `v1.3.0` on `2026-11-16T19:58:43-03:00`).
- **Continuity Summary:** Through `v1.3.0`, WaveSpeed Studio delivered live RSC JSONata pricing (`pricing-formulas.json`), SQLite + FTS5 run ledger (`studio_history.sqlite`), Local Face Crop Studio (`D:\wvst\cropped_imgs\`), Face Study Prompt Library, SHA-256 source identity tracking, Output Details & Provenance modal, and merged predecessor history from `D:\Cocoding\Aimagen Nsfw`.

# 2026-11-18T11:17:54-03:00 — v1.3.1 Shipped: Source Reuse & Insertion Fix, Collapsible Inputs, Mask Reorder, Quick-Run Buttons & Script Centralization

- **Outcome:** Fixed all reported failures around "Use as Source/Reference" and "Reuse Setup", resolved `.multi-img-thumb` clipping, moved Paint Region / Mask below Reference Images, made 9 input/parameter sections foldable, added Quick-Run header buttons, and centralized unconfigured script launches onto `%APPDATA%\wavespeed-studio`.
- **Specification & Files Changed:**
  - Feature spec: [features/05-collapsible-inputs-and-reuse-fix/SPEC.md](features/05-collapsible-inputs-and-reuse-fix/SPEC.md)
  - `server.js`: Added `resolveDefaultUserDataDir()` (unifies unconfigured script runs onto `%APPDATA%\wavespeed-studio` unless `wsk_mock_*`), added `GET /api/local-file` extension-guarded serving, enriched `listSavedOutputs()` with SQLite fields, extended `extractLocalMediaDiskPath()` / `resolveLocalMediaUrl()`, and added `target_image`, `source_image`, and `body_image` to `resolvePayloadMedia()`.
  - `public/index.html` & `public/style.css`: Moved `#maskCanvasGroup` below `#multiImageGroup`, added `#quickRunPromptBtn`, `#quickRunSourceBtn`, `#quickRunRefsBtn` with live price pills, added collapse headers/chevrons to 9 sections (`#negativePromptGroup`, `#imageInputGroup`, `#lastImageGroup`, `#multiImageGroup`, `#maskCanvasGroup` default collapsed, `#videoInputGroup`, `#refVideosGroup`, `#refAudiosGroup`, `#settingsSection`), bumped cache-bust query strings to `v=1.3.1`, and fixed `.multi-img-thumb` height clipping.
  - `public/app.js`: Added missing `getMultiImageSchemaKey`, `getLastImageSchemaKey`, `normalizeUsableMediaUrl`, `setCollapsibleGroupOpen`, `syncQuickRunPriceBadges`, `inferMediaName`, `applySingleSourceMediaObj`, `clearAllSourceImageSlots`; fixed `useImageAsInput` (T2I -> Seedream Edit switch, modal cleanup, auto-unfold), `reuseHistoryRun`, `sendToEditBtn` (preserves active `isImageEdit` model), `captureVideoFrameAndRoute`, `extractTimelineFrame`, and `applyCroppedAsSourceImage`; replaced inline `onclick` attributes in History DB and Output Details modals with DOM event listeners; wired quick-run and 9 collapse toggles.
  - `package.json` & `CHANGELOG.md`: Bumped to `1.3.1`.
  - `scripts/verify_studio_isolated.js`: Added `/api/local-file` HTTP/upload resolution checks plus DOM assertions for `wsAppUseInput`, `#maskCanvasGroup` placement/folding/Flux Fill unfold, `#toggleSettingsSectionBtn`, `#quickRunRefsBtn`, and `#sendToEditBtn`.
- **Installation Audit Finding (Observed):** Port `3000` was running `D:\nodejs\node.exe D:\Cocoding\wavespeed-studio\server.js` (`v1.3.0`) storing data in `C:\Users\psyco\AppData\Roaming\wavespeed-studio` and outputs in `D:\wvst`. Checked `%LOCALAPPDATA%\Programs\wavespeed-studio`, `%LOCALAPPDATA%\Programs\WaveSpeed Studio`, and `C:\Program Files\WaveSpeed Studio` — all returned `false` (no standalone `.exe` installation present on those paths; script launch via `Launch Studio.cmd` / `Launch Desktop.cmd` is the active deployment).
- **Verification (Zero Live API Spend):**
  - `node --check` passed on `server.js`, `database/history_db.js`, `public/app.js`, and `scripts/verify_studio_isolated.js`.
  - `npm test` (`node scripts/verify_studio_isolated.js`) passed completely (`ALL_ISOLATED_TESTS_PASSED`).
  - Final secret scan, post-doc `npm test`, `git push origin main --follow-tags`, and live `http://127.0.0.1:3000/api/config` verification follow next.
- **Next Action:** Complete git commit/tag/push `v1.3.1`, restart port `3000` daemon, and confirm live `GET /api/config` (`1.3.1`) and `GET /api/sources` (`200`).
