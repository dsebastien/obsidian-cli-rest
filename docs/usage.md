# Usage

## Making requests

### Authentication

All CLI command endpoints require an API key. Include it as a Bearer token:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://127.0.0.1:27124/api/v1/cli/files
```

Two endpoints are public (no API key needed):

- `GET /api/v1/health` — Check server and CLI status
- `GET /api/v1/commands` — List all available commands

### Request formats

**GET requests** use query parameters:

```bash
curl -H "Authorization: Bearer KEY" \
  "http://127.0.0.1:27124/api/v1/cli/search?query=meeting&flags=total,verbose"
```

Query parameter reference:

- `vault` — Target vault name
- `query`, `name`, `path`, `content`, etc. — Command-specific parameters
- `flags` — Comma-separated boolean flags

**POST and DELETE requests** use a JSON body:

```bash
curl -X POST \
  -H "Authorization: Bearer KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "vault": "MyVault",
    "params": { "name": "Meeting Notes", "content": "# Meeting\n\nNotes here" },
    "flags": ["verbose"]
  }' \
  http://127.0.0.1:27124/api/v1/cli/create
```

JSON body reference:

- `vault` (string, optional) — Target vault name
- `params` (object, optional) — Key-value parameters
- `flags` (array, optional) — Boolean flags

POST is also accepted as a universal fallback for any command, even those mapped to GET or DELETE.

### URL mapping

CLI command colons become slashes in URLs:

| CLI command      | URL path                     |
| ---------------- | ---------------------------- |
| `files`          | `/api/v1/cli/files`          |
| `property:set`   | `/api/v1/cli/property/set`   |
| `daily:append`   | `/api/v1/cli/daily/append`   |
| `search:context` | `/api/v1/cli/search/context` |
| `plugin:install` | `/api/v1/cli/plugin/install` |

### Response format

All responses use a consistent JSON envelope:

```json
{
    "ok": true,
    "command": "files",
    "exitCode": 0,
    "stdout": "file1.md\nfile2.md\n...",
    "stderr": "",
    "duration": 42
}
```

Error responses include an `error` field:

```json
{
    "ok": false,
    "error": "Command is blocked: eval",
    "command": "eval"
}
```

### Specifying a vault

If you have multiple vaults, specify which one in your requests:

```bash
# Via query parameter (GET)
curl -H "Authorization: Bearer KEY" \
  "http://127.0.0.1:27124/api/v1/cli/files?vault=Work"

# Via JSON body (POST)
curl -X POST -H "Authorization: Bearer KEY" \
  -H "Content-Type: application/json" \
  -d '{"vault": "Work", "params": {"name": "Note"}}' \
  http://127.0.0.1:27124/api/v1/cli/create
```

You can also set a **default vault** in plugin settings to avoid specifying it on every request.

## Common use cases

### Working with files

```bash
# List all files
curl -H "Authorization: Bearer KEY" \
  http://127.0.0.1:27124/api/v1/cli/files

# Read a specific file
curl -H "Authorization: Bearer KEY" \
  "http://127.0.0.1:27124/api/v1/cli/read?path=Projects/todo.md"

# Create a new note
curl -X POST -H "Authorization: Bearer KEY" \
  -H "Content-Type: application/json" \
  -d '{"params": {"name": "New Note", "content": "# My Note\n\nContent here"}}' \
  http://127.0.0.1:27124/api/v1/cli/create

# Append to a file
curl -X POST -H "Authorization: Bearer KEY" \
  -H "Content-Type: application/json" \
  -d '{"params": {"path": "journal.md", "content": "\n- New entry"}}' \
  http://127.0.0.1:27124/api/v1/cli/append

# Delete a file
curl -X DELETE -H "Authorization: Bearer KEY" \
  -H "Content-Type: application/json" \
  -d '{"params": {"path": "old-note.md"}}' \
  http://127.0.0.1:27124/api/v1/cli/delete
```

### Searching

```bash
# Basic search
curl -H "Authorization: Bearer KEY" \
  "http://127.0.0.1:27124/api/v1/cli/search?query=project+deadline"

# Search with context (grep-style)
curl -H "Authorization: Bearer KEY" \
  "http://127.0.0.1:27124/api/v1/cli/search/context?query=TODO"
```

### Daily notes

```bash
# Read today's daily note
curl -H "Authorization: Bearer KEY" \
  http://127.0.0.1:27124/api/v1/cli/daily/read

# Append to today's daily note
curl -X POST -H "Authorization: Bearer KEY" \
  -H "Content-Type: application/json" \
  -d '{"params": {"content": "- 3pm: Team standup"}}' \
  http://127.0.0.1:27124/api/v1/cli/daily/append

# Get the daily note file path
curl -H "Authorization: Bearer KEY" \
  http://127.0.0.1:27124/api/v1/cli/daily/path
```

### Properties (frontmatter)

```bash
# Read a property
curl -H "Authorization: Bearer KEY" \
  "http://127.0.0.1:27124/api/v1/cli/property/read?path=note.md&name=status"

# Set a property
curl -X POST -H "Authorization: Bearer KEY" \
  -H "Content-Type: application/json" \
  -d '{"params": {"path": "note.md", "name": "status", "value": "done"}}' \
  http://127.0.0.1:27124/api/v1/cli/property/set

# Remove a property
curl -X DELETE -H "Authorization: Bearer KEY" \
  -H "Content-Type: application/json" \
  -d '{"params": {"path": "note.md", "name": "draft"}}' \
  http://127.0.0.1:27124/api/v1/cli/property/remove
```

### Tags and tasks

```bash
# List all tags
curl -H "Authorization: Bearer KEY" \
  http://127.0.0.1:27124/api/v1/cli/tags

# List all tasks
curl -H "Authorization: Bearer KEY" \
  http://127.0.0.1:27124/api/v1/cli/tasks
```

### Vault information

```bash
# Get vault info
curl -H "Authorization: Bearer KEY" \
  http://127.0.0.1:27124/api/v1/cli/vault

# List known vaults
curl -H "Authorization: Bearer KEY" \
  http://127.0.0.1:27124/api/v1/cli/vaults
```

### Plugin management

```bash
# List installed plugins
curl -H "Authorization: Bearer KEY" \
  http://127.0.0.1:27124/api/v1/cli/plugins

# Install a plugin
curl -X POST -H "Authorization: Bearer KEY" \
  -H "Content-Type: application/json" \
  -d '{"params": {"id": "obsidian-git"}}' \
  http://127.0.0.1:27124/api/v1/cli/plugin/install

# Enable a plugin
curl -X POST -H "Authorization: Bearer KEY" \
  -H "Content-Type: application/json" \
  -d '{"params": {"id": "obsidian-git"}}' \
  http://127.0.0.1:27124/api/v1/cli/plugin/enable
```

### Health check

```bash
# Check server status (no auth required)
curl http://127.0.0.1:27124/api/v1/health
```

Returns CLI availability, version, binary path, and server configuration.

### List available commands

```bash
# Get all commands with metadata (no auth required)
curl http://127.0.0.1:27124/api/v1/commands
```

Returns all 110+ commands with their category, HTTP method, danger level, and description.
