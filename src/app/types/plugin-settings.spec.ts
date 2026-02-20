import { describe, expect, test } from 'bun:test'
import { pluginSettingsSchema, DEFAULT_SETTINGS } from './plugin-settings.intf'

describe('pluginSettingsSchema', () => {
    test('does not have an enabled field', () => {
        const keys = Object.keys(DEFAULT_SETTINGS)
        expect(keys).not.toContain('enabled')
    })

    test('default settings do not include enabled', () => {
        expect('enabled' in DEFAULT_SETTINGS).toBe(false)
    })

    test('rejects unknown enabled field gracefully via strip', () => {
        const result = pluginSettingsSchema.safeParse({ enabled: true })
        expect(result.success).toBe(true)
        if (result.success) {
            expect('enabled' in result.data).toBe(false)
        }
    })

    test('autoStart defaults to true', () => {
        expect(DEFAULT_SETTINGS.autoStart).toBe(true)
    })

    test('port defaults to 27124', () => {
        expect(DEFAULT_SETTINGS.port).toBe(27124)
    })

    test('bindAddress defaults to 127.0.0.1', () => {
        expect(DEFAULT_SETTINGS.bindAddress).toBe('127.0.0.1')
    })

    test('allowDangerousCommands defaults to false', () => {
        expect(DEFAULT_SETTINGS.allowDangerousCommands).toBe(false)
    })

    test('enableRestApi defaults to true', () => {
        expect(DEFAULT_SETTINGS.enableRestApi).toBe(true)
    })

    test('enableMcp defaults to true', () => {
        expect(DEFAULT_SETTINGS.enableMcp).toBe(true)
    })
})
