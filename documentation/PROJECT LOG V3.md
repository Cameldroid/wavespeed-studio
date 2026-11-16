---
Coding Project Note: true
Note Creation Date: "2026-11-16T13:52:00-03:00"
Note Modified Date:
  - "2026-11-16T13:52:00-03:00"
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
