import type { IncomingMessage, ServerResponse } from 'node:http'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { z } from 'zod/v4'
import { getAllCommands, commandToMcpToolName } from '../domain/cli-command-registry'
import { executeCli } from './cli-executor'
import type { CliAvailabilityResult } from './cli-availability-checker'
import type { PluginSettings } from '../types/plugin-settings.intf'
import { log } from '../../utils/log'

export interface McpServerContext {
    settings: PluginSettings
    cliStatus: CliAvailabilityResult
}

/**
 * MCP server wrapper that registers one tool per Obsidian CLI command.
 * Uses WebStandard StreamableHTTP transport on the /mcp path.
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

    private registerTools(): void {
        const commands = getAllCommands()

        for (const def of commands) {
            const toolName = commandToMcpToolName(def.command)

            this.mcpServer.registerTool(
                toolName,
                {
                    title: def.command,
                    description: `[${def.category}] ${def.description}`,
                    inputSchema: z.object({
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
                    // Check if command is blocked
                    if (this.context.settings.blockedCommands.includes(def.command)) {
                        return {
                            content: [
                                {
                                    type: 'text' as const,
                                    text: JSON.stringify({
                                        ok: false,
                                        error: `Command is blocked: ${def.command}`
                                    })
                                }
                            ],
                            isError: true
                        }
                    }

                    // Check dangerous command
                    if (def.dangerous && !this.context.settings.allowDangerousCommands) {
                        return {
                            content: [
                                {
                                    type: 'text' as const,
                                    text: JSON.stringify({
                                        ok: false,
                                        error: `Dangerous command requires allowDangerousCommands setting: ${def.command}`
                                    })
                                }
                            ],
                            isError: true
                        }
                    }

                    // Check CLI availability
                    if (!this.context.cliStatus.available) {
                        return {
                            content: [
                                {
                                    type: 'text' as const,
                                    text: JSON.stringify({
                                        ok: false,
                                        error:
                                            'Obsidian CLI is not available: ' +
                                            this.context.cliStatus.error
                                    })
                                }
                            ],
                            isError: true
                        }
                    }

                    const vault = args.vault ?? this.context.settings.defaultVault ?? ''
                    const params = args.params ?? {}
                    const flags = args.flags ?? []

                    log(`MCP tool call: ${def.command}`, 'debug')

                    const result = await executeCli({
                        command: def.command,
                        params,
                        flags,
                        vault,
                        binaryPath: this.context.cliStatus.binaryPath,
                        timeout: this.context.settings.requestTimeout
                    })

                    const response = {
                        ok: result.exitCode === 0,
                        command: def.command,
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

        log(`Registered ${commands.length} MCP tools`, 'debug')
    }
}
