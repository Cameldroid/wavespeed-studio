#!/usr/bin/env node
/**
 * scripts/generate_icon.js
 *
 * Pure Node.js icon generator (fs, path, zlib - zero npm packages).
 * Generates:
 *   - assets/icon.png: 256x256 dark indigo/slate rounded square (#0f172a)
 *     with a vibrant violet-to-cyan (#8b5cf6 -> #06b6d4) glowing wave-prism / spark mark.
 *   - assets/icon.ico: Standard Windows ICO containing 16x16, 32x32, 48x48,
 *     and 256x256 PNG-encoded frames.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// --- CRC32 calculation ---
const calcCrc32 = (typeof zlib.crc32 === 'function')
  ? (buf) => zlib.crc32(buf)
  : (function () {
      let table;
      return function (buf) {
        if (!table) {
          table = new Uint32Array(256);
          for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) {
              c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
            }
            table[n] = c >>> 0;
          }
        }
        let c = 0xffffffff;
        for (let i = 0; i < buf.length; i++) {
          c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
        }
        return (c ^ 0xffffffff) >>> 0;
      };
    })();

// --- PNG Generation ---
function makeChunk(type, data) {
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const typeAndData = Buffer.concat([typeBuf, data]);
  const crcVal = calcCrc32(typeAndData);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal >>> 0, 0);
  return Buffer.concat([lenBuf, typeAndData, crcBuf]);
}

function encodePNG(rgbaBuffer, width, height) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk
  const ihdrBuf = Buffer.alloc(13);
  ihdrBuf.writeUInt32BE(width, 0);
  ihdrBuf.writeUInt32BE(height, 4);
  ihdrBuf[8] = 8;  // bit depth: 8
  ihdrBuf[9] = 6;  // color type: RGBA (6)
  ihdrBuf[10] = 0; // deflate
  ihdrBuf[11] = 0; // filter method 0
  ihdrBuf[12] = 0; // no interlace
  const ihdr = makeChunk('IHDR', ihdrBuf);

  // Scanlines with filter byte 0 (None)
  const scanlineLength = 1 + width * 4;
  const rawData = Buffer.alloc(height * scanlineLength);
  for (let y = 0; y < height; y++) {
    const rawOffset = y * scanlineLength;
    rawData[rawOffset] = 0; // Filter None
    const srcOffset = y * width * 4;
    rgbaBuffer.copy(rawData, rawOffset + 1, srcOffset, srcOffset + width * 4);
  }

  const idat = makeChunk('IDAT', zlib.deflateSync(rawData, { level: 9 }));
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

// --- Windows ICO Generation (PNG-in-ICO) ---
function encodeICO(pngImages) {
  // pngImages: array of { width, height, buffer }
  const count = pngImages.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);     // Reserved
  header.writeUInt16LE(1, 2);     // Type 1 = Icon
  header.writeUInt16LE(count, 4); // Count of images

  const entrySize = 16;
  const entries = Buffer.alloc(count * entrySize);
  let currentOffset = 6 + count * entrySize;

  for (let i = 0; i < count; i++) {
    const img = pngImages[i];
    const off = i * entrySize;
    // For 256, width and height byte are set to 0 per ICO specification
    entries[off + 0] = img.width >= 256 ? 0 : img.width;
    entries[off + 1] = img.height >= 256 ? 0 : img.height;
    entries[off + 2] = 0;  // Color count (0 for 32bpp)
    entries[off + 3] = 0;  // Reserved
    entries.writeUInt16LE(1, off + 4);  // Color planes
    entries.writeUInt16LE(32, off + 6); // Bits per pixel
    entries.writeUInt32LE(img.buffer.length, off + 8);
    entries.writeUInt32LE(currentOffset, off + 12);
    currentOffset += img.buffer.length;
  }

  return Buffer.concat([header, entries, ...pngImages.map(img => img.buffer)]);
}

// --- Icon Drawing Math & Continuous Sampling ---
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// Signed distance to rounded rectangle
function sdRoundedBox(px, py, cx, cy, rx, ry, r) {
  const dx = Math.abs(px - cx) - (rx - r);
  const dy = Math.abs(py - cy) - (ry - r);
  const ax = Math.max(dx, 0);
  const ay = Math.max(dy, 0);
  const inside = Math.min(Math.max(dx, dy), 0);
  return Math.sqrt(ax * ax + ay * ay) + inside - r;
}

// 4-pointed astroid / geometric spark SDF
function evalSpark(cx, cy, wx, wy, px, py) {
  const dx = Math.abs(px - cx);
  const dy = Math.abs(py - cy);
  if (dx > wx || dy > wy) return null;
  const sx = dx / wx;
  const sy = dy / wy;
  const d = Math.pow(sx, 0.55) + Math.pow(sy, 0.55) - 1.0;
  if (d > 0.08) return null;
  const dist = d * Math.min(wx, wy);
  const alpha = clamp(0.5 - dist, 0, 1);
  return { alpha, dx, dy };
}

// Sample continuous (x, y) on 256x256 icon canvas
function sampleIcon(x, y) {
  // Outer rounded box: center (128, 128), half-width/height 112, radius 44 (16px margin)
  const d_box = sdRoundedBox(x, y, 128, 128, 112, 112, 44);
  if (d_box > 1.0) {
    return [0, 0, 0, 0];
  }
  const box_alpha = clamp(0.5 - d_box, 0, 1);

  // Background slate: centered on #0f172a (15, 23, 42) with elegant subtle gradient
  const t_bg = clamp((y - 16) / 224, 0, 1);
  let r = 20 * (1 - t_bg) + 10 * t_bg;
  let g = 30 * (1 - t_bg) + 16 * t_bg;
  let b = 58 * (1 - t_bg) + 32 * t_bg;

  // Inner border highlight (subtle sleek edge)
  if (d_box >= -2.5 && d_box <= 0) {
    const rim = 1 - Math.abs(d_box + 1.25) / 1.25;
    r = r * (1 - 0.25 * rim) + 56 * 0.25 * rim;
    g = g * (1 - 0.25 * rim) + 189 * 0.25 * rim;
    b = b * (1 - 0.25 * rim) + 248 * 0.25 * rim;
  }

  // Radiant studio ambient glow centered behind the mark
  const d_center = Math.hypot(x - 128, y - 128);
  const glow_raw = Math.exp(-(d_center * d_center) / (2 * 68 * 68));
  if (glow_raw > 0.005) {
    // Diagonal gradient: violet (#8b5cf6) at bottom-left to cyan (#06b6d4) at top-right
    const t_glow = clamp(((x - 128) - (y - 128) + 80) / 160, 0, 1);
    const gr = 139 * (1 - t_glow) + 6 * t_glow;
    const gg = 92 * (1 - t_glow) + 182 * t_glow;
    const gb = 246 * (1 - t_glow) + 212 * t_glow;
    const ga = glow_raw * 0.48;
    r = r * (1 - ga) + gr * ga;
    g = g * (1 - ga) + gg * ga;
    b = b * (1 - ga) + gb * ga;
  }

  // Wave 1: Primary dynamic wave ribbon
  if (x >= 40 && x <= 216) {
    const yw1 = 136 - 34 * Math.sin((x - 40) / 176 * Math.PI) - (x - 128) * 0.20;
    const hw1 = 13 + 6 * Math.sin((x - 40) / 176 * Math.PI);
    const dw1 = Math.abs(y - yw1) - hw1;
    if (dw1 < 1.5) {
      const w1_a = clamp(0.5 - dw1, 0, 1);
      const tw1 = clamp((x - 40) / 176, 0, 1);
      // Violet (#8b5cf6: 139, 92, 246) -> Cyan (#06b6d4: 6, 182, 212)
      let wr = 139 * (1 - tw1) + 6 * tw1;
      let wg = 92 * (1 - tw1) + 182 * tw1;
      let wb = 246 * (1 - tw1) + 212 * tw1;
      // Core glowing spine
      const spine = Math.exp(-(y - yw1) * (y - yw1) / (2 * 4 * 4));
      wr = wr + (255 - wr) * spine * 0.55;
      wg = wg + (255 - wg) * spine * 0.55;
      wb = wb + (255 - wb) * spine * 0.55;

      const alpha_blend = w1_a * 0.92;
      r = r * (1 - alpha_blend) + wr * alpha_blend;
      g = g * (1 - alpha_blend) + wg * alpha_blend;
      b = b * (1 - alpha_blend) + wb * alpha_blend;
    }
  }

  // Wave 2: Secondary lower prism ribbon
  if (x >= 56 && x <= 200) {
    const yw2 = 158 - 24 * Math.sin((x - 56) / 144 * Math.PI) - (x - 128) * 0.16;
    const hw2 = 7 + 4 * Math.sin((x - 56) / 144 * Math.PI);
    const dw2 = Math.abs(y - yw2) - hw2;
    if (dw2 < 1.5) {
      const w2_a = clamp(0.5 - dw2, 0, 1);
      const tw2 = clamp((x - 56) / 144, 0, 1);
      const wr = 124 * (1 - tw2) + 20 * tw2;
      const wg = 58 * (1 - tw2) + 184 * tw2;
      const wb = 237 * (1 - tw2) + 166 * tw2;
      const alpha_blend = w2_a * 0.78;
      r = r * (1 - alpha_blend) + wr * alpha_blend;
      g = g * (1 - alpha_blend) + wg * alpha_blend;
      b = b * (1 - alpha_blend) + wb * alpha_blend;
    }
  }

  // Central 4-pointed Spark / Prism Star
  const spark1 = evalSpark(128, 126, 44, 56, x, y);
  if (spark1 && spark1.alpha > 0) {
    const isRight = x >= 128;
    const isBottom = y >= 126;
    let sr, sg, sb;
    if (isRight && !isBottom) {
      // Top-right facet: brilliant cyan / electric teal (#22d3ee)
      sr = 34; sg = 211; sb = 238;
    } else if (!isRight && !isBottom) {
      // Top-left facet: indigo-violet (#818cf8)
      sr = 129; sg = 140; sb = 248;
    } else if (!isRight && isBottom) {
      // Bottom-left facet: vibrant violet (#8b5cf6)
      sr = 139; sg = 92; sb = 246;
    } else {
      // Bottom-right facet: electric purple (#a855f7)
      sr = 168; sg = 85; sb = 247;
    }

    // Glowing core star
    const coreDist = Math.hypot(spark1.dx / 18, spark1.dy / 22);
    const core = Math.exp(-coreDist * coreDist * 2);
    sr = sr * (1 - core) + 245 * core;
    sg = sg * (1 - core) + 252 * core;
    sb = sb * (1 - core) + 255 * core;

    const sa = spark1.alpha * 0.98;
    r = r * (1 - sa) + sr * sa;
    g = g * (1 - sa) + sg * sa;
    b = b * (1 - sa) + sb * sa;
  }

  // Accent Spark 2 (Upper right spark at 184, 74)
  const spark2 = evalSpark(184, 74, 14, 18, x, y);
  if (spark2 && spark2.alpha > 0) {
    const sa = spark2.alpha * 0.92;
    r = r * (1 - sa) + 34 * sa;
    g = g * (1 - sa) + 211 * sa;
    b = b * (1 - sa) + 238 * sa;
  }

  // Accent Spark 3 (Lower left spark at 72, 178)
  const spark3 = evalSpark(72, 178, 11, 14, x, y);
  if (spark3 && spark3.alpha > 0) {
    const sa = spark3.alpha * 0.88;
    r = r * (1 - sa) + 168 * sa;
    g = g * (1 - sa) + 85 * sa;
    b = b * (1 - sa) + 247 * sa;
  }

  return [r, g, b, box_alpha * 255];
}

// Render icon at specified size with subpixel anti-aliasing
function renderIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  const samplesPerDim = size <= 48 ? 4 : 2;
  const numSamples = samplesPerDim * samplesPerDim;
  const scale = 256 / size;

  let offset = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let tr = 0, tg = 0, tb = 0, ta = 0;
      for (let sy = 0; sy < samplesPerDim; sy++) {
        const py = (y + (sy + 0.5) / samplesPerDim) * scale;
        for (let sx = 0; sx < samplesPerDim; sx++) {
          const px = (x + (sx + 0.5) / samplesPerDim) * scale;
          const [sr, sg, sb, sa] = sampleIcon(px, py);
          tr += sr; tg += sg; tb += sb; ta += sa;
        }
      }
      buf[offset + 0] = Math.round(clamp(tr / numSamples, 0, 255));
      buf[offset + 1] = Math.round(clamp(tg / numSamples, 0, 255));
      buf[offset + 2] = Math.round(clamp(tb / numSamples, 0, 255));
      buf[offset + 3] = Math.round(clamp(ta / numSamples, 0, 255));
      offset += 4;
    }
  }
  return buf;
}

function main() {
  const rootDir = path.resolve(__dirname, '..');
  const assetsDir = path.join(rootDir, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });

  const pngPath = path.join(assetsDir, 'icon.png');
  const icoPath = path.join(assetsDir, 'icon.ico');

  console.log('Generating WaveSpeed Studio icons...');

  // Render 256x256 master frame
  const rgba256 = renderIcon(256);
  const png256 = encodePNG(rgba256, 256, 256);
  fs.writeFileSync(pngPath, png256);
  console.log(`Generated PNG: ${pngPath} (${png256.length} bytes)`);

  // Render multi-size frames for ICO: 16x16, 32x32, 48x48, 256x256
  const sizes = [16, 32, 48, 256];
  const icoFrames = [];
  for (const size of sizes) {
    if (size === 256) {
      icoFrames.push({ width: 256, height: 256, buffer: png256 });
    } else {
      const rgba = renderIcon(size);
      const png = encodePNG(rgba, size, size);
      icoFrames.push({ width: size, height: size, buffer: png });
    }
  }

  const icoBuffer = encodeICO(icoFrames);
  fs.writeFileSync(icoPath, icoBuffer);
  console.log(`Generated ICO: ${icoPath} (${icoBuffer.length} bytes, ${sizes.length} frames: ${sizes.join(', ')})`);
}

if (require.main === module) {
  main();
}

module.exports = { encodePNG, encodeICO, renderIcon };
