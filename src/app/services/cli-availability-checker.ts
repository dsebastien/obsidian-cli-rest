import { execFile } from 'node:child_process'
import { log } from '../../utils/log'

export interface CliAvailabilityResult {
    available: boolean
    binaryPath: string
    version: string
    error: string
}

const CLI_CANDIDATES = ['obsidian', '/usr/local/bin/obsidian', '/usr/bin/obsidian']
const CHECK_TIMEOUT_MS = 5000

/**
 * Execute a CLI binary candidate with "version" and return stdout.
 */
function tryCandidate(candidate: string): Promise<{ stdout: string; path: string }> {
    return new Promise((resolve, reject) => {
        execFile(candidate, ['version'], { timeout: CHECK_TIMEOUT_MS }, (error, stdout) => {
            if (error) {
                reject(new Error(error.message))
                return
            }
            resolve({ stdout: stdout.trim(), path: candidate })
        })
    })
}

/**
 * Check if the Obsidian CLI binary is available on the system.
 * Tries multiple candidates: PATH-resolved, /usr/local/bin, /usr/bin.
 */
export async function checkCliAvailability(): Promise<CliAvailabilityResult> {
    for (const candidate of CLI_CANDIDATES) {
        try {
            const result = await tryCandidate(candidate)
            log(`CLI found at ${result.path}: ${result.stdout}`, 'debug')
            return {
                available: true,
                binaryPath: result.path,
                version: result.stdout,
                error: ''
            }
        } catch {
            // Try next candidate
        }
    }

    const errorMsg = 'Obsidian CLI binary not found. Tried: ' + CLI_CANDIDATES.join(', ')
    log(errorMsg, 'warn')
    return {
        available: false,
        binaryPath: '',
        version: '',
        error: errorMsg
    }
}
