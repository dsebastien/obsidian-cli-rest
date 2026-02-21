# Domain Model

## Core types

### PluginSettings

Zod-validated settings schema. See `src/app/types/plugin-settings.intf.ts`.

11 fields: `autoStart`, `port`, `bindAddress`, `apiKey`, `requestTimeout`, `enableRestApi`, `enableMcp`, `allowDangerousCommands`, `blockedCommands`, `enableCors`, `defaultVault`.

### CliCommandDefinition

Metadata for a single CLI command (`src/app/domain/cli-command.ts`):

- `command`: CLI command name (e.g., `property:set`)
- `httpMethod`: `GET` | `POST` | `DELETE`
- `category`: Grouping label (e.g., `files`, `search`, `plugins`)
- `dangerous`: Whether the command requires `allowDangerousCommands`
- `description`: Human-readable description

### CliAvailabilityResult

Result of checking for the `obsidian` binary (`src/app/services/cli-availability-checker.ts`):

- `available`: Whether the binary was found
- `binaryPath`: Full path to the binary
- `version`: CLI version string
- `error`: Error message if unavailable

### CliExecutionResult

Result of executing a CLI command (`src/app/services/cli-executor.ts`):

- `stdout`: Standard output
- `stderr`: Standard error
- `exitCode`: Process exit code
- `duration`: Execution time in milliseconds

### ApiResponse

JSON envelope returned by REST endpoints (`src/app/domain/api-response.ts`):

- `ApiSuccessResponse`: `{ ok: true, command, exitCode, stdout, stderr, duration }`
- `ApiErrorResponse`: `{ ok: false, error, command?, exitCode?, stdout?, stderr?, duration? }`

### HttpMethod

HTTP method type (`src/app/domain/http-method.ts`): `'GET' | 'POST' | 'DELETE'`

### DiscoveredCommand

A command discovered from `obsidian help` output (`src/app/services/cli-command-discovery.ts`):

- `command`: CLI command name (e.g., `new:feature`)
- `description`: Human-readable description from help output
- `section`: `'commands'` | `'developer'` — which section of help output it appeared in

## Command registry

Static registry of all CLI commands plus dynamically discovered commands. Categories: general, vault, files, outline, search, links, tags, tasks, properties, daily, random, wordcount, templates, bookmarks, bases, commands, hotkeys, workspace, web, plugins, themes, snippets, history, sync, publish, developer, discovered.

See `src/app/domain/cli-command-registry.ts` for the complete registry.

At startup, `obsidian help` is run to discover all available commands. Discovered commands are merged with the static registry — static entries always take precedence. New commands get `httpMethod: POST`, `category: 'discovered'` (or `'developer'` if in Developer section), and `dangerous: true` if matching dangerous patterns.

### Name conversions

| Context  | Format          | Example        |
| -------- | --------------- | -------------- |
| CLI      | Colon-separated | `property:set` |
| REST URL | Slash-separated | `property/set` |
| MCP      | Colon notation  | `property:set` |

The MCP `execute` tool accepts command names in their original colon notation (e.g., `property:set`). The REST API uses slash-separated URL paths.

Conversion functions: `commandToUrlPath()`, `urlPathToCommand()`. The MCP name conversion functions (`commandToMcpToolName()`, `mcpToolNameToCommand()`) are retained for compatibility but no longer used by the MCP server (which uses the Code Mode pattern with 2 generic tools instead of per-command tools).

### Search and discovery

`searchCommands()` supports progressive discovery for the MCP Code Mode pattern:

- No args: returns all commands + all categories (overview mode)
- `query`: case-insensitive substring match against command name and description
- `category`: exact match filter on category
- Both filters combine with AND logic
- Always returns the full list of available categories

## Dangerous commands

Commands marked `dangerous: true` in the registry:

- `reload`, `restart` — Application lifecycle
- `command` — Arbitrary Obsidian command execution
- `eval` — JavaScript evaluation
- `devtools` — Developer tools toggle
- `plugins:restrict` — Restricted mode toggle
- `dev:*` — Developer utilities (console, errors, screenshot, dom, css, mobile, debug, cdp)
