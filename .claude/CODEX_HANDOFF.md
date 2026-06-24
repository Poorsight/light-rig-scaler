# Codex handoff for Claude

Use this file to resume the current work without reading the whole chat.

## Current task
Continue the `feature/preview-renders` work for `D:\GitHub\light-rig-scaler`.

The user wants render previews to come from server files instead of browser drag-drop uploads. The deployed tool and render folders are expected to live together so relative URLs like `Renders/...` resolve from the same origin.

## What Codex changed
- Created a Codex skill equivalent to Claude's preview deploy skill:
  - `C:\Users\Dima\.codex\skills\preview-deploy`
  - Windows uploader: `scripts\upload-preview.ps1`
  - Private local config: `deploy.config`
- Replaced the old `index.html` render board:
  - Removed drag-drop file input.
  - Removed IndexedDB image storage, export, and import.
  - Added server render loading from `Renders/<material>/<prefix>_<suffix>.png`.
  - Added `localStorage` comments keyed by final image URL with prefix `lrs_render_comment:`.
- Updated `ONBOARDING.md` and `README.md` for the new server-render workflow.

## Render filename assumptions
Material folders currently wired in `index.html`:
- `PERFORMANCE_LINEN_WEAVE_CAMEL_V1`
- `VELVETY_NATURAL_V1`

Built-in presets have an `r` property used as the filename prefix, for example:
- `BORGO_RIGHT_ARM_L_SECTIONAL_prod39250511`
- `KOPER_LEFT_ARM_L_SECTIONAL_prod39250480`
- `MASSON_LEFT_ARM_TWO_SEAT_CHAISE_END_U_SECTIONAL_prod40460153`

Shot suffixes currently wired:
- `F` -> `F`
- `FH` -> `FH`
- `TQR` -> `RIGHT_ARM`, fallback `TQ`
- `TQL` -> `LEFT_ARM`, fallback `TQ`

Prefix variants currently wired:
- `r`
- `r_FH`

The `r_FH` fallback is needed for some current Borgo files from the FTP listing, for example `BORGO_RIGHT_ARM_L_SECTIONAL_prod39250511_FH_F.png` and `BORGO_RIGHT_ARM_L_SECTIONAL_prod39250511_FH_TQ.png`.

The current server folder has render files for SKU prefixes `39250511`, `39250480`, and `40460153`.

If actual server filenames differ, change only `RB_MATERIALS`, `RB_VIEW_SUFFIXES`, `rbPrefixVariants`, or the built-in preset `r` prefixes in `index.html`.

## Validation already run
- Full script syntax check via Node `new Function(script)`: OK.
- `npm.cmd test`: OK, all checks passed.

Use `npm.cmd test` on this Windows machine. Plain `npm test` can fail because PowerShell blocks `npm.ps1`.

## Deployment note
Before publishing, confirm with the user because preview deploy makes files public.

The public light-rig URL discussed in chat is:
`https://preview.3dsource.com/dmitriy.derevyanko/light-rig/`

Do not paste or print FTP passwords. Use the existing local skill config or environment variable.
