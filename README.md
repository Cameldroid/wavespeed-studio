# WaveSpeed Studio

A local-first Web Studio for **WaveSpeed AI** image generation, image editing, mask/inpainting, image-to-video, text-to-video, and video workflows — built with zero external runtime dependencies on **Node.js (>= 22.5.0)** and built-in **SQLite (`node:sqlite`)**.

## Features

- **Full WaveSpeed Model Catalog & Smart Advisor:** Searchable model selector with category tabs (`Image-to-Video`, `Video Gen`, `Image Edit`, `Image Gen`, `Utility`), quick filter chips (`Spicy 🌶️`, `50% OFF`, `Turbo / Fast`, `Audio`, `Reference`, `Video Extend`, `Cheapest`), and contextual workflow hints.
- **Exact Live Pricing Engine:** Uses verified JSONata pricing formulas (`pricing-formulas.json` + live WaveSpeed RSC sync) so resolution, duration, audio toggle, output format, and active promotional discounts calculate accurate per-run costs before you spend a cent.
- **Economy Auto-Defaults & Spend Guard:** Automatically picks cost-efficient defaults when switching to expensive models and prompts for explicit confirmation before runs above your configurable USD threshold.
- **Canvas Masking & Multi-Input Workflows:** Interactive brush mask editor, first/last frame selectors, reference image/video inputs, and direct local `/outputs/...` auto-upload chaining (send any generated image directly to **Edit**, **Mask**, or **I2V**).
- **Local Output Auto-Save & SQLite History:** Every completed generation is automatically saved under `outputs/images/`, `outputs/videos/`, and `outputs/metadata/`, and indexed in a searchable local SQLite database (`database/studio_history.sqlite`) with status filters, pinning, notes, batch compare (2–4 outputs side-by-side), and CSV export.
- **Zero Lock-In / Zero npm Installs Needed:** Pure Node.js standard library (`node:http`, `node:sqlite`, `node:fs`) + vanilla HTML/CSS/JS frontend.

## Install & Run

### Option 1: Windows Desktop App (`.exe` / `.msi` Installer — Easiest)
No Node.js, Git, or terminal required:
1. Download the latest **`WaveSpeed Studio Setup *.exe`** (custom install folder wizard + Desktop shortcut) or **`WaveSpeed Studio *.msi`** from the GitHub **Releases** page.
2. Run the installer. *(Note: Until code-signed, Windows SmartScreen may show "Windows protected your PC" -> click **More info** -> **Run anyway**.)*
3. Launch **WaveSpeed Studio** from your Desktop or Start Menu — it will prompt for your WaveSpeed API key (`https://wavespeed.ai/accesskey`) on first launch.
   - App settings, logs & SQLite DB stay safely in `%AppData%\WaveSpeed Studio`
   - Generated images & videos auto-save to `Documents\WaveSpeed Studio\outputs` (customizable anytime in **Settings -> Outputs Save Folder**)

### Option 2: Run From Source (Developers / macOS / Linux)

Requires **Node.js 22.5.0+** (uses built-in `node:sqlite`) and a **WaveSpeed AI API key** (`wsk_live_...`).

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Cameldroid/wavespeed-studio.git
   cd wavespeed-studio
   npm install
   ```

2. **Configure your API key** (choose either method):
   - **In-App Prompt:** Start the app and paste your key from https://wavespeed.ai/accesskey (stored locally in gitignored `.studio-config.json`).
   - **`.env` file:** `cp .env.example .env` and set `WAVESPEED_API_KEY=wsk_live_...`.

3. **Launch:**
   - **Desktop window (Electron):** `npm run desktop`
   - **Browser / headless server:** `npm start` (opens at `http://localhost:3000`, or double-click `Launch Studio.cmd` on Windows)
   - **Build Windows installers (`.exe` + `.msi` into `dist/`):** `npm run dist:win`

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `WAVESPEED_API_KEY` | `""` | Your WaveSpeed AI API key (overrides `.studio-config.json`). |
| `PORT` | `3000` | HTTP server listening port. |
| `WAVESPEED_STUDIO_ROOT` | Repo folder | Optional directory where `outputs/`, `logs/`, `database/`, `.env`, and `.studio-config.json` are stored. |

## Scripts & Verification

- `npm start` — Starts the Studio HTTP server on `http://localhost:3000`.
- `npm test` — Runs the isolated verification suite (`scripts/verify_studio_isolated.js`) covering pricing formulas, client state/DOM behavior, SQLite CRUD, and HTTP routing **with zero live WaveSpeed API spend**.
- `npm run sync-prices` — Performs a read-only refresh of WaveSpeed catalog pricing formulas (`pricing-formulas.json`).

## Local Data Privacy & Security

The `.gitignore` excludes all runtime state and credentials:
- `.env` and `.studio-config.json` (your API key)
- `outputs/` (generated images, videos, JSON sidecars)
- `database/*.sqlite*` (prompt & run history)
- `logs/` (local server & generation logs)

## License

MIT
