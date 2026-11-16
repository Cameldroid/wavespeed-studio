---
Coding Project Note: true
Note Creation Date: "2026-11-16T03:08:00-03:00"
Note Modified Date:
  - "2026-11-16T03:08:00-03:00"
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
