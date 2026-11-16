---
Coding Project Note: true
Note Creation Date: "2026-11-16T16:59:09-03:00"
Note Modified Date:
  - "2026-11-16T16:59:09-03:00"
  - "2026-11-16T17:25:30-03:00"
---

# 2026-11-16T16:59:09-03:00 — Feature Spec: Face Crop Studio (`cropped_imgs`), Origin Provenance & Face Study Prompt Library (`v1.2.0`)

- **Status:** `In Progress`
- **Target Version:** `v1.2.0`

## 1. Goal & User Problem
When feeding wide or full-body reference photos into Seedream 5.5, MiniMax H3, or Face Swap models, background clutter wastes reference resolution. Users want a fast local **Face Crop Studio** (supporting both **Rectangle** and **Free-Form Lasso** selection) that saves crops cleanly to `<outputsDir>/cropped_imgs/` (e.g. `D:\wvst\cropped_imgs\`), indexes them in SQLite (`studio_history.sqlite`) with **full origin provenance** (`origin_filename` + `cropped_filename`), lets users choose whether to **Add Crop to Refs**, **Replace This Ref**, or **Add to Face Pack**, and provides a searchable/editable **Face Study Prompt Library** (`Anatomy & Essence`, `Lighting`, `Expressions`, `Angles & Framing`, plus custom saved prompts).

## 2. Files Likely Touched
- `database/history_db.js` — Add `cropped_assets` & `face_study_prompts` tables, seed curated Face Study prompt templates, preserve `origin_filename` / `origin_url` inside `input_sources` provenance, and export CRUD helpers.
- `server.js` — Add `OUTPUTS_CROPPED_DIR = path.join(OUTPUTS_DIR, 'cropped_imgs')`, `POST /api/crops/save`, `GET /api/crops`, `POST /api/crops/delete` (403 traversal-guarded), and `GET/POST /api/face-prompts` endpoints.
- `public/index.html` — Add `#faceCropModal` (Rectangle + Free-Form Lasso modes, Saved Cropped Faces tray, Add/Replace/Face-Pack actions), `✂️ Crop` triggers on Source Image, Reference thumbnails, Active Output Inspector, & Pipeline Preset, plus `📚 Study Prompts` popover (`#faceStudyPromptsMenu`) inside `#faceStudyBar`.
- `public/style.css` — Styling for `#faceCropModal`, interactive crop canvas, lasso overlay, saved crop tray, and Face Study Prompt Library popover.
- `public/app.js` — Canvas cropper engine (`openFaceCropModal`, rect & free-form lasso selection, PNG export with neutral gray or transparent alpha backdrop), `/api/crops/*` integration, `origin_filename` propagation in `buildInputSourcesMetadata`, and `/api/face-prompts` library with model-aware `<Picture N>` vs `Image N` adaptation.
- `scripts/verify_studio_isolated.js` — Isolated SQLite tests (`cropped_assets`, `face_study_prompts`, origin provenance in `generations`), mock HTTP tests (`/api/crops/save`, `/api/crops`, `/api/crops/delete` 403 traversal, `/api/face-prompts`), and simulated DOM assertions.

## 3. Design & Acceptance Criteria
- [ ] **Local Face Cropper (`#faceCropModal`):** Supports **Rectangle (`1:1` / `Free`)** and **Free-Form Lasso** (`Transparent PNG` or `Neutral Gray` outside mask) from Source Image, any Reference Image thumbnail, Active Output, or Pipeline Preset.
- [ ] **Persistent `cropped_imgs` Folder & SQLite Table:** `POST /api/crops/save` writes PNG into `<outputsDir>/cropped_imgs/` and stores metadata (`origin_filename`, `origin_filepath`, `origin_url`, `crop_mode`, dimensions) in `cropped_assets`.
- [ ] **Non-Destructive Ref Options & Dual Provenance:** Users choose **+ Add Crop to Refs**, **🔄 Replace This Ref**, **👤 Save to Face Pack**, or **🎯 Set as Source/Preset**; `input_sources` & Active Output Inspector display both cropped & origin filenames.
- [ ] **Face Study Prompt Library (`📚 Study Prompts`):** Categorized & searchable SQLite-backed library (Anatomy, Lighting, Expressions including smile/pout/frown/cheeky/playful tongue-out, Angles, and Custom user prompts) with model-aware `<Picture N>` vs `Image N` formatting and `+ Save Custom`.

## 4. Zero-Spend Verification Plan
- `node --check` across all modified JS files.
- `npm test` (`scripts/verify_studio_isolated.js`) covering SQLite, HTTP guards, and simulated DOM.
- Headless Chromium Playwright E2E verifying Face Crop Modal (Rectangle + Lasso), `/api/crops/save`, Add/Replace ref, Saved Crops tray, and `📚 Study Prompts` library with `0` page/console errors.
- `npx electron . --smoke-test` + secret scan.


# 2026-11-16T17:25:30-03:00 — Completed & Verified (`v1.2.0`)

- **Supersedes Initial Status (`In Progress` -> `Done`):** All 4 acceptance criteria implemented and verified offline with zero live WaveSpeed API spend.
- **Delivered:**
  - `database/history_db.js`: Added `cropped_assets` (`crop_id`, `filename`, `local_url`, `local_path`, `origin_filename`, `origin_filepath`, `origin_url`, `crop_mode`, dimensions, `created_at`) and `face_study_prompts` tables (12 seeded built-in prompts across `Anatomy & Essence`, `Lighting`, `Expressions`, `Angles & Framing` + custom saves), and extended `normalizeInputSources()` so both cropped and origin filenames are indexed in `input_filenames` / FTS5.
  - `server.js`: Added `OUTPUTS_CROPPED_DIR = path.join(OUTPUTS_DIR, 'cropped_imgs')`, `/api/config.croppedDir`, `GET /api/crops`, `POST /api/crops/save`, `POST /api/crops/delete` (403 `isPathInside` guard), `GET /api/face-prompts`, `POST /api/face-prompts`, and `POST /api/face-prompts/delete`.
  - `public/index.html`, `public/style.css`, `public/app.js` (`?v=1.2.0`): Built `#faceCropModal` (Rectangle `1:1`/Free + Free-Form Lasso w/ Neutral Gray or Transparent PNG, `➕ Add Crop to Refs`, `🔄 Replace This Ref`, `👤 Save to Face Pack`, `🎯 Set as Source Image`, `#savedCroppedFacesGrid`), URL-ref origin basename extraction (`addExtraImageUrl`), dual `(from <origin>)` provenance badges, and `#faceStudyPromptsMenu` (`📚 Study Prompts`) with `<Picture N>` vs `Image N` adaptation.
- **Verification Evidence (Zero Live Spend):**
  - `node --check`: Passed on `server.js`, `database/history_db.js`, `public/app.js`, and `scripts/verify_studio_isolated.js`.
  - `npm test` (`ALL_ISOLATED_TESTS_PASSED`): Passed HTTP `/api/crops*` & `/api/face-prompts*` + 403 traversal checks, SQLite `cropped_assets` / `face_study_prompts` / `origin_filename` FTS5 search, and simulated DOM integration checks.
  - Headless Chromium Playwright E2E (`127.0.0.1:39116`, isolated `WAVESPEED_USER_DATA_DIR`, mocked `/api/models*` & `/api/balance`, `/api/generate` blocked): `0` `pageerror`s, `0` `console` errors; verified Rectangle drag-crop -> `/api/crops/save` -> `#multiImgGrid` (`from sample_origin_face.png`), Saved Crops grid, Free-Form Lasso mode switch, and `📚 Study Prompts` Expressions filtering + Playful Tongue-Out `Image 1` insertion.
