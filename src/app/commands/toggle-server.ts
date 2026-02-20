import { Notice } from 'obsidian'
import type { ObsidianCliRestPlugin } from '../plugin'

/**
 * Register the toggle server command.
 */
export function registerToggleServerCommand(plugin: ObsidianCliRestPlugin): void {
    plugin.addCommand({
        id: 'toggle-server',
        name: 'Toggle REST/MCP server',
        callback: () => {
            void toggleServer(plugin)
        }
    })
}

async function toggleServer(plugin: ObsidianCliRestPlugin): Promise<void> {
    if (plugin.isServerRunning()) {
        await plugin.stopServer()
        new Notice('Obsidian CLI REST server stopped')
    } else {
        await plugin.startServer()
        new Notice(
            `Obsidian CLI REST server started on ${plugin.settings.bindAddress}:${plugin.settings.port}`
        )
    }
}

/**
 * Register the copy API key command.
 */
export function registerCopyApiKeyCommand(plugin: ObsidianCliRestPlugin): void {
    plugin.addCommand({
        id: 'copy-api-key',
        name: 'Copy API key to clipboard',
        callback: () => {
            if (!plugin.settings.apiKey) {
                new Notice('No API key configured')
                return
            }
            void navigator.clipboard.writeText(plugin.settings.apiKey)
            new Notice('API key copied to clipboard')
        }
    })
}
