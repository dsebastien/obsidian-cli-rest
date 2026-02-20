# Configuration

## Settings reference

| Setting                  | Type     | Default                               | Zod constraints  | Description                             |
| ------------------------ | -------- | ------------------------------------- | ---------------- | --------------------------------------- |
| `autoStart`              | boolean  | `true`                                | —                | Auto-start server on plugin load        |
| `port`                   | number   | `27124`                               | int, 1024-65535  | HTTP server port                        |
| `bindAddress`            | string   | `127.0.0.1`                           | —                | Bind address (`127.0.0.1` or `0.0.0.0`) |
| `apiKey`                 | string   | `""` (auto-generated on first enable) | —                | Bearer token for authentication         |
| `requestTimeout`         | number   | `30000`                               | int, 1000-300000 | CLI command timeout in ms               |
| `enableRestApi`          | boolean  | `true`                                | —                | Enable REST API at `/api/v1/cli/*`      |
| `enableMcp`              | boolean  | `true`                                | —                | Enable MCP server at `/mcp`             |
| `allowDangerousCommands` | boolean  | `false`                               | —                | Allow dangerous commands                |
| `blockedCommands`        | string[] | `[]`                                  | —                | CLI commands to block                   |
| `enableCors`             | boolean  | `false`                               | —                | Allow cross-origin requests             |
| `defaultVault`           | string   | `""`                                  | —                | Default vault name for requests         |

## Settings schema

Defined in `src/app/types/plugin-settings.intf.ts` using Zod:

```typescript
const pluginSettingsSchema = z.object({
    autoStart: z.boolean().default(true),
    port: z.number().int().min(1024).max(65535).default(27124),
    bindAddress: z.string().default('127.0.0.1'),
    apiKey: z.string().default(''),
    requestTimeout: z.number().int().min(1000).max(300000).default(30000),
    enableRestApi: z.boolean().default(true),
    enableMcp: z.boolean().default(true),
    allowDangerousCommands: z.boolean().default(false),
    blockedCommands: z.array(z.string()).default([]),
    enableCors: z.boolean().default(false),
    defaultVault: z.string().default('')
})
```

`DEFAULT_SETTINGS` is derived by parsing an empty object through the schema, which populates all defaults.

## API key

- Auto-generated on first plugin enable via `crypto.randomBytes(32)` → 64-character hex string
- Required when `bindAddress` is `0.0.0.0` (auto-generated if empty)
- Sent as `Authorization: Bearer <key>` header
- Can be regenerated from settings (requires server restart)

## Endpoints

| Endpoint                                  | Auth required | Description                             |
| ----------------------------------------- | ------------- | --------------------------------------- |
| `GET /api/v1/health`                      | No            | Health check with CLI and server status |
| `GET /api/v1/commands`                    | No            | List all available CLI commands         |
| `GET\|POST\|DELETE /api/v1/cli/{command}` | Yes           | Execute CLI command                     |
| `POST /mcp`                               | Yes           | MCP StreamableHTTP endpoint             |

## REST API request formats

**GET**: Query parameters (`?vault=X&query=hello&flags=total,verbose`)

**POST/DELETE**: JSON body:

```json
{
    "vault": "MyVault",
    "params": { "query": "hello", "name": "test" },
    "flags": ["total", "verbose"]
}
```

URL mapping: CLI `:` becomes `/` in URL paths (`property:set` → `/api/v1/cli/property/set`)

## HTTP status codes

| Code | Meaning               | Cause                                       |
| ---- | --------------------- | ------------------------------------------- |
| 200  | Success               | CLI command exited with code 0              |
| 400  | Bad request           | Malformed JSON body or invalid parameters   |
| 401  | Unauthorized          | Missing or invalid API key                  |
| 403  | Forbidden             | Command blocked or dangerous without opt-in |
| 404  | Not found             | Unknown command or disabled interface       |
| 405  | Method not allowed    | Wrong HTTP method for the command           |
| 422  | Unprocessable entity  | CLI returned non-zero exit code             |
| 500  | Internal server error | Unexpected failure                          |
| 503  | Service unavailable   | CLI binary not found                        |

## Settings tab organization

The settings tab (`src/app/settings/settings-tab.ts`) is organized into sections:

1. **Status**: Server state (running/stopped), CLI availability, listening address
2. **Server**: Port, bind address, auto-start, CORS
3. **Interfaces**: REST API and MCP toggles
4. **Security**: API key display/copy/regenerate, dangerous commands toggle
5. **Command filtering**: Blocklist textarea (comma-separated)
6. **Advanced**: Request timeout, default vault
