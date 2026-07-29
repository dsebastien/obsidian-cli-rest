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

### Installation

#### Community plugins (recommended)

1. In Obsidian, go to **Settings → Community plugins**.
2. Disable **Restricted mode** if it's enabled.
3. Select **Browse**, search for **REST and MCP server**, install it, then enable it.

You can also browse the catalog on the [Obsidian Community](https://community.obsidian.md/) website.

#### Manual installation

If the plugin isn't listed in the community catalog yet (or you want a specific version):

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/dsebastien/obsidian-cli-rest/releases).
2. Copy them into `<Vault>/.obsidian/plugins/cli-rest-mcp/`.
3. Reload Obsidian and enable **REST and MCP server** in **Settings → Community plugins**.

#### BRAT (bleeding edge)

[BRAT](https://github.com/TfTHacker/obsidian42-brat) (Beta Reviewers Auto-update Tool) installs plugins straight from a GitHub repo and keeps them updated automatically. Use this if you want the latest commits — **things might break**.

1. Install **Obsidian42 - BRAT** from **Settings → Community plugins → Browse** and enable it.
2. Run **BRAT: Add a beta plugin for testing** from the command palette.
3. Paste `https://github.com/dsebastien/obsidian-cli-rest`.
4. Select the latest version and confirm.
5. Enable **REST and MCP server** in **Settings → Community plugins**.

Once enabled, the server starts automatically on `http://127.0.0.1:27124`.

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

<!-- support-cta -->
## News & support

To stay up to date about this plugin, Obsidian in general, Personal Knowledge Management and note-taking:

- Subscribe to [my newsletter](https://dsebastien.net/newsletter)
- Subscribe to [my YouTube channel](https://youtube.com/@dsebastien)
- Join the [Knowii community](https://www.store.dsebastien.net/product/knowii-community/) and learn to organize your notes and put your knowledge to work, together with fellow knowledge workers

If this plugin is useful to you, here are the best ways to support my work ❤️:

- [Join the Knowii community](https://www.store.dsebastien.net/product/knowii-community/)
- [Become a GitHub Sponsor](https://github.com/sponsors/dsebastien)
- [Buy me a coffee](https://www.buymeacoffee.com/dsebastien)
- [Subscribe to my YouTube channel](https://youtube.com/@dsebastien)
- [Check out my products](https://store.dsebastien.net)
