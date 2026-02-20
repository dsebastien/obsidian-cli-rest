# Configuration

All settings are accessible from **Settings > Obsidian CLI REST** in Obsidian.

## Settings reference

### Server

| Setting      | Type    | Default     | Description                                                       |
| ------------ | ------- | ----------- | ----------------------------------------------------------------- |
| Port         | number  | `27124`     | HTTP server port. Range: 1024-65535                               |
| Bind address | string  | `127.0.0.1` | `127.0.0.1` for localhost only, `0.0.0.0` to allow network access |
| Auto-start   | boolean | On          | Start the server automatically when the plugin loads              |
| CORS         | boolean | Off         | Allow cross-origin requests from browsers                         |

### Interfaces

| Setting    | Type    | Default | Description                                  |
| ---------- | ------- | ------- | -------------------------------------------- |
| REST API   | boolean | On      | Enable REST API endpoints at `/api/v1/cli/*` |
| MCP server | boolean | On      | Enable MCP endpoint at `/mcp`                |

Both interfaces can be enabled or disabled independently. If both are disabled, only the health check and command list endpoints remain active.

### Security

| Setting            | Type    | Default        | Description                                                 |
| ------------------ | ------- | -------------- | ----------------------------------------------------------- |
| API key            | string  | Auto-generated | 64-character hex token used for Bearer authentication       |
| Dangerous commands | boolean | Off            | Allow dangerous commands like `eval`, `restart`, `devtools` |

### Command filtering

| Setting          | Type     | Default | Description                                   |
| ---------------- | -------- | ------- | --------------------------------------------- |
| Blocked commands | string[] | (empty) | Comma-separated list of CLI commands to block |

### Advanced

| Setting         | Type   | Default | Description                                                            |
| --------------- | ------ | ------- | ---------------------------------------------------------------------- |
| Request timeout | number | `30000` | Maximum CLI command execution time in milliseconds. Range: 1000-300000 |
| Default vault   | string | (empty) | Fallback vault name for requests that don't specify a vault            |

## API key management

### Auto-generation

An API key is automatically generated the first time you enable the plugin. It is a 64-character hexadecimal string generated from 32 random bytes.

### Copying the key

You can copy the API key in two ways:

- From **Settings > Obsidian CLI REST > Security**, select **Copy**
- From the command palette, run **Copy API key**

### Regenerating the key

Select **Regenerate** in the Security section of plugin settings. A new key is generated immediately. You will need to update any scripts or MCP clients using the old key.

If the server is running when you regenerate, restart it for the new key to take effect.

### Authentication enforcement

- When the bind address is `127.0.0.1`, authentication is optional (but recommended). If the API key is empty, all requests are allowed.
- When the bind address is `0.0.0.0`, authentication is enforced. If the API key is empty, one is auto-generated to prevent unauthenticated network access.

## Bind address

### Localhost (default: `127.0.0.1`)

Only requests from your local machine can reach the server. This is the safest option and appropriate for most use cases.

### Network (`0.0.0.0`)

The server listens on all network interfaces, allowing access from other machines on your network. Use this if you need to connect from a different device.

**Warning**: Exposing the server on the network gives any device on your network potential access to your vault (through the API). An API key is enforced in this mode. Only use this on trusted networks.

## Dangerous commands

The following commands are considered dangerous and are disabled by default:

| Command            | Why it's dangerous                         |
| ------------------ | ------------------------------------------ |
| `reload`           | Reloads the Obsidian window                |
| `restart`          | Restarts the Obsidian application          |
| `command`          | Executes arbitrary Obsidian commands       |
| `eval`             | Executes arbitrary JavaScript              |
| `devtools`         | Opens Electron developer tools             |
| `plugins:restrict` | Toggles restricted mode                    |
| `dev:console`      | Reads console messages                     |
| `dev:errors`       | Reads JavaScript errors                    |
| `dev:screenshot`   | Takes screenshots                          |
| `dev:dom`          | Queries DOM elements                       |
| `dev:css`          | Inspects CSS                               |
| `dev:mobile`       | Toggles mobile emulation                   |
| `dev:debug`        | Attaches Chrome DevTools Protocol debugger |
| `dev:cdp`          | Runs Chrome DevTools Protocol commands     |

To enable these commands, toggle **Allow dangerous commands** in settings. Only enable this if you understand the risks and trust all clients that have your API key.

## Command blocklist

You can block specific commands by adding them to the blocklist in settings. Enter command names separated by commas:

```
eval, restart, plugin:uninstall
```

Blocked commands return a 403 Forbidden response. This applies to both the REST API and MCP tools.

The blocklist is useful for restricting access even when dangerous commands are enabled, or for blocking specific non-dangerous commands you don't want accessible.

## CORS

Cross-Origin Resource Sharing (CORS) is disabled by default. Enable it if you need to make API calls from a web browser on a different origin (e.g., a web app running on `localhost:3000`).

When enabled:

- `OPTIONS` preflight requests are handled automatically
- `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, and `Access-Control-Allow-Headers` headers are added to responses
