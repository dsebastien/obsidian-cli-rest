import type { IncomingMessage } from 'node:http'
import { URL } from 'node:url'

export interface ParsedRequest {
    params: Record<string, string>
    flags: string[]
    vault: string
}

/**
 * Parse a GET request's query string into params and flags.
 */
export function parseQueryString(url: string, baseUrl: string): ParsedRequest {
    const parsed = new URL(url, baseUrl)
    const params: Record<string, string> = {}
    const flags: string[] = []
    let vault = ''

    for (const [key, value] of parsed.searchParams.entries()) {
        if (key === 'vault') {
            vault = value
        } else if (key === 'flags') {
            // flags can be comma-separated: flags=total,verbose
            for (const flag of value.split(',')) {
                const trimmed = flag.trim()
                if (trimmed) {
                    flags.push(trimmed)
                }
            }
        } else {
            params[key] = value
        }
    }

    return { params, flags, vault }
}

/**
 * Parse a JSON request body into params and flags.
 * Expected body shape: { vault?, params?, flags? }
 */
export async function parseJsonBody(req: IncomingMessage): Promise<ParsedRequest> {
    const body = await readBody(req)

    if (!body) {
        return { params: {}, flags: [], vault: '' }
    }

    const parsed = JSON.parse(body) as {
        vault?: string
        params?: Record<string, string>
        flags?: string[]
    }

    return {
        params: parsed.params ?? {},
        flags: parsed.flags ?? [],
        vault: parsed.vault ?? ''
    }
}

/**
 * Read the full request body as a string.
 */
function readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: Uint8Array[] = []
        req.on('data', (chunk: Uint8Array) => chunks.push(chunk))
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
        req.on('error', reject)
    })
}
