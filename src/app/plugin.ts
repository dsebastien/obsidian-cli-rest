import { Notice, Plugin } from 'obsidian'
import { DEFAULT_SETTINGS, pluginSettingsSchema } from './types/plugin-settings.intf'
import type { PluginSettings } from './types/plugin-settings.intf'
import { ObsidianCliRestSettingTab } from './settings/settings-tab'
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

export class ObsidianCliRestPlugin extends Plugin {
    settings: PluginSettings = produce(DEFAULT_SETTINGS, () => DEFAULT_SETTINGS)
    cliStatus: CliAvailabilityResult = {
        available: false,
        binaryPath: '',
        version: '',
        error: 'Not checked yet'
    }

    private httpServer: HttpServerWrapper | null = null
    private mcpServer: McpServerWrapper | null = null
    private statusBarEl: HTMLElement | null = null

    override async onload(): Promise<void> {
        log('Initializing', 'debug')
        await this.loadSettings()

        // Check CLI availability
        this.cliStatus = await checkCliAvailability()
        if (!this.cliStatus.available) {
            new Notice(
                'Obsidian CLI REST: CLI binary not found. Install the Obsidian CLI to use this plugin.'
            )
        }

        // Discover CLI commands dynamically
        if (this.cliStatus.available) {
            await this.discoverCommands()
        }

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
        this.addSettingTab(new ObsidianCliRestSettingTab(this.app, this))

        // Status bar
        this.statusBarEl = this.addStatusBarItem()
        this.updateStatusBar()

        // Auto-start server (with retry for port release during reload)
        if (this.settings.autoStart) {
            await this.startServerWithRetry()
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
                    new Notice(`Obsidian CLI REST: Failed to start server: ${msg}`)
                    return
                }
            }
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
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

        const context = {
            settings: this.settings,
            cliStatus: this.cliStatus
        }

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

    async recheckCli(): Promise<void> {
        this.cliStatus = await checkCliAvailability()
        if (this.cliStatus.available) {
            await this.discoverCommands()
        }
        if (this.httpServer) {
            this.httpServer.updateContext({
                settings: this.settings,
                cliStatus: this.cliStatus
            })
        }
        if (this.mcpServer) {
            this.mcpServer.updateContext({
                settings: this.settings,
                cliStatus: this.cliStatus
            })
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
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            ;(draft as any)[key] = fieldParsed.data
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
}
