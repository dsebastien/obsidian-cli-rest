import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import * as obsidian from 'obsidian'
import type { App, PluginManifest } from 'obsidian'
import { CliRestMcpPlugin } from './plugin'
import { toggleServer } from './commands/toggle-server'
import { HttpServerWrapper } from './services/http-server'
import { McpServerWrapper } from './services/mcp-server'
import { DEFAULT_SETTINGS } from './types/plugin-settings.intf'

/**
 * Plugin-level lifecycle wiring: the server controller's own tests prove a
 * disposed controller binds nothing, but only these prove the plugin disposes
 * it on unload and checks it after each await.
 */

// Record every Notice, keeping the rest of the preloaded obsidian mock.
const notices: string[] = []
void mock.module('obsidian', () => ({
    ...obsidian,
    Notice: class Notice {
        constructor(message: string) {
            notices.push(message)
        }
    }
}))

/** Reaches the retry loop, with no real wait between attempts. */
class TestPlugin extends CliRestMcpPlugin {
    retryStart(): Promise<void> {
        return this.startServerWithRetry()
    }

    protected override delay(): Promise<void> {
        return Promise.resolve()
    }
}

let saves = 0

const makePlugin = (): TestPlugin => {
    const plugin = new TestPlugin({} as App, {} as PluginManifest)
    plugin.settings = { ...DEFAULT_SETTINGS, bindAddress: '127.0.0.1', port: 0 }
    plugin.saveData = (): Promise<void> => {
        saves += 1
        return Promise.resolve()
    }
    return plugin
}

describe('CliRestMcpPlugin server lifecycle', () => {
    let binds = 0

    beforeEach(() => {
        binds = 0
        saves = 0
        notices.length = 0
        // No real socket: count the binds instead.
        spyOn(HttpServerWrapper.prototype, 'start').mockImplementation(() => {
            binds += 1
            return Promise.resolve()
        })
        spyOn(HttpServerWrapper.prototype, 'stop').mockImplementation(() => Promise.resolve())
    })

    afterEach(() => {
        mock.restore()
    })

    test('a start after unload binds nothing', async () => {
        const plugin = makePlugin()
        plugin.onunload()
        expect(await plugin.startServer()).toBe(false)
        expect(binds).toBe(0)
    })

    test('a start before unload binds (the control for the test above)', async () => {
        const plugin = makePlugin()
        expect(await plugin.startServer()).toBe(true)
        expect(binds).toBe(1)
        plugin.onunload()
    })

    test('an instance unloaded while its start was stopping the old server saves no API key', async () => {
        // 0.0.0.0 with an empty key makes startServer generate and save one.
        // Unloaded meanwhile, it must write nothing: the save would overwrite
        // what the next instance loaded.
        const plugin = makePlugin()
        plugin.settings = { ...plugin.settings, bindAddress: '0.0.0.0', apiKey: '' }
        const starting = plugin.startServer() // suspended in stopServer()
        plugin.onunload()
        expect(await starting).toBe(false)
        expect(saves).toBe(0)
        expect(plugin.settings.apiKey).toBe('')
        expect(binds).toBe(0)
    })

    test('the auto-start retry stops once the user has started the server', async () => {
        const plugin = makePlugin()
        let running = false
        let attempts = 0
        plugin.isServerRunning = (): boolean => running
        plugin.startServer = (): Promise<boolean> => {
            attempts += 1
            // The port is taken; meanwhile the user starts the server from the
            // command palette.
            running = true
            return Promise.reject(new Error('listen EADDRINUSE: address already in use'))
        }
        await plugin.retryStart()
        expect(attempts).toBe(1)
        expect(notices).toEqual([])
    })

    test('an unloaded instance does not report its failed auto-start', async () => {
        const plugin = makePlugin()
        plugin.startServer = (): Promise<boolean> => {
            // Unloaded while this attempt was binding; the failure is moot.
            plugin.onunload()
            return Promise.reject(new Error('listen EACCES: permission denied'))
        }
        await plugin.retryStart()
        expect(notices).toEqual([])
    })

    test('a failed auto-start is reported while the instance is loaded', async () => {
        const plugin = makePlugin()
        plugin.startServer = (): Promise<boolean> =>
            Promise.reject(new Error('listen EACCES: permission denied'))
        await plugin.retryStart()
        expect(notices).toEqual([
            'REST and MCP server: Failed to start server: listen EACCES: permission denied'
        ])
        plugin.onunload()
    })

    test('an instance unloaded while saving a generated API key does not announce it', async () => {
        const plugin = makePlugin()
        plugin.settings = { ...plugin.settings, bindAddress: '0.0.0.0', apiKey: '' }
        plugin.saveData = (): Promise<void> => {
            saves += 1
            plugin.onunload()
            return Promise.resolve()
        }
        expect(await plugin.startServer()).toBe(false)
        expect(saves).toBe(1)
        expect(notices).toEqual([])
        expect(binds).toBe(0)
    })
})

describe('CliRestMcpPlugin MCP server on a failed start', () => {
    afterEach(() => {
        mock.restore()
    })

    test('the MCP server built for a start whose bind fails is closed', async () => {
        const plugin = makePlugin()
        plugin.settings = { ...plugin.settings, enableMcp: true }
        spyOn(HttpServerWrapper.prototype, 'start').mockImplementation(() =>
            Promise.reject(new Error('listen EADDRINUSE: address already in use'))
        )
        spyOn(HttpServerWrapper.prototype, 'stop').mockImplementation(() => Promise.resolve())
        let closes = 0
        spyOn(McpServerWrapper.prototype, 'close').mockImplementation(() => {
            closes += 1
            return Promise.resolve()
        })
        const failure = await plugin.startServer().then(
            () => null,
            (error: unknown) => error
        )
        expect(String(failure)).toContain('EADDRINUSE')
        expect(closes).toBe(1)
        plugin.onunload()
    })
})

describe('toggle server command', () => {
    beforeEach(() => {
        notices.length = 0
    })

    test('reports a failed start in a Notice instead of rejecting', async () => {
        const plugin = makePlugin()
        plugin.isServerRunning = (): boolean => false
        plugin.startServer = (): Promise<boolean> =>
            Promise.reject(new Error('listen EADDRINUSE: address already in use'))
        await toggleServer(plugin)
        expect(notices).toEqual([
            'REST and MCP server: Failed to toggle the server: listen EADDRINUSE: address already in use'
        ])
    })

    test('announces nothing when the start did not happen (plugin unloaded)', async () => {
        const plugin = makePlugin()
        plugin.isServerRunning = (): boolean => false
        plugin.startServer = (): Promise<boolean> => Promise.resolve(false)
        await toggleServer(plugin)
        expect(notices).toEqual([])
    })

    test('announces a successful start', async () => {
        const plugin = makePlugin()
        plugin.isServerRunning = (): boolean => false
        plugin.startServer = (): Promise<boolean> => Promise.resolve(true)
        await toggleServer(plugin)
        expect(notices).toEqual(['REST and MCP server started on 127.0.0.1:0'])
    })
})
