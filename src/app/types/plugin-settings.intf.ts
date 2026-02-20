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

export const DEFAULT_SETTINGS: PluginSettings = pluginSettingsSchema.parse({})
