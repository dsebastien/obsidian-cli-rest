import type { IncomingMessage, ServerResponse } from 'node:http'
import { URL } from 'node:url'
import type { CliAvailabilityResult } from './cli-availability-checker'
import { executeCli } from './cli-executor'
import { parseJsonBody, parseQueryString } from './request-parser'
import { sendError, sendSuccess, sendJson, sendHtml } from './response-builder'
import {
    getCommandDefinition,
    getAllCommands,
    urlPathToCommand,
    isDangerousPattern,
    INTERNAL_COMMANDS
} from '../domain/cli-command-registry'
import { generateOpenApiSpec, generateDocsHtml } from './openapi-generator'
import type { CliCommandDefinition } from '../domain/cli-command'
import type { PluginSettings } from '../types/plugin-settings.intf'

const API_PREFIX = '/api/v1'
const CLI_PREFIX = `${API_PREFIX}/cli/`

export interface RouterContext {
    settings: PluginSettings
    cliStatus: CliAvailabilityResult
}

/**
 * Route an incoming REST API request.
 * Returns true if the request was handled, false if not matched.
 */
export async function routeRequest(
    req: IncomingMessage,
    res: ServerResponse,
    ctx: RouterContext
): Promise<boolean> {
    const method = req.method ?? 'GET'
    const parsedUrl = new URL(req.url ?? '/', `http://${req.headers['host'] ?? 'localhost'}`)
    const pathname = parsedUrl.pathname

    // Health check
    if (pathname === `${API_PREFIX}/health`) {
        sendSuccess(
            res,
            {
                command: 'health',
                exitCode: 0,
                stdout: JSON.stringify({
                    status: 'ok',
                    cli: {
                        available: ctx.cliStatus.available,
                        version: ctx.cliStatus.version,
                        binaryPath: ctx.cliStatus.binaryPath
                    },
                    server: {
                        port: ctx.settings.port,
                        bindAddress: ctx.settings.bindAddress,
                        restEnabled: ctx.settings.enableRestApi,
                        mcpEnabled: ctx.settings.enableMcp
                    }
                }),
                stderr: '',
                duration: 0
            },
            ctx.settings.enableCors
        )
        return true
    }

    // List commands
    if (pathname === `${API_PREFIX}/commands`) {
        const commands = getAllCommands().map((cmd) => ({
            command: cmd.command,
            httpMethod: cmd.httpMethod,
            category: cmd.category,
            dangerous: cmd.dangerous,
            description: cmd.description
        }))
        sendSuccess(
            res,
            {
                command: 'commands',
                exitCode: 0,
                stdout: JSON.stringify(commands),
                stderr: '',
                duration: 0
            },
            ctx.settings.enableCors
        )
        return true
    }

    // OpenAPI spec (JSON)
    if (pathname === `${API_PREFIX}/openapi.json`) {
        const baseUrl = `http://${ctx.settings.bindAddress}:${ctx.settings.port}`
        const spec = generateOpenApiSpec(baseUrl)
        sendJson(res, 200, spec, ctx.settings.enableCors)
        return true
    }

    // API docs (Scalar UI)
    if (pathname === `${API_PREFIX}/docs`) {
        const specUrl = `http://${ctx.settings.bindAddress}:${ctx.settings.port}${API_PREFIX}/openapi.json`
        const html = generateDocsHtml(specUrl)
        sendHtml(res, html, ctx.settings.enableCors)
        return true
    }

    // CLI command proxy
    if (pathname.startsWith(CLI_PREFIX)) {
        if (!ctx.settings.enableRestApi) {
            sendError(res, 404, 'REST API is disabled', ctx.settings.enableCors)
            return true
        }

        const commandPath = pathname.slice(CLI_PREFIX.length)
        const command = urlPathToCommand(commandPath)

        return await handleCliCommand(req, res, method, command, ctx)
    }

    return false
}

async function handleCliCommand(
    req: IncomingMessage,
    res: ServerResponse,
    method: string,
    command: string,
    ctx: RouterContext
): Promise<boolean> {
    let def: CliCommandDefinition | undefined = getCommandDefinition(command)

    if (!def) {
        // Pass-through: allow unknown commands via POST only with safe defaults
        if (method !== 'POST') {
            sendError(
                res,
                405,
                `Method ${method} not allowed for unregistered command: ${command}. Only POST is accepted`,
                ctx.settings.enableCors
            )
            return true
        }
        def = {
            command,
            httpMethod: 'POST',
            category: 'discovered',
            dangerous: isDangerousPattern(command),
            description: `Unregistered CLI command: ${command}`
        }
    }

    // Check HTTP method (POST is always allowed as universal fallback)
    if (method !== 'POST' && method !== def.httpMethod) {
        sendError(
            res,
            405,
            `Method ${method} not allowed for ${command}. Use ${def.httpMethod} or POST`,
            ctx.settings.enableCors
        )
        return true
    }

    // Check if command is blocked
    if (ctx.settings.blockedCommands.includes(command)) {
        sendError(res, 403, `Command is blocked: ${command}`, ctx.settings.enableCors)
        return true
    }

    // Check dangerous command
    if (def.dangerous && !ctx.settings.allowDangerousCommands) {
        sendError(
            res,
            403,
            `Dangerous command requires allowDangerousCommands setting: ${command}`,
            ctx.settings.enableCors
        )
        return true
    }

    // Handle internal commands (no CLI binary needed)
    if (INTERNAL_COMMANDS.has(command)) {
        return handleInternalCommand(res, command, ctx)
    }

    // Check CLI availability
    if (!ctx.cliStatus.available) {
        sendError(
            res,
            503,
            'Obsidian CLI is not available: ' + ctx.cliStatus.error,
            ctx.settings.enableCors
        )
        return true
    }

    // Parse request
    let params: Record<string, string>
    let flags: string[]
    let vault: string

    try {
        if (method === 'GET') {
            const parsed = parseQueryString(
                req.url ?? '/',
                `http://${req.headers['host'] ?? 'localhost'}`
            )
            params = parsed.params
            flags = parsed.flags
            vault = parsed.vault
        } else {
            const parsed = await parseJsonBody(req)
            params = parsed.params
            flags = parsed.flags
            vault = parsed.vault
        }
    } catch {
        sendError(res, 400, 'Malformed request body', ctx.settings.enableCors)
        return true
    }

    // Use default vault if not specified
    if (!vault && ctx.settings.defaultVault) {
        vault = ctx.settings.defaultVault
    }

    // Execute CLI command
    const result = await executeCli({
        command,
        params,
        flags,
        vault,
        binaryPath: ctx.cliStatus.binaryPath,
        timeout: ctx.settings.requestTimeout
    })

    if (result.exitCode === 0) {
        sendSuccess(
            res,
            {
                command,
                exitCode: result.exitCode,
                stdout: result.stdout,
                stderr: result.stderr,
                duration: result.duration
            },
            ctx.settings.enableCors
        )
    } else {
        sendError(
            res,
            422,
            `CLI command returned non-zero exit code: ${result.exitCode}`,
            ctx.settings.enableCors,
            {
                command,
                exitCode: result.exitCode,
                stdout: result.stdout,
                stderr: result.stderr,
                duration: result.duration
            }
        )
    }

    return true
}

function handleInternalCommand(res: ServerResponse, command: string, ctx: RouterContext): boolean {
    let stdout: string

    switch (command) {
        case 'cli-rest:rest-url':
            stdout = `http://${ctx.settings.bindAddress}:${ctx.settings.port}/api/v1`
            break
        case 'cli-rest:mcp-url':
            stdout = `http://${ctx.settings.bindAddress}:${ctx.settings.port}/mcp`
            break
        case 'cli-rest:docs-url':
            stdout = `http://${ctx.settings.bindAddress}:${ctx.settings.port}/api/v1/docs`
            break
        default:
            sendError(res, 500, `Unknown internal command: ${command}`, ctx.settings.enableCors)
            return true
    }

    sendSuccess(
        res,
        {
            command,
            exitCode: 0,
            stdout,
            stderr: '',
            duration: 0
        },
        ctx.settings.enableCors
    )
    return true
}
