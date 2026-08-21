import { registerWhatsNewView } from './whats-new'
import { Notice, Plugin } from 'obsidian'
import { DEFAULT_SETTINGS, pluginSettingsSchema } from './types/plugin-settings.intf'
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
import { HttpServerWrapper } from './services/http-server'
import { McpServerWrapper } from './services/mcp-server'
import {
    registerToggleServerCommand,
    registerCopyApiKeyCommand,
    registerCopyRestUrlCommand,
    registerCopyMcpUrlCommand,
    registerCopyDocsUrlCommand
} from './commands/toggle-server'

/**
 * Module-level reference to the active HTTP server.
 * Survives across plugin instance reloads within the same Electron process,
 * allowing a new instance to properly close the previous instance's server
 * even when onunload() can't be awaited.
 */
let sharedHttpServer: HttpServerWrapper | null = null

/** Pre-computed set of static registry command names for quick lookup during discovery. */
const CLI_COMMAND_REGISTRY_NAMES = new Set(CLI_COMMAND_REGISTRY.map((c) => c.command))

export class CliRestMcpPlugin extends Plugin {
    override settings: PluginSettings = produce(DEFAULT_SETTINGS, () => DEFAULT_SETTINGS)
    cliStatus: CliAvailabilityResult = {
        available: false,
        binaryPath: '',
        version: '',
        error: 'Not checked yet'
    }

    private httpServer: HttpServerWrapper | null = null
    private mcpServer: McpServerWrapper | null = null
    private statusBarEl: HTMLElement | null = null
    /**
     * In-flight CLI recheck promise, used to dedupe concurrent self-heal
     * attempts triggered by simultaneous requests arriving while the CLI is
     * still marked unavailable.
     */
    private recheckInFlight: Promise<CliAvailabilityResult> | null = null

    override async onload(): Promise<void> {
        // Must run before anything can call saveData (fresh-install detection)
        registerWhatsNewView(this)
        log('Initializing', 'debug')
        await this.loadSettings()

        // Auto-generate API key on first enable if empty
        if (!this.settings.apiKey) {
            this.settings = produce(this.settings, (draft: Draft<PluginSettings>) => {
                draft.apiKey = generateApiKey()
            })
            await this.saveSettings()
        }

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
            if (!this.cliStatus.available) {
                new Notice(
                    'REST and MCP server: CLI binary not found. Install the Obsidian CLI to use this plugin.'
                )
            } else {
                await this.discoverCommands()
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
        void this.stopServer()
    }

    /**
     * Start the server with retry logic to handle EADDRINUSE during
     * plugin reloads (the old server may not have fully released the port yet).
     */
    private async startServerWithRetry(): Promise<void> {
        const MAX_RETRIES = 3
        const RETRY_DELAY_MS = 500

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
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
                    new Notice(`REST and MCP server: Failed to start server: ${msg}`)
                    return
                }
            }
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => window.setTimeout(resolve, ms))
    }

    async startServer(): Promise<void> {
        await this.stopServer()

        // Close any orphaned server from a previous plugin instance
        if (sharedHttpServer?.isRunning) {
            log('Closing orphaned server from previous instance', 'debug')
            await sharedHttpServer.stop()
        }
        sharedHttpServer = null

        // Enforce API key when binding to all interfaces
        if (this.settings.bindAddress === '0.0.0.0' && !this.settings.apiKey) {
            this.settings = produce(this.settings, (draft: Draft<PluginSettings>) => {
                draft.apiKey = generateApiKey()
            })
            await this.saveSettings()
            new Notice('API key auto-generated (required when binding to 0.0.0.0)')
        }

        const context = this.buildContext()

        // Create MCP server if enabled
        let mcpServer: McpServerWrapper | null = null
        if (this.settings.enableMcp) {
            mcpServer = new McpServerWrapper(context)
        }

        // Create HTTP server (don't assign to this.httpServer until start succeeds)
        const httpServer = new HttpServerWrapper({
            port: this.settings.port,
            bindAddress: this.settings.bindAddress,
            apiKey: this.settings.apiKey,
            enableCors: this.settings.enableCors,
            context,
            mcpHandler: mcpServer ? (req, res) => mcpServer.handleRequest(req, res) : undefined
        })

        await httpServer.start()

        // Only assign after successful start to avoid orphaning
        this.httpServer = httpServer
        sharedHttpServer = httpServer
        this.mcpServer = mcpServer
        this.updateStatusBar()
    }

    async stopServer(): Promise<void> {
        if (this.mcpServer) {
            await this.mcpServer.close()
            this.mcpServer = null
        }

        if (this.httpServer) {
            await this.httpServer.stop()
            this.httpServer = null
        }

        this.updateStatusBar()
    }

    isServerRunning(): boolean {
        return this.httpServer?.isRunning ?? false
    }

    async restartServer(): Promise<void> {
        await this.stopServer()
        await this.startServer()
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

        if (!loadedData) {
            log('Using default settings', 'debug')
            this.settings = produce(DEFAULT_SETTINGS, () => DEFAULT_SETTINGS)
            return
        }

        const parsed = pluginSettingsSchema.safeParse(loadedData)
        if (parsed.success) {
            this.settings = parsed.data
        } else {
            log('Invalid settings, merging with defaults', 'warn')
            // Merge loaded data with defaults for forward compatibility
            const raw = loadedData as Record<string, unknown>
            this.settings = produce(DEFAULT_SETTINGS, (draft: Draft<PluginSettings>) => {
                for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof PluginSettings)[]) {
                    if (key in raw) {
                        const fieldParsed = pluginSettingsSchema.shape[key].safeParse(raw[key])
                        if (fieldParsed.success) {
                            ;(draft as Record<keyof PluginSettings, unknown>)[key] =
                                fieldParsed.data
                        }
                    }
                }
            })
            await this.saveSettings()
        }

        log('Settings loaded', 'debug', this.settings)
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
