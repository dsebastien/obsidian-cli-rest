import { App, Notice, PluginSettingTab, Setting } from 'obsidian'
import type { ObsidianCliRestPlugin } from '../plugin'
import { produce } from 'immer'
import type { Draft } from 'immer'
import type { PluginSettings } from '../types/plugin-settings.intf'
import { generateApiKey } from '../../utils/crypto'

export class ObsidianCliRestSettingTab extends PluginSettingTab {
    plugin: ObsidianCliRestPlugin

    constructor(app: App, plugin: ObsidianCliRestPlugin) {
        super(app, plugin)
        this.plugin = plugin
    }

    display(): void {
        const { containerEl } = this
        containerEl.empty()

        this.renderStatusSection(containerEl)
        this.renderServerSection(containerEl)
        this.renderInterfacesSection(containerEl)
        this.renderSecuritySection(containerEl)
        this.renderCommandFilteringSection(containerEl)
        this.renderAdvancedSection(containerEl)
        this.renderFollowButton(containerEl)
        this.renderSupportHeader(containerEl)
    }

    private renderStatusSection(containerEl: HTMLElement): void {
        new Setting(containerEl).setName('Status').setHeading()

        const serverStatus = this.plugin.isServerRunning() ? 'Running' : 'Stopped'
        const cliStatus = this.plugin.cliStatus.available
            ? `Available (${this.plugin.cliStatus.version})`
            : `Not found`

        new Setting(containerEl)
            .setName('Server status')
            .setDesc(serverStatus)
            .addButton((button) => {
                button
                    .setButtonText(this.plugin.isServerRunning() ? 'Stop server' : 'Start server')
                    .onClick(async () => {
                        if (this.plugin.isServerRunning()) {
                            await this.plugin.stopServer()
                        } else {
                            try {
                                await this.plugin.startServer()
                            } catch (err) {
                                const msg = err instanceof Error ? err.message : 'Unknown error'
                                new Notice(`Failed to start server: ${msg}`)
                            }
                        }
                        this.display()
                    })
            })

        new Setting(containerEl)
            .setName('CLI status')
            .setDesc(cliStatus)
            .addButton((button) => {
                button.setButtonText('Recheck').onClick(async () => {
                    await this.plugin.recheckCli()
                    this.display()
                })
            })

        if (this.plugin.isServerRunning()) {
            new Setting(containerEl)
                .setName('Listening on')
                .setDesc(`${this.plugin.settings.bindAddress}:${this.plugin.settings.port}`)
        }
    }

    private renderServerSection(containerEl: HTMLElement): void {
        new Setting(containerEl).setName('Server').setHeading()

        new Setting(containerEl)
            .setName('Port')
            .setDesc('HTTP server port (1024-65535)')
            .addText((text) => {
                text.setValue(String(this.plugin.settings.port)).onChange(async (value) => {
                    const port = parseInt(value, 10)
                    if (!isNaN(port) && port >= 1024 && port <= 65535) {
                        await this.updateSetting((draft) => {
                            draft.port = port
                        })
                    }
                })
            })

        new Setting(containerEl)
            .setName('Bind address')
            .setDesc('127.0.0.1 for localhost only, 0.0.0.0 for all interfaces')
            .addDropdown((dropdown) => {
                dropdown
                    .addOption('127.0.0.1', '127.0.0.1 (localhost)')
                    .addOption('0.0.0.0', '0.0.0.0 (all interfaces)')
                    .setValue(this.plugin.settings.bindAddress)
                    .onChange(async (value) => {
                        await this.updateSetting((draft) => {
                            draft.bindAddress = value
                        })
                        this.display()
                    })
            })

        if (this.plugin.settings.bindAddress === '0.0.0.0') {
            const warningEl = containerEl.createDiv({
                cls: 'cli-rest-warning'
            })
            warningEl.createEl('strong', {
                text: 'Security warning: '
            })
            warningEl.createSpan({
                text: 'Binding to 0.0.0.0 exposes the server to your network. An API key is required and enforced.'
            })
        }

        new Setting(containerEl)
            .setName('Auto-start')
            .setDesc('Automatically start the server when the plugin loads')
            .addToggle((toggle) => {
                toggle.setValue(this.plugin.settings.autoStart).onChange(async (value) => {
                    await this.updateSetting((draft) => {
                        draft.autoStart = value
                    })
                })
            })

        new Setting(containerEl)
            .setName('Enable CORS')
            .setDesc('Allow cross-origin requests to the API')
            .addToggle((toggle) => {
                toggle.setValue(this.plugin.settings.enableCors).onChange(async (value) => {
                    await this.updateSetting((draft) => {
                        draft.enableCors = value
                    })
                })
            })
    }

    private renderInterfacesSection(containerEl: HTMLElement): void {
        new Setting(containerEl).setName('Interfaces').setHeading()

        new Setting(containerEl)
            .setName('Enable REST API')
            .setDesc('Expose CLI commands as RESTful HTTP endpoints at /api/v1/cli/*')
            .addToggle((toggle) => {
                toggle.setValue(this.plugin.settings.enableRestApi).onChange(async (value) => {
                    await this.updateSetting((draft) => {
                        draft.enableRestApi = value
                    })
                })
            })

        new Setting(containerEl)
            .setName('Enable MCP server')
            .setDesc('Expose CLI commands as MCP tools at /mcp for AI integration')
            .addToggle((toggle) => {
                toggle.setValue(this.plugin.settings.enableMcp).onChange(async (value) => {
                    await this.updateSetting((draft) => {
                        draft.enableMcp = value
                    })
                })
            })
    }

    private renderSecuritySection(containerEl: HTMLElement): void {
        new Setting(containerEl).setName('Security').setHeading()

        new Setting(containerEl)
            .setName('API key')
            .setDesc('Bearer token for authenticating requests. Required when binding to 0.0.0.0.')
            .addText((text) => {
                text.setValue(this.plugin.settings.apiKey).setDisabled(true).inputEl.setCssStyles({
                    width: '300px',
                    fontFamily: 'monospace',
                    fontSize: '11px'
                })
            })
            .addButton((button) => {
                button.setButtonText('Copy').onClick(() => {
                    void navigator.clipboard.writeText(this.plugin.settings.apiKey)
                    new Notice('API key copied to clipboard')
                })
            })
            .addButton((button) => {
                button.setButtonText('Regenerate').onClick(async () => {
                    await this.updateSetting((draft) => {
                        draft.apiKey = generateApiKey()
                    })
                    new Notice('API key regenerated. Restart server to apply.')
                    this.display()
                })
            })

        new Setting(containerEl)
            .setName('Allow dangerous commands')
            .setDesc(
                'Enable commands like eval, restart, devtools, and dev:* that can modify the app state'
            )
            .addToggle((toggle) => {
                toggle
                    .setValue(this.plugin.settings.allowDangerousCommands)
                    .onChange(async (value) => {
                        await this.updateSetting((draft) => {
                            draft.allowDangerousCommands = value
                        })
                    })
            })
    }

    private renderCommandFilteringSection(containerEl: HTMLElement): void {
        new Setting(containerEl).setName('Command filtering').setHeading()

        new Setting(containerEl)
            .setName('Blocked commands')
            .setDesc('Comma-separated list of CLI commands to block (e.g., delete,eval,restart)')
            .addTextArea((text) => {
                text.setValue(this.plugin.settings.blockedCommands.join(', '))
                    .setPlaceholder('e.g., delete, eval, restart')
                    .onChange(async (value) => {
                        const commands = value
                            .split(',')
                            .map((s) => s.trim())
                            .filter((s) => s.length > 0)
                        await this.updateSetting((draft) => {
                            draft.blockedCommands = commands
                        })
                    })
                text.inputEl.setCssStyles({ width: '100%', minHeight: '60px' })
            })
    }

    private renderAdvancedSection(containerEl: HTMLElement): void {
        new Setting(containerEl).setName('Advanced').setHeading()

        new Setting(containerEl)
            .setName('Request timeout')
            .setDesc('Maximum time (ms) for a CLI command to execute (1000-300000)')
            .addText((text) => {
                text.setValue(String(this.plugin.settings.requestTimeout)).onChange(
                    async (value) => {
                        const timeout = parseInt(value, 10)
                        if (!isNaN(timeout) && timeout >= 1000 && timeout <= 300000) {
                            await this.updateSetting((draft) => {
                                draft.requestTimeout = timeout
                            })
                        }
                    }
                )
            })

        new Setting(containerEl)
            .setName('Default vault')
            .setDesc(
                'Default vault name to use if not specified in requests (leave empty for current)'
            )
            .addText((text) => {
                text.setPlaceholder('Current vault')
                    .setValue(this.plugin.settings.defaultVault)
                    .onChange(async (value) => {
                        await this.updateSetting((draft) => {
                            draft.defaultVault = value
                        })
                    })
            })
    }

    private renderFollowButton(containerEl: HTMLElement): void {
        new Setting(containerEl)
            .setName('Follow me on X')
            .setDesc('Sébastien Dubois (@dSebastien)')
            .addButton((button) => {
                button.setCta()
                button.setButtonText('Follow me on X').onClick(() => {
                    window.open('https://x.com/dSebastien')
                })
            })
    }

    private renderSupportHeader(containerEl: HTMLElement): void {
        new Setting(containerEl).setName('Support').setHeading()

        const supportDesc = new DocumentFragment()
        supportDesc.createDiv({
            text: 'Buy me a coffee to support the development of this plugin'
        })

        new Setting(containerEl).setDesc(supportDesc)

        this.renderBuyMeACoffeeBadge(containerEl)
        const spacing = containerEl.createDiv()
        spacing.classList.add('support-header-margin')
    }

    private renderBuyMeACoffeeBadge(contentEl: HTMLElement | DocumentFragment, width = 175): void {
        const linkEl = contentEl.createEl('a', {
            href: 'https://www.buymeacoffee.com/dsebastien'
        })
        const imgEl = linkEl.createEl('img')
        imgEl.src =
            'https://github.com/dsebastien/obsidian-plugin-template/blob/main/src/assets/buy-me-a-coffee.png?raw=true'
        imgEl.alt = 'Buy me a coffee'
        imgEl.width = width
    }

    private async updateSetting(updater: (draft: Draft<PluginSettings>) => void): Promise<void> {
        this.plugin.settings = produce(this.plugin.settings, updater)
        await this.plugin.saveSettings()
    }
}
