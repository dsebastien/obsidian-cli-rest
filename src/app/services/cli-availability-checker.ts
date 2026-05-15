import { execFile } from 'node:child_process'
import { log } from '../../utils/log'

export interface CliAvailabilityResult {
    available: boolean
    binaryPath: string
    version: string
    error: string
}

/**
 * Fallback candidates tried after running-process derivation. These match
 * the common locations a package-manager-installed Obsidian ends up at on
 * Linux. `obsidian` (bare) triggers Node's PATH lookup in `execFile`.
 */
const FALLBACK_CANDIDATES = ['obsidian', '/usr/local/bin/obsidian', '/usr/bin/obsidian']
const CHECK_TIMEOUT_MS = 15_000

/**
 * Delays (ms) between successive CLI-detection attempts. The first attempt is
 * immediate; subsequent attempts wait the listed amount BEFORE re-probing.
 *
 * Rationale: the Obsidian launcher is *not* an independent CLI — it's an
 * Electron single-instance forwarder that hands off `obsidian <subcommand>`
 * over IPC to the already-running Obsidian process. When this plugin runs
 * `obsidian version` from its own `onload()`, the receiving Obsidian (the
 * same process) hasn't necessarily finished loading the sibling plugin that
 * actually serves the `version` command yet, so the IPC reply is either
 * empty stdout or "Command not found". Retrying with backoff lets sibling
 * plugins finish their own `onload()` before we conclude the CLI is unusable.
 *
 * Total worst-case extra wait: ~3.75s across delays + per-attempt spawn cost.
 */
const DEFAULT_RETRY_DELAYS_MS: readonly number[] = [0, 250, 500, 1000, 2000]

interface CandidateResponse {
    stdout: string
    stderr: string
    path: string
    errorMessage: string | null
}

/**
 * Execute a CLI binary candidate with "version" and capture stdout.
 *
 * Always resolves (never rejects) with whatever we got — stdout, stderr, and
 * any error message. The caller decides if the response looks like a real
 * Obsidian binary. This matters because spawning the Obsidian desktop
 * launcher from inside a running Obsidian can yield a non-zero exit code
 * alongside valid version output (e.g. when the single-instance IPC
 * forwarder reports a status the parent process didn't expect), or the
 * child may be killed by the timeout after it has already written stdout.
 * Rejecting on `error` in those cases hides a usable binary.
 */
function tryCandidate(candidate: string): Promise<CandidateResponse> {
    return new Promise((resolve) => {
        execFile(candidate, ['version'], { timeout: CHECK_TIMEOUT_MS }, (error, stdout, stderr) => {
            resolve({
                stdout: (stdout ?? '').trim(),
                stderr: (stderr ?? '').trim(),
                path: candidate,
                errorMessage: error ? error.message : null
            })
        })
    })
}

/**
 * Context about the running Obsidian process, pulled from `process.*`.
 * Isolated behind an interface so `deriveCandidatesFromProcess()` can be
 * unit-tested deterministically with synthetic inputs.
 */
export interface ProcessDiscoveryInput {
    platform: typeof process.platform
    argv: readonly string[]
    execPath: string
    env: Readonly<Record<string, string | undefined>>
}

/**
 * Derive candidate binary paths from the running Obsidian process.
 *
 * The plugin is loaded *inside* Obsidian, so the process itself is the most
 * authoritative source for "where did this Obsidian come from?". We use it
 * to produce installation-specific candidates that beat any hardcoded
 * PATH-based guesses.
 *
 * Coverage:
 *   - Linux system install (Arch/Debian/Fedora rpm-style):
 *       /usr/lib/obsidian/app.asar → /usr/bin/obsidian
 *   - Linux /opt-style install:
 *       /opt/Obsidian/resources/app.asar → /opt/Obsidian/obsidian
 *   - AppImage:
 *       $APPIMAGE is set to the .AppImage path, which is itself the launcher
 *   - Snap:
 *       $SNAP is set; the wrapper lives at /snap/bin/obsidian
 *   - Flatpak:
 *       $FLATPAK_ID signals we're sandboxed; spawning the host binary isn't
 *       possible from inside — fall back to standard PATH (may still work
 *       if the user exposed a flatpak-spawn wrapper on PATH)
 *   - macOS .app bundle:
 *       .../Obsidian.app/Contents/Resources/{app,obsidian}.asar
 *       → .../Obsidian.app/Contents/MacOS/Obsidian
 *   - Windows:
 *       ...\resources\{app,obsidian}.asar → ...\Obsidian.exe
 *
 * Order matters: the first candidate is the one most likely to be *the
 * exact binary that launched the current process*.
 */
export function deriveCandidatesFromProcess(input: ProcessDiscoveryInput): string[] {
    const candidates: string[] = []
    const { platform, argv, env } = input

    const appImage = env['APPIMAGE']
    if (appImage && appImage.length > 0) {
        candidates.push(appImage)
    }

    if (platform === 'linux' && env['SNAP']) {
        candidates.push('/snap/bin/obsidian')
    }

    // `argv[1]` is the asar Electron loaded as the main module. Historically
    // this was always `app.asar`, but Obsidian's recent macOS bundles also
    // ship `obsidian.asar` in `Contents/Resources/`, and `argv[1]` can point
    // to either. Match on the `.asar` suffix so both names work; the
    // surrounding directory layout is what actually identifies the install.
    const mainAsar = argv[1] ?? ''
    if (mainAsar.endsWith('.asar') || mainAsar.endsWith('.asar.unpacked')) {
        const macMatch = mainAsar.match(
            /^(.+\.app)\/Contents\/Resources\/[^/]+\.asar(?:\.unpacked)?$/
        )
        if (macMatch && macMatch[1]) {
            candidates.push(`${macMatch[1]}/Contents/MacOS/Obsidian`)
        }

        if (platform === 'linux') {
            const usrLibObsidianMatch = mainAsar.match(/^\/usr\/lib\/obsidian\/[^/]+\.asar$/)
            if (usrLibObsidianMatch) {
                candidates.push('/usr/bin/obsidian')
            }
            const optMatch = mainAsar.match(/^(\/opt\/[^/]+)\/resources\/[^/]+\.asar$/)
            if (optMatch && optMatch[1]) {
                candidates.push(`${optMatch[1]}/obsidian`)
            }
            const usrLibMatch = mainAsar.match(/^(\/usr\/lib\/[^/]+)\/[^/]+\.asar$/)
            if (usrLibMatch && usrLibMatch[1] && !usrLibObsidianMatch) {
                // Non-canonical usr/lib layout (e.g. forks): best guess is sibling bin entry
                candidates.push(`${usrLibMatch[1]}/obsidian`)
            }
        }

        if (platform === 'win32') {
            const winMatch = mainAsar.match(/^(.+)[\\/]resources[\\/][^\\/]+\.asar$/i)
            if (winMatch && winMatch[1]) {
                candidates.push(`${winMatch[1]}\\Obsidian.exe`)
            }
        }
    }

    return candidates
}

/**
 * Build the final ordered candidate list: process-derived first, then
 * fallbacks. Deduplicated while preserving first-seen order so the
 * most-trusted path wins on ties.
 */
function buildCandidates(fallbacks: readonly string[]): string[] {
    const derived = deriveCandidatesFromProcess({
        platform: process.platform,
        argv: process.argv,
        execPath: process.execPath,
        env: process.env
    })
    const seen = new Set<string>()
    const ordered: string[] = []
    for (const c of [...derived, ...fallbacks]) {
        if (!seen.has(c)) {
            seen.add(c)
            ordered.push(c)
        }
    }
    return ordered
}

/**
 * Run a single CLI-detection pass over the ordered candidate list.
 * Returns the first candidate that produces a recognized version banner,
 * or a structured failure with per-candidate reasons.
 */
async function probeOnce(
    ordered: readonly string[]
): Promise<{ result: CliAvailabilityResult; failureReasons: string[] }> {
    const failureReasons: string[] = []

    for (const candidate of ordered) {
        const result = await tryCandidate(candidate)

        if (isVersionOutput(result.stdout)) {
            if (result.errorMessage) {
                log(
                    `CLI candidate ${result.path} exited with an error but returned a valid version, accepting: ${result.errorMessage}`,
                    'debug'
                )
            }
            log(`CLI found at ${result.path}: ${result.stdout}`, 'debug')
            return {
                result: {
                    available: true,
                    binaryPath: result.path,
                    version: result.stdout,
                    error: ''
                },
                failureReasons: []
            }
        }

        const reason = describeFailure(result)
        failureReasons.push(`${candidate}: ${reason}`)
        log(`CLI candidate ${candidate} rejected — ${reason}`, 'debug')
    }

    return {
        result: { available: false, binaryPath: '', version: '', error: '' },
        failureReasons
    }
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms))
}

/**
 * Check if the Obsidian CLI binary is available on the system.
 *
 * Discovery order:
 *   1. Paths derived from the running Obsidian process (most reliable — this
 *      is literally the binary that launched us, by construction).
 *   2. PATH lookup (`obsidian` — Node's `execFile` resolves via PATH).
 *   3. Hardcoded absolute fallbacks (`/usr/local/bin/obsidian`,
 *      `/usr/bin/obsidian`) for unusual environments where neither of the
 *      above produces a hit.
 *
 * Accepts both the standalone Obsidian CLI (`1.12.2`) and the Obsidian
 * desktop launcher (`1.12.7 (installer 1.12.4)`). Any responder whose
 * stdout starts with a semver is usable — even if the child process exited
 * with a non-zero status, which can happen when Electron's single-instance
 * forwarder is involved.
 *
 * Retry behaviour: if every candidate fails the first pass, the whole probe
 * is repeated according to `retryDelaysMs` (default
 * `DEFAULT_RETRY_DELAYS_MS`). This is critical inside Obsidian itself, where
 * the launcher round-trips through IPC to the same running instance; the
 * sibling plugin that serves `version` may not have finished loading yet at
 * the moment we first probe. Pass `[0]` to disable retries (e.g. in tests).
 *
 * Per-candidate failures from the FINAL attempt are aggregated into the
 * warn-level error message so operators can see *why* each probe failed.
 *
 * The `candidates` parameter is exposed for tests; production callers
 * should pass nothing.
 */
export async function checkCliAvailability(
    candidates?: readonly string[],
    retryDelaysMs: readonly number[] = DEFAULT_RETRY_DELAYS_MS
): Promise<CliAvailabilityResult> {
    const ordered = candidates ? [...candidates] : buildCandidates(FALLBACK_CANDIDATES)
    const delays = retryDelaysMs.length > 0 ? retryDelaysMs : [0]
    let lastFailureReasons: string[] = []

    for (let attempt = 0; attempt < delays.length; attempt++) {
        const wait = delays[attempt] ?? 0
        if (wait > 0) {
            log(
                `CLI probe attempt ${attempt + 1}/${delays.length} after ${wait}ms backoff`,
                'debug'
            )
            await delay(wait)
        }

        const { result, failureReasons } = await probeOnce(ordered)
        if (result.available) {
            if (attempt > 0) {
                log(`CLI detected on retry attempt ${attempt + 1}`, 'info')
            }
            return result
        }
        lastFailureReasons = failureReasons
    }

    const errorMsg =
        'Obsidian CLI binary not found. Tried: ' +
        ordered.join(', ') +
        (lastFailureReasons.length > 0 ? ` | reasons: ${lastFailureReasons.join('; ')}` : '') +
        (delays.length > 1 ? ` | attempts: ${delays.length}` : '')
    log(errorMsg, 'warn')
    return {
        available: false,
        binaryPath: '',
        version: '',
        error: errorMsg
    }
}

function describeFailure(result: CandidateResponse): string {
    if (result.errorMessage) {
        const stderrSuffix = result.stderr ? ` | stderr: ${result.stderr}` : ''
        const stdoutSuffix = result.stdout ? ` | stdout: ${result.stdout}` : ''
        return `${result.errorMessage}${stderrSuffix}${stdoutSuffix}`
    }
    if (!result.stdout) {
        return 'empty stdout'
    }
    return `unrecognized version output: ${result.stdout}`
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
