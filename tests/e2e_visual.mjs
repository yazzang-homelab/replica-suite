import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = resolve(import.meta.dirname, '..');
const output = await mkdtemp(join(tmpdir(), 'replica-suite-e2e-'));
let color = '#123456';
const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Fixture</title></head><body style="margin:0;background:${color};color:white"><h1>Replica test</h1><button onclick="this.textContent='Done'">Start</button></body></html>`);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/`;
const python = process.env.PYTHON || 'python3';
async function run(program, args, expectedCode = 0) {
  try {
    const result = await exec(program, args, { cwd: root, timeout: 60000 });
    assert.equal(expectedCode, 0, `Expected exit ${expectedCode}: ${program} ${args}`);
    return result.stdout;
  } catch (error) {
    if (expectedCode !== 0 && error.code === expectedCode) return error.stdout;
    throw error;
  }
}
const viewports = '320x240,640x480';
async function capture(group) {
  return run('node', ['skills/web-verify-pixel/scripts/capture_matrix.mjs', `--url=${url}`,
    `--out=${join(output, group)}`, `--viewports=${viewports}`, '--settle-ms=0', '--prime=0']);
}
async function diff(expectedCode) {
  return run(python, ['skills/web-verify-pixel/scripts/pixel_diff.py', '--root', output,
    '--viewports', viewports, '--strict'], expectedCode);
}
async function qa(expectedCode) {
  const text = await run(python, ['skills/web-qa-independent/scripts/qa_gate.py',
    '--diff', join(output, 'diff/report.json'), '--replica', join(output, 'replica/site-runtime.json'),
    '--ref', join(output, 'reference/site-runtime.json')], expectedCode);
  return JSON.parse(text);
}
try {
  await capture('reference');
  await capture('replica');
  await diff(0);
  assert.equal((await qa(0)).verdict, 'PASS');
  color = '#aa0000';
  await capture('replica');
  await diff(2);
  assert.equal((await qa(2)).verdict, 'BLOCK');
  const report = JSON.parse(await readFile(join(output, 'diff/report.json'), 'utf8'));
  assert.equal(report.length, 4);
  assert.ok(report.every((row) => row.changedRatio > 0.5));
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(url);
    await page.getByRole('button', { name: 'Start' }).click();
    assert.equal(await page.getByRole('button').textContent(), 'Done');
  } finally {
    await browser.close();
  }
  console.log('PASS: two viewport pairs, exact-match PASS, visual regression BLOCK, button interaction');
} finally {
  await new Promise((resolve) => server.close(resolve));
  await rm(output, { recursive: true, force: true });
}
