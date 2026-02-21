# Release notes

## 0.1.0

Initial release.

### Features

- REST API exposing all Obsidian CLI commands at `/api/v1/cli/*`
- MCP server at `/mcp` with StreamableHTTP transport for AI assistant integration
- API key authentication with auto-generation
- Dangerous command gating (14 commands require explicit opt-in)
- Per-command blocklist
- CORS support
- Health check and command listing endpoints (no auth required)
- Settings tab with status, server, interfaces, security, command filtering, and advanced sections
- Status bar indicator showing server address or off state
- Toggle server and copy API key commands
- Auto-start on plugin load
- Default vault setting for multi-vault setups
