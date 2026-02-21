import { describe, expect, test } from 'bun:test'
import {
    CLI_COMMAND_REGISTRY,
    getCommandDefinition,
    getAllCommands,
    commandToUrlPath,
    urlPathToCommand,
    commandToMcpToolName,
    mcpToolNameToCommand,
    getCategories
} from './cli-command-registry'

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
            'hotkeys'
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
