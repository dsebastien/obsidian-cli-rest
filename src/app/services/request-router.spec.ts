import { describe, expect, test } from 'bun:test'
import { routeRequest } from './request-router'
import type { RouterContext } from './request-router'
import type { IncomingMessage, ServerResponse } from 'node:http'

function createMockReq(
    method: string,
    url: string,
    headers: Record<string, string> = {},
    body?: string
): IncomingMessage {
    const listeners: Record<string, Array<(...args: unknown[]) => void>> = {}
    const req = {
        method,
        url,
        headers: { host: 'localhost:27124', ...headers },
        on(event: string, cb: (...args: unknown[]) => void) {
            const existing = listeners[event]
            if (existing) {
                existing.push(cb)
            } else {
                listeners[event] = [cb]
            }
            // Auto-emit data and end for POST body
            if (event === 'end') {
                queueMicrotask(() => {
                    const dataListeners = listeners['data']
                    if (body && dataListeners) {
                        for (const dataCb of dataListeners) {
                            dataCb(Buffer.from(body))
                        }
                    }
                    const endListeners = listeners['end']
                    if (endListeners) {
                        for (const endCb of endListeners) {
                            endCb()
                        }
                    }
                })
            }
            return req
        }
    }
    return req as unknown as IncomingMessage
}

function createMockRes(): {
    res: ServerResponse
    getStatusCode: () => number
    getBody: () => string
} {
    let statusCode = 0
    let body = ''

    const res = {
        writeHead(code: number, _hdrs?: Record<string, string>) {
            statusCode = code
            return res
        },
        setHeader(_name: string, _value: string) {
            return res
        },
        end(data?: string) {
            if (data) {
                body = data
            }
            return res
        }
    } as unknown as ServerResponse

    return {
        res,
        getStatusCode: () => statusCode,
        getBody: () => body
    }
}

function createContext(overrides?: Partial<RouterContext>): RouterContext {
    return {
        settings: {
            autoStart: true,
            port: 27124,
            bindAddress: '127.0.0.1',
            apiKey: '',
            requestTimeout: 30000,
            enableRestApi: true,
            enableMcp: true,
            allowDangerousCommands: false,
            blockedCommands: [],
            enableCors: false,
            defaultVault: ''
        },
        cliStatus: {
            available: true,
            binaryPath: 'echo',
            version: '1.0.0',
            error: ''
        },
        ...overrides
    }
}

describe('routeRequest', () => {
    test('handles health endpoint', async () => {
        const req = createMockReq('GET', '/api/v1/health')
        const { res, getStatusCode, getBody } = createMockRes()
        const handled = await routeRequest(req, res, createContext())
        expect(handled).toBe(true)
        expect(getStatusCode()).toBe(200)
        const body = JSON.parse(getBody())
        expect(body.ok).toBe(true)
        expect(body.command).toBe('health')
    })

    test('handles commands endpoint', async () => {
        const req = createMockReq('GET', '/api/v1/commands')
        const { res, getStatusCode, getBody } = createMockRes()
        const handled = await routeRequest(req, res, createContext())
        expect(handled).toBe(true)
        expect(getStatusCode()).toBe(200)
        const body = JSON.parse(getBody()) as { ok: boolean; stdout: string }
        expect(body.ok).toBe(true)
        const commands = JSON.parse(body.stdout) as unknown[]
        expect(commands.length).toBeGreaterThan(0)
    })

    test('returns 404 for REST when disabled', async () => {
        const req = createMockReq('GET', '/api/v1/cli/version')
        const { res, getStatusCode } = createMockRes()
        const ctx = createContext({
            settings: { ...createContext().settings, enableRestApi: false }
        })
        const handled = await routeRequest(req, res, ctx)
        expect(handled).toBe(true)
        expect(getStatusCode()).toBe(404)
    })

    test('returns 404 for unknown CLI command', async () => {
        const req = createMockReq('GET', '/api/v1/cli/nonexistent')
        const { res, getStatusCode } = createMockRes()
        const handled = await routeRequest(req, res, createContext())
        expect(handled).toBe(true)
        expect(getStatusCode()).toBe(404)
    })

    test('returns 405 for wrong HTTP method', async () => {
        const req = createMockReq('DELETE', '/api/v1/cli/version')
        const { res, getStatusCode } = createMockRes()
        const handled = await routeRequest(req, res, createContext())
        expect(handled).toBe(true)
        expect(getStatusCode()).toBe(405)
    })

    test('allows POST as universal fallback', async () => {
        const req = createMockReq('POST', '/api/v1/cli/version', {}, '{}')
        const { res, getStatusCode } = createMockRes()
        const handled = await routeRequest(req, res, createContext())
        expect(handled).toBe(true)
        expect(getStatusCode()).not.toBe(405)
    })

    test('returns 403 for blocked command', async () => {
        const req = createMockReq('GET', '/api/v1/cli/version')
        const { res, getStatusCode } = createMockRes()
        const ctx = createContext({
            settings: { ...createContext().settings, blockedCommands: ['version'] }
        })
        const handled = await routeRequest(req, res, ctx)
        expect(handled).toBe(true)
        expect(getStatusCode()).toBe(403)
    })

    test('returns 403 for dangerous command without opt-in', async () => {
        const req = createMockReq('POST', '/api/v1/cli/eval', {}, '{}')
        const { res, getStatusCode } = createMockRes()
        const handled = await routeRequest(req, res, createContext())
        expect(handled).toBe(true)
        expect(getStatusCode()).toBe(403)
    })

    test('returns 503 when CLI is unavailable', async () => {
        const req = createMockReq('GET', '/api/v1/cli/version')
        const { res, getStatusCode } = createMockRes()
        const ctx = createContext({
            cliStatus: {
                available: false,
                binaryPath: '',
                version: '',
                error: 'Not found'
            }
        })
        const handled = await routeRequest(req, res, ctx)
        expect(handled).toBe(true)
        expect(getStatusCode()).toBe(503)
    })

    test('returns false for unmatched path', async () => {
        const req = createMockReq('GET', '/something-else')
        const { res } = createMockRes()
        const handled = await routeRequest(req, res, createContext())
        expect(handled).toBe(false)
    })

    test('executes CLI command and returns result', async () => {
        const req = createMockReq('GET', '/api/v1/cli/version')
        const { res, getStatusCode, getBody } = createMockRes()
        const handled = await routeRequest(req, res, createContext())
        expect(handled).toBe(true)
        expect(getStatusCode()).toBe(200)
        const body = JSON.parse(getBody())
        expect(body.ok).toBe(true)
        expect(body.command).toBe('version')
        expect(body.stdout).toContain('version')
    })

    test('maps URL path to CLI command (property/set → property:set)', async () => {
        const req = createMockReq('POST', '/api/v1/cli/property/set', {}, '{}')
        const { res, getStatusCode, getBody } = createMockRes()
        const handled = await routeRequest(req, res, createContext())
        expect(handled).toBe(true)
        expect(getStatusCode()).toBe(200)
        const body = JSON.parse(getBody())
        expect(body.command).toBe('property:set')
    })
})
