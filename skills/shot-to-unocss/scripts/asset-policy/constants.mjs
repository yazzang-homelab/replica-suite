// Credit: copied from fitoe/DesignToCode (scripts/asset-policy), commit 80070c17f4e3c0ada2c6ad45195fbea663e60e65,
// MIT License, Copyright (c) 2026 fitoe. Unmodified apart from this attribution header. Needs: npm i sharp
import fs from 'node:fs'
import path from 'node:path'

export const ASSET_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'])

export const DEFAULT_POLICY = JSON.parse(
  fs.readFileSync(new URL('../../asset-policy.config.json', import.meta.url), 'utf8')
)

export function normalizeAssetPath(inputPath) {
  return inputPath.replace(/[\\/]+/g, '/')
}

export function isIgnoredPath(relativePath, policy = DEFAULT_POLICY) {
  const normalized = normalizeAssetPath(relativePath)
  return policy.ignoreDirs.some((segment) => normalized === segment || normalized.startsWith(`${segment}/`))
}
