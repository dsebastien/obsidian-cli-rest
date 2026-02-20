import { createServer } from 'node:http'
import type { Server, IncomingMessage, ServerResponse } from 'node:http'
import { validateAuth } from './auth-middleware'
import { handleCorsPreflightIfNeeded, sendError } from './response-builder'
import { routeRequest } from './request-router'
import type { RouterContext } from './request-router'
import { log } from '../../utils/log'

export interface HttpServerOptions {
    port: number
    bindAddress: string
    apiKey: string
    enableCors: boolean
    context: RouterContext
    mcpHandler?: (req: IncomingMessage, res: ServerResponse) => Promise<void>
}

/**
 * Creates and manages the HTTP server that handles both REST API and MCP requests.
 */
export class HttpServerWrapper {
    private server: Server | null = null
    private options: HttpServerOptions

    constructor(options: HttpServerOptions) {
        this.options = options
    }

    /**
     * Start the HTTP server.
     */
    async start(): Promise<void> {
        if (this.server) {
            await this.stop()
        }

        this.server = createServer((req, res) => {
            void this.handleRequest(req, res)
        })

        return new Promise((resolve, reject) => {
            const server = this.server
            if (!server) {
                reject(new Error('Server not created'))
                return
            }

            server.on('error', (err: Error & { code?: string }) => {
                if (err.code === 'EADDRINUSE') {
                    log(`Port ${this.options.port} is already in use`, 'error')
                }
                reject(err)
            })

            server.listen(this.options.port, this.options.bindAddress, () => {
                log(
                    `HTTP server listening on ${this.options.bindAddress}:${this.options.port}`,
                    'info'
                )
                resolve()
            })
        })
    }

    /**
     * Stop the HTTP server.
     */
    async stop(): Promise<void> {
        const server = this.server
        if (!server) {
            return
        }

        // Force-close all active connections so the port is freed immediately
        server.closeAllConnections()

        return new Promise((resolve) => {
            server.close(() => {
                log('HTTP server stopped', 'info')
                this.server = null
                resolve()
            })
        })
    }

    /**
     * Whether the server is currently running.
     */
    get isRunning(): boolean {
        return this.server !== null && this.server.listening
    }

    /**
     * Get the server's bound address, or null if not listening.
     */
    get address(): { port: number; address: string } | null {
        if (!this.server) {
            return null
        }
        const addr = this.server.address()
        if (!addr || typeof addr === 'string') {
            return null
        }
        return { port: addr.port, address: addr.address }
    }

    /**
     * Update the MCP handler reference.
     */
    setMcpHandler(
        handler: ((req: IncomingMessage, res: ServerResponse) => Promise<void>) | undefined
    ): void {
        this.options.mcpHandler = handler
    }

    /**
     * Update the router context (e.g., after settings change).
     */
    updateContext(context: RouterContext): void {
        this.options.context = context
    }

    private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
        const method = req.method ?? 'GET'
        const url = req.url ?? '/'

        log(`${method} ${url}`, 'debug')

        try {
            // Handle CORS preflight
            if (handleCorsPreflightIfNeeded(res, method, this.options.enableCors)) {
                return
            }

            // MCP endpoint: /mcp
            if (url.startsWith('/mcp')) {
                if (!this.options.context.settings.enableMcp) {
                    sendError(res, 404, 'MCP server is disabled', this.options.enableCors)
                    return
                }

                // Auth check for MCP
                if (!validateAuth(req, this.options.apiKey)) {
                    sendError(res, 401, 'Invalid or missing API key', this.options.enableCors)
                    return
                }

                if (this.options.mcpHandler) {
                    await this.options.mcpHandler(req, res)
                    return
                }

                sendError(res, 503, 'MCP server not initialized', this.options.enableCors)
                return
            }

            // REST API endpoints: /api/v1/*
            if (url.startsWith('/api/v1/')) {
                // Health and commands endpoints skip auth
                const isPublicEndpoint =
                    url.startsWith('/api/v1/health') || url.startsWith('/api/v1/commands')

                if (!isPublicEndpoint) {
                    if (!validateAuth(req, this.options.apiKey)) {
                        sendError(res, 401, 'Invalid or missing API key', this.options.enableCors)
                        return
                    }
                }

                const handled = await routeRequest(req, res, this.options.context)
                if (!handled) {
                    sendError(res, 404, 'Not found', this.options.enableCors)
                }
                return
            }

            // Unknown path
            sendError(res, 404, 'Not found', this.options.enableCors)
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Internal server error'
            log(`Request error: ${message}`, 'error')
            sendError(res, 500, message, this.options.enableCors)
        }
    }
}
