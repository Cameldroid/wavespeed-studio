---
Coding Project Note: true
Note Creation Date: "2026-11-18T11:17:54-03:00"
Note Modified Date:
  - "2026-11-18T11:17:54-03:00"
---

# 2026-11-18T11:17:54-03:00 — Collapsible Inputs, Quick-Run Buttons, Mask Reordering & Source Reuse Fix (`v1.3.1`)

- **Status:** `Shipped in v1.3.1`
- **Target Version:** `v1.3.1`

## 1. Goal & User Problem
1. **Source Insertion & Setup Reuse Failures:** Clicking `➕ Use as Source`, `🔁 Reuse Setup`, or `🖼️ Reuse Input Image(s)` failed due to an uncaught `ReferenceError` (`getMultiImageSchemaKey` / `getLastImageSchemaKey` undefined in `public/app.js`), unsafe inline `onclick="..."` string escaping in modals with Windows backslashes or quoted prompts, missing `/api/local-file` serving for local/Ditto source disk paths, and `.multi-img-thumb` CSS height clipping (`76px; overflow: hidden`) hiding role dropdowns and `from <origin_filename>` labels.
2. **Script vs Desktop Centralization:** Ensure running from scripts (`node server.js`, `npm start`, `Launch Studio.cmd`, or `Launch Desktop.cmd`) points to the unified user data directory (`%APPDATA%\wavespeed-studio` on Windows) unless explicitly mocked (`wsk_mock_*`), eliminating split SQLite DB / output paths between Electron and browser runs.
3. **Mask Position & Collapsible Sections:** Move `#maskCanvasGroup` below `#multiImageGroup` instead of immediately below the prompt box, default it folded unless `mask_image` / `markup_image` is required (or strokes exist / Flux Fill Dev is chosen), and make all input groups and `#settingsSection` foldable via header `▲`/`▼` toggles.
4. **Quick-Run Shortcuts:** Place `⚡ Run • $price` buttons near Prompt, Source Image, and Reference Images headers so users do not need to scroll down to the footer.

## 2. Files Modified
- `server.js`: Added `resolveDefaultUserDataDir()`, `/api/local-file` GET route with extension allowlist (`ALLOWED_LOCAL_MEDIA_EXTS`), enriched `listSavedOutputs()` with SQLite metadata (`prompt`, `parameters_json`, `input_image_url`, `input_video_url`, `input_sources_json`), updated `extractLocalMediaDiskPath()` / `resolveLocalMediaUrl()`, and extended `resolvePayloadMedia()` with `target_image`, `source_image`, and `body_image`.
- `public/index.html`: Bumped asset query strings (`?v=1.3.1`), added `#quickRunPromptBtn`/`#quickRunPromptPrice`, `#quickRunSourceBtn`/`#quickRunSourcePrice`, `#quickRunRefsBtn`/`#quickRunRefsPrice`, `#multiImageCountBadge`, moved `#maskCanvasGroup` below `#multiImageGroup` (default folded), and wrapped 9 input/parameter bodies in collapsible containers with toggle buttons/chevrons.
- `public/style.css`: Fixed `.multi-img-thumb` auto-height flex layout (`img { height: 76px }`), repositioned `.multi-img-badge` (`top: 54px`), and added `.collapsible-group-body`, `.group-collapse-btn`, `.is-collapsed`, `.mask-collapse-btn`, `.btn-quick-run`, `.quick-run-price`, and `.ref-count-pill`.
- `public/app.js`: Added `getMultiImageSchemaKey`, `getLastImageSchemaKey`, `normalizeUsableMediaUrl`, `setCollapsibleGroupOpen`, `syncQuickRunPriceBadges`, `inferMediaName`, `applySingleSourceMediaObj`, `clearAllSourceImageSlots`; fixed `useImageAsInput`, `reuseHistoryRun`, `sendToEditBtn`, `captureVideoFrameAndRoute`, `extractTimelineFrame`, `applyCroppedAsSourceImage`; replaced inline `onclick` strings in `#historyDbModal` and `#outputDetailsModal` with safe DOM listeners; wired quick-run buttons and 9 collapse toggles.
- `scripts/verify_studio_isolated.js`: Added `/api/local-file` HTTP + `resolveLocalMediaUrl` tests and simulated DOM assertions for T2I-to-Edit `wsAppUseInput`, `#maskCanvasGroup` placement/folding/Flux Fill unfold, `#toggleSettingsSectionBtn`, `#quickRunRefsBtn` price + dispatch, and `#sendToEditBtn` on multi-image models.

## 3. Acceptance Criteria
- [x] `wsAppUseInput` from Text-to-Image switches to `bytedance/seedream-v5.5/edit`, populates `#multiImgGrid`, and opens `#multiImageBody`.
- [x] `reuseHistoryRun` and `#sendToEditBtn` clear stale image slots cleanly and preserve active `isImageEdit` models when appropriate.
- [x] `#maskCanvasGroup` sits below `#multiImageGroup`, starts collapsed on Seedream Edit, toggles manually, and auto-unfolds on `wavespeed-ai/flux-fill-dev`.
- [x] All 9 collapsible groups toggle cleanly and quick-run buttons display live prices and dispatch runs.
- [x] Unconfigured `node server.js` defaults `USER_DATA_DIR` to `%APPDATA%\wavespeed-studio` (Verified live and skipped during `wsk_mock_*` tests).

## 4. Zero-Spend Verification
- `node --check server.js database/history_db.js public/app.js scripts/verify_studio_isolated.js` -> passed (`SYNTAX_OK`).
- `npm test` (`node scripts/verify_studio_isolated.js`) -> `ALL_ISOLATED_TESTS_PASSED`.
- Live local server check against `http://127.0.0.1:3000/api/config` (`version: "1.3.1"`, `outputsDir: "D:\\wvst"`) and `GET /api/sources`.
