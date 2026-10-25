// Credit: copied from fitoe/DesignToCode (scripts/asset-policy), commit 80070c17f4e3c0ada2c6ad45195fbea663e60e65,
// MIT License, Copyright (c) 2026 fitoe. Unmodified apart from this attribution header. Needs: npm i sharp
import fs from 'node:fs'

export function loadPolicy(configPath = new URL('../../asset-policy.config.json', import.meta.url)) {
  return JSON.parse(fs.readFileSync(configPath, 'utf8'))
}
