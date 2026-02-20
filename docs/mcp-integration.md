# MCP integration

The plugin includes an [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that lets AI assistants interact with your Obsidian vault. All 110+ CLI commands are registered as MCP tools.

## How it works

The MCP server runs on the same HTTP server as the REST API, at the `/mcp` path. It uses **StreamableHTTP** transport, which is a stateless, request-per-connection protocol.

Each CLI command is registered as an MCP tool. For example:

- `files` becomes the `files` tool
- `property:set` becomes the `property_set` tool
- `daily:append` becomes the `daily_append` tool

## Setup

### 1. Ensure the MCP server is enabled

Go to **Settings > Obsidian CLI REST > Interfaces** and verify that **MCP server** is toggled on (it's on by default).

### 2. Get your API key

Go to **Settings > Obsidian CLI REST > Security** and copy your API key.

### 3. Configure your MCP client

Use these connection details:

| Setting        | Value                        |
| -------------- | ---------------------------- |
| URL            | `http://127.0.0.1:27124/mcp` |
| Transport      | StreamableHTTP               |
| Authentication | Bearer token                 |

### Claude Desktop

Add this to your Claude Desktop MCP configuration file:

```json
{
    "mcpServers": {
        "obsidian": {
            "url": "http://127.0.0.1:27124/mcp",
            "headers": {
                "Authorization": "Bearer YOUR_API_KEY"
            }
        }
    }
}
```

### Claude Code

Add the MCP server to your Claude Code configuration:

```json
{
    "mcpServers": {
        "obsidian": {
            "type": "url",
            "url": "http://127.0.0.1:27124/mcp",
            "headers": {
                "Authorization": "Bearer YOUR_API_KEY"
            }
        }
    }
}
```

### Other MCP clients

Any MCP-compatible client that supports StreamableHTTP transport can connect. Configure the URL as `http://127.0.0.1:27124/mcp` and include the API key as a Bearer token in the Authorization header.

## Tool schema

Every MCP tool accepts the same input schema:

```json
{
    "vault": "optional string — target vault name",
    "params": "optional object — key-value parameters",
    "flags": "optional array — boolean flags"
}
```

### Example tool calls

**List files:**

```json
{
    "tool": "files",
    "arguments": {}
}
```

**Search vault:**

```json
{
    "tool": "search",
    "arguments": {
        "params": { "query": "meeting notes" }
    }
}
```

**Create a note:**

```json
{
    "tool": "create",
    "arguments": {
        "params": {
            "name": "Weekly Summary",
            "content": "# Weekly Summary\n\nKey items..."
        }
    }
}
```

**Set a property:**

```json
{
    "tool": "property_set",
    "arguments": {
        "params": {
            "path": "project.md",
            "name": "status",
            "value": "active"
        }
    }
}
```

**Append to daily note in a specific vault:**

```json
{
    "tool": "daily_append",
    "arguments": {
        "vault": "Work",
        "params": {
            "content": "- Completed the design review"
        }
    }
}
```

## Tool naming

MCP tool names cannot contain `:` or `/`, so CLI command names are converted:

| CLI command      | MCP tool name    |
| ---------------- | ---------------- |
| `files`          | `files`          |
| `property:set`   | `property_set`   |
| `daily:append`   | `daily_append`   |
| `search:context` | `search_context` |
| `plugin:install` | `plugin_install` |
| `sync:status`    | `sync_status`    |

## Safety controls

The same safety controls apply to MCP tools as to REST API endpoints:

- **Blocked commands** return an error
- **Dangerous commands** require the `allowDangerousCommands` setting to be enabled
- **CLI unavailability** returns an error with details

## Troubleshooting

### Tools not appearing in your AI client

1. Check that the MCP server is enabled in plugin settings
2. Verify the server is running (check the status bar)
3. Confirm the URL is correct: `http://127.0.0.1:27124/mcp`
4. Check the API key is correct

### Connection refused

The server may not be running. Open the command palette and run **Toggle REST/MCP server**, or check if auto-start is enabled.

### Authentication errors

Make sure the API key in your MCP client configuration matches the one shown in plugin settings. If you regenerated the key, update your client configuration.
