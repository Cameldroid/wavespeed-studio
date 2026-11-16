---
Coding Project Note: true
Note Creation Date: "2026-11-16T03:08:00-03:00"
Note Modified Date:
  - "2026-11-16T03:08:00-03:00"
  - "2026-11-16T04:08:00-03:00"
  - "2026-11-16T12:39:00-03:00"
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
