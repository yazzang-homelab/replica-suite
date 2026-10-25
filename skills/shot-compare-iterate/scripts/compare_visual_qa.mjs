#!/usr/bin/env node
/*
 * Credit: copied from vishnu-madhavan-git/9designer-skills (skills/9assets-website/scripts/compare_visual_qa.mjs),
 * commit b9b9289feec3bdfa42799a136623d163460d2fd8, Apache License 2.0 (see upstream LICENSE).
 * Change notice: only this attribution header was added.
 */
/**
 * Compare reference and rendered screenshots for 9Designer visual QA.
 *
 * pixelmatch and pngjs are optional. Install them only in projects that want
 * automated diff images:
 *
 *   npm i -D pixelmatch pngjs
 */

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

function usage() {
  console.log(`Usage:
  node compare_visual_qa.mjs --reference-dir <dir> --actual-dir <dir> [options]

Options:
  --reference-dir <dir>      Directory with approved reference PNGs.
  --actual-dir <dir>         Directory with captured rendered PNGs.
  --out <dir>                Output directory for diffs. Default: visual-qa/diffs
  --threshold <number>       pixelmatch threshold. Default: 0.12
  --fail-ratio <number>      Ratio used when --fail-on-diff is set. Default: 0.02
  --fail-on-diff             Exit 1 when any comparison exceeds fail ratio.
  --help                     Show this help

Optional dependency:
  npm i -D pixelmatch pngjs`);
}

function parseArgs(argv) {
  const args = {
    referenceDir: "",
    actualDir: "",
    out: "visual-qa/diffs",
    threshold: 0.12,
    failRatio: 0.02,
    failOnDiff: false,
    help: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--help" || value === "-h") {
      args.help = true;
    } else if (value === "--reference-dir") {
      args.referenceDir = argv[++index] || "";
    } else if (value === "--actual-dir") {
      args.actualDir = argv[++index] || "";
    } else if (value === "--out") {
      args.out = argv[++index] || args.out;
    } else if (value === "--threshold") {
      args.threshold = Number(argv[++index] || args.threshold);
    } else if (value === "--fail-ratio") {
      args.failRatio = Number(argv[++index] || args.failRatio);
    } else if (value === "--fail-on-diff") {
      args.failOnDiff = true;
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }

  return args;
}

async function loadDiffPackages() {
  try {
    const pixelmatchModule = await import("pixelmatch");
    const pngModule = await import("pngjs");
    return {
      pixelmatch: pixelmatchModule.default || pixelmatchModule.pixelmatch,
      PNG: pngModule.PNG || pngModule.default?.PNG,
    };
  } catch (error) {
    const result = {
      valid: false,
      optional_dependency_missing: "pixelmatch/pngjs",
      message: "Automated PNG diffs are optional and dependencies are not installed.",
      install: ["npm i -D pixelmatch pngjs"],
      error: error?.message || String(error),
    };
    console.error(JSON.stringify(result, null, 2));
    process.exit(2);
  }
}

async function pngFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".png"))
    .map((entry) => entry.name)
    .sort();
}

function suggestedCategories(ratio, status) {
  if (status === "size-mismatch") {
    return ["layout", "responsive behavior"];
  }
  if (ratio > 0.08) {
    return ["layout", "spacing", "asset", "color"];
  }
  if (ratio > 0.02) {
    return ["spacing", "typography", "color", "asset"];
  }
  if (ratio > 0) {
    return ["typography", "color", "icon"];
  }
  return [];
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }
  if (!args.referenceDir || !args.actualDir) {
    usage();
    process.exit(1);
  }

  const { pixelmatch, PNG } = await loadDiffPackages();
  const referenceDir = path.resolve(args.referenceDir);
  const actualDir = path.resolve(args.actualDir);
  const outDir = path.resolve(args.out);
  await mkdir(outDir, { recursive: true });

  const referenceFiles = new Set(await pngFiles(referenceDir));
  const actualFiles = new Set(await pngFiles(actualDir));
  const sharedFiles = Array.from(referenceFiles).filter((file) => actualFiles.has(file)).sort();
  const missingActual = Array.from(referenceFiles).filter((file) => !actualFiles.has(file)).sort();
  const missingReference = Array.from(actualFiles).filter((file) => !referenceFiles.has(file)).sort();
  const comparisons = [];

  for (const file of sharedFiles) {
    const reference = PNG.sync.read(await readFile(path.join(referenceDir, file)));
    const actual = PNG.sync.read(await readFile(path.join(actualDir, file)));
    const name = path.basename(file, ".png");
    const diffFile = path.join(outDir, `${name}-diff.png`);

    if (reference.width !== actual.width || reference.height !== actual.height) {
      comparisons.push({
        file,
        status: "size-mismatch",
        reference_size: { width: reference.width, height: reference.height },
        actual_size: { width: actual.width, height: actual.height },
        mismatch_pixels: null,
        mismatch_ratio: null,
        diff_file: "",
        category_suggestions: suggestedCategories(1, "size-mismatch"),
      });
      continue;
    }

    const diff = new PNG({ width: reference.width, height: reference.height });
    const mismatchPixels = pixelmatch(
      reference.data,
      actual.data,
      diff.data,
      reference.width,
      reference.height,
      { threshold: args.threshold },
    );
    await writeFile(diffFile, PNG.sync.write(diff));
    const totalPixels = reference.width * reference.height;
    const mismatchRatio = totalPixels ? mismatchPixels / totalPixels : 0;

    comparisons.push({
      file,
      status: mismatchRatio > args.failRatio ? "needs-review" : "within-threshold",
      reference_size: { width: reference.width, height: reference.height },
      actual_size: { width: actual.width, height: actual.height },
      mismatch_pixels: mismatchPixels,
      mismatch_ratio: Number(mismatchRatio.toFixed(6)),
      diff_file: diffFile,
      category_suggestions: suggestedCategories(mismatchRatio, "compared"),
    });
  }

  const failed = comparisons.some(
    (comparison) =>
      comparison.status === "size-mismatch" ||
      (typeof comparison.mismatch_ratio === "number" && comparison.mismatch_ratio > args.failRatio),
  );

  const summary = {
    valid: true,
    tool: "compare_visual_qa",
    reference_dir: referenceDir,
    actual_dir: actualDir,
    output_dir: outDir,
    threshold: args.threshold,
    fail_ratio: args.failRatio,
    fail_on_diff: args.failOnDiff,
    missing_actual: missingActual,
    missing_reference: missingReference,
    comparisons,
  };

  await writeFile(path.join(outDir, "visual-qa-diff-summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));

  if (args.failOnDiff && failed) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ valid: false, error: error?.message || String(error) }, null, 2));
  process.exit(1);
});
