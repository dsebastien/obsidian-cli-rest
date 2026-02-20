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
- Health check (`/api/v1/health`) and command list (`/api/v1/commands`) are always available (no auth required) when server is running.
- All CLI command endpoints require API key authentication when a key is configured.
