const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile, spawn } = require('child_process');
const { createHistoryDatabase } = require('./database/history_db');

const BASE_API = 'https://api.wavespeed.ai';
const APP_RESOURCES_DIR = process.env.WAVESPEED_RESOURCES_DIR
  ? path.resolve(process.env.WAVESPEED_RESOURCES_DIR)
  : __dirname;
const USER_DATA_DIR = process.env.WAVESPEED_USER_DATA_DIR
  ? path.resolve(process.env.WAVESPEED_USER_DATA_DIR)
  : (process.env.WAVESPEED_STUDIO_ROOT ? path.resolve(process.env.WAVESPEED_STUDIO_ROOT) : __dirname);
const PROJECT_ROOT = USER_DATA_DIR;
const ENV_FILE = path.join(PROJECT_ROOT, '.env');
const STUDIO_CONFIG_FILE = path.join(PROJECT_ROOT, '.studio-config.json');

function loadDotEnv(envPath) {
  try {
    if (!fs.existsSync(envPath)) return;
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch (e) {}
}

function loadStudioConfig() {
  try {
    if (!fs.existsSync(STUDIO_CONFIG_FILE)) return {};
    return JSON.parse(fs.readFileSync(STUDIO_CONFIG_FILE, 'utf8')) || {};
  } catch (e) {
    return {};
  }
}

function saveStudioConfig(partial) {
  const current = loadStudioConfig();
  const next = { ...current, ...partial };
  fs.mkdirSync(path.dirname(STUDIO_CONFIG_FILE), { recursive: true });
  fs.writeFileSync(STUDIO_CONFIG_FILE, JSON.stringify(next, null, 2));
  return next;
}

loadDotEnv(ENV_FILE);
const initialConfig = loadStudioConfig();

const PORT = (process.env.PORT !== undefined && process.env.PORT !== '') ? Number(process.env.PORT) : 3000;
let API_KEY = (process.env.WAVESPEED_API_KEY || initialConfig.apiKey || '').trim();

let OUTPUTS_DIR = initialConfig.outputsDir
  ? path.resolve(initialConfig.outputsDir)
  : (process.env.WAVESPEED_OUTPUTS_DIR ? path.resolve(process.env.WAVESPEED_OUTPUTS_DIR) : path.join(USER_DATA_DIR, 'outputs'));
let OUTPUTS_IMAGES_DIR = path.join(OUTPUTS_DIR, 'images');
let OUTPUTS_VIDEOS_DIR = path.join(OUTPUTS_DIR, 'videos');
let OUTPUTS_META_DIR = path.join(OUTPUTS_DIR, 'metadata');
const LOGS_DIR = path.join(USER_DATA_DIR, 'logs');
const DATABASE_DIR = path.join(USER_DATA_DIR, 'database');
const CACHE_DIR = path.join(USER_DATA_DIR, 'cache');
const MODELS_CACHE_FILE = path.join(CACHE_DIR, 'models-cache.json');
const SERVER_LOG_FILE = path.join(LOGS_DIR, 'server.log');
const GENERATIONS_LOG_FILE = path.join(LOGS_DIR, 'generations.jsonl');
const HISTORY_DB_FILE = path.join(DATABASE_DIR, 'studio_history.sqlite');

function ensureRuntimeDirs() {
  [
    USER_DATA_DIR,
    OUTPUTS_DIR,
    OUTPUTS_IMAGES_DIR,
    OUTPUTS_VIDEOS_DIR,
    OUTPUTS_META_DIR,
    LOGS_DIR,
    DATABASE_DIR,
    CACHE_DIR
  ].forEach(dir => {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) {}
  });
}

ensureRuntimeDirs();

let historyDb = null;
try {
  historyDb = createHistoryDatabase({
    dbPath: HISTORY_DB_FILE,
    outputsMetaDir: OUTPUTS_META_DIR,
    outputsImagesDir: OUTPUTS_IMAGES_DIR,
    outputsVideosDir: OUTPUTS_VIDEOS_DIR,
    generationsLogFile: GENERATIONS_LOG_FILE,
    serverLogFile: SERVER_LOG_FILE
  });
} catch (e) {
  console.error('Failed to initialize SQLite history database:', e.message);
}

function applyOutputsDir(nextDir) {
  const resolved = path.resolve(String(nextDir || '').trim());
  OUTPUTS_DIR = resolved;
  OUTPUTS_IMAGES_DIR = path.join(OUTPUTS_DIR, 'images');
  OUTPUTS_VIDEOS_DIR = path.join(OUTPUTS_DIR, 'videos');
  OUTPUTS_META_DIR = path.join(OUTPUTS_DIR, 'metadata');
  ensureRuntimeDirs();
  if (historyDb && typeof historyDb.setOutputsDirs === 'function') {
    historyDb.setOutputsDirs({
      outputsMetaDir: OUTPUTS_META_DIR,
      outputsImagesDir: OUTPUTS_IMAGES_DIR,
      outputsVideosDir: OUTPUTS_VIDEOS_DIR
    });
  }
  return OUTPUTS_DIR;
}

function logServerEvent(level, message, meta = null) {
  const ts = new Date().toISOString();
  const metaStr = meta ? ` | ${JSON.stringify(meta)}` : '';
  const line = `[${ts}] [${level}] ${message}${metaStr}\n`;
  try {
    fs.appendFileSync(SERVER_LOG_FILE, line, 'utf8');
  } catch (e) {}
  console.log(line.trim());
}

let cachedModels = null;
let cachedModelsTime = 0;
let modelsBgRefreshInFlight = null;
let lastPriceSyncTime = 0;
let cachedUpdateCheck = null;
let cachedUpdateCheckTime = 0;

// Track submitted tasks so auto-saved outputs include full prompt & parameter provenance
const pendingTasksMap = new Map();
const savedTasksMap = new Map();

const BUNDLED_FORMULAS_FILE = path.join(APP_RESOURCES_DIR, 'pricing-formulas.json');
const FORMULAS_FILE = path.join(USER_DATA_DIR, 'pricing-formulas.json');
function loadPricingFormulas() {
  let merged = {};
  try {
    if (fs.existsSync(BUNDLED_FORMULAS_FILE)) {
      merged = JSON.parse(fs.readFileSync(BUNDLED_FORMULAS_FILE, 'utf8')) || {};
    }
  } catch (e) {
    logServerEvent('ERROR', 'Failed to load bundled pricing-formulas.json', { error: e.message });
  }
  if (FORMULAS_FILE !== BUNDLED_FORMULAS_FILE) {
    try {
      if (fs.existsSync(FORMULAS_FILE)) {
        const userCached = JSON.parse(fs.readFileSync(FORMULAS_FILE, 'utf8')) || {};
        let repairedWiped = false;
        for (const [k, uEntry] of Object.entries(userCached)) {
          if (!uEntry || typeof uEntry !== 'object') continue;
          const bEntry = merged[k] || {};
          const uFormula = typeof uEntry.formula === 'string' ? uEntry.formula.trim() : '';
          const bFormula = typeof bEntry.formula === 'string' ? bEntry.formula.trim() : '';
          if (!uFormula && bFormula) {
            repairedWiped = true;
          }
          merged[k] = {
            ...bEntry,
            ...uEntry,
            formula: uFormula || bFormula || '',
            price_inputs: (Array.isArray(uEntry.price_inputs) && uEntry.price_inputs.length > 0)
              ? uEntry.price_inputs
              : (bEntry.price_inputs || []),
            variable_price: Boolean(uEntry.variable_price || bEntry.variable_price)
          };
        }
        if (repairedWiped) {
          try {
            fs.writeFileSync(FORMULAS_FILE, JSON.stringify(merged, null, 2));
          } catch (wErr) {}
        }
      }
    } catch (e) {}
  }
  return merged;
}
let pricingFormulasCache = loadPricingFormulas();

function extractJsonObjectAt(str, startIndex) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = startIndex; i < str.length; i++) {
    const ch = str[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          return JSON.parse(str.slice(startIndex, i + 1));
        }
      }
    }
  }
  return null;
}

// Fetch live catalog discount rates & base prices from wavespeed.ai/api/models (public, no auth required)
async function fetchCatalogDiscounts() {
  const catalogMap = {};
  const catalogItems = [];
  try {
    const pages = [1, 2, 3, 4, 5, 6, 7, 8];
    const results = await Promise.allSettled(
      pages.map(p =>
        fetch(`https://wavespeed.ai/api/models?page=${p}&page_size=200`, {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
          signal: AbortSignal.timeout(6000)
        }).then(r => (r.ok ? r.json() : null))
      )
    );
    for (const res of results) {
      if (res.status === 'fulfilled' && res.value && Array.isArray(res.value.items)) {
        for (const item of res.value.items) {
          if (item.model_uuid) {
            catalogItems.push(item);
            catalogMap[item.model_uuid] = {
              discount_rate: typeof item.discount_rate === 'number' ? item.discount_rate : 100,
              base_price_micro: item.base_price
            };
          }
        }
      }
    }
    lastPriceSyncTime = Date.now();
  } catch (e) {
    logServerEvent('WARN', 'Catalog discount fetch warning', { error: e.message });
  }
  return { catalogMap, catalogItems };
}

// Fetch live model pricing formula on demand from WaveSpeed RSC endpoint (with 30-min freshness TTL)
async function fetchLiveModelFormula(modelId, forceRefresh = false) {
  const parentId = modelId.includes('-spicy') ? modelId.replace(/-spicy\b/g, '') : null;
  const existing = pricingFormulasCache[modelId] || (parentId ? pricingFormulasCache[parentId] : null);
  const now = Date.now();
  const isFresh = existing && existing.fetched_at && (now - existing.fetched_at < 1800000) && (Boolean(existing.formula && existing.formula.trim()) || !existing.variable_price);
  if (!forceRefresh && isFresh) {
    return existing;
  }
  const candidateIds = parentId ? [modelId, parentId] : [modelId];
  for (const targetId of candidateIds) {
    try {
      const resp = await fetch(`https://wavespeed.ai/models/${targetId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'RSC': '1' },
        signal: AbortSignal.timeout(6000)
      });
      if (resp.ok) {
        const text = await resp.text();
        const idx = text.indexOf('{"model":{"model_uuid":');
        if (idx !== -1) {
          const parsed = extractJsonObjectAt(text, idx);
          if (parsed && parsed.model) {
            const m = parsed.model;
            const existingModel = cachedModels ? cachedModels.find(x => x.model_id === modelId) : null;
            const ownBaseMicro = existingModel?.base_price_micro || pricingFormulasCache[modelId]?.base_price_micro;
            const prevTarget = pricingFormulasCache[targetId];
            // WaveSpeed migrated RSC payloads to formula_shape + variable_price; never wipe known formulas with empty strings
            const liveFormula = (typeof m.formula === 'string' && m.formula.trim()) ? m.formula : '';
            const preservedFormula = liveFormula || (prevTarget?.formula && prevTarget.formula.trim() ? prevTarget.formula : '') || (existing?.formula && existing.formula.trim() ? existing.formula : '');
            const entry = {
              base_price_micro: m.base_price,
              discount_rate: typeof m.discount_rate === 'number' ? m.discount_rate : 100,
              formula: preservedFormula,
              variable_price: Boolean(m.variable_price || prevTarget?.variable_price || existing?.variable_price),
              formula_shape: m.formula_shape || prevTarget?.formula_shape || null,
              price_inputs: (Array.isArray(m.price_inputs) && m.price_inputs.length > 0) ? m.price_inputs : (prevTarget?.price_inputs || []),
              fetched_at: now
            };
            pricingFormulasCache[targetId] = entry;
            let returnedEntry = entry;
            if (targetId !== modelId) {
              const existingChild = pricingFormulasCache[modelId];
              const baseMismatch = ownBaseMicro && entry.base_price_micro && ownBaseMicro !== entry.base_price_micro;
              returnedEntry = {
                ...entry,
                base_price_micro: ownBaseMicro || entry.base_price_micro,
                formula: (baseMismatch && existingChild?.formula) ? existingChild.formula : entry.formula,
                inherited_from: targetId
              };
              pricingFormulasCache[modelId] = returnedEntry;
            }
            fs.writeFile(FORMULAS_FILE, JSON.stringify(pricingFormulasCache, null, 2), () => {});
            if (existingModel) {
              if (targetId === modelId && returnedEntry.base_price_micro) {
                existingModel.base_price_micro = returnedEntry.base_price_micro;
                existingModel.base_price = returnedEntry.base_price_micro / 1e6;
              }
              existingModel.discount_rate = returnedEntry.discount_rate;
              existingModel.discount_percent = Math.max(0, (100 - returnedEntry.discount_rate) / 100);
              existingModel.formula = returnedEntry.formula;
              existingModel.variable_price = Boolean(returnedEntry.variable_price);
              existingModel.price_inputs = returnedEntry.price_inputs;
              existingModel.has_formula = Boolean(returnedEntry.formula || !returnedEntry.variable_price);
              existingModel.fetched_at = now;
            }
            return returnedEntry;
          }
        }
      }
    } catch (e) {
      logServerEvent('WARN', `Live formula fetch fallback for ${targetId}`, { error: e.message });
    }
  }
  return existing || null;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.ico': 'image/x-icon'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 50 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function parseRawBody(req, maxBytes = 200 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let aborted = false;
    req.on('data', chunk => {
      if (aborted) return;
      total += chunk.length;
      if (total > maxBytes) {
        aborted = true;
        reject(new Error(`Upload exceeds ${(maxBytes / (1024 * 1024)).toFixed(0)} MB limit`));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!aborted) resolve(Buffer.concat(chunks));
    });
    req.on('error', err => {
      if (!aborted) reject(err);
    });
  });
}

function requireApiKey() {
  if (!API_KEY || !API_KEY.trim()) {
    const err = new Error('WaveSpeed API key is not configured. Click 🔑 Key in the topbar or set WAVESPEED_API_KEY in .env.');
    err.statusCode = 401;
    throw err;
  }
  return API_KEY.trim();
}

// Fetch user balance (read-only)
async function getBalance() {
  const key = requireApiKey();
  const resp = await fetch(`${BASE_API}/api/v3/balance`, {
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    }
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to fetch balance: ${resp.status} ${text}`);
  }
  return await resp.json();
}

// Fallback promotional model discounts if catalog request is unreachable
const PROMO_DISCOUNTS = {
  'bytedance/seedream-v5.5/edit': 0.05,
  'bytedance/seedream-v5.5': 0.05,
  'bytedance/seedream-v5.0-pro/edit': 0.10,
  'bytedance/seedream-v5.0-pro': 0.10,
  'bytedance/seedream-v5.0-flash/edit': 0.10,
  'bytedance/seedream-v5.0-flash': 0.10,
  'wavespeed-ai/minimax-h3/image-to-video': 0.50,
  'wavespeed-ai/minimax-h3/text-to-video': 0.50
};

// Canonical display name map for official models matching WaveSpeed UI
function getCleanModelTitle(modelId) {
  const titles = {
    // Seedream models
    'bytedance/seedream-v5.5/edit': 'Seedream 5.5 (Image Edit)',
    'bytedance/seedream-v5.5': 'Seedream 5.5 (Text-to-Image)',
    'bytedance/seedream-v5.0-pro/edit': 'Seedream 5.0 Pro (Image Edit)',
    'bytedance/seedream-v5.0-pro': 'Seedream 5.0 Pro (Text-to-Image)',
    'bytedance/seedream-v5.0-flash/edit': 'Seedream 5.0 Flash (Image Edit)',
    'bytedance/seedream-v5.0-flash': 'Seedream 5.0 Flash (Text-to-Image)',
    'bytedance/seedream-v5.0-lite': 'Seedream 5.0 Lite (Text-to-Image)',
    // Image to Video
    'wavespeed-ai/minimax-h3/image-to-video': 'MiniMax H3 (WaveSpeed 50% OFF Promo • I2V)',
    'wavespeed-ai/minimax-h3/image-to-video-spicy': 'MiniMax H3 Spicy 🌶️ (50% OFF Promo • I2V)',
    'wavespeed-ai/minimax-h3/reference-to-video': 'MiniMax H3 Reference-to-Video (50% OFF)',
    'alibaba/wan-3.0/reference-to-video': 'WAN 3.0 (Reference-to-Video)',
    'alibaba/wan-3.0-prime/reference-to-video': 'WAN 3.0 Prime (Reference-to-Video)',
    'bytedance/seedance-2.5/reference-to-video': 'Seedance 2.5 (Reference-to-Video)',
    'bytedance/seedance-2.5-flash/reference-to-video': 'Seedance 2.5 Flash (Reference-to-Video)',
    'kwaivgi/kling-v4.0/reference-to-video': 'Kling 4.0 (Reference-to-Video)',
    'kwaivgi/kling-v4.0-flash/reference-to-video': 'Kling 4.0 Flash (Reference-to-Video)',
    'minimax/h3-lite/reference-to-video': 'MiniMax H3 Lite (Reference-to-Video)',
    'wavespeed-ai/video-upscaler': 'WaveSpeed Video Upscaler (720p–4K)',
    'wavespeed-ai/video-upscaler-pro': 'WaveSpeed Video Upscaler Pro (720p–4K)',
    'wavespeed-ai/flashvsr': 'FlashVSR Video Upscaler (720p–4K)',
    'bytedance/video-upscaler': 'ByteDance Video Upscaler (1080p–4K)',
    'wavespeed-ai/real-esrgan': 'Real-ESRGAN Image Upscaler',
    'wavespeed-ai/image-upscaler': 'WaveSpeed Image Upscaler (2K–8K)',
    'bytedance/seedance-2.5/image-to-video': 'Seedance 2.5 (Image-to-Video)',
    'bytedance/seedance-2.5/image-to-video-spicy': 'Seedance 2.5 Spicy 🌶️ (Image-to-Video)',
    'bytedance/seedance-2.5/image-to-video-turbo': 'Seedance 2.5 Turbo (Image-to-Video)',
    'bytedance/seedance-2.5-flash/image-to-video': 'Seedance 2.5 Flash (Image-to-Video)',
    'bytedance/seedance-2.5-flash/image-to-video-spicy': 'Seedance 2.5 Flash Spicy 🌶️ (Image-to-Video)',
    'bytedance/seedance-2.0/image-to-video': 'Seedance 2.0 (Image-to-Video)',
    'bytedance/seedance-2.0/image-to-video-spicy': 'Seedance 2.0 Spicy 🌶️ (Image-to-Video)',
    'bytedance/seedance-2.0/image-to-video-turbo': 'Seedance 2.0 Turbo (Image-to-Video)',
    'bytedance/seedance-2.0-fast/image-to-video': 'Seedance 2.0 Fast (Image-to-Video)',
    'bytedance/seedance-2.0-fast/image-to-video-spicy': 'Seedance 2.0 Fast Spicy 🌶️ (Image-to-Video)',
    'bytedance/seedance-2.0-fast/image-to-video-turbo': 'Seedance 2.0 Fast Turbo (Image-to-Video)',
    'bytedance/seedance-2.0-mini/image-to-video': 'Seedance 2.0 Mini (Image-to-Video)',
    'bytedance/seedance-2.0-mini/image-to-video-spicy': 'Seedance 2.0 Mini Spicy 🌶️ (Image-to-Video)',
    'bytedance/seedance-2.0-mini/image-to-video-turbo': 'Seedance 2.0 Mini Turbo (Image-to-Video)',
    'bytedance/seedance-v1.5-pro/image-to-video': 'Seedance V1.5 Pro (Image-to-Video)',
    'bytedance/seedance-v1.5-pro/image-to-video-spicy': 'Seedance V1.5 Pro Spicy 🌶️ (Image-to-Video)',
    'bytedance/seedance-v1-pro-fast/image-to-video': 'Seedance V1 Pro Fast (Image-to-Video)',
    'minimax/h3/image-to-video': 'MiniMax H3 Official (Image-to-Video)',
    'minimax/h3-highspeed/image-to-video': 'MiniMax H3 Highspeed (Image-to-Video)',
    'minimax/h3-lite/image-to-video': 'MiniMax H3 Lite (Image-to-Video)',
    'minimax/hailuo-2.3/fast': 'Hailuo 2.3 Fast (Image-to-Video)',
    'minimax/hailuo-2.3/i2v-standard': 'Hailuo 2.3 Standard (Image-to-Video)',
    'minimax/hailuo-2.3/i2v-pro': 'Hailuo 2.3 Pro (Image-to-Video)',
    'minimax/hailuo-02/fast': 'Hailuo 02 Fast (Image-to-Video)',
    'alibaba/wan-3.0/image-to-video': 'WAN 3.0 (Image-to-Video)',
    'alibaba/wan-3.0/image-to-video-spicy': 'WAN 3.0 Spicy 🌶️ (Image-to-Video)',
    'alibaba/wan-3.0-prime/image-to-video': 'WAN 3.0 Prime (Image-to-Video)',
    'alibaba/wan-3.0-prime/image-to-video-spicy': 'WAN 3.0 Prime Spicy 🌶️ (Image-to-Video)',
    'alibaba/wan-2.7/image-to-video': 'WAN 2.7 (Image-to-Video)',
    'alibaba/wan-2.7/image-to-video-spicy': 'WAN 2.7 Spicy 🌶️ (Image-to-Video)',
    'alibaba/wan-2.7/image-to-video-pro': 'WAN 2.7 Pro (Image-to-Video)',
    'alibaba/wan-2.6/image-to-video': 'WAN 2.6 (Image-to-Video)',
    'alibaba/wan-2.6/image-to-video-spicy': 'WAN 2.6 Spicy 🌶️ (Image-to-Video)',
    'alibaba/wan-2.5/image-to-video': 'WAN 2.5 (Image-to-Video)',
    'wavespeed-ai/wan-2.2/i2v-480p': 'WAN 2.2 480p Economy (Image-to-Video)',
    'wavespeed-ai/wan-2.2/i2v-720p': 'WAN 2.2 720p HD (Image-to-Video)',
    'wavespeed-ai/wan-2.2-spicy/image-to-video': 'WAN 2.2 Spicy 🌶️ Economy (Image-to-Video)',
    'wavespeed-ai/wan-2.2-spicy/video-extend': 'WAN 2.2 Spicy 🌶️ (Video Extend)',
    'wavespeed-ai/ltx-2.3-spicy/image-to-video': 'LTX 2.3 Spicy 🌶️ Economy (Image-to-Video)',
    'kwaivgi/kling-v4.0/image-to-video': 'Kling 4.0 (Image-to-Video)',
    'kwaivgi/kling-v4.0-flash/image-to-video': 'Kling 4.0 Flash (Image-to-Video)',
    'kwaivgi/kling-v3.0-std/image-to-video': 'Kling 3.0 Standard (Image-to-Video)',
    'kwaivgi/kling-v2.6-std/image-to-video': 'Kling 2.6 Standard (Image-to-Video)',
    'google/gemini-omni-1.2-flash/image-to-video': 'Gemini Omni 1.2 Flash (Image-to-Video)',
    'google/veo3.1/image-to-video': 'Google Veo 3.1 (Image-to-Video)',
    'google/veo3.1-fast/image-to-video': 'Google Veo 3.1 Fast (Image-to-Video)',
    'google/veo3.1-lite/image-to-video': 'Google Veo 3.1 Lite (Image-to-Video)',
    'vidu/q4/image-to-video': 'Vidu Q4 (Image-to-Video)',
    'vidu/q3/image-to-video': 'Vidu Q3 (Image-to-Video)',
    'vidu/q3/image-to-video-spicy': 'Vidu Q3 Spicy 🌶️ (Image-to-Video)',
    'vidu/q3-turbo/image-to-video': 'Vidu Q3 Turbo (Image-to-Video)',
    'vidu/q3-pro/image-to-video': 'Vidu Q3 Pro (Image-to-Video)',
    'vidu/q2-pro/image-to-video-fast': 'Vidu Q2 Pro Fast (Image-to-Video)',
    'x-ai/grok-imagine-video-v1.5/image-to-video': 'Grok Imagine 1.5 (Image-to-Video)',
    'x-ai/grok-imagine-video/image-to-video': 'Grok Imagine (Image-to-Video)',
    'wavespeed-ai/open-video/image-to-video': 'OpenVideo Economy (Image-to-Video)',
    'black-forest-labs/flux-3/image-to-video': 'Flux 3 (Image-to-Video)',
    // Text to Video & Video Edit
    'wavespeed-ai/minimax-h3/text-to-video': 'MiniMax H3 (WaveSpeed 50% OFF Promo • T2V)',
    'wavespeed-ai/minimax-h3/video-edit': 'MiniMax H3 Video Edit (50% OFF)',
    'alibaba/wan-3.0/video-edit': 'WAN 3.0 (Video Edit • Up to 15s + Ref Images)',
    'alibaba/wan-3.0-prime/video-edit': 'WAN 3.0 Prime (Video Edit • Up to 15s)',
    'bytedance/seedance-2.5/video-edit': 'Seedance 2.5 (Video Edit + Ref Images)',
    'kwaivgi/kling-v4.0/video-edit': 'Kling 4.0 (Video Edit + Ref Images)',
    'wavespeed-ai/openjutsu/character-swap': 'OpenJutsu Character Swap (Video + Ref Images)',
    'bytedance/seedance-2.5/text-to-video': 'Seedance 2.5 (Text-to-Video)',
    'bytedance/seedance-2.5-flash/text-to-video': 'Seedance 2.5 Flash (Text-to-Video)',
    'bytedance/seedance-2.0/text-to-video': 'Seedance 2.0 (Text-to-Video)',
    'bytedance/seedance-2.0-mini/text-to-video': 'Seedance 2.0 Mini (Text-to-Video)',
    'alibaba/wan-3.0/text-to-video': 'WAN 3.0 (Text-to-Video)',
    'alibaba/wan-3.0-prime/text-to-video': 'WAN 3.0 Prime (Text-to-Video)',
    'alibaba/wan-2.5/text-to-video': 'WAN 2.5 (Text-to-Video)',
    'kwaivgi/kling-v4.0/text-to-video': 'Kling 4.0 (Text-to-Video)',
    'google/gemini-omni-1.2-flash/text-to-video': 'Gemini Omni 1.2 Flash (Text-to-Video)',
    // Image Edit
    'wavespeed-ai/minimax-h3-image/edit': 'MiniMax H3 Economy (Image Edit)',
    'wavespeed-ai/minimax-h3/image-edit': 'MiniMax H3 (WaveSpeed Image Edit)',
    'minimax/h3-image/edit': 'MiniMax H3 Official (Image Edit)',
    'openai/gpt-image-2.6-flare/edit': 'GPT Image 2.6 Flare (Image Edit)',
    'openai/gpt-image-2.6-sunburst/edit': 'GPT Image 2.6 Sunburst (Image Edit)',
    'openai/gpt-image-2.5-sunburst/edit': 'GPT Image 2.5 Sunburst (Image Edit)',
    'openai/gpt-image-2/edit': 'GPT Image 2 (Image Edit)',
    'google/nano-banana-2.1/edit': 'Nano Banana 2.1 (Image Edit)',
    'google/nano-banana-2/edit': 'Nano Banana 2 (Image Edit)',
    'google/nano-banana-pro/edit': 'Nano Banana Pro (Image Edit)',
    'wavespeed-ai/z-image-turbo/image-to-image': 'Z-Image Turbo (Image-to-Image)',
    'wavespeed-ai/flux-schnell': 'Flux Schnell (Image & Inpainting)',
    // Text to Image
    'wavespeed-ai/minimax-h3-image/text-to-image': 'MiniMax H3 Economy (Text-to-Image)',
    'wavespeed-ai/minimax-h3/text-to-image': 'MiniMax H3 (WaveSpeed Text-to-Image)',
    'minimax/h3-image/text-to-image': 'MiniMax H3 Official (Text-to-Image)',
    'openai/gpt-image-2.6-flare/text-to-image': 'GPT Image 2.6 Flare (Text-to-Image)',
    'openai/gpt-image-2.6-sunburst/text-to-image': 'GPT Image 2.6 Sunburst (Text-to-Image)',
    'openai/gpt-image-2.5-sunburst/text-to-image': 'GPT Image 2.5 Sunburst (Text-to-Image)',
    'openai/gpt-image-2/text-to-image': 'GPT Image 2 (Text-to-Image)',
    'wavespeed-ai/z-image/turbo': 'Z-Image Turbo (Text-to-Image)',
    'recraft-ai/recraft-v4.1-flash/text-to-image': 'Recraft V4.1 Flash (Text-to-Image)',
    'recraft-ai/recraft-v4.1/text-to-image': 'Recraft V4.1 (Text-to-Image)',
    'recraft-ai/recraft-v4.1-pro/text-to-image': 'Recraft V4.1 Pro (Text-to-Image)',
    'google/nano-banana-2.1/text-to-image': 'Nano Banana 2.1 (Text-to-Image)',
    'google/nano-banana-2/text-to-image': 'Nano Banana 2 (Text-to-Image)',
    'google/nano-banana-pro/text-to-image': 'Nano Banana Pro (Text-to-Image)'
  };
  return titles[modelId] || modelId;
}

function isPathInside(candidatePath, rootDir) {
  const resolvedCandidate = path.resolve(candidatePath);
  const resolvedRoot = path.resolve(rootDir);
  if (process.platform === 'win32') {
    const c = resolvedCandidate.toLowerCase();
    const r = resolvedRoot.toLowerCase();
    return c === r || c.startsWith(r + path.sep);
  }
  return resolvedCandidate === resolvedRoot || resolvedCandidate.startsWith(resolvedRoot + path.sep);
}

function loadDiskModelsCache() {
  try {
    if (!fs.existsSync(MODELS_CACHE_FILE)) return null;
    const parsed = JSON.parse(fs.readFileSync(MODELS_CACHE_FILE, 'utf8'));
    if (parsed && Array.isArray(parsed.data) && parsed.data.length > 0) {
      // Heal any empty formulas in cached disk models from repaired pricingFormulasCache
      pricingFormulasCache = loadPricingFormulas();
      parsed.data = parsed.data.map(m => {
        if (m && (!m.formula || !String(m.formula).trim())) {
          const parentId = m.model_id?.includes('-spicy') ? m.model_id.replace(/-spicy\b/g, '') : null;
          const restored = pricingFormulasCache[m.model_id] || (parentId ? pricingFormulasCache[parentId] : null);
          if (restored && restored.formula && restored.formula.trim()) {
            return {
              ...m,
              formula: restored.formula,
              price_inputs: (restored.price_inputs && restored.price_inputs.length > 0) ? restored.price_inputs : (m.price_inputs || []),
              variable_price: Boolean(restored.variable_price || m.variable_price),
              has_formula: true
            };
          }
        }
        return m;
      });
      return parsed;
    }
  } catch (e) {}
  return null;
}

function saveDiskModelsCache(models, savedAt) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(MODELS_CACHE_FILE, JSON.stringify({ savedAt, data: models }));
  } catch (e) {}
}

// Fetch all models and enrich with live catalog prices & formulas (Stale-While-Revalidate disk cache)
async function getModels(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedModels && (now - cachedModelsTime < 900000)) {
    return cachedModels;
  }
  if (!forceRefresh && !cachedModels) {
    const disk = loadDiskModelsCache();
    if (disk) {
      cachedModels = disk.data;
      cachedModelsTime = Number(disk.savedAt) || 0;
      if ((now - cachedModelsTime >= 900000) && !modelsBgRefreshInFlight) {
        modelsBgRefreshInFlight = getModels(true)
          .catch(() => null)
          .finally(() => { modelsBgRefreshInFlight = null; });
      }
      return cachedModels;
    }
  }

  // Reload pricing formulas (bundled fallback + user cache) if updated on disk
  pricingFormulasCache = loadPricingFormulas();

  const apiPromise = API_KEY
    ? fetch(`${BASE_API}/api/v3/models`, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      }).catch(() => null)
    : Promise.resolve(null);

  const [resp, catalogResult] = await Promise.all([
    apiPromise,
    fetchCatalogDiscounts()
  ]);
  const { catalogMap, catalogItems } = catalogResult;

  let allModels = [];
  if (resp && resp.ok) {
    const result = await resp.json();
    allModels = result.data || [];
  } else if (catalogItems.length > 0) {
    // Fallback to public WaveSpeed catalog when API key is not yet configured
    allModels = catalogItems.map(item => ({
      model_id: item.model_uuid,
      type: item.type || '',
      description: item.description || '',
      base_price: (item.base_price || 0) / 1e6,
      api_schema: {}
    }));
  } else if (resp && !resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to fetch models: ${resp.status} ${text}`);
  } else {
    throw new Error('Failed to fetch WaveSpeed models catalog. Check internet connection or set WAVESPEED_API_KEY.');
  }

  // Filter out internal duplicate LoRAs and trainer clutter while keeping 50%-OFF wavespeed-ai/minimax-h3 promos
  const filteredClutter = allModels.filter(m => {
    const mid = m.model_id.toLowerCase();

    if (mid.includes('-lora') || mid.includes('trainer') || mid.includes('singularity') ||
        mid.includes('p-h3') || mid.includes('v2v-480p-lora') || mid.includes('animate-2') ||
        mid.includes('mocha') || mid.includes('multitalk') || mid.includes('vace')) {
      return false;
    }

    if (mid.startsWith('wavespeed-ai/wan-2.2/i2v-') && mid.includes('lora')) {
      return false;
    }

    return true;
  });

  const PINNED_ORDER = [
    // Image-to-Video Top Picks
    'wavespeed-ai/minimax-h3/image-to-video',
    'wavespeed-ai/minimax-h3/image-to-video-spicy',
    'alibaba/wan-3.0/image-to-video',
    'alibaba/wan-3.0/image-to-video-spicy',
    'bytedance/seedance-2.0-mini/image-to-video',
    'bytedance/seedance-2.0-mini/image-to-video-spicy',
    'bytedance/seedance-2.0/image-to-video',
    'bytedance/seedance-2.5/image-to-video',
    'bytedance/seedance-2.5/image-to-video-spicy',
    'kwaivgi/kling-v4.0/image-to-video',
    'google/gemini-omni-1.2-flash/image-to-video',
    'minimax/h3-lite/image-to-video',
    'minimax/h3/image-to-video',
    // Image Gen Top Picks
    'bytedance/seedream-v5.5',
    'wavespeed-ai/minimax-h3-image/text-to-image',
    'recraft-ai/recraft-v4.1-flash/text-to-image',
    'wavespeed-ai/flux-schnell',
    'google/nano-banana-2.1/text-to-image',
    'openai/gpt-image-2.6-flare/text-to-image',
    // Image Edit Top Picks
    'bytedance/seedream-v5.5/edit',
    'wavespeed-ai/minimax-h3-image/edit',
    'google/nano-banana-2.1/edit',
    'minimax/h3-image/edit',
    'openai/gpt-image-2.6-flare/edit',
    // Text-to-Video & Video Edit Top Picks
    'wavespeed-ai/minimax-h3/text-to-video',
    'alibaba/wan-3.0/video-edit',
    'bytedance/seedance-2.5/video-edit',
    'wavespeed-ai/minimax-h3/video-edit',
    'kwaivgi/kling-v4.0/video-edit',
    'wavespeed-ai/openjutsu/character-swap',
    'alibaba/wan-3.0/text-to-video',
    'bytedance/seedance-2.0-mini/text-to-video',
    'bytedance/seedance-2.5/text-to-video',
    'kwaivgi/kling-v4.0/text-to-video',
    // Reference-to-Video Top Picks
    'wavespeed-ai/minimax-h3/reference-to-video',
    'alibaba/wan-3.0/reference-to-video',
    'bytedance/seedance-2.5/reference-to-video',
    'kwaivgi/kling-v4.0/reference-to-video',
    'bytedance/seedance-2.5-flash/reference-to-video',
    'minimax/h3-lite/reference-to-video',
    // Quick Tools & Upscalers Top Picks
    'wavespeed-ai/feynobg',
    'wavespeed-ai/real-esrgan',
    'wavespeed-ai/image-upscaler',
    'wavespeed-ai/video-upscaler',
    'bytedance/video-upscaler',
    'wavespeed-ai/flashvsr'
  ];

  const processed = filteredClutter.map(m => {
    const mid = m.model_id.toLowerCase();
    const type = (m.type || '').toLowerCase();
    const desc = (m.description || '').toLowerCase();

    // Exclude non-visual modalities (music, audio, 3D, text/moderation)
    const isNonVisual = type.includes('music') || type.includes('audio') ||
      type === 'image-to-3d' || type === 'content-moderation' || type === 'image-to-text' ||
      type === 'video-to-text' || type === 'video-to-audio';

    const isReferenceToVideo = !isNonVisual && (
      type === 'reference-to-video' || mid.includes('reference-to-video')
    );

    const isImageToVideo = !isNonVisual && !isReferenceToVideo && (
      type === 'image-to-video' || mid.includes('image-to-video') ||
      (mid.includes('i2v') && !mid.includes('lora')) ||
      (type.includes('video') && desc.includes('from reference image'))
    );

    const isUtility = !isNonVisual && !isReferenceToVideo && !isImageToVideo && (
      type.includes('background') || type.includes('image-effects') || type.includes('image-tools') ||
      type === 'upscale-image' || type === 'upscale-video' || type === 'video-tools' ||
      type === 'image-object-removal' || type === 'image-face-swap' ||
      mid.includes('remove-bg') || mid.includes('feynobg') || mid.includes('upscale') ||
      mid.includes('face-blur') || mid.includes('watermark-remover') || mid.includes('image-eraser') ||
      mid.includes('text-remover') || mid.includes('converter')
    );

    const isTextToVideoOrEdit = !isNonVisual && !isReferenceToVideo && !isImageToVideo && !isUtility && (
      type === 'text-to-video' || type === 'video-to-video' || type === 'video-extend' ||
      mid.includes('video-edit') || mid.includes('video-extend') ||
      mid.includes('t2v') || mid.includes('text-to-video') || type.includes('video')
    );

    const isImageEdit = !isNonVisual && !isReferenceToVideo && !isImageToVideo && !isTextToVideoOrEdit && !isUtility && (
      type.includes('image-to-image') || mid.includes('/edit') || mid.includes('image-edit') || mid.includes('inpaint') ||
      desc.includes('edit and composes images') || desc.includes('image-to-image')
    );

    const isImageGen = !isNonVisual && !isReferenceToVideo && !isImageToVideo && !isTextToVideoOrEdit && !isUtility && !isImageEdit && (
      type === 'text-to-image' || mid.includes('text-to-image') || mid.includes('flux') || mid.includes('recraft') ||
      mid.includes('sdxl') || mid.includes('z-image/turbo') || mid.includes('nano-banana') || mid.includes('seedream')
    );

    let category = 'other';
    if (isReferenceToVideo) category = 'ref-to-video';
    else if (isImageToVideo) category = 'image-to-video';
    else if (isTextToVideoOrEdit) category = 'video-gen';
    else if (isImageEdit) category = 'image-edit';
    else if (isImageGen) category = 'image-gen';
    else if (isUtility) category = 'utility';

    const pinnedIdx = PINNED_ORDER.indexOf(m.model_id);
    const isPinned = pinnedIdx !== -1;
    const pinnedRank = isPinned ? pinnedIdx : 9999;

    const schemaObj = (m.api_schema?.api_schemas || [])[0] || {};
    const reqSchema = schemaObj.request_schema || {};

    // Inherit parent formula & promo discount for -spicy (NSFW/uncensored) model variants
    const parentId = m.model_id.includes('-spicy') ? m.model_id.replace(/-spicy\b/g, '') : null;
    const directCatInfo = catalogMap[m.model_id];
    const catInfo = directCatInfo || (parentId ? catalogMap[parentId] : null);
    const formInfo = pricingFormulasCache[m.model_id] || (parentId ? pricingFormulasCache[parentId] : null);

    // Always prioritize live catalog discount_rate over static disk cache so price updates take effect immediately
    let discountRate = 100;
    if (catInfo && typeof catInfo.discount_rate === 'number') {
      discountRate = catInfo.discount_rate;
    } else if (formInfo && typeof formInfo.discount_rate === 'number') {
      discountRate = formInfo.discount_rate;
    } else if (PROMO_DISCOUNTS[m.model_id]) {
      discountRate = Math.round((1 - PROMO_DISCOUNTS[m.model_id]) * 100);
    } else if (parentId && PROMO_DISCOUNTS[parentId]) {
      discountRate = Math.round((1 - PROMO_DISCOUNTS[parentId]) * 100);
    }

    const discountPercent = Math.max(0, (100 - discountRate) / 100);
    const liveApiMicro = m.base_price !== undefined ? Math.round((m.base_price || 0) * 1e6) : null;
    const basePriceMicro = directCatInfo?.base_price_micro ?? liveApiMicro ?? catInfo?.base_price_micro ?? formInfo?.base_price_micro ?? 0;
    const basePriceUsd = basePriceMicro / 1e6;
    const effectivePrice = discountPercent > 0
      ? parseFloat((basePriceUsd * (1 - discountPercent)).toFixed(5))
      : basePriceUsd;

    const isSpicy = mid.includes('spicy') || mid.includes('nsfw') || mid.includes('uncensored') ||
      desc.includes('nsfw') || desc.includes('uncensored');

    return {
      model_id: m.model_id,
      name: getCleanModelTitle(m.model_id),
      base_price: basePriceUsd,
      base_price_micro: basePriceMicro,
      effective_price: effectivePrice,
      discount_rate: discountRate,
      discount_percent: discountPercent,
      formula: formInfo ? formInfo.formula : null,
      price_inputs: formInfo ? (formInfo.price_inputs || []) : [],
      variable_price: Boolean(formInfo?.variable_price || m.variable_price),
      has_formula: Boolean(formInfo && (formInfo.formula || !formInfo.variable_price)),
      fetched_at: formInfo?.fetched_at || 0,
      type: m.type,
      category,
      isReferenceToVideo,
      isImageToVideo,
      isTextToVideoOrEdit,
      isImageEdit,
      isImageGen,
      isUtility,
      isSpicy,
      isPinned,
      pinnedRank,
      description: m.description,
      schema: reqSchema
    };
  });

  const validModels = processed.filter(m => m.category !== 'other');
  validModels.sort((a, b) => {
    if (a.pinnedRank !== b.pinnedRank) return a.pinnedRank - b.pinnedRank;
    return (a.effective_price || 0) - (b.effective_price || 0);
  });
  cachedModels = validModels;
  cachedModelsTime = now;
  saveDiskModelsCache(validModels, now);
  return validModels;
}

function resolveFfmpegBinary() {
  const os = require('os');
  const candidates = [];
  if (process.env.FFMPEG_PATH) candidates.push(process.env.FFMPEG_PATH);
  if (process.platform === 'win32') {
    const localApp = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    candidates.push(path.join(localApp, 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe'));
    candidates.push('C:\\ffmpeg\\bin\\ffmpeg.exe');
  }
  candidates.push('ffmpeg');
  for (const c of candidates) {
    if (c === 'ffmpeg') return 'ffmpeg';
    try {
      if (fs.existsSync(c)) return c;
    } catch (e) {}
  }
  return 'ffmpeg';
}

function runFfmpegExec(args, timeoutMs = 120000) {
  const bin = resolveFfmpegBinary();
  return new Promise((resolve, reject) => {
    execFile(bin, args, { windowsHide: true, timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        const msg = err.code === 'ENOENT'
          ? 'FFmpeg binary not found. Install FFmpeg (e.g. winget install Gyan.FFmpeg) or set FFMPEG_PATH.'
          : (stderr ? String(stderr).split(/\r?\n/).slice(-5).join(' ') : err.message);
        const outErr = new Error(msg);
        outErr.code = err.code || 'FFMPEG_ERROR';
        outErr.statusCode = err.code === 'ENOENT' ? 422 : 500;
        return reject(outErr);
      }
      resolve({ stdout, stderr });
    });
  });
}

function recordLocalDerivedVideo(localPath, filename, modelId, promptText, paramsMeta = {}) {
  const localUrl = `/outputs/videos/${filename}`;
  const stat = fs.statSync(localPath);
  const taskId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const metaRecord = {
    task_id: taskId,
    model_id: modelId,
    prompt: promptText,
    parameters: paramsMeta,
    estimated_price: 0,
    output_index: 0,
    is_video: true,
    remote_url: null,
    local_url: localUrl,
    local_path: localPath,
    filename,
    size_bytes: stat.size,
    saved_at: new Date().toISOString()
  };
  try {
    ensureRuntimeDirs();
    fs.writeFileSync(path.join(OUTPUTS_META_DIR, `${path.basename(filename, path.extname(filename))}.json`), JSON.stringify(metaRecord, null, 2));
    fs.appendFileSync(GENERATIONS_LOG_FILE, JSON.stringify(metaRecord) + '\n', 'utf8');
    if (historyDb) {
      historyDb.recordOutputs({
        task_id: taskId,
        model_id: modelId,
        model_name: modelId,
        category: 'utility',
        prompt: promptText,
        payload: paramsMeta,
        estimated_price: 0,
        completed_at: metaRecord.saved_at,
        source_provenance: 'local_ffmpeg',
        items: [metaRecord]
      });
    }
  } catch (e) {
    logServerEvent('WARN', 'Failed saving derived video metadata', { error: e.message });
  }
  return metaRecord;
}

function compareSemver(a, b) {
  const pa = String(a || '').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b || '').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

// Automatically download and save completed outputs to ./outputs
async function saveOutputLocally(taskId, outputUrls, taskMeta = {}) {
  if (savedTasksMap.has(taskId)) {
    return savedTasksMap.get(taskId);
  }
  const savedItems = [];
  const modelId = taskMeta.model_id || 'wavespeed-model';
  const modelSlug = modelId.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 45);
  const now = new Date();
  const tsPrefix = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);

  for (let i = 0; i < outputUrls.length; i++) {
    const remoteUrl = outputUrls[i];
    if (!remoteUrl || typeof remoteUrl !== 'string') continue;

    try {
      const resp = await fetch(remoteUrl, { signal: AbortSignal.timeout(30000) });
      if (!resp.ok) continue;
      const contentType = (resp.headers.get('content-type') || '').toLowerCase();
      const arrayBuf = await resp.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);

      const urlPath = new URL(remoteUrl).pathname.toLowerCase();
      let ext = path.extname(urlPath);
      const isImageMime = contentType.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext);
      const isVideo = !isImageMime && (
        contentType.includes('video') || ['.mp4', '.webm', '.mov'].includes(ext) ||
        modelId.includes('video') || modelId.includes('i2v') || modelId.includes('t2v')
      );

      if (!ext || ext.length > 5) {
        if (isVideo) ext = '.mp4';
        else if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = '.jpg';
        else if (contentType.includes('webp')) ext = '.webp';
        else ext = '.png';
      }

      const subFolder = isVideo ? 'videos' : 'images';
      const targetDir = isVideo ? OUTPUTS_VIDEOS_DIR : OUTPUTS_IMAGES_DIR;
      const shortTask = String(taskId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 12);
      const suffix = outputUrls.length > 1 ? `_${i + 1}` : '';
      const filename = `${tsPrefix}_${modelSlug}_${shortTask}${suffix}${ext}`;
      const localPath = path.join(targetDir, filename);
      const localUrl = `/outputs/${subFolder}/${filename}`;

      fs.writeFileSync(localPath, buffer);

      const metaRecord = {
        task_id: taskId,
        model_id: modelId,
        prompt: taskMeta.payload?.prompt || taskMeta.prompt || '',
        parameters: taskMeta.payload || {},
        estimated_price: taskMeta.estimated_price ?? null,
        is_video: isVideo,
        remote_url: remoteUrl,
        local_url: localUrl,
        local_path: localPath,
        filename,
        size_bytes: buffer.length,
        saved_at: now.toISOString()
      };

      const metaFile = path.join(OUTPUTS_META_DIR, `${tsPrefix}_${modelSlug}_${shortTask}${suffix}.json`);
      fs.writeFileSync(metaFile, JSON.stringify(metaRecord, null, 2), 'utf8');
      fs.appendFileSync(GENERATIONS_LOG_FILE, JSON.stringify(metaRecord) + '\n', 'utf8');

      logServerEvent('INFO', `Saved generation output locally: ${localPath}`, {
        task_id: taskId,
        model_id: modelId,
        size_bytes: buffer.length
      });

      savedItems.push(metaRecord);
    } catch (e) {
      logServerEvent('ERROR', `Failed to save output locally for task ${taskId}`, { error: e.message, remoteUrl });
    }
  }

  if (savedItems.length > 0) {
    savedTasksMap.set(taskId, savedItems);
    if (historyDb && !String(modelId).startsWith('mock/')) {
      try {
        historyDb.recordOutputs({
          task_id: taskId,
          model_id: modelId,
          model_name: taskMeta.model_name || getCleanModelTitle(modelId),
          category: taskMeta.category || null,
          prompt: taskMeta.payload?.prompt || taskMeta.prompt || '',
          payload: taskMeta.payload || {},
          estimated_price: taskMeta.estimated_price ?? null,
          submitted_at: taskMeta.submitted_at || now.toISOString(),
          completed_at: now.toISOString(),
          source_provenance: 'live_api',
          items: savedItems
        });
      } catch (e) {
        logServerEvent('WARN', 'History DB output recording skipped', { error: e.message });
      }
    }
  }
  return savedItems;
}

// List locally saved outputs from ./outputs/metadata
function listSavedOutputs() {
  try {
    if (!fs.existsSync(OUTPUTS_META_DIR)) return [];
    const files = fs.readdirSync(OUTPUTS_META_DIR).filter(f => f.endsWith('.json'));
    const items = [];
    for (const f of files) {
      try {
        const raw = fs.readFileSync(path.join(OUTPUTS_META_DIR, f), 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && parsed.local_path && fs.existsSync(parsed.local_path)) {
          items.push(parsed);
        }
      } catch (e) {}
    }
    items.sort((a, b) => (b.saved_at || '').localeCompare(a.saved_at || ''));
    return items.slice(0, 60);
  } catch (e) {
    return [];
  }
}

// Upload file to Wavespeed
async function uploadToWavespeed(filename, mimeType, buffer) {
  const key = requireApiKey();
  const ticketResp = await fetch(`${BASE_API}/api/v3/media/uploads`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      filename: filename || 'upload.png',
      size: buffer.length
    })
  });

  if (!ticketResp.ok) {
    const errText = await ticketResp.text();
    throw new Error(`Upload ticket failed: ${ticketResp.status} ${errText}`);
  }

  const ticketData = await ticketResp.json();
  const ticket = ticketData.data;
  if (!ticket || !ticket.upload || !ticket.upload.url) {
    throw new Error('Invalid ticket response');
  }

  const uploadHeaders = ticket.upload.headers || {};
  if (!uploadHeaders['Content-Type']) {
    uploadHeaders['Content-Type'] = mimeType || 'application/octet-stream';
  }

  const putResp = await fetch(ticket.upload.url, {
    method: ticket.upload.method || 'PUT',
    headers: uploadHeaders,
    body: buffer
  });

  if (!putResp.ok) {
    const putErr = await putResp.text();
    throw new Error(`Storage upload failed: ${putResp.status} ${putErr}`);
  }

  return {
    download_url: ticket.download_url,
    filename: ticket.filename,
    size: ticket.size
  };
}

// Automatically upload any local /outputs/..., localhost URLs, or local files inside OUTPUTS_DIR before sending to WaveSpeed Cloud API
async function resolveLocalMediaUrl(val) {
  if (!val || typeof val !== 'string') return val;
  const resolvedOutputsDir = path.resolve(OUTPUTS_DIR);
  let rel = null;
  try {
    if (val.startsWith('/outputs/')) {
      rel = decodeURIComponent(val.replace(/^\/outputs\//, ''));
    } else if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/outputs\//i.test(val)) {
      const u = new URL(val);
      rel = decodeURIComponent(u.pathname.replace(/^\/outputs\//, ''));
    } else if (path.isAbsolute(val) && isPathInside(val, resolvedOutputsDir)) {
      rel = path.relative(resolvedOutputsDir, path.resolve(val));
    }
  } catch (e) {
    return val;
  }
  if (!rel) return val;

  const localPath = path.resolve(OUTPUTS_DIR, rel);
  if (!isPathInside(localPath, resolvedOutputsDir) || !fs.existsSync(localPath)) {
    return val;
  }
  const buffer = fs.readFileSync(localPath);
  const ext = path.extname(localPath).toLowerCase();
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
  const uploaded = await uploadToWavespeed(path.basename(localPath), mimeType, buffer);
  logServerEvent('INFO', `Auto-uploaded local output asset to WaveSpeed storage: ${localPath}`, {
    download_url: uploaded.download_url
  });
  return uploaded.download_url;
}

async function resolvePayloadMedia(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const singleKeys = ['image', 'mask_image', 'markup_image', 'video', 'audio', 'last_image', 'face_image'];
  for (const k of singleKeys) {
    if (typeof payload[k] === 'string' && payload[k]) {
      payload[k] = await resolveLocalMediaUrl(payload[k]);
    }
  }
  const arrayKeys = ['images', 'reference_images', 'videos', 'reference_videos', 'ref_videos', 'audios', 'reference_audios', 'reference_files'];
  for (const k of arrayKeys) {
    if (Array.isArray(payload[k])) {
      payload[k] = await Promise.all(payload[k].map(v => resolveLocalMediaUrl(v)));
    }
  }
  return payload;
}

// Submit generation task
async function runModel(modelId, payload) {
  const key = requireApiKey();
  await resolvePayloadMedia(payload);
  const url = `${BASE_API}/api/v3/${modelId}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.message || `API error ${resp.status}`);
  }
  return data;
}

// Poll task result
async function getTaskResult(taskId) {
  const key = requireApiKey();
  const url = `${BASE_API}/api/v3/predictions/${taskId}/result`;
  const resp = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${key}`
    }
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.message || `API error ${resp.status}`);
  }
  return data;
}

// Main HTTP Server
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  try {
    if (pathname === '/api/balance' && req.method === 'GET') {
      const balanceData = await getBalance();
      return sendJson(res, 200, balanceData);
    }

    if (pathname === '/api/models' && req.method === 'GET') {
      const forceRefresh = parsedUrl.searchParams.get('refresh') === 'true';
      const models = await getModels(forceRefresh);
      return sendJson(res, 200, {
        code: 200,
        synced_at: lastPriceSyncTime || Date.now(),
        outputs_dir: OUTPUTS_DIR,
        data: models
      });
    }

    if (pathname === '/api/model-pricing' && req.method === 'GET') {
      const modelId = parsedUrl.searchParams.get('id');
      const forceRefresh = parsedUrl.searchParams.get('refresh') === 'true';
      if (!modelId) {
        return sendJson(res, 400, { error: 'id query parameter is required' });
      }
      const formulaInfo = await fetchLiveModelFormula(modelId, forceRefresh);
      return sendJson(res, 200, { code: 200, data: formulaInfo });
    }

    if (pathname === '/api/sync-prices' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const [models, balanceData] = await Promise.all([
        getModels(true),
        getBalance().catch(() => null)
      ]);
      let activeFormula = null;
      if (body.model_id) {
        activeFormula = await fetchLiveModelFormula(body.model_id, true);
      }
      logServerEvent('INFO', 'Manual live price & balance sync completed', {
        models_count: models.length,
        model_id: body.model_id || null
      });
      return sendJson(res, 200, {
        code: 200,
        synced_at: Date.now(),
        models_count: models.length,
        balance: balanceData?.data?.balance,
        active_formula: activeFormula,
        data: models
      });
    }

    if (pathname === '/api/outputs' && req.method === 'GET') {
      const items = listSavedOutputs();
      return sendJson(res, 200, {
        code: 200,
        outputs_dir: OUTPUTS_DIR,
        project_root: PROJECT_ROOT,
        data: items
      });
    }

    if (pathname === '/api/outputs/delete' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const taskId = body?.task_id ? String(body.task_id) : null;
      const localUrl = body?.local_url ? String(body.local_url) : null;
      const rawLocalPath = body?.local_path ? String(body.local_path) : null;

      if (!taskId && !rawLocalPath && !localUrl) {
        return sendJson(res, 400, { error: 'task_id, local_path, or local_url is required' });
      }

      const resolvedRoot = path.resolve(OUTPUTS_DIR);
      let resolvedFile = null;

      if (rawLocalPath) {
        resolvedFile = path.resolve(rawLocalPath);
      } else if (localUrl && localUrl.startsWith('/outputs/')) {
        const rel = localUrl.replace(/^\/outputs\//, '').replace(/\//g, path.sep);
        resolvedFile = path.resolve(resolvedRoot, rel);
      } else if (taskId && fs.existsSync(OUTPUTS_META_DIR)) {
        for (const f of fs.readdirSync(OUTPUTS_META_DIR)) {
          if (!f.endsWith('.json')) continue;
          try {
            const meta = JSON.parse(fs.readFileSync(path.join(OUTPUTS_META_DIR, f), 'utf8'));
            if (meta?.task_id === taskId && meta?.local_path) {
              resolvedFile = path.resolve(meta.local_path);
              break;
            }
          } catch (e) {}
        }
      }

      if (resolvedFile && !isPathInside(resolvedFile, resolvedRoot)) {
        return sendJson(res, 403, { error: 'Refusing to delete file outside outputs directory' });
      }

      let fileDeleted = false;
      if (resolvedFile && fs.existsSync(resolvedFile)) {
        const stat = fs.statSync(resolvedFile);
        if (!stat.isFile()) {
          return sendJson(res, 400, { error: 'Target path is not a file' });
        }
        fs.unlinkSync(resolvedFile);
        fileDeleted = true;
      }

      let metadataDeleted = 0;
      if (fs.existsSync(OUTPUTS_META_DIR)) {
        for (const f of fs.readdirSync(OUTPUTS_META_DIR)) {
          if (!f.endsWith('.json')) continue;
          const metaPath = path.join(OUTPUTS_META_DIR, f);
          try {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            const metaResolved = meta?.local_path ? path.resolve(meta.local_path).toLowerCase() : null;
            const matchTask = Boolean(taskId && meta?.task_id === taskId);
            const matchPath = Boolean(resolvedFile && metaResolved === resolvedFile.toLowerCase());
            const matchUrl = Boolean(localUrl && meta?.local_url === localUrl);
            if (matchTask || matchPath || matchUrl) {
              fs.unlinkSync(metaPath);
              metadataDeleted++;
            }
          } catch (e) {}
        }
      }

      let dbResult = { deleted: false, changes: 0 };
      if (historyDb && typeof historyDb.deleteRun === 'function') {
        dbResult = historyDb.deleteRun({
          task_id: taskId,
          local_path: resolvedFile || rawLocalPath,
          local_url: localUrl
        });
      }

      logServerEvent('INFO', 'Deleted output artifact', {
        task_id: taskId,
        file_deleted: fileDeleted,
        metadata_deleted: metadataDeleted,
        db_changes: dbResult.changes
      });

      return sendJson(res, 200, {
        code: 200,
        file_deleted: fileDeleted,
        metadata_deleted: metadataDeleted,
        db_deleted: dbResult.deleted,
        db_changes: dbResult.changes
      });
    }

    if (pathname === '/api/history' && req.method === 'GET') {
      if (!historyDb) return sendJson(res, 500, { error: 'History database unavailable' });
      const data = historyDb.queryHistory({
        q: parsedUrl.searchParams.get('q') || '',
        model: parsedUrl.searchParams.get('model') || 'all',
        status: parsedUrl.searchParams.get('status') || 'all',
        type: parsedUrl.searchParams.get('type') || 'all',
        favorite: parsedUrl.searchParams.get('favorite') || '',
        limit: parsedUrl.searchParams.get('limit') || '150',
        offset: parsedUrl.searchParams.get('offset') || '0'
      });
      return sendJson(res, 200, { code: 200, ...data });
    }

    if (pathname === '/api/history/resync' && req.method === 'POST') {
      if (!historyDb) return sendJson(res, 500, { error: 'History database unavailable' });
      const synced = historyDb.syncFromExistingFiles();
      const data = historyDb.queryHistory({ limit: 150 });
      logServerEvent('INFO', 'History database resynced from disk', synced);
      return sendJson(res, 200, { code: 200, synced, ...data });
    }

    if (pathname === '/api/history/annotate' && req.method === 'POST') {
      if (!historyDb) return sendJson(res, 500, { error: 'History database unavailable' });
      const body = await parseJsonBody(req);
      if (!body.task_id) return sendJson(res, 400, { error: 'task_id is required' });
      const updated = historyDb.updateRunAnnotations({
        task_id: body.task_id,
        is_favorite: body.is_favorite,
        notes: body.notes
      });
      if (!updated) return sendJson(res, 404, { error: 'Run not found in history database' });
      return sendJson(res, 200, { code: 200, data: updated });
    }

    if (pathname === '/api/history/export' && req.method === 'GET') {
      if (!historyDb) return sendJson(res, 500, { error: 'History database unavailable' });
      const fmt = (parsedUrl.searchParams.get('format') || 'csv').toLowerCase();
      const filters = {
        q: parsedUrl.searchParams.get('q') || '',
        model: parsedUrl.searchParams.get('model') || 'all',
        status: parsedUrl.searchParams.get('status') || 'all',
        type: parsedUrl.searchParams.get('type') || 'all',
        favorite: parsedUrl.searchParams.get('favorite') || ''
      };
      if (fmt === 'json') {
        const result = historyDb.queryHistory({ ...filters, limit: 5000, offset: 0 });
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': 'attachment; filename="wavespeed_studio_history.json"'
        });
        return res.end(JSON.stringify(result.items, null, 2));
      }
      const csv = historyDb.exportCsv(filters);
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="wavespeed_studio_history.csv"'
      });
      return res.end(csv);
    }

    if (pathname === '/api/open-folder' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      let targetPath = OUTPUTS_DIR;
      if (body.target === 'project') targetPath = USER_DATA_DIR;
      else if (body.target === 'logs') targetPath = LOGS_DIR;
      else if (body.target === 'docs') targetPath = path.join(APP_RESOURCES_DIR, 'documentation');
      else if (body.target === 'images') targetPath = OUTPUTS_IMAGES_DIR;
      else if (body.target === 'videos') targetPath = OUTPUTS_VIDEOS_DIR;

      const allowedRoots = [OUTPUTS_DIR, USER_DATA_DIR, LOGS_DIR, APP_RESOURCES_DIR];
      let resolvedFile = null;
      if (body.filePath && typeof body.filePath === 'string') {
        const candidate = path.resolve(body.filePath);
        if (allowedRoots.some(r => isPathInside(candidate, r)) && fs.existsSync(candidate)) {
          resolvedFile = candidate;
          targetPath = path.dirname(resolvedFile);
        }
      }

      const isFolderMode = body.mode === 'folder';
      let explorerLaunched = false;
      let explorerError = null;
      try {
        let cmd = 'xdg-open';
        let args = [targetPath];
        let opts = { detached: true, stdio: 'ignore' };
        if (process.platform === 'win32') {
          cmd = 'explorer.exe';
          args = (resolvedFile && !isFolderMode)
            ? [`/select,"${resolvedFile}"`]
            : [`"${targetPath}"`];
          opts.windowsVerbatimArguments = true;
        } else if (process.platform === 'darwin') {
          cmd = 'open';
          args = (resolvedFile && !isFolderMode) ? ['-R', resolvedFile] : [targetPath];
        }
        const child = spawn(cmd, args, opts);
        child.on('error', (err) => {
          logServerEvent('WARN', `${cmd} spawn error`, { error: err.message, args });
        });
        child.unref();
        explorerLaunched = true;
      } catch (err) {
        explorerError = err.message;
      }

      const folderSubPath = targetPath.toLowerCase().startsWith(path.resolve(OUTPUTS_DIR).toLowerCase())
        ? path.relative(path.resolve(OUTPUTS_DIR), targetPath).replace(/\\/g, '/')
        : null;
      const folderBrowseUrl = folderSubPath !== null
        ? `/outputs/${folderSubPath ? folderSubPath + '/' : ''}`
        : null;

      const openedPath = isFolderMode ? targetPath : (resolvedFile || targetPath);
      logServerEvent('INFO', 'Open folder requested', {
        opened: openedPath,
        folder: targetPath,
        mode: body.mode || 'default',
        explorerLaunched,
        explorerError
      });

      return sendJson(res, 200, {
        success: true,
        opened: openedPath,
        folder: targetPath,
        folder_browse_url: folderBrowseUrl,
        outputs_dir: OUTPUTS_DIR,
        explorer_launched: explorerLaunched,
        explorer_error: explorerError
      });
    }

    if (pathname === '/api/upload' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const { filename, mimeType, base64Data } = body;
      if (!base64Data) {
        return sendJson(res, 400, { error: 'base64Data is required' });
      }
      const buffer = Buffer.from(base64Data.replace(/^data:[^;]+;base64,/, ''), 'base64');
      const uploadResult = await uploadToWavespeed(filename, mimeType, buffer);
      logServerEvent('INFO', `Uploaded media to WaveSpeed storage: ${filename || 'upload.png'}`, { size: buffer.length });
      return sendJson(res, 200, { code: 200, data: uploadResult });
    }

    if (pathname === '/api/upload-raw' && req.method === 'POST') {
      const buffer = await parseRawBody(req);
      if (!buffer || buffer.length === 0) {
        return sendJson(res, 400, { error: 'Empty upload body' });
      }
      const rawNameHeader = req.headers['x-file-name'] || 'upload.bin';
      let filename = 'upload.bin';
      try {
        filename = decodeURIComponent(String(rawNameHeader));
      } catch (e) {
        filename = String(rawNameHeader);
      }
      const mimeType = String(req.headers['content-type'] || 'application/octet-stream').split(';')[0].trim();
      const uploadResult = await uploadToWavespeed(filename, mimeType, buffer);
      logServerEvent('INFO', `Stream-uploaded raw media to WaveSpeed storage: ${filename}`, { size: buffer.length, mimeType });
      return sendJson(res, 200, { code: 200, data: uploadResult });
    }

    if (pathname === '/api/generate' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const { model_id, model_name, category, payload, estimated_price } = body;
      if (!model_id || !payload) {
        return sendJson(res, 400, { error: 'model_id and payload are required' });
      }
      const submittedAt = new Date().toISOString();
      logServerEvent('INFO', `Submitting generation task to ${model_id}`, { estimated_price, payload });
      try {
        const taskResult = await runModel(model_id, payload);
        const taskId = taskResult.data?.id || taskResult.id;
        if (taskId) {
          pendingTasksMap.set(taskId, {
            model_id,
            model_name: model_name || getCleanModelTitle(model_id),
            category: category || null,
            payload,
            estimated_price,
            submitted_at: submittedAt
          });
          if (historyDb && !String(model_id).startsWith('mock/')) {
            try {
              historyDb.recordSubmission({
                task_id: taskId,
                model_id,
                model_name: model_name || getCleanModelTitle(model_id),
                category: category || null,
                payload,
                estimated_price,
                submitted_at: submittedAt,
                status: 'submitted'
              });
            } catch (e) {}
          }
        }
        return sendJson(res, 200, taskResult);
      } catch (err) {
        if (historyDb && !String(model_id).startsWith('mock/')) {
          try {
            const errId = `err-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
            historyDb.recordSubmission({
              task_id: errId,
              model_id,
              model_name: model_name || getCleanModelTitle(model_id),
              category: category || null,
              payload,
              estimated_price,
              submitted_at: submittedAt,
              status: 'failed'
            });
            historyDb.recordTaskStatus({ task_id: errId, status: 'failed', error_message: err.message });
          } catch (e) {}
        }
        throw err;
      }
    }

    if (pathname.startsWith('/api/task/') && req.method === 'GET') {
      const taskId = pathname.replace('/api/task/', '');
      const statusData = await getTaskResult(taskId);
      const inner = statusData.data || statusData;
      const meta = pendingTasksMap.get(taskId) || {};
      if (inner && inner.status === 'completed' && Array.isArray(inner.outputs) && inner.outputs.length > 0) {
        const localSaved = await saveOutputLocally(taskId, inner.outputs, meta);
        inner.local_outputs = localSaved;
        inner.outputs_dir = OUTPUTS_DIR;
      } else if (inner && inner.status && historyDb) {
        try {
          historyDb.recordTaskStatus({
            task_id: taskId,
            status: inner.status,
            error_message: inner.error || null,
            model_id: meta.model_id || null,
            payload: meta.payload || null,
            estimated_price: meta.estimated_price ?? null
          });
        } catch (e) {}
      }
      return sendJson(res, 200, statusData);
    }

    if (pathname === '/api/config' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      let updatedApiKey = false;
      let updatedOutputsDir = false;

      if (typeof body.apiKey === 'string') {
        API_KEY = body.apiKey.trim();
        saveStudioConfig({ apiKey: API_KEY });
        cachedModels = null;
        updatedApiKey = true;
        logServerEvent('INFO', API_KEY ? 'API Key updated and saved to .studio-config.json' : 'API Key cleared via studio settings');
      }

      if (typeof body.outputsDir === 'string' && body.outputsDir.trim()) {
        const nextOutputsDir = path.resolve(body.outputsDir.trim());
        const stat = fs.existsSync(nextOutputsDir) ? fs.statSync(nextOutputsDir) : null;
        if (stat && !stat.isDirectory()) {
          return sendJson(res, 400, { error: 'outputsDir path exists and is not a directory' });
        }
        applyOutputsDir(nextOutputsDir);
        saveStudioConfig({ outputsDir: OUTPUTS_DIR });
        updatedOutputsDir = true;
        if (historyDb && typeof historyDb.syncFromExistingFiles === 'function') {
          try {
            historyDb.syncFromExistingFiles({ rebuild: true });
          } catch (syncErr) {
            logServerEvent('WARN', 'Failed to re-sync SQLite outputs after folder change', { error: syncErr.message });
          }
        }
        logServerEvent('INFO', 'Outputs folder updated and saved to .studio-config.json', { outputsDir: OUTPUTS_DIR });
      }

      if (!updatedApiKey && !updatedOutputsDir) {
        return sendJson(res, 400, { error: 'apiKey or outputsDir required' });
      }

      const messages = [];
      if (updatedApiKey) messages.push(API_KEY ? 'API key updated' : 'API key cleared');
      if (updatedOutputsDir) messages.push('Outputs folder updated');

      return sendJson(res, 200, {
        success: true,
        hasApiKey: Boolean(API_KEY),
        outputsDir: OUTPUTS_DIR,
        updatedApiKey,
        updatedOutputsDir,
        message: messages.join(' & ')
      });
    }

    if (pathname === '/api/config' && req.method === 'GET') {
      const masked = API_KEY ? `${API_KEY.slice(0, 8)}...${API_KEY.slice(-4)}` : 'Not set';
      let appVersion = '1.0.6';
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(APP_RESOURCES_DIR, 'package.json'), 'utf8'));
        if (pkg?.version) appVersion = pkg.version;
      } catch (e) {}
      return sendJson(res, 200, {
        hasApiKey: Boolean(API_KEY),
        apiKey: masked,
        version: appVersion,
        projectRoot: PROJECT_ROOT,
        outputsDir: OUTPUTS_DIR,
        logsDir: LOGS_DIR
      });
    }

    if (pathname === '/api/check-update' && req.method === 'GET') {
      let currentVersion = '1.0.6';
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(APP_RESOURCES_DIR, 'package.json'), 'utf8'));
        if (pkg?.version) currentVersion = pkg.version;
      } catch (e) {}

      const now = Date.now();
      if (cachedUpdateCheck && (now - cachedUpdateCheckTime < 900000)) {
        return sendJson(res, 200, cachedUpdateCheck);
      }

      let result = {
        currentVersion,
        latestVersion: currentVersion,
        hasUpdate: false,
        releaseUrl: 'https://github.com/Cameldroid/wavespeed-studio/releases'
      };
      try {
        const resp = await fetch('https://api.github.com/repos/Cameldroid/wavespeed-studio/releases/latest', {
          headers: { 'User-Agent': 'WaveSpeed-Studio-Updater', 'Accept': 'application/vnd.github+json' },
          signal: AbortSignal.timeout(4000)
        });
        if (resp.ok) {
          const rel = await resp.json();
          const latest = String(rel?.tag_name || '').replace(/^v/i, '').trim();
          if (latest) {
            result = {
              currentVersion,
              latestVersion: latest,
              hasUpdate: compareSemver(latest, currentVersion) > 0,
              releaseUrl: rel.html_url || result.releaseUrl
            };
          }
        }
      } catch (e) {}
      cachedUpdateCheck = result;
      cachedUpdateCheckTime = now;
      return sendJson(res, 200, result);
    }

    if (pathname === '/api/video/trim' && req.method === 'POST') {
      const os = require('os');
      const startSec = Math.max(0, Number(parsedUrl.searchParams.get('start') ?? 0) || 0);
      const endSecRaw = Number(parsedUrl.searchParams.get('end') ?? 0);
      const durationSec = (Number.isFinite(endSecRaw) && endSecRaw > startSec) ? (endSecRaw - startSec) : 0;
      if (durationSec <= 0.1) {
        return sendJson(res, 400, { error: 'End time must be greater than Start time by at least 0.1s' });
      }
      const localUrlHdr = parsedUrl.searchParams.get('local_url') || req.headers['x-local-url'] || '';
      let inputPath = null;
      let tmpInputPath = null;
      const resolvedRoot = path.resolve(OUTPUTS_DIR);
      if (localUrlHdr && String(localUrlHdr).startsWith('/outputs/')) {
        const rel = String(localUrlHdr).replace(/^\/outputs\//, '').replace(/\//g, path.sep);
        const candidate = path.resolve(resolvedRoot, rel);
        if (!isPathInside(candidate, resolvedRoot) || !fs.existsSync(candidate)) {
          return sendJson(res, 403, { error: 'Invalid or missing local video path' });
        }
        inputPath = candidate;
      } else {
        const rawBuf = await parseRawBody(req);
        if (!rawBuf || rawBuf.length === 0) {
          return sendJson(res, 400, { error: 'Provide x-local-url or raw video bytes' });
        }
        tmpInputPath = path.join(os.tmpdir(), `ws-trim-in-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.mp4`);
        fs.writeFileSync(tmpInputPath, rawBuf);
        inputPath = tmpInputPath;
      }

      ensureRuntimeDirs();
      const tsPrefix = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const outFilename = `${tsPrefix}_local-trim_${startSec.toFixed(1)}-${(startSec + durationSec).toFixed(1)}s.mp4`;
      const outPath = path.join(OUTPUTS_VIDEOS_DIR, outFilename);

      try {
        // Re-encode with -ss/-t cleanly so exact frame bounds & Wan 3.0 keyframes stay clean
        await runFfmpegExec([
          '-y',
          '-ss', startSec.toFixed(3),
          '-i', inputPath,
          '-t', durationSec.toFixed(3),
          '-c:v', 'libx264',
          '-preset', 'veryfast',
          '-crf', '20',
          '-pix_fmt', 'yuv420p',
          '-c:a', 'aac',
          '-movflags', '+faststart',
          outPath
        ]).catch(async () => {
          // Retry without audio stream if source clip has no audio track
          await runFfmpegExec([
            '-y',
            '-ss', startSec.toFixed(3),
            '-i', inputPath,
            '-t', durationSec.toFixed(3),
            '-an',
            '-c:v', 'libx264',
            '-preset', 'veryfast',
            '-crf', '20',
            '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart',
            outPath
          ]);
        });
        const rec = recordLocalDerivedVideo(
          outPath,
          outFilename,
          'local/ffmpeg-trim',
          `Trimmed ${startSec.toFixed(2)}s–${(startSec + durationSec).toFixed(2)}s (${durationSec.toFixed(1)}s)`,
          { start_sec: startSec, duration_sec: durationSec }
        );
        logServerEvent('INFO', 'Local FFmpeg trim saved', { filename: outFilename, startSec, durationSec });
        return sendJson(res, 200, { code: 200, data: rec });
      } finally {
        if (tmpInputPath && fs.existsSync(tmpInputPath)) {
          try { fs.unlinkSync(tmpInputPath); } catch (e) {}
        }
      }
    }

    if (pathname === '/api/video/concat' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const urls = Array.isArray(body?.urls) ? body.urls : [];
      if (urls.length < 2) {
        return sendJson(res, 400, { error: 'Select at least 2 local output videos to stitch together.' });
      }
      if (urls.length > 10) {
        return sendJson(res, 400, { error: 'Stitch up to 10 clips at once.' });
      }
      const resolvedRoot = path.resolve(OUTPUTS_DIR);
      const inputPaths = [];
      for (const u of urls) {
        const s = String(u || '');
        if (!s.startsWith('/outputs/')) {
          return sendJson(res, 400, { error: 'Only locally saved /outputs/ videos can be stitched offline.' });
        }
        const rel = s.replace(/^\/outputs\//, '').replace(/\//g, path.sep);
        const candidate = path.resolve(resolvedRoot, rel);
        if (!isPathInside(candidate, resolvedRoot) || !fs.existsSync(candidate)) {
          return sendJson(res, 403, { error: `Clip missing or outside outputs folder: ${s}` });
        }
        inputPaths.push(candidate);
      }

      ensureRuntimeDirs();
      const tsPrefix = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const outFilename = `${tsPrefix}_local-stitch_${inputPaths.length}clips.mp4`;
      const outPath = path.join(OUTPUTS_VIDEOS_DIR, outFilename);

      const ffArgs = ['-y'];
      inputPaths.forEach(p => { ffArgs.push('-i', p); });
      const scaleChain = inputPaths.map((_, idx) =>
        `[${idx}:v]scale=720:720:force_original_aspect_ratio=decrease,pad=720:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p[v${idx}]`
      ).join(';');
      const concatInputs = inputPaths.map((_, idx) => `[v${idx}]`).join('');
      const filterComplex = `${scaleChain};${concatInputs}concat=n=${inputPaths.length}:v=1:a=0[vout]`;

      ffArgs.push(
        '-filter_complex', filterComplex,
        '-map', '[vout]',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '20',
        '-movflags', '+faststart',
        outPath
      );

      await runFfmpegExec(ffArgs, 180000);
      const rec = recordLocalDerivedVideo(
        outPath,
        outFilename,
        'local/ffmpeg-stitch',
        `Stitched ${inputPaths.length} clips locally`,
        { clip_count: inputPaths.length, source_urls: urls }
      );
      logServerEvent('INFO', 'Local FFmpeg concat saved', { filename: outFilename, clipCount: inputPaths.length });
      return sendJson(res, 200, { code: 200, data: rec });
    }

    // Serve locally saved outputs from ./outputs
    if (pathname.startsWith('/outputs/')) {
      let rel = '';
      try {
        rel = decodeURIComponent(pathname.replace(/^\/outputs\//, ''));
      } catch (e) {
        res.writeHead(400);
        return res.end('Bad Request');
      }
      const resolvedOutputsDir = path.resolve(OUTPUTS_DIR);
      const outPath = path.resolve(OUTPUTS_DIR, rel);
      if (!isPathInside(outPath, resolvedOutputsDir)) {
        res.writeHead(403);
        return res.end('Forbidden');
      }
      if (fs.existsSync(outPath) && fs.statSync(outPath).isDirectory()) {
        const entries = fs.readdirSync(outPath, { withFileTypes: true })
          .map(dirent => {
            const full = path.join(outPath, dirent.name);
            const st = fs.statSync(full);
            const urlRel = path.relative(resolvedOutputsDir, full).replace(/\\/g, '/');
            return {
              name: dirent.name,
              isDir: dirent.isDirectory(),
              size: st.size,
              mtimeMs: st.mtimeMs,
              href: `/outputs/${urlRel.split('/').map(encodeURIComponent).join('/')}${dirent.isDirectory() ? '/' : ''}`
            };
          })
          .filter(e => e.name !== 'metadata')
          .sort((a, b) => (b.isDir - a.isDir) || (b.mtimeMs - a.mtimeMs));

        const parentRel = path.relative(resolvedOutputsDir, outPath).replace(/\\/g, '/');
        const escHtml = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        const cardsHtml = entries.map(e => {
          const isImg = /\.(png|jpe?g|webp|gif)$/i.test(e.name);
          const isVid = /\.(mp4|webm|mov)$/i.test(e.name);
          const preview = e.isDir
            ? '<div style="font-size:2.4rem;">📁</div>'
            : (isImg
              ? `<img src="${e.href}" loading="lazy" style="width:100%;height:100%;object-fit:cover;">`
              : (isVid
                ? `<video src="${e.href}" muted preload="metadata" style="width:100%;height:100%;object-fit:cover;"></video>`
                : '<div style="font-size:2rem;">📄</div>'));
          const sizeTxt = e.isDir ? 'Folder' : `${(e.size / (1024 * 1024)).toFixed(2)} MB`;
          return `<a href="${e.href}" style="display:flex;flex-direction:column;background:#121826;border:1px solid #263044;border-radius:10px;overflow:hidden;color:#e5e7eb;text-decoration:none;">
            <div style="height:170px;background:#05070c;display:flex;align-items:center;justify-content:center;overflow:hidden;">${preview}</div>
            <div style="padding:8px 10px;font-size:12px;word-break:break-all;">
              <div style="font-weight:600;">${escHtml(e.name)}</div>
              <div style="color:#94a3b8;margin-top:2px;">${escHtml(sizeTxt)}</div>
            </div>
          </a>`;
        }).join('');

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escHtml(outPath)}</title></head>
<body style="margin:0;padding:20px;background:#0b0f19;color:#f1f5f9;font-family:system-ui,sans-serif;">
  <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:18px;">
    <div>
      <h2 style="margin:0 0 4px 0;">📂 ${escHtml(outPath)}</h2>
      <div style="font-family:monospace;font-size:12px;color:#94a3b8;">Containing folder (${entries.length} items)</div>
    </div>
    <div style="display:flex;gap:8px;">
      ${parentRel ? '<a href="/outputs/" style="padding:8px 12px;background:#1e293b;color:#fff;border-radius:6px;text-decoration:none;font-size:13px;">⬆️ Root outputs/</a>' : ''}
      <a href="/" style="padding:8px 12px;background:#7c3aed;color:#fff;border-radius:6px;text-decoration:none;font-size:13px;">⚡ Back to Studio</a>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px;">${cardsHtml || '<p>Folder is empty.</p>'}</div>
</body></html>`;
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(html);
      }
      if (fs.existsSync(outPath) && fs.statSync(outPath).isFile()) {
        const ext = path.extname(outPath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        const stat = fs.statSync(outPath);
        const total = stat.size;
        const streamFile = (readOpts) => {
          if (req.method === 'HEAD') return res.end();
          const stream = fs.createReadStream(outPath, readOpts);
          const cleanup = () => {
            if (!stream.destroyed) stream.destroy();
          };
          res.on('close', cleanup);
          stream.on('error', () => {
            if (!res.headersSent) res.writeHead(500);
            if (!res.writableEnded) res.end();
          });
          return stream.pipe(res);
        };
        const range = req.headers.range;
        if (range && total > 0) {
          const match = /^bytes=(\d*)-(\d*)$/i.exec(range.trim());
          if (match) {
            let start = match[1] ? parseInt(match[1], 10) : NaN;
            let end = match[2] ? parseInt(match[2], 10) : NaN;
            if (isNaN(start) && !isNaN(end)) {
              start = Math.max(0, total - end);
              end = total - 1;
            } else if (!isNaN(start) && isNaN(end)) {
              end = total - 1;
            } else if (!isNaN(start) && !isNaN(end)) {
              end = Math.min(end, total - 1);
            }
            if (!isNaN(start) && !isNaN(end) && start >= 0 && start <= end && end < total) {
              const chunkSize = (end - start) + 1;
              res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${total}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize,
                'Content-Type': contentType
              });
              return streamFile({ start, end });
            }
          }
          res.writeHead(416, { 'Content-Range': `bytes */${total}` });
          return res.end();
        }
        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': total,
          'Accept-Ranges': 'bytes'
        });
        return streamFile();
      }
    }

    if (pathname === '/favicon.ico' || pathname === '/assets/icon.png' || pathname === '/assets/icon.ico') {
      const assetName = pathname === '/assets/icon.png' ? 'icon.png' : 'icon.ico';
      const iconPath = path.resolve(APP_RESOURCES_DIR, 'assets', assetName);
      if (fs.existsSync(iconPath) && fs.statSync(iconPath).isFile()) {
        const ext = path.extname(iconPath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream', 'Cache-Control': 'public, max-age=86400' });
        return fs.createReadStream(iconPath).pipe(res);
      }
    }

    const publicRoot = process.env.WAVESPEED_PUBLIC_DIR
      ? path.resolve(process.env.WAVESPEED_PUBLIC_DIR)
      : path.resolve(APP_RESOURCES_DIR, 'public');
    let filePath = path.resolve(publicRoot, pathname === '/' ? 'index.html' : pathname.replace(/^\//, ''));
    if (!isPathInside(filePath, publicRoot)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('Not Found');
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      fs.createReadStream(filePath).pipe(res);
    });

  } catch (error) {
    const status = error.statusCode || 500;
    logServerEvent(status === 401 ? 'WARN' : 'ERROR', 'Server HTTP error', { path: pathname, status, error: error.message });
    sendJson(res, status, { error: error.message || 'Internal Server Error' });
  }
});

function startServer(options = {}) {
  const targetPort = options.port !== undefined ? Number(options.port) : PORT;
  const host = options.host || undefined;
  const fallbackEphemeral = Boolean(options.fallbackEphemeral);

  return new Promise((resolve, reject) => {
    let settled = false;
    const onListening = () => {
      if (settled) return;
      settled = true;
      server.removeListener('error', onError);
      const addr = server.address();
      const boundPort = addr && typeof addr === 'object' ? addr.port : targetPort;
      logServerEvent('INFO', `WaveSpeed Studio running at http://localhost:${boundPort}`, {
        project_root: PROJECT_ROOT,
        user_data_dir: USER_DATA_DIR,
        outputs_dir: OUTPUTS_DIR,
        logs_dir: LOGS_DIR,
        database_dir: DATABASE_DIR
      });
      if (historyDb) {
        setImmediate(() => {
          try {
            const syncStats = historyDb.syncFromExistingFiles();
            logServerEvent('INFO', 'History SQLite database ready', { db_path: HISTORY_DB_FILE, ...syncStats });
          } catch (e) {
            logServerEvent('WARN', 'History SQLite initial sync error', { error: e.message });
          }
        });
      }
      resolve({ server, port: boundPort });
    };

    const onError = (err) => {
      if (settled) return;
      if (err && err.code === 'EADDRINUSE' && fallbackEphemeral && targetPort !== 0) {
        server.listen(0, host, onListening);
        return;
      }
      settled = true;
      reject(err);
    };

    server.once('error', onError);
    server.listen(targetPort, host, onListening);
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (historyDb && typeof historyDb.close === 'function') {
      try {
        historyDb.close();
      } catch (e) {}
    }
    if (!server.listening) {
      return resolve();
    }
    server.close(() => resolve());
  });
}

if (require.main === module) {
  startServer().catch((err) => {
    logServerEvent('ERROR', 'Failed to start server', { error: err.message });
    process.exit(1);
  });
}

module.exports = {
  server,
  startServer,
  stopServer,
  saveOutputLocally,
  resolveLocalMediaUrl,
  resolvePayloadMedia,
  listSavedOutputs,
  getCleanModelTitle,
  USER_DATA_DIR,
  OUTPUTS_DIR,
  OUTPUTS_IMAGES_DIR,
  OUTPUTS_VIDEOS_DIR,
  OUTPUTS_META_DIR,
  getOutputsDir: () => OUTPUTS_DIR,
  applyOutputsDir,
  saveStudioConfig,
  GENERATIONS_LOG_FILE,
  savedTasksMap
};
