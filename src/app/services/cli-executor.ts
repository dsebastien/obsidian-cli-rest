import { execFile } from 'node:child_process'
import { log } from '../../utils/log'

export interface CliExecutionResult {
    stdout: string
    stderr: string
    exitCode: number
    duration: number
}

export interface CliExecutionOptions {
    command: string
    params: Record<string, string>
    flags: string[]
    vault: string
    binaryPath: string
    timeout: number
}

/**
 * Strip Obsidian startup noise from CLI output.
 * The CLI prepends lines like:
 *   "2026-02-21 11:44:14 Loading updated app package /home/.../.config/obsidian/obsidian-1.12.2.asar"
 */
const CLI_NOISE_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} Loading updated app package .+\n?/gm

function stripCliNoise(output: string): string {
    return output.replace(CLI_NOISE_PATTERN, '')
}

/**
 * Execute an Obsidian CLI command via child_process.execFile.
 * Uses execFile (not exec) to prevent shell injection.
 */
export function executeCli(options: CliExecutionOptions): Promise<CliExecutionResult> {
    const { command, params, flags, vault, binaryPath, timeout } = options

    const args: string[] = []

    // Add vault if specified
    if (vault) {
        args.push(`vault=${vault}`)
    }

    // Add the command
    args.push(command)

    // Add key=value params
    for (const [key, value] of Object.entries(params)) {
        args.push(`${key}=${value}`)
    }

    // Add boolean flags
    for (const flag of flags) {
        args.push(flag)
    }

    log(`Executing CLI: ${binaryPath} ${args.join(' ')}`, 'debug')
    const startTime = performance.now()

    return new Promise((resolve) => {
        execFile(
            binaryPath,
            args,
            { timeout, maxBuffer: 10 * 1024 * 1024 },
            (error, stdout, stderr) => {
                const duration = Math.round(performance.now() - startTime)
                const exitCode = error && 'code' in error ? (error.code as number) : error ? 1 : 0

                if (error) {
                    log(`CLI error (exit ${exitCode}): ${stderr || error.message}`, 'debug')
                }

                resolve({
                    stdout: stripCliNoise(stdout ?? ''),
                    stderr: stripCliNoise(stderr ?? ''),
                    exitCode,
                    duration
                })
            }
        )
    })
}
