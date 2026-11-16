const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

/**
 * Local SQLite + FTS5 History Database for WaveSpeed Studio.
 * Preserves original logs/generations.jsonl and outputs/metadata/*.json as authoritative
 * provenance while providing fast structured filtering, full-text prompt search,
 * failure tracking, favorites, notes, and CSV/JSON export.
 */
function createHistoryDatabase(options = {}) {
  const dbPath = options.dbPath;
  if (!dbPath) {
    throw new Error('createHistoryDatabase requires dbPath');
  }
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS generations (
      task_id TEXT PRIMARY KEY,
      model_id TEXT NOT NULL,
      model_name TEXT,
      category TEXT,
      status TEXT NOT NULL DEFAULT 'completed',
      error_message TEXT,
      prompt TEXT DEFAULT '',
      parameters_json TEXT DEFAULT '{}',
      input_image_url TEXT,
      input_video_url TEXT,
      resolution TEXT,
      duration REAL,
      aspect_ratio TEXT,
      size TEXT,
      quality TEXT,
      audio_enabled INTEGER,
      seed INTEGER,
      estimated_price REAL,
      is_video INTEGER DEFAULT 0,
      is_favorite INTEGER DEFAULT 0,
      notes TEXT DEFAULT '',
      remote_url TEXT,
      local_url TEXT,
      local_path TEXT,
      filename TEXT,
      size_bytes INTEGER,
      submitted_at TEXT,
      completed_at TEXT,
      source_provenance TEXT DEFAULT 'live_api',
      updated_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_generations_submitted ON generations(submitted_at DESC, completed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_generations_model ON generations(model_id);
    CREATE INDEX IF NOT EXISTS idx_generations_status ON generations(status);
    CREATE INDEX IF NOT EXISTS idx_generations_video ON generations(is_video);

    CREATE TABLE IF NOT EXISTS generation_outputs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL REFERENCES generations(task_id) ON DELETE CASCADE,
      output_index INTEGER DEFAULT 0,
      is_video INTEGER DEFAULT 0,
      remote_url TEXT,
      local_url TEXT,
      local_path TEXT,
      filename TEXT,
      size_bytes INTEGER,
      saved_at TEXT,
      UNIQUE(task_id, output_index)
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS generations_fts USING fts5(
      task_id UNINDEXED,
      model_id,
      prompt,
      error_message,
      notes
    );
  `);

  // Safe schema migration for existing SQLite databases (preserves all prior rows)
  try {
    const existingCols = new Set(db.prepare('PRAGMA table_info(generations)').all().map(c => c.name));
    if (!existingCols.has('input_sources_json')) {
      db.exec("ALTER TABLE generations ADD COLUMN input_sources_json TEXT DEFAULT '[]';");
    }
    if (!existingCols.has('input_filenames')) {
      db.exec("ALTER TABLE generations ADD COLUMN input_filenames TEXT DEFAULT '';");
    }
    if (!existingCols.has('input_filepaths')) {
      db.exec("ALTER TABLE generations ADD COLUMN input_filepaths TEXT DEFAULT '';");
    }
    if (!existingCols.has('pipeline_id')) {
      db.exec('ALTER TABLE generations ADD COLUMN pipeline_id TEXT DEFAULT NULL;');
    }
    if (!existingCols.has('pipeline_step')) {
      db.exec('ALTER TABLE generations ADD COLUMN pipeline_step INTEGER DEFAULT NULL;');
    }
    db.exec('CREATE INDEX IF NOT EXISTS idx_generations_pipeline ON generations(pipeline_id);');
  } catch (migErr) {
    console.warn('History DB column migration warning:', migErr.message);
  }

  function normalizeInputSources(inputSources = [], fallbackPayload = {}) {
    const clean = [];
    if (Array.isArray(inputSources)) {
      for (const s of inputSources) {
        if (!s || typeof s !== 'object') continue;
        clean.push({
          slot: s.slot ? String(s.slot) : 'input',
          filename: s.filename ? String(s.filename) : '',
          filepath: s.filepath ? String(s.filepath) : '',
          local_url: s.local_url ? String(s.local_url) : '',
          remote_url: s.remote_url ? String(s.remote_url) : '',
          size_bytes: Number.isFinite(Number(s.size_bytes)) ? Number(s.size_bytes) : null
        });
      }
    }
    if (clean.length === 0 && fallbackPayload && typeof fallbackPayload === 'object') {
      const addUrl = (slot, u) => {
        if (typeof u === 'string' && u.trim()) {
          let fname = '';
          try { fname = path.basename(u.split('?')[0]); } catch (e) {}
          clean.push({ slot, filename: fname, filepath: '', local_url: u.startsWith('/outputs/') ? u : '', remote_url: u.startsWith('http') ? u : '', size_bytes: null });
        }
      };
      addUrl('image', fallbackPayload.image || fallbackPayload.face_image || fallbackPayload.body_image);
      addUrl('last_image', fallbackPayload.last_image);
      if (Array.isArray(fallbackPayload.images)) fallbackPayload.images.forEach((u, i) => addUrl(`image_${i + 1}`, u));
      if (Array.isArray(fallbackPayload.reference_images)) fallbackPayload.reference_images.forEach((u, i) => addUrl(`ref_image_${i + 1}`, u));
      addUrl('video', fallbackPayload.video);
      if (Array.isArray(fallbackPayload.reference_videos)) fallbackPayload.reference_videos.forEach((u, i) => addUrl(`ref_video_${i + 1}`, u));
      if (Array.isArray(fallbackPayload.videos)) fallbackPayload.videos.forEach((u, i) => addUrl(`ref_video_${i + 1}`, u));
    }
    const filenames = Array.from(new Set(clean.map(x => x.filename).filter(Boolean))).join(', ');
    const filepaths = Array.from(new Set(clean.map(x => x.filepath || x.local_url || x.remote_url).filter(Boolean))).join(' | ');
    return {
      input_sources_json: JSON.stringify(clean),
      input_filenames: filenames,
      input_filepaths: filepaths
    };
  }

  function extractPayloadColumns(modelId, payload = {}, inputSources = []) {
    const p = (payload && typeof payload === 'object') ? payload : {};
    const srcInfo = normalizeInputSources(inputSources, p);
    const imgUrl = p.image || (Array.isArray(p.images) ? p.images[0] : null) || (Array.isArray(p.reference_images) ? p.reference_images[0] : null) || null;
    const vidUrl = p.video || (Array.isArray(p.videos) ? p.videos[0] : null) || (Array.isArray(p.reference_videos) ? p.reference_videos[0] : null) || null;
    let audioEnabled = null;
    if (p.generate_audio !== undefined) audioEnabled = p.generate_audio ? 1 : 0;
    else if (p.sound !== undefined) audioEnabled = p.sound ? 1 : 0;

    const mid = String(modelId || '').toLowerCase();
    const isVideoGuess = mid.includes('video') || mid.includes('i2v') || mid.includes('t2v') || mid.includes('v2v') ? 1 : 0;

    return {
      prompt: typeof p.prompt === 'string' ? p.prompt : '',
      parameters_json: JSON.stringify(p),
      input_sources_json: srcInfo.input_sources_json,
      input_filenames: srcInfo.input_filenames,
      input_filepaths: srcInfo.input_filepaths,
      input_image_url: typeof imgUrl === 'string' ? imgUrl : null,
      input_video_url: typeof vidUrl === 'string' ? vidUrl : null,
      resolution: p.resolution !== undefined ? String(p.resolution) : null,
      duration: (p.duration !== undefined && !Number.isNaN(Number(p.duration))) ? Number(p.duration) : null,
      aspect_ratio: p.aspect_ratio !== undefined ? String(p.aspect_ratio) : null,
      size: p.size !== undefined ? String(p.size) : null,
      quality: p.quality !== undefined ? String(p.quality) : null,
      audio_enabled: audioEnabled,
      seed: (p.seed !== undefined && !Number.isNaN(parseInt(p.seed, 10))) ? parseInt(p.seed, 10) : null,
      is_video_guess: isVideoGuess
    };
  }

  function syncFtsRow(taskId) {
    const row = db.prepare('SELECT task_id, model_id, prompt, error_message, notes, input_filenames FROM generations WHERE task_id = ?').get(taskId);
    db.prepare('DELETE FROM generations_fts WHERE task_id = ?').run(taskId);
    if (row) {
      const notesWithInputs = [row.notes || '', row.input_filenames || ''].filter(Boolean).join(' | ');
      db.prepare('INSERT INTO generations_fts (task_id, model_id, prompt, error_message, notes) VALUES (?, ?, ?, ?, ?)')
        .run(row.task_id, row.model_id || '', row.prompt || '', row.error_message || '', notesWithInputs);
    }
  }

  function recordSubmission(entry = {}) {
    const taskId = String(entry.task_id || '').trim();
    if (!taskId) return null;
    const modelId = String(entry.model_id || 'unknown');
    const cols = extractPayloadColumns(modelId, entry.payload || {}, entry.input_sources || []);
    const nowIso = new Date().toISOString();
    const submittedAt = entry.submitted_at || nowIso;

    const pipelineId = entry.pipeline_id ? String(entry.pipeline_id) : null;
    const pipelineStep = Number.isFinite(Number(entry.pipeline_step)) ? Number(entry.pipeline_step) : null;

    db.prepare(`
      INSERT INTO generations (
        task_id, model_id, model_name, category, status, prompt, parameters_json,
        input_sources_json, input_filenames, input_filepaths,
        input_image_url, input_video_url, resolution, duration, aspect_ratio, size,
        quality, audio_enabled, seed, estimated_price, is_video, submitted_at,
        pipeline_id, pipeline_step, source_provenance, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(task_id) DO UPDATE SET
        model_id = COALESCE(excluded.model_id, generations.model_id),
        model_name = COALESCE(excluded.model_name, generations.model_name),
        category = COALESCE(excluded.category, generations.category),
        prompt = CASE WHEN excluded.prompt != '' THEN excluded.prompt ELSE generations.prompt END,
        parameters_json = CASE WHEN excluded.parameters_json != '{}' THEN excluded.parameters_json ELSE generations.parameters_json END,
        input_sources_json = CASE WHEN excluded.input_sources_json != '[]' THEN excluded.input_sources_json ELSE generations.input_sources_json END,
        input_filenames = CASE WHEN excluded.input_filenames != '' THEN excluded.input_filenames ELSE generations.input_filenames END,
        input_filepaths = CASE WHEN excluded.input_filepaths != '' THEN excluded.input_filepaths ELSE generations.input_filepaths END,
        input_image_url = COALESCE(excluded.input_image_url, generations.input_image_url),
        input_video_url = COALESCE(excluded.input_video_url, generations.input_video_url),
        resolution = COALESCE(excluded.resolution, generations.resolution),
        duration = COALESCE(excluded.duration, generations.duration),
        aspect_ratio = COALESCE(excluded.aspect_ratio, generations.aspect_ratio),
        size = COALESCE(excluded.size, generations.size),
        quality = COALESCE(excluded.quality, generations.quality),
        audio_enabled = COALESCE(excluded.audio_enabled, generations.audio_enabled),
        seed = COALESCE(excluded.seed, generations.seed),
        estimated_price = COALESCE(excluded.estimated_price, generations.estimated_price),
        pipeline_id = COALESCE(excluded.pipeline_id, generations.pipeline_id),
        pipeline_step = COALESCE(excluded.pipeline_step, generations.pipeline_step),
        submitted_at = COALESCE(generations.submitted_at, excluded.submitted_at),
        updated_at = excluded.updated_at
    `).run(
      taskId,
      modelId,
      entry.model_name || null,
      entry.category || null,
      entry.status || 'submitted',
      cols.prompt,
      cols.parameters_json,
      cols.input_sources_json,
      cols.input_filenames,
      cols.input_filepaths,
      cols.input_image_url,
      cols.input_video_url,
      cols.resolution,
      cols.duration,
      cols.aspect_ratio,
      cols.size,
      cols.quality,
      cols.audio_enabled,
      cols.seed,
      entry.estimated_price ?? null,
      cols.is_video_guess,
      submittedAt,
      pipelineId,
      pipelineStep,
      entry.source_provenance || 'live_api',
      nowIso
    );

    syncFtsRow(taskId);
    return taskId;
  }

  function recordOutputs(entry = {}) {
    const taskId = String(entry.task_id || '').trim();
    if (!taskId) return null;
    const items = Array.isArray(entry.items) ? entry.items : [];
    const primary = items[0] || {};
    const modelId = String(entry.model_id || primary.model_id || 'unknown');
    const payload = entry.payload || primary.parameters || {};
    const inputSources = (Array.isArray(entry.input_sources) && entry.input_sources.length > 0)
      ? entry.input_sources
      : (Array.isArray(primary.input_sources) ? primary.input_sources : []);
    const cols = extractPayloadColumns(modelId, payload, inputSources);
    const nowIso = new Date().toISOString();
    const completedAt = entry.completed_at || primary.saved_at || nowIso;
    const promptVal = entry.prompt || primary.prompt || cols.prompt || '';
    const isVideoVal = primary.is_video !== undefined ? (primary.is_video ? 1 : 0) : cols.is_video_guess;
    const pipelineId = entry.pipeline_id ? String(entry.pipeline_id) : (primary.pipeline_id ? String(primary.pipeline_id) : null);
    const pipelineStepRaw = entry.pipeline_step ?? primary.pipeline_step ?? null;
    const pipelineStep = (pipelineStepRaw !== null && Number.isFinite(Number(pipelineStepRaw))) ? Number(pipelineStepRaw) : null;

    db.prepare(`
      INSERT INTO generations (
        task_id, model_id, model_name, category, status, error_message, prompt, parameters_json,
        input_sources_json, input_filenames, input_filepaths,
        input_image_url, input_video_url, resolution, duration, aspect_ratio, size,
        quality, audio_enabled, seed, estimated_price, is_video,
        remote_url, local_url, local_path, filename, size_bytes,
        submitted_at, completed_at, pipeline_id, pipeline_step, source_provenance, updated_at
      ) VALUES (?, ?, ?, ?, 'completed', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(task_id) DO UPDATE SET
        model_id = CASE WHEN excluded.model_id != 'unknown' THEN excluded.model_id ELSE generations.model_id END,
        model_name = COALESCE(excluded.model_name, generations.model_name),
        category = COALESCE(excluded.category, generations.category),
        status = 'completed',
        error_message = NULL,
        prompt = CASE WHEN excluded.prompt != '' THEN excluded.prompt ELSE generations.prompt END,
        parameters_json = CASE WHEN excluded.parameters_json != '{}' THEN excluded.parameters_json ELSE generations.parameters_json END,
        input_sources_json = CASE WHEN excluded.input_sources_json != '[]' AND (generations.input_sources_json IS NULL OR generations.input_sources_json = '[]' OR excluded.source_provenance = 'live_api') THEN excluded.input_sources_json ELSE generations.input_sources_json END,
        input_filenames = CASE WHEN excluded.input_filenames != '' AND (generations.input_filenames IS NULL OR generations.input_filenames = '' OR excluded.source_provenance = 'live_api') THEN excluded.input_filenames ELSE generations.input_filenames END,
        input_filepaths = CASE WHEN excluded.input_filepaths != '' AND (generations.input_filepaths IS NULL OR generations.input_filepaths = '' OR excluded.source_provenance = 'live_api') THEN excluded.input_filepaths ELSE generations.input_filepaths END,
        input_image_url = COALESCE(excluded.input_image_url, generations.input_image_url),
        input_video_url = COALESCE(excluded.input_video_url, generations.input_video_url),
        resolution = COALESCE(excluded.resolution, generations.resolution),
        duration = COALESCE(excluded.duration, generations.duration),
        aspect_ratio = COALESCE(excluded.aspect_ratio, generations.aspect_ratio),
        size = COALESCE(excluded.size, generations.size),
        quality = COALESCE(excluded.quality, generations.quality),
        audio_enabled = COALESCE(excluded.audio_enabled, generations.audio_enabled),
        seed = COALESCE(excluded.seed, generations.seed),
        estimated_price = COALESCE(excluded.estimated_price, generations.estimated_price),
        is_video = excluded.is_video,
        remote_url = COALESCE(excluded.remote_url, generations.remote_url),
        local_url = COALESCE(excluded.local_url, generations.local_url),
        local_path = COALESCE(excluded.local_path, generations.local_path),
        filename = COALESCE(excluded.filename, generations.filename),
        size_bytes = COALESCE(excluded.size_bytes, generations.size_bytes),
        completed_at = COALESCE(generations.completed_at, excluded.completed_at),
        pipeline_id = COALESCE(excluded.pipeline_id, generations.pipeline_id),
        pipeline_step = COALESCE(excluded.pipeline_step, generations.pipeline_step),
        updated_at = excluded.updated_at
    `).run(
      taskId,
      modelId,
      entry.model_name || null,
      entry.category || null,
      promptVal,
      cols.parameters_json,
      cols.input_sources_json,
      cols.input_filenames,
      cols.input_filepaths,
      cols.input_image_url,
      cols.input_video_url,
      cols.resolution,
      cols.duration,
      cols.aspect_ratio,
      cols.size,
      cols.quality,
      cols.audio_enabled,
      cols.seed,
      entry.estimated_price ?? primary.estimated_price ?? null,
      isVideoVal,
      primary.remote_url || null,
      primary.local_url || null,
      primary.local_path || null,
      primary.filename || null,
      primary.size_bytes ?? null,
      entry.submitted_at || completedAt,
      completedAt,
      pipelineId,
      pipelineStep,
      entry.source_provenance || 'live_api',
      nowIso
    );

    const insertOutStmt = db.prepare(`
      INSERT INTO generation_outputs (
        task_id, output_index, is_video, remote_url, local_url, local_path, filename, size_bytes, saved_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(task_id, output_index) DO UPDATE SET
        is_video = excluded.is_video,
        remote_url = COALESCE(excluded.remote_url, generation_outputs.remote_url),
        local_url = COALESCE(excluded.local_url, generation_outputs.local_url),
        local_path = COALESCE(excluded.local_path, generation_outputs.local_path),
        filename = COALESCE(excluded.filename, generation_outputs.filename),
        size_bytes = COALESCE(excluded.size_bytes, generation_outputs.size_bytes),
        saved_at = COALESCE(generation_outputs.saved_at, excluded.saved_at)
    `);
    items.forEach((it, idx) => {
      insertOutStmt.run(
        taskId,
        idx,
        it.is_video ? 1 : 0,
        it.remote_url || null,
        it.local_url || null,
        it.local_path || null,
        it.filename || null,
        it.size_bytes ?? null,
        it.saved_at || completedAt
      );
    });

    syncFtsRow(taskId);
    return taskId;
  }

  function recordTaskStatus({ task_id, status, error_message = null, model_id = null, payload = null, estimated_price = null }) {
    const taskId = String(task_id || '').trim();
    if (!taskId || !status) return false;
    const nowIso = new Date().toISOString();
    const existing = db.prepare('SELECT task_id FROM generations WHERE task_id = ?').get(taskId);
    if (!existing && model_id) {
      recordSubmission({ task_id: taskId, model_id, payload: payload || {}, estimated_price, status });
    }
    if (!existing && !model_id) {
      return false;
    }

    const isTerminal = ['completed', 'failed', 'cancelled', 'timeout'].includes(status);
    db.prepare(`
      UPDATE generations
      SET status = ?,
          error_message = COALESCE(?, error_message),
          completed_at = CASE WHEN ? = 1 THEN COALESCE(completed_at, ?) ELSE completed_at END,
          updated_at = ?
      WHERE task_id = ?
    `).run(status, error_message, isTerminal ? 1 : 0, nowIso, nowIso, taskId);

    syncFtsRow(taskId);
    return true;
  }

  function updateRunAnnotations({ task_id, is_favorite, notes }) {
    const taskId = String(task_id || '').trim();
    if (!taskId) return null;
    const existing = db.prepare('SELECT task_id, is_favorite, notes FROM generations WHERE task_id = ?').get(taskId);
    if (!existing) return null;
    const nextFav = is_favorite !== undefined ? (is_favorite ? 1 : 0) : existing.is_favorite;
    const nextNotes = notes !== undefined ? String(notes) : existing.notes;
    db.prepare('UPDATE generations SET is_favorite = ?, notes = ?, updated_at = ? WHERE task_id = ?')
      .run(nextFav, nextNotes, new Date().toISOString(), taskId);
    syncFtsRow(taskId);
    return { task_id: taskId, is_favorite: Boolean(nextFav), notes: nextNotes };
  }

  function buildFtsMatchQuery(rawQuery) {
    const cleaned = String(rawQuery || '').replace(/["'*():^{}\[\]\\/+\-~]/g, ' ').trim();
    const tokens = cleaned.split(/\s+/).filter(Boolean).slice(0, 8);
    if (tokens.length === 0) return null;
    return tokens.map(t => `"${t}"*`).join(' AND ');
  }

  function buildWhereClause(filters = {}) {
    const where = [];
    const params = [];

    if (filters.q && String(filters.q).trim()) {
      const ftsQ = buildFtsMatchQuery(filters.q);
      if (ftsQ) {
        where.push('g.task_id IN (SELECT task_id FROM generations_fts WHERE generations_fts MATCH ?)');
        params.push(ftsQ);
      } else {
        const like = `%${String(filters.q).trim()}%`;
        where.push('(g.prompt LIKE ? OR g.model_id LIKE ? OR g.error_message LIKE ? OR g.notes LIKE ?)');
        params.push(like, like, like, like);
      }
    }
    if (filters.model && filters.model !== 'all') {
      where.push('g.model_id = ?');
      params.push(String(filters.model));
    }
    if (filters.status && filters.status !== 'all') {
      if (filters.status === 'failed_group') {
        where.push("g.status IN ('failed', 'cancelled', 'timeout', 'logged_uncompleted')");
      } else {
        where.push('g.status = ?');
        params.push(String(filters.status));
      }
    }
    if (filters.type && filters.type !== 'all') {
      where.push('g.is_video = ?');
      params.push(filters.type === 'video' ? 1 : 0);
    }
    if (filters.favorite === '1' || filters.favorite === 'true' || filters.favorite === true) {
      where.push('g.is_favorite = 1');
    }

    return {
      clause: where.length ? `WHERE ${where.join(' AND ')}` : '',
      params
    };
  }

  function queryHistory(filters = {}) {
    const limit = Math.min(500, Math.max(1, parseInt(filters.limit || '150', 10) || 150));
    const offset = Math.max(0, parseInt(filters.offset || '0', 10) || 0);
    const { clause, params } = buildWhereClause(filters);

    const rows = db.prepare(`
      SELECT g.*,
        (SELECT COUNT(*) FROM generation_outputs o WHERE o.task_id = g.task_id) AS output_count
      FROM generations g
      ${clause}
      ORDER BY COALESCE(g.completed_at, g.submitted_at, g.updated_at) DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    const items = rows.map(r => {
      let parameters = {};
      let input_sources = [];
      try { parameters = r.parameters_json ? JSON.parse(r.parameters_json) : {}; } catch (e) {}
      try {
        const parsedSrc = r.input_sources_json ? JSON.parse(r.input_sources_json) : [];
        if (Array.isArray(parsedSrc)) input_sources = parsedSrc;
      } catch (e) {}
      const fileExists = Boolean(r.local_path && fs.existsSync(r.local_path));
      return {
        ...r,
        is_video: Boolean(r.is_video),
        is_favorite: Boolean(r.is_favorite),
        audio_enabled: r.audio_enabled === null ? null : Boolean(r.audio_enabled),
        file_exists: fileExists,
        parameters,
        input_sources
      };
    });

    const statsRow = db.prepare(`
      SELECT
        COUNT(*) AS total_runs,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_runs,
        SUM(CASE WHEN status IN ('failed', 'cancelled', 'timeout', 'logged_uncompleted') THEN 1 ELSE 0 END) AS failed_runs,
        SUM(CASE WHEN is_favorite = 1 AND status = 'completed' THEN 1 ELSE 0 END) AS favorited_runs,
        SUM(CASE WHEN is_video = 1 AND status = 'completed' THEN 1 ELSE 0 END) AS total_videos,
        SUM(CASE WHEN is_video = 0 AND status = 'completed' THEN 1 ELSE 0 END) AS total_images,
        SUM(CASE WHEN status = 'completed' THEN COALESCE(estimated_price, 0) ELSE 0 END) AS completed_spend,
        SUM(CASE WHEN is_favorite = 1 AND status = 'completed' THEN COALESCE(estimated_price, 0) ELSE 0 END) AS favorited_spend,
        SUM(COALESCE(estimated_price, 0)) AS total_submitted_spend,
        COUNT(DISTINCT model_id) AS distinct_models
      FROM generations
    `).get();

    const modelRows = db.prepare(`
      SELECT
        model_id,
        COUNT(*) AS run_count,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
        SUM(CASE WHEN status IN ('failed', 'cancelled', 'timeout', 'logged_uncompleted') THEN 1 ELSE 0 END) AS failed_count
      FROM generations
      GROUP BY model_id
      ORDER BY run_count DESC, model_id ASC
    `).all();

    const completedSpend = Number((statsRow?.completed_spend || 0).toFixed(4));
    const favoritedRuns = Number(statsRow?.favorited_runs || 0);
    return {
      db_path: dbPath,
      stats: {
        total_runs: Number(statsRow?.total_runs || 0),
        completed_runs: Number(statsRow?.completed_runs || 0),
        failed_runs: Number(statsRow?.failed_runs || 0),
        favorited_runs: favoritedRuns,
        total_videos: Number(statsRow?.total_videos || 0),
        total_images: Number(statsRow?.total_images || 0),
        completed_spend: completedSpend,
        favorited_spend: Number((statsRow?.favorited_spend || 0).toFixed(4)),
        cost_per_favorite: favoritedRuns > 0 ? Number((completedSpend / favoritedRuns).toFixed(4)) : null,
        total_submitted_spend: Number((statsRow?.total_submitted_spend || 0).toFixed(4)),
        distinct_models: Number(statsRow?.distinct_models || 0)
      },
      models: modelRows.map(m => ({ ...m })),
      items
    };
  }

  function exportCsv(filters = {}) {
    const res = queryHistory({ ...filters, limit: 5000, offset: 0 });
    const cols = [
      'task_id', 'status', 'model_id', 'pipeline_id', 'pipeline_step', 'is_video', 'resolution', 'duration',
      'aspect_ratio', 'size', 'quality', 'audio_enabled', 'estimated_price',
      'prompt', 'error_message', 'input_filenames', 'input_filepaths', 'input_image_url', 'input_video_url',
      'local_path', 'remote_url', 'is_favorite', 'submitted_at', 'completed_at', 'source_provenance'
    ];
    const esc = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v).replace(/\r?\n/g, ' ');
      return (s.includes(',') || s.includes('"')) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [cols.join(',')];
    for (const row of res.items) {
      lines.push(cols.map(c => esc(row[c])).join(','));
    }
    return lines.join('\r\n');
  }

  function syncFromExistingFiles() {
    let importedMetadata = 0;
    let importedJsonl = 0;
    let importedLogSubmits = 0;
    let importedOrphans = 0;

    // 1. Authoritative outputs/metadata/*.json
    if (options.outputsMetaDir && fs.existsSync(options.outputsMetaDir)) {
      const files = fs.readdirSync(options.outputsMetaDir).filter(f => f.endsWith('.json'));
      for (const f of files) {
        try {
          const parsed = JSON.parse(fs.readFileSync(path.join(options.outputsMetaDir, f), 'utf8'));
          if (!parsed || !parsed.task_id) continue;
          if (String(parsed.model_id || '').startsWith('mock/')) continue;
          recordOutputs({
            task_id: parsed.task_id,
            model_id: parsed.model_id,
            prompt: parsed.prompt,
            payload: parsed.parameters,
            input_sources: parsed.input_sources || [],
            estimated_price: parsed.estimated_price,
            completed_at: parsed.saved_at,
            source_provenance: 'metadata_json',
            items: [parsed]
          });
          importedMetadata++;
        } catch (e) {}
      }
    }

    // 2. Append-only logs/generations.jsonl
    if (options.generationsLogFile && fs.existsSync(options.generationsLogFile)) {
      const lines = fs.readFileSync(options.generationsLogFile, 'utf8').split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (!parsed || !parsed.task_id) continue;
          if (String(parsed.model_id || '').startsWith('mock/')) continue;
          recordOutputs({
            task_id: parsed.task_id,
            model_id: parsed.model_id,
            prompt: parsed.prompt,
            payload: parsed.parameters,
            input_sources: parsed.input_sources || [],
            estimated_price: parsed.estimated_price,
            completed_at: parsed.saved_at,
            source_provenance: 'generations_jsonl',
            items: [parsed]
          });
          importedJsonl++;
        } catch (e) {}
      }
    }

    // 3. Recover uncompleted/failed historical submissions from logs/server.log without duplicating matched completed runs
    if (options.serverLogFile && fs.existsSync(options.serverLogFile)) {
      const existingCompleted = db.prepare("SELECT model_id, prompt, submitted_at, completed_at FROM generations WHERE status = 'completed'").all();
      const lines = fs.readFileSync(options.serverLogFile, 'utf8').split(/\r?\n/);
      for (const line of lines) {
        const m = line.match(/^\[([^\]]+)\]\s+\[INFO\]\s+Submitting generation task to\s+(\S+)\s+\|\s+(\{.+\})$/);
        if (!m) continue;
        const tsIso = m[1];
        const modelId = m[2];
        if (modelId.startsWith('mock/')) continue;
        try {
          const meta = JSON.parse(m[3]);
          const payload = meta.payload || {};
          const prompt = typeof payload.prompt === 'string' ? payload.prompt : '';
          const tsMs = Date.parse(tsIso);
          const matched = existingCompleted.some(c => {
            if (c.model_id !== modelId || (c.prompt || '') !== prompt) return false;
            const cMs = Date.parse(c.completed_at || c.submitted_at || '');
            return Number.isFinite(tsMs) && Number.isFinite(cMs) && Math.abs(cMs - tsMs) <= 15 * 60 * 1000;
          });
          if (matched) continue;

          const hash = crypto.createHash('sha1').update(`${tsIso}|${modelId}|${prompt}`).digest('hex').slice(0, 12);
          const synthId = `log-${hash}`;
          recordSubmission({
            task_id: synthId,
            model_id: modelId,
            payload,
            input_sources: Array.isArray(meta.input_sources) ? meta.input_sources : [],
            estimated_price: meta.estimated_price ?? null,
            submitted_at: tsIso,
            status: 'logged_uncompleted',
            source_provenance: 'server_log'
          });
          importedLogSubmits++;
        } catch (e) {}
      }
    }

    // 4. Scan orphaned files in outputs/images and outputs/videos not present in DB
    const mediaDirs = [
      { dir: options.outputsVideosDir, isVideo: true, sub: 'videos' },
      { dir: options.outputsImagesDir, isVideo: false, sub: 'images' }
    ];
    for (const d of mediaDirs) {
      if (!d.dir || !fs.existsSync(d.dir)) continue;
      for (const fname of fs.readdirSync(d.dir)) {
        const full = path.join(d.dir, fname);
        try {
          const st = fs.statSync(full);
          if (!st.isFile()) continue;
          const existsInDb = db.prepare('SELECT 1 FROM generations WHERE local_path = ? OR filename = ?').get(full, fname);
          if (existsInDb) continue;
          const orphanId = `file-${crypto.createHash('sha1').update(full).digest('hex').slice(0, 12)}`;
          recordOutputs({
            task_id: orphanId,
            model_id: 'unknown/local-file',
            source_provenance: 'orphan_scan',
            completed_at: st.mtime.toISOString(),
            items: [{
              task_id: orphanId,
              model_id: 'unknown/local-file',
              is_video: d.isVideo,
              local_url: `/outputs/${d.sub}/${fname}`,
              local_path: full,
              filename: fname,
              size_bytes: st.size,
              saved_at: st.mtime.toISOString()
            }]
          });
          importedOrphans++;
        } catch (e) {}
      }
    }

    return { importedMetadata, importedJsonl, importedLogSubmits, importedOrphans };
  }

  function deleteRun(target) {
    const taskIdArg = typeof target === 'string' ? target : target?.task_id;
    const localPathArg = typeof target === 'object' ? target?.local_path : null;
    const localUrlArg = typeof target === 'object' ? target?.local_url : null;

    let resolvedTaskIds = [];
    if (taskIdArg) {
      resolvedTaskIds.push(String(taskIdArg));
    }
    if (localPathArg) {
      const rows = db.prepare('SELECT task_id FROM generations WHERE local_path = ?').all(String(localPathArg));
      rows.forEach(r => resolvedTaskIds.push(r.task_id));
      db.prepare('DELETE FROM generation_outputs WHERE local_path = ?').run(String(localPathArg));
    }
    if (localUrlArg) {
      const rows = db.prepare('SELECT task_id FROM generations WHERE local_url = ?').all(String(localUrlArg));
      rows.forEach(r => resolvedTaskIds.push(r.task_id));
      db.prepare('DELETE FROM generation_outputs WHERE local_url = ?').run(String(localUrlArg));
    }

    resolvedTaskIds = Array.from(new Set(resolvedTaskIds.filter(Boolean)));
    let changes = 0;
    for (const id of resolvedTaskIds) {
      db.prepare('DELETE FROM generations_fts WHERE task_id = ?').run(id);
      db.prepare('DELETE FROM generation_outputs WHERE task_id = ?').run(id);
      const info = db.prepare('DELETE FROM generations WHERE task_id = ?').run(id);
      changes += Number(info?.changes || 0);
    }
    return { deleted: changes > 0, changes, task_ids: resolvedTaskIds };
  }

  function setOutputsDirs(nextDirs = {}) {
    if (nextDirs.outputsMetaDir) options.outputsMetaDir = nextDirs.outputsMetaDir;
    if (nextDirs.outputsImagesDir) options.outputsImagesDir = nextDirs.outputsImagesDir;
    if (nextDirs.outputsVideosDir) options.outputsVideosDir = nextDirs.outputsVideosDir;
  }

  function close() {
    try {
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
      db.close();
    } catch (e) {}
  }

  return {
    db,
    dbPath,
    setOutputsDirs,
    close,
    recordSubmission,
    recordOutputs,
    recordTaskStatus,
    updateRunAnnotations,
    deleteRun,
    queryHistory,
    exportCsv,
    syncFromExistingFiles
  };
}

module.exports = { createHistoryDatabase };
