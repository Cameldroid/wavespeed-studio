---
Coding Project Note: true
Note Creation Date: "2026-11-16T19:58:43-03:00"
Note Modified Date:
  - "2026-11-16T19:58:43-03:00"
---

# 2026-11-16T19:58:43-03:00 — Source Image Reuse Fix, Gallery Folders, Details Modal & Source Grouping Specification

## 1. Executive Summary & Problem Statement

In previous versions of WaveSpeed Studio, users encountered three workflow frictions when iterating on edits and managing output media:
1. **Stale Inputs on "Reuse Input Image" / "Reuse Setup":** When clicking `🖼️ Reuse Input Image` or `🔁 Reuse Setup`, the edit slots in the Studio were not properly refreshed for pure multi-image array models (such as ByteDance `seedream-v5.5/edit`, Qwen `qwen-image/edit-plus`, and MiniMax `minimax-h3/image-edit`). Because these models declare their inputs under `images` or `reference_images` array schemas without a single `image` slot, the single dropzone was hidden, while `state.extraImages` was left untouched with stale pictures from prior selections.
2. **Missing Source Paths & Local Folder Access in Gallery:** Users who dragged images into the app or used clipboard tools (such as Ditto) lacked visibility into the origin disk paths and folder locations of source assets. In the Gallery grid, users could not directly open containing folders or inspect granular generation parameters and source origins.
3. **Source Image Identity Across Temp / Volatile Paths:** When copying or dragging images from clipboard managers (e.g. Ditto temp cache `AppData\Local\Temp\Ditto\...`), paths change unpredictably. Users needed a robust, path-independent way to identify source images, filter outputs by source, and group gallery cards by the exact original source asset.
4. **Predecessor History Completeness:** The user had run generations in an earlier project version (`D:\Cocoding\Aimagen Nsfw`) and needed verification that all past runs, outputs, and logs were merged and accounted for in WaveSpeed Studio without data loss or duplicate overwrites.

WaveSpeed Studio v1.3.0 resolves these issues comprehensively with zero automated live credit spend.

---

## 2. Architectural Design & Implementation Details

```
+---------------------------------------------------------------------------------------------------+
|                                      WAVESPEED STUDIO v1.3.0                                      |
+---------------------------------------------------------------------------------------------------+
                                                  |
           +--------------------------------------+-------------------------------------+
           |                                      |                                     |
           v                                      v                                     v
+-----------------------+              +----------------------+              +----------------------+
|  SOURCE REUSE OVERHAUL |              |  SHA-256 IDENTITY &  |              | GALLERY CARD ACTIONS |
|  (async, multi-model) |              |  GROUP BY SOURCE     |              |  & DETAILS MODAL     |
+-----------------------+              +----------------------+              +----------------------+
| * Extract all images  |              | * Web Crypto SHA-256 |              | * ℹ️ Details Modal   |
|   from input_sources, |              |   on upload/drag/crop|              |   (params + sources) |
|   params.images, etc. |              | * Preserves origin   |              | * 📂 Open Folder     |
| * Pure multi-array:   |              |   filepath & name    |              |   (explorer.exe)     |
|   reset extraImages   |              | * #gallerySource-    |              | * ➕ Use as Source / |
|   populate all slots  |              |   FilterSelect       |              |   Reference          |
| * Single-slot models: |              | * 🗂️ Group by Source |              | * 🔁 Reuse Setup     |
|   primary + lastImage |              |   (distinct sections |              | * ⚖️ Compare Pin     |
| * Smooth scroll & UI  |              |   w/ folder shortcuts|              | * 🗑️ Disk Delete     |
+-----------------------+              +----------------------+              +----------------------+
```

### 2.1 Overhaul of `reuseHistoryRun(item, onlyInputMedia = false)`

Located in [app.js](file:///d:/Cocoding/wavespeed-studio/public/app.js):
- **Model-Aware Schema Introspection:** Inspects `state.selectedModel` using `getSingleImageSchemaKey()`, `getMultiImageSchemaKey()`, and `getLastImageSchemaKey()`.
- **Pure Multi-Image Array Support:** For models like `bytedance/seedream-v5.5/edit` where `hasSingle` is `false` and `hasMulti` is `true`:
  1. Clears `state.sourceImage` and hidden single-image inputs.
  2. Resets `state.extraImages = []`.
  3. Populates all extracted images into `state.extraImages` with filenames, paths, checksums, and role tags.
  4. Calls `renderExtraImagesGrid()` and updates cost badges.
- **Single-Slot & Swap Dual-Slot Support:**
  1. Primary image restores into `state.sourceImage` (`#imageUrlInput`, `#imagePreviewContainer`).
  2. If `hasLast` is true (swap or start/end frames) and multiple images exist, the second image restores into `state.lastImage` (`#lastImageUrlInput`, `#lastImagePreviewContainer`).
  3. If `hasMulti` is true, remaining images append cleanly to `state.extraImages`.
- **Feedback & Navigation:** Closes open modals, displays an informative toast (`Restored N input image(s) into <Model>`), and smoothly scrolls to `#multiImageGroup` or `#imageInputGroup`.

### 2.2 Content Checksum (SHA-256) Identity & Source Grouping

- **SHA-256 Hashing:** When files are uploaded, dragged, or cropped, [app.js](file:///d:/Cocoding/wavespeed-studio/public/app.js) executes `computeFileSha256(fileOrBlob)` via the native Web Crypto API (`crypto.subtle.digest('SHA-256', buffer)`).
- **Decoupled Identity:** Storing `checksum` in `input_sources` decouples source identity from ephemeral filepaths (such as clipboard manager cache folders `AppData\Local\Temp\Ditto\...`). If an image is reused, dragged from a different path, or renamed, its SHA-256 checksum uniquely matches previous generations.
- **SQLite Indexing & FTS5 Search:** [history_db.js](file:///d:/Cocoding/wavespeed-studio/database/history_db.js) stores `checksum` in `input_sources_json` and includes it in `input_filenames`, enabling fast full-text search by hash prefix.
- **Backend Distinct Sources API (`GET /api/sources`):** [server.js](file:///d:/Cocoding/wavespeed-studio/server.js) queries `historyDb.listDistinctSources()` which groups historical inputs by `hash:<checksum>` or `name:<filename>`, counts run occurrences, and returns sorted distinct sources.
- **Gallery Source Filter (`#gallerySourceFilterSelect`):** Allows filtering outputs to only those derived from a specific input image, or viewing prompt-only (text-to-image) outputs.
- **Group by Source (`#galleryGroupBySourceBtn`):** Toggles gallery rendering between a flat grid and grouped sections. Each group displays:
  - Source title (filename or short SHA).
  - Output count badge.
  - SHA-256 checksum badge.
  - `➕ Use as Input` button (loads source into active Studio inputs).
  - `📂 Open Folder` button (opens directory containing original source).

### 2.3 Gallery Card Actions & Output Details Modal

Located in [index.html](file:///d:/Cocoding/wavespeed-studio/public/index.html) and [app.js](file:///d:/Cocoding/wavespeed-studio/public/app.js):
- **Card Action Buttons:**
  - `ℹ️ Details`: Opens `#outputDetailsModal`.
  - `📂 Folder`: Calls `POST /api/open-folder` (`explorer.exe /select,"<file>"`).
  - `➕ Use as Source`: Loads thumbnail URL directly into active Studio inputs via `useImageAsInput(url, meta)`.
  - `♻️ Clone Setup`: Calls `reuseHistoryRun(item, false)`.
  - `⚖️ Pin Compare`: Toggles side-by-side A/B model compare.
  - `🗑️ Delete`: Deletes file from disk and database with confirmation.
- **Output Details & Source Provenance Modal (`#outputDetailsModal`):**
  - Displays full output preview, aspect ratio, resolution, duration, seed, estimated price, saved date/time, and prompt with 1-click copy.
  - **Input Sources & Provenance Section:** For every input image used in the run, renders its slot, filename, origin filename (if derived from a crop), containing folder path, SHA-256 checksum pill, `📂 Folder` button, and `➕ Use as Source` button.

### 2.4 History Completeness & Predecessor Database Merge

- **Predecessor Verification (`D:\Cocoding\Aimagen Nsfw`):**
  - Audited `D:\Cocoding\Aimagen Nsfw\database\studio_history.sqlite`: confirmed all 82 generations were already present in `C:\Users\psyco\AppData\Roaming\wavespeed-studio\database\studio_history.sqlite` (220 total records).
  - Verified all 61 output images and 17 output videos in `Aimagen Nsfw\outputs` exist in `D:\wvst\images` and `D:\wvst\videos`.
  - Audited `D:\Cocoding\Aimagen Nsfw\logs\generations.jsonl`: identified 79 older generation logs missing from `C:\Users\psyco\AppData\Roaming\wavespeed-studio\logs\generations.jsonl`.
  - Safely merged and deduplicated the 79 missing historical entries with a `.bak` backup, ensuring complete history continuity across project moves.

---

## 3. Verification & Compliance Evidence

- **Zero Automated Spend (`AGENTS.md`):** Zero live credits spent. No generation requests dispatched to `https://api.wavespeed.ai` or local `/api/generate`.
- **Isolated Test Suite (`npm test`):**
  - Formula tests (209 models x 7 resolutions): PASSED.
  - Self-healing formula cache test: PASSED.
  - Mock DOM integration tests (`#gallerySourceFilterSelect`, `#galleryGroupBySourceBtn`, `#outputDetailsModal`, toggle states): PASSED.
  - SQLite FTS5 search by checksum and `listDistinctSources()`: PASSED.
  - Mock HTTP tests (`/api/sources`, `/api/open-folder`): PASSED.
- **Node Syntax Checks:** `node --check server.js database/history_db.js public/app.js scripts/verify_studio_isolated.js` completed with exit code 0.
