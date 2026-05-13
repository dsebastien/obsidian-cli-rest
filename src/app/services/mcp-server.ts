import type { IncomingMessage, ServerResponse } from 'node:http'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { z } from 'zod/v4'
import {
    getCommandDefinition,
    searchCommands,
    isDangerousPattern,
    INTERNAL_COMMANDS
} from '../domain/cli-command-registry'
import { executeCli } from './cli-executor'
import type { CliAvailabilityResult } from './cli-availability-checker'
import type { PluginSettings } from '../types/plugin-settings.intf'
import { log } from '../../utils/log'

export interface McpServerContext {
    settings: PluginSettings
    cliStatus: CliAvailabilityResult
    /**
     * Optional self-heal callback. If `cliStatus.available` is false when a
     * tool call arrives, the server calls this once and uses the returned
     * result for the request. Recovers from a stale negative detection
     * caused by an IPC race during Obsidian startup.
     */
    recheckCli?: () => Promise<CliAvailabilityResult>
}

/**
 * MCP server wrapper using the Code Mode pattern (2 tools: search + execute).
 * Uses WebStandard StreamableHTTP transport on the /mcp path.
 *
 * Instead of registering one tool per CLI command (113+), we register exactly
 * two generic tools that enable progressive discovery. This keeps the MCP tool
 * count fixed regardless of how many commands exist.
 *
 * We use WebStandardStreamableHTTPServerTransport directly (instead of
 * the Node.js StreamableHTTPServerTransport wrapper) because the
 * @hono/node-server conversion layer is incompatible with Electron's
 * Node.js environment.
 */
export class McpServerWrapper {
    private mcpServer: McpServer
    private context: McpServerContext

    constructor(context: McpServerContext) {
        this.context = context
        this.mcpServer = new McpServer(
            {
                name: 'obsidian-cli-rest',
                version: '0.1.0'
            },
            {
                capabilities: {
                    tools: {}
                }
            }
        )

        this.registerTools()
    }

    /**
     * Handle an incoming MCP HTTP request.
     * Creates a stateless transport per request, converts Node.js
     * req/res to Web Standard Request/Response.
     */
    async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
        const transport = new WebStandardStreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
            enableJsonResponse: true
        })

        await this.mcpServer.connect(transport)

        try {
            // Parse body for POST requests
            let parsedBody: unknown
            if (req.method === 'POST') {
                parsedBody = await this.collectRequestBody(req)
            }

            // Build a Web Standard Request from Node.js IncomingMessage
            const webRequest = this.toWebRequest(req)

            const webResponse = await transport.handleRequest(webRequest, { parsedBody })

            // Write the Web Standard Response back to the Node.js ServerResponse
            await this.writeWebResponse(res, webResponse)
        } finally {
            await transport.close()
        }
    }

    /**
     * Update the context (e.g., after settings or CLI status change).
     */
    updateContext(context: McpServerContext): void {
        this.context = context
    }

    /**
     * Close the MCP server.
     */
    async close(): Promise<void> {
        await this.mcpServer.close()
    }

    /**
     * Collect the request body as a parsed JSON object.
     */
    private collectRequestBody(req: IncomingMessage): Promise<unknown> {
        return new Promise((resolve, reject) => {
            let data = ''
            req.on('data', (chunk: Buffer) => {
                data += chunk.toString()
            })
            req.on('end', () => {
                if (!data) {
                    resolve(undefined)
                    return
                }
                try {
                    resolve(JSON.parse(data))
                } catch {
                    reject(new Error('Invalid JSON in request body'))
                }
            })
            req.on('error', reject)
        })
    }

    /**
     * Convert a Node.js IncomingMessage to a Web Standard Request.
     * Body is not included since we pass parsedBody separately.
     */
    private toWebRequest(req: IncomingMessage): Request {
        const host = req.headers['host'] ?? 'localhost'
        const url = `http://${host}${req.url ?? '/'}`

        return new Request(url, {
            method: req.method ?? 'GET',
            headers: this.toWebHeaders(req)
        })
    }

    /**
     * Convert Node.js headers to Web Standard Headers.
     */
    private toWebHeaders(req: IncomingMessage): Headers {
        const headers = new Headers()
        for (const [key, value] of Object.entries(req.headers)) {
            if (value === undefined) {
                continue
            }
            if (Array.isArray(value)) {
                for (const v of value) {
                    headers.append(key, v)
                }
            } else {
                headers.set(key, value)
            }
        }
        return headers
    }

    /**
     * Write a Web Standard Response back to a Node.js ServerResponse.
     */
    private async writeWebResponse(res: ServerResponse, webResponse: Response): Promise<void> {
        const headers: Record<string, string> = {}
        webResponse.headers.forEach((value, key) => {
            headers[key] = value
        })
        res.writeHead(webResponse.status, headers)

        const body = await webResponse.text()
        if (body) {
            res.write(body)
        }

        res.end()
    }

    /**
     * Register exactly 2 MCP tools following the Code Mode pattern:
     * - `search`: Progressive discovery of available commands
     * - `execute`: Run any Obsidian CLI command
     *
     * This keeps the MCP tool count fixed regardless of how many CLI commands exist.
     */
    private registerTools(): void {
        this.registerSearchTool()
        this.registerExecuteTool()
        log('Registered 2 MCP tools (Code Mode pattern)', 'debug')
    }

    private registerSearchTool(): void {
        this.mcpServer.registerTool(
            'search',
            {
                title: 'Search commands',
                description: [
                    'Discover available Obsidian CLI commands.',
                    'Call with no arguments to get an overview of all commands and categories.',
                    'Use "category" to filter by category (e.g., "daily", "files", "search").',
                    'Use "query" to find commands by name or description (case-insensitive substring match).',
                    'Both filters can be combined.',
                    '',
                    'Typical workflow:',
                    '1. search() — overview of categories',
                    '2. search(category: "daily") — commands in a category',
                    '3. execute(command: "help", params: { command: "daily:append" }) — parameter details',
                    '4. execute(command: "daily:append", params: { content: "Hello" }) — run it'
                ].join('\n'),
                inputSchema: z.object({
                    query: z
                        .string()
                        .optional()
                        .describe(
                            'Search term to match against command names and descriptions (case-insensitive)'
                        ),
                    category: z
                        .string()
                        .optional()
                        .describe(
                            'Filter by exact category name (e.g., "daily", "files", "search")'
                        )
                })
            },
            (args) => {
                const result = searchCommands({
                    query: args.query,
                    category: args.category
                })

                // Filter out blocked commands from results
                const filteredCommands = result.commands.filter(
                    (cmd) => !this.context.settings.blockedCommands.includes(cmd.command)
                )

                const response = {
                    commands: filteredCommands.map((cmd) => ({
                        command: cmd.command,
                        category: cmd.category,
                        description: cmd.description,
                        dangerous: cmd.dangerous
                    })),
                    total: filteredCommands.length,
                    categories: result.categories
                }

                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: JSON.stringify(response)
                        }
                    ],
                    isError: false
                }
            }
        )
    }

    private registerExecuteTool(): void {
        this.mcpServer.registerTool(
            'execute',
            {
                title: 'Execute command',
                description: [
                    'Execute an Obsidian CLI command.',
                    'Commands use colon notation (e.g., "daily:append", "property:set").',
                    'Use the "search" tool first to discover available commands.',
                    '',
                    'Examples:',
                    '  execute(command: "version") — Obsidian version',
                    '  execute(command: "read", params: { file: "notes/todo.md" }) — read a file',
                    '  execute(command: "daily:append", params: { content: "New entry" }) — append to daily note',
                    '  execute(command: "search", params: { query: "meeting" }) — search vault',
                    '  execute(command: "help", params: { command: "append" }) — get help for a command'
                ].join('\n'),
                inputSchema: z.object({
                    command: z
                        .string()
                        .describe(
                            'CLI command to execute (e.g., "daily:append", "read", "search")'
                        ),
                    vault: z.string().optional().describe('Target vault name'),
                    params: z
                        .record(z.string(), z.string())
                        .optional()
                        .describe('Key-value parameters for the CLI command'),
                    flags: z
                        .array(z.string())
                        .optional()
                        .describe('Boolean flags for the CLI command')
                })
            },
            async (args) => {
                const command = args.command

                // Check if command is blocked
                if (this.context.settings.blockedCommands.includes(command)) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify({
                                    ok: false,
                                    error: `Command is blocked: ${command}`
                                })
                            }
                        ],
                        isError: true
                    }
                }

                // Look up command definition (may be undefined for unknown/discovered commands)
                const def = getCommandDefinition(command)
                const isDangerous = def ? def.dangerous : isDangerousPattern(command)

                // Check dangerous command
                if (isDangerous && !this.context.settings.allowDangerousCommands) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify({
                                    ok: false,
                                    error: `Dangerous command requires allowDangerousCommands setting: ${command}`
                                })
                            }
                        ],
                        isError: true
                    }
                }

                // Handle internal commands (no CLI binary needed)
                if (INTERNAL_COMMANDS.has(command)) {
                    return this.handleInternalCommand(command)
                }

                // Check CLI availability — self-heal first if a recheck
                // callback is wired. Initial detection can race with
                // sibling-plugin init during Obsidian startup; re-probing on
                // first failing tool call typically resolves it without user
                // intervention.
                let cliStatus = this.context.cliStatus
                if (!cliStatus.available && this.context.recheckCli) {
                    cliStatus = await this.context.recheckCli()
                }
                if (!cliStatus.available) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify({
                                    ok: false,
                                    error: 'Obsidian CLI is not available: ' + cliStatus.error
                                })
                            }
                        ],
                        isError: true
                    }
                }

                const vault = args.vault ?? this.context.settings.defaultVault ?? ''
                const params = args.params ?? {}
                const flags = args.flags ?? []

                log(`MCP tool call: ${command}`, 'debug')

                const result = await executeCli({
                    command,
                    params,
                    flags,
                    vault,
                    binaryPath: cliStatus.binaryPath,
                    timeout: this.context.settings.requestTimeout
                })

                const response = {
                    ok: result.exitCode === 0,
                    command,
                    exitCode: result.exitCode,
                    stdout: result.stdout,
                    stderr: result.stderr,
                    duration: result.duration
                }

                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: JSON.stringify(response)
                        }
                    ],
                    isError: result.exitCode !== 0
                }
            }
        )
    }

    private handleInternalCommand(command: string): {
        content: Array<{ type: 'text'; text: string }>
        isError: boolean
    } {
        let stdout: string

        switch (command) {
            case 'cli-rest:rest-url':
                stdout = `http://${this.context.settings.bindAddress}:${this.context.settings.port}/api/v1`
                break
            case 'cli-rest:mcp-url':
                stdout = `http://${this.context.settings.bindAddress}:${this.context.settings.port}/mcp`
                break
            case 'cli-rest:docs-url':
                stdout = `http://${this.context.settings.bindAddress}:${this.context.settings.port}/api/v1/docs`
                break
            default:
                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: JSON.stringify({
                                ok: false,
                                error: `Unknown internal command: ${command}`
                            })
                        }
                    ],
                    isError: true
                }
        }

        return {
            content: [
                {
                    type: 'text' as const,
                    text: JSON.stringify({
                        ok: true,
                        command,
                        exitCode: 0,
                        stdout,
                        stderr: '',
                        duration: 0
                    })
                }
            ],
            isError: false
        }
    }
}
