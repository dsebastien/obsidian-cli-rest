import { describe, expect, test, beforeAll, afterAll } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync, chmodSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { checkCliAvailability } from './cli-availability-checker'

/**
 * Create a tmp directory with three small shell scripts that stand in for
 * different binaries the checker might encounter:
 *   - fake-cli: prints a bare semver, like the standalone Obsidian CLI
 *   - fake-launcher: prints the desktop launcher's `(installer x.y.z)` string
 *   - fake-empty: exits 0 with empty stdout
 * These let us test the checker deterministically without touching the host.
 */
let workDir: string
let cliPath: string
let launcherPath: string
let emptyPath: string
const missingPath = '/this/path/does/not/exist/obsidian-xyz'

beforeAll(() => {
    workDir = mkdtempSync(join(tmpdir(), 'obsidian-cli-rest-test-'))

    cliPath = join(workDir, 'fake-cli')
    writeFileSync(cliPath, '#!/bin/sh\necho "1.12.2"\n')
    chmodSync(cliPath, 0o755)

    launcherPath = join(workDir, 'fake-launcher')
    writeFileSync(launcherPath, '#!/bin/sh\necho "1.12.7 (installer 1.12.4)"\n')
    chmodSync(launcherPath, 0o755)

    emptyPath = join(workDir, 'fake-empty')
    writeFileSync(emptyPath, '#!/bin/sh\nexit 0\n')
    chmodSync(emptyPath, 0o755)
})

afterAll(() => {
    rmSync(workDir, { recursive: true, force: true })
})

describe('checkCliAvailability', () => {
    test('returns a result object with the expected shape', async () => {
        const result = await checkCliAvailability([missingPath])
        expect(typeof result.available).toBe('boolean')
        expect(typeof result.binaryPath).toBe('string')
        expect(typeof result.version).toBe('string')
        expect(typeof result.error).toBe('string')
    })

    test('reports unavailable when no candidate exists', async () => {
        const result = await checkCliAvailability([missingPath])
        expect(result.available).toBe(false)
        expect(result.binaryPath).toBe('')
        expect(result.version).toBe('')
        expect(result.error).toContain('not found')
    })

    test('accepts a candidate that prints a bare semver', async () => {
        const result = await checkCliAvailability([cliPath])
        expect(result.available).toBe(true)
        expect(result.binaryPath).toBe(cliPath)
        expect(result.version).toBe('1.12.2')
        expect(result.error).toBe('')
    })

    test('accepts the Obsidian desktop launcher (installer string)', async () => {
        // The plugin only runs inside a live Obsidian process, so invoking
        // the desktop launcher forwards to the running instance via IPC
        // rather than spawning a second one. Both binaries are usable.
        const result = await checkCliAvailability([launcherPath])
        expect(result.available).toBe(true)
        expect(result.binaryPath).toBe(launcherPath)
        expect(result.version).toBe('1.12.7 (installer 1.12.4)')
    })

    test('rejects a candidate that returns empty stdout', async () => {
        const result = await checkCliAvailability([emptyPath])
        expect(result.available).toBe(false)
        expect(result.binaryPath).toBe('')
    })

    test('falls through bad candidates to a good one', async () => {
        const result = await checkCliAvailability([missingPath, emptyPath, cliPath])
        expect(result.available).toBe(true)
        expect(result.binaryPath).toBe(cliPath)
        expect(result.version).toBe('1.12.2')
    })

    test('prefers the first responding candidate even when later ones are cleaner', async () => {
        // First-responder-wins: once we find a usable binary, don't keep probing.
        const result = await checkCliAvailability([launcherPath, cliPath])
        expect(result.available).toBe(true)
        expect(result.binaryPath).toBe(launcherPath)
    })
})
