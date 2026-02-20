import { describe, expect, test } from 'bun:test'
import { checkCliAvailability } from './cli-availability-checker'

describe('checkCliAvailability', () => {
    test('returns a result object with expected shape', async () => {
        const result = await checkCliAvailability()
        expect(typeof result.available).toBe('boolean')
        expect(typeof result.binaryPath).toBe('string')
        expect(typeof result.version).toBe('string')
        expect(typeof result.error).toBe('string')
    })

    test('sets error message when CLI is not found', async () => {
        // On CI/test environments where obsidian CLI is likely not installed,
        // we expect the checker to report unavailable
        const result = await checkCliAvailability()
        if (!result.available) {
            expect(result.error).toContain('not found')
            expect(result.binaryPath).toBe('')
            expect(result.version).toBe('')
        }
    })

    test('sets binaryPath and version when CLI is found', async () => {
        const result = await checkCliAvailability()
        if (result.available) {
            expect(result.binaryPath).toBeTruthy()
            expect(result.version).toBeTruthy()
            expect(result.error).toBe('')
        }
    })
})
