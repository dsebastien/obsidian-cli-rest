import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import * as obsidian from 'obsidian'
import { produce } from 'immer'
import type { App, PluginManifest } from 'obsidian'
import { CliRestMcpPlugin } from './plugin'
import { toggleServer } from './commands/toggle-server'
import { HttpServerWrapper } from './services/http-server'
import { McpServerWrapper } from './services/mcp-server'
import { DEFAULT_SETTINGS, createDefaultSettings } from './types/plugin-settings.intf'

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
    plugin.settings = { ...createDefaultSettings(), bindAddress: '127.0.0.1', port: 0 }
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

    test('the MCP server built for a start abandoned by an unload is closed', async () => {
        const plugin = makePlugin()
        plugin.settings = { ...plugin.settings, enableMcp: true }
        spyOn(HttpServerWrapper.prototype, 'start').mockImplementation(() => {
            plugin.onunload() // unloaded while binding
            return Promise.resolve()
        })
        spyOn(HttpServerWrapper.prototype, 'stop').mockImplementation(() => Promise.resolve())
        let closes = 0
        spyOn(McpServerWrapper.prototype, 'close').mockImplementation(() => {
            closes += 1
            return Promise.resolve()
        })
        expect(await plugin.startServer()).toBe(false)
        expect(closes).toBe(1)
    })
})

describe('CliRestMcpPlugin unloaded once the controller has resolved', () => {
    const RECORD_KEY = Symbol.for('cli-rest-mcp/http-server')

    afterEach(() => {
        mock.restore()
        Reflect.deleteProperty(self, RECORD_KEY)
    })

    test('closes the MCP server instead of keeping it', async () => {
        // The controller records the server and returns it; the unload lands
        // right then, before startServer resumes. Recording is observed
        // through the window record the controller writes.
        const plugin = makePlugin()
        plugin.settings = { ...plugin.settings, enableMcp: true }
        let record: unknown
        Object.defineProperty(self, RECORD_KEY, {
            configurable: true,
            get: () => record,
            set: (value: unknown) => {
                record = value
                if (value) {
                    plugin.onunload()
                }
            }
        })
        spyOn(HttpServerWrapper.prototype, 'start').mockImplementation(() => Promise.resolve())
        spyOn(HttpServerWrapper.prototype, 'stop').mockImplementation(() => Promise.resolve())
        let closes = 0
        spyOn(McpServerWrapper.prototype, 'close').mockImplementation(() => {
            closes += 1
            return Promise.resolve()
        })
        expect(await plugin.startServer()).toBe(false)
        expect(closes).toBe(1)
    })
})

describe('CliRestMcpPlugin settings writes after unload', () => {
    afterEach(() => {
        mock.restore()
    })

    test('a key write queued behind an in-flight write is dropped once unloaded', async () => {
        const plugin = makePlugin()
        plugin.settings = { ...plugin.settings, bindAddress: '0.0.0.0', apiKey: '' }
        let releaseSave: () => void = () => {}
        const written: string[] = []
        plugin.saveData = (data: unknown): Promise<void> => {
            written.push((data as { apiKey: string }).apiKey)
            if (written.length > 1) {
                return Promise.resolve()
            }
            return new Promise<void>((resolve) => {
                releaseSave = resolve
            })
        }
        spyOn(HttpServerWrapper.prototype, 'start').mockImplementation(() => Promise.resolve())
        spyOn(HttpServerWrapper.prototype, 'stop').mockImplementation(() => Promise.resolve())
        const portWrite = plugin.updateSettings((draft) => {
            draft.port = 27199
        })
        const starting = plugin.startServer() // queues the key write
        for (let tick = 0; tick < 20; tick += 1) {
            await Promise.resolve()
        }
        plugin.onunload()
        releaseSave()
        await portWrite
        expect(await starting).toBe(false)
        expect(written).toEqual(['']) // only the write that was already running
        expect(plugin.settings.apiKey).toBe('')
    })

    test('a blank key counts as missing', async () => {
        const plugin = makePlugin()
        plugin.settings = { ...plugin.settings, bindAddress: '0.0.0.0', apiKey: '   ' }
        spyOn(HttpServerWrapper.prototype, 'start').mockImplementation(() => Promise.resolve())
        spyOn(HttpServerWrapper.prototype, 'stop').mockImplementation(() => Promise.resolve())
        expect(await plugin.startServer()).toBe(true)
        expect(plugin.settings.apiKey.trim()).not.toBe('')
        expect(notices).toContain('API key auto-generated (required when binding beyond localhost)')
        plugin.onunload()
    })
})

describe('CliRestMcpPlugin API key on a 0.0.0.0 start', () => {
    afterEach(() => {
        mock.restore()
    })

    test('a settings write in flight cannot drop the generated key', async () => {
        // A write that began before the key was generated carries a key-less
        // snapshot. Committing it after the key was set must not leave the
        // server (and the settings) without one.
        const plugin = makePlugin()
        plugin.settings = { ...plugin.settings, bindAddress: '0.0.0.0', apiKey: '' }
        let releaseSave: () => void = () => {}
        let held = true
        plugin.saveData = (): Promise<void> => {
            if (!held) {
                return Promise.resolve()
            }
            held = false
            return new Promise<void>((resolve) => {
                releaseSave = resolve
            })
        }
        const bound: boolean[] = []
        spyOn(HttpServerWrapper.prototype, 'start').mockImplementation(() => {
            bound.push(plugin.settings.apiKey !== '')
            return Promise.resolve()
        })
        spyOn(HttpServerWrapper.prototype, 'stop').mockImplementation(() => Promise.resolve())
        const portWrite = plugin.updateSettings((draft) => {
            draft.port = 27199
        })
        const starting = plugin.startServer()
        for (let tick = 0; tick < 20; tick += 1) {
            await Promise.resolve()
        }
        releaseSave()
        await portWrite
        expect(await starting).toBe(true)
        expect(bound).toEqual([true])
        expect(plugin.settings.apiKey).not.toBe('')
        expect(plugin.settings.port).toBe(27199)
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
            'Failed to start server: listen EADDRINUSE: address already in use'
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

describe('default settings', () => {
    test('constructing the plugin never freezes the shared defaults', () => {
        const plugin = new CliRestMcpPlugin({} as App, {} as PluginManifest)
        expect(Object.isFrozen(plugin.settings)).toBe(true)
        expect(Object.isFrozen(DEFAULT_SETTINGS)).toBe(false)
        expect(Object.isFrozen(DEFAULT_SETTINGS.blockedCommands)).toBe(false)
    })

    const bareLoader = (stored: unknown): CliRestMcpPlugin =>
        // Skip the constructor: its field initializer is the test above.
        Object.assign(Object.create(CliRestMcpPlugin.prototype) as CliRestMcpPlugin, {
            settings: produce(createDefaultSettings(), () => {}),
            loadData: (): Promise<unknown> => Promise.resolve(stored),
            saveData: (): Promise<void> => Promise.resolve()
        })

    test('loadSettings with no stored data never freezes the shared defaults', async () => {
        const plugin = bareLoader(null)

        await plugin.loadSettings()

        // Immer deep-freezes what produce returns, including subtrees shared
        // with its base: producing from DEFAULT_SETTINGS froze the constant
        // for the rest of the process.
        expect(plugin.settings).toEqual(DEFAULT_SETTINGS)
        // This branch replaces the settings; they must not become the constant.
        expect(plugin.settings).not.toBe(DEFAULT_SETTINGS)
        expect(Object.isFrozen(DEFAULT_SETTINGS)).toBe(false)
        expect(Object.isFrozen(DEFAULT_SETTINGS.blockedCommands)).toBe(false)
    })

    test('merging invalid stored data never freezes the shared defaults', async () => {
        // An invalid port fails the whole parse, so loadSettings merges the
        // valid fields onto the defaults; blockedCommands is absent and so
        // stays shared with the produce base.
        const plugin = bareLoader({ port: 1, bindAddress: '0.0.0.0' })

        await plugin.loadSettings()

        expect(plugin.settings.bindAddress).toBe('0.0.0.0')
        expect(plugin.settings.port).toBe(DEFAULT_SETTINGS.port)
        expect(Object.isFrozen(DEFAULT_SETTINGS)).toBe(false)
        expect(Object.isFrozen(DEFAULT_SETTINGS.blockedCommands)).toBe(false)
    })

    test('each default settings object is an independent copy', () => {
        const one = createDefaultSettings()
        one.blockedCommands.push('delete')
        expect(createDefaultSettings().blockedCommands).toEqual([])
        expect(DEFAULT_SETTINGS.blockedCommands).toEqual([])
    })
})
