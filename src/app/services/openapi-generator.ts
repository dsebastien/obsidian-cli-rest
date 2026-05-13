import { getAllCommands, commandToUrlPath, getCategories } from '../domain/cli-command-registry'
import type { CliCommandDefinition } from '../domain/cli-command'

/**
 * Dynamically generate an OpenAPI 3.1.0 specification from the command registry.
 * Includes both static and runtime-discovered commands.
 */
export function generateOpenApiSpec(baseUrl: string): Record<string, unknown> {
    const commands = getAllCommands()
    const categories = getCategories()

    return {
        openapi: '3.1.0',
        info: {
            title: 'CLI REST MCP API',
            description:
                'RESTful API that proxies Obsidian CLI commands. ' +
                'All CLI command endpoints accept POST as a universal fallback method. ' +
                'Commands marked as dangerous require the `allowDangerousCommands` setting to be enabled.',
            version: '0.1.0',
            license: {
                name: 'MIT',
                url: 'https://github.com/dsebastien/obsidian-cli-rest/blob/main/LICENSE'
            }
        },
        servers: [{ url: baseUrl, description: 'Local CLI REST MCP server' }],
        tags: [...categories].sort().map((cat) => ({ name: cat, description: `${cat} commands` })),
        paths: buildPaths(commands),
        components: buildComponents()
    }
}

function buildPaths(commands: readonly CliCommandDefinition[]): Record<string, unknown> {
    const paths: Record<string, unknown> = {}

    // Health check
    paths['/api/v1/health'] = {
        get: {
            tags: ['server'],
            summary: 'Health check',
            description:
                'Returns server status including CLI availability, version, and server configuration. No authentication required.',
            operationId: 'getHealth',
            responses: {
                '200': { $ref: '#/components/responses/SuccessResponse' }
            }
        }
    }

    // Command list
    paths['/api/v1/commands'] = {
        get: {
            tags: ['server'],
            summary: 'List available commands',
            description:
                'Returns all registered CLI commands with their HTTP method, category, danger level, and description. ' +
                'Includes both static and dynamically discovered commands. No authentication required.',
            operationId: 'listCommands',
            responses: {
                '200': { $ref: '#/components/responses/SuccessResponse' }
            }
        }
    }

    // CLI command endpoints (sorted alphabetically by command name)
    const sorted = [...commands].sort((a, b) => a.command.localeCompare(b.command))
    for (const cmd of sorted) {
        const urlPath = `/api/v1/cli/${commandToUrlPath(cmd.command)}`
        const pathItem: Record<string, unknown> = {}

        // Primary method
        const primaryOp = buildOperation(cmd, cmd.httpMethod)
        pathItem[cmd.httpMethod.toLowerCase()] = primaryOp

        // POST fallback (if primary isn't already POST)
        if (cmd.httpMethod !== 'POST') {
            pathItem['post'] = buildOperation(cmd, 'POST', true)
        }

        paths[urlPath] = pathItem
    }

    return paths
}

function buildOperation(
    cmd: CliCommandDefinition,
    method: string,
    isFallback = false
): Record<string, unknown> {
    const operationId = isFallback
        ? `${sanitizeOperationId(cmd.command)}_post`
        : sanitizeOperationId(cmd.command)

    const description = buildOperationDescription(cmd, method, isFallback)

    const op: Record<string, unknown> = {
        tags: [cmd.category],
        summary: cmd.description,
        description,
        operationId,
        security: [{ bearerAuth: [] }],
        responses: buildResponses(cmd)
    }

    if (method === 'GET') {
        op['parameters'] = buildQueryParameters()
    } else {
        op['requestBody'] = {
            required: false,
            content: {
                'application/json': {
                    schema: { $ref: '#/components/schemas/CliRequestBody' }
                }
            }
        }
    }

    return op
}

function buildOperationDescription(
    cmd: CliCommandDefinition,
    method: string,
    isFallback: boolean
): string {
    const parts: string[] = []

    if (isFallback) {
        parts.push('POST fallback for this command.')
    }

    parts.push(`CLI command: \`${cmd.command}\``)

    if (cmd.dangerous) {
        parts.push('**Dangerous**: Requires `allowDangerousCommands` setting to be enabled.')
    }

    if (method === 'GET') {
        parts.push('Parameters are passed via query string.')
    } else {
        parts.push('Parameters are passed via JSON request body.')
    }

    return parts.join(' ')
}

function buildQueryParameters(): Record<string, unknown>[] {
    return [
        {
            name: 'vault',
            in: 'query',
            required: false,
            description: 'Target vault name. Falls back to the configured default vault.',
            schema: { type: 'string' }
        },
        {
            name: 'flags',
            in: 'query',
            required: false,
            description: 'Comma-separated CLI flags (e.g., `total,verbose`).',
            schema: { type: 'string' }
        }
    ]
}

function buildResponses(cmd: CliCommandDefinition): Record<string, unknown> {
    const responses: Record<string, unknown> = {
        '200': { $ref: '#/components/responses/SuccessResponse' },
        '400': { $ref: '#/components/responses/BadRequestResponse' },
        '401': { $ref: '#/components/responses/UnauthorizedResponse' },
        '422': { $ref: '#/components/responses/CliErrorResponse' },
        '500': { $ref: '#/components/responses/InternalErrorResponse' },
        '503': { $ref: '#/components/responses/CliUnavailableResponse' }
    }

    if (cmd.dangerous) {
        responses['403'] = { $ref: '#/components/responses/ForbiddenResponse' }
    }

    return responses
}

function buildComponents(): Record<string, unknown> {
    return {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                description:
                    'API key authentication. Pass the key via `Authorization: Bearer <key>` header.'
            }
        },
        schemas: {
            CliRequestBody: {
                type: 'object',
                properties: {
                    vault: {
                        type: 'string',
                        description:
                            'Target vault name. Falls back to the configured default vault if omitted.'
                    },
                    params: {
                        type: 'object',
                        additionalProperties: { type: 'string' },
                        description:
                            'Key-value pairs passed as CLI arguments (e.g., `{"name": "myProp", "value": "test"}`).'
                    },
                    flags: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'CLI flags to pass (e.g., `["update", "verbose"]`).'
                    }
                }
            },
            ApiSuccessResponse: {
                type: 'object',
                required: ['ok', 'command', 'exitCode', 'stdout', 'stderr', 'duration'],
                properties: {
                    ok: { type: 'boolean', const: true },
                    command: { type: 'string', description: 'The executed CLI command name.' },
                    exitCode: { type: 'integer', description: 'CLI process exit code.' },
                    stdout: { type: 'string', description: 'Standard output from the CLI.' },
                    stderr: { type: 'string', description: 'Standard error from the CLI.' },
                    duration: {
                        type: 'integer',
                        description: 'Execution duration in milliseconds.'
                    }
                }
            },
            ApiErrorResponse: {
                type: 'object',
                required: ['ok', 'error'],
                properties: {
                    ok: { type: 'boolean', const: false },
                    error: { type: 'string', description: 'Error message.' },
                    command: { type: 'string', description: 'The CLI command that was attempted.' },
                    exitCode: {
                        type: 'integer',
                        nullable: true,
                        description: 'CLI exit code, if available.'
                    },
                    stdout: {
                        type: 'string',
                        nullable: true,
                        description: 'Standard output, if available.'
                    },
                    stderr: {
                        type: 'string',
                        nullable: true,
                        description: 'Standard error, if available.'
                    },
                    duration: {
                        type: 'integer',
                        nullable: true,
                        description: 'Duration in milliseconds, if available.'
                    }
                }
            }
        },
        responses: {
            SuccessResponse: {
                description: 'Successful operation',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/ApiSuccessResponse' }
                    }
                }
            },
            BadRequestResponse: {
                description: 'Malformed request (invalid JSON body or missing required parameters)',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/ApiErrorResponse' }
                    }
                }
            },
            UnauthorizedResponse: {
                description: 'Missing or invalid API key',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/ApiErrorResponse' }
                    }
                }
            },
            ForbiddenResponse: {
                description:
                    'Command is blocked or dangerous command requires `allowDangerousCommands` setting',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/ApiErrorResponse' }
                    }
                }
            },
            CliErrorResponse: {
                description: 'CLI command returned a non-zero exit code',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/ApiErrorResponse' }
                    }
                }
            },
            InternalErrorResponse: {
                description: 'Unexpected server error',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/ApiErrorResponse' }
                    }
                }
            },
            CliUnavailableResponse: {
                description: 'Obsidian CLI binary is not installed or not accessible',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/ApiErrorResponse' }
                    }
                }
            }
        }
    }
}

/**
 * Sanitize a CLI command name into a valid OpenAPI operationId.
 * e.g., "property:set" → "property_set"
 */
function sanitizeOperationId(command: string): string {
    return command.replace(/[^a-zA-Z0-9]/g, '_')
}

/**
 * Generate the Scalar API Reference HTML page.
 */
export function generateDocsHtml(specUrl: string): string {
    return `<!doctype html>
<html>
<head>
    <title>CLI REST MCP API</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
    <div id="app"></div>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
    <script>
      Scalar.createApiReference('#app', {
        url: '${specUrl}',
        agent: { disabled: true },
        telemetry: false,
        hideClientButton: true,
        customCss: '.api-reference-toolbar { display: none !important; }',
      })
    </script>
</body>
</html>`
}
