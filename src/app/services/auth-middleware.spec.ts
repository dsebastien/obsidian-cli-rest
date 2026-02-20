import { describe, expect, test } from 'bun:test'
import { validateAuth } from './auth-middleware'
import type { IncomingMessage } from 'node:http'

function createMockReq(headers: Record<string, string>): IncomingMessage {
    return { headers } as unknown as IncomingMessage
}

describe('validateAuth', () => {
    test('passes when API key is empty (auth disabled)', () => {
        const req = createMockReq({})
        expect(validateAuth(req, '')).toBe(true)
    })

    test('fails when no Authorization header is present', () => {
        const req = createMockReq({})
        expect(validateAuth(req, 'secret-key')).toBe(false)
    })

    test('fails when Authorization header is malformed', () => {
        const req = createMockReq({ authorization: 'Basic abc123' })
        expect(validateAuth(req, 'secret-key')).toBe(false)
    })

    test('fails when Authorization header has wrong token', () => {
        const req = createMockReq({ authorization: 'Bearer wrong-key' })
        expect(validateAuth(req, 'secret-key')).toBe(false)
    })

    test('passes when Authorization header matches API key', () => {
        const req = createMockReq({ authorization: 'Bearer secret-key' })
        expect(validateAuth(req, 'secret-key')).toBe(true)
    })

    test('fails when Bearer prefix is missing', () => {
        const req = createMockReq({ authorization: 'secret-key' })
        expect(validateAuth(req, 'secret-key')).toBe(false)
    })

    test('fails when there are extra spaces in header', () => {
        const req = createMockReq({ authorization: 'Bearer  secret-key' })
        expect(validateAuth(req, 'secret-key')).toBe(false)
    })
})
