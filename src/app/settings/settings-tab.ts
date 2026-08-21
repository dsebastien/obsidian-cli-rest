import { Notice, PluginSettingTab } from 'obsidian'
import type { App, Setting, SettingDefinitionItem } from 'obsidian'
import type { CliRestMcpPlugin } from '../plugin'
import { generateApiKey } from '../../utils/crypto'
import { BUY_ME_A_COFFEE_BADGE_DATA_URL } from '../assets/buy-me-a-coffee'
import { renderSupportSection } from '../ui/support-links'

/**
 * Settings tab, declared rather than rendered (Obsidian 1.13+).
 *
 * `getSettingDefinitions()` REPLACES `display()` — Obsidian owns navigation,
 * focus and ARIA, and every declared `name`/`desc` is indexed by the settings
 * search. Scalars are `control` definitions keyed by their PluginSettings
 * field name, bridged through `plugin.updateSettings` — the single
 * persist-then-commit write path. `setControlValue` rejects on failure so the
 * pane rolls back to the on-disk truth.
 *
 * Live server/CLI state stays in imperative render rows; the definitions are
 * re-read on every `update()`, so status text computed in the getters is
 * always current.
 *
 * See AGENTS.md "Declarative settings" for the trap list;
 * `settings-guard.spec.ts` enforces the statically-catchable rules.
 */
export class CliRestMcpSettingTab extends PluginSettingTab {
    plugin: CliRestMcpPlugin

    constructor(app: App, plugin: CliRestMcpPlugin) {
        super(app, plugin)
        this.plugin = plugin
    }

    override getSettingDefinitions(): SettingDefinitionItem[] {
        return [
            this.statusGroup(),
            this.serverGroup(),
            this.interfacesGroup(),
            this.securityGroup(),
            this.commandFilteringGroup(),
            this.advancedGroup(),
            this.supportGroup()
        ]
    }

    // ----- Control value plumbing -----

    /** Text controls hand us `unknown`; anything that isn't a string is refused. */
    private static asString(this: void, value: unknown): string {
        if (typeof value !== 'string') {
            throw new Error('Expected a text value.')
        }
        return value
    }

    private static asBoolean(this: void, value: unknown): boolean {
        if (typeof value !== 'boolean') {
            throw new Error('Expected a boolean value.')
        }
        return value
    }

    override getControlValue(key: string): unknown {
        const s = this.plugin.settings
        switch (key) {
            case 'port':
                return s.port
            case 'bindAddress':
                return s.bindAddress
            case 'autoStart':
                return s.autoStart
            case 'enableCors':
                return s.enableCors
            case 'enableRestApi':
                return s.enableRestApi
            case 'enableMcp':
                return s.enableMcp
            case 'allowDangerousCommands':
                return s.allowDangerousCommands
            case 'blockedCommands':
                return s.blockedCommands.join(', ')
            case 'requestTimeout':
                return s.requestTimeout
            case 'defaultVault':
                return s.defaultVault
            default:
                return undefined
        }
    }

    /**
     * Rejecting (not resolving) on failure is load-bearing: a fulfilled
     * promise tells the framework the write landed, and the pane would keep
     * showing a value that was never stored.
     */
    override async setControlValue(key: string, value: unknown): Promise<void> {
        const asString = CliRestMcpSettingTab.asString
        const asBoolean = CliRestMcpSettingTab.asBoolean
        switch (key) {
            case 'port': {
                if (
                    typeof value !== 'number' ||
                    !Number.isInteger(value) ||
                    value < 1024 ||
                    value > 65535
                ) {
                    throw new Error('Port must be an integer between 1024 and 65535.')
                }
                const port = value
                await this.plugin.updateSettings((draft) => {
                    draft.port = port
                })
                return
            }
            case 'bindAddress': {
                if (value !== '127.0.0.1' && value !== '0.0.0.0') {
                    throw new Error(`Unknown bind address "${String(value)}".`)
                }
                const address = value
                await this.plugin.updateSettings((draft) => {
                    draft.bindAddress = address
                })
                // The 0.0.0.0 security warning row depends on this value.
                this.update()
                return
            }
            case 'requestTimeout': {
                if (
                    typeof value !== 'number' ||
                    !Number.isInteger(value) ||
                    value < 1000 ||
                    value > 300000
                ) {
                    throw new Error('Timeout must be between 1000 and 300000 ms.')
                }
                const timeout = value
                await this.plugin.updateSettings((draft) => {
                    draft.requestTimeout = timeout
                })
                return
            }
            case 'blockedCommands': {
                // Same normalization as the imperative tab.
                const commands = asString(value)
                    .split(',')
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0)
                await this.plugin.updateSettings((draft) => {
                    draft.blockedCommands = commands
                })
                return
            }
            case 'defaultVault': {
                // Deliberately NOT trimmed — parity with the imperative tab.
                const vault = asString(value)
                await this.plugin.updateSettings((draft) => {
                    draft.defaultVault = vault
                })
                return
            }
            case 'autoStart':
            case 'enableCors':
            case 'enableRestApi':
            case 'enableMcp':
            case 'allowDangerousCommands': {
                const v = asBoolean(value)
                await this.plugin.updateSettings((draft) => {
                    draft[key] = v
                })
                return
            }
            default:
                new Notice('CLI REST MCP: failed to save settings.')
                throw new Error(`Setting "${key}" does not address a known field.`)
        }
    }

    // ----- Sections -----

    private statusGroup(): SettingDefinitionItem {
        const serverStatus = this.plugin.isServerRunning() ? 'Running' : 'Stopped'
        const cliStatus = this.plugin.cliStatus.available
            ? `Available (${this.plugin.cliStatus.version})`
            : 'Not found'
        return {
            type: 'group',
            heading: 'Status',
            items: [
                {
                    name: 'Server status',
                    desc: serverStatus,
                    searchable: false,
                    render: (setting): void => {
                        setting.addButton((button) => {
                            button
                                .setButtonText(
                                    this.plugin.isServerRunning() ? 'Stop server' : 'Start server'
                                )
                                .onClick(async () => {
                                    if (this.plugin.isServerRunning()) {
                                        await this.plugin.stopServer()
                                    } else {
                                        try {
                                            await this.plugin.startServer()
                                        } catch (err) {
                                            const msg =
                                                err instanceof Error ? err.message : 'Unknown error'
                                            new Notice(`Failed to start server: ${msg}`)
                                        }
                                    }
                                    this.update()
                                })
                        })
                    }
                },
                {
                    name: 'CLI status',
                    desc: cliStatus,
                    searchable: false,
                    render: (setting): void => {
                        setting.addButton((button) => {
                            button.setButtonText('Recheck').onClick(async () => {
                                await this.plugin.recheckCli()
                                this.update()
                            })
                        })
                    }
                },
                {
                    name: 'Listening on',
                    desc: `${this.plugin.settings.bindAddress}:${this.plugin.settings.port}`,
                    searchable: false,
                    visible: (): boolean => this.plugin.isServerRunning()
                }
            ]
        }
    }

    private serverGroup(): SettingDefinitionItem {
        return {
            type: 'group',
            heading: 'Server',
            items: [
                {
                    name: 'Port',
                    desc: 'HTTP server port (1024-65535)',
                    control: {
                        type: 'number',
                        key: 'port',
                        min: 1024,
                        max: 65535,
                        step: 1,
                        // No defaultValue on purpose: a cleared field must be
                        // refused inline, not silently reset by the framework.
                        validate: (value): string | void => {
                            if (!Number.isInteger(value) || value < 1024 || value > 65535) {
                                return 'Enter a port between 1024 and 65535.'
                            }
                        }
                    }
                },
                {
                    name: 'Bind address',
                    desc: '127.0.0.1 for localhost only, 0.0.0.0 for all interfaces',
                    control: {
                        type: 'dropdown',
                        key: 'bindAddress',
                        options: {
                            '127.0.0.1': '127.0.0.1 (localhost)',
                            '0.0.0.0': '0.0.0.0 (all interfaces)'
                        }
                    }
                },
                {
                    name: 'Security warning',
                    searchable: false,
                    visible: (): boolean => this.plugin.settings.bindAddress === '0.0.0.0',
                    render: (setting): void => {
                        setting.settingEl.addClass('cli-rest-settings-embed')
                        setting.infoEl.remove()
                        const warningEl = setting.settingEl.createDiv({
                            cls: 'cli-rest-warning'
                        })
                        warningEl.createEl('strong', { text: 'Security warning: ' })
                        warningEl.createSpan({
                            text: 'Binding to 0.0.0.0 exposes the server to your network. An API key is required and enforced.'
                        })
                    }
                },
                {
                    name: 'Auto-start',
                    desc: 'Automatically start the server when the plugin loads',
                    control: { type: 'toggle', key: 'autoStart' }
                },
                {
                    name: 'Enable CORS',
                    desc: 'Allow cross-origin requests to the API',
                    control: { type: 'toggle', key: 'enableCors' }
                }
            ]
        }
    }

    private interfacesGroup(): SettingDefinitionItem {
        return {
            type: 'group',
            heading: 'Interfaces',
            items: [
                {
                    name: 'Enable REST API',
                    desc: 'Expose CLI commands as RESTful HTTP endpoints at /api/v1/cli/*',
                    control: { type: 'toggle', key: 'enableRestApi' }
                },
                {
                    name: 'Enable MCP server',
                    desc: 'Expose CLI commands as MCP tools at /mcp for AI integration',
                    control: { type: 'toggle', key: 'enableMcp' }
                }
            ]
        }
    }

    private securityGroup(): SettingDefinitionItem {
        return {
            type: 'group',
            heading: 'Security',
            items: [
                {
                    name: 'API key',
                    desc: 'Bearer token for authenticating requests. Required when binding to 0.0.0.0.',
                    render: (setting): void => {
                        this.renderApiKeyControls(setting)
                    }
                },
                {
                    name: 'Allow dangerous commands',
                    desc: 'Enable commands like eval, restart, devtools, and dev:* that can modify the app state',
                    control: { type: 'toggle', key: 'allowDangerousCommands' }
                }
            ]
        }
    }

    private renderApiKeyControls(setting: Setting): void {
        setting
            .addText((text) => {
                text.setValue(this.plugin.settings.apiKey)
                    .setDisabled(true)
                    .inputEl.addClass('cli-rest-api-key-field')
            })
            .addButton((button) => {
                button.setButtonText('Copy').onClick(() => {
                    void navigator.clipboard.writeText(this.plugin.settings.apiKey)
                    new Notice('API key copied to clipboard')
                })
            })
            .addButton((button) => {
                button.setButtonText('Regenerate').onClick(async () => {
                    await this.plugin.updateSettings((draft) => {
                        draft.apiKey = generateApiKey()
                    })
                    new Notice('API key regenerated. Restart server to apply.')
                    this.update()
                })
            })
    }

    private commandFilteringGroup(): SettingDefinitionItem {
        return {
            type: 'group',
            heading: 'Command filtering',
            items: [
                {
                    name: 'Blocked commands',
                    desc: 'Comma-separated list of CLI commands to block (e.g., delete,eval,restart)',
                    control: {
                        type: 'textarea',
                        key: 'blockedCommands',
                        placeholder: 'e.g., delete, eval, restart'
                    }
                }
            ]
        }
    }

    private advancedGroup(): SettingDefinitionItem {
        return {
            type: 'group',
            heading: 'Advanced',
            items: [
                {
                    name: 'Request timeout',
                    desc: 'Maximum time (ms) for a CLI command to execute (1000-300000)',
                    control: {
                        type: 'number',
                        key: 'requestTimeout',
                        min: 1000,
                        max: 300000,
                        step: 1000,
                        validate: (value): string | void => {
                            if (!Number.isInteger(value) || value < 1000 || value > 300000) {
                                return 'Enter a timeout between 1000 and 300000 ms.'
                            }
                        }
                    }
                },
                {
                    name: 'Default vault',
                    desc: 'Default vault name to use if not specified in requests (leave empty for current)',
                    control: {
                        type: 'text',
                        key: 'defaultVault',
                        placeholder: 'Current vault'
                    }
                }
            ]
        }
    }

    private supportGroup(): SettingDefinitionItem {
        return {
            type: 'group',
            items: [
                {
                    name: 'Follow me on X',
                    desc: 'Sébastien Dubois (@dSebastien)',
                    searchable: false,
                    action: (): void => {
                        window.open('https://x.com/dSebastien')
                    }
                },
                {
                    name: 'Support',
                    searchable: false,
                    render: (setting): void => {
                        setting.settingEl.addClass('cli-rest-settings-embed')
                        setting.infoEl.remove()
                        renderSupportSection(setting.settingEl, (el) => {
                            this.renderBuyMeACoffeeBadge(el)
                        })
                    }
                }
            ]
        }
    }

    private renderBuyMeACoffeeBadge(contentEl: HTMLElement | DocumentFragment, width = 175): void {
        const linkEl = contentEl.createEl('a', {
            href: 'https://www.buymeacoffee.com/dsebastien'
        })
        const imgEl = linkEl.createEl('img')
        imgEl.src = BUY_ME_A_COFFEE_BADGE_DATA_URL
        imgEl.alt = 'Buy me a coffee'
        imgEl.width = width
    }
}
