---
Coding Project Note: true
Note Creation Date: "2026-11-16T03:08:00-03:00"
Note Modified Date:
  - "2026-11-16T03:08:00-03:00"
  - "2026-11-16T04:08:00-03:00"
---

# 2026-11-16T03:08:00-03:00 — Feature Spec: Video Timeline, Frame Picker & Navigation Responsiveness (`v1.0.7`)

- **Status:** `Draft` (Ready for fresh single-feature chat)
- **Target Version:** `v1.0.7`

## 1. User Problem Observed
In `v1.0.6`, opening the **Video Timeline & Frame Picker**, generating thumbnails, scrubbing, and initial page/tab responsiveness feel slow ("takes long to render and to click into a page").

## 2. Verified Root Causes in Current Codebase
1. **`generateTimelineFilmstrip()` double-loads & orphans decoder (`public/app.js:6118-6164`):**
   - Spawns a second `<video>` element (`probe`) with `probe.preload = 'auto'`, downloading/buffering the full clip twice concurrently alongside `#timelineVideoPlayer`.
   - Leaves `probe` alive in memory after extracting 8 frames (no `probe.removeAttribute('src'); probe.load()` cleanup) and lacks a cancellation token if the user loads a different video mid-scan.
2. **Unthrottled scrubber `input` events (`public/app.js:5062-5072`):**
   - `el.timelineScrubber.addEventListener('input', ...)` sets `el.timelineVideoPlayer.currentTime = ...` synchronously on every pixel dragged, queuing back-to-back keyframe video decodes and freezing clicks/UI paint while dragging.
3. **Slow initial `/api/models` startup stall (`server.js:555-597`):**
   - Measured live at `5,369 ms` (`1.47 MB` payload across `787` models) on cold start / cache miss before models populate cleanly, blocking interactive readiness on fresh open.
4. **Heavy synchronous DOM rebuilds on tab switch / gallery (`public/app.js:3184, 4353-4372`):**
   - Gallery renders up to `60` cards at once including `<video preload="metadata">` tags competing for range requests with the timeline player.

## 3. Target Implementation Plan
- **Timeline Player & Filmstrip (`public/app.js`):**
  - Coalesce scrubbing with `requestAnimationFrame` + seek-in-flight state (drag updates `timelineTimecode` immediately and seeks only the latest target position once the previous `seeked` event finishes, or `fastSeek()` when available during active drag + exact `currentTime` on `change`).
  - Pass an abort/generation counter (`state.timelineScanToken`) into `generateTimelineFilmstrip()`; use `preload = 'metadata'` (avoid downloading whole clip when byte-range seeking works), yield a frame (`setTimeout(..., 0)`) between thumbnails so clicks stay responsive, and explicitly tear down `probe` (`probe.pause(); probe.removeAttribute('src'); probe.load();`) in `finally`.
- **Stale-While-Revalidate Model Cache (`server.js`):**
  - Persist lightweight catalog cache on disk (`<USER_DATA_DIR>/cache/models-cache.json`) so `/api/models` responds in `<50 ms` immediately on launch using cached schemas, refreshing live discounts/models asynchronously in background when older than cache TTL.
- **Gallery Video Preload Optimization:**
  - Switch offscreen/idle gallery video thumbnails to `preload="none"` + lightweight poster/hover metadata load (or intersection observer) so gallery cards don't contend with active timeline seeking.

## 4. Acceptance Criteria
- [ ] Dragging `timelineScrubber` stays 60fps smooth with zero main-thread stutter and instant timecode updates.
- [ ] `generateTimelineFilmstrip()` cancels cleanly if switched/closed and disposes its offscreen `<video>` decoder (`finally` cleanup).
- [ ] Warm restart `/api/models` responds in `<200 ms` from disk SWR cache without delaying UI clicks.
- [ ] Playwright timing test verifies tab switch & timeline frame extraction stay responsive with `0` console/page errors.

## 5. Zero-Spend Verification Plan
- Add `verify_studio_isolated.js` tests for filmstrip cleanup/abort safety and `models-cache.json` SWR behavior.
- Run Playwright timing benchmark against `http://localhost:<temp-port>` (route-mocked `/api/generate`) measuring `openVideoInTimeline` -> interactive scrub -> `extractTimelineFrame`.
- Run `npm test`, `npx electron . --smoke-test`, and secret scan before releasing `v1.0.7`.


# 2026-11-16T04:08:00-03:00 — Implemented & Shipped in v1.0.7

- **Status:** `Shipped in v1.0.7` (bundled with R2V/V2V pricing fixes, local FFmpeg trim/stitch, batch prompt matrix, quick chains, historical failure/cost-per-keep analytics, and update notifier).
- **Verified Acceptance:**
  - `server.js`: Added `<USER_DATA_DIR>/cache/models-cache.json` stale-while-revalidate disk cache.
  - `public/app.js`: Added `requestAnimationFrame` + seek-in-flight / `fastSeek()` scrubbing, `state.timelineScanToken` abort control, `preload = 'metadata'` + `finally` decoder teardown in `generateTimelineFilmstrip()`, and `preload="none"` on gallery `<video>` thumbnails.
  - Playwright Chromium check (`http://127.0.0.1:39112`): 8/8 filmstrip frames rendered in `1,625 ms`, `preload="none"` confirmed on gallery videos, `0` console errors, `0` page errors.
