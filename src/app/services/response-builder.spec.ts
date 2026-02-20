import { describe, expect, test } from 'bun:test'
import { sendSuccess, sendError, handleCorsPreflightIfNeeded } from './response-builder'
import type { ServerResponse } from 'node:http'

function createMockRes(): {
    res: ServerResponse
    getStatusCode: () => number
    getHeaders: () => Record<string, string>
    getBody: () => string
} {
    let statusCode = 0
    const headers: Record<string, string> = {}
    let body = ''

    const res = {
        writeHead(code: number, hdrs?: Record<string, string>) {
            statusCode = code
            if (hdrs) {
                Object.assign(headers, hdrs)
            }
            return res
        },
        setHeader(name: string, value: string) {
            headers[name] = value
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
        getHeaders: () => headers,
        getBody: () => body
    }
}

describe('sendSuccess', () => {
    test('sends 200 with JSON body', () => {
        const { res, getStatusCode, getBody } = createMockRes()
        sendSuccess(
            res,
            { command: 'version', exitCode: 0, stdout: '1.0.0', stderr: '', duration: 10 },
            false
        )
        expect(getStatusCode()).toBe(200)
        const body = JSON.parse(getBody())
        expect(body.ok).toBe(true)
        expect(body.command).toBe('version')
        expect(body.stdout).toBe('1.0.0')
    })

    test('sets Content-Type header', () => {
        const { res, getHeaders } = createMockRes()
        sendSuccess(
            res,
            { command: 'test', exitCode: 0, stdout: '', stderr: '', duration: 0 },
            false
        )
        expect(getHeaders()['Content-Type']).toBe('application/json')
    })

    test('sets CORS headers when enabled', () => {
        const { res, getHeaders } = createMockRes()
        sendSuccess(
            res,
            { command: 'test', exitCode: 0, stdout: '', stderr: '', duration: 0 },
            true
        )
        expect(getHeaders()['Access-Control-Allow-Origin']).toBe('*')
    })

    test('does not set CORS headers when disabled', () => {
        const { res, getHeaders } = createMockRes()
        sendSuccess(
            res,
            { command: 'test', exitCode: 0, stdout: '', stderr: '', duration: 0 },
            false
        )
        expect(getHeaders()['Access-Control-Allow-Origin']).toBeUndefined()
    })
})

describe('sendError', () => {
    test('sends specified status code with error message', () => {
        const { res, getStatusCode, getBody } = createMockRes()
        sendError(res, 404, 'Not found', false)
        expect(getStatusCode()).toBe(404)
        const body = JSON.parse(getBody())
        expect(body.ok).toBe(false)
        expect(body.error).toBe('Not found')
    })

    test('includes extra fields when provided', () => {
        const { res, getBody } = createMockRes()
        sendError(res, 422, 'CLI error', false, {
            command: 'search',
            exitCode: 1,
            stderr: 'not found'
        })
        const body = JSON.parse(getBody())
        expect(body.command).toBe('search')
        expect(body.exitCode).toBe(1)
        expect(body.stderr).toBe('not found')
    })
})

describe('handleCorsPreflightIfNeeded', () => {
    test('handles OPTIONS when CORS enabled', () => {
        const { res, getStatusCode, getHeaders } = createMockRes()
        const handled = handleCorsPreflightIfNeeded(res, 'OPTIONS', true)
        expect(handled).toBe(true)
        expect(getStatusCode()).toBe(204)
        expect(getHeaders()['Access-Control-Allow-Origin']).toBe('*')
    })

    test('does not handle OPTIONS when CORS disabled', () => {
        const { res } = createMockRes()
        const handled = handleCorsPreflightIfNeeded(res, 'OPTIONS', false)
        expect(handled).toBe(false)
    })

    test('does not handle non-OPTIONS methods', () => {
        const { res } = createMockRes()
        const handled = handleCorsPreflightIfNeeded(res, 'GET', true)
        expect(handled).toBe(false)
    })
})
