/**
 * Isolated Studio Verification Suite (ZERO WaveSpeed credits spent)
 * - Tests all 197 pricing formulas + client evaluation logic across edge cases
 * - Tests saveOutputLocally(), listSavedOutputs(), /outputs/* HTTP static serving,
 *   path traversal protection, and resolvePayloadMedia() using a local mock HTTP server
 *   and cleans up all temporary test files afterward.
 */
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const appJsSource = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');
const formulasJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'pricing-formulas.json'), 'utf8'));

// Extract pure pricing functions from public/app.js so we test the actual client implementation
function extractClientPricingFns() {
  const startMarker = '  // Evaluate exact WaveSpeed JSONata pricing formula';
  const endMarker = '  // Calculate catalog item pricing';
  const sIdx = appJsSource.indexOf(startMarker);
  const eIdx = appJsSource.indexOf(endMarker);
  assert(sIdx !== -1 && eIdx !== -1, 'Could not locate pricing functions in public/app.js');

  const snippet = appJsSource.slice(sIdx, eIdx);
  const sandbox = {
    state: { accountDiscount: 0 },
    console
  };
  vm.createContext(sandbox);
  vm.runInContext(
    snippet + '\nthis.__exports = { evaluateWaveSpeedFormula, getFallbackResolutionMultiplier, isModelPerSecond, calculateModelCost };',
    sandbox
  );
  return sandbox.__exports;
}

async function runFormulaTests() {
  const {
    evaluateWaveSpeedFormula,
    calculateModelCost,
    isModelPerSecond
  } = extractClientPricingFns();

  // 1. Evaluate all 197 formulas in pricing-formulas.json across multiple parameter combos
  let count197 = 0;
  for (const [modelId, info] of Object.entries(formulasJson)) {
    for (const res of ['480p', '720p', '768p', '1080p', '1k', '2k', '4k']) {
      const val = evaluateWaveSpeedFormula(info.formula, info.base_price_micro, {
        resolution: res,
        duration: 5,
        quality: 'medium',
        num_images: 1,
        images: ['img1'],
        reference_images: ['img1'],
        reference_videos: []
      });
      if (info.formula && info.formula.trim()) {
        assert(typeof val === 'number' && !Number.isNaN(val) && val >= 0, `Formula failed for ${modelId} @ ${res}: got ${val}`);
      } else {
        assert(val === null, `Expected null for empty formula on ${modelId}`);
      }
    }
    count197++;
  }
  assert.strictEqual(count197, Object.keys(formulasJson).length);
  console.log(`[PASS] 197-formula matrix test: ${count197} models x 7 resolutions passed`);

  // 2. Edge case assertions against real WaveSpeed RSC formulas
  // a) Seedance 2.5 (480p/720p/1080p/4k, 5s, 10% OFF)
  const s25 = formulasJson['bytedance/seedance-2.5/image-to-video'];
  const s25Model = {
    model_id: 'bytedance/seedance-2.5/image-to-video',
    base_price: s25.base_price_micro / 1e6,
    base_price_micro: s25.base_price_micro,
    discount_rate: s25.discount_rate,
    discount_percent: (100 - s25.discount_rate) / 100,
    formula: s25.formula,
    has_formula: true,
    isImageToVideo: true,
    schema: { properties: { duration: { default: 5 }, resolution: { default: '720p', enum: ['480p', '720p', '1080p', '4k'] } } }
  };
  assert.strictEqual(calculateModelCost(s25Model, { resolution: '480p', duration: 5 }).finalPrice, 0.81);
  assert.strictEqual(calculateModelCost(s25Model, { resolution: '720p', duration: 5 }).finalPrice, 1.62);
  assert.strictEqual(calculateModelCost(s25Model, { resolution: '1080p', duration: 5 }).finalPrice, 4.05);
  assert.strictEqual(calculateModelCost(s25Model, { resolution: '4k', duration: 5 }).finalPrice, 8.1);

  // b) -spicy inheritance check: minimax-h3/image-to-video-spicy (50% OFF)
  const mh3 = formulasJson['wavespeed-ai/minimax-h3/image-to-video'];
  const mh3Spicy = {
    model_id: 'wavespeed-ai/minimax-h3/image-to-video-spicy',
    base_price: mh3.base_price_micro / 1e6,
    base_price_micro: mh3.base_price_micro,
    discount_rate: 50,
    discount_percent: 0.50,
    formula: mh3.formula,
    has_formula: true,
    isImageToVideo: true,
    schema: { properties: { duration: { default: 5 }, resolution: { default: '768p', enum: ['480p', '768p', '1080p'] } } }
  };
  assert.strictEqual(calculateModelCost(mh3Spicy, { resolution: '480p', duration: 5 }).finalPrice, 0.1);
  assert.strictEqual(calculateModelCost(mh3Spicy, { resolution: '768p', duration: 5 }).finalPrice, 0.2);
  assert.strictEqual(calculateModelCost(mh3Spicy, { resolution: '1080p', duration: 5 }).finalPrice, 0.4);

  // c) minimax/h3-lite/image-to-video (480p vs 720p)
  const h3Lite = formulasJson['minimax/h3-lite/image-to-video'];
  const h3LiteModel = {
    model_id: 'minimax/h3-lite/image-to-video',
    base_price: h3Lite.base_price_micro / 1e6,
    base_price_micro: h3Lite.base_price_micro,
    discount_rate: h3Lite.discount_rate,
    discount_percent: (100 - h3Lite.discount_rate) / 100,
    formula: h3Lite.formula,
    has_formula: true,
    isImageToVideo: true,
    schema: { properties: { duration: { default: 5 }, resolution: { default: '480p', enum: ['480p', '720p'] } } }
  };
  assert.strictEqual(calculateModelCost(h3LiteModel, { resolution: '480p', duration: 5 }).finalPrice, 0.125);
  assert.strictEqual(calculateModelCost(h3LiteModel, { resolution: '720p', duration: 5 }).finalPrice, 0.2);

  // d) hailuo-2.3 flat vs tiered
  const hailuoFast = formulasJson['minimax/hailuo-2.3/fast'];
  const hailuoFastModel = {
    model_id: 'minimax/hailuo-2.3/fast',
    base_price: hailuoFast.base_price_micro / 1e6,
    base_price_micro: hailuoFast.base_price_micro,
    discount_rate: 100,
    discount_percent: 0,
    formula: hailuoFast.formula,
    has_formula: true,
    isImageToVideo: true,
    schema: { properties: { duration: { default: 6, enum: [6, 10] } } }
  };
  assert.strictEqual(isModelPerSecond(hailuoFastModel), false);
  assert.strictEqual(calculateModelCost(hailuoFastModel, { duration: 6 }).finalPrice, 0.19);
  assert.strictEqual(calculateModelCost(hailuoFastModel, { duration: 10 }).finalPrice, 0.32);

  const hailuoPro = formulasJson['minimax/hailuo-2.3/i2v-pro'];
  const hailuoProModel = {
    model_id: 'minimax/hailuo-2.3/i2v-pro',
    base_price: hailuoPro.base_price_micro / 1e6,
    base_price_micro: hailuoPro.base_price_micro,
    discount_rate: 100,
    discount_percent: 0,
    formula: hailuoPro.formula,
    has_formula: true,
    isImageToVideo: true,
    schema: { properties: { prompt: {} } }
  };
  assert.strictEqual(isModelPerSecond(hailuoProModel), false);
  assert.strictEqual(calculateModelCost(hailuoProModel, {}).finalPrice, 0.49);

  // e) gpt-image-2.6-flare/edit with & without mask (10% OFF)
  const flareEdit = formulasJson['openai/gpt-image-2.6-flare/edit'];
  const flareEditModel = {
    model_id: 'openai/gpt-image-2.6-flare/edit',
    base_price: flareEdit.base_price_micro / 1e6,
    base_price_micro: flareEdit.base_price_micro,
    discount_rate: 90,
    discount_percent: 0.10,
    formula: flareEdit.formula,
    has_formula: true,
    isImageEdit: true,
    schema: { properties: { quality: { default: 'medium' }, resolution: { default: '1k' }, mask_image: {} } }
  };
  assert.strictEqual(calculateModelCost(flareEditModel, { quality: 'medium', resolution: '1k', images: ['img1'], mask_image: '' }).finalPrice, 0.0585);
  assert.strictEqual(calculateModelCost(flareEditModel, { quality: 'medium', resolution: '1k', images: ['img1'], mask_image: 'mask.png' }).finalPrice, 0.072);

  // f) reference-to-video with empty reference_videos vs populated
  const r2v = formulasJson['wavespeed-ai/minimax-h3/reference-to-video'];
  const r2vModel = {
    model_id: 'wavespeed-ai/minimax-h3/reference-to-video',
    base_price: r2v.base_price_micro / 1e6,
    base_price_micro: r2v.base_price_micro,
    discount_rate: 50,
    discount_percent: 0.50,
    formula: r2v.formula,
    has_formula: true,
    isImageToVideo: true,
    schema: { properties: { duration: { default: 5 }, resolution: { default: '768p' }, reference_images: {} } }
  };
  // 300000/3 * (5 + 0) * 1 + 20000*1 = 520000 -> $0.52 * 0.50 = $0.26
  assert.strictEqual(calculateModelCost(r2vModel, { duration: 5, resolution: '768p', reference_images: ['img1'], reference_videos: [] }).finalPrice, 0.26);

  // g) minimax-h3-image ($0.02 T2I / $0.03 Edit)
  const h3ImgT2I = formulasJson['wavespeed-ai/minimax-h3-image/text-to-image'];
  const h3ImgEdit = formulasJson['wavespeed-ai/minimax-h3-image/edit'];
  assert.strictEqual(evaluateWaveSpeedFormula(h3ImgT2I.formula, h3ImgT2I.base_price_micro, { resolution: '1k' }), 0.02);
  assert.strictEqual(evaluateWaveSpeedFormula(h3ImgEdit.formula, h3ImgEdit.base_price_micro, { resolution: '1k', images: ['img1'] }), 0.03);

  // h) kling-v3.0 default sound=false vs sound=true
  const kling3 = formulasJson['kwaivgi/kling-v3.0-std/image-to-video'];
  const kling3NoSound = evaluateWaveSpeedFormula(kling3.formula, kling3.base_price_micro, { duration: 5 });
  const kling3WithSound = evaluateWaveSpeedFormula(kling3.formula, kling3.base_price_micro, { duration: 5, sound: true });
  assert.strictEqual(kling3WithSound, Number((kling3NoSound * 1.5).toFixed(6)));

  // i) wan-2.2-spicy/video-extend fallback (480p native: 480p=1x, 720p=2x)
  const wanExtendModel = {
    model_id: 'wavespeed-ai/wan-2.2-spicy/video-extend',
    base_price: 0.03,
    base_price_micro: 30000,
    discount_rate: 100,
    discount_percent: 0,
    formula: null,
    has_formula: false,
    isTextToVideoOrEdit: true,
    schema: { properties: { duration: { default: 5, enum: [5, 8] }, resolution: { default: '480p', enum: ['480p', '720p'] } } }
  };
  assert.strictEqual(calculateModelCost(wanExtendModel, { duration: 5, resolution: '480p' }).finalPrice, 0.15);
  assert.strictEqual(calculateModelCost(wanExtendModel, { duration: 5, resolution: '720p' }).finalPrice, 0.3);

  // j) seedream-v5.5/layer-decomposition default max_images=30 -> $0.57 (triggers $0.50 Spend Guard!)
  const layerDecomp = formulasJson['bytedance/seedream-v5.5/layer-decomposition'];
  const layerModel = {
    model_id: 'bytedance/seedream-v5.5/layer-decomposition',
    base_price: layerDecomp.base_price_micro / 1e6,
    base_price_micro: layerDecomp.base_price_micro,
    discount_rate: layerDecomp.discount_rate,
    discount_percent: (100 - layerDecomp.discount_rate) / 100,
    formula: layerDecomp.formula,
    has_formula: true,
    isImageEdit: true,
    schema: { properties: { max_images: { default: 30 }, resolution: { default: '1k' } } }
  };
  assert.strictEqual(calculateModelCost(layerModel, { resolution: '1k', max_images: 30 }).finalPrice, 0.57);
  assert.strictEqual(calculateModelCost(layerModel, { resolution: '1k' }).finalPrice, 0.57);

  // k) ltx-2.3-spicy/image-to-video calibrated 480p-anchored formula (480p=$0.10, 720p=$0.15, 1080p=$0.20)
  const ltxSpicy = formulasJson['wavespeed-ai/ltx-2.3-spicy/image-to-video'];
  const ltxSpicyModel = {
    model_id: 'wavespeed-ai/ltx-2.3-spicy/image-to-video',
    base_price: ltxSpicy.base_price_micro / 1e6,
    base_price_micro: ltxSpicy.base_price_micro,
    discount_rate: 100,
    discount_percent: 0,
    formula: ltxSpicy.formula,
    has_formula: true,
    isImageToVideo: true,
    schema: { properties: { duration: { default: 5 }, resolution: { default: '480p', enum: ['480p', '720p', '1080p'] } } }
  };
  assert.strictEqual(calculateModelCost(ltxSpicyModel, { resolution: '480p', duration: 5 }).finalPrice, 0.1);
  assert.strictEqual(calculateModelCost(ltxSpicyModel, { resolution: '720p', duration: 5 }).finalPrice, 0.15);
  assert.strictEqual(calculateModelCost(ltxSpicyModel, { resolution: '1080p', duration: 5 }).finalPrice, 0.2);

  // l) fallback num_images scaling when formula is null
  const multiFallback = {
    model_id: 'mock/multi-image-no-formula',
    base_price: 0.07,
    base_price_micro: 70000,
    discount_rate: 100,
    discount_percent: 0,
    formula: null,
    has_formula: false,
    isImageGen: true,
    schema: { properties: { num_images: { default: 2, enum: [1, 2, 4] } } }
  };
  assert.strictEqual(calculateModelCost(multiFallback, { num_images: 2 }).finalPrice, 0.14);
  assert.strictEqual(calculateModelCost(multiFallback, { num_images: 4 }).finalPrice, 0.28);

  // m) wan-3.0/video-edit (schema omits duration -> duration=0 uses source clip duration up to 15s; 480p = $0.05/s * 2)
  const wanVidEdit = formulasJson['alibaba/wan-3.0/video-edit'];
  const wanVidEditModel = {
    model_id: 'alibaba/wan-3.0/video-edit',
    base_price: wanVidEdit.base_price_micro / 1e6,
    base_price_micro: wanVidEdit.base_price_micro,
    discount_rate: 100,
    discount_percent: 0,
    formula: wanVidEdit.formula,
    has_formula: true,
    isTextToVideoOrEdit: true,
    schema: { properties: { prompt: {}, video: {}, reference_images: {}, resolution: { default: '720p', enum: ['480p', '720p', '1080p'] } } }
  };
  assert.strictEqual(calculateModelCost(wanVidEditModel, { resolution: '480p', duration: 0, video_duration: 5 }).finalPrice, 0.5);
  assert.strictEqual(calculateModelCost(wanVidEditModel, { resolution: '480p', duration: 0, video_duration: 15 }).finalPrice, 1.5);
  assert.strictEqual(calculateModelCost(wanVidEditModel, { resolution: '480p', duration: 0, video_duration: 25 }).finalPrice, 1.5); // capped at 15s
  assert.strictEqual(calculateModelCost(wanVidEditModel, { resolution: '720p', duration: 0, video_duration: 5 }).finalPrice, 1);

  // n) R2V & character/object swap asset counting (images + reference_images + reference_videos durations + reference_audios + discounts)
  const h3R2v = formulasJson['wavespeed-ai/minimax-h3/reference-to-video'];
  const h3R2vModel = {
    model_id: 'wavespeed-ai/minimax-h3/reference-to-video',
    base_price: h3R2v.base_price_micro / 1e6,
    base_price_micro: h3R2v.base_price_micro,
    discount_rate: 50,
    discount_percent: 0.5,
    formula: h3R2v.formula,
    has_formula: true
  };
  // base=0.30/clip -> (0.10)*(5+8)*0.5 = 0.65 base + 0.04 (2 ref imgs) + 0.02 (1 audio) = 0.71 -> 50% OFF = 0.355
  const r2vCost = calculateModelCost(h3R2vModel, {
    duration: 5,
    resolution: '480p',
    reference_images: ['img1', 'img2'],
    reference_videos: ['vid1'],
    reference_video_durations: [8],
    reference_audios: ['aud1']
  });
  assert.strictEqual(r2vCost.basePrice, 0.71);
  assert.strictEqual(r2vCost.finalPrice, 0.355);

  const charSwap = formulasJson['wavespeed-ai/openjutsu/character-swap'];
  const charSwapModel = {
    model_id: 'wavespeed-ai/openjutsu/character-swap',
    base_price: charSwap.base_price_micro / 1e6,
    base_price_micro: charSwap.base_price_micro,
    discount_rate: 50,
    discount_percent: 0.5,
    formula: charSwap.formula,
    has_formula: true
  };
  // 5s 480p base: 0.10 * 5 * 2 * 0.75 = 0.75; 0 imgs -> 0.75*0.5 = 0.375; 2 imgs -> (0.75+0.04)*0.5 = 0.395
  assert.strictEqual(calculateModelCost(charSwapModel, { resolution: '480p', video_duration: 5, images: [] }).finalPrice, 0.375);
  assert.strictEqual(calculateModelCost(charSwapModel, { resolution: '480p', video_duration: 5, images: ['img1', 'img2'] }).finalPrice, 0.395);

  const objSwap = formulasJson['wavespeed-ai/openjutsu/object-swap'];
  const objSwapModel = {
    model_id: 'wavespeed-ai/openjutsu/object-swap',
    base_price: objSwap.base_price_micro / 1e6,
    base_price_micro: objSwap.base_price_micro,
    discount_rate: 50,
    discount_percent: 0.5,
    formula: objSwap.formula,
    has_formula: true
  };
  assert.strictEqual(calculateModelCost(objSwapModel, { resolution: '480p', video_duration: 5, image: '' }).finalPrice, 0.375);
  assert.strictEqual(calculateModelCost(objSwapModel, { resolution: '480p', video_duration: 5, image: 'img1' }).finalPrice, 0.385);

  console.log('[PASS] Edge-case formula & pricing logic assertions passed');
}

async function runMockOutputAndServerTests() {
  if (!process.env.WAVESPEED_API_KEY) {
    process.env.WAVESPEED_API_KEY = 'wsk_mock_test_isolated_key';
  }
  const srvMod = require(path.join(ROOT, 'server.js'));

  const tinyPng = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
    'hex'
  );
  const tinyMp4 = Buffer.from('00000018667479706d703432000000006d70343269736f6d', 'hex');

  const hadGenLogBefore = fs.existsSync(srvMod.GENERATIONS_LOG_FILE);
  const prevGenLogContent = hadGenLogBefore ? fs.readFileSync(srvMod.GENERATIONS_LOG_FILE, 'utf8') : null;

  const createdFiles = [];
  const mockTaskImg = `mock-img-${Date.now()}`;
  const mockTaskVid = `mock-vid-${Date.now()}`;

  // Local mock CDN & upload server (100% local, zero WaveSpeed API calls)
  const uploadedPayloads = [];
  const mockRemoteServer = http.createServer((req, res) => {
    if (req.url === '/mock-output.png' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      return res.end(tinyPng);
    }
    if (req.url === '/mock-output.mp4' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'video/mp4' });
      return res.end(tinyMp4);
    }
    if (req.url === '/mock-put-upload' && req.method === 'PUT') {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        uploadedPayloads.push(Buffer.concat(chunks));
        res.writeHead(200);
        res.end('OK');
      });
      return;
    }
    res.writeHead(404);
    res.end('Not Found');
  });

  await new Promise(resolve => mockRemoteServer.listen(0, '127.0.0.1', resolve));
  const mockPort = mockRemoteServer.address().port;

  // Also bind the app server on an ephemeral port to test /outputs/* HTTP route & traversal guard
  await new Promise(resolve => srvMod.server.listen(0, '127.0.0.1', resolve));
  const appPort = srvMod.server.address().port;

  const realFetch = global.fetch;
  try {
    // 1. Test saveOutputLocally for image & video from local mock HTTP server
    const savedImg = await srvMod.saveOutputLocally(
      mockTaskImg,
      [`http://127.0.0.1:${mockPort}/mock-output.png`],
      { model_id: 'mock/test-image', payload: { prompt: 'mock test' }, estimated_price: 0.02 }
    );
    assert.strictEqual(savedImg.length, 1);
    assert.strictEqual(savedImg[0].is_video, false);
    assert(savedImg[0].local_url.startsWith('/outputs/images/'));
    assert(fs.existsSync(savedImg[0].local_path));
    createdFiles.push(savedImg[0].local_path);

    const savedVid = await srvMod.saveOutputLocally(
      mockTaskVid,
      [`http://127.0.0.1:${mockPort}/mock-output.mp4`],
      { model_id: 'mock/test-video-spicy', payload: { prompt: 'mock video' }, estimated_price: 0.1 }
    );
    assert.strictEqual(savedVid.length, 1);
    assert.strictEqual(savedVid[0].is_video, true);
    assert(savedVid[0].local_url.startsWith('/outputs/videos/'));
    assert(fs.existsSync(savedVid[0].local_path));
    createdFiles.push(savedVid[0].local_path);

    // Track metadata json files for cleanup
    for (const f of fs.readdirSync(srvMod.OUTPUTS_META_DIR)) {
      if (f.includes(mockTaskImg.slice(0, 8)) || f.includes(mockTaskVid.slice(0, 8))) {
        createdFiles.push(path.join(srvMod.OUTPUTS_META_DIR, f));
      }
    }

    // 2. Test listSavedOutputs() includes both mock records
    const listed = srvMod.listSavedOutputs();
    assert(listed.some(x => x.task_id === mockTaskImg), 'listSavedOutputs missing mock image');
    assert(listed.some(x => x.task_id === mockTaskVid), 'listSavedOutputs missing mock video');

    // 3. Test HTTP /outputs/... serving & path traversal block
    const imgResp = await realFetch(`http://127.0.0.1:${appPort}${savedImg[0].local_url}`);
    assert.strictEqual(imgResp.status, 200);
    assert.strictEqual(imgResp.headers.get('content-type'), 'image/png');
    const fetchedPng = Buffer.from(await imgResp.arrayBuffer());
    assert(fetchedPng.equals(tinyPng), 'Downloaded PNG bytes via /outputs/ did not match original');

    const vidResp = await realFetch(`http://127.0.0.1:${appPort}${savedVid[0].local_url}`);
    assert.strictEqual(vidResp.status, 200);
    assert.strictEqual(vidResp.headers.get('content-type'), 'video/mp4');
    const fetchedMp4 = Buffer.from(await vidResp.arrayBuffer());
    assert(fetchedMp4.equals(tinyMp4), 'Downloaded MP4 bytes via /outputs/ did not match original');

    // Path traversal checks (normalized -> 404 from public/, encoded %2f -> 403 from /outputs/ guard)
    const traversalNormStatus = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${appPort}/outputs/../server.js`, r => resolve(r.statusCode)).on('error', reject);
    });
    assert.strictEqual(traversalNormStatus, 404, 'Expected 404 on normalized /outputs/../server.js');
    const traversalEncStatus = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${appPort}/outputs/..%2fserver.js`, r => resolve(r.statusCode)).on('error', reject);
    });
    assert.strictEqual(traversalEncStatus, 403, 'Expected 403 on encoded traversal /outputs/..%2fserver.js');

    // 3b. Test GET /api/local-file serving, extension check & missing path guard
    const localFileResp = await realFetch(`http://127.0.0.1:${appPort}/api/local-file?path=${encodeURIComponent(savedImg[0].local_path)}`);
    assert.strictEqual(localFileResp.status, 200);
    assert.strictEqual(localFileResp.headers.get('content-type'), 'image/png');
    const localFileBytes = Buffer.from(await localFileResp.arrayBuffer());
    assert(localFileBytes.equals(tinyPng), 'Downloaded PNG bytes via /api/local-file did not match original');

    const localBadExtResp = await realFetch(`http://127.0.0.1:${appPort}/api/local-file?path=${encodeURIComponent(path.join(ROOT, 'server.js'))}`);
    assert.strictEqual(localBadExtResp.status, 403, 'Expected 403 on non-media /api/local-file extension');

    const localMissingQueryResp = await realFetch(`http://127.0.0.1:${appPort}/api/local-file`);
    assert.strictEqual(localMissingQueryResp.status, 400, 'Expected 400 when /api/local-file omits path');

    // 4. Test resolveLocalMediaUrl() & resolvePayloadMedia() with intercepted upload ticket (zero WaveSpeed calls!)
    global.fetch = async (url, opts) => {
      if (String(url).endsWith('/api/v3/media/uploads')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              upload: {
                url: `http://127.0.0.1:${mockPort}/mock-put-upload`,
                method: 'PUT',
                headers: { 'Content-Type': 'image/png' }
              },
              download_url: `http://127.0.0.1:${mockPort}/uploaded/mock-resolved.png`,
              filename: 'mock-resolved.png',
              size: tinyPng.length
            }
          })
        };
      }
      return realFetch(url, opts);
    };

    const resolvedDirect = await srvMod.resolveLocalMediaUrl(savedImg[0].local_url);
    assert.strictEqual(resolvedDirect, `http://127.0.0.1:${mockPort}/uploaded/mock-resolved.png`);
    assert.strictEqual(uploadedPayloads.length, 1);
    assert(uploadedPayloads[0].equals(tinyPng));

    const resolvedViaLocalFileApi = await srvMod.resolveLocalMediaUrl(`/api/local-file?path=${encodeURIComponent(savedImg[0].local_path)}`);
    assert.strictEqual(resolvedViaLocalFileApi, `http://127.0.0.1:${mockPort}/uploaded/mock-resolved.png`);

    const payload = {
      image: `http://localhost:3000${savedImg[0].local_url}`,
      reference_images: [savedImg[0].local_url, 'https://example.com/already-remote.png'],
      ref_videos: [savedVid[0].local_url],
      audios: ['https://example.com/ref-audio.mp3'],
      prompt: 'test'
    };
    await srvMod.resolvePayloadMedia(payload);
    assert.strictEqual(payload.image, `http://127.0.0.1:${mockPort}/uploaded/mock-resolved.png`);
    assert.strictEqual(payload.reference_images[0], `http://127.0.0.1:${mockPort}/uploaded/mock-resolved.png`);
    assert.strictEqual(payload.reference_images[1], 'https://example.com/already-remote.png');
    assert.strictEqual(payload.ref_videos[0], `http://127.0.0.1:${mockPort}/uploaded/mock-resolved.png`);

    // 4b. Test raw binary streaming POST /api/upload-raw (used for video/audio uploads)
    const rawUploadResp = await realFetch(`http://127.0.0.1:${appPort}/api/upload-raw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'video/mp4',
        'X-File-Name': encodeURIComponent('ref-clip test.mp4')
      },
      body: tinyMp4
    });
    assert.strictEqual(rawUploadResp.status, 200);
    const rawUploadJson = await rawUploadResp.json();
    assert.strictEqual(rawUploadJson.data.download_url, `http://127.0.0.1:${mockPort}/uploaded/mock-resolved.png`);
    assert(uploadedPayloads[uploadedPayloads.length - 1].equals(tinyMp4), 'upload-raw must preserve exact binary bytes');

    // 5. Test POST /api/outputs/delete traversal protection & clean removal
    const badDelResp = await realFetch(`http://127.0.0.1:${appPort}/api/outputs/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ local_path: path.join(ROOT, 'server.js') })
    });
    assert.strictEqual(badDelResp.status, 403, 'Expected 403 when trying to delete outside OUTPUTS_DIR');
    assert(fs.existsSync(path.join(ROOT, 'server.js')), 'server.js must never be deleted');

    const okDelResp = await realFetch(`http://127.0.0.1:${appPort}/api/outputs/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: mockTaskVid, local_path: savedVid[0].local_path, local_url: savedVid[0].local_url })
    });
    assert.strictEqual(okDelResp.status, 200);
    const delJson = await okDelResp.json();
    assert.strictEqual(delJson.file_deleted, true);
    assert.strictEqual(delJson.metadata_deleted >= 1, true);
    assert.strictEqual(fs.existsSync(savedVid[0].local_path), false);

    // 6. Test FFmpeg trim/concat validation guards & /api/config version
    const badTrim = await realFetch(`http://127.0.0.1:${appPort}/api/video/trim?start=5&end=3`, { method: 'POST' });
    assert.strictEqual(badTrim.status, 400);
    const badConcat = await realFetch(`http://127.0.0.1:${appPort}/api/video/concat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: ['/outputs/videos/only-one.mp4'] })
    });
    assert.strictEqual(badConcat.status, 400);
    const travConcat = await realFetch(`http://127.0.0.1:${appPort}/api/video/concat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: ['/outputs/../server.js', '/outputs/videos/a.mp4'] })
    });
    assert.strictEqual(travConcat.status, 403);
    const cfgResp = await realFetch(`http://127.0.0.1:${appPort}/api/config`);
    assert.strictEqual(cfgResp.status, 200);
    const cfgJson = await cfgResp.json();
    assert(cfgJson.version, 'Expected app version in /api/config');
    assert(cfgJson.croppedDir, 'Expected croppedDir in /api/config');

    // 7. Test Face Crop storage (/api/crops/save, /api/crops, /outputs/cropped_imgs/*, /api/crops/delete + traversal guard)
    const tinyPngDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';
    const cropSaveResp = await realFetch(`http://127.0.0.1:${appPort}/api/crops/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataUrl: tinyPngDataUrl,
        origin_filename: 'origin_portrait_test.jpg',
        origin_url: '/outputs/images/origin_portrait_test.jpg',
        crop_mode: 'rect',
        width: 1,
        height: 1
      })
    });
    assert.strictEqual(cropSaveResp.status, 200);
    const cropSaveJson = await cropSaveResp.json();
    assert(cropSaveJson.data && cropSaveJson.data.crop_id, 'Expected saved crop record in data');
    assert(cropSaveJson.data.local_url.startsWith('/outputs/cropped_imgs/'), 'Expected crop under /outputs/cropped_imgs/');
    assert.strictEqual(cropSaveJson.data.origin_filename, 'origin_portrait_test.jpg');
    createdFiles.push(cropSaveJson.data.local_path);

    const cropsListResp = await realFetch(`http://127.0.0.1:${appPort}/api/crops`);
    assert.strictEqual(cropsListResp.status, 200);
    const cropsListJson = await cropsListResp.json();
    assert(Array.isArray(cropsListJson.items) && cropsListJson.items.some(c => c.crop_id === cropSaveJson.data.crop_id));

    const cropStaticResp = await realFetch(`http://127.0.0.1:${appPort}${cropSaveJson.data.local_url}`);
    assert.strictEqual(cropStaticResp.status, 200);

    const badCropDel = await realFetch(`http://127.0.0.1:${appPort}/api/crops/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ local_path: path.join(ROOT, 'server.js') })
    });
    assert.strictEqual(badCropDel.status, 403, 'Expected 403 when deleting crop outside OUTPUTS_CROPPED_DIR');

    const okCropDel = await realFetch(`http://127.0.0.1:${appPort}/api/crops/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crop_id: cropSaveJson.data.crop_id, local_path: cropSaveJson.data.local_path })
    });
    assert.strictEqual(okCropDel.status, 200);
    const okCropDelJson = await okCropDel.json();
    assert.strictEqual(okCropDelJson.deleted, true);
    assert.strictEqual(fs.existsSync(cropSaveJson.data.local_path), false);

    // 8. Test Face Study Prompt Library endpoints (/api/face-prompts, POST, DELETE)
    const fpListResp = await realFetch(`http://127.0.0.1:${appPort}/api/face-prompts`);
    assert.strictEqual(fpListResp.status, 200);
    const fpListJson = await fpListResp.json();
    assert(Array.isArray(fpListJson.items) && fpListJson.items.length >= 12, 'Expected >= 12 seeded Face Study prompts');

    const fpCreateResp = await realFetch(`http://127.0.0.1:${appPort}/api/face-prompts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test Custom Cheeky Smile',
        category: 'Expressions',
        template_text: 'Preserve face from {{REFS}} with cheeky wink.'
      })
    });
    assert.strictEqual(fpCreateResp.status, 200);
    const fpCreateJson = await fpCreateResp.json();
    assert(fpCreateJson.data && fpCreateJson.data.prompt_id);

    const fpDelResp = await realFetch(`http://127.0.0.1:${appPort}/api/face-prompts/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt_id: fpCreateJson.data.prompt_id })
    });
    assert.strictEqual(fpDelResp.status, 200);
    const fpDelJson = await fpDelResp.json();
    assert.strictEqual(fpDelJson.deleted, true);

    // 9. Test GET /api/sources endpoint & POST /api/open-folder
    const sourcesResp = await realFetch(`http://127.0.0.1:${appPort}/api/sources`);
    assert.strictEqual(sourcesResp.status, 200);
    const sourcesJson = await sourcesResp.json();
    assert.strictEqual(sourcesJson.code, 200);
    assert(Array.isArray(sourcesJson.items));

    const openFolderResp = await realFetch(`http://127.0.0.1:${appPort}/api/open-folder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath: savedImg[0].local_path })
    });
    assert.strictEqual(openFolderResp.status, 200);
    const openFolderJson = await openFolderResp.json();
    assert(openFolderJson.ok || openFolderJson.success, 'Expected ok status on /api/open-folder response');

    console.log('[PASS] Isolated mock HTTP test for saveOutputLocally, listSavedOutputs, /outputs/*, /api/outputs/delete, 403 traversal, video trim/concat guards, resolvePayloadMedia, /api/crops*, /api/face-prompts*, /api/sources, and /api/open-folder passed');
  } finally {
    global.fetch = realFetch;
    srvMod.savedTasksMap.delete(mockTaskImg);
    srvMod.savedTasksMap.delete(mockTaskVid);

    for (const fp of createdFiles) {
      try {
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      } catch (e) {}
    }

    // Restore logs/generations.jsonl cleanly so zero mock test junk remains
    if (hadGenLogBefore) {
      fs.writeFileSync(srvMod.GENERATIONS_LOG_FILE, prevGenLogContent, 'utf8');
    } else if (fs.existsSync(srvMod.GENERATIONS_LOG_FILE)) {
      fs.unlinkSync(srvMod.GENERATIONS_LOG_FILE);
    }

    await new Promise(resolve => mockRemoteServer.close(resolve));
    await new Promise(resolve => srvMod.server.close(resolve));
  }
}

async function runMockDomAppTests() {
  function makeClassList(initial = []) {
    const set = new Set(initial);
    return {
      add: (...cls) => cls.forEach(c => set.add(c)),
      remove: (...cls) => cls.forEach(c => set.delete(c)),
      toggle: (c, force) => {
        if (force === undefined) set.has(c) ? set.delete(c) : set.add(c);
        else if (force) set.add(c);
        else set.delete(c);
      },
      contains: (c) => set.has(c),
      toString: () => [...set].join(' ')
    };
  }

  function makeElement(tag = 'div', id = '') {
    const attrs = {};
    const listeners = {};
    const children = [];
    let _innerHTML = '';
    const elObj = {
      tagName: tag.toUpperCase(),
      id,
      dataset: {},
      style: {},
      className: '',
      classList: makeClassList(),
      children,
      options: children,
      value: '',
      checked: false,
      disabled: false,
      selected: false,
      textContent: '',
      src: '',
      muted: false,
      preload: '',
      alt: '',
      type: '',
      title: '',
      get innerHTML() { return _innerHTML; },
      set innerHTML(v) {
        _innerHTML = String(v);
        if (v === '') children.length = 0;
      },
      setAttribute(k, v) { attrs[k] = String(v); if (k === 'src') elObj.src = String(v); },
      getAttribute(k) { return k === 'src' ? elObj.src : attrs[k]; },
      appendChild(child) {
        children.push(child);
        if (tag === 'select' && (child.selected || children.length === 1)) {
          elObj.value = child.value;
        }
        return child;
      },
      addEventListener(evt, fn) {
        if (!listeners[evt]) listeners[evt] = [];
        listeners[evt].push(fn);
      },
      removeEventListener(evt, fn) {
        if (!listeners[evt]) return;
        listeners[evt] = listeners[evt].filter(x => x !== fn);
      },
      dispatch(evt, eventObj = {}) {
        (listeners[evt] || []).slice().forEach(fn => fn({ target: elObj, stopPropagation() {}, preventDefault() {}, ...eventObj }));
      },
      dispatchEvent(ev) { elObj.dispatch(ev?.type || ev, ev); },
      click() { elObj.dispatch('click'); },
      focus() {},
      remove() {},
      scrollIntoView() {},
      load() {},
      pause() {},
      play() { return Promise.resolve(); },
      removeAttribute(k) { delete attrs[k]; },
      contains() { return false; },
      closest() { return null; },
      querySelector(sel) {
        if (sel === '.ratio-pill.active') return children.find(c => c.classList.contains('active')) || null;
        if (sel === '.pipeline-step-summary') return makeElement('span');
        if (sel === '.input-header label') return makeElement('label');
        if (sel === '.input-header .subtext') return makeElement('span');
        if (sel === '.active-job-right') return makeElement('div');
        if (sel === 'p') return makeElement('p');
        return null;
      },
      querySelectorAll(sel) {
        if (sel === '.ratio-pill' || sel === '.seg-btn') return children;
        if (sel === '.combobox-item') return children;
        return [];
      },
      getBoundingClientRect() { return { width: 480, height: 300, left: 0, top: 0 }; },
      getContext() { return { fillStyle: '', fillRect() {}, lineWidth: 1, lineCap: '', lineJoin: '', strokeStyle: '', lineTo() {}, stroke() {}, beginPath() {}, moveTo() {} }; }
    };
    return elObj;
  }

  const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
  const elementsById = new Map();
  for (const m of html.matchAll(/id="([^"]+)"/g)) {
    const id = m[1];
    let tag = 'div';
    if (id.endsWith('Select')) tag = 'select';
    else if (id.endsWith('Input') || id.endsWith('Checkbox') || id.endsWith('Slider') || id === 'brushSize') tag = 'input';
    else if (id.endsWith('Btn')) tag = 'button';
    else if (id.endsWith('Canvas')) tag = 'canvas';
    elementsById.set(id, makeElement(tag, id));
  }
  elementsById.get('spendGuardEnabledInput').checked = true;
  elementsById.get('spendGuardThresholdInput').value = '0.50';
  elementsById.get('economyDefaultsCheckbox').checked = true;
  elementsById.get('seedInput').value = '-1';
  elementsById.get('strengthSlider').value = '0.70';

  const modeBtns = ['image-gen', 'image-edit', 'image-to-video', 'ref-to-video', 'video-gen', 'faces-swaps', 'pipeline', 'utility'].map(cat => {
    const b = makeElement('button');
    b.dataset.category = cat;
    if (cat === 'image-gen') b.classList.add('active');
    return b;
  });
  const chipFilterBtns = ['tab', 'spicy', 'affordable', 'cheap', 'all'].map(flt => {
    const b = makeElement('button');
    b.dataset.filter = flt;
    if (flt === 'tab') b.classList.add('active');
    return b;
  });

  const mockModels = [
    {
      model_id: 'wavespeed-ai/minimax-h3-image/text-to-image',
      name: 'MiniMax H3 Economy (Text-to-Image)',
      base_price: 0.02, base_price_micro: 20000, effective_price: 0.02,
      discount_rate: 100, discount_percent: 0,
      formula: formulasJson['wavespeed-ai/minimax-h3-image/text-to-image'].formula,
      has_formula: true, fetched_at: Date.now(),
      category: 'image-gen', isImageGen: true, isPinned: true, pinnedRank: 0,
      schema: { required: ['prompt'], properties: { prompt: {}, resolution: { default: '1k', enum: ['1k', '2k', '4k'] }, output_format: { default: 'jpeg', enum: ['jpeg', 'png'] } } }
    },
    {
      model_id: 'bytedance/seedance-2.5/image-to-video-spicy',
      name: 'Seedance 2.5 Spicy 🌶️ (Image-to-Video)',
      base_price: 0.36, base_price_micro: 360000, effective_price: 0.324,
      discount_rate: 90, discount_percent: 0.10,
      formula: formulasJson['bytedance/seedance-2.5/image-to-video'].formula,
      has_formula: true, fetched_at: Date.now(), isSpicy: true,
      category: 'image-to-video', isImageToVideo: true, isPinned: true, pinnedRank: 8,
      schema: { required: ['prompt', 'image'], properties: { prompt: {}, image: {}, duration: { default: 5, enum: [5, 10] }, resolution: { default: '720p', enum: ['480p', '720p', '1080p'] }, generate_audio: { default: true } } }
    },
    {
      model_id: 'wavespeed-ai/wan-2.2-spicy/video-extend',
      name: 'WAN 2.2 Spicy 🌶️ (Video Extend)',
      base_price: 0.03, base_price_micro: 30000, effective_price: 0.03,
      discount_rate: 100, discount_percent: 0,
      formula: null, has_formula: false, fetched_at: 0, isSpicy: true,
      category: 'video-gen', isTextToVideoOrEdit: true, isPinned: false, pinnedRank: 9999,
      schema: { required: ['video'], properties: { video: {}, duration: { default: 5, enum: [5, 8] }, resolution: { default: '480p', enum: ['480p', '720p'] } } }
    },
    {
      model_id: 'openai/gpt-image-2.6-flare/edit',
      name: 'GPT Image 2.6 Flare (Edit)',
      base_price: 0.065, base_price_micro: 65000, effective_price: 0.0585,
      discount_rate: 90, discount_percent: 0.10,
      formula: formulasJson['openai/gpt-image-2.6-flare/edit'].formula,
      has_formula: true, fetched_at: Date.now(), isSpicy: false,
      category: 'image-edit', isImageEdit: true, isPinned: true, pinnedRank: 4,
      schema: { required: ['prompt', 'image'], properties: { prompt: {}, image: {}, size: { default: '1024*1024', enum: ['512*512', '1024*1024', '1536*1536'] }, quality: { default: 'medium', enum: ['low', 'medium', 'high'] }, resolution: { default: '2k', enum: ['1k', '2k', '4k'] }, num_images: { default: 2, enum: [1, 2, 4] } } }
    },
    {
      model_id: 'alibaba/wan-3.0/reference-to-video',
      name: 'WAN 3.0 (Reference-to-Video)',
      base_price: 0.3, base_price_micro: 300000, effective_price: 0.3,
      discount_rate: 100, discount_percent: 0,
      formula: formulasJson['alibaba/wan-3.0/reference-to-video'].formula,
      has_formula: true, fetched_at: Date.now(), isSpicy: false,
      category: 'ref-to-video', isReferenceToVideo: true, isPinned: true, pinnedRank: 10,
      schema: { required: ['prompt'], properties: { prompt: {}, aspect_ratio: { default: '16:9', enum: ['16:9', '9:16', '1:1'] }, duration: { default: 5 }, resolution: { default: '720p', enum: ['480p', '720p', '1080p'] }, reference_images: { maxItems: 10 }, reference_videos: { maxItems: 5 }, reference_audios: { maxItems: 5 } } }
    },
    {
      model_id: 'kwaivgi/kling-v4.0/reference-to-video',
      name: 'Kling 4.0 (Reference-to-Video)',
      base_price: 0.157, base_price_micro: 157000, effective_price: 0.157,
      discount_rate: 100, discount_percent: 0,
      formula: formulasJson['kwaivgi/kling-v4.0/reference-to-video'].formula,
      has_formula: true, fetched_at: Date.now(), isSpicy: false,
      category: 'ref-to-video', isReferenceToVideo: true, isPinned: true, pinnedRank: 11,
      schema: { required: ['prompt'], properties: { prompt: {}, aspect_ratio: { default: 'auto', enum: ['auto', '16:9', '9:16'] }, duration: { default: 5, enum: [3, 5, 10] }, resolution: { default: '720p', enum: ['720p', '1080p'] }, images: { maxItems: 10 }, videos: { maxItems: 5 }, audios: { maxItems: 3 } } }
    },
    {
      model_id: 'wavespeed-ai/video-upscaler',
      name: 'WaveSpeed Video Upscaler (720p–4K)',
      base_price: 0.005, base_price_micro: 5000, effective_price: 0.005,
      discount_rate: 100, discount_percent: 0,
      formula: '', has_formula: true, fetched_at: Date.now(), isSpicy: false,
      category: 'utility', isUtility: true, isPinned: true, pinnedRank: 12,
      schema: { required: ['video'], properties: { video: {}, target_resolution: { default: '1080p', enum: ['720p', '1080p', '2k', '4k'] } } }
    },
    {
      model_id: 'alibaba/wan-3.0/video-edit',
      name: 'WAN 3.0 (Video Edit • Up to 15s + Ref Images)',
      base_price: 0.1, base_price_micro: 100000, effective_price: 0.1,
      discount_rate: 100, discount_percent: 0,
      formula: formulasJson['alibaba/wan-3.0/video-edit'].formula,
      has_formula: true, fetched_at: Date.now(), isSpicy: false,
      category: 'video-gen', isTextToVideoOrEdit: true, isPinned: true, pinnedRank: 13,
      schema: { required: ['prompt', 'video'], properties: { prompt: {}, video: {}, reference_images: { maxItems: 10 }, reference_audios: { maxItems: 5 }, resolution: { default: '720p', enum: ['480p', '720p', '1080p'] }, generate_audio: { default: true } } }
    },
    {
      model_id: 'wavespeed-ai/video-face-swap',
      name: 'wavespeed-ai/video-face-swap',
      base_price: 0.01, base_price_micro: 10000, effective_price: 0.01,
      discount_rate: 100, discount_percent: 0,
      formula: '', has_formula: false, fetched_at: 0, isSpicy: false,
      category: 'video-gen', isTextToVideoOrEdit: true, isPinned: false, pinnedRank: 9999,
      schema: { required: ['face_image', 'video'], properties: { face_image: {}, video: {} } }
    },
    {
      model_id: 'wavespeed-ai/minimax-h3/reference-to-video',
      name: 'MiniMax H3 Reference-to-Video (50% OFF)',
      base_price: formulasJson['wavespeed-ai/minimax-h3/reference-to-video'].base_price_micro / 1e6,
      base_price_micro: formulasJson['wavespeed-ai/minimax-h3/reference-to-video'].base_price_micro,
      effective_price: (formulasJson['wavespeed-ai/minimax-h3/reference-to-video'].base_price_micro / 1e6) * 0.5,
      discount_rate: 50, discount_percent: 0.5,
      formula: formulasJson['wavespeed-ai/minimax-h3/reference-to-video'].formula,
      has_formula: true, fetched_at: Date.now(), isSpicy: false,
      category: 'ref-to-video', isReferenceToVideo: true, isPinned: true, pinnedRank: 9,
      schema: { required: ['prompt'], properties: { prompt: {}, duration: { default: 5, enum: [5, 10] }, resolution: { default: '768p', enum: ['480p', '768p', '1080p'] }, reference_images: { maxItems: 10 }, reference_videos: { maxItems: 5 }, reference_audios: { maxItems: 5 } } }
    },
    {
      model_id: 'bytedance/seedream-v5.5/edit',
      name: 'Seedream 5.5 Edit (5% OFF)',
      base_price: formulasJson['bytedance/seedream-v5.5/edit'].base_price_micro / 1e6,
      base_price_micro: formulasJson['bytedance/seedream-v5.5/edit'].base_price_micro,
      effective_price: (formulasJson['bytedance/seedream-v5.5/edit'].base_price_micro / 1e6) * 0.95,
      discount_rate: 95, discount_percent: 0.05,
      formula: formulasJson['bytedance/seedream-v5.5/edit'].formula,
      has_formula: true, fetched_at: Date.now(), isSpicy: false,
      category: 'image-edit', isImageEdit: true, isPinned: true, pinnedRank: 3,
      schema: { required: ['prompt', 'images'], properties: { prompt: {}, images: { maxItems: 14 }, size: { default: '2048*2048', enum: ['2048*2048', '3072*3072'] } } }
    },
    {
      model_id: 'wavespeed-ai/image-face-swap-pro',
      name: 'Image Face Swap Pro ($0.025)',
      base_price: 0.025, base_price_micro: 25000, effective_price: 0.025,
      discount_rate: 100, discount_percent: 0,
      formula: '', has_formula: true, fetched_at: Date.now(), isSpicy: false,
      category: 'utility', isUtility: true, isFaceOrSwap: true, isPinned: true, pinnedRank: 14,
      schema: { required: ['image', 'face_image'], properties: { image: {}, face_image: {}, output_format: { default: 'jpeg', enum: ['jpeg', 'png'] } } }
    },
    {
      model_id: 'wavespeed-ai/qwen-image/edit-multiple-angles',
      name: 'Qwen Multiple Angles (96-Pose 3D • $0.025)',
      base_price: 0.025, base_price_micro: 25000, effective_price: 0.025,
      discount_rate: 100, discount_percent: 0,
      formula: '', has_formula: true, fetched_at: Date.now(), isSpicy: false,
      category: 'image-edit', isImageEdit: true, isFaceOrSwap: true, isPinned: true, pinnedRank: 15,
      schema: { required: ['images'], properties: { prompt: {}, images: { maxItems: 3 }, horizontal_angle: { default: 0 }, vertical_angle: { default: 0 }, distance: { default: 1 } } }
    },
    {
      model_id: 'wavespeed-ai/minimax-h3/image-edit',
      name: 'MiniMax H3 (WaveSpeed Image Edit)',
      base_price: 0.03, base_price_micro: 30000, effective_price: 0.03,
      discount_rate: 100, discount_percent: 0,
      formula: formulasJson['wavespeed-ai/minimax-h3/image-edit']?.formula || '', has_formula: true, fetched_at: Date.now(), isSpicy: false,
      category: 'image-edit', isImageEdit: true, isFaceOrSwap: true, isPinned: true, pinnedRank: 16,
      schema: { required: ['prompt', 'images'], properties: { prompt: {}, images: { maxItems: 9 }, resolution: { default: '1k', enum: ['1k', '1.5k', '2k'] } } }
    },
    {
      model_id: 'wavespeed-ai/qwen-image/edit-plus',
      name: 'Qwen Edit Plus (Open-Weights • $0.02 Flat)',
      base_price: 0.02, base_price_micro: 20000, effective_price: 0.02,
      discount_rate: 100, discount_percent: 0,
      formula: '', has_formula: true, fetched_at: Date.now(), isSpicy: false,
      category: 'image-edit', isImageEdit: true, isFaceOrSwap: true, isPinned: true, pinnedRank: 17,
      schema: { required: ['prompt', 'images'], properties: { prompt: {}, images: { maxItems: 3 } } }
    },
    {
      model_id: 'wavespeed-ai/infinite-you',
      name: 'InfiniteYou Zero-Shot Face Swap ($0.05)',
      base_price: 0.05, base_price_micro: 50000, effective_price: 0.05,
      discount_rate: 100, discount_percent: 0,
      formula: '', has_formula: true, fetched_at: Date.now(), isSpicy: false,
      category: 'utility', isUtility: true, isFaceOrSwap: true, isPinned: true, pinnedRank: 18,
      schema: { required: ['source_image', 'target_image'], properties: { source_image: {}, target_image: {} } }
    },
    {
      model_id: 'wavespeed-ai/flux-fill-dev',
      name: 'FLUX Fill Dev Inpaint ($0.05)',
      base_price: 0.05, base_price_micro: 50000, effective_price: 0.05,
      discount_rate: 100, discount_percent: 0,
      formula: '', has_formula: true, fetched_at: Date.now(), isSpicy: false,
      category: 'image-edit', isImageEdit: true, isPinned: false, pinnedRank: 50,
      schema: { required: ['prompt', 'image', 'mask_image'], properties: { prompt: { type: 'string' }, image: { type: 'string' }, mask_image: { type: 'string' } } }
    }
  ];

  let generateCalls = 0;
  const capturedGeneratePayloads = [];
  const docListeners = {};
  const storageMap = new Map();
  const mockLocalStorage = {
    getItem: (k) => storageMap.has(k) ? storageMap.get(k) : null,
    setItem: (k, v) => storageMap.set(k, String(v)),
    removeItem: (k) => storageMap.delete(k)
  };
  mockLocalStorage.setItem('wavespeed_studio_history', JSON.stringify([{
    task_id: 'hist-1',
    url: 'https://cdn.expired.invalid/old.png',
    local_url: '/outputs/images/missing.png',
    remote_url: 'https://cdn.expired.invalid/old.png',
    isVideo: false,
    model_id: 'mock/test',
    price: 0.02,
    timestamp: '2026-11-12T20:00:00Z'
  }]));

  const createdMediaEls = [];
  const doc = {
    body: { classList: makeClassList() },
    getElementById: (id) => elementsById.get(id) || makeElement('div', id),
    querySelector: (sel) => {
      if (sel === '.ratio-pill.active') return elementsById.get('ratioPills').children.find(c => c.classList.contains('active')) || null;
      if (sel.startsWith('.mode-btn[data-category="')) {
        const cat = sel.match(/data-category="([^"]+)"/)[1];
        return modeBtns.find(b => b.dataset.category === cat) || null;
      }
      return null;
    },
    querySelectorAll: (sel) => {
      if (sel === '.mode-btn') return modeBtns;
      if (sel === '.chip-filter-btn') return chipFilterBtns;
      if (sel === '.ratio-pill') return elementsById.get('ratioPills').children;
      return [];
    },
    createElement: (tag) => {
      const m = makeElement(tag);
      if (tag === 'img' || tag === 'video') createdMediaEls.push(m);
      return m;
    },
    createTextNode: (txt) => ({ nodeType: 3, textContent: String(txt || '') }),
    addEventListener: (evt, fn) => { (docListeners[evt] = docListeners[evt] || []).push(fn); },
    removeEventListener: (evt, fn) => { if (docListeners[evt]) docListeners[evt] = docListeners[evt].filter(x => x !== fn); }
  };

  const sandbox = {
    console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    window: { innerWidth: 1440, addEventListener() {}, confirm: () => false, requestAnimationFrame: (fn) => setTimeout(fn, 0) },
    document: doc,
    localStorage: mockLocalStorage,
    alert: (msg) => { throw new Error('Unexpected alert: ' + msg); },
    navigator: { clipboard: { writeText() {} } },
    FileReader: function () {},
    Event: function (type) { this.type = type; },
    Image: function () { this.onload = null; this.onerror = null; },
    URL: { createObjectURL: () => 'blob:mock', revokeObjectURL() {} },
    fetch: async (url, opts = {}) => {
      if (url === '/api/config') return { ok: true, json: async () => ({ hasApiKey: true, version: '1.2.0', croppedDir: './outputs/cropped_imgs' }) };
      if (url === '/api/check-update') return { ok: true, json: async () => ({ hasUpdate: false, currentVersion: '1.2.0', latestVersion: '1.2.0' }) };
      if (url.startsWith('/api/history')) return { ok: true, json: async () => ({ stats: {}, models: [], items: [] }) };
      if (url === '/api/crops') return { ok: true, json: async () => ({ items: [] }) };
      if (url === '/api/face-prompts') {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                prompt_id: 'fp-test-cheeky',
                title: 'Playful Tongue-Out / Teasing Studio Shot',
                category: 'Expressions',
                template_text: 'Keep exact facial identity from {{REFS}}; playful tongue-out smirk toward camera.',
                is_builtin: true
              }
            ]
          })
        };
      }
      if (url === '/api/balance') return { ok: true, json: async () => ({ data: { balance: 5.8797 } }) };
      if (url.startsWith('/api/models')) return { ok: true, json: async () => ({ data: mockModels }) };
      if (url === '/api/outputs') return { ok: true, json: async () => ({ outputs_dir: './outputs', data: [] }) };
      if (url.startsWith('/api/model-pricing')) return { ok: true, json: async () => ({ data: null }) };
      if (url === '/api/generate') {
        generateCalls++;
        if (opts && opts.body) {
          capturedGeneratePayloads.push(JSON.parse(opts.body));
        }
        return { ok: true, json: async () => ({ data: { id: 'mock-task-never-real' } }) };
      }
      if (String(url).startsWith('/api/task/')) {
        return {
          ok: true,
          json: async () => ({
            data: { id: 'mock-task-never-real', status: 'completed', outputs: ['https://cdn.example/mock-out.mp4'], local_outputs: [] }
          })
        };
      }
      return { ok: false, json: async () => ({}) };
    }
  };

  vm.createContext(sandbox);
  vm.runInContext(appJsSource, sandbox);
  await new Promise(r => setTimeout(r, 30));

  // 1. Verify initial selected model default parity (output_format defaults to jpeg from schema!)
  assert.strictEqual(elementsById.get('outputFormatSelect').value, 'jpeg');
  assert.strictEqual(elementsById.get('resolutionSelect').value, '1k');

  // 2. Verify gallery onerror does NOT infinitely loop when both local_url and remote_url fail
  assert.strictEqual(createdMediaEls.length, 1);
  const histImg = createdMediaEls[0];
  assert.strictEqual(histImg.src, '/outputs/images/missing.png');
  histImg.onerror();
  assert.strictEqual(histImg.src, 'https://cdn.expired.invalid/old.png');
  histImg.onerror();
  assert(elementsById.get('historyGallery').children[0].children[0].innerHTML.includes('gallery-thumb-fallback'));

  // 3. Verify Spicy filter chip filters across all tabs (shows both I2V and video-gen spicy models)
  const spicyChip = chipFilterBtns.find(b => b.dataset.filter === 'spicy');
  spicyChip.click();
  assert.strictEqual(elementsById.get('modelsCountBadge').textContent, '2 models');

  // 4. Select high-cost Seedance 2.5 Spicy -> Economy Defaults auto-pick 480p ($0.8100 instead of $1.6200) & audio=false, duration stays 5s
  elementsById.get('comboboxList').children[0].click();
  assert.strictEqual(elementsById.get('modelAutocompleteInput').value, 'bytedance/seedance-2.5/image-to-video-spicy');
  assert.strictEqual(elementsById.get('resolutionSelect').value, '480p');
  assert.strictEqual(String(elementsById.get('durationSelect').value), '5');
  assert.strictEqual(elementsById.get('audioCheckbox').checked, false);

  elementsById.get('promptInput').value = 'test prompt';
  elementsById.get('imageUrlInput').value = 'https://example.com/a.png';
  elementsById.get('generateBtn').click();
  await new Promise(r => setTimeout(r, 15));
  assert.strictEqual(elementsById.get('spendConfirmModal').style.display, 'flex');
  assert(elementsById.get('spendConfirmDetails').innerHTML.includes('$0.8100'));
  elementsById.get('cancelSpendBtn').click();
  await new Promise(r => setTimeout(r, 15));
  assert.strictEqual(elementsById.get('spendConfirmModal').style.display, 'none');
  assert.strictEqual(generateCalls, 0);

  // 5. Switch to Image Edit tab -> verify Economy Defaults pick smallest size (512*512), low quality, 1k resolution, and num_images=1
  const editTab = modeBtns.find(b => b.dataset.category === 'image-edit');
  editTab.click();
  assert.strictEqual(elementsById.get('modelAutocompleteInput').value, 'openai/gpt-image-2.6-flare/edit');
  assert.strictEqual(elementsById.get('sizeSelect').value, '512*512');
  assert.strictEqual(elementsById.get('qualitySelect').value, 'low');
  assert.strictEqual(elementsById.get('resolutionSelect').value, '1k');
  assert.strictEqual(String(elementsById.get('numImagesSelect').value), '1');

  // 6. Switch back to 'This Tab Only' filter and open Ref -> Video tab -> verify Wan 3.0, Kling 4.0 & MiniMax H3 R2V Ref Video/Audio upload UI & per-asset pricing updates
  const tabChip = chipFilterBtns.find(b => b.dataset.filter === 'tab');
  tabChip.click();
  const r2vTab = modeBtns.find(b => b.dataset.category === 'ref-to-video');
  r2vTab.click();
  const pickComboboxById = (substr) => {
    const item = elementsById.get('comboboxList').children.find(c => (c.innerHTML || '').includes(substr));
    assert(item, `Expected combobox item matching ${substr}`);
    item.click();
  };
  assert.strictEqual(elementsById.get('modelAutocompleteInput').value, 'alibaba/wan-3.0/reference-to-video');
  assert.strictEqual(elementsById.get('imageInputGroup').style.display, 'none');
  assert.strictEqual(elementsById.get('multiImageGroup').style.display, 'flex');
  assert.strictEqual(elementsById.get('refVideosGroup').style.display, 'flex');
  assert.strictEqual(elementsById.get('refAudiosGroup').style.display, 'flex');
  assert.strictEqual(elementsById.get('r2vRefChips').style.display, 'contents');

  pickComboboxById('Kling 4.0');
  assert.strictEqual(elementsById.get('modelAutocompleteInput').value, 'kwaivgi/kling-v4.0/reference-to-video');
  assert.strictEqual(elementsById.get('refVideosGroup').style.display, 'flex');
  assert.strictEqual(elementsById.get('refAudiosGroup').style.display, 'flex');

  // Switch to MiniMax H3 R2V and verify adding Ref Image + Ref Audio updates exact price pill & remaining balance
  pickComboboxById('MiniMax H3 Reference-to-Video');
  assert.strictEqual(elementsById.get('modelAutocompleteInput').value, 'wavespeed-ai/minimax-h3/reference-to-video');
  const baseR2vPriceText = elementsById.get('infoModelPrice').innerHTML;
  elementsById.get('multiImageUrlInput').value = 'https://example.com/r2v-face1.png';
  elementsById.get('addMultiImageUrlBtn').click();
  elementsById.get('refAudioUrlInput').value = 'https://example.com/r2v-voice.mp3';
  elementsById.get('addRefAudioUrlBtn').click();
  const updatedR2vPriceText = elementsById.get('infoModelPrice').innerHTML;
  assert.notStrictEqual(updatedR2vPriceText, baseR2vPriceText, 'Expected R2V image/audio additions to update model price pill');
  assert(elementsById.get('infoPriceBreakdown').textContent.includes('1 img + 1 audio'), 'Expected counted assets breakdown on R2V');
  assert(elementsById.get('sidebarBalanceProjection').textContent.includes('→ $5.'), 'Expected updated remaining balance projection');
  // Remove added R2V image & audio via UI remove buttons so state stays clean
  elementsById.get('multiImgGrid').children[0].children[2].click();
  elementsById.get('refAudiosList').children[0].children[1].children[0].click();

  // 6b. Switch to Image Edit -> verify Seedream 5.5 Edit scales price with 1 vs 3 reference images ($0.0266 -> $0.0418)
  const imgEditTab = modeBtns.find(b => b.dataset.category === 'image-edit');
  imgEditTab.click();
  pickComboboxById('Seedream 5.5 Edit');
  assert.strictEqual(elementsById.get('modelAutocompleteInput').value, 'bytedance/seedream-v5.5/edit');
  elementsById.get('multiImageUrlInput').value = 'https://example.com/sd-ref1.png';
  elementsById.get('addMultiImageUrlBtn').click();
  const sd1Price = elementsById.get('infoModelPrice').innerHTML;
  assert(sd1Price.includes('$0.0266'), `Expected Seedream 5.5 Edit 1-img price $0.0266, got ${sd1Price}`);
  assert(elementsById.get('multiImageCostBadge').textContent.includes('+$0.0076'), `Expected Seedream per-ref cost badge +$0.0076, got ${elementsById.get('multiImageCostBadge').textContent}`);
  assert.strictEqual(elementsById.get('maskCanvasGroup').style.display, 'flex', 'Expected Paint Region / Mask studio visible on image-edit models');
  elementsById.get('insertFaceStudyPromptBtn').click();
  assert(elementsById.get('promptInput').value.includes('facial identity') && elementsById.get('promptInput').value.includes('Image 1'), 'Expected Face Study Prompt helper to populate role-aware prompt');
  elementsById.get('toggleExpandGalleryBtn').click();
  assert.strictEqual(elementsById.get('toggleExpandGalleryBtn').textContent, '🖼️ Show Viewer', 'Expected gallery expand toggle');
  elementsById.get('toggleExpandGalleryBtn').click();
  assert.strictEqual(elementsById.get('toggleExpandGalleryBtn').textContent, '🖼️ Expand Gallery', 'Expected gallery collapse back');
  elementsById.get('multiImageUrlInput').value = 'https://example.com/sd-ref2.png';
  elementsById.get('addMultiImageUrlBtn').click();
  elementsById.get('multiImageUrlInput').value = 'https://example.com/sd-ref3.png';
  elementsById.get('addMultiImageUrlBtn').click();
  const sd3Price = elementsById.get('infoModelPrice').innerHTML;
  assert(sd3Price.includes('$0.0418'), `Expected Seedream 5.5 Edit 3-img price $0.0418, got ${sd3Price}`);
  assert(elementsById.get('infoPriceBreakdown').textContent.includes('3 img'), 'Expected 3 img count in Seedream price breakdown');

  // Also test universal Drag-and-Drop URL drop handling across image, multi-image, audio & timeline drop targets
  const makeDropEvent = (url) => ({
    preventDefault() {},
    stopPropagation() {},
    dataTransfer: {
      files: [],
      types: ['text/uri-list', 'text/plain'],
      getData: (t) => (t === 'text/uri-list' || t === 'text/plain' ? url : '')
    }
  });
  elementsById.get('multiImageDropzone').dispatch('drop', makeDropEvent('https://example.com/dropped-ref4.png'));
  assert(elementsById.get('infoPriceBreakdown').textContent.includes('4 img'), 'Expected dropped multi-image URL to increment Seedream count to 4 img');
  while (elementsById.get('multiImgGrid').children.length > 0) {
    elementsById.get('multiImgGrid').children[0].children[2].click();
  }
  elementsById.get('refAudioDropzone').dispatch('drop', makeDropEvent('https://example.com/dropped-voice.mp3'));
  assert(elementsById.get('refAudiosList').children.length >= 1, 'Expected dropped audio URL to append to refAudiosList');
  elementsById.get('refAudiosList').children[0].children[1].children[0].click();
  elementsById.get('videoTimelineGroup').dispatch('drop', makeDropEvent('/outputs/videos/dropped-clip.mp4'));
  assert.strictEqual(elementsById.get('videoTimelineGroup').style.display, 'block', 'Expected dropped video on timeline to open timeline');

  // 7. Switch to Tools tab -> verify video-upscaler routes here, plus dual-slot image + face_image on image-face-swap-pro
  const toolsTab = modeBtns.find(b => b.dataset.category === 'utility');
  toolsTab.click();
  assert.strictEqual(elementsById.get('modelAutocompleteInput').value, 'wavespeed-ai/video-upscaler');
  assert.strictEqual(elementsById.get('videoInputGroup').style.display, 'flex');
  assert.strictEqual(elementsById.get('resolutionCol').style.display, 'block');
  assert.strictEqual(elementsById.get('resolutionSelect').value, '1080p');
  pickComboboxById('Image Face Swap Pro');
  assert.strictEqual(elementsById.get('imageInputGroup').style.display, 'flex');
  assert.strictEqual(elementsById.get('lastImageGroup').style.display, 'flex');

  // 8. Switch to Video & Edit tab -> verify wan-3.0/video-edit defaults to 480p and exposes Video + Ref Images + Ref Audios + ref chips + workflow advisory
  const videoGenTab = modeBtns.find(b => b.dataset.category === 'video-gen');
  videoGenTab.click();
  assert.strictEqual(elementsById.get('modelAutocompleteInput').value, 'alibaba/wan-3.0/video-edit');
  assert(elementsById.get('multiImageCostBadge').textContent.includes('FREE'), 'Expected FREE per-ref badge on Wan 3.0 Video Edit');
  assert.strictEqual(elementsById.get('resolutionSelect').value, '480p');
  assert.strictEqual(elementsById.get('videoInputGroup').style.display, 'flex');
  assert.strictEqual(elementsById.get('multiImageGroup').style.display, 'flex');
  assert.strictEqual(elementsById.get('refAudiosGroup').style.display, 'flex');
  assert.strictEqual(elementsById.get('imageInputGroup').style.display, 'none');
  assert.strictEqual(elementsById.get('r2vRefChips').style.display, 'contents');
  assert(elementsById.get('infoUseAdvice').textContent.includes('Image 1'), 'Expected Wan 3.0 Video Edit workflow advice banner');

  // Verify default presets were removed while + Image 1 / + Video 1 / + Audio 1 and + Save Preset remain
  assert(!html.includes('videoMotionChips'), 'Default video motion presets should be removed');
  assert(!html.includes('Cinematic'), 'Default Cinematic preset should be removed');
  assert(!html.includes('Cyberpunk'), 'Default Cyberpunk preset should be removed');
  assert(!html.includes('Fluid Motion'), 'Default Fluid Motion preset should be removed');
  assert(html.includes('savePresetChipBtn') && html.includes('+ Image 1') && html.includes('+ Video 1'), 'Keep R2V ref chips and Save Preset button');

  // Verify zero-spend emulated payload submission for Wan 3.0 Video Edit + Reference Image (480p)
  elementsById.get('promptInput').value = 'Recreate the clip with Image 1 in realistic motion';
  elementsById.get('videoUrlInput').value = 'https://example.com/source-clip.mp4';
  elementsById.get('multiImageUrlInput').value = 'https://example.com/ref-person.png';
  elementsById.get('addMultiImageUrlBtn').click();
  elementsById.get('generateBtn').click();
  await new Promise(r => setTimeout(r, 40));
  assert.strictEqual(generateCalls, 1);
  assert.strictEqual(capturedGeneratePayloads.length, 1);
  const wanEditReq = capturedGeneratePayloads[0];
  assert.strictEqual(wanEditReq.model_id, 'alibaba/wan-3.0/video-edit');
  assert.strictEqual(wanEditReq.payload.video, 'https://example.com/source-clip.mp4');
  assert.deepStrictEqual(wanEditReq.payload.reference_images, ['https://example.com/ref-person.png']);
  assert.strictEqual(wanEditReq.payload.resolution, '480p');
  assert.strictEqual(wanEditReq.payload.generate_audio, false);
  elementsById.get('cancelTaskBtn').click();

  // Also check face_image single-slot support on wavespeed-ai/video-face-swap
  elementsById.get('comboboxList').children[1].click();
  assert.strictEqual(elementsById.get('modelAutocompleteInput').value, 'wavespeed-ai/video-face-swap');
  assert.strictEqual(elementsById.get('imageInputGroup').style.display, 'flex');
  assert.strictEqual(elementsById.get('videoInputGroup').style.display, 'flex');

  // 9. Verify Batch / Prompt-Variable Matrix ({sunset | neon} x 2 seeds = 4 concurrent dispatches) & multiplied Spend Guard / Balance projection
  const t2iTab = modeBtns.find(b => b.dataset.category === 'image-gen');
  t2iTab.click();
  elementsById.get('promptInput').value = 'Portrait at {sunset | neon} beach';
  const batchSelect = elementsById.get('batchSeedsSelect');
  batchSelect.value = '2';
  batchSelect.dispatch('change');
  assert.strictEqual(elementsById.get('batchMatrixHint').style.display, 'block');
  assert(elementsById.get('batchMatrixHint').textContent.includes('4 concurrent runs'));
  assert(elementsById.get('affordabilityBanner').innerHTML.includes('-$0.0800'));
  const preBatchCount = capturedGeneratePayloads.length;
  elementsById.get('generateBtn').click();
  await new Promise(r => setTimeout(r, 50));
  assert.strictEqual(capturedGeneratePayloads.length - preBatchCount, 4, 'Expected 2 brace variants x 2 seed repeats = 4 dispatched requests');
  const batchPrompts = capturedGeneratePayloads.slice(preBatchCount).map(x => x.payload.prompt);
  assert(batchPrompts.includes('Portrait at sunset beach') && batchPrompts.includes('Portrait at neon beach'));
  elementsById.get('cancelTaskBtn').click();

  // 10. Verify Faces & Swaps tab, Model Mixing Guide (<Picture 1> vs Image 1), 3D Angle Controls, InfiniteYou dual slots, and Pipeline tab (2 default steps + Add Step)
  const facesTab = modeBtns.find(b => b.dataset.category === 'faces-swaps');
  facesTab.click();
  assert(elementsById.get('comboboxList').children.length >= 4, 'Expected Faces & Swaps tab to list face mixing, angle & swap models');
  // Select Qwen Multiple Angles via search
  elementsById.get('modelAutocompleteInput').value = 'multiple-angles';
  elementsById.get('modelAutocompleteInput').dispatch('input');
  elementsById.get('comboboxList').children[0].click();
  assert.strictEqual(elementsById.get('modelAutocompleteInput').value, 'wavespeed-ai/qwen-image/edit-multiple-angles');
  assert.strictEqual(elementsById.get('angleControlsGroup').style.display, 'block', 'Expected 3D Angle Controls to show for Qwen Multiple Angles');
  assert.strictEqual(elementsById.get('modelMixingTipWrap').style.display, 'block', 'Expected Model Mixing Guide tip badge to show');
  assert(elementsById.get('modelMixingBadgeText').textContent.includes('96-Pose'));

  // Select MiniMax H3 Image Edit -> verify model-aware Face Study inserts <Picture 1>
  elementsById.get('modelAutocompleteInput').value = 'minimax-h3/image-edit';
  elementsById.get('modelAutocompleteInput').dispatch('input');
  elementsById.get('comboboxList').children[0].click();
  assert.strictEqual(elementsById.get('modelAutocompleteInput').value, 'wavespeed-ai/minimax-h3/image-edit');
  elementsById.get('promptInput').value = '';
  elementsById.get('insertFaceStudyPromptBtn').click();
  assert(elementsById.get('promptInput').value.includes('<Picture 1>'), 'Expected MiniMax H3 Face Study prompt to use <Picture 1> syntax');

  // Select InfiniteYou -> verify target_image + source_image dual slots
  elementsById.get('modelAutocompleteInput').value = 'infinite-you';
  elementsById.get('modelAutocompleteInput').dispatch('input');
  elementsById.get('comboboxList').children[0].click();
  assert.strictEqual(elementsById.get('imageInputGroup').style.display, 'flex');
  assert.strictEqual(elementsById.get('lastImageGroup').style.display, 'flex');

  // Switch to Seedream 5.5 Edit on Faces & Swaps -> verify Study Prompts dropdown injects Image 1 + Saved Crops button opens #faceCropModal
  facesTab.click();
  elementsById.get('modelAutocompleteInput').value = 'seedream-v5.5';
  elementsById.get('modelAutocompleteInput').dispatch('input');
  elementsById.get('comboboxList').children[0].click();
  assert.strictEqual(elementsById.get('modelAutocompleteInput').value, 'bytedance/seedream-v5.5/edit');
  elementsById.get('openFacePromptsBtn').click();
  await new Promise(r => setTimeout(r, 15));
  assert.strictEqual(elementsById.get('faceStudyPromptsMenu').style.display, 'flex', 'Expected #openFacePromptsBtn to open #faceStudyPromptsMenu');
  const firstPromptCard = elementsById.get('faceStudyPromptList').children[0];
  assert(firstPromptCard && firstPromptCard.children[0].innerHTML.includes('Playful Tongue-Out'), 'Expected seeded Face Study prompt in list');
  firstPromptCard.children[1].children[1].children[0].click(); // ✓ Use
  assert(elementsById.get('promptInput').value.includes('Image 1'), 'Expected Seedream 5.5 Study Prompt to substitute {{REFS}} -> Image 1');

  elementsById.get('openSavedCropsBtn').click();
  await new Promise(r => setTimeout(r, 10));
  assert.strictEqual(elementsById.get('faceCropModal').style.display, 'flex', 'Expected #openSavedCropsBtn to open #faceCropModal');

  // Switch to Pipeline tab -> verify 2 default steps, Add Step -> 3 steps, and total cost calculation
  const pipelineTab = modeBtns.find(b => b.dataset.category === 'pipeline');
  pipelineTab.click();
  assert.strictEqual(elementsById.get('pipelineBuilderPanel').style.display, 'flex');
  assert.strictEqual(elementsById.get('pipelineStageBoard').style.display, 'flex');
  assert.strictEqual(elementsById.get('pipelineStepsList').children.length, 2, 'Expected default 2-step pipeline');
  assert(elementsById.get('pipelineTotalCostBadge').textContent.includes('$0.0450'), 'Expected $0.025 + $0.020 = $0.0450');
  elementsById.get('pipelineAddStepBtn').click();
  assert.strictEqual(elementsById.get('pipelineStepsList').children.length, 3, 'Expected + Add Step to append Step 3');

  // 11. Verify Source Image Reuse, Gallery Source Filtering & Output Details Modal Elements
  assert(elementsById.get('gallerySourceFilterSelect'), 'Expected #gallerySourceFilterSelect in DOM');
  assert(elementsById.get('galleryGroupBySourceBtn'), 'Expected #galleryGroupBySourceBtn in DOM');
  assert(elementsById.get('outputDetailsModal'), 'Expected #outputDetailsModal in DOM');
  assert(elementsById.get('outputDetailsTitle'), 'Expected #outputDetailsTitle in DOM');
  assert(elementsById.get('outputDetailsModelBadge'), 'Expected #outputDetailsModelBadge in DOM');
  assert(elementsById.get('outputDetailsBody'), 'Expected #outputDetailsBody in DOM');
  assert(elementsById.get('closeOutputDetailsModalBtn'), 'Expected #closeOutputDetailsModalBtn in DOM');

  elementsById.get('galleryGroupBySourceBtn').click();
  assert(elementsById.get('galleryGroupBySourceBtn').textContent.includes('Grouped by Source'), 'Expected toggle click to activate Grouped by Source');
  elementsById.get('galleryGroupBySourceBtn').click();
  assert(elementsById.get('galleryGroupBySourceBtn').textContent.includes('Group by Source'), 'Expected toggle click to restore Group by Source');

  // 12. Verify Mask Placement, Collapsible Sections, Quick-Run Shortcuts, wsAppUseInput & sendToEditBtn
  assert(
    html.indexOf('id="multiImageGroup"') < html.indexOf('id="maskCanvasGroup"'),
    'Expected #maskCanvasGroup to appear below #multiImageGroup in public/index.html'
  );

  while (elementsById.get('multiImgGrid').children.length > 0) {
    elementsById.get('multiImgGrid').children[0].children[2].click();
  }
  elementsById.get('batchSeedsSelect').value = '1';
  elementsById.get('batchSeedsSelect').dispatch('change');
  elementsById.get('promptInput').value = 'single prompt';

  t2iTab.click();
  assert(
    elementsById.get('quickRunPromptPrice').textContent.includes('$0.02') &&
    elementsById.get('quickRunPromptPrice').textContent === elementsById.get('btnPriceBadge').textContent,
    `Expected #quickRunPromptPrice to match #btnPriceBadge with $0.02 on H3 T2I, got ${elementsById.get('quickRunPromptPrice').textContent}`
  );
  await sandbox.window.wsAppUseInput('https://example.com/from-gallery.png', { filename: 'from-gallery.png' });
  await new Promise(r => setTimeout(r, 25));
  assert.strictEqual(elementsById.get('modelAutocompleteInput').value, 'bytedance/seedream-v5.5/edit');
  assert.strictEqual(elementsById.get('multiImgGrid').children.length, 1);
  assert.strictEqual(elementsById.get('multiImageBody').style.display, 'flex');

  assert.strictEqual(elementsById.get('maskCanvasBody').style.display, 'none', 'Expected mask canvas to start collapsed on Seedream Edit');
  elementsById.get('toggleMaskCanvasBtn').click();
  assert.strictEqual(elementsById.get('maskCanvasBody').style.display, 'flex');
  elementsById.get('toggleMaskCanvasBtn').click();
  assert.strictEqual(elementsById.get('maskCanvasBody').style.display, 'none');

  elementsById.get('toggleSettingsSectionBtn').click();
  assert.strictEqual(elementsById.get('settingsSectionBody').style.display, 'none');
  elementsById.get('toggleSettingsSectionBtn').click();
  assert.strictEqual(elementsById.get('settingsSectionBody').style.display, 'flex');

  assert(
    elementsById.get('quickRunPromptPrice').textContent.includes('$0.0266') &&
    elementsById.get('quickRunRefsPrice').textContent.includes('$0.0266'),
    `Expected quick-run price badges to show $0.0266, got ${elementsById.get('quickRunRefsPrice').textContent}`
  );
  elementsById.get('promptInput').value = 'quick run test';
  const prevGenCalls = generateCalls;
  elementsById.get('quickRunRefsBtn').click();
  await new Promise(r => setTimeout(r, 30));
  assert.strictEqual(generateCalls, prevGenCalls + 1, 'Expected #quickRunRefsBtn to dispatch generation');
  elementsById.get('cancelTaskBtn').click();

  elementsById.get('outputImageViewer').src = 'https://example.com/viewer-output.png';
  elementsById.get('sendToEditBtn').click();
  await new Promise(r => setTimeout(r, 25));
  assert.strictEqual(elementsById.get('multiImgGrid').children.length, 1, 'Expected #sendToEditBtn to populate #multiImgGrid on Seedream Edit');

  elementsById.get('switchInpaintModelBtn').click();
  await new Promise(r => setTimeout(r, 25));
  assert.strictEqual(elementsById.get('modelAutocompleteInput').value, 'wavespeed-ai/flux-fill-dev');
  assert.strictEqual(elementsById.get('maskCanvasBody').style.display, 'flex', 'Expected mask canvas to unfold automatically on Flux Fill Dev');

  console.log('[PASS] Simulated DOM integration test passed (defaults, Economy non-duration defaults, Spicy chip, Spend Guard cancel, R2V Ref Video/Audio upload & pricing, Wan 3.0 Video-Edit zero-spend payload + Ref Images + no default presets, face_image/source_image swap slots, batch prompt matrix, Faces & Swaps mixing guide, 3D angles, <Picture 1> syntax, Study Prompts & Crop Modal, Pipeline 2+ steps, Gallery source filtering & details modal, collapsible inputs, mask reorder, quick-run buttons & wsAppUseInput)');
}

async function runHistoryDatabaseTests() {
  const os = require('os');
  const { createHistoryDatabase } = require(path.join(ROOT, 'database', 'history_db.js'));
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-hist-db-'));
  const dbFile = path.join(tmpDir, 'test_history.sqlite');
  let hdb = null;
  try {
    hdb = createHistoryDatabase({ dbPath: dbFile });
    hdb.recordSubmission({
      task_id: 't-ok-1',
      model_id: 'wavespeed-ai/minimax-h3/image-to-video-spicy',
      pipeline_id: 'pipe-test-123',
      pipeline_step: 2,
      payload: { prompt: 'beach sunset dance', image: 'https://cdn.example/a.png', resolution: '480p', duration: 10 },
      input_sources: [{ slot: 'image', filename: 'gf_portrait_01.jpg', filepath: 'D:\\Photos\\gf_portrait_01.jpg', remote_url: 'https://cdn.example/a.png', size_bytes: 54321 }],
      estimated_price: 0.2,
      submitted_at: '2026-11-12T20:00:00Z'
    });
    hdb.recordOutputs({
      task_id: 't-ok-1',
      model_id: 'wavespeed-ai/minimax-h3/image-to-video-spicy',
      pipeline_id: 'pipe-test-123',
      pipeline_step: 2,
      payload: { prompt: 'beach sunset dance', image: 'https://cdn.example/a.png', resolution: '480p', duration: 10 },
      input_sources: [{ slot: 'image', filename: 'gf_portrait_01.jpg', filepath: 'D:\\Photos\\gf_portrait_01.jpg', remote_url: 'https://cdn.example/a.png', size_bytes: 54321 }],
      estimated_price: 0.2,
      completed_at: '2026-11-12T20:00:45Z',
      items: [{
        is_video: true,
        remote_url: 'https://cdn.example/out.mp4',
        local_url: '/outputs/videos/out.mp4',
        local_path: path.join(tmpDir, 'out.mp4'),
        filename: 'out.mp4',
        size_bytes: 1024,
        saved_at: '2026-11-12T20:00:45Z'
      }]
    });
    hdb.recordSubmission({
      task_id: 't-err-1',
      model_id: 'alibaba/wan-3.0/image-to-video-spicy',
      payload: { prompt: 'blocked spicy clip', image: 'https://cdn.example/b.bmp', resolution: '480p', duration: 9, generate_audio: false },
      estimated_price: 0.4275,
      submitted_at: '2026-11-12T21:00:00Z'
    });
    hdb.recordTaskStatus({
      task_id: 't-err-1',
      status: 'failed',
      error_message: 'Content flagged as potentially sensitive.'
    });

    hdb.updateRunAnnotations({ task_id: 't-ok-1', is_favorite: true, notes: 'worked great at 480p 10s' });

    const all = hdb.queryHistory({});
    assert.strictEqual(all.stats.total_runs, 2);
    assert.strictEqual(all.stats.completed_runs, 1);
    assert.strictEqual(all.stats.failed_runs, 1);
    assert.strictEqual(all.stats.favorited_runs, 1);
    assert.strictEqual(all.stats.completed_spend, 0.2);
    assert.strictEqual(all.stats.cost_per_favorite, 0.2);
    const h3Stat = all.models.find(m => m.model_id === 'wavespeed-ai/minimax-h3/image-to-video-spicy');
    assert(h3Stat && Number(h3Stat.completed_count) === 1 && Number(h3Stat.failed_count) === 0);

    const searchSunset = hdb.queryHistory({ q: 'sunset' });
    assert.strictEqual(searchSunset.items.length, 1);
    assert.strictEqual(searchSunset.items[0].task_id, 't-ok-1');
    assert.strictEqual(searchSunset.items[0].is_favorite, true);
    assert.strictEqual(searchSunset.items[0].input_filenames, 'gf_portrait_01.jpg');
    assert.strictEqual(searchSunset.items[0].input_sources[0].filepath, 'D:\\Photos\\gf_portrait_01.jpg');
    assert.strictEqual(searchSunset.items[0].pipeline_id, 'pipe-test-123');
    assert.strictEqual(searchSunset.items[0].pipeline_step, 2);

    const searchByInputFile = hdb.queryHistory({ q: 'gf_portrait_01' });
    assert.strictEqual(searchByInputFile.items.length, 1, 'Expected FTS5 search by original input filename to match');

    const failedOnly = hdb.queryHistory({ status: 'failed_group' });
    assert.strictEqual(failedOnly.items.length, 1);
    assert(failedOnly.items[0].error_message.includes('sensitive'));

    const csv = hdb.exportCsv({});
    assert(csv.includes('t-ok-1') && csv.includes('t-err-1') && csv.includes('beach sunset dance') && csv.includes('gf_portrait_01.jpg'));

    const delRes = hdb.deleteRun({ task_id: 't-ok-1' });
    assert.strictEqual(delRes.deleted, true);
    assert.strictEqual(hdb.queryHistory({ q: 'sunset' }).items.length, 0);

    // Provenance tracking: both cropped filename AND origin_filename searchable in FTS5
    hdb.recordSubmission({
      task_id: 't-crop-prov-1',
      model_id: 'bytedance/seedream-v5.5/edit',
      payload: { prompt: 'preserve identity studio crop test', images: ['https://cdn.example/crop1.png'] },
      input_sources: [{
        slot: 'images[0]',
        filename: 'crop_rect_face_01.png',
        origin_filename: 'beach_raw_original_8899.jpg',
        origin_url: '/outputs/images/beach_raw_original_8899.jpg',
        remote_url: 'https://cdn.example/crop1.png'
      }],
      estimated_price: 0.0266,
      submitted_at: '2026-11-16T16:00:00Z'
    });
    const byCrop = hdb.queryHistory({ q: 'crop_rect_face_01' });
    assert.strictEqual(byCrop.items.length, 1, 'Expected cropped filename to be searchable in SQLite FTS5');
    const byOrigin = hdb.queryHistory({ q: 'beach_raw_original_8899' });
    assert.strictEqual(byOrigin.items.length, 1, 'Expected origin_filename to be searchable in SQLite FTS5');
    assert.strictEqual(byOrigin.items[0].input_sources[0].origin_filename, 'beach_raw_original_8899.jpg');

    // Cropped assets CRUD
    const savedCrop = hdb.recordCroppedAsset({
      crop_id: 'crop-test-1',
      filename: 'crop_rect_face_01.png',
      local_path: path.join(tmpDir, 'crop_rect_face_01.png'),
      local_url: '/outputs/cropped_imgs/crop_rect_face_01.png',
      origin_filename: 'beach_raw_original_8899.jpg',
      origin_url: '/outputs/images/beach_raw_original_8899.jpg',
      crop_mode: 'lasso',
      width: 512,
      height: 512,
      size_bytes: 2048
    });
    assert.strictEqual(savedCrop.crop_id, 'crop-test-1');
    const cropRows = hdb.listCroppedAssets(50);
    assert.strictEqual(cropRows.length, 1);
    assert.strictEqual(cropRows[0].crop_mode, 'lasso');
    assert.strictEqual(cropRows[0].origin_filename, 'beach_raw_original_8899.jpg');
    assert.strictEqual(hdb.deleteCroppedAsset('crop-test-1').deleted, true);

    // Seeded & custom Face Study Prompts CRUD
    const seededPrompts = hdb.listFaceStudyPrompts();
    assert(seededPrompts.length >= 12, 'Expected >= 12 seeded built-in Face Study prompts');
    const tonguePrompt = seededPrompts.find(p => /tongue/i.test(p.title + ' ' + p.template_text));
    assert(tonguePrompt, 'Expected Playful Tongue-Out Face Study prompt to be seeded');
    const customPrompt = hdb.saveFaceStudyPrompt({
      title: 'Dramatic Neon Rim Study',
      category: 'Lighting',
      template_text: 'Preserve face identity from {{REFS}} under magenta-cyan rim lighting.'
    });
    assert(customPrompt && customPrompt.prompt_id);
    assert.strictEqual(hdb.deleteFaceStudyPrompt(customPrompt.prompt_id).deleted, true);

    // Checksum preservation & distinct sources grouping
    const testChecksum = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    hdb.recordSubmission({
      task_id: 't-checksum-src-1',
      model_id: 'bytedance/seedream-v5.5/edit',
      payload: { prompt: 'checksum grouping test', images: ['https://cdn.example/source-a.png'] },
      input_sources: [{
        slot: 'images[0]',
        filename: 'source_portrait_a.png',
        filepath: 'C:\\Users\\psyco\\Pictures\\source_portrait_a.png',
        checksum: testChecksum,
        size_bytes: 1048576
      }],
      estimated_price: 0.0266,
      submitted_at: '2026-11-16T17:00:00Z'
    });
    const byChecksum = hdb.queryHistory({ q: testChecksum.slice(0, 16) });
    assert.strictEqual(byChecksum.items.length, 1, 'Expected search by source SHA-256 checksum to match in SQLite FTS5');
    assert.strictEqual(byChecksum.items[0].input_sources[0].checksum, testChecksum);

    const distinct = hdb.listDistinctSources();
    assert(Array.isArray(distinct) && distinct.length >= 2, 'Expected distinct sources to list recorded inputs');
    const foundHashedSource = distinct.find(s => s.checksum === testChecksum);
    assert(foundHashedSource, 'Expected distinct sources to contain hashed source entry');
    assert.strictEqual(foundHashedSource.key, `hash:${testChecksum}`);
    assert.strictEqual(foundHashedSource.filename, 'source_portrait_a.png');
    assert.strictEqual(foundHashedSource.filepath, 'C:\\Users\\psyco\\Pictures\\source_portrait_a.png');

    console.log('[PASS] Isolated SQLite + FTS5 History Database tests passed');
  } finally {
    if (hdb && hdb.db && typeof hdb.db.close === 'function') {
      try { hdb.db.close(); } catch (e) {}
    }
    try { fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); } catch (e) {}
  }
}

async function runFormulaHealingTest() {
  const os = require('os');
  const { execFileSync } = require('child_process');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-heal-test-'));
  try {
    const wipedCache = {
      'bytedance/seedream-v5.5/edit': {
        base_price_micro: 28000,
        discount_rate: 95,
        formula: '',
        price_inputs: ['images', 'resolution'],
        variable_price: true,
        fetched_at: Date.now()
      },
      'wavespeed-ai/minimax-h3/reference-to-video': {
        base_price_micro: 300000,
        discount_rate: 50,
        formula: '',
        price_inputs: ['duration', 'reference_audios', 'reference_images', 'reference_videos', 'resolution'],
        variable_price: true,
        fetched_at: Date.now()
      }
    };
    fs.writeFileSync(path.join(tmpDir, 'pricing-formulas.json'), JSON.stringify(wipedCache, null, 2), 'utf8');
    execFileSync(process.execPath, ['-e', `require(${JSON.stringify(path.join(ROOT, 'server.js'))});`], {
      env: { ...process.env, WAVESPEED_USER_DATA_DIR: tmpDir, WAVESPEED_API_KEY: 'wsk_mock_heal_key' },
      stdio: 'pipe'
    });
    const healed = JSON.parse(fs.readFileSync(path.join(tmpDir, 'pricing-formulas.json'), 'utf8'));
    assert(healed['bytedance/seedream-v5.5/edit'].formula.includes('$count(images)'), 'Expected healed Seedream 5.5 Edit formula');
    assert(healed['wavespeed-ai/minimax-h3/reference-to-video'].formula.includes('$count(reference_images)'), 'Expected healed MiniMax H3 R2V formula');
    console.log('[PASS] Empty user-cache pricing-formulas.json self-healing test passed');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

(async () => {
  await runFormulaTests();
  await runFormulaHealingTest();
  await runMockDomAppTests();
  await runHistoryDatabaseTests();
  await runMockOutputAndServerTests();
  console.log('ALL_ISOLATED_TESTS_PASSED');
})().catch(err => {
  console.error('TEST_FAILED:', err);
  process.exit(1);
});
