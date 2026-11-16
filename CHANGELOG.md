# Changelog

All notable changes to **WaveSpeed Studio** are documented here.

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
