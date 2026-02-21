# Business Rules

This document defines the core business rules. These rules MUST be respected in all implementations unless explicitly approved otherwise.

---

## Documentation Guidelines

When a new business rule is mentioned:

1. Add it to this document immediately
2. Use a concise format (single line or brief paragraph)
3. Maintain precision - do not lose important details for brevity
4. Include rationale where it adds clarity

## Security

- Default bind address MUST be `127.0.0.1` (localhost only). Remote access (`0.0.0.0`) requires explicit opt-in.
- When bind address is `0.0.0.0`, API key MUST be non-empty. Auto-generate if empty.
- CLI execution MUST use `child_process.execFile` (not `exec`) to prevent shell injection.
- Dangerous commands (`eval`, `restart`, `devtools`, `dev:*`, `command`, `reload`, `plugins:restrict`) require `allowDangerousCommands` setting.
- API key is auto-generated on first plugin enable via `crypto.randomBytes(32)`.

## CLI Requirement

- The Obsidian CLI binary (`obsidian`) must be installed and accessible for CLI endpoints to function.
- If CLI is not found, the server still starts but returns 503 for CLI command requests.
- A `Notice` is shown to the user when CLI is not found on plugin load.

## Plugin Identity

- Plugin ID is `obsidian-cli-rest`. MUST NOT change after release.
- Plugin is desktop-only (`isDesktopOnly: true`) since it requires `child_process`.

## Interfaces

- REST API and MCP server are independently toggleable via settings.
- Health check (`/api/v1/health`), command list (`/api/v1/commands`), OpenAPI spec (`/api/v1/openapi.json`), and API docs (`/api/v1/docs`) are always available (no auth required) when server is running.
- All CLI command endpoints require API key authentication when a key is configured.

## Dynamic CLI Command Discovery

- At startup (when CLI is available), the plugin runs `obsidian help` to discover all available commands.
- Discovered commands are merged with the static registry. Static entries always take precedence (curated metadata wins).
- Newly discovered commands default to: `httpMethod: POST`, `dangerous: true` if in Developer section or matching dangerous patterns, `category: 'discovered'` (or `'developer'`).
- The REST router supports pass-through for completely unknown commands (not in static or discovered registry) via POST only. Other HTTP methods return 405.
- Pass-through commands use the same safe defaults and undergo all standard checks (blocked, dangerous, CLI availability).
- Discovery failure is non-fatal — the plugin falls back to the static registry only.

## Command Palette Commands

- The plugin always registers five command palette commands: toggle server, copy API key, copy REST API URL, copy MCP server URL, copy API docs URL.

## Internal Commands

- `cli-rest:rest-url`, `cli-rest:mcp-url`, and `cli-rest:docs-url` are internal commands handled by the plugin (not proxied to the CLI binary).
- They return the REST API base URL, MCP server URL, and API docs URL respectively, based on current settings.
- They work even when the CLI binary is unavailable.
- They appear in `/api/v1/commands` and as MCP tools like any other command.

## MCP Code Mode Pattern

- The MCP server registers exactly 2 generic tools (`search` and `execute`), not one tool per CLI command. This keeps the MCP tool count fixed regardless of how many commands exist.
- The `search` tool enables progressive discovery via query and category filters. It always returns the full list of available categories.
- The `execute` tool accepts any command string (including unknown/discovered commands). It applies the same validation as the REST API (blocked, dangerous, CLI availability).
- The REST API is unaffected by this pattern — it continues to serve per-command endpoints.

## OpenAPI Documentation

- The OpenAPI 3.1.0 spec is generated dynamically from the command registry at request time, so it always includes runtime-discovered commands.
- API docs (`/api/v1/docs`) and OpenAPI spec (`/api/v1/openapi.json`) are public endpoints (no auth required).
- The docs UI uses Scalar API Reference loaded from CDN. This is acceptable because the HTML page is served to external HTTP clients (browsers), not loaded by Obsidian itself.
