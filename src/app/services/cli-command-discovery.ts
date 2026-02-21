import { execFile } from 'node:child_process'
import { log } from '../../utils/log'

/**
 * A command discovered from `obsidian help` output.
 */
export interface DiscoveredCommand {
    command: string
    description: string
    section: 'commands' | 'developer'
}

/**
 * Regex matching a command line in `obsidian help` output.
 * Command lines have exactly 2-space indent, then the command name,
 * followed by 2+ spaces and the description.
 * e.g., "  aliases               List aliases in the vault"
 */
const COMMAND_LINE_RE = /^ {2}(\S+) {2,}(.+)$/

/**
 * Parse the output of `obsidian help` into discovered commands.
 *
 * The help output format (CLI 1.12.2+):
 * ```
 * Commands:
 *   aliases               List aliases in the vault
 *     file=<name>         - File name
 *   ...
 * Developer:
 *   dev:cdp               Run a Chrome DevTools Protocol command
 *     ...
 * ```
 *
 * Command lines: 2-space indent + name + 2+ spaces + description.
 * Parameter sub-lines: deeper indent (4+ spaces), skipped.
 * Section headers: "Commands:" or "Developer:" at start of line.
 */
export function parseHelpOutput(stdout: string): DiscoveredCommand[] {
    const commands: DiscoveredCommand[] = []
    let inSection = false
    let currentSection: 'commands' | 'developer' = 'commands'

    for (const line of stdout.split('\n')) {
        // Detect section headers
        if (/^Commands:/i.test(line)) {
            inSection = true
            currentSection = 'commands'
            continue
        }
        if (/^Developer:/i.test(line)) {
            inSection = true
            currentSection = 'developer'
            continue
        }

        if (!inSection) {
            continue
        }

        // Skip blank lines
        if (line.trim() === '') {
            continue
        }

        // Match command lines (2-space indent)
        const match = COMMAND_LINE_RE.exec(line)
        if (match) {
            const commandName = match[1]
            const description = match[2]
            if (commandName && description) {
                commands.push({
                    command: commandName,
                    description: description.trim(),
                    section: currentSection
                })
            }
        }
        // Lines with deeper indent (4+ spaces) are parameter sub-lines — skip
    }

    return commands
}

const DISCOVER_TIMEOUT_MS = 10_000

/**
 * Run `obsidian help` and parse the output to discover available CLI commands.
 * Returns an empty array on failure (graceful fallback).
 */
export function discoverCliCommands(
    binaryPath: string,
    timeout: number = DISCOVER_TIMEOUT_MS
): Promise<DiscoveredCommand[]> {
    return new Promise((resolve) => {
        execFile(binaryPath, ['help'], { timeout }, (error, stdout) => {
            if (error) {
                log(`CLI command discovery failed: ${error.message}`, 'warn')
                resolve([])
                return
            }

            try {
                const commands = parseHelpOutput(stdout)
                log(`Discovered ${commands.length} CLI commands from help output`, 'debug')
                resolve(commands)
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Unknown parse error'
                log(`Failed to parse CLI help output: ${msg}`, 'warn')
                resolve([])
            }
        })
    })
}
