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

/**
 * Register the copy REST API URL command.
 */
export function registerCopyRestUrlCommand(plugin: ObsidianCliRestPlugin): void {
    plugin.addCommand({
        id: 'copy-rest-url',
        name: 'Copy REST API URL to clipboard',
        callback: () => {
            const url = `http://${plugin.settings.bindAddress}:${plugin.settings.port}/api/v1`
            void navigator.clipboard.writeText(url)
            new Notice(`REST API URL copied: ${url}`)
        }
    })
}

/**
 * Register the copy MCP server URL command.
 */
export function registerCopyMcpUrlCommand(plugin: ObsidianCliRestPlugin): void {
    plugin.addCommand({
        id: 'copy-mcp-url',
        name: 'Copy MCP server URL to clipboard',
        callback: () => {
            const url = `http://${plugin.settings.bindAddress}:${plugin.settings.port}/mcp`
            void navigator.clipboard.writeText(url)
            new Notice(`MCP server URL copied: ${url}`)
        }
    })
}

/**
 * Register the copy API docs URL command.
 */
export function registerCopyDocsUrlCommand(plugin: ObsidianCliRestPlugin): void {
    plugin.addCommand({
        id: 'copy-docs-url',
        name: 'Copy API docs URL to clipboard',
        callback: () => {
            const url = `http://${plugin.settings.bindAddress}:${plugin.settings.port}/api/v1/docs`
            void navigator.clipboard.writeText(url)
            new Notice(`API docs URL copied: ${url}`)
        }
    })
}
