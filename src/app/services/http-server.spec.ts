import { describe, expect, test } from 'bun:test'
import { request } from 'node:http'
import { HttpServerWrapper, isLoopback } from './http-server'
import type { RouterContext } from './request-router'

function createTestContext(): RouterContext {
    return {
        settings: {
            autoStart: true,
            port: 27124,
            bindAddress: '127.0.0.1',
            apiKeySecretName: 'cli-rest-mcp-api-key',
            legacySecretMigratedAt: '',
            requestTimeout: 30000,
            enableRestApi: true,
            enableMcp: true,
            allowDangerousCommands: false,
            blockedCommands: [],
            enableCors: false,
            defaultVault: ''
        },
        cliStatus: {
            available: false,
            binaryPath: '',
            version: '',
            error: 'not available'
        }
    }
}

/**
 * Status code of a request to the local test server.
 * Uses node:http directly — `fetch` is banned repo-wide in favour of
 * Obsidian's requestUrl, which is not available outside the app.
 */
async function statusOf(port: number, path: string, apiKey?: string): Promise<number> {
    return new Promise((resolve, reject) => {
        const req = request(
            {
                host: '127.0.0.1',
                port,
                path,
                method: 'GET',
                headers: apiKey === undefined ? {} : { Authorization: `Bearer ${apiKey}` }
            },
            (res) => {
                res.resume()
                res.on('end', () => {
                    resolve(res.statusCode ?? 0)
                })
            }
        )
        req.on('error', reject)
        req.end()
    })
}

describe('HttpServerWrapper', () => {
    test('isRunning returns false before start', () => {
        const server = new HttpServerWrapper({
            port: 0,
            bindAddress: '127.0.0.1',
            apiKey: 'test',
            enableCors: false,
            context: createTestContext()
        })
        expect(server.isRunning).toBe(false)
    })

    test('starts and stops cleanly on random port', async () => {
        const server = new HttpServerWrapper({
            port: 0, // random port
            bindAddress: '127.0.0.1',
            apiKey: 'test',
            enableCors: false,
            context: createTestContext()
        })

        await server.start()
        expect(server.isRunning).toBe(true)

        await server.stop()
        expect(server.isRunning).toBe(false)
    })

    test('stop is idempotent', async () => {
        const server = new HttpServerWrapper({
            port: 0,
            bindAddress: '127.0.0.1',
            apiKey: 'test',
            enableCors: false,
            context: createTestContext()
        })

        await server.start()
        await server.stop()
        await server.stop() // second stop should not throw
        expect(server.isRunning).toBe(false)
    })

    test('port is released after stop', async () => {
        const server1 = new HttpServerWrapper({
            port: 0,
            bindAddress: '127.0.0.1',
            apiKey: 'test',
            enableCors: false,
            context: createTestContext()
        })

        await server1.start()
        const addr = server1.address
        expect(addr).not.toBeNull()
        const port = addr!.port

        await server1.stop()

        // Should be able to start a new server on the same port immediately
        const server2 = new HttpServerWrapper({
            port,
            bindAddress: '127.0.0.1',
            apiKey: 'test',
            enableCors: false,
            context: createTestContext()
        })

        await server2.start()
        expect(server2.isRunning).toBe(true)
        await server2.stop()
    })

    test('updateApiKey takes effect on the running server without a restart', async () => {
        const server = new HttpServerWrapper({
            port: 0,
            bindAddress: '127.0.0.1',
            apiKey: 'old-key',
            enableCors: false,
            context: createTestContext()
        })

        await server.start()
        const port = server.address!.port
        // Not a public endpoint, so auth runs first: 401 means rejected,
        // anything else means the key was accepted and routing took over.
        const path = '/api/v1/does-not-exist'

        expect(await statusOf(port, path, 'old-key')).not.toBe(401)
        expect(await statusOf(port, path, 'new-key')).toBe(401)

        server.updateApiKey('new-key')

        expect(await statusOf(port, path, 'new-key')).not.toBe(401)
        expect(await statusOf(port, path, 'old-key')).toBe(401)
        expect(server.isRunning).toBe(true)

        await server.stop()
    })

    test('updateApiKey from an empty key starts enforcing auth', async () => {
        const server = new HttpServerWrapper({
            port: 0,
            bindAddress: '127.0.0.1',
            apiKey: '',
            enableCors: false,
            context: createTestContext()
        })

        await server.start()
        const port = server.address!.port
        const path = '/api/v1/does-not-exist'

        // An empty key disables auth entirely, so an unauthenticated call passes.
        expect(await statusOf(port, path)).not.toBe(401)

        server.updateApiKey('now-required')

        expect(await statusOf(port, path)).toBe(401)
        expect(await statusOf(port, path, 'now-required')).not.toBe(401)

        await server.stop()
    })

    test('start rejects when port is already in use', async () => {
        const server1 = new HttpServerWrapper({
            port: 0,
            bindAddress: '127.0.0.1',
            apiKey: 'test',
            enableCors: false,
            context: createTestContext()
        })

        await server1.start()
        const port = server1.address!.port

        const server2 = new HttpServerWrapper({
            port,
            bindAddress: '127.0.0.1',
            apiKey: 'test',
            enableCors: false,
            context: createTestContext()
        })

        let threw = false
        try {
            await server2.start()
        } catch {
            threw = true
        }
        expect(threw).toBe(true)
        await server1.stop()
    })
})

describe('HttpServerWrapper key requirement', () => {
    test.each(['', '   '])('refuses to listen beyond loopback with the key %p', async (apiKey) => {
        const server = new HttpServerWrapper({
            port: 0,
            bindAddress: '0.0.0.0',
            apiKey,
            enableCors: false,
            context: createTestContext()
        })
        const failure = await server.start().then(
            () => null,
            (error: unknown) => error
        )
        expect(String(failure)).toContain('without an API key')
        expect(server.isRunning).toBe(false)
    })

    test('loopback addresses are recognised, others are not', () => {
        for (const address of ['127.0.0.1', '127.1.2.3', 'localhost', '::1']) {
            expect(isLoopback(address)).toBe(true)
        }
        for (const address of [
            '0.0.0.0',
            '192.168.1.10',
            '::',
            '127.0.0.1.evil',
            '',
            '::ffff:127.0.0.1',
            '[::1]',
            ' 127.0.0.1',
            'LOCALHOST'
        ]) {
            expect(isLoopback(address)).toBe(false)
        }
    })
})
