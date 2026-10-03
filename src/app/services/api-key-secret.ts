/**
 * The API key lives in Obsidian's SecretStorage (device-local keychain), not in
 * data.json: data.json travels with the vault (git, Syncthing, cloud sync) and
 * would leak the key to every copy of the vault. Settings hold the secret's
 * NAME; the value is read from SecretStorage each time it is needed.
 *
 * Cross-device migration: SecretStorage is per device, so the legacy plaintext
 * `apiKey` in data.json stays as a READ-ONLY bootstrap source for a grace
 * period. Every device copies it into its own SecretStorage on load (or on
 * first read). Nothing new is ever written to that field; it is removed when
 * the key is rotated or the secret changed, by the "Remove plain-text copy
 * now" button, or automatically once the grace period has elapsed.
 */

/** The subset of Obsidian's `SecretStorage` this plugin uses. */
export interface SecretStore {
    getSecret(id: string): string | null
    setSecret(id: string, secret: string): void
}

/** The settings fields that locate the API key. */
export interface ApiKeySettings {
    apiKeySecretName: string
    /** Legacy plaintext key (pre-SecretStorage). Read-only bootstrap source. */
    apiKey?: string | undefined
    /** ISO date of this vault's first migration; '' before it. */
    legacySecretMigratedAt: string
}

/** Default secret name. Lowercase alphanumeric with dashes, as SecretStorage requires. */
export const DEFAULT_API_KEY_SECRET_NAME = 'cli-rest-mcp-api-key'

/** Days the legacy plaintext copy is kept in data.json after the first migration. */
export const LEGACY_PLAINTEXT_GRACE_DAYS = 60

const DAY_MS = 24 * 60 * 60 * 1000

/** Upper bound on suffixed names tried before giving up. */
const MAX_NAME_ATTEMPTS = 100

/** Shown when a secret name is configured but this device has no value for it. */
export const MISSING_API_KEY_MESSAGE =
    'REST and MCP server: the API key secret is not set on this device. Open Settings → REST and MCP server → Security and set it (use the same key as your other devices so your clients keep working).'

/** The legacy plaintext key, or null when absent or blank. */
export function legacyApiKeyOf(settings: ApiKeySettings): string | null {
    const value = settings.apiKey
    return value !== undefined && value.trim() !== '' ? value : null
}

/** The value stored under `secretName` on this device, '' when absent. ('' counts as absent: there is no delete API.) */
export function readSecret(store: SecretStore, secretName: string): string {
    if (!secretName) {
        return ''
    }
    return store.getSecret(secretName) ?? ''
}

/**
 * The API key without side effects: this device's secret, else the legacy
 * plaintext copy, else ''.
 */
export function peekApiKey(store: SecretStore, settings: ApiKeySettings): string {
    const secret = readSecret(store, settings.apiKeySecretName)
    if (secret.trim() !== '') {
        return secret
    }
    return legacyApiKeyOf(settings) ?? ''
}

/**
 * The API key, read at use time. Prefers SecretStorage; when this device has
 * no value yet but data.json still carries the legacy copy, migrates it into
 * SecretStorage right now and returns it (still returns it if that write fails).
 */
export function readApiKey(store: SecretStore, settings: ApiKeySettings): string {
    const secret = readSecret(store, settings.apiKeySecretName)
    if (secret.trim() !== '') {
        return secret
    }
    const legacy = legacyApiKeyOf(settings)
    if (legacy === null) {
        return ''
    }
    if (settings.apiKeySecretName) {
        try {
            store.setSecret(settings.apiKeySecretName, legacy)
        } catch {
            // Serving the legacy value keeps clients working; the next load retries.
        }
    }
    return legacy
}

/** Whether a secret name is configured but neither this device nor data.json holds a key. */
export function isApiKeyMissing(store: SecretStore, settings: ApiKeySettings): boolean {
    return settings.apiKeySecretName !== '' && peekApiKey(store, settings).trim() === ''
}

/**
 * A name under which `value` can be stored without overwriting a different
 * secret: the default name if it is free or already holds `value`, otherwise
 * the first free (or matching) `<default>-<n>`.
 */
export function findSecretName(store: SecretStore, value: string | null): string {
    for (let attempt = 1; attempt <= MAX_NAME_ATTEMPTS; attempt += 1) {
        const name =
            attempt === 1
                ? DEFAULT_API_KEY_SECRET_NAME
                : `${DEFAULT_API_KEY_SECRET_NAME}-${attempt}`
        const existing = readSecret(store, name)
        if (existing === '' || (value !== null && existing === value)) {
            return name
        }
    }
    throw new Error('No free secret name found for the API key')
}

/** Store a freshly generated key under a free name; returns that name. */
export function storeNewApiKey(store: SecretStore, key: string): string {
    const name = findSecretName(store, null)
    store.setSecret(name, key)
    return name
}

/** Whether the legacy copy has outlived the grace period. */
export function isLegacyGraceOver(migratedAt: string, now: Date): boolean {
    const since = Date.parse(migratedAt)
    if (Number.isNaN(since)) {
        return false
    }
    return now.getTime() - since >= LEGACY_PLAINTEXT_GRACE_DAYS * DAY_MS
}

export type ApiKeySecretOutcome =
    /** This device's SecretStorage holds the key. */
    | 'ready'
    /** The legacy plaintext key was copied into this device's SecretStorage. */
    | 'migrated'
    /** Fresh install: a new key was generated and stored. */
    | 'generated'
    /** A name is set but neither this device nor data.json has a key. Nothing was generated. */
    | 'missing'

export interface ApiKeySecretResolution {
    /** The settings fields afterwards (`apiKey` undefined = legacy field removed). */
    settings: ApiKeySettings
    outcome: ApiKeySecretOutcome
    /** Whether the settings changed and must be saved. */
    mustSave: boolean
}

/**
 * Per-device load-time step. Idempotent: running it again on its own output
 * changes nothing (until the grace period ends).
 *
 * - legacy key present: copy it into this device's SecretStorage if absent
 *   there (never overwriting a different secret when picking a name), stamp
 *   the first migration date, and drop the legacy copy once the grace period
 *   is over. Other synced devices keep bootstrapping from it until then.
 * - no legacy key, no name: fresh install, generate a key and store it.
 * - no legacy key, name set, secret absent: report it, never regenerate (that
 *   would silently invalidate every configured client).
 */
export function resolveApiKeySecret(
    store: SecretStore,
    current: ApiKeySettings,
    now: Date,
    generate: () => string
): ApiKeySecretResolution {
    const legacy = legacyApiKeyOf(current)
    const next: ApiKeySettings = { ...current }
    let outcome: ApiKeySecretOutcome

    if (legacy !== null) {
        if (!next.apiKeySecretName) {
            next.apiKeySecretName = findSecretName(store, legacy)
        }
        if (readSecret(store, next.apiKeySecretName).trim() === '') {
            store.setSecret(next.apiKeySecretName, legacy)
            outcome = 'migrated'
        } else {
            outcome = 'ready'
        }
        if (!next.legacySecretMigratedAt) {
            next.legacySecretMigratedAt = now.toISOString()
        } else if (isLegacyGraceOver(next.legacySecretMigratedAt, now)) {
            next.apiKey = undefined
        }
    } else {
        // A blank legacy field carries nothing: drop it.
        next.apiKey = undefined
        if (!next.apiKeySecretName) {
            next.apiKeySecretName = storeNewApiKey(store, generate())
            outcome = 'generated'
        } else if (readSecret(store, next.apiKeySecretName).trim() === '') {
            outcome = 'missing'
        } else {
            outcome = 'ready'
        }
    }

    const mustSave =
        next.apiKeySecretName !== current.apiKeySecretName ||
        next.legacySecretMigratedAt !== current.legacySecretMigratedAt ||
        next.apiKey !== current.apiKey ||
        ('apiKey' in current && next.apiKey === undefined)
    return { settings: next, outcome, mustSave }
}
