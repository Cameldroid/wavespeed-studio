---
Coding Project Note: true
Note Creation Date: "2026-11-16T03:08:00-03:00"
Note Modified Date:
  - "2026-11-16T03:08:00-03:00"
  - "2026-11-16T04:08:00-03:00"
  - "2026-11-16T12:39:00-03:00"
---

# 2026-11-16T03:08:00-03:00 — Project Log V2 (Continuation)

> **Continues from:** [PROJECT LOG.md](PROJECT%20LOG.md) (covers initial standalone repo creation through `v1.0.6`, commit `d6e5777`, published on GitHub Releases via run `43810555113`).

- **Continuity Snapshot as of `v1.0.6`:**
  - Single unified workspace at repo root; external user state lives outside git via `WAVESPEED_USER_DATA_DIR` (`%AppData%\wavespeed-studio` locally) and configurable `outputsDir`.
  - Features live through `v1.0.6`: dynamic WaveSpeed model catalog + RSC pricing formulas, 6 studio tabs (`Text → Image`, `Image Edit`, `Image → Video`, `Ref → Video`, `Video & Edit`, `Tools`), R2V PC uploads (`POST /api/upload-raw`), Video Timeline & Frame Picker, Resolution Mismatch Advisory + Real-ESRGAN pre-upscale, Spend Guard, Economy Defaults, SQLite + FTS5 History DB, clean no-default-presets bar, and Wan 3.0 Video-Edit guidance + drag-and-drop ref images.
- **Changes Applied in This Documentation Update:**
  - Rolled over `PROJECT LOG.md` (`21,912` bytes) and `PROJECT HANDOVER.md` (`18,944` bytes) into V2 continuations under the 8,000-character rule.
  - Created [ARCHITECTURE.md](ARCHITECTURE.md), [FEATURE PIPELINE.md](FEATURE%20PIPELINE.md), [features/_TEMPLATE/SPEC.md](features/_TEMPLATE/SPEC.md), and [features/01-timeline-performance-fix/SPEC.md](features/01-timeline-performance-fix/SPEC.md).
  - Appended navigation index to [START HERE.md](START%20HERE.md).
- **Live Benchmarks Recorded (Zero Spend):**
  - `GET /api/models`: `5,369 ms` (`1,467,139` bytes across `787` models, `90` discounted; `8` promo models at `50%` off).
  - `GET /api/outputs`: `246 ms` (`66,674` bytes).
  - Identified root causes of timeline & page-click sluggishness in `public/app.js` + `/api/models` uncached startup fetch and captured them in `features/01-timeline-performance-fix/SPEC.md`.
- **Verification:** Read-only Playwright timing check, live catalog discount audit, and documentation YAML/timestamp inspection completed cleanly. Code unchanged from verified `v1.0.6`.
- **Next Action:** Commit documentation pipeline updates cleanly to `main` (docs-only commit or include with next `v1.0.7` timeline fix), then test the new single-feature chat workflow on [features/01-timeline-performance-fix/SPEC.md](features/01-timeline-performance-fix/SPEC.md).


# 2026-11-16T04:08:00-03:00 — Pricing Audit Fix, Timeline Performance, FFmpeg Trim & Stitch, Batch Matrix, Quick Chains & Analytics (`v1.0.7`)

- **Summary:** Fixed V2V / R2V multi-asset & duration-clamp pricing calculation + remaining balance projection bugs, eliminated Video Timeline / startup stalls (`01-timeline-performance-fix`), and shipped local FFmpeg trim & multi-clip stitching, `{variant}` × multi-seed Batch Matrix Runner, Auto-Chain workflow staging, History failure/Cost-Per-Keep analytics, and GitHub Release update notifier (`v1.0.7`).
- **Changes Applied:**
  - `public/app.js`: Parsed `get_duration(media, min=..., max=..., total=...)` options accurately; consolidated `buildPricingParams(model, overrides)` fixing optional `image`/`images`/`reference_images`/`videos`/`reference_videos`/`reference_audios`/`audios` counting & `breakdownText` display; updated `addRefAudioFiles`/`addRefAudioUrl`/clear-video listeners to trigger live price + balance updates; fixed `infoPriceBreakdown` pending spend deduction & batch multiplier across Spend Guard + Sidebar + Affordability banners. Implemented `requestAnimationFrame` + `fastSeek` timeline scrubbing, `timelineScanToken` abort/disposal, gallery `preload="none"`, `expandPromptBraces` batch matrix (`<=12` runs), `#postChainSelect`, FFmpeg trim/concat UI, historical failure alerts, Cost/Keep stats, and `checkForAppUpdate()`.
  - `server.js`: Added `<USER_DATA_DIR>/cache/models-cache.json` stale-while-revalidate disk cache, `resolveFfmpegBinary()`, `POST /api/video/trim`, `POST /api/video/concat` (with uniform `720x720` padding for mixed aspect clips + `OUTPUTS_DIR` path confinement), and `GET /api/check-update`.
  - `database/history_db.js`: Added `favorited_runs`, `favorited_spend`, `cost_per_favorite`, and per-model `completed_count`/`failed_count` aggregates.
  - `public/index.html`, `public/style.css`, `.gitignore`, `CHANGELOG.md`, `package.json`: Added UI controls for Update badge, Clear Source Video, Local Trim In/Out/Run, Bulk Video Stitch, Batch/Auto-Chain row, ignored `cache/`, bumped `1.0.7`.
- **Verification (Zero Live API Spend):** Re-running `npm test` (`verify_studio_isolated.js` with R2V/V2V swap formulas, `get_duration` clamp, batch matrix fan-out, Cost/Keep DB & trim/concat guard tests), `npx electron . --smoke-test`, and secret scan after final edit; Playwright Chromium (`127.0.0.1:39112`) already verified update pill, history failure alert, batch 4× prompt expansion, 8/8 filmstrip in `1,625 ms`, live FFmpeg trim + stitch (`mock/test-video`, `local/ffmpeg-trim`, `local/ffmpeg-stitch`), `0` console errors, `0` page errors.
- **Next Action:** Push `main` + annotated tag `v1.0.7`, update GitHub Release `v1.0.7` notes with concise changelog highlights, and restart `http://localhost:3000` to `v1.0.7`.


# 2026-11-16T12:39:00-03:00 — Per-Reference Formula Self-Healing, Universal Drag-and-Drop & Moderation Guidance (`v1.0.8`)

- **Summary:** Fixed flat-rate regression where WaveSpeed RSC `formula_shape` changes wiped cached variable formulas on 5 models (including `bytedance/seedream-v5.5/edit` and `wavespeed-ai/minimax-h3/reference-to-video`), added universal File + URL + Gallery drag-and-drop across all upload groups and Video Timeline, and separated upstream image moderation guidance from video safety tips.
- **Changes Applied:**
  - `server.js`: Added self-healing in `loadPricingFormulas()` and `loadDiskModelsCache()` from bundled `pricing-formulas.json`, prevented `fetchLiveModelFormula()` and `getModels()` from overwriting valid cached formulas with empty strings when `variable_price: true` / `formula_shape` is returned.
  - `public/app.js`: Added `variable_price` / `price_inputs` fallback in `calculateModelCost()` and `buildPricingParams()`, prevented `selectModel()` from overwriting valid formulas with empty `""`, made gallery cards `draggable = true`, added unified `attachMediaDropTarget` + `bindGroupDrop` + `extractDroppedMediaUrl` across all 7 media targets plus a `document` drag/drop safeguard, and split `isLikelyStrictSfwModel()` / `pollConcurrentJob()` image vs. video moderation tips.
  - `public/index.html`, `public/style.css`: Added `#multiImageDropzone`, `#refAudioDropzone`, updated `#videoTimelineGroup` drop hint, and `.timeline-extractor-card.dragover` highlight styling.
  - `scripts/verify_studio_isolated.js`: Added Seedream 5.5 Edit multi-image pricing scaling (`$0.0266` -> `$0.0418`), universal drop-target URL dispatch checks, and `runFormulaHealingTest()` (`WAVESPEED_USER_DATA_DIR` startup healing verification).
  - `package.json`, `CHANGELOG.md`: Bumped version to `1.0.8` and added `v1.0.8` changelog entry.
- **Verification (Zero Live API Spend):** Re-running `node --check`, `npm test`, `npx electron . --smoke-test`, and secret scan after final edit; Playwright Chromium against isolated server (`http://127.0.0.1:39113`, `WAVESPEED_USER_DATA_DIR` seeded with wiped `seedream-v5.5/edit` cache) verified `0` `pageerror`s, Seedream 5.5 Edit scaling `1 img = $0.0266` -> `3 img = $0.0418`, MiniMax H3 R2V scaling `$0.125` -> `$0.145` on dropped image+audio, single-image drop onto outer `#imageInputGroup`, and timeline drop opening `videoTimelineGroup`.
- **Next Action:** Push `main` and annotated tag `v1.0.8`, confirm GitHub Release workflow completes cleanly, and restart `http://localhost:3000` (`Launch Studio.cmd`).
