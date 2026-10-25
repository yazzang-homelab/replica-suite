// Credit: copied from fitoe/DesignToCode (scripts/asset-policy), commit 80070c17f4e3c0ada2c6ad45195fbea663e60e65,
// MIT License, Copyright (c) 2026 fitoe. Unmodified apart from this attribution header. Needs: npm i sharp
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { normalizeAssetPath } from './constants.mjs'

export async function readAssetRecord(filePath, rootDir = process.cwd()) {
  const stats = await fs.stat(filePath)
  const metadata = await sharp(filePath).metadata()

  return {
    absolutePath: filePath,
    relativePath: normalizeAssetPath(path.relative(rootDir, filePath)),
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
    format: metadata.format ?? path.extname(filePath).slice(1).toLowerCase(),
    sizeBytes: stats.size,
    sizeKb: Number((stats.size / 1024).toFixed(2)),
  }
}
