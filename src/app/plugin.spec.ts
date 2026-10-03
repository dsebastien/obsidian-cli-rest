import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import * as obsidian from 'obsidian'
import { produce } from 'immer'
import type { App, PluginManifest } from 'obsidian'
import { CliRestMcpPlugin } from './plugin'
import { toggleServer } from './commands/toggle-server'
import { HttpServerWrapper } from './services/http-server'
import { McpServerWrapper } from './services/mcp-server'
import { DEFAULT_SETTINGS, createDefaultSettings } from './types/plugin-settings.intf'
import type { SecretStore } from './services/api-key-secret'
import { MemorySecretStore } from '../../test/memory-secret-store'

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
    store = new MemorySecretStore()

    clock = new Date()

    protected override get secretStore(): SecretStore {
        return this.store
    }

    protected override now(): Date {
        return this.clock
    }

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
        plugin.settings = { ...plugin.settings, bindAddress: '0.0.0.0', apiKeySecretName: '' }
        const starting = plugin.startServer() // suspended in stopServer()
        plugin.onunload()
        expect(await starting).toBe(false)
        expect(saves).toBe(0)
        expect(plugin.getApiKey()).toBe('')
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
        plugin.settings = { ...plugin.settings, bindAddress: '0.0.0.0', apiKeySecretName: '' }
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
        plugin.settings = { ...plugin.settings, bindAddress: '0.0.0.0', apiKeySecretName: '' }
        let releaseSave: () => void = () => {}
        const written: string[] = []
        plugin.saveData = (data: unknown): Promise<void> => {
            written.push((data as { apiKeySecretName: string }).apiKeySecretName)
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
        expect(plugin.getApiKey()).toBe('')
    })

    test('a blank key counts as missing', async () => {
        const plugin = makePlugin()
        plugin.settings = {
            ...plugin.settings,
            bindAddress: '0.0.0.0',
            apiKeySecretName: '',
            apiKey: '   '
        }
        spyOn(HttpServerWrapper.prototype, 'start').mockImplementation(() => Promise.resolve())
        spyOn(HttpServerWrapper.prototype, 'stop').mockImplementation(() => Promise.resolve())
        expect(await plugin.startServer()).toBe(true)
        expect(plugin.getApiKey().trim()).not.toBe('')
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
        plugin.settings = { ...plugin.settings, bindAddress: '0.0.0.0', apiKeySecretName: '' }
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
            bound.push(plugin.getApiKey() !== '')
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
        expect(plugin.getApiKey()).not.toBe('')
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
            app: { secretStorage: new MemorySecretStore() },
            loadData: (): Promise<unknown> => Promise.resolve(stored),
            saveData: (): Promise<void> => Promise.resolve()
        })

    test('loadSettings with no stored data never freezes the shared defaults', async () => {
        const plugin = bareLoader(null)

        await plugin.loadSettings()

        // Immer deep-freezes what produce returns, including subtrees shared
        // with its base: producing from DEFAULT_SETTINGS froze the constant
        // for the rest of the process.
        expect({ ...plugin.settings, apiKeySecretName: '' }).toEqual(DEFAULT_SETTINGS)
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

describe('API key in secret storage', () => {
    const NAME = 'cli-rest-mcp-api-key'
    const T0 = new Date('2026-10-03T12:00:00.000Z')

    /** A plugin whose data.json is `stored`; returns what each save wrote. */
    const loadWith = (
        stored: unknown,
        store = new MemorySecretStore(),
        now = T0
    ): { plugin: TestPlugin; saved: Record<string, unknown>[] } => {
        const plugin = makePlugin()
        plugin.store = store
        const saved: Record<string, unknown>[] = []
        plugin.loadData = (): Promise<unknown> => Promise.resolve(stored)
        plugin.saveData = (data: unknown): Promise<void> => {
            saved.push({ ...(data as Record<string, unknown>) })
            return Promise.resolve()
        }
        plugin.clock = now
        return { plugin, saved }
    }

    beforeEach(() => {
        notices.length = 0
    })

    afterEach(() => {
        mock.restore()
    })

    test('device A: the legacy key keeps working and stays in data.json as bootstrap', async () => {
        const { plugin, saved } = loadWith({ port: 27124, apiKey: 'old-key' })
        await plugin.loadSettings()
        expect(plugin.getApiKey()).toBe('old-key')
        expect(plugin.store.getSecret(NAME)).toBe('old-key')
        expect(saved).toHaveLength(1)
        expect(saved[0]?.['apiKey']).toBe('old-key')
        expect(saved[0]?.['apiKeySecretName']).toBe(NAME)
        expect(saved[0]?.['legacySecretMigratedAt']).toBe(T0.toISOString())
        expect(notices).toEqual([])
    })

    test('device B: synced data.json and empty secret storage migrate with no action', async () => {
        const a = loadWith({ apiKey: 'old-key' })
        await a.plugin.loadSettings()
        const synced = a.saved[0]
        const b = loadWith(synced, new MemorySecretStore())
        await b.plugin.loadSettings()
        expect(b.plugin.getApiKey()).toBe('old-key')
        expect(b.plugin.store.getSecret(NAME)).toBe('old-key')
        expect(b.plugin.isApiKeyMissing()).toBe(false)
        expect(notices).toEqual([])
        spyOn(HttpServerWrapper.prototype, 'start').mockImplementation(() => Promise.resolve())
        spyOn(HttpServerWrapper.prototype, 'stop').mockImplementation(() => Promise.resolve())
        expect(await b.plugin.startServer()).toBe(true)
        b.plugin.onunload()
    })

    test('loading twice is idempotent', async () => {
        const first = loadWith({ apiKey: 'old-key' })
        await first.plugin.loadSettings()
        const second = loadWith(first.saved[0], first.plugin.store)
        await second.plugin.loadSettings()
        expect(second.saved).toEqual([])
        expect(second.plugin.getApiKey()).toBe('old-key')
    })

    test('rotating the key writes secret storage only and removes the legacy copy', async () => {
        const { plugin, saved } = loadWith({ apiKey: 'old-key' })
        await plugin.loadSettings()
        await plugin.regenerateApiKey()
        const rotated = plugin.getApiKey()
        expect(rotated).not.toBe('old-key')
        expect(plugin.store.getSecret(NAME)).toBe(rotated)
        const last = saved[saved.length - 1]
        expect(last && 'apiKey' in last).toBe(false)
        expect(JSON.stringify(saved[saved.length - 1])).not.toContain(rotated)
    })

    test('choosing another secret removes the legacy copy', async () => {
        const store = new MemorySecretStore({ 'my-key': 'chosen' })
        const { plugin } = loadWith({ apiKey: 'old-key' }, store)
        await plugin.loadSettings()
        await plugin.setApiKeySecretName('my-key')
        expect(plugin.hasLegacyPlaintextApiKey()).toBe(false)
        expect(plugin.getApiKey()).toBe('chosen')
    })

    test('the 60-day purge removes the legacy copy and keeps the key', async () => {
        const a = loadWith({ apiKey: 'old-key' })
        await a.plugin.loadSettings()
        const later = new Date(T0.getTime() + 60 * 24 * 60 * 60 * 1000)
        const b = loadWith(a.saved[0], a.plugin.store, later)
        await b.plugin.loadSettings()
        expect(b.saved).toHaveLength(1)
        expect(b.saved[0] && 'apiKey' in b.saved[0]).toBe(false)
        expect(b.plugin.getApiKey()).toBe('old-key')
    })

    test('the "Remove plain-text copy now" action removes it, keeping the key', async () => {
        const a = loadWith({ apiKey: 'old-key' })
        await a.plugin.loadSettings()
        // Another device, which has not migrated yet: the action migrates first.
        const b = loadWith(a.saved[0], new MemorySecretStore())
        b.plugin.settings = { ...b.plugin.settings, ...(a.saved[0] as object) }
        await b.plugin.removeLegacyPlaintextApiKey()
        expect(b.plugin.hasLegacyPlaintextApiKey()).toBe(false)
        expect(b.plugin.store.getSecret(NAME)).toBe('old-key')
        expect(b.plugin.getApiKey()).toBe('old-key')
    })

    test('fresh install generates a key into secret storage, never into data.json', async () => {
        const { plugin, saved } = loadWith(null)
        await plugin.loadSettings()
        const key = plugin.getApiKey()
        expect(key).toHaveLength(64)
        expect(plugin.store.getSecret(NAME)).toBe(key)
        expect(JSON.stringify(saved)).not.toContain(key)
    })

    test('a device with neither secret nor legacy copy is told, refuses to start, and nothing is regenerated', async () => {
        const { plugin } = loadWith({ apiKeySecretName: NAME, legacySecretMigratedAt: '' })
        await plugin.loadSettings()
        expect(plugin.isApiKeyMissing()).toBe(true)
        expect(plugin.store.writes).toBe(0)
        expect(notices).toHaveLength(1)
        expect(notices[0]).toContain('not set on this device')
        const failure = await plugin.startServer().then(
            () => null,
            (error: unknown) => error
        )
        expect(String(failure)).toContain('not set on this device')
        expect(plugin.store.writes).toBe(0)
        plugin.onunload()
    })
})
