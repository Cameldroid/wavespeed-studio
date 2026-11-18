---
Coding Project Note: true
Note Creation Date: "2026-11-18T11:17:54-03:00"
Note Modified Date:
  - "2026-11-18T11:17:54-03:00"
---

# 2026-11-18T11:17:54-03:00 — Project Handover V3 (Continuation — `v1.3.1`)

- **Continued From:** [PROJECT HANDOVER V2.md](PROJECT%20HANDOVER%20V2.md) (through `v1.3.0`).
- **Authoritative Version & Entry Point:** `v1.3.1` on git branch `main`. Start via [Launch Studio.cmd](../Launch%20Studio.cmd) (`http://localhost:3000`, browser workflow) or [Launch Desktop.cmd](../Launch%20Desktop.cmd) (Electron). Both share unified user data at `C:\Users\psyco\AppData\Roaming\wavespeed-studio` (SQLite DB + logs + `.studio-config.json`) via `resolveDefaultUserDataDir()` in [server.js](../server.js) and output saving in `D:\wvst` (`D:\wvst\cropped_imgs\`).
- **Verified Installation State (No Split `.exe` Present):** Checked `%LOCALAPPDATA%\Programs\wavespeed-studio`, `%LOCALAPPDATA%\Programs\WaveSpeed Studio`, and `C:\Program Files\WaveSpeed Studio` — none exist on disk. Running directly from `d:\Cocoding\wavespeed-studio` scripts is already the cleanest single-source workflow (`git pull` / code edits take effect on restart without rebuilding NSIS/MSI installers).
- **Authoritative Documentation:**
  - Project Log: [PROJECT LOG V4.md](PROJECT%20LOG%20V4.md)
  - Feature Spec (`v1.3.1`): [features/05-collapsible-inputs-and-reuse-fix/SPEC.md](features/05-collapsible-inputs-and-reuse-fix/SPEC.md)
  - Workflow Policy: [FEATURE PIPELINE.md](FEATURE%20PIPELINE.md)
- **What `v1.3.1` Fixed & Added:**
  - **Source Reuse & Insertion Fixed (`useImageAsInput` / `reuseHistoryRun` / `sendToEditBtn`):** Added missing `getMultiImageSchemaKey` and `getLastImageSchemaKey` helpers in `public/app.js`; fixed T2I auto-switch to `bytedance/seedream-v5.5/edit`; cleared stale slots on reuse; preserved active `isImageEdit` models in `sendToEditBtn`; supported multi-image arrays in `captureVideoFrameAndRoute`, `extractTimelineFrame`, and `applyCroppedAsSourceImage`.
  - **Local Disk Path Serving & Upload Resolution:** Added `GET /api/local-file` in `server.js` (restricted to allowed media extensions) and extended `extractLocalMediaDiskPath()` / `resolveLocalMediaUrl()` / `resolvePayloadMedia()` (`target_image`, `source_image`, `body_image`), plus SQLite metadata enrichment on `listSavedOutputs()`.
  - **Modal Event Safety & Thumbnail Layout:** Replaced inline `onclick` string attributes in History DB and Output Details modals with delegated/explicit DOM listeners (fixing backslash/quote breakage on Windows paths & prompts) and removed `76px; overflow: hidden` height clipping on `.multi-img-thumb`.
  - **Foldable Sections, Mask Reorder & Quick-Run Buttons:** Moved Paint Region (`#maskCanvasGroup`) below Reference Images (`#multiImageGroup`) and defaulted it folded unless mask input is required (`flux-fill-dev`); made 9 sections (`#negativePromptGroup`, `#imageInputGroup`, `#lastImageGroup`, `#multiImageGroup`, `#maskCanvasGroup`, `#videoInputGroup`, `#refVideosGroup`, `#refAudiosGroup`, `#settingsSection`) collapsible via `▲`/`▼` buttons; added live-priced `⚡ Run` shortcuts in Prompt, Source Image, and Reference Images headers.
- **Safety Invariant (CRITICAL):** Per `AGENTS.md`, NEVER execute live `POST /api/generate` calls from automated scripts/terminals. Verify solely with offline tests (`npm test`) and read-only GET endpoints (`/api/config`, `/api/sources`, `/api/outputs`, `/api/models`, `/api/balance`).
- **Exact Next Action:** Copy [features/_TEMPLATE/SPEC.md](features/_TEMPLATE/SPEC.md) into `documentation/features/06-<next-feature>/SPEC.md` per [FEATURE PIPELINE.md](FEATURE%20PIPELINE.md) when starting the next feature slice.
