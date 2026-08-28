# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0](https://github.com/dsebastien/obsidian-cli-rest/compare/1.4.0...2.0.0) (2026-08-28)

### ⚠ BREAKING CHANGES

* **plugin:** minAppVersion moves 1.8.7 -> 1.13.0.

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

* **plugin:** declare settings via getSettingDefinitions (Obsidian 1.13) ([b8008b3](https://github.com/dsebastien/obsidian-cli-rest/commit/b8008b393148607cff7af1fd8f6fa196ed562456))
* **plugin:** show what's new in a tab instead of a modal dialog ([51cbcb7](https://github.com/dsebastien/obsidian-cli-rest/commit/51cbcb76bf238eb666b953967cdda3b6d92979b2))
* **plugin:** surface support CTAs everywhere users can see them ([dc57bae](https://github.com/dsebastien/obsidian-cli-rest/commit/dc57bae4916b338c4e270b908a8ec96f48b64756))

### Bug Fixes

* **build:** port template catalog-reviewer + toolchain fixes (2.8.0+) ([7457ed0](https://github.com/dsebastien/obsidian-cli-rest/commit/7457ed0ae767aeaea4a578e16538df951a563e90))
* **plugin:** bring back the follow button, and stop lying about brands ([6640bba](https://github.com/dsebastien/obsidian-cli-rest/commit/6640bba96a6d0ecce2508e4b8cb5d182ee0c511f))
* **plugin:** serialize settings writes — overlapping edits lost data ([09a8dd0](https://github.com/dsebastien/obsidian-cli-rest/commit/09a8dd07ee080ad986ea51ebd49a12c04d8a2409))

## [1.4.0](https://github.com/dsebastien/obsidian-cli-rest/compare/1.3.0...1.4.0) (2026-07-29)

### Features

* **plugin:** aggregate what's new dialogs across simultaneously updated plugins ([a2d660e](https://github.com/dsebastien/obsidian-cli-rest/commit/a2d660e79460a5e3970481df52847e3465d116bc))

## [1.3.0](https://github.com/dsebastien/obsidian-cli-rest/compare/1.2.0...1.3.0) (2026-07-29)

### Features

* **plugin:** add Knowii community to the what's new dialog and harden it ([2e487d0](https://github.com/dsebastien/obsidian-cli-rest/commit/2e487d082937ef6356962dd2eed77d3fe8670f27))

## [1.2.0](https://github.com/dsebastien/obsidian-cli-rest/compare/1.1.9...1.2.0) (2026-07-27)

### Features

* **plugin:** show a what's new dialog once after plugin updates ([25711a5](https://github.com/dsebastien/obsidian-cli-rest/commit/25711a5a54ba97de2f3e13307d3ec189608aeb47))

## [1.1.9](https://github.com/dsebastien/obsidian-cli-rest/compare/1.1.8...1.1.9) (2026-07-17)

## [1.1.8](https://github.com/dsebastien/obsidian-cli-rest/compare/1.1.7...1.1.8) (2026-06-17)

### Bug Fixes

* **deps:** clear all dependency vulnerability advisories ([1a9809e](https://github.com/dsebastien/obsidian-cli-rest/commit/1a9809e473f50a00ab8f1122afcd00a0d09ea05e))

## [1.1.7](https://github.com/dsebastien/obsidian-cli-rest/compare/1.1.6...1.1.7) (2026-06-17)

## [1.1.6](https://github.com/dsebastien/obsidian-cli-rest/compare/1.1.5...1.1.6) (2026-05-15)

## [1.1.5](https://github.com/dsebastien/obsidian-cli-rest/compare/1.1.4...1.1.5) (2026-05-15)

## [1.1.4](https://github.com/dsebastien/obsidian-cli-rest/compare/1.1.3...1.1.4) (2026-05-15)

### Bug Fixes

* **all:** fixed Already connected to a transport issue ([3a17a4b](https://github.com/dsebastien/obsidian-cli-rest/commit/3a17a4b94393127572050a31c4ff93f4d2b33807)), closes [#1](https://github.com/dsebastien/obsidian-cli-rest/issues/1)
* **all:** fixed CLI binary not detected on MacOS ([0444b68](https://github.com/dsebastien/obsidian-cli-rest/commit/0444b689ff43980015c81be7fbfaef4d7832ca75)), closes [#2](https://github.com/dsebastien/obsidian-cli-rest/issues/2)

## [1.1.3](https://github.com/dsebastien/obsidian-cli-rest/compare/1.1.2...1.1.3) (2026-05-15)

## [1.1.2](https://github.com/dsebastien/obsidian-cli-rest/compare/1.1.1...1.1.2) (2026-05-14)

## [1.1.1](https://github.com/dsebastien/obsidian-cli-rest/compare/1.1.0...1.1.1) (2026-05-13)

## [1.1.0](https://github.com/dsebastien/obsidian-cli-rest/compare/1.0.1...1.1.0) (2026-05-13)

### Features

* **all:** improved obsidian cli detection/usage ([c8f6495](https://github.com/dsebastien/obsidian-cli-rest/commit/c8f6495596f7489f9b9d2fc403293c3325171c01))
* **all:** updated release workflow and removed hardcoded cli entries ([4367e3c](https://github.com/dsebastien/obsidian-cli-rest/commit/4367e3c9a80c51790b22f26da56253c0916f3400))

## [1.0.1](https://github.com/dsebastien/obsidian-cli-rest/compare/1.0.0...1.0.1) (2026-04-16)

### Bug Fixes

* **all:** improved obsidian cli detection ([c646e4f](https://github.com/dsebastien/obsidian-cli-rest/commit/c646e4f64cd2408ab0e900999d6bfb10cf4c8cf7))

## [1.0.0](https://github.com/dsebastien/obsidian-cli-rest/compare/0.1.0...1.0.0) (2026-04-15)

### Features

* **all:** improved behavior and performance at startup (loading in the background) ([ad8ad05](https://github.com/dsebastien/obsidian-cli-rest/commit/ad8ad051505224c0320da9cc014c2f27f700ba20))
* **all:** improved MCP and docs ([24b5a85](https://github.com/dsebastien/obsidian-cli-rest/commit/24b5a85ff5cbb910faea646d8419408f2ff6cb6b))
* **all:** updated ([c66b093](https://github.com/dsebastien/obsidian-cli-rest/commit/c66b093a12528e1fe475558b93133f2d3697a26b))

## 0.1.0 (2026-02-21)

### Features

* **all:** improved api docs ([2c9a041](https://github.com/dsebastien/obsidian-cli-rest/commit/2c9a0416380871ae356a88cc8e486b678ed4c1b6))
* **all:** improved command discovery ([0879d7b](https://github.com/dsebastien/obsidian-cli-rest/commit/0879d7bebd0f7e0106303c4b2ace59a8842f9d1e))
* **all:** initial implementation of the RESTful API and MCP server ([58f64da](https://github.com/dsebastien/obsidian-cli-rest/commit/58f64da873e44c579d8d57864e3186fe3552aacf))
* **all:** updated ([1b35202](https://github.com/dsebastien/obsidian-cli-rest/commit/1b352020b8bab46a811c89d0f7e38bc93a742bdc))
* **all:** updated docs ([b08189f](https://github.com/dsebastien/obsidian-cli-rest/commit/b08189faec4e8b3bc51b8f193544a4b007a38e75))















