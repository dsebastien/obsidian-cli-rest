import { describe, expect, test } from 'bun:test'
import { executeCli } from './cli-executor'
import type { CliExecutionOptions } from './cli-executor'

// We test the arg-building logic by calling executeCli with a known binary
// and verifying expected behavior. Since we can't easily mock child_process.execFile
// in Bun, we test with a simple echo command.

describe('executeCli', () => {
    const baseOptions: CliExecutionOptions = {
        command: 'version',
        params: {},
        flags: [],
        vault: '',
        binaryPath: 'echo',
        timeout: 5000
    }

    test('builds args with command only', async () => {
        const result = await executeCli(baseOptions)
        expect(result.exitCode).toBe(0)
        expect(result.stdout.trim()).toBe('version')
        expect(result.duration).toBeGreaterThanOrEqual(0)
    })

    test('builds args with vault', async () => {
        const result = await executeCli({ ...baseOptions, vault: 'MyVault' })
        expect(result.exitCode).toBe(0)
        expect(result.stdout.trim()).toBe('vault=MyVault version')
    })

    test('builds args with params', async () => {
        const result = await executeCli({
            ...baseOptions,
            params: { name: 'test', value: 'hello' }
        })
        expect(result.exitCode).toBe(0)
        expect(result.stdout).toContain('name=test')
        expect(result.stdout).toContain('value=hello')
    })

    test('builds args with flags', async () => {
        const result = await executeCli({
            ...baseOptions,
            flags: ['total', 'verbose']
        })
        expect(result.exitCode).toBe(0)
        expect(result.stdout).toContain('total')
        expect(result.stdout).toContain('verbose')
    })

    test('builds args with vault, params, and flags', async () => {
        const result = await executeCli({
            ...baseOptions,
            vault: 'TestVault',
            params: { query: 'hello' },
            flags: ['total']
        })
        expect(result.exitCode).toBe(0)
        const output = result.stdout.trim()
        // vault comes first, then command, then params, then flags
        expect(output).toBe('vault=TestVault version query=hello total')
    })

    test('returns non-zero exit code for failed command', async () => {
        const result = await executeCli({
            ...baseOptions,
            binaryPath: 'false' // 'false' command always returns exit code 1
        })
        expect(result.exitCode).not.toBe(0)
    })

    test('includes duration in result', async () => {
        const result = await executeCli(baseOptions)
        expect(typeof result.duration).toBe('number')
        expect(result.duration).toBeGreaterThanOrEqual(0)
    })
})
