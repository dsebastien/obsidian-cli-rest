# Command reference

All 110+ Obsidian CLI commands supported by the plugin, organized by category.

**Legend:**

- **Method** — HTTP method for the REST API (POST is always accepted as fallback)
- **Dangerous** — Requires `allowDangerousCommands` setting to be enabled

## General

| Command   | Method | Dangerous | Description                                               |
| --------- | ------ | --------- | --------------------------------------------------------- |
| `help`    | GET    | No        | Display available commands or help for a specific command |
| `version` | GET    | No        | Show Obsidian version number                              |
| `reload`  | POST   | Yes       | Reload the app window                                     |
| `restart` | POST   | Yes       | Restart the application                                   |

## Vault

| Command      | Method | Dangerous | Description                            |
| ------------ | ------ | --------- | -------------------------------------- |
| `vault`      | GET    | No        | Show vault info                        |
| `vaults`     | GET    | No        | List known vaults (desktop only)       |
| `vault:open` | POST   | No        | Switch to a different vault (TUI only) |

## Files and folders

| Command   | Method | Dangerous | Description                                                 |
| --------- | ------ | --------- | ----------------------------------------------------------- |
| `file`    | GET    | No        | Show file info (defaults to active file)                    |
| `files`   | GET    | No        | List files in the vault                                     |
| `folder`  | GET    | No        | Show folder info                                            |
| `folders` | GET    | No        | List folders in the vault                                   |
| `open`    | POST   | No        | Open a file                                                 |
| `create`  | POST   | No        | Create or overwrite a file                                  |
| `read`    | GET    | No        | Read file contents (defaults to active file)                |
| `append`  | POST   | No        | Append content to a file (defaults to active file)          |
| `prepend` | POST   | No        | Prepend content after frontmatter (defaults to active file) |
| `move`    | POST   | No        | Move or rename a file (defaults to active file)             |
| `rename`  | POST   | No        | Rename a file (defaults to active file)                     |
| `delete`  | DELETE | No        | Delete a file (defaults to active file, goes to trash)      |

## Outline

| Command   | Method | Dangerous | Description                        |
| --------- | ------ | --------- | ---------------------------------- |
| `outline` | GET    | No        | Show headings for the current file |

## Search

| Command          | Method | Dangerous | Description                                           |
| ---------------- | ------ | --------- | ----------------------------------------------------- |
| `search`         | GET    | No        | Search vault for text, returns matching file paths    |
| `search:context` | GET    | No        | Search with matching line context (grep-style output) |
| `search:open`    | POST   | No        | Open search view                                      |

## Links

| Command      | Method | Dangerous | Description                                               |
| ------------ | ------ | --------- | --------------------------------------------------------- |
| `links`      | GET    | No        | List outgoing links from a file (defaults to active file) |
| `backlinks`  | GET    | No        | List backlinks to a file (defaults to active file)        |
| `unresolved` | GET    | No        | List unresolved links in vault                            |
| `orphans`    | GET    | No        | List files with no incoming links                         |
| `deadends`   | GET    | No        | List files with no outgoing links                         |

## Tags

| Command | Method | Dangerous | Description            |
| ------- | ------ | --------- | ---------------------- |
| `tags`  | GET    | No        | List tags in the vault |
| `tag`   | GET    | No        | Get tag info           |

## Tasks

| Command | Method | Dangerous | Description             |
| ------- | ------ | --------- | ----------------------- |
| `tasks` | GET    | No        | List tasks in the vault |
| `task`  | POST   | No        | Show or update a task   |

## Properties

| Command           | Method | Dangerous | Description                                                 |
| ----------------- | ------ | --------- | ----------------------------------------------------------- |
| `aliases`         | GET    | No        | List aliases in the vault                                   |
| `properties`      | GET    | No        | List properties in the vault                                |
| `property:read`   | GET    | No        | Read a property value from a file (defaults to active file) |
| `property:set`    | POST   | No        | Set a property on a file (defaults to active file)          |
| `property:remove` | DELETE | No        | Remove a property from a file (defaults to active file)     |

## Daily notes

| Command         | Method | Dangerous | Description                                           |
| --------------- | ------ | --------- | ----------------------------------------------------- |
| `daily`         | POST   | No        | Open today's daily note                               |
| `daily:path`    | GET    | No        | Get daily note path (even if file does not exist yet) |
| `daily:read`    | GET    | No        | Read daily note contents                              |
| `daily:append`  | POST   | No        | Append content to daily note                          |
| `daily:prepend` | POST   | No        | Prepend content to daily note                         |

## Random notes

| Command       | Method | Dangerous | Description                        |
| ------------- | ------ | --------- | ---------------------------------- |
| `random`      | POST   | No        | Open a random note                 |
| `random:read` | GET    | No        | Read a random note (includes path) |

## Unique notes

| Command  | Method | Dangerous | Description        |
| -------- | ------ | --------- | ------------------ |
| `unique` | POST   | No        | Create unique note |

## Word count

| Command     | Method | Dangerous | Description                                          |
| ----------- | ------ | --------- | ---------------------------------------------------- |
| `wordcount` | GET    | No        | Count words and characters (defaults to active file) |

## Templates

| Command           | Method | Dangerous | Description                      |
| ----------------- | ------ | --------- | -------------------------------- |
| `templates`       | GET    | No        | List templates                   |
| `template:read`   | GET    | No        | Read template content            |
| `template:insert` | POST   | No        | Insert template into active file |

## Bookmarks

| Command     | Method | Dangerous | Description    |
| ----------- | ------ | --------- | -------------- |
| `bookmarks` | GET    | No        | List bookmarks |
| `bookmark`  | POST   | No        | Add a bookmark |

## Bases

| Command       | Method | Dangerous | Description                         |
| ------------- | ------ | --------- | ----------------------------------- |
| `bases`       | GET    | No        | List all base files in vault        |
| `base:views`  | GET    | No        | List views in the current base file |
| `base:query`  | GET    | No        | Query a base and return results     |
| `base:create` | POST   | No        | Create a new item in a base         |

## Commands

| Command    | Method | Dangerous | Description                 |
| ---------- | ------ | --------- | --------------------------- |
| `commands` | GET    | No        | List available command IDs  |
| `command`  | POST   | Yes       | Execute an Obsidian command |

## Hotkeys

| Command   | Method | Dangerous | Description                   |
| --------- | ------ | --------- | ----------------------------- |
| `hotkeys` | GET    | No        | List hotkeys for all commands |
| `hotkey`  | GET    | No        | Get hotkey for a command      |

## Tabs and workspaces

| Command            | Method | Dangerous | Description                      |
| ------------------ | ------ | --------- | -------------------------------- |
| `tabs`             | GET    | No        | List open tabs                   |
| `tab:open`         | POST   | No        | Open a new tab                   |
| `recents`          | GET    | No        | List recently opened files       |
| `workspace`        | GET    | No        | Show workspace tree              |
| `workspaces`       | GET    | No        | List saved workspaces            |
| `workspace:save`   | POST   | No        | Save current layout as workspace |
| `workspace:load`   | POST   | No        | Load a saved workspace           |
| `workspace:delete` | DELETE | No        | Delete a saved workspace         |

## Web viewer

| Command | Method | Dangerous | Description            |
| ------- | ------ | --------- | ---------------------- |
| `web`   | POST   | No        | Open URL in web viewer |

## Plugins

| Command            | Method | Dangerous | Description                      |
| ------------------ | ------ | --------- | -------------------------------- |
| `plugins`          | GET    | No        | List installed plugins           |
| `plugins:enabled`  | GET    | No        | List enabled plugins             |
| `plugins:restrict` | POST   | Yes       | Toggle or check restricted mode  |
| `plugin`           | GET    | No        | Get plugin info                  |
| `plugin:enable`    | POST   | No        | Enable a plugin                  |
| `plugin:disable`   | POST   | No        | Disable a plugin                 |
| `plugin:install`   | POST   | No        | Install a community plugin       |
| `plugin:uninstall` | DELETE | No        | Uninstall a community plugin     |
| `plugin:reload`    | POST   | No        | Reload a plugin (for developers) |

## Themes

| Command           | Method | Dangerous | Description                   |
| ----------------- | ------ | --------- | ----------------------------- |
| `themes`          | GET    | No        | List installed themes         |
| `theme`           | GET    | No        | Show active theme or get info |
| `theme:set`       | POST   | No        | Set active theme              |
| `theme:install`   | POST   | No        | Install a community theme     |
| `theme:uninstall` | DELETE | No        | Uninstall a theme             |

## CSS snippets

| Command            | Method | Dangerous | Description                 |
| ------------------ | ------ | --------- | --------------------------- |
| `snippets`         | GET    | No        | List installed CSS snippets |
| `snippets:enabled` | GET    | No        | List enabled CSS snippets   |
| `snippet:enable`   | POST   | No        | Enable a CSS snippet        |
| `snippet:disable`  | POST   | No        | Disable a CSS snippet       |

## File history

| Command           | Method | Dangerous | Description                                                |
| ----------------- | ------ | --------- | ---------------------------------------------------------- |
| `diff`            | GET    | No        | List or compare file versions from local recovery and Sync |
| `history`         | GET    | No        | List versions from file recovery only                      |
| `history:list`    | GET    | No        | List all files with local history                          |
| `history:read`    | GET    | No        | Read a local history version                               |
| `history:restore` | POST   | No        | Restore a local history version                            |
| `history:open`    | POST   | No        | Open file recovery UI                                      |

## Sync

| Command        | Method | Dangerous | Description                                                    |
| -------------- | ------ | --------- | -------------------------------------------------------------- |
| `sync`         | POST   | No        | Pause or resume sync                                           |
| `sync:status`  | GET    | No        | Show sync status and usage                                     |
| `sync:history` | GET    | No        | List sync version history for a file (defaults to active file) |
| `sync:read`    | GET    | No        | Read a sync version (defaults to active file)                  |
| `sync:restore` | POST   | No        | Restore a sync version (defaults to active file)               |
| `sync:open`    | POST   | No        | Open sync history (defaults to active file)                    |
| `sync:deleted` | GET    | No        | List deleted files in sync                                     |

## Publish

| Command          | Method | Dangerous | Description                                                   |
| ---------------- | ------ | --------- | ------------------------------------------------------------- |
| `publish:site`   | GET    | No        | Show publish site info (slug, URL)                            |
| `publish:list`   | GET    | No        | List published files                                          |
| `publish:status` | GET    | No        | List publish changes                                          |
| `publish:add`    | POST   | No        | Publish a file or all changed files (defaults to active file) |
| `publish:remove` | DELETE | No        | Unpublish a file (defaults to active file)                    |
| `publish:open`   | POST   | No        | Open file on published site (defaults to active file)         |

## Developer

All developer commands are dangerous and require `allowDangerousCommands` to be enabled.

| Command          | Method | Dangerous | Description                                     |
| ---------------- | ------ | --------- | ----------------------------------------------- |
| `devtools`       | POST   | Yes       | Toggle Electron dev tools                       |
| `eval`           | POST   | Yes       | Execute JavaScript and return result            |
| `dev:console`    | GET    | Yes       | Show captured console messages                  |
| `dev:errors`     | GET    | Yes       | Show captured JavaScript errors                 |
| `dev:screenshot` | POST   | Yes       | Take a screenshot (returns base64 PNG)          |
| `dev:dom`        | GET    | Yes       | Query DOM elements                              |
| `dev:css`        | GET    | Yes       | Inspect CSS with source locations               |
| `dev:mobile`     | POST   | Yes       | Toggle mobile emulation                         |
| `dev:debug`      | POST   | Yes       | Attach/detach Chrome DevTools Protocol debugger |
| `dev:cdp`        | POST   | Yes       | Run a Chrome DevTools Protocol command          |
