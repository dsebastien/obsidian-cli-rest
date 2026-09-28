import { z } from 'zod/v4'

export const pluginSettingsSchema = z.object({
    autoStart: z.boolean().default(true),
    port: z.number().int().min(1024).max(65535).default(27124),
    bindAddress: z.string().default('127.0.0.1'),
    apiKey: z.string().default(''),
    requestTimeout: z.number().int().min(1000).max(300000).default(30000),
    enableRestApi: z.boolean().default(true),
    enableMcp: z.boolean().default(true),
    allowDangerousCommands: z.boolean().default(false),
    blockedCommands: z.array(z.string()).default([]),
    enableCors: z.boolean().default(false),
    defaultVault: z.string().default('')
})

export type PluginSettings = z.infer<typeof pluginSettingsSchema>

/**
 * A fresh default settings object, safe to hand to Immer.
 *
 * `produce` deep-freezes what it returns, including any subtree it shares
 * with its base. Producing from the shared DEFAULT_SETTINGS froze that
 * constant (and its arrays) for the rest of the process, so any later code
 * or test touching it failed with "Attempted to assign to readonly
 * property". Produce from this instead, and keep it deep-fresh: build
 * nested arrays and objects as new values, never by spreading DEFAULT_SETTINGS.
 * Each schema parse yields new arrays (zod copies `.default([])`).
 */
export function createDefaultSettings(): PluginSettings {
    return pluginSettingsSchema.parse({})
}

/** The defaults, for reading and comparing. Never produce from it. */
export const DEFAULT_SETTINGS: PluginSettings = createDefaultSettings()
