# Cache CLI Discovery by Version

## Context

Plugin startup used to block on two CLI spawns: `obsidian version` (availability probe) and `obsidian help` (command discovery). On 2026-04-15 both were moved into a deferred `initializeInBackground()` task in `src/app/plugin.ts`, so Obsidian's load is no longer blocked. The work still runs on every plugin load.

This plan covers the optional follow-up: skip discovery entirely when the CLI version hasn't changed since the last successful run.

## Goal

Run `obsidian help` only when:

1. The plugin has never successfully discovered commands, or
2. The current CLI version differs from the version recorded during the last successful discovery.

The availability probe (`obsidian version`) must still run on every load — it's the source of the version string used for the cache key, and it's also what reveals whether the binary is currently reachable.

## Approach

### Cache shape

Persist alongside existing plugin data (`loadData()` / `saveData()`):

```ts
interface DiscoveryCache {
    cliVersion: string // stdout of `obsidian version` at time of capture
    commands: DiscoveredCommand[] // raw shape from cli-command-discovery.ts
    capturedAt: string // ISO timestamp, for debugging only
}
```

Store under a dedicated key so it doesn't mix with user settings. Two options:

- **Separate key in the same blob**: extend the persisted object to `{ settings, discoveryCache }`. Requires a migration in `loadSettings()` to tolerate the old shape (settings at the root).
- **Separate file via `this.loadData()` / `this.saveData()`**: Obsidian only exposes one data blob per plugin, so this is the same as option 1 in practice. Prefer option 1.

Pick option 1. Keep the settings-tab Zod schema untouched; validate `discoveryCache` independently and drop it on parse failure (graceful fallback: re-discover).

### Flow in `initializeInBackground()`

```
1. cliStatus = await checkCliAvailability()
2. if !cliStatus.available -> notice, updateContext on servers, return
3. if discoveryCache && discoveryCache.cliVersion === cliStatus.version:
       mergeDiscoveredCommands(cachedCommands)
       log('Using cached CLI command discovery for version X')
   else:
       discovered = await discoverCliCommands(cliStatus.binaryPath)
       mergeDiscoveredCommands(discovered)
       persist { cliVersion: cliStatus.version, commands: discovered, capturedAt: now }
4. updateContext on running servers
5. autoStart if configured
```

The cache hit path avoids the `obsidian help` spawn entirely — the only remaining spawn is the version probe, which is cheap and unavoidable.

### Invalidation

- **Version change**: handled by the equality check above.
- **User-initiated refresh**: `recheckCli()` in `plugin.ts` should always force re-discovery, since the user's explicit action signals they want fresh data. Add a `forceRediscover` flag or just skip the cache read in that path.
- **Parse failure or corrupt cache**: treat as cache miss, re-discover.
- **Empty cached commands**: treat as cache miss (defensive — a prior failed run may have persisted `[]`).

### Migration

Existing users have `this.loadData()` returning settings-only. On load:

- If the top-level object has any `DEFAULT_SETTINGS` key at the root, treat it as legacy and wrap: `{ settings: loaded, discoveryCache: undefined }`.
- Persist immediately in the new shape on the next `saveData()`.

This keeps `pluginSettingsSchema.safeParse` working against `loaded.settings` instead of `loaded`.

## Files to touch

- `src/app/types/plugin-settings.intf.ts` — add `DiscoveryCache` type; do not add to `PluginSettings` (it's not a user setting). Consider a sibling `PluginData` type: `{ settings: PluginSettings, discoveryCache?: DiscoveryCache }`.
- `src/app/plugin.ts`:
    - `loadSettings()` — handle both legacy and new blob shapes; expose `this.discoveryCache`.
    - `saveSettings()` — persist both halves.
    - `initializeInBackground()` — cache-aware discovery; persist after successful discovery.
    - `recheckCli()` — bypass cache.
- `src/app/domain/cli-command-registry.ts` — no changes expected; `mergeDiscoveredCommands()` already accepts the mapped definitions. Re-use the existing mapping logic from `discoverCommands()` (currently a closure inside `plugin.ts`). Consider extracting `mapDiscoveredToDefinitions()` so both the cache-hit and cache-miss paths use the same conversion.

## Tests

- `plugin.ts` behavior isn't directly unit-tested today, so prioritize extracting the cache decision into a pure helper, e.g. `shouldRediscover(cache, currentVersion): boolean`, and unit-test that.
- Add a test for the migration: legacy blob (settings at root) loads without data loss and without discovery cache.
- Add a test for corrupt-cache fallback: malformed `discoveryCache` is discarded, plugin still loads, discovery runs as usual.
- Extend `cli-command-discovery.spec.ts` only if a new pure helper lands there.

## Risks / Open questions

- **Stale cache after CLI upgrade with same version string**: impossible in practice (CLI version stdout changes per release), but worth noting — we're trusting `obsidian version` output as a stable cache key. If needed later, hash the help output and compare.
- **Cache across Obsidian vaults**: each vault has its own plugin data, so each vault re-discovers once. That's acceptable — no cross-vault sharing needed.
- **Dangerous-pattern rules drift**: `isDangerousPattern` is applied at mapping time. If rules change in a future release, cached discoveries still carry the old `dangerous` flag. Mitigation: map on read (apply `isDangerousPattern` to cached raw `DiscoveredCommand[]` during load) rather than storing the derived `CliCommandDefinition[]`. The cache shape above already stores raw `DiscoveredCommand`, so this is handled by design.

## Done when

- Second and subsequent plugin loads skip `obsidian help` when the CLI version hasn't changed.
- A CLI upgrade (different version stdout) triggers exactly one re-discovery.
- `recheckCli` still forces a fresh discovery.
- Legacy data blobs load without error or data loss.
