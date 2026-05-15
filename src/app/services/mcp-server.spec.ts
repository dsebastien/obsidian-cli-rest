import { describe, expect, test } from 'bun:test'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { EventEmitter } from 'node:events'
import { McpServerWrapper, type McpServerContext } from './mcp-server'
import type { PluginSettings } from '../types/plugin-settings.intf'

function createSettings(): PluginSettings {
    return {
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
    }
}

function createContext(): McpServerContext {
    return {
        settings: createSettings(),
        cliStatus: {
            available: false,
            binaryPath: '',
            version: '',
            error: 'not available'
        }
    }
}

/**
 * Calls `wrapper.handleRequest` directly with mock req/res streams. This
 * mirrors what `HttpServerWrapper` does without binding a real TCP port,
 * keeping the test deterministic and side-channel-free.
 */
async function invokeHandler(
    wrapper: McpServerWrapper,
    body: object
): Promise<{ status: number; body: string }> {
    const payload = JSON.stringify(body)
    const reqEmitter = new EventEmitter() as EventEmitter & {
        method: string
        url: string
        headers: Record<string, string>
    }
    reqEmitter.method = 'POST'
    reqEmitter.url = '/mcp'
    reqEmitter.headers = {
        'host': '127.0.0.1:27124',
        'accept': 'application/json, text/event-stream',
        'content-type': 'application/json'
    }

    let status = 0
    let bodyOut = ''
    const res = {
        writeHead(statusCode: number, _headers?: Record<string, string>): void {
            status = statusCode
        },
        write(chunk: string | Buffer): void {
            bodyOut += typeof chunk === 'string' ? chunk : chunk.toString()
        },
        end(): void {
            // no-op
        }
    }

    const req = reqEmitter as unknown as IncomingMessage
    const responseLike = res as unknown as ServerResponse

    // Emit body once `collectRequestBody` has attached its `data` listener.
    // The handler awaits an async `connect()` before subscribing, so we hook
    // listener attachment on the request emitter instead of guessing timing.
    reqEmitter.once('newListener', (event) => {
        if (event !== 'data') return
        setImmediate(() => {
            reqEmitter.emit('data', Buffer.from(payload))
            reqEmitter.emit('end')
        })
    })

    await wrapper.handleRequest(req, responseLike)
    return { status, body: bodyOut }
}

describe('McpServerWrapper', () => {
    test('handles two sequential requests without "Already connected" error (issue #1)', async () => {
        const wrapper = new McpServerWrapper(createContext())

        const first = await invokeHandler(wrapper, {
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
                protocolVersion: '2025-06-18',
                capabilities: {},
                clientInfo: { name: 't', version: '0' }
            }
        })
        expect(first.status).toBe(200)
        expect(first.body).toContain('"result"')
        expect(first.body).not.toContain('Already connected')

        const second = await invokeHandler(wrapper, {
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/list'
        })
        expect(second.status).toBe(200)
        expect(second.body).toContain('"result"')
        expect(second.body).not.toContain('Already connected')

        await wrapper.close()
    })

    test('handles concurrent requests without "Already connected" error (issue #1)', async () => {
        const wrapper = new McpServerWrapper(createContext())

        const requests = Array.from({ length: 10 }, (_, i) =>
            invokeHandler(wrapper, { jsonrpc: '2.0', id: i + 1, method: 'tools/list' })
        )
        const responses = await Promise.all(requests)
        for (const response of responses) {
            expect(response.status).toBe(200)
            expect(response.body).toContain('"result"')
            expect(response.body).not.toContain('Already connected')
        }

        await wrapper.close()
    })

    test('exposes the search and execute tools', async () => {
        const wrapper = new McpServerWrapper(createContext())

        const response = await invokeHandler(wrapper, {
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/list'
        })
        expect(response.status).toBe(200)
        const parsed = JSON.parse(response.body) as {
            result: { tools: { name: string }[] }
        }
        const names = parsed.result.tools.map((t) => t.name).sort()
        expect(names).toEqual(['execute', 'search'])

        await wrapper.close()
    })
})
