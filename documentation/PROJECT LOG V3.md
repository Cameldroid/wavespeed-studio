---
Coding Project Note: true
Note Creation Date: "2026-11-16T13:52:00-03:00"
Note Modified Date:
  - "2026-11-16T13:52:00-03:00"
  - "2026-11-16T15:05:00-03:00"
  - "2026-11-16T17:25:30-03:00"
---

# 2026-11-16T13:52:00-03:00 — Project Log V3 (Continuation — `v1.0.9`)

> **Continues from:** [PROJECT LOG V2.md](PROJECT%20LOG%20V2.md) (covers `v1.0.6`–`v1.0.8` through commit `5a09aa3`).

- **Continuity Snapshot as of `v1.0.8`:**
  - Self-healing RSC variable-pricing formulas (`seedream-v5.5/edit`, `minimax-h3/*`), universal drag-and-drop across all 7 media targets, and smart image/video moderation guidance live on `main` (`5a09aa3`).
- **Changes Applied in `v1.0.9`:**
  - `database/history_db.js`: Added safe `ALTER TABLE generations ADD COLUMN` migration for `input_sources_json`, `input_filenames`, and `input_filepaths`, indexed input filenames in `generations_fts`, updated `recordSubmission`, `recordOutputs`, `queryHistory`, `syncFromExistingFiles`, and `exportCsv`.
  - `server.js`: Pinned `wavespeed-ai/flux-fill-dev`, `bria/fibo-2.0/edit`, `ideogram-ai/ideogram-v3-turbo`, `wavespeed-ai/image-face-swap`, `wavespeed-ai/image-face-swap-pro`, `wavespeed-ai/image-head-swap`, `wavespeed-ai/image-body-swap`, and `wavespeed-ai/face-enhancer/image`; forwarded `input_sources` into metadata JSON and `historyDb`; added `POST /api/video/filmstrip` parallel FFmpeg keyframe endpoint for `/outputs/` videos.
  - `public/index.html`, `public/style.css`, `public/app.js`: Fixed duplicate `.workspace-panel` `max-height` clipping bug, compacted `.viewer-card.is-empty`, added **`🖼️ Expand Gallery`**, click-to-open viewer + `#activeOutputInspector`, `#outputImageViewer` click fullscreen, **`🕒 Previous Prompts`** searchable menu, per-ref cost badge (`#multiImageCostBadge`), **`🧬 Face Study Prompt`** + reusable **`👤 Saved Face Packs`**, dual-slot `image` + `face_image`/`body_image` handling (`getSecondaryImageSchemaKey`), Paint Region / Mask studio (`#maskBgImage`, Paint/Erase toggle, `⚡ Use Flux Fill Inpaint`, feathered local mask composite preserving raw AI file), `input_sources` capture & `fetchSavedOutputs()` preservation, fast `/api/video/filmstrip` client hook, and `?v=1.0.9` cache-busting.
  - `scripts/verify_studio_isolated.js`: Added isolated DB input provenance + FTS filename search tests, per-ref cost badge assertions, Face Study helper check, gallery expand toggle, and dual-slot `image-face-swap-pro` checks.
- **Verification (Zero Live API Spend):**
  - `node --check` passed on `server.js`, `database/history_db.js`, `public/app.js`, and `scripts/verify_studio_isolated.js`.
  - `npm test` (`ALL_ISOLATED_TESTS_PASSED`) passed all suites including 209 formulas × 7 resolutions, empty-cache formula healing, DB `input_sources` & FTS search, mock DOM integration, and HTTP artifact/FFmpeg guards.
  - Headless Chromium Playwright (`http://127.0.0.1:39114`, isolated temp data dir, route-mocked `/api/models`, `/api/balance`, `/api/model-pricing`, `/api/generate`): `0` `pageerror`s; verified compact empty viewer (`185px`), Expand Gallery (`display: none`), click-card restore + inspector (`ref_image_1: gf_original_01.jpg`), Previous Prompts apply, Seedream 5.5 Edit `💰 +$0.0076 / extra ref` vs Wan 3.0 `✨ Extra refs: $0.00 FREE`, Brush/Erase toggle, `⚡ Use Flux Fill Inpaint`, dual `image`+`face_image` upload groups, and unclipped `workspacePanel` (`maxHeight: none`).
  - Re-running `npm test`, `npx electron . --smoke-test`, and secret scan after final version/doc edits before pushing `v1.0.9`.
- **Next Action:** Push `main` + annotated tag `v1.0.9`, confirm GitHub Release workflow passes, and restart `http://localhost:3000`.


# 2026-11-16T15:05:00-03:00 — v1.1.0 Shipped: Multi-Stage Pipeline Tab, Faces & Swaps Studio, Model Mixing Guide & 3D Angles

- **Changes Applied in `v1.1.0`:**
  - `documentation/features/02-pipeline-and-face-studio/SPEC.md`: Created feature specification and acceptance criteria per `FEATURE PIPELINE.md`.
  - `database/history_db.js`: Added safe `ALTER TABLE` migration for `pipeline_id` and `pipeline_step` columns + index (`idx_generations_pipeline`), persisted in `recordSubmission`, `recordOutputs`, `syncFromExistingFiles`, and `exportCsv`.
  - `server.js`: Added `isFaceOrSwap` classification, pinned & titled `flux-pulid`, `qwen-image/edit-multiple-angles`, `edit-2509-multiple-angles`, `qwen-image/edit-plus`, `seedream-v5.0-flash/edit`, `seedream-v4.5/edit-sequential`, `infinite-you`, `video-face-swap`, `face-enhancer/video`, `flux-kontext-dev/multi`, `vidu/reference-to-image-q2`, `instant-character`, and `ideogram-character`; forwarded `pipeline_id` and `pipeline_step` into `/api/generate`, metadata JSON, and SQLite.
  - `public/index.html`, `public/style.css`, `public/app.js`: Added `🎭 Faces & Swaps` and `⛓️ Pipeline` tabs (`?v=1.1.0`), hover+click **Model Mixing & Workflow Guide** (`getModelWorkflowMixingGuide`), **3D Camera Angle Controls** (`#angleControlsGroup`), `target_image` + `source_image` support (`wavespeed-ai/infinite-you`), per-ref Role Tags, model-aware `<Picture N>` / `Image N` Face Study prompt generator, `$0.00` Canvas **Face Sheet** builder, `$0.00` **Cache URLs** pre-uploader, `⛓️ → Pipeline` handoff buttons, and the **Multi-Stage Pipeline Engine** (2 default collapsible steps + `+ Add Step`, live per-step `$price` selectors, **Checkpoint** & **Auto-Run All** modes, compact horizontal Stage Progression strip sharing `#viewerCard`, built-in recipes, and `.json` export/import).
  - `scripts/verify_studio_isolated.js`: Added isolated DB `pipeline_id` / `pipeline_step` checks and simulated DOM assertions for `faces-swaps`, `pipeline`, 3D angles, Mixing Guide, `<Picture 1>` syntax, and `infinite-you` dual slots.
- **Verification (Zero Live API Spend):**
  - `node --check` passed on `server.js`, `database/history_db.js`, `public/app.js`, and `scripts/verify_studio_isolated.js`.
  - `npm test` (`ALL_ISOLATED_TESTS_PASSED`) passed all suites including 209 formulas × 7 resolutions, empty-cache healing, SQLite provenance + pipeline IDs, and simulated DOM integration.
  - Headless Chromium Playwright E2E (`http://127.0.0.1:39115`, isolated temp data dir, route-mocked `/api/models`, `/api/balance`, `/api/model-pricing`, `/api/upload`, `/api/generate`, `/api/task/*`, `https://cdn.mock.invalid/**`): `0` page errors and `0` console errors; verified `🎭 Faces & Swaps`, Mixing Guide popover, 3D angle pills, `$0.00` Canvas Face Sheet, `⛓️ Pipeline` 2-step default + `+ Add Step`, Checkpoint pause & Step 1 → Step 2 URL handoff, and Auto-Run All with automatic `face_image` preset binding.
  - Re-running final `npm test`, `npx electron . --smoke-test`, and secret scan before committing/tagging `v1.1.0`.
- **Next Action:** Push `main` + annotated tag `v1.1.0`, confirm GitHub Actions release completes, and restart `http://localhost:3000`.


# 2026-11-16T17:25:30-03:00 — v1.2.0 Shipped: Face Crop Studio (`cropped_imgs`), Origin Provenance & Face Study Prompt Library

- **Changes Applied in `v1.2.0`:**
  - `documentation/features/03-face-crop-and-study-prompts/SPEC.md`: Authored specification and acceptance criteria per `FEATURE PIPELINE.md`.
  - `database/history_db.js`: Added `cropped_assets` and `face_study_prompts` SQLite tables (pre-seeded with 12 Face Study prompts across `Anatomy & Essence`, `Lighting`, `Expressions` — including Warm Smile, Soft Pout, Subtle Frown, Cheeky Smirk, Playful Tongue-Out — and `Angles & Framing`), and updated `normalizeInputSources()` so both cropped and original filenames (`origin_filename`) are indexed in `generations.input_filenames` and FTS5.
  - `server.js`: Added `OUTPUTS_CROPPED_DIR = path.join(OUTPUTS_DIR, 'cropped_imgs')`, `croppedDir` on `/api/config`, `GET /api/crops`, `POST /api/crops/save`, `POST /api/crops/delete` (with `403` `isPathInside` traversal guard), `GET /api/face-prompts`, `POST /api/face-prompts`, and `POST /api/face-prompts/delete`.
  - `public/index.html`, `public/style.css`, `public/app.js` (`?v=1.2.0`): Implemented `#faceCropModal` (Rectangle `1:1`/Free + Free-Form Lasso with `Neutral Gray` or `Transparent PNG` outside, non-destructive `➕ Add Crop to Refs`, `🔄 Replace This Ref`, `👤 Save to Face Pack`, `🎯 Set as Source Image`, and `#savedCroppedFacesGrid`), URL filename extraction in `addExtraImageUrl()`, `(from <origin_filename>)` provenance tags across Reference thumbnails / Active Inspector / History DB, and the searchable `📚 Study Prompts` popover (`#faceStudyPromptsMenu`) with `{{REFS}}` -> `<Picture N>` / `Image N` substitution.
  - `scripts/verify_studio_isolated.js`: Added isolated HTTP tests (`/api/crops*`, `/api/face-prompts*`, 403 traversal), SQLite `cropped_assets` / `face_study_prompts` / `origin_filename` FTS5 search tests, and simulated DOM integration assertions.
- **Verification (Zero Live API Spend):**
  - `node --check` passed on `server.js`, `database/history_db.js`, `public/app.js`, and `scripts/verify_studio_isolated.js`.
  - `npm test` (`ALL_ISOLATED_TESTS_PASSED`) passed all suites.
  - Headless Chromium Playwright E2E (`127.0.0.1:39116`, isolated `WAVESPEED_USER_DATA_DIR`, mocked `/api/models*` & `/api/balance`, `/api/generate` blocked): `0` `pageerror`s and `0` `console` errors.
  - Final `npm test`, `npx electron . --smoke-test`, and secret scan running after doc/version edits prior to commit/tag `v1.2.0`.
- **Next Action:** Push `main` + annotated tag `v1.2.0`, verify GitHub release build, and restart `http://localhost:3000`.
