import { describe, expect, test } from 'bun:test'
import {
    DEFAULT_API_KEY_SECRET_NAME,
    LEGACY_PLAINTEXT_GRACE_DAYS,
    findSecretName,
    isApiKeyMissing,
    isLegacyGraceOver,
    peekApiKey,
    readApiKey,
    resolveApiKeySecret
} from './api-key-secret'
import type { ApiKeySettings } from './api-key-secret'
import { MemorySecretStore } from '../../../test/memory-secret-store'

const NOW = new Date('2026-10-03T12:00:00.000Z')
const DAY_MS = 24 * 60 * 60 * 1000
const daysAfter = (iso: string, days: number): Date => new Date(Date.parse(iso) + days * DAY_MS)
const noGenerate = (): string => {
    throw new Error('must not generate')
}

const legacySettings = (apiKey: string): ApiKeySettings => ({
    apiKeySecretName: '',
    apiKey,
    legacySecretMigratedAt: ''
})

describe('resolveApiKeySecret: legacy plaintext migration', () => {
    test('first device: stores the legacy key, records the date, keeps the plaintext', () => {
        const store = new MemorySecretStore()
        const result = resolveApiKeySecret(store, legacySettings('old-key'), NOW, noGenerate)
        expect(result.outcome).toBe('migrated')
        expect(result.mustSave).toBe(true)
        expect(result.settings.apiKeySecretName).toBe(DEFAULT_API_KEY_SECRET_NAME)
        expect(result.settings.legacySecretMigratedAt).toBe(NOW.toISOString())
        expect(result.settings.apiKey).toBe('old-key')
        expect(store.getSecret(DEFAULT_API_KEY_SECRET_NAME)).toBe('old-key')
    })

    test('is idempotent: a second run changes nothing and writes no secret', () => {
        const store = new MemorySecretStore()
        const first = resolveApiKeySecret(store, legacySettings('old-key'), NOW, noGenerate)
        const writes = store.writes
        const second = resolveApiKeySecret(store, first.settings, NOW, noGenerate)
        expect(second.outcome).toBe('ready')
        expect(second.mustSave).toBe(false)
        expect(second.settings).toEqual(first.settings)
        expect(store.writes).toBe(writes)
    })

    test('device B: synced data.json with legacy key and empty secret storage migrates', () => {
        const deviceA = new MemorySecretStore()
        const synced = resolveApiKeySecret(
            deviceA,
            legacySettings('old-key'),
            NOW,
            noGenerate
        ).settings
        const deviceB = new MemorySecretStore()
        const result = resolveApiKeySecret(
            deviceB,
            synced,
            daysAfter(NOW.toISOString(), 3),
            noGenerate
        )
        expect(result.outcome).toBe('migrated')
        expect(result.mustSave).toBe(false)
        expect(deviceB.getSecret(DEFAULT_API_KEY_SECRET_NAME)).toBe('old-key')
        expect(readApiKey(deviceB, result.settings)).toBe('old-key')
    })

    test('never overwrites a different secret under the default name', () => {
        const store = new MemorySecretStore({ [DEFAULT_API_KEY_SECRET_NAME]: 'other-vault-key' })
        const result = resolveApiKeySecret(store, legacySettings('old-key'), NOW, noGenerate)
        expect(result.settings.apiKeySecretName).toBe(`${DEFAULT_API_KEY_SECRET_NAME}-2`)
        expect(store.getSecret(DEFAULT_API_KEY_SECRET_NAME)).toBe('other-vault-key')
        expect(store.getSecret(`${DEFAULT_API_KEY_SECRET_NAME}-2`)).toBe('old-key')
    })

    test('reuses the default name when it already holds the same value', () => {
        const store = new MemorySecretStore({ [DEFAULT_API_KEY_SECRET_NAME]: 'old-key' })
        const result = resolveApiKeySecret(store, legacySettings('old-key'), NOW, noGenerate)
        expect(result.settings.apiKeySecretName).toBe(DEFAULT_API_KEY_SECRET_NAME)
        expect(result.outcome).toBe('ready')
        expect(store.writes).toBe(0)
    })

    test('prefers this device secret over the legacy copy', () => {
        const store = new MemorySecretStore({ [DEFAULT_API_KEY_SECRET_NAME]: 'rotated' })
        const settings: ApiKeySettings = {
            apiKeySecretName: DEFAULT_API_KEY_SECRET_NAME,
            apiKey: 'old-key',
            legacySecretMigratedAt: NOW.toISOString()
        }
        const result = resolveApiKeySecret(store, settings, NOW, noGenerate)
        expect(result.outcome).toBe('ready')
        expect(readApiKey(store, result.settings)).toBe('rotated')
    })

    test(`purges the plaintext ${LEGACY_PLAINTEXT_GRACE_DAYS} days after the first migration`, () => {
        const store = new MemorySecretStore()
        const migrated = resolveApiKeySecret(store, legacySettings('old-key'), NOW, noGenerate)
        const before = resolveApiKeySecret(
            store,
            migrated.settings,
            daysAfter(NOW.toISOString(), LEGACY_PLAINTEXT_GRACE_DAYS - 1),
            noGenerate
        )
        expect(before.settings.apiKey).toBe('old-key')
        expect(before.mustSave).toBe(false)
        const after = resolveApiKeySecret(
            store,
            migrated.settings,
            daysAfter(NOW.toISOString(), LEGACY_PLAINTEXT_GRACE_DAYS),
            noGenerate
        )
        expect(after.settings.apiKey).toBeUndefined()
        expect(after.mustSave).toBe(true)
        expect(readApiKey(store, after.settings)).toBe('old-key')
    })
})

describe('resolveApiKeySecret: no legacy key', () => {
    test('fresh install generates and stores a key', () => {
        const store = new MemorySecretStore()
        const result = resolveApiKeySecret(
            store,
            { apiKeySecretName: '', legacySecretMigratedAt: '' },
            NOW,
            () => 'fresh'
        )
        expect(result.outcome).toBe('generated')
        expect(result.mustSave).toBe(true)
        expect(readApiKey(store, result.settings)).toBe('fresh')
    })

    test('a name with no secret on this device is reported, never regenerated', () => {
        const store = new MemorySecretStore()
        const settings: ApiKeySettings = {
            apiKeySecretName: DEFAULT_API_KEY_SECRET_NAME,
            legacySecretMigratedAt: NOW.toISOString()
        }
        const result = resolveApiKeySecret(store, settings, NOW, noGenerate)
        expect(result.outcome).toBe('missing')
        expect(result.mustSave).toBe(false)
        expect(store.writes).toBe(0)
        expect(isApiKeyMissing(store, settings)).toBe(true)
    })

    test('an empty secret counts as absent (there is no delete API)', () => {
        const store = new MemorySecretStore({ [DEFAULT_API_KEY_SECRET_NAME]: '' })
        const settings: ApiKeySettings = {
            apiKeySecretName: DEFAULT_API_KEY_SECRET_NAME,
            legacySecretMigratedAt: ''
        }
        expect(resolveApiKeySecret(store, settings, NOW, noGenerate).outcome).toBe('missing')
    })
})

describe('readApiKey', () => {
    test('falls back to the legacy copy and migrates it on the spot', () => {
        const store = new MemorySecretStore()
        const settings: ApiKeySettings = {
            apiKeySecretName: DEFAULT_API_KEY_SECRET_NAME,
            apiKey: 'old-key',
            legacySecretMigratedAt: NOW.toISOString()
        }
        expect(peekApiKey(store, settings)).toBe('old-key')
        expect(store.writes).toBe(0)
        expect(readApiKey(store, settings)).toBe('old-key')
        expect(store.getSecret(DEFAULT_API_KEY_SECRET_NAME)).toBe('old-key')
    })

    test('still serves the legacy copy when secret storage refuses the write', () => {
        const store = new MemorySecretStore()
        store.setSecret = (): void => {
            throw new Error('unavailable')
        }
        const settings: ApiKeySettings = {
            apiKeySecretName: DEFAULT_API_KEY_SECRET_NAME,
            apiKey: 'old-key',
            legacySecretMigratedAt: ''
        }
        expect(readApiKey(store, settings)).toBe('old-key')
    })
})

describe('helpers', () => {
    test('findSecretName skips taken names', () => {
        const store = new MemorySecretStore({
            [DEFAULT_API_KEY_SECRET_NAME]: 'a',
            [`${DEFAULT_API_KEY_SECRET_NAME}-2`]: 'b'
        })
        expect(findSecretName(store, null)).toBe(`${DEFAULT_API_KEY_SECRET_NAME}-3`)
    })

    test('isLegacyGraceOver ignores an unparseable date', () => {
        expect(isLegacyGraceOver('not a date', NOW)).toBe(false)
    })
})
