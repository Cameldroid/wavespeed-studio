---
Coding Project Note: true
Note Creation Date: "2026-11-16T03:08:00-03:00"
Note Modified Date:
  - "2026-11-16T03:08:00-03:00"
  - "2026-11-16T04:08:00-03:00"
  - "2026-11-16T12:39:00-03:00"
  - "2026-11-16T13:52:00-03:00"
  - "2026-11-16T15:05:00-03:00"
  - "2026-11-16T17:25:30-03:00"
  - "2026-11-16T19:58:43-03:00"
---

# 2026-11-16T03:08:00-03:00 — Project Handover V2 (Current Authoritative State)

> **Continues from:** [PROJECT HANDOVER.md](PROJECT%20HANDOVER.md) (`v1.0.0`–`v1.0.6` history).

## Current Release & Repo State
- **Repository:** `https://github.com/Cameldroid/wavespeed-studio` (`main` @ `d6e5777`, tag **`v1.0.6`** live on GitHub Releases via run `43810555113`).
- **Release Artifacts:** `WaveSpeed.Studio.Setup.1.0.6.exe`, `WaveSpeed.Studio.1.0.6.msi`, `SHA256SUMS.txt`. *(Always create **annotated** tags with `git tag -a v1.0.x -m "..."` if pushing with `--follow-tags`, or push the tag explicitly with `git push origin v1.0.x`.)*
- **Runtime & Storage Separation:**
  - `Launch Studio.cmd` (`scripts/launch_studio.ps1`): Launches Node HTTP server on `http://localhost:3000` with external user data (`WAVESPEED_USER_DATA_DIR=%APPDATA%\wavespeed-studio`).
  - `Launch Desktop.cmd`: Launches Electron (`electron/main.js`) directly against the repo files using that exact same `%APPDATA%\wavespeed-studio` database and `.studio-config.json` (zero installer rebuild needed for local testing).

## Hard Rules for Any New Chat
1. **Zero Automated Spend (`AGENTS.md`):** Never call `POST /api/generate` or `https://api.wavespeed.ai/api/v3/{model_id}` against real credits. Always verify generation flows using `npm test` (`scripts/verify_studio_isolated.js`) and Playwright `page.route` mocking.
2. **Documentation Hygiene:** Append timestamps cleanly to `Note Modified Date` + body `# <ISO> — ...` H1s; split into `V2`/`V3` around 8,000 characters; put per-feature work specs under `documentation/features/<NN-slug>/`.
3. **Secret Hygiene:** Never commit API keys, `%AppData%` SQLite DBs, logs, or generated media.

## Exact Next Action
- Open a **fresh chat** using the kickoff template in [FEATURE PIPELINE.md](FEATURE%20PIPELINE.md) pointed at [features/01-timeline-performance-fix/SPEC.md](features/01-timeline-performance-fix/SPEC.md) to fix the slow Video Timeline / Frame Picker and sluggish startup model fetch without carrying this chat's history.


# 2026-11-16T04:08:00-03:00 — v1.0.7 Shipped: Pricing Audit, Fast Timeline, FFmpeg Trim/Stitch & Pipeline Tools

- **Authoritative Release:** `v1.0.7` (pushed on `main` + annotated tag `v1.0.7`), serving live on `http://localhost:3000` (`Launch Studio.cmd`) and `Launch Desktop.cmd`.
- **Key Capabilities Live in `v1.0.7`:**
  - Accurate R2V/V2V pricing across `get_duration(min,max,total)`, attached `images` / `reference_images` / `videos` / `reference_videos` / `audios` / `reference_audios`, and remaining balance subtracting both active concurrent runs & batch totals.
  - Fast Timeline scrubber (`rAF` + `fastSeek`), clean `metadata` filmstrip disposal, gallery lazy video (`preload="none"`), and Stale-While-Revalidate disk cache (`cache/models-cache.json`).
  - Zero-cost FFmpeg **Timeline Trimmer** (`✂️ Cut & Use Clip`) & **Bulk Clip Stitcher** (`☑️ Select` → `🎞️ Stitch`), `{opt1 | opt2}` × multi-seed **Batch Matrix Runner**, **Auto-Chain Next** pipeline staging, **History Failure Alert + Cost/Keep** stats, and GitHub **Update Notifier**.
- **Exact Next Action:** For your next feature slice, copy [features/_TEMPLATE/SPEC.md](features/_TEMPLATE/SPEC.md) into `documentation/features/02-<your-feature>/SPEC.md` and launch a fresh chat using the kickoff prompt in [FEATURE PIPELINE.md](FEATURE%20PIPELINE.md).


# 2026-11-16T12:39:00-03:00 — v1.0.8 Shipped: Variable Reference Pricing Healing & Universal Drag-and-Drop

- **Authoritative Release:** `v1.0.8` (serving live on `http://localhost:3000` via `Launch Studio.cmd` and Desktop via `Launch Desktop.cmd`).
- **Fixes Applied in `v1.0.8`:**
  - Startup & live sync self-healing for variable-price models (`bytedance/seedream-v5.5/edit`, `wavespeed-ai/minimax-h3/reference-to-video`, etc.) whose RSC `formula_shape` migration previously wiped `%AppData%\wavespeed-studio\pricing-formulas.json`.
  - Universal drag-and-drop (Files, URLs, and Gallery cards) across Source Image, End Frame, Multi-Reference Images, Source Video, Reference Videos, Reference Audios, and Video Timeline.
  - Clear upstream safety filter messaging clarifying `bytedance/seedream-v5.5` content flags are per-request moderation rather than API key bans.
- **Exact Next Action:** For the next feature slice, copy [features/_TEMPLATE/SPEC.md](features/_TEMPLATE/SPEC.md) into `documentation/features/02-<your-feature>/SPEC.md` and launch a fresh chat using the kickoff prompt in [FEATURE PIPELINE.md](FEATURE%20PIPELINE.md).


# 2026-11-16T13:52:00-03:00 — v1.0.9 Shipped: Full Gallery View, Input Provenance DB, Paint Mask Studio, Face Study & Fast Filmstrip

- **Authoritative Release:** `v1.0.9` (live on `http://localhost:3000` via `Launch Studio.cmd` and Desktop via `Launch Desktop.cmd`).
- **Key Capabilities Added in `v1.0.9`:**
  - Full-height expandable Gallery (`🖼️ Expand Gallery`), compact empty viewer (`185px`), click-card restore + Active Output Inspector (`Prompt`, `Copy Prompt`, `Paint-Edit`, `Face Swap Onto`, `+ Ref Study`, `📎 Inputs`), and click-to-fullscreen viewer image.
  - SQLite input provenance (`input_sources_json`, `input_filenames`, `input_filepaths` in `studio_history.sqlite` + FTS5 filename search) without duplicating original files on disk, plus searchable **`🕒 Previous Prompts`** dropdown.
  - Per-ref cost indicator badge (`💰 +$... / extra ref` vs `✨ Extra refs: $0.00 FREE on this model`).
  - Interactive **Paint Region / Mask Studio** (`#maskBgImage`, Paint/Erase toggle, `⚡ Use Flux Fill Inpaint`, optional feathered local mask lock preserving raw AI files), **`🧬 Face Study Prompt`** + reusable **`👤 Saved Face Packs`**, pinned **Image Face/Head/Body Swap** models with dual `image` + `face_image`/`body_image` slots, and parallel FFmpeg **`/api/video/filmstrip`** acceleration.
- **Exact Next Action:** Keep building isolated feature slices under `documentation/features/` using [FEATURE PIPELINE.md](FEATURE%20PIPELINE.md) and [PROJECT LOG V3.md](PROJECT%20LOG%20V3.md).


# 2026-11-16T15:05:00-03:00 — v1.1.0 Shipped: Multi-Stage Pipeline Tab & Faces/Swaps Studio

- **Authoritative Release:** `v1.1.0` (spec documented in [features/02-pipeline-and-face-studio/SPEC.md](features/02-pipeline-and-face-studio/SPEC.md)), running on `http://localhost:3000` (`Launch Studio.cmd`) and Desktop (`Launch Desktop.cmd`).
- **Key Capabilities Added in `v1.1.0`:**
  - **`⛓️ Pipeline` Tab:** 2 default collapsible steps + `+ Add Step` (up to 6 steps), per-step model selectors showing live `$price` + safety/capability tags, independent prompt boxes & source wiring (`Subject / Face Preset`, `← Step N-1`, `← Step 1`, `Custom`, `Extra Refs`), automatic `face_image`/`source_image` lock wiring for swaps, **Checkpoint (Pause & Approve / Re-run)** vs **Auto-Run All**, compact horizontal Stage Progression strip sharing the single viewer, built-in recipes, `.json` export/import, and SQLite `pipeline_id` / `pipeline_step` tracking.
  - **`🎭 Faces & Swaps` Tab:** Curated hub for `minimax-h3/image-edit` (`<Picture N>`), `seedream-v5.5/edit`, `qwen-image/edit-multiple-angles` (with live **3D Camera Angle Controls**), `flux-pulid`, `infinite-you` (`source_image` + `target_image`), and Face/Head/Body/Video Swaps, complete with hover+click **Model Mixing & Workflow Guide**, per-ref Role Tags, **`🧩 $0.00 Face Sheet`** Canvas stitcher, and **`☁️ Cache URLs ($0)`** pre-upload.
- **Exact Next Action:** Scaffold `documentation/features/03-<next-feature>/SPEC.md` per [FEATURE PIPELINE.md](FEATURE%20PIPELINE.md) when starting the next feature slice.


# 2026-11-16T17:25:30-03:00 — v1.2.0 Shipped: Face Crop Studio (`cropped_imgs`), Origin Provenance & Face Study Prompt Library

- **Authoritative Release:** `v1.2.0` (spec documented in [features/03-face-crop-and-study-prompts/SPEC.md](features/03-face-crop-and-study-prompts/SPEC.md)), running on `http://localhost:3000` (`Launch Studio.cmd`) and Desktop (`Launch Desktop.cmd`).
- **Key Capabilities Added in `v1.2.0`:**
  - **Local Face Crop Studio (`#faceCropModal`):** Supports Rectangle (`1:1 Face Square` or `Free`) and Free-Form Lasso (`Neutral Gray` or `Transparent PNG`), saving crops directly to `<outputsDir>/cropped_imgs/` (locally `D:\wvst\cropped_imgs\`) and SQLite `cropped_assets` with explicit non-destructive actions (`+ Add Crop to Refs`, `🔄 Replace This Ref`, `👤 Save to Face Pack`, `🎯 Set as Source Image`).
  - **Dual Provenance (`origin_filename` + cropped `filename`):** Both cropped and original filenames are preserved across Reference Cards, Face Packs, Pipeline runs, Active Output Inspector, History DB (`studio_history.sqlite`), and FTS5 search (`(from <origin_filename>)`).
  - **SQLite Face Study Prompt Library (`📚 Study Prompts`):** Categorized & searchable prompt popover (`Anatomy & Essence`, `Lighting`, `Expressions` — Smile, Soft Pout, Subtle Frown, Cheeky Smirk, Playful Tongue-Out — `Angles & Framing`, plus `+ Save Current` custom prompts) adapting `{{REFS}}` to `<Picture N>` (MiniMax H3) vs `Image N` (Seedream/Qwen/FLUX).
- **Exact Next Action:** Copy [features/_TEMPLATE/SPEC.md](features/_TEMPLATE/SPEC.md) into `documentation/features/04-<next-feature>/SPEC.md` per [FEATURE PIPELINE.md](FEATURE%20PIPELINE.md) when starting the next feature slice.


# 2026-11-16T19:58:43-03:00 — v1.3.0 Shipped: Source Image Reuse Fix, Gallery Folders, Details Modal, SHA-256 Source Grouping & History Merge

- **Authoritative Release:** `v1.3.0` (spec documented in [features/04-source-reuse-and-gallery-folders/SPEC.md](features/04-source-reuse-and-gallery-folders/SPEC.md)), running on `http://localhost:3000` (`Launch Studio.cmd`) and Desktop (`Launch Desktop.cmd`).
- **Key Capabilities Added in `v1.3.0`:**
  - **Source Image Reuse Overhaul:** `reuseHistoryRun(item, onlyInputMedia)` is now fully `async`, resets stale inputs, clears and populates `state.extraImages` for pure multi-image models (`seedream-v5.5/edit`, `qwen-image/edit-plus`, `minimax-h3/image-edit`), single-slot models, and swap dual-slots with visual previews, modal closure, and smooth scrolling.
  - **Gallery Card Quick Action Tools:** Added `ℹ️ Details` (opens `#outputDetailsModal`), `📂 Open Folder` (launches `explorer.exe /select,"<file>"`), and `➕ Use as Source / Reference` (loads any output directly into Studio inputs).
  - **Output Details & Source Provenance Modal (`#outputDetailsModal`):** Complete generation details, prompt copying, parameters grid, output disk path with `📂 Open` and `📋 Copy`, and full **Input Sources & Provenance** listing origin filenames, folders, SHA-256 checksums, and shortcuts.
  - **SHA-256 Source Checksum Identity & Group by Source:** Web Crypto SHA-256 hashes generated on upload, drag, and crop decoupling identity from volatile clipboard temp folders (`AppData\Local\Temp\Ditto\...`), backed by `#gallerySourceFilterSelect` and `🗂️ Group by Source` (`#galleryGroupBySourceBtn`) with header shortcuts.
  - **History Completeness & Predecessor Merge:** Verified all 82 generations from `D:\Cocoding\Aimagen Nsfw\database\studio_history.sqlite` exist in current 220-task database, and merged 79 missing historical generation records into `wavespeed-studio\logs\generations.jsonl`.
- **Exact Next Action:** Copy [features/_TEMPLATE/SPEC.md](features/_TEMPLATE/SPEC.md) into `documentation/features/05-<next-feature>/SPEC.md` per [FEATURE PIPELINE.md](FEATURE%20PIPELINE.md) when starting the next feature slice.
