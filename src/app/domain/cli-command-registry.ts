import type { CliCommandDefinition } from './cli-command'

/**
 * Complete registry of all Obsidian CLI commands.
 * Each command maps to its HTTP method, category, danger level, and description.
 *
 * HTTP method mapping:
 * - GET: Read-only / listing commands
 * - POST: Mutating / creation / action commands
 * - DELETE: Removal / deletion commands
 *
 * All endpoints also accept POST as universal fallback.
 */
export const CLI_COMMAND_REGISTRY: readonly CliCommandDefinition[] = [
    // ── General ──────────────────────────────────────────────────────
    {
        command: 'help',
        httpMethod: 'GET',
        category: 'general',
        dangerous: false,
        description: 'Display available commands or help for a specific command'
    },
    {
        command: 'version',
        httpMethod: 'GET',
        category: 'general',
        dangerous: false,
        description: 'Show Obsidian version number'
    },
    {
        command: 'reload',
        httpMethod: 'POST',
        category: 'general',
        dangerous: true,
        description: 'Reload the app window'
    },
    {
        command: 'restart',
        httpMethod: 'POST',
        category: 'general',
        dangerous: true,
        description: 'Restart the application'
    },

    // ── Vault ────────────────────────────────────────────────────────
    {
        command: 'vault',
        httpMethod: 'GET',
        category: 'vault',
        dangerous: false,
        description: 'Show vault info'
    },
    {
        command: 'vaults',
        httpMethod: 'GET',
        category: 'vault',
        dangerous: false,
        description: 'List known vaults (desktop only)'
    },
    // ── Files and Folders ────────────────────────────────────────────
    {
        command: 'file',
        httpMethod: 'GET',
        category: 'files',
        dangerous: false,
        description: 'Show file info (defaults to active file)'
    },
    {
        command: 'files',
        httpMethod: 'GET',
        category: 'files',
        dangerous: false,
        description: 'List files in the vault'
    },
    {
        command: 'folder',
        httpMethod: 'GET',
        category: 'files',
        dangerous: false,
        description: 'Show folder info'
    },
    {
        command: 'folders',
        httpMethod: 'GET',
        category: 'files',
        dangerous: false,
        description: 'List folders in the vault'
    },
    {
        command: 'open',
        httpMethod: 'POST',
        category: 'files',
        dangerous: false,
        description: 'Open a file'
    },
    {
        command: 'create',
        httpMethod: 'POST',
        category: 'files',
        dangerous: false,
        description: 'Create or overwrite a file'
    },
    {
        command: 'read',
        httpMethod: 'GET',
        category: 'files',
        dangerous: false,
        description: 'Read file contents (defaults to active file)'
    },
    {
        command: 'append',
        httpMethod: 'POST',
        category: 'files',
        dangerous: false,
        description: 'Append content to a file (defaults to active file)'
    },
    {
        command: 'prepend',
        httpMethod: 'POST',
        category: 'files',
        dangerous: false,
        description: 'Prepend content after frontmatter (defaults to active file)'
    },
    {
        command: 'move',
        httpMethod: 'POST',
        category: 'files',
        dangerous: false,
        description: 'Move or rename a file (defaults to active file)'
    },
    {
        command: 'rename',
        httpMethod: 'POST',
        category: 'files',
        dangerous: false,
        description: 'Rename a file (defaults to active file)'
    },
    {
        command: 'delete',
        httpMethod: 'DELETE',
        category: 'files',
        dangerous: false,
        description: 'Delete a file (defaults to active file, goes to trash)'
    },

    // ── Outline ──────────────────────────────────────────────────────
    {
        command: 'outline',
        httpMethod: 'GET',
        category: 'outline',
        dangerous: false,
        description: 'Show headings for the current file'
    },

    // ── Search ───────────────────────────────────────────────────────
    {
        command: 'search',
        httpMethod: 'GET',
        category: 'search',
        dangerous: false,
        description: 'Search vault for text, returns matching file paths'
    },
    {
        command: 'search:context',
        httpMethod: 'GET',
        category: 'search',
        dangerous: false,
        description: 'Search with matching line context (grep-style output)'
    },
    {
        command: 'search:open',
        httpMethod: 'POST',
        category: 'search',
        dangerous: false,
        description: 'Open search view'
    },

    // ── Links ────────────────────────────────────────────────────────
    {
        command: 'links',
        httpMethod: 'GET',
        category: 'links',
        dangerous: false,
        description: 'List outgoing links from a file (defaults to active file)'
    },
    {
        command: 'backlinks',
        httpMethod: 'GET',
        category: 'links',
        dangerous: false,
        description: 'List backlinks to a file (defaults to active file)'
    },
    {
        command: 'unresolved',
        httpMethod: 'GET',
        category: 'links',
        dangerous: false,
        description: 'List unresolved links in vault'
    },
    {
        command: 'orphans',
        httpMethod: 'GET',
        category: 'links',
        dangerous: false,
        description: 'List files with no incoming links'
    },
    {
        command: 'deadends',
        httpMethod: 'GET',
        category: 'links',
        dangerous: false,
        description: 'List files with no outgoing links'
    },

    // ── Tags ─────────────────────────────────────────────────────────
    {
        command: 'tags',
        httpMethod: 'GET',
        category: 'tags',
        dangerous: false,
        description: 'List tags in the vault'
    },
    {
        command: 'tag',
        httpMethod: 'GET',
        category: 'tags',
        dangerous: false,
        description: 'Get tag info'
    },

    // ── Tasks ────────────────────────────────────────────────────────
    {
        command: 'tasks',
        httpMethod: 'GET',
        category: 'tasks',
        dangerous: false,
        description: 'List tasks in the vault'
    },
    {
        command: 'task',
        httpMethod: 'POST',
        category: 'tasks',
        dangerous: false,
        description: 'Show or update a task'
    },

    // ── Properties ───────────────────────────────────────────────────
    {
        command: 'aliases',
        httpMethod: 'GET',
        category: 'properties',
        dangerous: false,
        description: 'List aliases in the vault'
    },
    {
        command: 'properties',
        httpMethod: 'GET',
        category: 'properties',
        dangerous: false,
        description: 'List properties in the vault'
    },
    {
        command: 'property:read',
        httpMethod: 'GET',
        category: 'properties',
        dangerous: false,
        description: 'Read a property value from a file (defaults to active file)'
    },
    {
        command: 'property:set',
        httpMethod: 'POST',
        category: 'properties',
        dangerous: false,
        description: 'Set a property on a file (defaults to active file)'
    },
    {
        command: 'property:remove',
        httpMethod: 'DELETE',
        category: 'properties',
        dangerous: false,
        description: 'Remove a property from a file (defaults to active file)'
    },

    // ── Daily Notes ──────────────────────────────────────────────────
    {
        command: 'daily',
        httpMethod: 'POST',
        category: 'daily',
        dangerous: false,
        description: "Open today's daily note"
    },
    {
        command: 'daily:path',
        httpMethod: 'GET',
        category: 'daily',
        dangerous: false,
        description: 'Get daily note path (even if file does not exist yet)'
    },
    {
        command: 'daily:read',
        httpMethod: 'GET',
        category: 'daily',
        dangerous: false,
        description: 'Read daily note contents'
    },
    {
        command: 'daily:append',
        httpMethod: 'POST',
        category: 'daily',
        dangerous: false,
        description: 'Append content to daily note'
    },
    {
        command: 'daily:prepend',
        httpMethod: 'POST',
        category: 'daily',
        dangerous: false,
        description: 'Prepend content to daily note'
    },

    // ── Random Notes ─────────────────────────────────────────────────
    {
        command: 'random',
        httpMethod: 'POST',
        category: 'random',
        dangerous: false,
        description: 'Open a random note'
    },
    {
        command: 'random:read',
        httpMethod: 'GET',
        category: 'random',
        dangerous: false,
        description: 'Read a random note (includes path)'
    },

    // ── Wordcount ────────────────────────────────────────────────────
    {
        command: 'wordcount',
        httpMethod: 'GET',
        category: 'wordcount',
        dangerous: false,
        description: 'Count words and characters (defaults to active file)'
    },

    // ── Templates ────────────────────────────────────────────────────
    {
        command: 'templates',
        httpMethod: 'GET',
        category: 'templates',
        dangerous: false,
        description: 'List templates'
    },
    {
        command: 'template:read',
        httpMethod: 'GET',
        category: 'templates',
        dangerous: false,
        description: 'Read template content'
    },
    {
        command: 'template:insert',
        httpMethod: 'POST',
        category: 'templates',
        dangerous: false,
        description: 'Insert template into active file'
    },

    // ── Bookmarks ────────────────────────────────────────────────────
    {
        command: 'bookmarks',
        httpMethod: 'GET',
        category: 'bookmarks',
        dangerous: false,
        description: 'List bookmarks'
    },
    {
        command: 'bookmark',
        httpMethod: 'POST',
        category: 'bookmarks',
        dangerous: false,
        description: 'Add a bookmark'
    },

    // ── Bases ────────────────────────────────────────────────────────
    {
        command: 'bases',
        httpMethod: 'GET',
        category: 'bases',
        dangerous: false,
        description: 'List all base files in vault'
    },
    {
        command: 'base:views',
        httpMethod: 'GET',
        category: 'bases',
        dangerous: false,
        description: 'List views in the current base file'
    },
    {
        command: 'base:query',
        httpMethod: 'GET',
        category: 'bases',
        dangerous: false,
        description: 'Query a base and return results'
    },
    {
        command: 'base:create',
        httpMethod: 'POST',
        category: 'bases',
        dangerous: false,
        description: 'Create a new item in a base'
    },

    // ── Commands / UI ────────────────────────────────────────────────
    {
        command: 'commands',
        httpMethod: 'GET',
        category: 'commands',
        dangerous: false,
        description: 'List available command IDs'
    },
    {
        command: 'command',
        httpMethod: 'POST',
        category: 'commands',
        dangerous: true,
        description: 'Execute an Obsidian command'
    },

    // ── Hotkeys ──────────────────────────────────────────────────────
    {
        command: 'hotkeys',
        httpMethod: 'GET',
        category: 'hotkeys',
        dangerous: false,
        description: 'List hotkeys for all commands'
    },
    {
        command: 'hotkey',
        httpMethod: 'GET',
        category: 'hotkeys',
        dangerous: false,
        description: 'Get hotkey for a command'
    },

    // ── Tabs ─────────────────────────────────────────────────────────
    {
        command: 'tabs',
        httpMethod: 'GET',
        category: 'workspace',
        dangerous: false,
        description: 'List open tabs'
    },
    {
        command: 'tab:open',
        httpMethod: 'POST',
        category: 'workspace',
        dangerous: false,
        description: 'Open a new tab'
    },
    {
        command: 'recents',
        httpMethod: 'GET',
        category: 'workspace',
        dangerous: false,
        description: 'List recently opened files'
    },

    // ── Web Viewer ───────────────────────────────────────────────────
    {
        command: 'web',
        httpMethod: 'POST',
        category: 'web',
        dangerous: false,
        description: 'Open URL in web viewer'
    },

    // ── Workspaces ───────────────────────────────────────────────────
    {
        command: 'workspace',
        httpMethod: 'GET',
        category: 'workspace',
        dangerous: false,
        description: 'Show workspace tree'
    },
    {
        command: 'workspaces',
        httpMethod: 'GET',
        category: 'workspace',
        dangerous: false,
        description: 'List saved workspaces'
    },
    {
        command: 'workspace:save',
        httpMethod: 'POST',
        category: 'workspace',
        dangerous: false,
        description: 'Save current layout as workspace'
    },
    {
        command: 'workspace:load',
        httpMethod: 'POST',
        category: 'workspace',
        dangerous: false,
        description: 'Load a saved workspace'
    },
    {
        command: 'workspace:delete',
        httpMethod: 'DELETE',
        category: 'workspace',
        dangerous: false,
        description: 'Delete a saved workspace'
    },

    // ── Plugins ──────────────────────────────────────────────────────
    {
        command: 'plugins',
        httpMethod: 'GET',
        category: 'plugins',
        dangerous: false,
        description: 'List installed plugins'
    },
    {
        command: 'plugins:enabled',
        httpMethod: 'GET',
        category: 'plugins',
        dangerous: false,
        description: 'List enabled plugins'
    },
    {
        command: 'plugins:restrict',
        httpMethod: 'POST',
        category: 'plugins',
        dangerous: true,
        description: 'Toggle or check restricted mode'
    },
    {
        command: 'plugin',
        httpMethod: 'GET',
        category: 'plugins',
        dangerous: false,
        description: 'Get plugin info'
    },
    {
        command: 'plugin:enable',
        httpMethod: 'POST',
        category: 'plugins',
        dangerous: false,
        description: 'Enable a plugin'
    },
    {
        command: 'plugin:disable',
        httpMethod: 'POST',
        category: 'plugins',
        dangerous: false,
        description: 'Disable a plugin'
    },
    {
        command: 'plugin:install',
        httpMethod: 'POST',
        category: 'plugins',
        dangerous: false,
        description: 'Install a community plugin'
    },
    {
        command: 'plugin:uninstall',
        httpMethod: 'DELETE',
        category: 'plugins',
        dangerous: false,
        description: 'Uninstall a community plugin'
    },
    {
        command: 'plugin:reload',
        httpMethod: 'POST',
        category: 'plugins',
        dangerous: false,
        description: 'Reload a plugin (for developers)'
    },

    // ── Themes ────────────────────────────────────────────────────────
    {
        command: 'themes',
        httpMethod: 'GET',
        category: 'themes',
        dangerous: false,
        description: 'List installed themes'
    },
    {
        command: 'theme',
        httpMethod: 'GET',
        category: 'themes',
        dangerous: false,
        description: 'Show active theme or get info'
    },
    {
        command: 'theme:set',
        httpMethod: 'POST',
        category: 'themes',
        dangerous: false,
        description: 'Set active theme'
    },
    {
        command: 'theme:install',
        httpMethod: 'POST',
        category: 'themes',
        dangerous: false,
        description: 'Install a community theme'
    },
    {
        command: 'theme:uninstall',
        httpMethod: 'DELETE',
        category: 'themes',
        dangerous: false,
        description: 'Uninstall a theme'
    },

    // ── CSS Snippets ─────────────────────────────────────────────────
    {
        command: 'snippets',
        httpMethod: 'GET',
        category: 'snippets',
        dangerous: false,
        description: 'List installed CSS snippets'
    },
    {
        command: 'snippets:enabled',
        httpMethod: 'GET',
        category: 'snippets',
        dangerous: false,
        description: 'List enabled CSS snippets'
    },
    {
        command: 'snippet:enable',
        httpMethod: 'POST',
        category: 'snippets',
        dangerous: false,
        description: 'Enable a CSS snippet'
    },
    {
        command: 'snippet:disable',
        httpMethod: 'POST',
        category: 'snippets',
        dangerous: false,
        description: 'Disable a CSS snippet'
    },

    // ── File History ─────────────────────────────────────────────────
    {
        command: 'diff',
        httpMethod: 'GET',
        category: 'history',
        dangerous: false,
        description: 'List or compare file versions from local recovery and Sync'
    },
    {
        command: 'history',
        httpMethod: 'GET',
        category: 'history',
        dangerous: false,
        description: 'List versions from file recovery only'
    },
    {
        command: 'history:list',
        httpMethod: 'GET',
        category: 'history',
        dangerous: false,
        description: 'List all files with local history'
    },
    {
        command: 'history:read',
        httpMethod: 'GET',
        category: 'history',
        dangerous: false,
        description: 'Read a local history version'
    },
    {
        command: 'history:restore',
        httpMethod: 'POST',
        category: 'history',
        dangerous: false,
        description: 'Restore a local history version'
    },
    {
        command: 'history:open',
        httpMethod: 'POST',
        category: 'history',
        dangerous: false,
        description: 'Open file recovery UI'
    },

    // ── Sync ─────────────────────────────────────────────────────────
    {
        command: 'sync',
        httpMethod: 'POST',
        category: 'sync',
        dangerous: false,
        description: 'Pause or resume sync'
    },
    {
        command: 'sync:status',
        httpMethod: 'GET',
        category: 'sync',
        dangerous: false,
        description: 'Show sync status and usage'
    },
    {
        command: 'sync:history',
        httpMethod: 'GET',
        category: 'sync',
        dangerous: false,
        description: 'List sync version history for a file (defaults to active file)'
    },
    {
        command: 'sync:read',
        httpMethod: 'GET',
        category: 'sync',
        dangerous: false,
        description: 'Read a sync version (defaults to active file)'
    },
    {
        command: 'sync:restore',
        httpMethod: 'POST',
        category: 'sync',
        dangerous: false,
        description: 'Restore a sync version (defaults to active file)'
    },
    {
        command: 'sync:open',
        httpMethod: 'POST',
        category: 'sync',
        dangerous: false,
        description: 'Open sync history (defaults to active file)'
    },
    {
        command: 'sync:deleted',
        httpMethod: 'GET',
        category: 'sync',
        dangerous: false,
        description: 'List deleted files in sync'
    },

    // ── Publish ──────────────────────────────────────────────────────
    {
        command: 'publish:site',
        httpMethod: 'GET',
        category: 'publish',
        dangerous: false,
        description: 'Show publish site info (slug, URL)'
    },
    {
        command: 'publish:list',
        httpMethod: 'GET',
        category: 'publish',
        dangerous: false,
        description: 'List published files'
    },
    {
        command: 'publish:status',
        httpMethod: 'GET',
        category: 'publish',
        dangerous: false,
        description: 'List publish changes'
    },
    {
        command: 'publish:add',
        httpMethod: 'POST',
        category: 'publish',
        dangerous: false,
        description: 'Publish a file or all changed files (defaults to active file)'
    },
    {
        command: 'publish:remove',
        httpMethod: 'DELETE',
        category: 'publish',
        dangerous: false,
        description: 'Unpublish a file (defaults to active file)'
    },
    {
        command: 'publish:open',
        httpMethod: 'POST',
        category: 'publish',
        dangerous: false,
        description: 'Open file on published site (defaults to active file)'
    },

    // ── Internal (handled by plugin, not proxied to CLI) ─────────────
    {
        command: 'cli-rest:rest-url',
        httpMethod: 'GET',
        category: 'internal',
        dangerous: false,
        description: 'Get the REST API base URL'
    },
    {
        command: 'cli-rest:mcp-url',
        httpMethod: 'GET',
        category: 'internal',
        dangerous: false,
        description: 'Get the MCP server URL'
    },

    // ── Developer ────────────────────────────────────────────────────
    {
        command: 'devtools',
        httpMethod: 'POST',
        category: 'developer',
        dangerous: true,
        description: 'Toggle Electron dev tools'
    },
    {
        command: 'eval',
        httpMethod: 'POST',
        category: 'developer',
        dangerous: true,
        description: 'Execute JavaScript and return result'
    },
    {
        command: 'dev:console',
        httpMethod: 'GET',
        category: 'developer',
        dangerous: true,
        description: 'Show captured console messages'
    },
    {
        command: 'dev:errors',
        httpMethod: 'GET',
        category: 'developer',
        dangerous: true,
        description: 'Show captured JavaScript errors'
    },
    {
        command: 'dev:screenshot',
        httpMethod: 'POST',
        category: 'developer',
        dangerous: true,
        description: 'Take a screenshot (returns base64 PNG)'
    },
    {
        command: 'dev:dom',
        httpMethod: 'GET',
        category: 'developer',
        dangerous: true,
        description: 'Query DOM elements'
    },
    {
        command: 'dev:css',
        httpMethod: 'GET',
        category: 'developer',
        dangerous: true,
        description: 'Inspect CSS with source locations'
    },
    {
        command: 'dev:mobile',
        httpMethod: 'POST',
        category: 'developer',
        dangerous: true,
        description: 'Toggle mobile emulation'
    },
    {
        command: 'dev:debug',
        httpMethod: 'POST',
        category: 'developer',
        dangerous: true,
        description: 'Attach/detach Chrome DevTools Protocol debugger'
    },
    {
        command: 'dev:cdp',
        httpMethod: 'POST',
        category: 'developer',
        dangerous: true,
        description: 'Run a Chrome DevTools Protocol command'
    }
] as const

/**
 * Commands handled internally by the plugin (not proxied to CLI binary).
 */
export const INTERNAL_COMMANDS = new Set(['cli-rest:rest-url', 'cli-rest:mcp-url'])

// ── Static command map (built once from the registry) ──────────────────────
const staticCommandMap = new Map<string, CliCommandDefinition>()
for (const def of CLI_COMMAND_REGISTRY) {
    staticCommandMap.set(def.command, def)
}

// ── Runtime discovered commands ────────────────────────────────────────────
let discoveredCommands: CliCommandDefinition[] = []
let fullCommandMap = new Map<string, CliCommandDefinition>(staticCommandMap)

/**
 * Patterns that indicate a dangerous command.
 * Matches business rules: dev:*, eval, restart, reload, devtools, command, plugins:restrict
 */
const DANGEROUS_PATTERNS = [
    /^dev:/,
    /^eval$/,
    /^restart$/,
    /^reload$/,
    /^devtools$/,
    /^command$/,
    /^plugins:restrict$/
]

/**
 * Check if a command name matches known dangerous patterns.
 */
export function isDangerousPattern(command: string): boolean {
    return DANGEROUS_PATTERNS.some((pattern) => pattern.test(command))
}

/**
 * Merge dynamically discovered commands into the runtime registry.
 * Static entries always take precedence (curated metadata wins).
 */
export function mergeDiscoveredCommands(commands: CliCommandDefinition[]): void {
    discoveredCommands = commands.filter((cmd) => !staticCommandMap.has(cmd.command))
    rebuildFullMap()
}

/**
 * Clear all discovered commands (for test cleanup).
 */
export function resetDiscoveredCommands(): void {
    discoveredCommands = []
    rebuildFullMap()
}

function rebuildFullMap(): void {
    fullCommandMap = new Map<string, CliCommandDefinition>(staticCommandMap)
    for (const cmd of discoveredCommands) {
        fullCommandMap.set(cmd.command, cmd)
    }
}

/**
 * Look up a CLI command definition by its command name.
 * Checks both static and discovered commands.
 */
export function getCommandDefinition(command: string): CliCommandDefinition | undefined {
    return fullCommandMap.get(command)
}

/**
 * Get all CLI command definitions (static + discovered).
 */
export function getAllCommands(): readonly CliCommandDefinition[] {
    if (discoveredCommands.length === 0) {
        return CLI_COMMAND_REGISTRY
    }
    return [...CLI_COMMAND_REGISTRY, ...discoveredCommands]
}

/**
 * Convert a CLI command name to a URL path segment.
 * e.g., "property:set" → "property/set"
 */
export function commandToUrlPath(command: string): string {
    return command.replace(/:/g, '/')
}

/**
 * Convert a URL path segment back to a CLI command name.
 * e.g., "property/set" → "property:set"
 */
export function urlPathToCommand(urlPath: string): string {
    return urlPath.replace(/\//g, ':')
}

/**
 * Convert a CLI command name to an MCP tool name.
 * MCP tool names can't contain ':' or '/'.
 * e.g., "property:set" → "property_set"
 */
export function commandToMcpToolName(command: string): string {
    return command.replace(/:/g, '_')
}

/**
 * Convert an MCP tool name back to a CLI command name.
 * e.g., "property_set" → "property:set"
 */
export function mcpToolNameToCommand(toolName: string): string {
    return toolName.replace(/_/g, ':')
}

/**
 * Get all unique categories from the registry (static + discovered).
 */
export function getCategories(): string[] {
    const categories = new Set<string>()
    for (const def of getAllCommands()) {
        categories.add(def.category)
    }
    return [...categories]
}
