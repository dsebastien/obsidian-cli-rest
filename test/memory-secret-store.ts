/**
 * Test-only stand-in for Obsidian's `SecretStorage`: an in-memory map that
 * enforces the same id format (lowercase alphanumeric with dashes). Never
 * import this from production code.
 */
import type { SecretStore } from '../src/app/services/api-key-secret'

export class MemorySecretStore implements SecretStore {
    readonly secrets = new Map<string, string>()
    writes = 0

    constructor(initial: Record<string, string> = {}) {
        for (const [id, value] of Object.entries(initial)) {
            this.secrets.set(id, value)
        }
    }

    getSecret(id: string): string | null {
        return this.secrets.get(id) ?? null
    }

    setSecret(id: string, secret: string): void {
        if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) {
            throw new Error(`Invalid secret id: ${id}`)
        }
        this.writes += 1
        this.secrets.set(id, secret)
    }

    listSecrets(): string[] {
        return [...this.secrets.keys()]
    }
}
