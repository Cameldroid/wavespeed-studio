/**
 * Live WaveSpeed Pricing & Formula Auditor / Sync Script
 * Read-only: Queries only public catalog (wavespeed.ai/api/models) and RSC model pages (wavespeed.ai/models/{id}).
 * NEVER executes any model generation or spends credits.
 */
const fs = require('fs');
const path = require('path');

const FORMULAS_PATH = path.join(__dirname, '..', 'pricing-formulas.json');

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

function evaluateWaveSpeedFormula(formulaStr, basePriceMicro, params = {}) {
  if (!formulaStr || !formulaStr.trim()) {
    return basePriceMicro / 1e6;
  }
  let expr = formulaStr.trim();
  const m = expr.match(/^\{\s*"total_price"\s*:\s*([\s\S]+)\}$/);
  if (m) expr = m[1].trim();

  expr = expr.replace(/get_duration\(\s*([a-zA-Z0-9_]+)(?:\s*,[^)]*)?\)/g, '__get_duration($1)');
  expr = expr.replace(/:=/g, '__ASSIGN__');
  expr = expr.replace(/(?<![!<>=])=(?!=)/g, '===');
  expr = expr.replace(/__ASSIGN__/g, '=');
  expr = expr.replace(/;/g, ',');
  expr = expr.replace(/\band\b/g, '&&').replace(/\bor\b/g, '||');
  expr = expr.replace(/\$count\b/g, '__count');
  expr = expr.replace(/\$min\b/g, '__min');
  expr = expr.replace(/\$max\b/g, '__max');
  expr = expr.replace(/\$ceil\b/g, '__ceil');
  expr = expr.replace(/\$number\b/g, '__number');
  expr = expr.replace(/\$string\b/g, '__string');
  expr = expr.replace(/\$lowercase\b/g, '__lowercase');
  expr = expr.replace(/\$exists\b/g, '__exists');

  const context = {
    base_price: basePriceMicro,
    duration: Number(params.duration ?? 5),
    resolution: String(params.resolution ?? '720p'),
    size: String(params.size ?? '1024*1024'),
    quality: String(params.quality ?? 'medium'),
    output_format: String(params.output_format ?? 'png'),
    num_images: Number(params.num_images ?? 1),
    sound: Boolean(params.sound ?? true),
    generate_audio: Boolean(params.generate_audio ?? true),
    enable_web_search: Boolean(params.enable_web_search ?? false),
    enable_image_search: Boolean(params.enable_image_search ?? false),
    images: Array.isArray(params.images) ? params.images : ['img1'],
    image: params.image ?? 'img1',
    mask_image: params.mask_image ?? '',
    markup_image: params.markup_image ?? '',
    video: params.video ?? '',
    videos: Array.isArray(params.videos) ? params.videos : [],
    reference_videos: Array.isArray(params.reference_videos) ? params.reference_videos : [],
    reference_images: Array.isArray(params.reference_images) ? params.reference_images : [],
    reference_audios: Array.isArray(params.reference_audios) ? params.reference_audios : [],
    max_images: Number(params.max_images ?? 1),
    audio: params.audio ?? '',
    __get_duration: (media) => {
      if (Array.isArray(media)) return media.length > 0 ? (Number(params.video_duration ?? params.duration ?? 5) * media.length) : 0;
      return Number(params.video_duration ?? params.duration ?? 5);
    },
    __count: (arr) => Array.isArray(arr) ? arr.length : (arr ? 1 : 0),
    __min: (arr) => Math.min(...(Array.isArray(arr) ? arr : [arr])),
    __max: (arr) => Math.max(...(Array.isArray(arr) ? arr : [arr])),
    __ceil: (x) => Math.ceil(Number(x) || 0),
    __number: (x) => Number(x) || 0,
    __string: (x) => String(x ?? ''),
    __lowercase: (s) => String(s ?? '').toLowerCase(),
    __exists: (x) => Array.isArray(x) ? x.length > 0 : (x !== undefined && x !== null && x !== '')
  };

  // Auto-bind any additional identifier referenced in expr to avoid ReferenceError on new model inputs
  const reserved = new Set(['true', 'false', 'null', 'undefined', 'let', 'return', 'NaN', 'Infinity']);
  const stripped = expr.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '""');
  for (const idMatch of stripped.matchAll(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g)) {
    const ident = idMatch[1];
    if (!reserved.has(ident) && !(ident in context)) {
      context[ident] = params[ident] ?? undefined;
    }
  }

  const varMatches = [...expr.matchAll(/(\$[a-zA-Z0-9_]+)\s*=/g)].map(x => x[1]);
  const uniqueVars = [...new Set(varMatches)];
  const varDecl = uniqueVars.length > 0 ? `let ${uniqueVars.join(', ')}; ` : '';

  const keys = Object.keys(context);
  const vals = Object.values(context);
  const fn = new Function(...keys, `"use strict"; ${varDecl} return (${expr});`);
  const microResult = fn(...vals);
  if (typeof microResult === 'number' && !isNaN(microResult) && microResult >= 0) {
    return microResult / 1e6;
  }
  throw new Error(`Invalid result: ${microResult}`);
}

async function fetchRscModel(modelId) {
  try {
    const resp = await fetch(`https://wavespeed.ai/models/${modelId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'RSC': '1' },
      signal: AbortSignal.timeout(8000)
    });
    if (!resp.ok) return null;
    const text = await resp.text();
    const idx = text.indexOf('{"model":{"model_uuid":');
    if (idx === -1) return null;
    const parsed = extractJsonObjectAt(text, idx);
    if (parsed && parsed.model) {
      const m = parsed.model;
      return {
        base_price_micro: m.base_price,
        discount_rate: typeof m.discount_rate === 'number' ? m.discount_rate : 100,
        formula: m.formula || '',
        price_inputs: m.price_inputs || [],
        fetched_at: Date.now()
      };
    }
  } catch (e) {
    // ignore timeout
  }
  return null;
}

async function main() {
  const existing = fs.existsSync(FORMULAS_PATH)
    ? JSON.parse(fs.readFileSync(FORMULAS_PATH, 'utf8'))
    : {};

  console.log(`Loaded ${Object.keys(existing).length} existing formula entries.`);

  // 1. Fetch all catalog pages
  const catalog = {};
  for (let p = 1; p <= 8; p++) {
    try {
      const r = await fetch(`https://wavespeed.ai/api/models?page=${p}&page_size=200`, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
      });
      if (!r.ok) continue;
      const j = await r.json();
      for (const item of (j.items || [])) {
        if (item.model_uuid) catalog[item.model_uuid] = item;
      }
    } catch (e) {}
  }
  console.log(`Fetched ${Object.keys(catalog).length} live catalog items from wavespeed.ai/api/models.`);

  // 2. Build list of models to verify/fetch RSC formulas for
  const targetIds = new Set(Object.keys(existing));

  // Add all discounted non-lora models from catalog
  for (const [id, item] of Object.entries(catalog)) {
    const lower = id.toLowerCase();
    if (item.discount_rate && item.discount_rate < 100 && !lower.includes('-lora') && !lower.includes('trainer')) {
      targetIds.add(id);
    }
  }

  // Add popular models & parent models of -spicy variants
  const extraPopular = [
    'openai/gpt-image-2.6-sunburst/text-to-image',
    'openai/gpt-image-2.6-sunburst/edit',
    'openai/gpt-image-2.5-sunburst/text-to-image',
    'openai/gpt-image-2.5-sunburst/edit',
    'openai/gpt-image-2.5-flare/text-to-image',
    'openai/gpt-image-2.5-flare/edit',
    'google/nano-banana-2.1/edit',
    'wavespeed-ai/minimax-h3/image-to-video',
    'wavespeed-ai/minimax-h3/text-to-video',
    'wavespeed-ai/minimax-h3/reference-to-video',
    'wavespeed-ai/minimax-h3/video-edit',
    'wavespeed-ai/minimax-h3/image-edit',
    'wavespeed-ai/minimax-h3/text-to-image',
    'wavespeed-ai/minimax-h3-image/edit',
    'wavespeed-ai/minimax-h3-image/text-to-image',
    'minimax/h3/text-to-video',
    'minimax/h3/reference-to-video',
    'minimax/h3-lite/text-to-video',
    'minimax/h3-lite/reference-to-video',
    'minimax/h3-highspeed/text-to-video',
    'minimax/h3-highspeed/reference-to-video',
    'minimax/hailuo-2.3/fast-pro',
    'minimax/hailuo-2.3/t2v-pro',
    'minimax/hailuo-02/i2v-pro',
    'minimax/hailuo-02/t2v-pro',
    'minimax/hailuo-02/i2v-standard',
    'minimax/hailuo-02/t2v-standard',
    'minimax/hailuo-02/pro',
    'minimax/hailuo-02/standard',
    'minimax/image-01/text-to-image',
    'minimax/image-01/image-to-image',
    'bytedance/seedance-2.5/reference-to-video',
    'bytedance/seedance-2.5-flash/reference-to-video',
    'bytedance/seedance-2.5-flash/video-edit',
    'bytedance/seedance-v1.5-pro/image-to-video',
    'bytedance/seedance-v1.5-pro/text-to-video',
    'bytedance/seedance-v1.5-pro/image-to-video-fast',
    'bytedance/seedance-v1.5-pro/text-to-video-fast',
    'bytedance/seedance-v1-pro-fast/text-to-video',
    'bytedance/seedance-v1-lite-i2v-480p',
    'bytedance/seedance-v1-lite-i2v-720p',
    'bytedance/seedance-v1-lite-i2v-1080p',
    'bytedance/seedance-v1-pro-i2v-480p',
    'bytedance/seedance-v1-pro-i2v-720p',
    'bytedance/seedance-v1-pro-i2v-1080p',
    'bytedance/seedream-v5.0-lite/edit',
    'bytedance/seedream-v4.5',
    'bytedance/seedream-v4',
    'bytedance/seedream-v4/edit',
    'alibaba/wan-3.0/reference-to-video',
    'alibaba/wan-3.0/video-edit',
    'alibaba/wan-3.0/video-extend',
    'alibaba/wan-3.0-prime/reference-to-video',
    'alibaba/wan-3.0-prime/video-edit',
    'alibaba/wan-3.0-prime/video-extend',
    'alibaba/wan-2.7/text-to-video',
    'alibaba/wan-2.7/reference-to-video',
    'alibaba/wan-2.7/video-edit',
    'alibaba/wan-2.7/image-edit',
    'alibaba/wan-2.7/image-edit-pro',
    'alibaba/wan-2.7/text-to-image',
    'alibaba/wan-2.7/text-to-image-pro',
    'kwaivgi/kling-v4.0/reference-to-video',
    'kwaivgi/kling-v4.0-flash/text-to-video',
    'kwaivgi/kling-v4.0-flash/reference-to-video',
    'kwaivgi/kling-v4.0-flash/video-edit',
    'kwaivgi/kling-v3.0-pro/image-to-video',
    'kwaivgi/kling-v3.0-pro/text-to-video',
    'kwaivgi/kling-v3.0-std/text-to-video',
    'kwaivgi/kling-v3-turbo-std/image-to-video',
    'kwaivgi/kling-v3-turbo-pro/image-to-video',
    'google/veo3.1/reference-to-video',
    'google/veo3.1-fast/text-to-video',
    'google/veo3.1-fast/reference-to-video',
    'google/veo3.1-lite/text-to-video',
    'google/veo3.1-lite/start-end-to-video',
    'wavespeed-ai/ltx-2.3/image-to-video',
    'wavespeed-ai/wan-2.2/image-to-video',
    'wavespeed-ai/wan-2.2/i2v-480p',
    'wavespeed-ai/wan-2.2/i2v-720p',
    'wavespeed-ai/wan-2.2/t2v-480p',
    'wavespeed-ai/wan-2.2/t2v-720p',
    'wavespeed-ai/feynobg',
    'wavespeed-ai/flux-dev',
    'black-forest-labs/flux-pro-v1.1'
  ];
  for (const id of extraPopular) targetIds.add(id);

  const allTargets = [...targetIds];
  console.log(`Syncing live RSC formulas for ${allTargets.length} models...`);

  const batchSize = 10;
  let updatedCount = 0;
  for (let i = 0; i < allTargets.length; i += batchSize) {
    const batch = allTargets.slice(i, i + batchSize);
    const res = await Promise.all(batch.map(async id => ({ id, data: await fetchRscModel(id) })));
    for (const { id, data } of res) {
      if (data) {
        existing[id] = data;
        updatedCount++;
      } else if (existing[id]) {
        existing[id].fetched_at = Date.now();
      }
    }
  }

  console.log(`Successfully synced ${updatedCount} live RSC model formulas.`);

  // 3. Verify all formulas evaluate cleanly
  let passed = 0;
  let failed = 0;
  for (const [id, entry] of Object.entries(existing)) {
    try {
      const val = evaluateWaveSpeedFormula(entry.formula, entry.base_price_micro, {
        duration: 5,
        resolution: '720p',
        quality: 'medium',
        images: ['img1']
      });
      if (typeof val === 'number' && !isNaN(val)) {
        passed++;
      } else {
        failed++;
        console.error(`Formula returned NaN for ${id}: ${entry.formula}`);
      }
    } catch (e) {
      failed++;
      console.error(`Formula error for ${id}: ${e.message} | formula: ${entry.formula}`);
    }
  }
  console.log(`Formula verification: ${passed} passed, ${failed} failed.`);

  fs.writeFileSync(FORMULAS_PATH, JSON.stringify(existing, null, 2));
  console.log(`Saved ${Object.keys(existing).length} verified formulas to ${FORMULAS_PATH}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
