import { Notice } from 'obsidian'
import type { CliRestMcpPlugin } from '../plugin'
import { log } from '../../utils/log'
import { MISSING_API_KEY_MESSAGE } from '../services/api-key-secret'

/**
 * Register the toggle server command.
 */
export function registerToggleServerCommand(plugin: CliRestMcpPlugin): void {
    plugin.addCommand({
        id: 'toggle-server',
        name: 'Toggle REST/MCP server',
        callback: () => {
            void toggleServer(plugin)
        }
    })
}

/**
 * Stop a running server, or start one. Never rejects: a failure (a taken
 * port, say) is reported in a Notice, like the settings pane does, instead
 * of escaping as an unhandled rejection the user never sees.
 */
export async function toggleServer(plugin: CliRestMcpPlugin): Promise<void> {
    const stopping = plugin.isServerRunning()
    try {
        if (stopping) {
            await plugin.stopServer()
            new Notice('REST and MCP server stopped')
            return
        }
        // False means the plugin was unloaded meanwhile: nothing started,
        // so nothing to announce.
        if (await plugin.startServer()) {
            new Notice(
                `REST and MCP server started on ${plugin.settings.bindAddress}:${plugin.settings.port}`
            )
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        log(`Toggling the server failed: ${msg}`, 'error')
        // Worded like the settings pane's Start/Stop button reports it.
        new Notice(`Failed to ${stopping ? 'stop' : 'start'} server: ${msg}`)
    }
}

/**
 * Register the copy API key command.
 */
export function registerCopyApiKeyCommand(plugin: CliRestMcpPlugin): void {
    plugin.addCommand({
        id: 'copy-api-key',
        name: 'Copy API key to clipboard',
        callback: () => {
            // Read from SecretStorage at use time.
            const apiKey = plugin.getApiKey()
            if (!apiKey) {
                new Notice(
                    plugin.isApiKeyMissing() ? MISSING_API_KEY_MESSAGE : 'No API key configured'
                )
                return
            }
            void navigator.clipboard.writeText(apiKey)
            new Notice('API key copied to clipboard')
        }
    })
}

/**
 * Register the copy REST API URL command.
 */
export function registerCopyRestUrlCommand(plugin: CliRestMcpPlugin): void {
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
export function registerCopyMcpUrlCommand(plugin: CliRestMcpPlugin): void {
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
export function registerCopyDocsUrlCommand(plugin: CliRestMcpPlugin): void {
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
