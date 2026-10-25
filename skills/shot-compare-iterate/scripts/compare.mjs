#!/usr/bin/env node
/*
 * compare.mjs - original helper for the shot-* skills (not copied from upstream).
 *
 * Compares a TARGET screenshot against your RENDER and tells you WHERE they differ, so each
 * fix round is aimed at the largest gap instead of eyeballing. It does not produce a
 * "fidelity percentage" - the numbers locate regions, they do not certify a match.
 *
 * Install once:  npm i -D pngjs
 *
 * Usage:
 *   node compare.mjs --target target.png --render v1.png --out tmp/shot/cmp-v1 [--bands 12] [--grid 6x8]
 *                    [--tolerance 28] [--align width|none]
 *
 * Outputs in --out:
 *   side-by-side.png   target | render | diff heat map (same height, padded)
 *   diff.png           heat map only (red = large colour distance, dark = match)
 *   report.json        global mismatch ratio, per-band and per-cell mismatch, worst cells, size notes
 * Also prints a compact text summary (worst bands first).
 *
 * --align width  (default) bilinear-resizes the render to the target width when widths differ
 *                (use when DPR differs, e.g. target @2x vs render @1x). Heights are padded, never
 *                stretched; a height difference is reported as `heightDelta` (layout drift signal).
 * --tolerance    per-pixel max channel difference (0-255) treated as "same" (default 28 absorbs
 *                anti-aliasing and font-rendering noise).
 */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

function args(argv) {
  const a = { bands: 12, grid: '6x8', tolerance: 28, align: 'width' };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = () => argv[++i];
    if (k === '--target') a.target = v();
    else if (k === '--render') a.render = v();
    else if (k === '--out') a.out = v();
    else if (k === '--bands') a.bands = parseInt(v(), 10);
    else if (k === '--grid') a.grid = v();
    else if (k === '--tolerance') a.tolerance = parseInt(v(), 10);
    else if (k === '--align') a.align = v();
  }
  return a;
}

const A = args(process.argv.slice(2));
if (!A.target || !A.render || !A.out) {
  console.error('usage: node compare.mjs --target t.png --render r.png --out dir [--bands N] [--grid RxC] [--tolerance N] [--align width|none]');
  process.exit(2);
}
if (!Number.isInteger(A.bands) || A.bands < 1 || A.bands > 1000 ||
    !Number.isFinite(A.tolerance) || A.tolerance < 0 || A.tolerance > 255 ||
    !/^[1-9]\d{0,2}x[1-9]\d{0,2}$/.test(A.grid) || !['width', 'none'].includes(A.align)) {
  console.error('[compare] invalid bands, grid, tolerance or alignment');
  process.exit(2);
}
const readPng = (p) => {
  if (!fs.existsSync(p)) { console.error(`[compare] not found: ${p}`); process.exit(2); }
  return PNG.sync.read(fs.readFileSync(p));
};

// Composite over white so transparent PNGs compare sanely.
function flatten(png) {
  const { width, height, data } = png;
  const out = Buffer.alloc(width * height * 3);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    const al = data[i + 3] / 255;
    out[j] = Math.round(data[i] * al + 255 * (1 - al));
    out[j + 1] = Math.round(data[i + 1] * al + 255 * (1 - al));
    out[j + 2] = Math.round(data[i + 2] * al + 255 * (1 - al));
  }
  return { width, height, rgb: out };
}

function resizeWidth(img, newW) {
  const newH = Math.max(1, Math.round(img.height * newW / img.width));
  const out = Buffer.alloc(newW * newH * 3);
  const sx = img.width / newW, sy = img.height / newH;
  for (let y = 0; y < newH; y++) {
    const fy = Math.min(img.height - 1, Math.max(0, (y + 0.5) * sy - 0.5));
    const y0 = Math.floor(fy), ty = fy - y0;
    for (let x = 0; x < newW; x++) {
      const fx = Math.min(img.width - 1, Math.max(0, (x + 0.5) * sx - 0.5));
      const x0 = Math.floor(fx), tx = fx - x0;
      for (let c = 0; c < 3; c++) {
        const p = (yy, xx) => img.rgb[(Math.min(yy, img.height - 1) * img.width + Math.min(xx, img.width - 1)) * 3 + c];
        const top = p(y0, x0) * (1 - tx) + p(y0, x0 + 1) * tx;
        const bot = p(y0 + 1, x0) * (1 - tx) + p(y0 + 1, x0 + 1) * tx;
        out[(y * newW + x) * 3 + c] = Math.round(top * (1 - ty) + bot * ty);
      }
    }
  }
  return { width: newW, height: newH, rgb: out };
}

function padTo(img, W, H) { // pad right/bottom with magenta so size gaps are visible
  const out = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i++) { out[i * 3] = 255; out[i * 3 + 1] = 0; out[i * 3 + 2] = 255; }
  for (let y = 0; y < Math.min(H, img.height); y++) {
    img.rgb.copy(out, y * W * 3, y * img.width * 3, y * img.width * 3 + Math.min(W, img.width) * 3);
  }
  return { width: W, height: H, rgb: out };
}

let T = flatten(readPng(A.target));
let R = flatten(readPng(A.render));
const notes = [];
if (A.align === 'width' && R.width !== T.width) {
  notes.push(`render resized from width ${R.width} to ${T.width}`);
  R = resizeWidth(R, T.width);
}
const heightDelta = R.height - T.height;
if (R.width !== T.width) notes.push(`widths differ (${T.width} vs ${R.width}); missing areas padded with magenta`);
const W = Math.max(T.width, R.width), H = Math.max(T.height, R.height);
const t = padTo(T, W, H), r = padTo(R, W, H);

const [gr, gc] = A.grid.split('x').map((n) => parseInt(n, 10));
const bandH = Math.ceil(H / A.bands);
const bandBad = new Array(A.bands).fill(0), bandTot = new Array(A.bands).fill(0);
const cellBad = new Array(gr * gc).fill(0), cellTot = new Array(gr * gc).fill(0);
const diff = new PNG({ width: W, height: H });
let bad = 0;
for (let y = 0; y < H; y++) {
  const b = Math.min(A.bands - 1, Math.floor(y / bandH));
  const cy = Math.min(gr - 1, Math.floor(y * gr / H));
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3;
    const d = Math.max(Math.abs(t.rgb[i] - r.rgb[i]), Math.abs(t.rgb[i + 1] - r.rgb[i + 1]), Math.abs(t.rgb[i + 2] - r.rgb[i + 2]));
    const cx = Math.min(gc - 1, Math.floor(x * gc / W));
    bandTot[b]++; cellTot[cy * gc + cx]++;
    const o = (y * W + x) * 4;
    if (d > A.tolerance) { bad++; bandBad[b]++; cellBad[cy * gc + cx]++; }
    const heat = d > A.tolerance ? 255 : Math.round(d * 2);
    diff.data[o] = heat; diff.data[o + 1] = d > A.tolerance ? 40 : Math.round(d * 0.5); diff.data[o + 2] = d > A.tolerance ? 40 : Math.round(d * 0.5); diff.data[o + 3] = 255;
  }
}

fs.mkdirSync(A.out, { recursive: true });
fs.writeFileSync(path.join(A.out, 'diff.png'), PNG.sync.write(diff));
const sbs = new PNG({ width: W * 3 + 20, height: H });
sbs.data.fill(255);
const blit = (rgb, ox) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const s = (y * W + x) * 3, d = (y * sbs.width + ox + x) * 4; sbs.data[d] = rgb[s]; sbs.data[d + 1] = rgb[s + 1]; sbs.data[d + 2] = rgb[s + 2]; sbs.data[d + 3] = 255; } };
blit(t.rgb, 0); blit(r.rgb, W + 10);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const s = (y * W + x) * 4, d = (y * sbs.width + 2 * W + 20 + x) * 4; diff.data.copy(sbs.data, d, s, s + 4); }
fs.writeFileSync(path.join(A.out, 'side-by-side.png'), PNG.sync.write(sbs));

const pct = (b, n) => +(100 * b / Math.max(1, n)).toFixed(2);
const bands = bandBad.map((b, i) => ({ band: i, y: [i * bandH, Math.min(H, (i + 1) * bandH)], mismatchPct: pct(b, bandTot[i]) }));
const cells = cellBad.map((b, i) => ({ row: Math.floor(i / gc), col: i % gc, mismatchPct: pct(b, cellTot[i]) }));
const report = {
  target: A.target, render: A.render, compared: { width: W, height: H }, tolerance: A.tolerance,
  globalMismatchPct: pct(bad, W * H), heightDelta, notes,
  bands, worstCells: [...cells].sort((a, b) => b.mismatchPct - a.mismatchPct).slice(0, 8),
  caution: 'Mismatch % locates regions to inspect; it is not a fidelity score. Verify by looking at side-by-side.png.',
};
fs.writeFileSync(path.join(A.out, 'report.json'), JSON.stringify(report, null, 2));
console.log(`[compare] global mismatch ${report.globalMismatchPct}%  heightDelta ${heightDelta}px  ${notes.join('; ')}`);
console.log('worst bands: ' + [...bands].sort((a, b) => b.mismatchPct - a.mismatchPct).slice(0, 4).map((b) => `y${b.y[0]}-${b.y[1]}:${b.mismatchPct}%`).join('  '));
console.log('worst cells: ' + report.worstCells.slice(0, 4).map((c) => `r${c.row}c${c.col}:${c.mismatchPct}%`).join('  '));
console.log(`[compare] wrote ${A.out}/{side-by-side.png,diff.png,report.json}`);
