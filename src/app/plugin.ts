import { ServerController } from './services/server-controller'
import { registerWhatsNewView } from './whats-new'
import { Notice, Plugin } from 'obsidian'
import { createDefaultSettings, pluginSettingsSchema } from './types/plugin-settings.intf'
import type { PluginSettings } from './types/plugin-settings.intf'
import { CliRestMcpSettingTab } from './settings/settings-tab'
import { log } from '../utils/log'
import { produce } from 'immer'
import type { Draft } from 'immer'
import { generateApiKey } from '../utils/crypto'
import { checkCliAvailability } from './services/cli-availability-checker'
import type { CliAvailabilityResult } from './services/cli-availability-checker'
import { discoverCliCommands } from './services/cli-command-discovery'
import {
    CLI_COMMAND_REGISTRY,
    isDangerousPattern,
    mergeDiscoveredCommands
} from './domain/cli-command-registry'
import type { CliCommandDefinition } from './domain/cli-command'
import { HttpServerWrapper, isLoopback } from './services/http-server'
import { McpServerWrapper } from './services/mcp-server'
import {
    MISSING_API_KEY_MESSAGE,
    isApiKeyMissing,
    peekApiKey,
    readApiKey,
    readSecret,
    resolveApiKeySecret,
    storeNewApiKey
} from './services/api-key-secret'
import type { SecretStore } from './services/api-key-secret'
import {
    registerToggleServerCommand,
    registerCopyApiKeyCommand,
    registerCopyRestUrlCommand,
    registerCopyMcpUrlCommand,
    registerCopyDocsUrlCommand
} from './commands/toggle-server'

/** Pre-computed set of static registry command names for quick lookup during discovery. */
const CLI_COMMAND_REGISTRY_NAMES = new Set(CLI_COMMAND_REGISTRY.map((c) => c.command))

export class CliRestMcpPlugin extends Plugin {
    override settings: PluginSettings = produce(createDefaultSettings(), () => {})
    cliStatus: CliAvailabilityResult = {
        available: false,
        binaryPath: '',
        version: '',
        error: 'Not checked yet'
    }

    /** Owns the HTTP server; disposed on unload so a late start cannot bind. */
    private readonly serverController = new ServerController<HttpServerWrapper>()

    private get httpServer(): HttpServerWrapper | null {
        return this.serverController.server
    }
    private mcpServer: McpServerWrapper | null = null
    private statusBarEl: HTMLElement | null = null
    /**
     * In-flight CLI recheck promise, used to dedupe concurrent self-heal
     * attempts triggered by simultaneous requests arriving while the CLI is
     * still marked unavailable.
     */
    private recheckInFlight: Promise<CliAvailabilityResult> | null = null
    /** Obsidian's device-local secret storage (protected: specs substitute it). */
    protected get secretStore(): SecretStore {
        return this.app.secretStorage
    }

    /** Clock for the legacy plaintext grace period (protected: specs substitute it). */
    protected now(): Date {
        return new Date()
    }

    /**
     * The API key, read at use time: this device's SecretStorage, else the
     * legacy plaintext copy still in data.json (migrated into SecretStorage on
     * the spot). Never cached in the settings. '' when neither holds a key.
     */
    getApiKey(): string {
        return readApiKey(this.secretStore, this.settings)
    }

    /** Whether a secret name is configured but neither this device nor data.json holds a key. */
    isApiKeyMissing(): boolean {
        return isApiKeyMissing(this.secretStore, this.settings)
    }

    /** Whether data.json still carries the legacy plaintext key. */
    hasLegacyPlaintextApiKey(): boolean {
        return this.settings.apiKey !== undefined
    }

    /**
     * Rotate the API key: store a new one in SecretStorage only, drop the
     * (now stale) legacy plaintext copy, and apply it to a running server.
     */
    async regenerateApiKey(): Promise<void> {
        const key = generateApiKey()
        const current = this.settings.apiKeySecretName
        const name = current || storeNewApiKey(this.secretStore, key)
        if (current) {
            this.secretStore.setSecret(current, key)
        }
        await this.updateSettings((draft) => {
            draft.apiKeySecretName = name
            delete draft.apiKey
        })
        await this.syncServerAuth()
    }

    /**
     * Point the settings at another secret (the settings picker). The legacy
     * plaintext copy no longer describes the key in use, so it goes.
     */
    async setApiKeySecretName(name: string): Promise<void> {
        await this.updateSettings((draft) => {
            draft.apiKeySecretName = name
            delete draft.apiKey
        })
        await this.syncServerAuth()
    }

    /**
     * "Remove plain-text copy now": make sure this device's SecretStorage
     * holds the key first, then drop the legacy field from data.json.
     */
    async removeLegacyPlaintextApiKey(): Promise<void> {
        const key = this.getApiKey()
        if (key.trim() && readSecret(this.secretStore, this.settings.apiKeySecretName) !== key) {
            throw new Error('Could not store the API key in secret storage')
        }
        await this.updateSettings((draft) => {
            delete draft.apiKey
        })
    }

    override async onload(): Promise<void> {
        // Must run before anything can call saveData (fresh-install detection)
        registerWhatsNewView(this)
        log('Initializing', 'debug')
        // Also migrates a legacy plaintext API key into SecretStorage and
        // generates one on a fresh install.
        await this.loadSettings()

        // Register commands
        registerToggleServerCommand(this)
        registerCopyApiKeyCommand(this)
        registerCopyRestUrlCommand(this)
        registerCopyMcpUrlCommand(this)
        registerCopyDocsUrlCommand(this)

        // Add settings tab
        this.addSettingTab(new CliRestMcpSettingTab(this.app, this))

        // Status bar
        this.statusBarEl = this.addStatusBarItem()
        this.updateStatusBar()

        // Defer CLI availability check, command discovery, and auto-start
        // until Obsidian's UI is fully constructed AND all community plugins
        // have run their own `onload()`. This matters because the Obsidian
        // launcher (`/usr/bin/obsidian` etc.) is not an independent CLI; it
        // forwards `obsidian <subcommand>` over Electron single-instance IPC
        // back into the running instance. The sibling plugin that actually
        // serves `version` may not be registered yet at the moment our own
        // `onload()` returns. Layout-ready is the earliest event after which
        // that handler is guaranteed to be wired up.
        this.app.workspace.onLayoutReady(() => {
            void this.initializeInBackground()
        })
    }

    /**
     * Deferred initialization: probe the Obsidian CLI, discover its commands,
     * propagate the result to any running server, and auto-start the server
     * if configured. Runs after onload() returns so Obsidian isn't blocked.
     */
    private async initializeInBackground(): Promise<void> {
        try {
            this.cliStatus = await checkCliAvailability()
            if (this.serverController.isDisposed) {
                return
            }
            if (!this.cliStatus.available) {
                new Notice(
                    'REST and MCP server: CLI binary not found. Install the Obsidian CLI to use this plugin.'
                )
            } else {
                await this.discoverCommands()
                if (this.serverController.isDisposed) {
                    return
                }
            }

            // If the user manually started the server before the probe finished,
            // refresh its context so requests see the real CLI status.
            if (this.httpServer) {
                this.httpServer.updateContext(this.buildContext())
            }
            if (this.mcpServer) {
                this.mcpServer.updateContext(this.buildContext())
            }

            if (this.settings.autoStart && !this.isServerRunning()) {
                await this.startServerWithRetry()
            }

            this.updateStatusBar()
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error'
            log(`Background initialization failed: ${msg}`, 'error')
        }
    }

    override onunload(): void {
        // Dispose first: a start still in flight in the background must not
        // bind the port after this instance is gone.
        void this.mcpServer?.close()
        this.mcpServer = null
        void this.serverController.dispose()
    }

    /**
     * Start the server with retry logic to handle EADDRINUSE during
     * plugin reloads (the old server may not have fully released the port yet).
     */
    protected async startServerWithRetry(): Promise<void> {
        const MAX_RETRIES = 3
        const RETRY_DELAY_MS = 500

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            // Re-checked on every attempt: the instance may have been unloaded,
            // or the user may have started the server (command or settings)
            // while this retry waited. Retrying then would tear that server
            // down and rebuild it.
            if (this.serverController.isDisposed || this.isServerRunning()) {
                return
            }
            try {
                await this.startServer()
                return
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Unknown error'
                const isPortInUse = msg.includes('EADDRINUSE')

                if (isPortInUse && attempt < MAX_RETRIES) {
                    log(
                        `Port in use, retrying in ${RETRY_DELAY_MS}ms (attempt ${attempt}/${MAX_RETRIES})`,
                        'warn'
                    )
                    await this.delay(RETRY_DELAY_MS)
                } else {
                    log(`Auto-start failed: ${msg}`, 'error')
                    // An unloaded instance has nothing to report: its failure
                    // is moot, and the Notice would outlive the plugin.
                    if (!this.serverController.isDisposed) {
                        new Notice(`REST and MCP server: Failed to start server: ${msg}`)
                    }
                    return
                }
            }
        }
    }

    protected delay(ms: number): Promise<void> {
        return new Promise((resolve) => window.setTimeout(resolve, ms))
    }

    /**
     * Start (or restart) the server. Resolves true when a server is running
     * for this instance afterwards, false when the instance was unloaded
     * first; rejects when the bind fails.
     */
    async startServer(): Promise<boolean> {
        if (this.serverController.isDisposed) {
            return false
        }
        await this.stopServer()
        // Every await is a point where the plugin can be unloaded. After that,
        // nothing may be written: an unloaded instance saving a fresh API key
        // would overwrite what its successor loaded.
        if (this.serverController.isDisposed) {
            return false
        }

        // A secret name with no value on this device (data.json synced from
        // another device; SecretStorage is device-local). Starting would
        // disable auth, and generating a key would break every configured
        // client: refuse, and tell the user what to set.
        if (this.isApiKeyMissing()) {
            throw new Error(
                `API key secret "${this.settings.apiKeySecretName}" is not set on this device. Set it in the plugin's Security settings.`
            )
        }

        // Enforce API key when binding to all interfaces. Through
        // updateSettings, which queues behind any write in flight: assigning
        // this.settings directly could be overwritten by that write's
        // key-less snapshot before the server is created. The wrapper also
        // refuses a non-loopback bind without a key, whatever happens here.
        // Only reached with no secret name at all (never a missing secret,
        // refused above), so no configured client can be broken by it.
        if (!isLoopback(this.settings.bindAddress) && !this.getApiKey().trim()) {
            let generated = false
            await this.updateSettings((draft) => {
                if (!isLoopback(draft.bindAddress) && !peekApiKey(this.secretStore, draft).trim()) {
                    draft.apiKeySecretName = storeNewApiKey(this.secretStore, generateApiKey())
                    generated = true
                }
            })
            if (this.serverController.isDisposed) {
                return false
            }
            if (generated) {
                new Notice('API key auto-generated (required when binding beyond localhost)')
            }
        }

        const context = this.buildContext()

        // Create MCP server if enabled
        let mcpServer: McpServerWrapper | null = null
        if (this.settings.enableMcp) {
            mcpServer = new McpServerWrapper(context)
        }

        // The controller closes a server a dead predecessor left running,
        // binds, and records the new one only if this instance is still loaded.
        let started: HttpServerWrapper | null
        try {
            started = await this.serverController.start(
                () =>
                    new HttpServerWrapper({
                        port: this.settings.port,
                        bindAddress: this.settings.bindAddress,
                        apiKey: this.getApiKey(),
                        enableCors: this.settings.enableCors,
                        context,
                        mcpHandler: mcpServer
                            ? (req, res) => mcpServer.handleRequest(req, res)
                            : undefined
                    })
            )
        } catch (err) {
            await mcpServer?.close()
            throw err
        }
        // Unloaded while the bind ran (the controller undid it) or right
        // after it resolved: the MCP server built for it serves nothing.
        if (!started || this.serverController.isDisposed) {
            await mcpServer?.close()
            return false
        }
        this.mcpServer = mcpServer
        this.updateStatusBar()
        return true
    }

    /**
     * Push the current API key into a running server.
     *
     * Without this, the key captured when the server started stays in force and
     * a regenerated key silently does nothing until the next restart — including
     * the case where the stale key is the empty string, which disables auth
     * entirely rather than rejecting requests. For the same reason, a key
     * that is now missing on this device stops the server instead of being
     * pushed as an empty (auth-disabling) key.
     */
    async syncServerAuth(): Promise<void> {
        if (!this.httpServer) {
            return
        }
        const key = this.getApiKey()
        if (!key.trim()) {
            await this.stopServer()
            new Notice(MISSING_API_KEY_MESSAGE)
            return
        }
        this.httpServer.updateApiKey(key)
    }

    async stopServer(): Promise<void> {
        if (this.mcpServer) {
            await this.mcpServer.close()
            this.mcpServer = null
        }

        await this.serverController.stop()

        this.updateStatusBar()
    }

    isServerRunning(): boolean {
        return this.httpServer?.isRunning ?? false
    }

    async restartServer(): Promise<boolean> {
        await this.stopServer()
        return this.startServer()
    }

    /**
     * Re-probe the Obsidian CLI binary, refresh discovered commands on
     * success, and propagate the new status to any running server.
     *
     * Concurrent calls are deduplicated: if a recheck is already in flight,
     * additional callers receive the same promise. This matters because
     * self-healing on the request path (router/MCP) can fire multiple
     * rechecks in parallel under load.
     *
     * Returns the latest `CliAvailabilityResult` so request handlers can
     * branch on the freshly-probed status without an extra `this.cliStatus`
     * read race.
     */
    async recheckCli(): Promise<CliAvailabilityResult> {
        if (this.recheckInFlight) {
            return this.recheckInFlight
        }
        this.recheckInFlight = (async () => {
            try {
                this.cliStatus = await checkCliAvailability()
                if (this.cliStatus.available) {
                    await this.discoverCommands()
                }
                if (this.httpServer) {
                    this.httpServer.updateContext(this.buildContext())
                }
                if (this.mcpServer) {
                    this.mcpServer.updateContext(this.buildContext())
                }
                return this.cliStatus
            } finally {
                this.recheckInFlight = null
            }
        })()
        return this.recheckInFlight
    }

    /**
     * Build a fresh context snapshot for the HTTP router and MCP server.
     * Includes a bound `recheckCli` so handlers can self-heal a stale
     * `cliStatus.available === false` without holding a plugin reference.
     */
    private buildContext(): {
        settings: PluginSettings
        cliStatus: CliAvailabilityResult
        recheckCli: () => Promise<CliAvailabilityResult>
    } {
        return {
            settings: this.settings,
            cliStatus: this.cliStatus,
            recheckCli: () => this.recheckCli()
        }
    }

    /**
     * Discover available CLI commands by running `obsidian help` and
     * merge them into the command registry. Static entries always
     * take precedence over discovered ones.
     */
    private async discoverCommands(): Promise<void> {
        try {
            const discovered = await discoverCliCommands(this.cliStatus.binaryPath)
            const definitions: CliCommandDefinition[] = discovered.map((cmd) => ({
                command: cmd.command,
                httpMethod: 'POST',
                category: cmd.section === 'developer' ? 'developer' : 'discovered',
                dangerous: cmd.section === 'developer' || isDangerousPattern(cmd.command),
                description: cmd.description
            }))
            mergeDiscoveredCommands(definitions)
            const newCount = definitions.filter(
                (d) => !CLI_COMMAND_REGISTRY_NAMES.has(d.command)
            ).length
            if (newCount > 0) {
                log(`Discovered ${newCount} new CLI commands not in static registry`, 'info')
            }
            log(
                `CLI command discovery complete: ${discovered.length} total commands found`,
                'debug'
            )
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error'
            log(`CLI command discovery failed: ${msg}`, 'warn')
        }
    }

    private updateStatusBar(): void {
        if (!this.statusBarEl) {
            return
        }

        if (this.isServerRunning()) {
            this.statusBarEl.setText(`CLI REST: ${this.settings.bindAddress}:${this.settings.port}`)
        } else {
            this.statusBarEl.setText('CLI REST: off')
        }
    }

    async loadSettings(): Promise<void> {
        log('Loading settings', 'debug')
        const loadedData = (await this.loadData()) as unknown
        let mustSave = false

        if (!loadedData) {
            log('Using default settings', 'debug')
            this.settings = produce(createDefaultSettings(), () => {})
            await this.initApiKeySecret(false)
            return
        }

        const parsed = pluginSettingsSchema.safeParse(loadedData)
        if (parsed.success) {
            this.settings = parsed.data
        } else {
            log('Invalid settings, merging with defaults', 'warn')
            // Merge loaded data with defaults for forward compatibility
            const raw = loadedData as Record<string, unknown>
            const defaults = createDefaultSettings()
            this.settings = produce(defaults, (draft: Draft<PluginSettings>) => {
                // The schema's keys, not the defaults': optional fields (the
                // legacy apiKey) have no default and must survive the merge.
                for (const key of Object.keys(
                    pluginSettingsSchema.shape
                ) as (keyof PluginSettings)[]) {
                    if (key in raw) {
                        const fieldParsed = pluginSettingsSchema.shape[key].safeParse(raw[key])
                        if (fieldParsed.success) {
                            ;(draft as Record<keyof PluginSettings, unknown>)[key] =
                                fieldParsed.data
                        }
                    }
                }
            })
            mustSave = true
        }

        await this.initApiKeySecret(mustSave)
        log('Settings loaded', 'debug', this.settings)
    }

    /**
     * Per-device API key step on load: copy the legacy plaintext key into
     * this device's SecretStorage, generate one on a fresh install, purge the
     * legacy copy after the grace period, or warn when this device has no key.
     * Idempotent.
     */
    private async initApiKeySecret(settingsChanged: boolean): Promise<void> {
        let mustSave = settingsChanged
        try {
            const result = resolveApiKeySecret(
                this.secretStore,
                this.settings,
                this.now(),
                generateApiKey
            )
            if (result.mustSave) {
                const next = result.settings
                this.settings = produce(this.settings, (draft: Draft<PluginSettings>) => {
                    draft.apiKeySecretName = next.apiKeySecretName
                    draft.legacySecretMigratedAt = next.legacySecretMigratedAt
                    if (next.apiKey === undefined) {
                        delete draft.apiKey
                    }
                })
            }
            if (result.outcome === 'migrated') {
                log(
                    `API key copied to secret storage as "${result.settings.apiKeySecretName}"`,
                    'info'
                )
            }
            if (result.outcome === 'missing') {
                new Notice(MISSING_API_KEY_MESSAGE, 0)
            }
            mustSave = mustSave || result.mustSave
        } catch (err) {
            // Nothing is dropped: getApiKey() still falls back to the legacy
            // copy, and the next load retries.
            const msg = err instanceof Error ? err.message : 'Unknown error'
            log(`Could not store the API key in secret storage: ${msg}`, 'error')
            new Notice(`REST and MCP server: could not access secret storage: ${msg}`)
        }
        if (mustSave) {
            await this.saveSettings()
        }
    }

    async saveSettings(): Promise<void> {
        log('Saving settings', 'debug', this.settings)
        await this.saveData(this.settings)
        log('Settings saved', 'debug', this.settings)
    }

    /** Serializes settings writes; see updateSettings. */
    private settingsWriteChain: Promise<void> = Promise.resolve()

    /**
     * Apply a mutation to the settings (via immer) and persist the result.
     *
     * Persist-then-commit: memory is swapped only after saveData() succeeds,
     * so the declarative tab's rejection-based rollback reads the on-disk
     * truth rather than an optimistic mutation that never landed.
     *
     * Serialized: writes queue behind one another and each mutation derives
     * from the PREVIOUS COMMITTED state. Without this, two overlapping calls
     * would both produce() from the same base across the save await, and the
     * second commit would silently drop the first edit (external review,
     * 2026-08-21 — on this plugin that race could start the server on a
     * stale bind address).
     */
    updateSettings(mutator: (draft: Draft<PluginSettings>) => void): Promise<void> {
        const run = async (): Promise<void> => {
            // An unloaded instance writes nothing: its successor has already
            // loaded data.json, and a queued write (the generated API key,
            // say) landing now would overwrite what that instance holds.
            if (this.serverController.isDisposed) {
                return
            }
            const next = produce(this.settings, mutator)
            await this.saveData(next)
            this.settings = next
        }
        // Run after the previous write regardless of its outcome, but hand
        // each caller only its own failure.
        const p = this.settingsWriteChain.then(run, run)
        this.settingsWriteChain = p.catch(() => {})
        return p
    }
}
