# Obsidian CLI REST

Control your Obsidian vault programmatically. This plugin turns **all Obsidian CLI commands** into a local HTTP API and MCP server, letting you automate your workflow from scripts, tools, and AI assistants.

## Why use this plugin?

- **Automate note-taking**: Create, read, search, and modify notes from any script or tool
- **Connect AI assistants**: Let Claude, ChatGPT, or other AI tools interact with your vault via MCP
- **Build integrations**: Hook Obsidian into your existing workflow with standard HTTP requests
- **Stay secure**: Localhost-only by default, API key authentication, granular command controls

## Requirements

- **Obsidian desktop app** (v1.4.0 or later)
- **[Obsidian CLI](https://help.obsidian.md/cli)** enabled in Obsidian: **Settings > General > Advanced > Command line interface**

## Installation

### Community plugins (recommended)

1. In Obsidian, go to **Settings → Community plugins**.
2. Disable **Restricted mode** if it's enabled.
3. Select **Browse**, search for **REST and MCP server**, install it, then enable it.

You can also browse the catalog on the [Obsidian Community](https://community.obsidian.md/) website.

### Manual installation

If the plugin isn't listed in the community catalog yet (or you want a specific version):

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/dsebastien/obsidian-cli-rest/releases).
2. Copy them into `<Vault>/.obsidian/plugins/cli-rest-mcp/`.
3. Reload Obsidian and enable **REST and MCP server** in **Settings → Community plugins**.

### BRAT (bleeding edge)

[BRAT](https://github.com/TfTHacker/obsidian42-brat) (Beta Reviewers Auto-update Tool) installs plugins straight from a GitHub repo and keeps them updated automatically. Use this if you want the latest commits — **things might break**.

1. Install **Obsidian42 - BRAT** from **Settings → Community plugins → Browse** and enable it.
2. Run **BRAT: Add a beta plugin for testing** from the command palette.
3. Paste `https://github.com/dsebastien/obsidian-cli-rest`.
4. Select the latest version and confirm.
5. Enable **REST and MCP server** in **Settings → Community plugins**.

Once enabled, the server starts automatically on `http://127.0.0.1:27124`.

## Quick start

Copy your API key from **Settings > Obsidian CLI REST > Security**, then start making requests:

```bash
# List all files in your vault
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://127.0.0.1:27124/api/v1/cli/files

# Search your vault
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "http://127.0.0.1:27124/api/v1/cli/search?query=meeting+notes"

# Create a new note
curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"params": {"name": "My Note", "content": "Hello world"}}' \
  http://127.0.0.1:27124/api/v1/cli/create

# Read today's daily note
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://127.0.0.1:27124/api/v1/cli/daily/read

# Append to your daily note
curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"params": {"content": "- Task from my script"}}' \
  http://127.0.0.1:27124/api/v1/cli/daily/append
```

## What you can do

The plugin exposes all CLI commands organized into categories:

| Category        | Examples                                                  |
| --------------- | --------------------------------------------------------- |
| **Files**       | List, create, read, append, prepend, move, rename, delete |
| **Search**      | Full-text search, search with context                     |
| **Properties**  | Read, set, and remove frontmatter properties              |
| **Daily notes** | Open, read, append, prepend to daily notes                |
| **Tags**        | List tags, get tag info                                   |
| **Tasks**       | List and manage tasks                                     |
| **Links**       | Outgoing links, backlinks, orphans, dead ends             |
| **Templates**   | List, read, and insert templates                          |
| **Bookmarks**   | List and add bookmarks                                    |
| **Plugins**     | List, install, enable, disable, uninstall                 |
| **Themes**      | List, set, install, uninstall                             |
| **Sync**        | Status, history, restore                                  |
| **Publish**     | Status, publish, unpublish                                |
| **Workspaces**  | List, save, load, delete layouts                          |
| **And more**    | Bases, CSS snippets, file history, word count...          |

## Two ways to connect

### REST API

Standard HTTP endpoints at `/api/v1/cli/*`. Use from any language or tool that can make HTTP requests.

```
GET  /api/v1/cli/files           # Read-only commands use GET
POST /api/v1/cli/create          # Write commands use POST
DELETE /api/v1/cli/delete        # Delete commands use DELETE
```

CLI colons become slashes in URLs: `property:set` becomes `/api/v1/cli/property/set`.

### MCP server

An MCP endpoint at `/mcp` for AI assistant integration. Uses the **Code Mode pattern** — just 2 tools (`search` and `execute`) enable progressive discovery of all commands, keeping the tool count fixed regardless of how many CLI commands exist.

- `search` — Discover commands by name, description, or category
- `execute` — Run any CLI command by name

Configure your MCP client with:

- **URL**: `http://127.0.0.1:27124/mcp`
- **Transport**: StreamableHTTP
- **Auth**: Bearer token (your API key)

## Security

The plugin is designed with security in mind:

- **Localhost only** by default — only your machine can reach the server
- **API key authentication** — auto-generated 64-character key, required for all CLI commands
- **Dangerous commands disabled** — commands like `eval`, `restart`, and `devtools` are blocked unless you explicitly opt in
- **Per-command blocklist** — block specific commands you don't want accessible
- **No shell injection** — CLI commands use `execFile`, not `exec`

To expose the server on your network, change the bind address to `0.0.0.0` in settings. An API key is enforced in this mode.

## Configuration

All settings are accessible from **Settings > Obsidian CLI REST**.

| Setting            | Default     | Description                                           |
| ------------------ | ----------- | ----------------------------------------------------- |
| Port               | `27124`     | HTTP server port                                      |
| Bind address       | `127.0.0.1` | `127.0.0.1` (local) or `0.0.0.0` (network)            |
| Auto-start         | On          | Start server when plugin loads                        |
| REST API           | On          | Enable REST endpoints                                 |
| MCP server         | On          | Enable MCP endpoint                                   |
| Dangerous commands | Off         | Allow eval, restart, devtools, etc.                   |
| Blocked commands   | (none)      | Comma-separated list of commands to block             |
| CORS               | Off         | Allow cross-origin requests                           |
| Request timeout    | 30s         | Max CLI command execution time                        |
| Default vault      | (none)      | Fallback vault for requests without a vault parameter |

## Documentation

- **[User guide](docs/README.md)** — Setup, usage, configuration, and troubleshooting
- **[API reference](docs/api-reference.md)** — Endpoints, request/response formats, status codes
- **[MCP integration](docs/mcp-integration.md)** — Setting up AI assistant connections
- **[Command reference](docs/command-reference.md)** — All supported commands

## Support

- **Issues**: [GitHub Issues](https://github.com/dsebastien/obsidian-cli-rest/issues)
- **Author**: [Sebastien Dubois](https://dsebastien.net)

## License

MIT License — see [LICENSE](./LICENSE) for details.
