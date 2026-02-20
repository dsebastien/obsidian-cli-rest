import { describe, expect, test } from 'bun:test'
import { generateApiKey } from './crypto'

describe('generateApiKey', () => {
    test('generates a 64-character hex string', () => {
        const key = generateApiKey()
        expect(key).toHaveLength(64)
        expect(key).toMatch(/^[0-9a-f]{64}$/)
    })

    test('generates unique keys on each call', () => {
        const key1 = generateApiKey()
        const key2 = generateApiKey()
        expect(key1).not.toBe(key2)
    })
})
