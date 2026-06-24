# ONBOARDING — Sectional Light Rig Scaler

> Context for a new developer (and their Claude Code) to pick up the project cold.
> **Maintenance rule:** keep this file in sync with every substantive change — update it
> (and `README.md`) in the same commit as the change.

## TL;DR
A web tool: pick a **camera shot**, enter the sectional sofa's dimensions (Width × Depth × Height) →
get the **Unreal Engine T3D** of the 5-light rig, ready to paste into the UE viewport with `Ctrl + V`.
All logic is in a single `index.html` — no build, no dependencies.

- Repository: https://github.com/Poorsight/light-rig-scaler  (branch `main`)
- Online (GitHub Pages): https://poorsight.github.io/light-rig-scaler/
- Locally: open `index.html` by double-clicking **or** `npx serve . -l 5500`
- Tests: `npm test`  (Node 18+)

## Features
- **Camera shots / views:** `F` (front), `FH` (front-high), `TQ-R` (¾, sofa +30°, right-arm sectionals), `TQ-L` (¾, sofa −60°, left-arm). Each shot is its own light rig.
- **Size scaling** of the rig by sofa W/D/H, with a 90° rotate (swap) toggle.
- **Two intensity models:** A (scale source sizes, `I·k²`, closest to the original — default) / B (fixed sizes, `I·k^p`).
- **Sofa presets:** reference + 17 RH sectional models (UPH bounds measured in the UE project), plus user presets in `localStorage`.
- **Diagrams:** top view (X·Y, TQ sofa drawn rotated by its shot angle) and side view (X·Z, heights & pitch), with a cm grid and a role|temperature color toggle.
- **Warnings** (scale magnitude, aspect mismatch, peak intensity), **shareable URL** (state in the hash), **sliders**, copy / copy-link.

## Architecture
Single self-contained `index.html`:
- `<style>` — UI.
- `<script>` — two parts:
  1. **Pure logic** (the reusable core):
     - `REF_DEFAULT = {W:453, D:274, H:77}` — sofa the reference rig was tuned for.
     - `LIGHT_BASE` — per-light **constants shared by every shot**: `type`, sizes (`w/h/barn` for rect | `radius/soft` for spot), `atten`, `roll`, `cone`, `label`, `color`, `temp`.
     - `VIEWS` — per-shot rig data `{ F, FH, TQR, TQL }`; each `{ label, desc, rot, lights }` where `lights[name] = { pos:[x,y,z], I, pitch, yaw }` (only the fields that change between shots).
     - `viewLights(view)` — merges `LIGHT_BASE` + `VIEWS[view].lights` into a full light set.
     - `TEMPLATE` — one shared T3D skeleton (5 actors, structure of the F rig, asset paths neutralized to `/Game/LightRig/…`).
     - `computeAll(W, D, H, mode, swap, ref, view)` → results object per light.
     - `generateT3D(res)` → T3D string for pasting.
     - `fmt`, `hyp` — utilities.
     - `module.exports` (guarded by `typeof module !== "undefined"`) for node tests.
  2. **UI** — wrapped in `if (typeof document !== "undefined")`: shot/preset/mode/color selectors, sliders, diagrams, warnings, table, URL state.

## Input/output contract (for integration)
```js
const res = computeAll(W, D, H, mode, swap, ref, view);
//   W, D, H — sofa dimensions, cm
//   mode    — "A" (scale sizes → I·k²) | "B" (fixed sizes → I·k^p)
//   swap    — bool: sofa rotated 90° (swaps the X↔Y axis mapping)
//   ref     — {W,D,H} rig reference (usually REF_DEFAULT)
//   view    — "F" | "FH" | "TQR" | "TQL"  (defaults to F)
//
// res[name] = {
//   type,                 // "rect" | "spot"
//   pos:[x,y,z], intensity,
//   pitch, yaw, roll,     // rotation for this shot (NOT scaled)
//   k, p, I0, atten,      // diagnostics / new AttenuationRadius | null
//   cone, color, label, temp,           // for the diagram
//   // rect: w, h, barn   | spot: radius, soft
// }

const t3d = generateT3D(res);   // string → clipboard → Ctrl+V in UE
```
`generateT3D` takes the single `TEMPLATE` skeleton and, per actor (matched by `ActorLabel`),
rewrites only numeric fields — so the output is always valid for pasting and the structure is byte-stable.

## Formula (full version is in the on-site "Calculation formula" panel)
- Scale: `sX = W/453`, `sY = D/274`, `sZ = H/77` (with `swap`, X↔Y swap).
- Position: `pos · s` per coordinate. `k = |new_pos| / |old_pos|` (per light).
- Effective radius `R`: spot → `SourceRadius`; rect → `√(SourceWidth·SourceHeight / π)`.
- Mode **A**: sizes `· k`, `Intensity · k²`. Mode **B**: `Intensity · (k²·d² + R²)/(d² + R²) ≈ Intensity · k^p`, `p = 2d²/(d²+R²)`.
- `AttenuationRadius · k`. **Rotation is per-shot and not scaled**; color/temperature unchanged.
- Axes: world X ↔ width (453), Y ↔ depth (274), Z ↔ height (77).

## What exactly generateT3D rewrites
Per actor (located by `ActorLabel="…"`, which **must** equal a `LIGHT_BASE` key and be unique):
- `RelativeLocation`, `RelativeRotation` (Pitch/Yaw/Roll), `Intensity`;
- rect: `SourceWidth`, `SourceHeight`, `BarnDoorLength`;  spot: `SourceRadius`, `SoftSourceRadius`;
- `AttenuationRadius` (if present).

Deliberately **not touched**: `Temperature`, cone angles, `ExportPath`, the skeleton structure.
Each field is on its own line `^(spaces)Field=…` (first match per block, regex without `/g`).

## How to embed into a site
1. **Extract the pure logic into a module:** everything from `"use strict";` up to and including `module.exports`. The block below (`if (typeof document !== "undefined")`) is the UI wrapper — drop it for headless use. For ESM, swap the `module.exports = {…}` line for `export { … }`.
2. Call `generateT3D(computeAll(W, D, H, mode, swap, ref, view))`; put the result on the clipboard (`navigator.clipboard.writeText`, with a `document.execCommand` fallback for non-secure contexts).
3. Build your own UI — no external dependencies. Pure logic is ES2017+; clipboard helper uses `async/await`.

## Regenerating / re-tuning a rig (if the UE rig changes)
The numbers live in **`LIGHT_BASE`** (shared constants) + **`VIEWS`** (per-shot pos/I/pitch/yaw); `TEMPLATE` is the shared structural skeleton (the F rig).
- **Re-tune an existing shot:** edit `VIEWS[shot].lights` (position, intensity, pitch, yaw) and, if a size/atten changed, `LIGHT_BASE`.
- **Add a new shot:** add a `VIEWS` entry + a radio in the "Shot / view" segmented control (id `v<KEY>`).
- ⚠️ **F must stay in sync with `TEMPLATE`:** F's `VIEWS.F` values + `LIGHT_BASE` must reproduce `TEMPLATE` exactly (that's the identity invariant). If you re-export the skeleton from UE, keep the F numbers matching it and re-run `npm test`.
- Keep asset paths neutralized to `/Game/LightRig/…` (no "RH" / "3dsource").

## Tests
Identity invariant — F at the reference reproduces the skeleton byte-for-byte:
```js
generateT3D(computeAll(453, 274, 77, "A", false, REF_DEFAULT, "F")) === TEMPLATE   // true
```
```bash
npm test          # = node test/sanity.cjs   (Node 18+)
```
`test/sanity.cjs` extracts the logic from `index.html` and checks: F identity (modes A & B);
all four views produce 5 actors, the same line count, and no branding; per-view rotations
(key + right-rim) are correct; scaling changes the output while preserving structure.
Run it after any edit to `LIGHT_BASE` / `VIEWS` / `TEMPLATE`.

## Project rules (important)
- This tool lives **only** in `light-rig-scaler` @ `main`. Do **not** save anything about it into the `rh_unreal_2` UE project (a separate repo the session may run from). No "RH" / "3dsource" in files or git history.
- The UE meshes & their dimensions live in `D:\GitHub\RestorationHardware` (read-only; mesh bounds were dumped via a UE Python snippet — see git history / chat).

## Getting started in Claude Code
Open this repo. Everything essential is in `index.html`: the pure logic + `VIEWS` + `TEMPLATE` at the top of `<script>`, the on-site "Calculation formula" panel, `README.md` for deploy, `.claude/launch.json` for the local server.
