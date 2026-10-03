### Your API key now lives in Obsidian's secret storage

The API key used to sit in plain text in the plugin's data file, which syncs with your vault (Git, Syncthing, cloud sync). It is now kept in Obsidian's secret storage on each device instead. The plugin settings only remember the name of the secret.

- **Nothing to do.** Every device moves its key into its own secret storage automatically on its next start. Your scripts and MCP clients keep working with the same key.
- **The plain-text copy is removed after 60 days.** It stays in the data file for now so that all your synced devices can pick up the key on their own. Once every device runs this version, you can remove it right away with **Remove plain-text copy now** in **Settings → REST and MCP server → Security**.
- **Regenerating the key** now writes the new key to this device's secret storage only. Enter it on your other devices too, and update your clients.
- If a device ever has neither the secret nor the plain-text copy, the plugin tells you and does not start the server, instead of silently creating a new key that would break your clients.
