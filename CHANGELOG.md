# Changelog

All notable changes to **WaveSpeed Studio** are documented here.

## [1.2.0] - 2026-11-16
### Added
- **Local Face Crop Studio (`#faceCropModal`) & Persistent `cropped_imgs` Folder:**
  - Interactive Canvas cropper supporting both **Rectangle** (`1:1 Face Square` lock or `Free`) and **Free-Form Lasso** (`Neutral Gray` or `Transparent PNG` background outside the selection) from Source Image, Reference Image thumbnails (`✂️`), Active Output Inspector (`✂️ Crop Face`), and saved crops.
  - Automatically saves crops to `<outputsDir>/cropped_imgs/` (e.g., `D:\wvst\cropped_imgs\`) and indexes them in SQLite (`cropped_assets` table via `POST /api/crops/save`, `GET /api/crops`, `POST /api/crops/delete` with `403` traversal protection, plus `croppedDir` exposed on `/api/config`).
  - Explicit non-destructive ref actions after cropping: **`➕ Add Crop to Refs`**, **`🔄 Replace This Ref`**, **`👤 Save to Face Pack`**, **`🎯 Set as Source Image`**, or **`💾 Save to cropped_imgs Only`**.
- **Dual Crop + Original Provenance Tracking:**
  - Propagates `origin_filename`, `origin_filepath`, and `origin_url` from Source/Reference images, `addExtraImageUrl` URL filenames, Face Packs, and Pipeline inputs into `input_sources_json`, `input_filenames`, and SQLite FTS5 search, displaying `(from <origin_filename>)` in Reference thumbnails, Active Output Inspector, and History DB.
- **SQLite-Backed Face Study Prompt Library (`📚 Study Prompts`):**
  - Searchable popover (`#faceStudyPromptsMenu`) inside Prompt & Faces Studio (`GET/POST /api/face-prompts`, `POST /api/face-prompts/delete`) pre-seeded with 12 built-in prompts across **`Anatomy & Essence`**, **`Lighting`**, **`Expressions`** (Warm Genuine Smile, Soft Pout, Subtle Frown, Cheeky Playful Smirk, Playful Tongue-Out / Teasing Studio Shot), and **`Angles & Framing`**, plus **`+ Save Current`** custom prompt persistence.
  - Dynamically substitutes `{{REFS}}` with model-specific syntax (`<Picture 1>` for MiniMax H3 vs `Image 1 (Role)` for Seedream/Qwen/FLUX).

## [1.1.0] - 2026-11-16
### Added
- **Multi-Stage `⛓️ Pipeline` Tab (2+ Collapsible Steps, Checkpoints & Auto-Run All):**
  - Defaults to a 2-step collapsible accordion (`Step 1` + `Step 2`) with **`+ Add Step`** (up to 6 steps), independent prompt boxes, per-step model selectors showing live `$price` and capability/safety tags (`[Open]`, `[🌶️ Spicy]`, `[📐 3D Angles]`, `[🛡️ SFW]`, `[🎭 Swap]`), source wiring (`👤 Subject / Face Preset`, `← Previous Step Output`, `← Step 1 Output`, `Custom URL`, `Extra Refs`), and automatic secondary `face_image`/`source_image` binding for Face Swap steps.
  - Supports **⏸ Checkpoint Mode** (default: pauses after each step inside a compact horizontal **Stage Progression Strip** with `↻ Re-run Active Step`, `✓ Approve & Run Next Step`, and `👤 Save Output as Face Preset`) and **⚡ Auto-Run All Mode** with combined Spend Guard protection.
  - Includes built-in pipeline recipes (`2-Step SFW Pose/Angle → Uncensored Edit`, `3-Step SFW Pose/Angle → Uncensored Edit → Face Lock`, `Face Prep / Pose → Spicy I2V`, `Uncensored Edit → Face Swap Lock`), custom recipe saving (`localStorage`), and `.json` workflow Export/Import.
- **Dedicated `🎭 Faces & Swaps` Tab + Model Mixing & Workflow Guide:**
  - Curates Face Study, Multi-Angle, `flux-pulid`, `infinite-you`, `minimax-h3/image-edit`, `seedream-v5.5/edit`, `qwen-image/edit-multiple-angles`, and Face/Head/Body/Video Swap models in one hub.
  - Added hover + clickable **Model Mixing & Workflow Guide** (`#modelMixingBadgeBtn` / `#modelMixingPopover`) explaining each model's exact multi-photo mixing syntax (`<Picture 1>` for MiniMax H3 vs `Image 1..N` roles for Seedream/Qwen vs 96-pose 3D camera vs Swap slots).
  - Added **3D Camera Angle Controls (`#angleControlsGroup`)** (`horizontal_angle`, `vertical_angle`, `distance`) for `qwen-image/edit-multiple-angles` and `edit-2509-multiple-angles`.
  - Added **`source_image` + `target_image`** dual-slot mapping for ByteDance `wavespeed-ai/infinite-you` (`$0.05`).
- **Upgraded Face Study Studio (`#faceStudyBar`) & `$0.00` Face Sheet Stitcher:**
  - Added per-reference **Role Tags** (`Face ID`, `3/4 Angle`, `Side Profile`, `Pose / Outfit`, `Scene / BG`) and model-aware `🧬 Face Study Prompt` generation (`<Picture N>` vs `Image N`).
  - Added **`🧩 $0.00 Face Sheet`** local Canvas stitcher (merges 2–6 photos into 1 reference sheet at `$0.00` API cost, saving 46% on per-ref models like Seedream 5.5), **`☁️ Cache URLs ($0)`** pre-upload helper, and 1-click **`⛓️ → Pipeline`** handoff buttons.
- **SQLite Pipeline Provenance (`database/history_db.js` + `server.js`):**
  - Added safe `ALTER TABLE` migration for `pipeline_id` and `pipeline_step` columns on `generations`, forwarded through `/api/generate`, metadata JSON, `generations.jsonl`, and CSV export.

## [1.0.9] - 2026-11-16
### Added
- **Per-Ref Pricing Transparency Badge (`#multiImageCostBadge`):**
  - Displays live whether adding extra reference images increases cost (`💰 +$0.0076 / extra ref` on `seedream-v5.5/edit`, `+$0.01/img` on `minimax-h3`) or is included free (`✨ Extra refs: $0.00 FREE on this model` on `qwen-image/edit-plus`, `wan-3.0/video-edit`, `seedream-v5.0-flash/edit`).
- **SQLite Input Provenance (`input_sources_json`, `input_filenames`, `input_filepaths`):**
  - Safely migrates `studio_history.sqlite` (`generations`) without duplicating source files on disk, storing original filenames, filepaths, local/remote URLs, and sizes per run, indexing input filenames in FTS5 search, exposing `📎 Sources:` in History DB + Active Inspector, and exporting them in CSV/JSON.
- **Previous Prompts Menu (`🕒 Previous Prompts`):**
  - Added searchable prompt history popover beside the Prompt editor with `All` / `⭐ Favs` filters and 1-click `✓ Use`, `+ Append`, and `♻️ Setup` actions.
- **Interactive Paint Region / Mask Studio + Native & Local Composite Lock:**
  - Enabled `#maskCanvasGroup` across all `image-edit` and `mask_image` models with live underlying photo preview (`#maskBgImage`), `🖌️ Paint / 🧽 Erase` toggle, `⚡ Use Flux Fill Inpaint` switch (`wavespeed-ai/flux-fill-dev`, `bria/fibo-2.0/edit` pinned), and optional local feathered composite (`🔒 Lock unpainted pixels on non-mask models`) preserving the raw AI file on disk.
- **Multi-Photo Face Study & Dedicated Face/Head/Body Swap Support:**
  - Added `🧬 Face Study Prompt` helper and reusable `👤 Saved Face Packs` (`localStorage` identity packs for 1-click reload with zero re-upload).
  - Pinned `wavespeed-ai/image-face-swap-pro`, `wavespeed-ai/image-face-swap`, `wavespeed-ai/image-head-swap`, `wavespeed-ai/image-body-swap`, and `wavespeed-ai/face-enhancer/image`, with dual-slot `image` + `face_image`/`body_image` UI wiring (`getSecondaryImageSchemaKey`).
- **Fast Server-Side Parallel Video Timeline Filmstrip (`POST /api/video/filmstrip`):**
  - Extracts 8 keyframe thumbnails in parallel via FFmpeg for `/outputs/` clips before falling back to browser `<video>` probing.

### Fixed
- **Full-Height Gallery Expansion & Click-to-View in Studio:**
  - Removed duplicate `.workspace-panel { max-height: calc(100vh - 54px) }` CSS rule that clipped the bottom of the gallery and left empty black space below.
  - Compacted `.viewer-card.is-empty` (`185px`), added **`🖼️ Expand Gallery`** toggle (`data-viewer-stage="gallery"`), restored viewer visibility + smooth scroll-to-top + `#activeOutputInspector` on gallery card click, added click-to-zoom on `#outputImageViewer`, and forwarded `input_sources` in `fetchSavedOutputs()`.
  - Fixed `#promptGroup` visibility fallback when `model.schema` is initially empty, and bumped `?v=1.0.9` cache-busters on `style.css` and `app.js`.

## [1.0.8] - 2026-11-16
### Fixed
- **I2I & R2V Per-Reference-Image Formula Healing & Variable Pricing:**
  - Fixed WaveSpeed RSC `formula_shape` migration overwriting existing cached formulas with empty `""` (which flattened variable-price models such as `bytedance/seedream-v5.5/edit` and `wavespeed-ai/minimax-h3/reference-to-video`).
  - Added startup self-healing in `server.js` (`loadPricingFormulas` and `loadDiskModelsCache`) to restore wiped formulas from bundled `pricing-formulas.json`, and prevented empty remote responses from overwriting valid formulas in both backend & frontend (`selectModel`).
  - Added uncached `variable_price` / `price_inputs` fallback scaling in `calculateModelCost()` and `buildPricingParams()` (fixing `duration` & `reference_images` parameter population even before full OpenAPI schema fetch).
- **Universal Drag-and-Drop Across All Media Targets:**
  - Restored and unified drag-and-drop (`Files`, `text/uri-list` URLs, and draggable gallery cards) across `#imageInputGroup`/`#imageDropzone`, `#lastImageGroup`/`#lastImageDropzone`, `#multiImageGroup`/`#multiImageDropzone`, `#videoInputGroup`/`#videoDropzone`, `#refVideosGroup`/`#refVideoDropzone`, `#refAudiosGroup`/`#refAudioDropzone`, and `#videoTimelineGroup`, plus a global `document` safeguard against accidental Electron/browser drop navigation.
- **Image Moderation Help Tips (`Seedream 5.5` & Upstream Safety Filters):**
  - Expanded `isLikelyStrictSfwModel` and `pollConcurrentJob` error tips to distinguish image-edit moderation blocks (`bytedance/seedream-v5*`) from video blocks, clarify that account API keys are not banned/flagged, and suggest open-weights image/video alternatives (`qwen-image/edit-plus`, `minimax-h3-image/edit`, `minimax-h3/image-to-video-spicy`).

## [1.0.7] - 2026-11-16
### Fixed
- **R2V / Video-Edit Pricing & Balance Projection Accuracy:**
  - Implemented `get_duration(media, min, max, total)` formula clamping across video-edit & reference-to-video models (fixing per-clip minimums and 15s/30s caps).
  - Fixed optional `image` / `images` / `reference_images` / `reference_audios` / `audios` parameter counting (`openjutsu/character-swap`, `openjutsu/object-swap`, `minimax-h3/reference-to-video`, `wan-3.0/video-edit`) and live updates when adding/removing reference audios or clearing source video.
  - Fixed remaining balance projection to subtract both in-flight active runs and full batch matrix totals across the model breakdown, Affordability Banner, Sidebar projection, and Spend Guard.
- **Video Timeline, Frame Picker & Startup Speed (`01-timeline-performance-fix`):**
  - Added `<USER_DATA_DIR>/cache/models-cache.json` stale-while-revalidate disk cache so startup model lists load immediately instead of blocking ~5s on network sync.
  - Throttled timeline scrubbing with `requestAnimationFrame` + seek-in-flight coalescing (`fastSeek` while dragging), switched filmstrip scanning to `preload="metadata"` with abort tokens & explicit decoder disposal, and set gallery video thumbnails to `preload="none"`.

### Added
- **Local FFmpeg Clip Trimmer & Multi-Clip Stitcher (`$0` API cost):**
  - Added `✂️ Cut & Use Clip` inside Video Timeline (`In` / `Out` controls via `POST /api/video/trim`) to trim clips down to ≤15s locally and auto-stage them.
  - Added `🎞️ Stitch` in Gallery bulk-select mode (`POST /api/video/concat`) to normalize mixed-resolution local videos cleanly into a single MP4.
- **Batch / Prompt-Variable & Seed Matrix Runner:**
  - Added `{option1 | option2}` brace expansion × `Batch / Variants` (`1×–4×` seeds, capped safely at 12 runs per click) with upfront multiplied Spend Guard protection.
- **Multi-Step Auto-Chain Post-Actions:**
  - Added `Auto-Chain Next` to stage finished outputs directly into Timeline, `MiniMax H3 Spicy` I2V, or `Tools → Video Upscaler`.
- **History Reliability Alerts & Cost-Per-Keep Analytics:**
  - Added `favorited_runs`, `cost_per_favorite`, and per-model completion/failure rates in `studio_history.sqlite`, surfacing historical failure alerts automatically before Run.
- **In-App GitHub Update Notifier:**
  - Added non-blocking `GET /api/check-update` check showing a subtle topbar update pill when a newer GitHub Release is published.

## [1.0.6] - 2026-11-16
- Removed built-in style and motion preset chips across menus while preserving R2V `+ Image 1` / `+ Video 1` / `+ Audio 1` chips and `+ Save Preset`.
- Added drag-and-drop Reference Image uploads on `#multiImageGroup`, Wan 3.0 15s clip trim notes, and step-by-step `video-edit` / `reference-to-video` usage banners.

## [1.0.5] - 2026-11-16
- Pinned `alibaba/wan-3.0/video-edit`, `bytedance/seedance-2.5/video-edit`, `kwaivgi/kling-v4.0/video-edit`, and `wavespeed-ai/openjutsu/character-swap` in `Video & Edit`.
- Fixed missing-`duration` formula evaluation and added single-slot `face_image` upload detection.

## [1.0.4] - 2026-11-16
- Consolidated single-app launcher (`Launch Studio.cmd` & `Launch Desktop.cmd`) using shared external `%AppData%\wavespeed-studio` storage and `scripts/import_legacy_studio.js`.
- Fixed desktop topbar tab overflow clipping and `/favicon.ico` 404.

## [1.0.3] - 2026-11-16
- Added `Ref → Video` tab (`reference_videos`/`videos`/`ref_videos`/`reference_files` & `reference_audios`/`audios`), streaming `POST /api/upload-raw`, `$0.00` Video Timeline & Frame Picker, Resolution Mismatch Advisory + Real-ESRGAN pre-upscale option, and `Tools` video upscaler routing.
