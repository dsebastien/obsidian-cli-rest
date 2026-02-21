import { afterEach, describe, expect, test } from 'bun:test'
import {
    CLI_COMMAND_REGISTRY,
    getCommandDefinition,
    getAllCommands,
    commandToUrlPath,
    urlPathToCommand,
    commandToMcpToolName,
    mcpToolNameToCommand,
    getCategories,
    mergeDiscoveredCommands,
    resetDiscoveredCommands,
    isDangerousPattern
} from './cli-command-registry'

afterEach(() => {
    resetDiscoveredCommands()
})

describe('CLI_COMMAND_REGISTRY', () => {
    test('contains at least 100 commands', () => {
        expect(CLI_COMMAND_REGISTRY.length).toBeGreaterThanOrEqual(100)
    })

    test('has no duplicate command names', () => {
        const names = CLI_COMMAND_REGISTRY.map((c) => c.command)
        const unique = new Set(names)
        expect(unique.size).toBe(names.length)
    })

    test('every command has required fields', () => {
        for (const def of CLI_COMMAND_REGISTRY) {
            expect(def.command).toBeTruthy()
            expect(['GET', 'POST', 'DELETE']).toContain(def.httpMethod)
            expect(def.category).toBeTruthy()
            expect(typeof def.dangerous).toBe('boolean')
            expect(def.description).toBeTruthy()
        }
    })

    test('contains all major categories', () => {
        const categories = getCategories()
        const expected = [
            'general',
            'vault',
            'files',
            'search',
            'links',
            'tags',
            'tasks',
            'properties',
            'daily',
            'plugins',
            'themes',
            'snippets',
            'history',
            'sync',
            'publish',
            'developer',
            'workspace',
            'templates',
            'bookmarks',
            'bases',
            'commands',
            'hotkeys',
            'internal'
        ]
        for (const cat of expected) {
            expect(categories).toContain(cat)
        }
    })

    test('dangerous commands include eval, restart, devtools, dev:*', () => {
        const dangerousCommands = CLI_COMMAND_REGISTRY.filter((c) => c.dangerous).map(
            (c) => c.command
        )
        expect(dangerousCommands).toContain('eval')
        expect(dangerousCommands).toContain('restart')
        expect(dangerousCommands).toContain('devtools')
        expect(dangerousCommands).toContain('dev:console')
        expect(dangerousCommands).toContain('dev:dom')
    })

    test('dangerous commands match business rules exactly', () => {
        const dangerousCommands = CLI_COMMAND_REGISTRY.filter((c) => c.dangerous).map(
            (c) => c.command
        )
        // Business rules: eval, restart, devtools, dev:*, command, reload, plugins:restrict
        const expectedDangerous = [
            'eval',
            'restart',
            'devtools',
            'command',
            'reload',
            'plugins:restrict',
            'dev:console',
            'dev:errors',
            'dev:screenshot',
            'dev:dom',
            'dev:css',
            'dev:mobile',
            'dev:debug',
            'dev:cdp'
        ]
        expect(dangerousCommands.sort()).toEqual(expectedDangerous.sort())
    })

    test('non-dangerous commands are not marked dangerous', () => {
        const safeCommands = ['version', 'help', 'read', 'files', 'search', 'tags', 'vaults']
        for (const cmd of safeCommands) {
            const def = getCommandDefinition(cmd)
            expect(def).toBeDefined()
            expect(def!.dangerous).toBe(false)
        }
    })

    test('read-only commands use GET', () => {
        const readCommands = ['read', 'files', 'folders', 'search', 'tags', 'version', 'help']
        for (const cmd of readCommands) {
            const def = getCommandDefinition(cmd)
            expect(def).toBeDefined()
            expect(def!.httpMethod).toBe('GET')
        }
    })

    test('mutating commands use POST', () => {
        const mutatingCommands = ['create', 'append', 'prepend', 'move', 'rename', 'open']
        for (const cmd of mutatingCommands) {
            const def = getCommandDefinition(cmd)
            expect(def).toBeDefined()
            expect(def!.httpMethod).toBe('POST')
        }
    })

    test('deletion commands use DELETE', () => {
        const deleteCommands = ['delete', 'property:remove', 'plugin:uninstall', 'theme:uninstall']
        for (const cmd of deleteCommands) {
            const def = getCommandDefinition(cmd)
            expect(def).toBeDefined()
            expect(def!.httpMethod).toBe('DELETE')
        }
    })
})

describe('getCommandDefinition', () => {
    test('returns definition for known command', () => {
        const def = getCommandDefinition('version')
        expect(def).toBeDefined()
        expect(def!.command).toBe('version')
        expect(def!.httpMethod).toBe('GET')
    })

    test('returns undefined for unknown command', () => {
        expect(getCommandDefinition('nonexistent')).toBeUndefined()
    })
})

describe('getAllCommands', () => {
    test('returns all commands', () => {
        const commands = getAllCommands()
        expect(commands.length).toBe(CLI_COMMAND_REGISTRY.length)
    })
})

describe('commandToUrlPath', () => {
    test('converts colons to slashes', () => {
        expect(commandToUrlPath('property:set')).toBe('property/set')
        expect(commandToUrlPath('dev:console')).toBe('dev/console')
    })

    test('leaves simple commands unchanged', () => {
        expect(commandToUrlPath('version')).toBe('version')
        expect(commandToUrlPath('files')).toBe('files')
    })
})

describe('urlPathToCommand', () => {
    test('converts slashes to colons', () => {
        expect(urlPathToCommand('property/set')).toBe('property:set')
        expect(urlPathToCommand('dev/console')).toBe('dev:console')
    })

    test('leaves simple paths unchanged', () => {
        expect(urlPathToCommand('version')).toBe('version')
    })
})

describe('commandToMcpToolName', () => {
    test('converts colons to underscores', () => {
        expect(commandToMcpToolName('property:set')).toBe('property_set')
        expect(commandToMcpToolName('dev:console')).toBe('dev_console')
    })

    test('leaves simple commands unchanged', () => {
        expect(commandToMcpToolName('version')).toBe('version')
    })
})

describe('mcpToolNameToCommand', () => {
    test('converts underscores to colons', () => {
        expect(mcpToolNameToCommand('property_set')).toBe('property:set')
        expect(mcpToolNameToCommand('dev_console')).toBe('dev:console')
    })

    test('leaves simple names unchanged', () => {
        expect(mcpToolNameToCommand('version')).toBe('version')
    })
})

describe('getCategories', () => {
    test('returns unique categories', () => {
        const categories = getCategories()
        const unique = new Set(categories)
        expect(unique.size).toBe(categories.length)
    })
})

describe('mergeDiscoveredCommands', () => {
    test('adds new commands to registry', () => {
        mergeDiscoveredCommands([
            {
                command: 'new:command',
                httpMethod: 'POST',
                category: 'discovered',
                dangerous: false,
                description: 'A newly discovered command'
            }
        ])

        const def = getCommandDefinition('new:command')
        expect(def).toBeDefined()
        expect(def!.command).toBe('new:command')
        expect(def!.category).toBe('discovered')
    })

    test('static entries take precedence over discovered', () => {
        mergeDiscoveredCommands([
            {
                command: 'version',
                httpMethod: 'POST',
                category: 'discovered',
                dangerous: true,
                description: 'Overridden version'
            }
        ])

        const def = getCommandDefinition('version')
        expect(def).toBeDefined()
        // Static metadata should win
        expect(def!.httpMethod).toBe('GET')
        expect(def!.dangerous).toBe(false)
        expect(def!.category).toBe('general')
    })

    test('getAllCommands includes discovered commands', () => {
        const originalCount = getAllCommands().length

        mergeDiscoveredCommands([
            {
                command: 'new:command',
                httpMethod: 'POST',
                category: 'discovered',
                dangerous: false,
                description: 'A newly discovered command'
            }
        ])

        expect(getAllCommands().length).toBe(originalCount + 1)
    })

    test('getCategories includes discovered category', () => {
        mergeDiscoveredCommands([
            {
                command: 'new:command',
                httpMethod: 'POST',
                category: 'discovered',
                dangerous: false,
                description: 'A newly discovered command'
            }
        ])

        expect(getCategories()).toContain('discovered')
    })
})

describe('resetDiscoveredCommands', () => {
    test('clears discovered commands', () => {
        mergeDiscoveredCommands([
            {
                command: 'temp:command',
                httpMethod: 'POST',
                category: 'discovered',
                dangerous: false,
                description: 'Temporary'
            }
        ])

        expect(getCommandDefinition('temp:command')).toBeDefined()

        resetDiscoveredCommands()

        expect(getCommandDefinition('temp:command')).toBeUndefined()
        expect(getAllCommands().length).toBe(CLI_COMMAND_REGISTRY.length)
    })
})

describe('isDangerousPattern', () => {
    test('matches dev: prefix', () => {
        expect(isDangerousPattern('dev:anything')).toBe(true)
        expect(isDangerousPattern('dev:new-tool')).toBe(true)
    })

    test('matches exact dangerous commands', () => {
        expect(isDangerousPattern('eval')).toBe(true)
        expect(isDangerousPattern('restart')).toBe(true)
        expect(isDangerousPattern('reload')).toBe(true)
        expect(isDangerousPattern('devtools')).toBe(true)
        expect(isDangerousPattern('command')).toBe(true)
        expect(isDangerousPattern('plugins:restrict')).toBe(true)
    })

    test('does not match safe commands', () => {
        expect(isDangerousPattern('version')).toBe(false)
        expect(isDangerousPattern('files')).toBe(false)
        expect(isDangerousPattern('search')).toBe(false)
        expect(isDangerousPattern('plugin:enable')).toBe(false)
        expect(isDangerousPattern('developer')).toBe(false)
    })
})
