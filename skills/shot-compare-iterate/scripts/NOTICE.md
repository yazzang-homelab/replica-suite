# Third-party script notices

| File | Upstream | Commit | License |
|---|---|---|---|
| `shot.mjs` | sevzq/screenshot-to-html | 7b5469b2c2c95091f4c2e87f125b19f644f9aff0 | MIT, Copyright (c) 2026 SevenZhang |
| `capture_visual_qa.mjs`, `compare_visual_qa.mjs` | vishnu-madhavan-git/9designer-skills | b9b9289feec3bdfa42799a136623d163460d2fd8 | Apache-2.0 |
| `compare.mjs` | original to this plugin | - | - |

Change notice: `shot.mjs` and `capture_visual_qa.mjs` now use the shared browser module,
bounded readiness waits and explicit Chromium/channel selection. Their CLI-specific capture
and report behavior remains separate. `compare_visual_qa.mjs` retains its original implementation.

MIT terms for the MIT file: permission is granted, free of charge, to use, copy, modify, merge, publish,
distribute, sublicense and sell copies, provided the above copyright notice and this permission notice are
included in all copies or substantial portions; the software is provided "AS IS", without warranty of any kind.
Apache-2.0 terms: https://www.apache.org/licenses/LICENSE-2.0
