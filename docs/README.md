---
title: Overview
nav_order: 1
permalink: /
---

# Obsidian CLI REST — User guide

Obsidian CLI REST exposes all Obsidian CLI commands as a local HTTP API and MCP server, enabling programmatic control of your vault from scripts, tools, and AI assistants.

## Key features

- **REST API** — All CLI commands available at `/api/v1/cli/*` via standard HTTP
- **MCP server** — 2-tool Code Mode interface at `/mcp` for AI assistants (search + execute)
- **API key authentication** — Auto-generated Bearer token for secure access
- **Safety controls** — Dangerous command gating, per-command blocklist
- **Configurable** — Port, bind address, CORS, timeouts, independent REST/MCP toggles

## Getting started

### Prerequisites

1. **Obsidian desktop app** (v1.4.0+)
2. **[Obsidian CLI](https://help.obsidian.md/cli)** enabled in Obsidian: **Settings > General > Advanced > Command line interface**

Verify the CLI is available:

```bash
obsidian --version
```

### Install the plugin

1. Open **Settings > Community plugins** in Obsidian
2. Search for **Obsidian CLI REST** and select **Install**
3. Select **Enable**

The server starts automatically on `http://127.0.0.1:27124`.

### Get your API key

1. Go to **Settings > Obsidian CLI REST**
2. In the **Security** section, select **Copy API key**
3. Use this key in the `Authorization` header for all requests

### Make your first request

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://127.0.0.1:27124/api/v1/cli/files
```

You should see a JSON response listing all files in your vault.

## Status bar

When the server is running, the status bar shows:

- **CLI REST: 127.0.0.1:27124** — Server is running with the displayed address
- **CLI REST: off** — Server is stopped

Select the status bar item to toggle the server on/off.

## Obsidian commands

The plugin registers two commands accessible from the command palette:

| Command                    | Description                   |
| -------------------------- | ----------------------------- |
| **Toggle REST/MCP server** | Start or stop the server      |
| **Copy API key**           | Copy the API key to clipboard |

## Further reading

- [Usage guide](usage.md) — Detailed usage examples and patterns
- [API reference](api-reference.md) — Endpoints, request/response formats, status codes
- [MCP integration](mcp-integration.md) — Connect AI assistants
- [Command reference](command-reference.md) — All supported commands
- [Configuration](configuration.md) — All settings explained
- [Tips and troubleshooting](tips.md) — Common issues and solutions

## About

Created by [Sebastien Dubois](https://dsebastien.net). Licensed under MIT.
