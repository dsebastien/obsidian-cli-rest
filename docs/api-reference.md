# API reference

Base URL: `http://127.0.0.1:27124` (default)

## Endpoints

### Public endpoints (no authentication required)

#### Health check

```
GET /api/v1/health
```

Returns server status, CLI availability, and configuration.

Response example:

```json
{
    "ok": true,
    "command": "health",
    "exitCode": 0,
    "stdout": "{\"status\":\"ok\",\"cli\":{\"available\":true,\"version\":\"1.12.2\",\"binaryPath\":\"/usr/local/bin/obsidian\"},\"server\":{\"port\":27124,\"bindAddress\":\"127.0.0.1\",\"restEnabled\":true,\"mcpEnabled\":true}}",
    "stderr": "",
    "duration": 0
}
```

#### List commands

```
GET /api/v1/commands
```

Returns all available CLI commands with metadata.

Response example:

```json
{
    "ok": true,
    "command": "commands",
    "exitCode": 0,
    "stdout": "[{\"command\":\"help\",\"httpMethod\":\"GET\",\"category\":\"general\",\"dangerous\":false,\"description\":\"Display available commands\"}]",
    "stderr": "",
    "duration": 0
}
```

### Protected endpoints (API key required)

#### Execute CLI command

```
GET|POST|DELETE /api/v1/cli/{command}
Authorization: Bearer <api-key>
```

Executes an Obsidian CLI command and returns the result.

- **GET** — Read-only commands (list, read, search)
- **POST** — Write/action commands (create, append, open)
- **DELETE** — Removal commands (delete, uninstall, remove)
- **POST** is always accepted as a fallback for any command

##### GET request format

Parameters are passed as query strings:

```
GET /api/v1/cli/search?query=hello&vault=MyVault&flags=total,verbose
```

| Parameter     | Description                                    |
| ------------- | ---------------------------------------------- |
| `vault`       | Target vault name                              |
| `flags`       | Comma-separated boolean flags                  |
| Any other key | Passed as a named parameter to the CLI command |

##### POST/DELETE request format

Parameters are passed as JSON body:

```json
{
    "vault": "MyVault",
    "params": {
        "query": "hello",
        "name": "test"
    },
    "flags": ["total", "verbose"]
}
```

| Field    | Type     | Description                     |
| -------- | -------- | ------------------------------- |
| `vault`  | string   | Target vault name (optional)    |
| `params` | object   | Key-value parameters (optional) |
| `flags`  | string[] | Boolean flags (optional)        |

##### Response format

Success (`exitCode` is 0):

```json
{
    "ok": true,
    "command": "files",
    "exitCode": 0,
    "stdout": "file1.md\nfile2.md",
    "stderr": "",
    "duration": 42
}
```

CLI error (`exitCode` is non-zero):

```json
{
    "ok": false,
    "error": "CLI command failed",
    "command": "read",
    "exitCode": 1,
    "stdout": "",
    "stderr": "File not found: missing.md",
    "duration": 15
}
```

Server error:

```json
{
    "ok": false,
    "error": "Command is blocked: eval"
}
```

#### MCP endpoint

```
POST /mcp
Authorization: Bearer <api-key>
Content-Type: application/json
```

StreamableHTTP transport for the Model Context Protocol. This endpoint is used by MCP-compatible AI clients. See [MCP integration](mcp-integration.md) for setup details.

## URL mapping

CLI colons become slashes in URLs:

| CLI command      | REST URL                     |
| ---------------- | ---------------------------- |
| `files`          | `/api/v1/cli/files`          |
| `property:set`   | `/api/v1/cli/property/set`   |
| `daily:append`   | `/api/v1/cli/daily/append`   |
| `plugin:install` | `/api/v1/cli/plugin/install` |
| `sync:status`    | `/api/v1/cli/sync/status`    |

## HTTP status codes

| Code | Meaning               | When                                           |
| ---- | --------------------- | ---------------------------------------------- |
| 200  | Success               | Command executed successfully                  |
| 400  | Bad request           | Malformed JSON body or invalid parameters      |
| 401  | Unauthorized          | Missing or invalid API key                     |
| 403  | Forbidden             | Command is blocked or dangerous without opt-in |
| 404  | Not found             | Unknown command or disabled interface          |
| 405  | Method not allowed    | Wrong HTTP method for the command              |
| 422  | Unprocessable entity  | CLI returned non-zero exit code                |
| 500  | Internal server error | Unexpected server failure                      |
| 503  | Service unavailable   | Obsidian CLI binary not found                  |

## CORS

Cross-origin requests are disabled by default. Enable CORS in plugin settings if you need to call the API from a browser.

When enabled, the server responds to `OPTIONS` preflight requests and adds appropriate `Access-Control-Allow-*` headers.

## Rate limiting

There is no built-in rate limiting. The server processes requests sequentially via CLI execution. Each request spawns a CLI process, so very rapid requests may queue up. The request timeout setting (default: 30 seconds) prevents requests from hanging indefinitely.
