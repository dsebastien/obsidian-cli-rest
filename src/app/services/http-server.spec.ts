import { describe, expect, test } from 'bun:test'
import { HttpServerWrapper } from './http-server'
import type { RouterContext } from './request-router'

function createTestContext(): RouterContext {
    return {
        settings: {
            autoStart: true,
            port: 27124,
            bindAddress: '127.0.0.1',
            apiKey: 'test-key',
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
