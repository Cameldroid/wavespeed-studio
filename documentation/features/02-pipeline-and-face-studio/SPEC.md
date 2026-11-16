---
Coding Project Note: true
Note Creation Date: "2026-11-16T14:45:41-03:00"
Note Modified Date:
  - "2026-11-16T14:45:41-03:00"
  - "2026-11-16T15:05:00-03:00"
---

# 2026-11-16T14:45:41-03:00 — Feature Spec: Multi-Stage Pipeline Tab & Faces/Swaps Studio (`v1.1.0`)

- **Status:** `In Progress`
- **Target Version:** `v1.1.0`

## 1. Goal & User Problem
Users want a streamlined, credit-safe way to run **multi-stage creative workflows** (e.g., cheap high-face-fidelity SFW pose/angle prep → uncensored I2I or Spicy I2V → optional face-swap re-lock or further edit) with **2+ separate prompt boxes, per-step model selectors showing live `$price` and safety/capability tags, checkpointed approval vs. auto-run, and multi-photo face mixing**. Additionally, Face Study, Multi-Angle rotation, and Face/Head/Body Swap tools deserve a dedicated **`🎭 Faces & Swaps`** tab with explicit **model workflow info tips** (hover + click), 3D angle controls for `qwen-image/edit-multiple-angles`, and a `$0.00` local Reference Sheet builder.

## 2. Files Likely Touched
- `database/history_db.js` — Safe `ALTER TABLE` migration for `pipeline_id` and `pipeline_step` provenance columns.
- `server.js` — Categorization/pinning for `faces-swaps`, friendly titles for `flux-pulid`, `qwen-image/edit-multiple-angles`, `minimax-h3/image-edit`, `infinite-you`, and `pipeline_id` / `pipeline_step` forwarding on `/api/generate` + metadata archival.
- `public/index.html` — Add `🎭 Faces & Swaps` and `⛓️ Pipeline` mode tabs, model workflow info tip badge/popover, 3D angle controls (`#angleControlsGroup`), `$0.00 Face Sheet` & `Send to Pipeline` controls, `#pipelineBuilderPanel`, and compact `#pipelineStageBoard`.
- `public/style.css` — Styling for collapsible pipeline step cards, horizontal stage progression strip, mixing guide popover, and 3D angle pill controls across all themes.
- `public/app.js` — `faces-swaps` & `pipeline` tab routing, model mixing guide registry, `horizontal_angle`/`vertical_angle`/`distance` schema controls, `source_image`/`target_image` mapping (`infinite-you`), model-aware `<Picture N>` vs `Image N` Face Study prompt builder, Canvas `$0.00` Face Sheet stitcher, upload-once Face Pack caching, and full Checkpoint + Auto-Run Pipeline engine with JSON recipe export/import.
- `scripts/verify_studio_isolated.js` — Zero-spend unit, SQLite, and DOM tests for pipeline pricing/chaining, `pipeline_id` persistence, angle controls, mixing guide lookup, Face Sheet availability, and `infinite-you` dual-slot mapping.

## 3. Design & Acceptance Criteria
- [ ] **`🎭 Faces & Swaps` Tab:** Curates Face Study, Multi-Angle, Face/Head/Body/Video Swap, `flux-pulid`, `infinite-you`, `minimax-h3/image-edit`, `seedream-v5.5/edit`, and `qwen-image/edit-multiple-angles`; maps `source_image` + `target_image` cleanly; exposes `horizontal_angle` / `vertical_angle` / `distance` controls; includes hover + click **Model Mixing Guide** (`<Picture N>` vs `Image N` vs `96-pose 3D`).
- [ ] **Upgraded Face Study & `$0.00` Face Sheet:** Per-ref role tags (`Face ID`, `3/4 Angle`, `Side`, `Outfit/Pose`), model-aware Face Study prompt insertion, local Canvas `$0.00` Face Sheet stitcher, optional `$0.00` pre-upload URL caching for Face Packs, and 1-click `⛓️ Send to Pipeline`.
- [ ] **`⛓️ Pipeline` Tab:** Defaults to **2 collapsible steps** + **`+ Add Step`** (3+), each with a model selector displaying live `$price` and capability/safety tags, independent prompt box, source wiring (`Face Preset`, `Previous Step`, `Step 1`, `Custom`, `Extra Refs`), and auto-wired secondary `face_image`/`source_image` for swap steps.
- [ ] **Checkpoints, Auto-Run & Recipes:** Supports **Checkpoint (Pause & Approve / Re-run)** and **Auto-Run All** (enforcing Spend Guard on total cost), compact top horizontal **Stage Strip** sharing the single main viewer, built-in recipes, and local `.json` export/import.
- [ ] **SQLite Provenance:** `pipeline_id` and `pipeline_step` stored in `studio_history.sqlite` and metadata JSON without breaking existing rows.

## 4. Zero-Spend Verification Plan
- `node --check` on `server.js`, `database/history_db.js`, `public/app.js`, and `scripts/verify_studio_isolated.js`.
- `npm test` (`scripts/verify_studio_isolated.js`) with isolated temp dirs and zero live API spend.
- Headless Playwright Chromium verification (route-mocking `/api/models`, `/api/balance`, `/api/model-pricing`, `/api/upload`, `/api/generate`, `/api/task/:id`) confirming `0` page errors and full Checkpoint + Auto-Run Pipeline, Faces & Swaps, Angle Controls, Mixing Guide, and Canvas Face Sheet flows.
- `npx electron . --smoke-test` + secret scan.


# 2026-11-16T15:05:00-03:00 — Implemented & Verified in v1.1.0

- **Status:** `Shipped in v1.1.0`
- **Verified Acceptance:**
  - [x] `🎭 Faces & Swaps` tab added with `isFaceOrSwap` server + client classification, hover+click **Model Mixing & Workflow Guide**, 3D Camera Angle controls (`horizontal_angle`, `vertical_angle`, `distance`), and `source_image` + `target_image` dual-slot mapping (`wavespeed-ai/infinite-you`).
  - [x] Role-tagged Face Study references, model-aware `<Picture N>` vs `Image N` prompt generator, `$0.00` Canvas Face Sheet stitcher, `$0.00` CDN pre-upload caching, and `⛓️ → Pipeline` handoff buttons.
  - [x] `⛓️ Pipeline` tab with 2 default collapsible steps + `+ Add Step`, live per-step `$price` + capability/safety tags in selectors, Checkpoint & Auto-Run All modes, compact horizontal Stage Progression strip sharing `#viewerCard`, built-in recipes, and JSON export/import.
  - [x] `pipeline_id` and `pipeline_step` persisted across SQLite (`studio_history.sqlite`), metadata JSON, and CSV export.
  - [x] Verified with `node --check`, `npm test` (`ALL_ISOLATED_TESTS_PASSED`), Headless Chromium Playwright E2E (`0` page/console errors), `npx electron . --smoke-test`, and secret scan (`ZERO_LIVE_SECRET_HITS`).
