/**
 * Non-destructive migration helper: copies saved outputs (images/videos/metadata)
 * and merges SQLite history + logs from an older studio directory into your external
 * AppData + configured Outputs folder without touching source originals or the git repo.
 *
 * Usage:
 *   node scripts/import_legacy_studio.js --from "<legacy_dir>" --to-data "<appdata_dir>" --to-outputs "<outputs_dir>" [--dry-run]
 */
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { createHistoryDatabase } = require('../database/history_db');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--from') args.from = argv[++i];
    else if (a === '--to-data') args.toData = argv[++i];
    else if (a === '--to-outputs') args.toOutputs = argv[++i];
  }
  return args;
}

function defaultAppDataDir() {
  if (process.env.APPDATA) return path.join(process.env.APPDATA, 'wavespeed-studio');
  return path.resolve(__dirname, '..');
}

function remapLocalPath(oldPath, fromOutputs, toOutputs) {
  if (!oldPath || typeof oldPath !== 'string') return oldPath;
  const rel = path.relative(path.resolve(fromOutputs), path.resolve(oldPath));
  if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) {
    return path.join(path.resolve(toOutputs), rel);
  }
  return oldPath;
}

function copyTreeNonDestructive(srcDir, dstDir, fromOutputs, toOutputs, rewriteMetaJson, dryRun) {
  let copied = 0;
  let skipped = 0;
  if (!fs.existsSync(srcDir)) return { copied, skipped };
  if (!dryRun) fs.mkdirSync(dstDir, { recursive: true });
  for (const name of fs.readdirSync(srcDir)) {
    const src = path.join(srcDir, name);
    const dst = path.join(dstDir, name);
    if (!fs.statSync(src).isFile()) continue;
    if (fs.existsSync(dst)) {
      skipped++;
      continue;
    }
    if (!dryRun) {
      if (rewriteMetaJson && name.endsWith('.json')) {
        try {
          const parsed = JSON.parse(fs.readFileSync(src, 'utf8'));
          if (parsed.local_path) parsed.local_path = remapLocalPath(parsed.local_path, fromOutputs, toOutputs);
          if (Array.isArray(parsed.local_outputs)) {
            parsed.local_outputs = parsed.local_outputs.map(item => ({
              ...item,
              local_path: remapLocalPath(item.local_path, fromOutputs, toOutputs)
            }));
          }
          fs.writeFileSync(dst, JSON.stringify(parsed, null, 2), 'utf8');
        } catch {
          fs.copyFileSync(src, dst);
        }
      } else {
        fs.copyFileSync(src, dst);
      }
    }
    copied++;
  }
  return { copied, skipped };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.from) {
    console.error('Missing --from <legacy_studio_dir>');
    process.exit(1);
  }

  const fromRoot = path.resolve(opts.from);
  const fromOutputs = path.join(fromRoot, 'outputs');
  const fromDbPath = path.join(fromRoot, 'database', 'studio_history.sqlite');

  const toDataDir = path.resolve(opts.toData || defaultAppDataDir());
  const cfgPath = path.join(toDataDir, '.studio-config.json');
  let configuredOut = null;
  if (fs.existsSync(cfgPath)) {
    try { configuredOut = JSON.parse(fs.readFileSync(cfgPath, 'utf8')).outputsDir || null; } catch {}
  }
  const toOutputs = path.resolve(opts.toOutputs || configuredOut || path.join(toDataDir, 'outputs'));
  const toDbPath = path.join(toDataDir, 'database', 'studio_history.sqlite');

  console.log('Migration Plan:');
  console.log('  From root:  ', fromRoot);
  console.log('  To data dir:', toDataDir);
  console.log('  To outputs: ', toOutputs);
  console.log('  Dry run:    ', Boolean(opts.dryRun));

  const copySummary = {};
  for (const sub of ['images', 'videos', 'metadata']) {
    copySummary[sub] = copyTreeNonDestructive(
      path.join(fromOutputs, sub),
      path.join(toOutputs, sub),
      fromOutputs,
      toOutputs,
      sub === 'metadata',
      Boolean(opts.dryRun)
    );
  }
  console.log('File copy summary:', JSON.stringify(copySummary));

  if (!fs.existsSync(fromDbPath)) {
    console.log('No legacy SQLite DB found at', fromDbPath);
    return;
  }

  const srcDb = new DatabaseSync(fromDbPath, { readOnly: true });
  const srcGens = srcDb.prepare('SELECT * FROM generations').all();
  const srcOuts = srcDb.prepare('SELECT * FROM generation_outputs').all();
  srcDb.close();

  if (opts.dryRun) {
    console.log(`[DRY RUN] Would merge up to ${srcGens.length} generations and ${srcOuts.length} output rows into ${toDbPath}`);
    return;
  }

  const dstHist = createHistoryDatabase({
    dbPath: toDbPath,
    outputsMetaDir: path.join(toOutputs, 'metadata'),
    outputsImagesDir: path.join(toOutputs, 'images'),
    outputsVideosDir: path.join(toOutputs, 'videos')
  });
  const dstDb = dstHist.db;

  let insertedGens = 0;
  let insertedOuts = 0;
  const insertGen = dstDb.prepare(`
    INSERT OR IGNORE INTO generations (
      task_id, model_id, model_name, category, status, error_message, prompt, parameters_json,
      input_image_url, input_video_url, resolution, duration, aspect_ratio, size, quality,
      audio_enabled, seed, estimated_price, is_video, is_favorite, notes, remote_url,
      local_url, local_path, filename, size_bytes, submitted_at, completed_at, source_provenance, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertFts = dstDb.prepare(
    'INSERT INTO generations_fts (task_id, model_id, prompt, error_message, notes) VALUES (?, ?, ?, ?, ?)'
  );
  const existsFts = dstDb.prepare('SELECT COUNT(*) c FROM generations_fts WHERE task_id = ?');
  const insertOut = dstDb.prepare(`
    INSERT OR IGNORE INTO generation_outputs (
      task_id, output_index, is_video, remote_url, local_url, local_path, filename, size_bytes, saved_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  dstDb.exec('BEGIN;');
  try {
    for (const g of srcGens) {
      const remappedPath = remapLocalPath(g.local_path, fromOutputs, toOutputs);
      const res = insertGen.run(
        g.task_id, g.model_id, g.model_name, g.category, g.status, g.error_message, g.prompt, g.parameters_json,
        g.input_image_url, g.input_video_url, g.resolution, g.duration, g.aspect_ratio, g.size, g.quality,
        g.audio_enabled, g.seed, g.estimated_price, g.is_video, g.is_favorite, g.notes, g.remote_url,
        g.local_url, remappedPath, g.filename, g.size_bytes, g.submitted_at, g.completed_at,
        g.source_provenance || 'legacy_import', g.updated_at || new Date().toISOString()
      );
      if (res.changes > 0) {
        insertedGens++;
        if (existsFts.get(g.task_id).c === 0) {
          insertFts.run(g.task_id, g.model_id || '', g.prompt || '', g.error_message || '', g.notes || '');
        }
      }
    }
    for (const o of srcOuts) {
      const remappedOutPath = remapLocalPath(o.local_path, fromOutputs, toOutputs);
      const res = insertOut.run(
        o.task_id, o.output_index, o.is_video, o.remote_url, o.local_url,
        remappedOutPath, o.filename, o.size_bytes, o.saved_at
      );
      if (res.changes > 0) insertedOuts++;
    }
    dstDb.exec('COMMIT;');
  } catch (err) {
    dstDb.exec('ROLLBACK;');
    dstDb.close();
    throw err;
  }

  const totalGens = dstDb.prepare('SELECT COUNT(*) c FROM generations').get().c;
  const totalOuts = dstDb.prepare('SELECT COUNT(*) c FROM generation_outputs').get().c;
  dstDb.close();
  console.log(`Merged ${insertedGens} generations & ${insertedOuts} output rows. Unified totals: ${totalGens} generations, ${totalOuts} output rows.`);
}

main();
