# Architecture

## Overview

Obsidian CLI REST is an Obsidian plugin that exposes all Obsidian CLI commands via:

1. **REST API** (`/api/v1/cli/*`) — HTTP proxy to CLI commands
2. **MCP server** (`/mcp`) — Model Context Protocol for AI tool integration

Both interfaces share a single `node:http` server with configurable bind address and port.

## Request flow

```
HTTP Request
  → HTTP Server (http-server.ts)
    → CORS preflight check (if CORS enabled)
    → Route by URL prefix:
      /api/v1/health     → Health handler (no auth) → JSON response
      /api/v1/commands   → Commands handler (no auth) → JSON response
      /api/v1/cli/*      → Auth middleware → Request Router → CLI Executor → Response Builder
      /mcp               → Auth middleware → MCP Transport → Tool Handler → CLI Executor
      *                  → 404 Not Found
```

## Component diagram

```
┌─────────────────────────────────────────────────────────┐
│ Plugin (plugin.ts)                                      │
│  ├─ Lifecycle: onload / onunload                        │
│  ├─ Settings management (Zod + Immer)                   │
│  ├─ CLI availability check                              │
│  ├─ API key generation                                  │
│  ├─ Status bar indicator                                │
│  └─ Command palette registration                        │
├─────────────────────────────────────────────────────────┤
│ HTTP Server (http-server.ts)                            │
│  ├─ node:http server                                    │
│  ├─ Request routing by URL prefix                       │
│  ├─ CORS preflight handling                             │
│  └─ Delegates to REST or MCP handler                    │
├──────────────────────┬──────────────────────────────────┤
│ REST Path            │ MCP Path                         │
│  ├─ Auth middleware   │  ├─ Auth middleware              │
│  ├─ Request parser    │  ├─ WebStandard StreamableHTTP   │
│  ├─ Request router    │  ├─ MCP Server (SDK)             │
│  ├─ CLI executor      │  ├─ Tool handlers → CLI executor │
│  └─ Response builder  │  └─ JSON tool results            │
├──────────────────────┴──────────────────────────────────┤
│ Shared                                                  │
│  ├─ CLI Command Registry (all CLI commands)              │
│  ├─ CLI Availability Checker                            │
│  ├─ CLI Executor (child_process.execFile)               │
│  └─ Settings (Zod schema, Immer state)                  │
└─────────────────────────────────────────────────────────┘
```

## Key components

### Plugin lifecycle (`src/app/plugin.ts`)

- `ObsidianCliRestPlugin` extends Obsidian's `Plugin`
- **onload**: Check CLI availability, generate API key (if missing), register commands, add settings tab, optionally auto-start server
- **onunload**: Stop server and clean up resources
- Status bar shows server state: address:port when running, "off" when stopped

### CLI layer (`src/app/services/`)

- **cli-availability-checker.ts**: Finds the `obsidian` binary by searching PATH, `/usr/local/bin`, `/usr/bin`
- **cli-executor.ts**: Runs CLI commands via `child_process.execFile` (prevents shell injection). Supports configurable timeout and 10 MB output buffer.

### HTTP layer (`src/app/services/`)

- **http-server.ts**: `node:http` server wrapper. Routes requests by URL prefix to REST handlers or MCP handler. Handles CORS preflight when enabled.
- **auth-middleware.ts**: Validates `Authorization: Bearer <key>` header. Skips validation if API key is empty.
- **request-router.ts**: Maps URL paths to CLI commands. Handles health check, command list, and CLI command dispatch. Validates HTTP methods and checks command permissions (blocked, dangerous).
- **request-parser.ts**: Parses GET query parameters and POST/DELETE JSON bodies into a normalized format (`vault`, `params`, `flags`).
- **response-builder.ts**: Builds JSON envelope responses. Adds CORS headers when enabled. Maps results to appropriate HTTP status codes.

### MCP layer (`src/app/services/mcp-server.ts`)

- Uses `@modelcontextprotocol/sdk` with StreamableHTTP transport
- Registers one tool per CLI command from the command registry
- Each tool has the same Zod-validated schema: `{ vault?, params?, flags? }`
- Stateless: creates a new transport per request, no persistent connections
- Applies same validation as REST: blocked commands, dangerous gates, CLI availability

### Domain (`src/app/domain/`)

- **cli-command-registry.ts**: Static registry of all CLI commands with metadata. Provides lookup, URL/MCP name conversion, and category listing.
- **cli-command.ts**: `CliCommandDefinition` interface
- **api-response.ts**: `ApiSuccessResponse` and `ApiErrorResponse` types
- **http-method.ts**: `HttpMethod` type (`'GET' | 'POST' | 'DELETE'`)

### Settings (`src/app/types/plugin-settings.intf.ts`)

- Zod-validated schema with 11 settings
- `DEFAULT_SETTINGS` derived from Zod defaults
- Immer-based immutable state management in the plugin

### Settings tab (`src/app/settings/settings-tab.ts`)

- Organized into sections: Status, Server, Interfaces, Security, Command filtering, Advanced
- Shows security warnings when binding to `0.0.0.0`
- API key display with copy and regenerate buttons

## Security model

- **Default bind**: `127.0.0.1` (localhost only)
- **API key auth**: `Authorization: Bearer <key>` header on protected endpoints
- **Key enforcement**: When binding to `0.0.0.0`, API key must be non-empty (auto-generated if needed)
- **Dangerous command gating**: Commands marked `dangerous` require `allowDangerousCommands` setting
- **Per-command blocklist**: Configurable via settings
- **Shell injection prevention**: `execFile` (not `exec`) prevents argument expansion
- **No telemetry**: All processing is local, no data leaves the machine

## Test vault

The `test-vault/` directory is an Obsidian vault used for development and manual testing. It has the Obsidian CLI enabled and is registered as a known vault.

- **Purpose**: Manual testing of CLI commands, REST API, and MCP server during development
- **Dev build auto-copy**: `bun run dev` automatically copies built plugin artifacts (`main.js`, `manifest.json`, `styles.css`) to `test-vault/.obsidian/plugins/obsidian-cli-rest/`
- **Core plugins**: Key core plugins (daily-notes, templates, bookmarks, sync, workspaces, webviewer, etc.) should be enabled for full command coverage
- **Test data**: Contains sample notes, folders, tags, and tasks for exercising CLI commands
- **Build artifacts are git-ignored**: `test-vault/.obsidian/plugins/` is excluded from version control

To test a CLI command against the test vault:

```bash
obsidian vault=test-vault <command> [options]
```

## Directory structure

```
src/
├── main.ts                              # Entry point (re-exports plugin)
├── styles.src.css                       # Tailwind CSS source
├── utils/
│   ├── crypto.ts                        # API key generation
│   ├── crypto.spec.ts
│   └── log.ts                           # Logging utility
└── app/
    ├── plugin.ts                        # Plugin lifecycle
    ├── types/
    │   └── plugin-settings.intf.ts      # Zod settings schema
    ├── settings/
    │   └── settings-tab.ts              # Settings UI
    ├── commands/
    │   └── toggle-server.ts             # Toggle server command
    ├── domain/
    │   ├── cli-command.ts               # CliCommandDefinition interface
    │   ├── cli-command-registry.ts      # All CLI command definitions
    │   ├── cli-command-registry.spec.ts
    │   ├── api-response.ts              # API response types
    │   └── http-method.ts               # HTTP method type
    └── services/
        ├── http-server.ts               # HTTP server wrapper
        ├── mcp-server.ts                # MCP server wrapper
        ├── auth-middleware.ts           # Bearer token validation
        ├── auth-middleware.spec.ts
        ├── cli-availability-checker.ts  # CLI binary discovery
        ├── cli-availability-checker.spec.ts
        ├── cli-executor.ts              # CLI command execution
        ├── cli-executor.spec.ts
        ├── request-parser.ts            # Request body/query parsing
        ├── request-parser.spec.ts
        ├── request-router.ts            # URL-to-command routing
        ├── request-router.spec.ts
        ├── response-builder.ts          # JSON response construction
        └── response-builder.spec.ts
```

## Dependencies

### Runtime

- `obsidian` — Obsidian API types and Plugin base class
- `@modelcontextprotocol/sdk` — MCP server SDK (StreamableHTTP transport)
- `zod` — Schema validation for settings and MCP tool inputs
- `immer` — Immutable state updates for settings

### Node built-ins (bundled)

- `node:http` — HTTP server
- `node:child_process` — CLI execution (`execFile`)
- `node:crypto` — API key generation (`randomBytes`)
