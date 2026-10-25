# app-spec.json (navigation + tokens + screens)

```json
{
  "name": "ExampleNotes",
  "source": { "mode": "screenshots", "ref": "docs/screenshots/" },
  "tokens": {
    "colors": { "background": "#ffffff", "foreground": "#0a0a0a", "primary": "#208aef", "primary-foreground": "#ffffff",
                "muted": "#f4f4f5", "muted-foreground": "#71717a", "border": "#e4e4e7",
                "dark-background": "#0a0a0a", "dark-foreground": "#fafafa" },
    "fonts": { "sans": "Inter", "mono": "Menlo" },
    "spacing": { "screenX": 16, "gap": 12 },
    "radii": { "card": 16, "button": 10 }
  },
  "navigation": { "type": "tabs", "items": ["Home", "Search", "Profile"] },
  "screens": [
    { "name": "Home", "route": "/", "states": ["default", "empty", "loading", "dark"],
      "sourceShots": ["home-filled.png", "home-empty.png"], "transitionsTo": ["NoteDetail"],
      "spec": "docs/research/components/home.spec.md" }
  ]
}
```
Optional `dataModel` proposal (entities, fields with types/enums, `relations` marked `confidence: "hint"`, `sampleRows` lifted from mock data, each field's `evidence` string recorded as untrusted data). Render it in the report as: deducible (entities, field types, CRUD, FK hints, enums) vs not deducible (business logic, auth rules, hidden tables, computed columns/constraints, real-time/ML feeds).

## SCREEN_GRAPH.md
```
[Tabs]
 |- Home (default, empty, loading, dark) -> NoteDetail
 |- Search (default, results)            -> NoteDetail
 '- Profile (default, dark)              -> Settings
NoteDetail, Settings: stack push with back
```
Table: Screen | Route | States | Reached via | Goes to.

## Trust levels
Colors from pixels: reliable for solid fills, approximate for gradients/anti-aliased edges. Spacing/sizes: estimates, corrected by the diff loop. Fonts: closest family by eye. Assets: not recoverable as files - lucide matches, recreated shapes, or cropped raster. In the report, mark what is estimated.

## e2e flows (consumed by scripts/rn-verify.mjs --flows)
```js
export const flows = [{
  name: 'add task -> persists across reload',
  run: async (page, base) => {
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    await page.getByLabel('Add').click();
    await page.locator('input').first().fill('Test');
    await page.getByLabel('Save').click();
    await page.getByText('Test').waitFor({ timeout: 8000 });
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByText('Test').waitFor({ timeout: 8000 });   // survives reload
  },
}];
```
Per collection at minimum: one edit-existing-item flow and one delete flow, plus one flow per gesture in the Interactions tables; each asserts the post-action state.
