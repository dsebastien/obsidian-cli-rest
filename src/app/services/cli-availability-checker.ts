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
 * Accepts both the standalone Obsidian CLI (`1.12.2`) and the Obsidian
 * desktop launcher (`1.12.7 (installer 1.12.4)`). The plugin only ever
 * runs inside a live Obsidian process, so invoking the desktop launcher
 * cannot spawn a second instance — Electron's single-instance lock
 * forwards subsequent `obsidian <cmd>` invocations to the running process
 * via IPC. Any responder whose stdout starts with a semver is usable.
 *
 * Rejected: empty stdout or stdout without a leading `<major>.<minor>` —
 * that's not a working Obsidian binary at all.
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
            if (!isVersionOutput(result.stdout)) {
                log(
                    `Candidate ${result.path} responded but stdout isn't a recognizable version string: ${result.stdout || '<empty>'}`,
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
 * Basic sanity check: stdout must be non-empty and start with a semver
 * (e.g. `1.12.2` or `1.12.7 (installer 1.12.4)`). Everything else is a
 * non-Obsidian binary and must be skipped.
 */
function isVersionOutput(stdout: string): boolean {
    const trimmed = stdout.trim()
    if (!trimmed) {
        return false
    }
    return /^\d+\.\d+(\.\d+)?/.test(trimmed)
}
