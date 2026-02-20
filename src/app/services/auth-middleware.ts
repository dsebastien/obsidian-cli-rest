import type { IncomingMessage } from 'node:http'

/**
 * Validate the Authorization header against the configured API key.
 * Returns true if auth passes, false if it fails.
 * If apiKey is empty, auth is disabled (all requests pass).
 */
export function validateAuth(req: IncomingMessage, apiKey: string): boolean {
    if (!apiKey) {
        return true
    }

    const authHeader = req.headers['authorization']
    if (!authHeader) {
        return false
    }

    const parts = authHeader.split(' ')
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return false
    }

    return parts[1] === apiKey
}
