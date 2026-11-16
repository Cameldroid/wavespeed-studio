---
Coding Project Note: true
Note Creation Date: "2026-11-16T03:08:00-03:00"
Note Modified Date:
  - "2026-11-16T03:08:00-03:00"
---

# 2026-11-16T03:08:00-03:00 — Feature Spec Template

- **Status:** `Draft` | `In Progress` | `Shipped in vX.Y.Z`
- **Target Version:** `vX.Y.Z`

## 1. Goal & User Problem
Describe the exact outcome requested and why it helps the user or testers.

## 2. Files Likely Touched
- `public/index.html`
- `public/app.js`
- `server.js`
- `scripts/verify_studio_isolated.js`

## 3. Design & Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## 4. Zero-Spend Verification Plan
- `npm test` cases to add in `scripts/verify_studio_isolated.js`
- Playwright Chromium checks (route-mocking `/api/generate` & `/api/upload-raw`)
- `npx electron . --smoke-test` + secret scan
