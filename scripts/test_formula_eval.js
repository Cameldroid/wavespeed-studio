const fs = require('fs');
const formulas = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

function evaluateWaveSpeedFormula(formulaStr, basePriceMicro, params = {}) {
  if (!formulaStr || !formulaStr.trim()) {
    return basePriceMicro / 1e6;
  }
  let expr = formulaStr.trim();
  const m = expr.match(/^\{\s*"total_price"\s*:\s*([\s\S]+)\}$/);
  if (m) expr = m[1].trim();

  // 1. Replace get_duration(...) before operator replacements
  expr = expr.replace(/get_duration\([^)]*\)/g, '(duration || 5)');
  // 2. Protect := as __ASSIGN__
  expr = expr.replace(/:=/g, '__ASSIGN__');
  // 3. Replace single = (not !=, >=, <=, ==) with ===
  expr = expr.replace(/(?<![!<>=])=(?!=)/g, '===');
  // 4. Restore __ASSIGN__ as =
  expr = expr.replace(/__ASSIGN__/g, '=');
  // 5. Replace ; with comma operator ,
  expr = expr.replace(/;/g, ',');
  // 6. Replace 'and' / 'or' with && / ||
  expr = expr.replace(/\band\b/g, '&&').replace(/\bor\b/g, '||');
  // 7. Replace JSONata $functions
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
    duration: params.duration ?? 5,
    resolution: params.resolution ?? '720p',
    size: params.size ?? '1024*1024',
    quality: params.quality ?? 'medium',
    output_format: params.output_format ?? 'png',
    num_images: params.num_images ?? 1,
    sound: params.sound ?? false,
    enable_web_search: params.enable_web_search ?? false,
    enable_image_search: params.enable_image_search ?? false,
    images: params.images ?? ['img1'],
    mask_image: params.mask_image ?? '',
    markup_image: params.markup_image ?? '',
    video: params.video ?? '',
    reference_videos: params.reference_videos ?? [],
    __count: (arr) => Array.isArray(arr) ? arr.length : (arr ? 1 : 0),
    __min: (arr) => Math.min(...(Array.isArray(arr) ? arr : [arr])),
    __max: (arr) => Math.max(...(Array.isArray(arr) ? arr : [arr])),
    __ceil: (x) => Math.ceil(Number(x) || 0),
    __number: (x) => Number(x) || 0,
    __string: (x) => String(x ?? ''),
    __lowercase: (s) => String(s ?? '').toLowerCase(),
    __exists: (x) => (x !== undefined && x !== null && x !== '')
  };

  // Pre-declare any $vars assigned in the expression
  const varMatches = [...expr.matchAll(/(\$[a-zA-Z0-9_]+)\s*=/g)].map(x => x[1]);
  const uniqueVars = [...new Set(varMatches)];
  const varDecl = uniqueVars.length > 0 ? `let ${uniqueVars.join(', ')}; ` : '';

  const keys = Object.keys(context);
  const vals = Object.values(context);
  const fn = new Function(...keys, `"use strict"; ${varDecl} return (${expr});`);
  const microResult = fn(...vals);
  return microResult / 1e6;
}

let passed = 0;
let failed = 0;
for (const [mid, info] of Object.entries(formulas)) {
  try {
    const p480_6s = evaluateWaveSpeedFormula(info.formula, info.base_price_micro, {
      resolution: mid.includes('h3/image-to-video') ? '768p' : (mid.includes('seedream') || mid.includes('h3-image') ? '1k' : '480p'),
      duration: 6,
      images: ['img1']
    });
    const disc = info.discount_rate || 100;
    const finalP = +(p480_6s * (disc / 100)).toFixed(4);
    console.log(`${mid.padEnd(46)} | base_calc: $${p480_6s.toFixed(4)} | disc(${100-disc}%): $${finalP}`);
    passed++;
  } catch (e) {
    console.error(`FAIL ${mid}:`, e.message, '\nFormula:', info.formula);
    failed++;
  }
}
console.log(`\nPassed: ${passed}, Failed: ${failed}`);
