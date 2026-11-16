---
Coding Project Note: true
Note Creation Date: "2026-11-16T03:08:00-03:00"
Note Modified Date:
  - "2026-11-16T03:08:00-03:00"
---

# 2026-11-16T03:08:00-03:00 — Single-Feature Chat Pipeline & Documentation Rules

## 1. Why This Pipeline Exists
Instead of carrying one massive multi-week chat context across unrelated features, **each new feature or optimization gets its own subfolder** under `documentation/features/<NN-short-slug>/` and runs in a **fresh single-purpose chat**.

## 2. Directory Layout
```text
documentation/
├── START HERE.md              # Entry index for every fresh AI chat
├── ARCHITECTURE.md            # How every module & workflow works
├── PROJECT HANDOVER V2.md     # Current shipped version, runtime paths, next focus
├── PROJECT LOG V2.md          # Append-only chronological release & decision log
├── FEATURE PIPELINE.md        # This workflow manual
└── features/
    ├── _TEMPLATE/
    │   └── SPEC.md            # Copy for any new feature/fix
    └── 01-timeline-performance-fix/
        └── SPEC.md            # Next queued work slice
```

## 3. Standard Workflow Per Feature (1 Chat = 1 Slice)
1. **Scaffold Spec (`SPEC.md`):** Copy `documentation/features/_TEMPLATE/SPEC.md` into `documentation/features/<NN-slug>/SPEC.md`. Write Goal, Files Likely Touched, UX/API contract, Acceptance Criteria, and Zero-Spend Verification Steps.
2. **Start a Fresh Chat:** Paste the Kickoff Prompt below and point it directly to that `SPEC.md`.
3. **Implement & Verify Safely:**
   - NEVER hit live paid WaveSpeed generation endpoints (`AGENTS.md` rule).
   - Add targeted unit/DOM assertions in `scripts/verify_studio_isolated.js`.
   - Test UI/geometry/interactions with Playwright (`page.route` mocking `/api/generate` & `/api/upload-raw` if exercising Run).
   - Run `npm test`, `npx electron . --smoke-test`, and secret scan.
4. **Update Documentation (Append-Only Rules):**
   - Check off Status & Verification in `documentation/features/<NN-slug>/SPEC.md` with a matching ISO 8601 local timestamp (`-03:00`).
   - Append a concise summary entry to `PROJECT LOG V2.md` (roll to `V3` near ~8,000 chars) and update `PROJECT HANDOVER V2.md`.
5. **Ship:** Bump `package.json` patch version, commit, create annotated tag (`git tag -a vX.Y.Z -m "..."`), push `main --follow-tags`, and restart localhost if running.

## 4. Copy-Paste Kickoff Prompt for a Fresh Chat
```text
Work inside D:\Cocoding\wavespeed-studio.
Read AGENTS.md, documentation/START HERE.md, documentation/ARCHITECTURE.md, documentation/PROJECT HANDOVER V2.md, and implement ONLY the feature specified in:
documentation/features/<NN-slug>/SPEC.md

Rules:
- Zero live WaveSpeed API credit spend (mock /api/generate & /api/upload-raw in tests/Playwright).
- Follow append-only ISO 8601 documentation timestamps in documentation/.
- Verify with npm test, Playwright headless inspection (0 page errors), npx electron . --smoke-test, and secret scan before finishing.
```
