#!/usr/bin/env node
/*
 * check_alpha.mjs - original helper for the shot-* skills (not copied from upstream).
 *
 * Structural check for "transparent" PNG assets (logos, icons, cut-outs): a PNG extension, an RGBA mode,
 * or a checkerboard painted into the pixels does NOT prove transparency. This reports what is really there.
 *
 * Install once:  npm i -D pngjs
 * Usage:  node check_alpha.mjs asset.png [more.png ...] [--require-transparency] [--edge-band 2]
 * Exit:   0 pass | 2 a --require-transparency file failed | 1 usage/read error
 *
 * Reports per file: size, transparent-pixel %, opaque %, partial-alpha % (soft edges), corner alpha,
 * baked-checkerboard suspicion (opaque light-gray/white alternating tiles near the borders),
 * and edge halo (opaque border pixels that are near-white/near-black - leftover background fringe).
 * Passing is only a structure check: still look at the asset on a dark AND a light background.
 */
import fs from 'node:fs';
import { PNG } from 'pngjs';

const args = process.argv.slice(2);
const require = args.includes('--require-transparency');
let band = 2;
const bi = args.indexOf('--edge-band');
if (bi >= 0) band = parseInt(args[bi + 1], 10) || 2;
const files = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--edge-band');
if (!files.length) { console.error('usage: node check_alpha.mjs asset.png [...] [--require-transparency] [--edge-band N]'); process.exit(1); }

let failed = false;
for (const f of files) {
  let png;
  try { png = PNG.sync.read(fs.readFileSync(f)); } catch (e) { console.error(`${f}: cannot read PNG (${e.message})`); process.exit(1); }
  const { width: w, height: h, data: d } = png;
  let transparent = 0, opaque = 0, partial = 0;
  for (let i = 3; i < d.length; i += 4) { const a = d[i]; if (a === 0) transparent++; else if (a === 255) opaque++; else partial++; }
  const n = w * h;
  const px = (x, y) => { const i = (y * w + x) * 4; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; };
  const corners = [px(0, 0), px(w - 1, 0), px(0, h - 1), px(w - 1, h - 1)].map((p) => p[3]);

  // checkerboard suspicion: sample a 16x16 block at top-left; opaque pixels, two light gray levels, alternating tiles
  let checker = false;
  if (corners[0] === 255) {
    const levels = new Set(); let lightOpaque = 0, total = 0;
    for (let y = 0; y < Math.min(16, h); y++) for (let x = 0; x < Math.min(16, w); x++) {
      const [r, g, b, a] = px(x, y); total++;
      if (a === 255 && Math.abs(r - g) < 6 && Math.abs(g - b) < 6 && r > 150) { lightOpaque++; levels.add(Math.round(r / 8)); }
    }
    checker = lightOpaque / total > 0.9 && levels.size >= 2 && levels.size <= 4;
  }

  // edge halo: opaque pixels in the outer band that are near white/black while the image has transparency elsewhere
  let halo = 0, edgeOpaque = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (x >= band && x < w - band && y >= band && y < h - band) { x = w - band - 1; continue; }
    const [r, g, b, a] = px(x, y);
    if (a === 255) { edgeOpaque++; const m = Math.max(r, g, b), mn = Math.min(r, g, b); if (mn > 235 || m < 20) halo++; }
  }

  const pct = (v) => (100 * v / n).toFixed(2) + '%';
  const hasT = transparent + partial > 0 && opaque > 0;
  const issues = [];
  if (!hasT) issues.push('no usable transparency (fully opaque or fully transparent)');
  if (checker) issues.push('baked checkerboard suspected near the top-left corner');
  if (hasT && edgeOpaque > 0 && halo / Math.max(1, edgeOpaque) > 0.5) issues.push('opaque near-white/near-black fringe on the border (leftover background?)');
  console.log(`${f}: ${w}x${h} transparent ${pct(transparent)} opaque ${pct(opaque)} soft ${pct(partial)} cornerAlpha [${corners.join(',')}]` + (issues.length ? `\n  ISSUES: ${issues.join('; ')}` : '\n  ok (structure only; inspect on light and dark backgrounds)'));
  if (require && issues.length) failed = true;
}
process.exit(failed ? 2 : 0);
