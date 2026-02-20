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
                    stdout: stdout ?? '',
                    stderr: stderr ?? '',
                    exitCode,
                    duration
                })
            }
        )
    })
}
