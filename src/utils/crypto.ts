import { randomBytes } from 'node:crypto'

/**
 * Generate a cryptographically secure API key.
 * Returns a 32-byte hex string (64 characters).
 */
export function generateApiKey(): string {
    return randomBytes(32).toString('hex')
}
