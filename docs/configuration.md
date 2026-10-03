---
title: Configuration
nav_order: 3
---

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

| Setting            | Type    | Default        | Description                                                                              |
| ------------------ | ------- | -------------- | ---------------------------------------------------------------------------------------- |
| API key            | secret  | Auto-generated | 64-character hex token used for Bearer authentication, kept in Obsidian's secret storage |
| Dangerous commands | boolean | Off            | Allow dangerous commands like `eval`, `restart`, `devtools`                              |

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

### Where the key is stored

The key is kept in Obsidian's secret storage on each device, not in the plugin's data file. The data file syncs with your vault (Git, Syncthing, cloud sync), so a key stored there would travel with every copy of the vault. The plugin settings only remember the name of the secret (by default `cli-rest-mcp-api-key`). Use the secret picker in the Security section to select or create a different secret.

Secret storage is per device. On a device where the secret does not exist yet, the plugin shows a notice and refuses to start the server rather than invent a new key that would break your clients. Select the secret in the Security section and enter the same key as on your other devices.

### Upgrading from older versions

Older versions stored the key in plain text in the data file. Each device moves it into its own secret storage automatically on its next start: no action needed, your clients keep working. The plain-text copy stays in the data file so that every synced device can do this, and is removed automatically 60 days after the first migration. Once all your devices run this version, you can remove it right away with **Remove plain-text copy now** in the Security section.

### Auto-generation

An API key is automatically generated the first time you enable the plugin. It is a 64-character hexadecimal string generated from 32 random bytes, stored in secret storage.

### Copying the key

You can copy the API key in two ways:

- From **Settings > Obsidian CLI REST > Security**, select **Copy**
- From the command palette, run **Copy API key**

### Regenerating the key

Select **Regenerate** in the Security section of plugin settings. A new key is generated and applied immediately — a running server starts accepting the new key and rejecting the old one on the next request, with no restart and without dropping live MCP sessions.

You will need to update any scripts or MCP clients using the old key. The new key is written to this device's secret storage only, and any plain-text copy left by an older version is removed. Enter the new key on your other devices too (select the secret in the Security section).

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
