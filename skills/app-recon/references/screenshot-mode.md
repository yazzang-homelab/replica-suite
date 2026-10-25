# Screenshot mode (no instrumentation)

Input: a folder of screenshots (default `appclone/screens/`) showing most states of an app you may analyse. No exact CSS values exist, so everything measured from pixels is an **estimate** and the visual-diff loop in `app-parity-test` corrects it later.

## Optional filename hints (honor if present, infer otherwise)
- `home-empty.png`, `home-filled.png`, `profile-dark.png` -> screen + state
- `home→detail.png` -> tapping on Home opens Detail
- one subfolder per screen -> each file is a state of that screen

## Steps
1. **Inventory** the folder; list unreadable/duplicate files.
2. **Cluster into `screen -> [states]`.** Ten images can be four screens. States differ by data (empty/filled), theme, overlay (modal/sheet), tab, loading. Wrong clustering = duplicate screens or missing states; do this before anything else.
3. **Navigation model** from chrome cues: persistent bottom bar = tabs; back chevron = stack push; hamburger/side panel = drawer; mixes are common. Write `appclone/SCREEN_GRAPH.md`: node = screen, edge = trigger (row tap, button label matching another title, `→` hint).
4. **Per-screen description** (layout top-to-bottom, flex direction, spacing rhythm; every component with type/text/colour/size/radius, marked `~estimate`; verbatim visible text only for recon notes, not for shipping copy).
5. **Interaction inventory.** Enumerate every affordance, not just buttons: editable text, toggle, add, delete, reorder/drag, swipe action, long-press menu, multi-select + bulk action, navigate, picker/sheet, search/filter. Triage each:
   - **On-device** (local CRUD, preferences, ordering) -> must work for real in the clone.
   - **Backend** (auth, sync, remote search, payments, push) -> typed mock + explicit cut note.
6. **Assets honesty.** Icons/illustrations/photos cannot be recovered from pixels. Plan: open icon set matched by eye, own or generated imagery. Never crop and ship the original's artwork.
7. **Dates and calendars** are computed from the real current date in the clone, never frozen strings from a screenshot.

## Output
`recon.md` rows for each screen/state, `SCREEN_GRAPH.md`, an interaction table per screen (feeds `app-build` spec files), and a list of states that are missing from the folder (ask the user for those screenshots).
