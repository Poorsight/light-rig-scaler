# ONBOARDING — Sectional Light Rig Scaler

> Context for a new developer (and their Claude Code) to pick up the project
> and embed the generator into their own site without further questions.

## TL;DR
A web tool: you enter the dimensions of a sectional sofa (Width × Depth × Height) →
you get the **Unreal Engine T3D** of five light sources, which is pasted directly into
the UE viewport via `Ctrl + V`. All the logic is in a single file, `index.html`,
with no build step and no external dependencies.

- Repository: https://github.com/Poorsight/light-rig-scaler
- Online (GitHub Pages): https://poorsight.github.io/light-rig-scaler/
- Locally: open `index.html` by double-clicking **or** `npx serve . -l 5500`

## Task (typical)
Embed this generator into another site/application. The reusable part is the
**pure calculation and T3D generation functions**; the current UI is merely a wrapper around them.

## Architecture
A single self-contained `index.html`:
- `<style>` — UI styling.
- `<script>` — two parts:
  1. **Pure logic** (this is what we reuse):
     - `REF_DEFAULT = {W:453, D:274, H:77}` — the dimensions of the sofa for which the reference rig was tuned.
     - `LIGHTS` — the base parameters of the 5 sources (name → position, intensity, type, dimensions).
     - `TEMPLATE` — a string with the source T3D (a UE export of 5 actors).
     - `computeAll(W, D, H, mode, swap, ref)` → an object of results for each source.
     - `generateT3D(res)` → a T3D string, ready to be pasted into UE.
     - `fmt`, `hyp` — formatting/distance utilities.
     - At the bottom — `module.exports` under the guard `typeof module !== "undefined"` (for node tests).
  2. **UI** — wrapped in `if (typeof document !== "undefined")`: attaches handlers, renders the table and the "Calculation formula" panel.

## Input/output contract (the key thing for integration)
```js
const res = computeAll(W, D, H, mode, swap, ref);
//   W, D, H — sofa dimensions, cm
//   mode    — "A" (scale the source dimensions → I·k²)
//           | "B" (fixed dimensions → I·k^p)
//   swap    — bool: the sofa is rotated 90° (swaps the X↔Y axis mapping)
//   ref     — {W,D,H} the rig reference (usually REF_DEFAULT)
//
// res[name] = {
//   type,            // "rect" | "spot"
//   pos: [x,y,z],    // new position
//   intensity,       // new Intensity (Candelas)
//   k, p, I0,        // coefficients/original intensity (for the table)
//   atten,           // new AttenuationRadius | null
//   // rect: w, h, barn   | spot: radius, soft
// }

const t3d = generateT3D(res);   // string → to the clipboard → Ctrl+V in UE
```
`generateT3D` takes `TEMPLATE` and replaces **only the numeric fields** (position,
intensity, source dimensions, AttenuationRadius) inside each actor,
without touching the structure or rotations — so the result is always valid for pasting.

## Formula (full version — in the "Calculation formula" panel on the site itself)
- Scale: `sX = W/453`, `sY = D/274`, `sZ = H/77` (with `swap`, X↔Y are swapped).
- Position: `pos · s` per coordinate.
- `k = |new_pos| / |old_pos|` — individual for each source.
- Effective radius `R`: spot → `SourceRadius`; rect → `√(SourceWidth·SourceHeight / π)`.
- Mode **A**: source dimensions `· k`, `Intensity · k²`.
- Mode **B**: `Intensity · (k²·d² + R²) / (d² + R²) ≈ Intensity · k^p`, where `p = 2d²/(d²+R²)`.
- `AttenuationRadius · k`. Rotations, color, temperature — unchanged.
- **Axes:** world X ↔ width (453), Y ↔ depth (274), Z ↔ height (77).

## How to embed it into a site
1. **Extract the pure logic into a module.** The extraction boundary: all the code from `"use strict";` up to and including the `module.exports` block. Everything below is `if (typeof document !== "undefined") { … }` (the UI wrapper); for headless/library use it can be dropped (it is harmless but not needed).
   - For ESM, replace the line `module.exports = {…}` with `export { REF_DEFAULT, LIGHTS, TEMPLATE, computeAll, generateT3D, fmt, hyp };`.
   - `TEMPLATE` is an ordinary multi-line template literal with no backticks inside, and copies into a `.js/.mjs` as is.
2. **Call** `generateT3D(computeAll(W, D, H, mode, swap, ref))`; put the result on the clipboard: `navigator.clipboard.writeText(t3d)` (fallback via `document.execCommand` — for non-secure contexts).
3. Build your own UI — there are no external dependencies.

**Runtime requirements:** the pure logic is ES2017+ (arrow functions, template literals, `Object.entries`, default parameters); the clipboard helper uses `async/await`. For evergreen browsers no transpilation is needed; for older runtimes, transpile the module yourself. There are no dependencies. The test runner is Node 18+ (for verification only, not for production).

## Pitfalls
- **Clipboard:** `navigator.clipboard` is available only in a secure context (https / localhost). On `file://` you need the fallback (it is present in the current code).
- **Pasting into UE:** the asset paths in the T3D are neutralized to `/Game/LightRig/…`. Actors are created anew on paste, but it is worth verifying the paste in the viewport once.
- **Don't break `TEMPLATE`:** you may change only the numeric values; the structure and rotations must not be changed, otherwise pasting may stop working.

## What exactly generateT3D rewrites
Inside each actor (the actor is located by `ActorLabel="…"`, which **must** match the key in `LIGHTS` and be unique) only the following are rewritten:
- `RelativeLocation`, `Intensity`;
- rect: `SourceWidth`, `SourceHeight`, `BarnDoorLength`;  spot: `SourceRadius`, `SoftSourceRadius`;
- `AttenuationRadius` (if present).

Deliberately **not touched**: rotations, `Temperature`, cone angles, `ExportPath`. Each field must be on its own line of the form `^(spaces)Field=…` (the replacement matches the first occurrence in the block, without `/g`). To add a source = duplicate an entire `Begin Actor…End Actor` block with a unique `ActorLabel` and add the corresponding entry to `LIGHTS`.

## Regenerating the base rig (if the source rig in UE changed)
⚠️ `LIGHTS` and `TEMPLATE` are **two independent, manually maintained representations of the same numbers**: `TEMPLATE` is mutated, `LIGHTS` is the source of numbers for `computeAll`. Update one and forget the other and the identity invariant silently breaks, and all scaled outputs become incorrect.

Update procedure:
1. In UE, select the 5 sources → `Ctrl+C` → paste the T3D into `TEMPLATE`. Neutralize the asset paths to `/Game/LightRig/…` (as done now).
2. **Synchronize `LIGHTS` manually:** for each actor, carry over `pos` (from `RelativeLocation`), `intensity` (`Intensity`), dimensions (rect: `w`/`h`/`barn`; spot: `radius`/`soft`) and `atten` (`AttenuationRadius` or `null`).
3. Update `REF_DEFAULT` to the dimensions of the sofa for which the new rig was authored.
4. Run `npm test` — passing identity proves that `LIGHTS` and `TEMPLATE` are consistent.

## Tests
The key invariant — when the reference dimensions are entered, the output is byte-for-byte equal to the source:
```js
generateT3D(computeAll(453, 274, 77, "A", false, REF_DEFAULT)) === TEMPLATE   // true
```
Ready-to-run (Node 18+):
```bash
npm test          # = node test/sanity.cjs
```
`test/sanity.cjs` itself extracts the pure logic from `index.html` and checks: identity
(modes A and B), the scaled case (the output changes, but the 5 actors and the line count
are preserved) and the absence of branding. If integration broke something, the test fails
(non-zero exit code). Run it after any edits to `LIGHTS`/`TEMPLATE`.

## Getting started in Claude Code
Open the repository in Claude Code. Everything essential is in `index.html`:
- the pure logic and `TEMPLATE` — the top of `<script>`;
- the "Calculation formula" panel — what is computed and how;
- `README.md` — overview and deployment to GitHub Pages;
- `.claude/launch.json` — the local server config (`npx serve`).
