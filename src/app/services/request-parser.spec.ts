import { describe, expect, test } from 'bun:test'
import { parseQueryString } from './request-parser'

describe('parseQueryString', () => {
    const baseUrl = 'http://localhost:27124'

    test('parses empty query string', () => {
        const result = parseQueryString('/api/v1/cli/version', baseUrl)
        expect(result.params).toEqual({})
        expect(result.flags).toEqual([])
        expect(result.vault).toBe('')
    })

    test('parses vault parameter', () => {
        const result = parseQueryString('/api/v1/cli/files?vault=MyVault', baseUrl)
        expect(result.vault).toBe('MyVault')
        expect(result.params).toEqual({})
    })

    test('parses key-value params', () => {
        const result = parseQueryString('/api/v1/cli/search?query=hello&path=notes', baseUrl)
        expect(result.params).toEqual({ query: 'hello', path: 'notes' })
        expect(result.vault).toBe('')
    })

    test('parses comma-separated flags', () => {
        const result = parseQueryString('/api/v1/cli/tags?flags=total,counts', baseUrl)
        expect(result.flags).toEqual(['total', 'counts'])
    })

    test('parses single flag', () => {
        const result = parseQueryString('/api/v1/cli/files?flags=total', baseUrl)
        expect(result.flags).toEqual(['total'])
    })

    test('parses combined vault, params, and flags', () => {
        const result = parseQueryString(
            '/api/v1/cli/search?vault=TestVault&query=test&limit=10&flags=total,case',
            baseUrl
        )
        expect(result.vault).toBe('TestVault')
        expect(result.params).toEqual({ query: 'test', limit: '10' })
        expect(result.flags).toEqual(['total', 'case'])
    })

    test('trims whitespace from flags', () => {
        const result = parseQueryString('/api/v1/cli/tags?flags=total, counts , verbose', baseUrl)
        expect(result.flags).toEqual(['total', 'counts', 'verbose'])
    })

    test('ignores empty flags', () => {
        const result = parseQueryString('/api/v1/cli/tags?flags=total,,counts', baseUrl)
        expect(result.flags).toEqual(['total', 'counts'])
    })
})
