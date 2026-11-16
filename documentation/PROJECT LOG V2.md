---
Coding Project Note: true
Note Creation Date: "2026-11-16T03:08:00-03:00"
Note Modified Date:
  - "2026-11-16T03:08:00-03:00"
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
