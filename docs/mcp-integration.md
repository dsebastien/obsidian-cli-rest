---
title: MCP integration
nav_order: 12
---

# MCP integration

The plugin includes an [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that lets AI assistants interact with your Obsidian vault. It uses the **Code Mode pattern** — just 2 tools enable progressive discovery and execution of all CLI commands.

## How it works

The MCP server runs on the same HTTP server as the REST API, at the `/mcp` path. It uses **StreamableHTTP** transport, which is a stateless, request-per-connection protocol.

Instead of registering one tool per CLI command (which would mean 100+ tools in the LLM context), the server exposes exactly **2 tools**:

- **`search`** — Discover available commands by name, description, or category
- **`execute`** — Run any CLI command by name

This keeps the tool count fixed regardless of how many CLI commands exist, reducing token overhead for AI clients.

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

## Tools

### `search` — Discover commands

Use `search` to find available commands. Call with no arguments for an overview, or filter by category or search term.

**Input schema:**

```json
{
    "query": "optional string — search term (matches command names and descriptions)",
    "category": "optional string — filter by exact category name"
}
```

**Example: Get an overview of all commands and categories**

```json
{
    "tool": "search",
    "arguments": {}
}
```

Returns all commands grouped with their categories. Use the category list to narrow down.

**Example: Browse a category**

```json
{
    "tool": "search",
    "arguments": {
        "category": "daily"
    }
}
```

Returns only commands in the "daily" category (e.g., `daily`, `daily:read`, `daily:append`, `daily:prepend`, `daily:path`).

**Example: Search by keyword**

```json
{
    "tool": "search",
    "arguments": {
        "query": "append"
    }
}
```

Finds all commands with "append" in their name or description.

**Example: Combine filters**

```json
{
    "tool": "search",
    "arguments": {
        "query": "list",
        "category": "plugins"
    }
}
```

The response always includes the full list of available categories, helping the AI agent decide what to explore next.

### `execute` — Run a command

Use `execute` to run any CLI command. Commands use colon notation (e.g., `daily:append`, `property:set`).

**Input schema:**

```json
{
    "command": "required string — CLI command name",
    "vault": "optional string — target vault name",
    "params": "optional object — key-value parameters",
    "flags": "optional array — boolean flags"
}
```

**Example: Get Obsidian version**

```json
{
    "tool": "execute",
    "arguments": {
        "command": "version"
    }
}
```

**Example: Search the vault**

```json
{
    "tool": "execute",
    "arguments": {
        "command": "search",
        "params": { "query": "meeting notes" }
    }
}
```

**Example: Read a file**

```json
{
    "tool": "execute",
    "arguments": {
        "command": "read",
        "params": { "path": "Projects/todo.md" }
    }
}
```

**Example: Create a note**

```json
{
    "tool": "execute",
    "arguments": {
        "command": "create",
        "params": {
            "name": "Weekly Summary",
            "content": "# Weekly Summary\n\nKey items..."
        }
    }
}
```

**Example: Set a property**

```json
{
    "tool": "execute",
    "arguments": {
        "command": "property:set",
        "params": {
            "path": "project.md",
            "name": "status",
            "value": "active"
        }
    }
}
```

**Example: Append to daily note in a specific vault**

```json
{
    "tool": "execute",
    "arguments": {
        "command": "daily:append",
        "vault": "Work",
        "params": {
            "content": "- Completed the design review"
        }
    }
}
```

**Example: Get help for a specific command**

```json
{
    "tool": "execute",
    "arguments": {
        "command": "help",
        "params": { "command": "daily:append" }
    }
}
```

This is useful for discovering what parameters a command accepts.

## Typical AI agent workflow

The recommended pattern for an AI agent using these tools:

1. **`search()`** — Get an overview of available categories
2. **`search(category: "daily")`** — Find commands in a relevant category
3. **`execute(command: "help", params: { command: "daily:append" })`** — Learn parameters for a specific command
4. **`execute(command: "daily:append", params: { content: "Hello" })`** — Execute the command

This progressive discovery approach means the agent only loads the information it needs, keeping context efficient.

## Safety controls

The same safety controls apply to MCP tools as to REST API endpoints:

- **Blocked commands** are hidden from `search` results and return an error from `execute`
- **Dangerous commands** require the `allowDangerousCommands` setting to be enabled
- **CLI unavailability** returns an error with details

## Troubleshooting

### Tools not appearing in your AI client

1. Check that the MCP server is enabled in plugin settings
2. Verify the server is running (check the status bar)
3. Confirm the URL is correct: `http://127.0.0.1:27124/mcp`
4. Check the API key is correct
5. You should see exactly 2 tools: `search` and `execute`

### Connection refused

The server may not be running. Open the command palette and run **Toggle REST/MCP server**, or check if auto-start is enabled.

### Authentication errors

Make sure the API key in your MCP client configuration matches the one shown in plugin settings. If you regenerated the key, update your client configuration.

### Command not found

If `execute` returns an error for a command, use `search` to verify the command name. Commands use colon notation (e.g., `daily:append`, not `daily/append` or `daily_append`). You can also use `execute(command: "help")` to see all available commands.
