# Release Notes

## 2.0.0 (2026-08-28)

### ⚠ BREAKING CHANGES

- **plugin:** minAppVersion moves 1.8.7 -> 1.13.0.

Ports the imperative settings tab to the declarative API following the
fleet recipe. 10 scalars become control definitions bridged through a
new Plugin.updateSettings (persist-then-commit — memory swaps only
after saveData succeeds, replacing the tab-private updateSetting that
mutated memory first). setControlValue rejects on failure, including
type mismatches and out-of-range numbers.

Live state stays imperative: server status (Start/Stop), CLI status
(Recheck) and the API key row (Copy / Regenerate) are render rows
refreshed via update(); "Listening on" and the 0.0.0.0 security warning
are conditionally-visible definitions re-evaluated per render.

Parity notes: blockedCommands keeps its exact split/trim/filter
normalization; defaultVault is deliberately not trimmed; port and
requestTimeout mirror the zod schema's bounds inline with NO
defaultValue (a cleared field is refused, not silently reset). The API
key field's inline setCssStyles moved to a CSS class.

Guard spec + AGENTS.md "Declarative settings" ported from the template.

Settings pane rendering needs eyes-on verification in Obsidian.

### Features

- **plugin:** declare settings via getSettingDefinitions (Obsidian 1.13)
- **plugin:** show what's new in a tab instead of a modal dialog
- **plugin:** surface support CTAs everywhere users can see them

### Bug Fixes

- **build:** port template catalog-reviewer + toolchain fixes (2.8.0+)
- **plugin:** bring back the follow button, and stop lying about brands
- **plugin:** serialize settings writes — overlapping edits lost data

## 1.4.0 (2026-07-29)

### Features

- **plugin:** aggregate what's new dialogs across simultaneously updated plugins

## 1.3.0 (2026-07-29)

### Features

- **plugin:** add Knowii community to the what's new dialog and harden it

## 1.2.0 (2026-07-27)

### Features

- **plugin:** show a what's new dialog once after plugin updates

## 1.1.9 (2026-07-17)

## 1.1.8 (2026-06-17)

### Bug Fixes

- **deps:** clear all dependency vulnerability advisories

## 1.1.7 (2026-06-17)

## 1.1.6 (2026-05-15)

## 1.1.5 (2026-05-15)

## 1.1.4 (2026-05-15)

### Bug Fixes

- **all:** fixed Already connected to a transport issue
- **all:** fixed CLI binary not detected on MacOS

## 1.1.3 (2026-05-15)

## 1.1.2 (2026-05-14)

## 1.1.1 (2026-05-13)

## 1.1.0 (2026-05-13)

### Features

- **all:** improved obsidian cli detection/usage
- **all:** updated release workflow and removed hardcoded cli entries

## 1.0.1 (2026-04-16)

### Bug Fixes

- **all:** improved obsidian cli detection

## 1.0.0 (2026-04-15)

### Features

- **all:** improved behavior and performance at startup (loading in the background)
- **all:** improved MCP and docs
- **all:** updated

## 0.1.0 (2026-02-21)

### Features

- **all:** improved api docs
- **all:** improved command discovery
- **all:** initial implementation of the RESTful API and MCP server
- **all:** updated
- **all:** updated docs
