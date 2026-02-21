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

## Command registry

All CLI commands across categories: general, vault, files, outline, search, links, tags, tasks, properties, daily, random, wordcount, templates, bookmarks, bases, commands, hotkeys, workspace, web, plugins, themes, snippets, history, sync, publish, developer.

See `src/app/domain/cli-command-registry.ts` for the complete registry.

### Name conversions

| Context  | Format               | Example        |
| -------- | -------------------- | -------------- |
| CLI      | Colon-separated      | `property:set` |
| REST URL | Slash-separated      | `property/set` |
| MCP tool | Underscore-separated | `property_set` |

Conversion functions: `commandToUrlPath()`, `urlPathToCommand()`, `commandToMcpToolName()`, `mcpToolNameToCommand()`.

## Dangerous commands

Commands marked `dangerous: true` in the registry:

- `reload`, `restart` — Application lifecycle
- `command` — Arbitrary Obsidian command execution
- `eval` — JavaScript evaluation
- `devtools` — Developer tools toggle
- `plugins:restrict` — Restricted mode toggle
- `dev:*` — Developer utilities (console, errors, screenshot, dom, css, mobile, debug, cdp)
