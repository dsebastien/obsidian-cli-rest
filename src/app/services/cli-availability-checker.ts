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
 *
 * Candidates whose `version` stdout is empty or looks like the Obsidian
 * desktop launcher (e.g. `1.12.7 (installer 1.12.4)`) are rejected — only
 * the standalone CLI is acceptable.
 *
 * The `candidates` parameter is exposed for tests; production callers
 * should pass nothing and let the default candidate list apply.
 */
export async function checkCliAvailability(
    candidates: readonly string[] = CLI_CANDIDATES
): Promise<CliAvailabilityResult> {
    for (const candidate of candidates) {
        try {
            const result = await tryCandidate(candidate)
            if (!isCliVersionOutput(result.stdout)) {
                log(
                    `Candidate ${result.path} responded but stdout doesn't look like the Obsidian CLI: ${result.stdout || '<empty>'}`,
                    'debug'
                )
                continue
            }
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

    const errorMsg = 'Obsidian CLI binary not found. Tried: ' + candidates.join(', ')
    log(errorMsg, 'warn')
    return {
        available: false,
        binaryPath: '',
        version: '',
        error: errorMsg
    }
}

/**
 * Discriminate the standalone Obsidian CLI from the desktop launcher.
 * The CLI prints a bare semver string (e.g. `1.12.2`); the desktop launcher
 * prints something like `1.12.7 (installer 1.12.4)` or nothing at all.
 */
function isCliVersionOutput(stdout: string): boolean {
    const trimmed = stdout.trim()
    if (!trimmed) {
        return false
    }
    if (trimmed.toLowerCase().includes('installer')) {
        return false
    }
    return /^\d+\.\d+(\.\d+)?/.test(trimmed)
}
