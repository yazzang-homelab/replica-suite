# Third-party script notice
`asset-policy/*.mjs` and `../asset-policy.config.json`: fitoe/DesignToCode, commit 80070c17f4e3c0ada2c6ad45195fbea663e60e65,
MIT License, Copyright (c) 2026 fitoe. Permission is granted, free of charge, to use, copy, modify, merge, publish,
distribute, sublicense and sell copies, provided this copyright and permission notice is included in all copies or
substantial portions; provided "AS IS" without warranty.

Usage (run from the project root; the scripts read `asset-policy.config.json` in `--root`):
  cp <skill>/asset-policy.config.json .                    # then adjust scanDirs/ignoreDirs
  node <skill>/scripts/asset-policy/scan-assets.mjs --root .
  node <skill>/scripts/asset-policy/optimize-assets.mjs --input assets/x.png --write
  node <skill>/scripts/asset-policy/crop-atlas.mjs --manifest path/to/atlas-manifest.json
  node <skill>/scripts/asset-policy/validate-atlas.mjs --manifest path/to/atlas-manifest.json
