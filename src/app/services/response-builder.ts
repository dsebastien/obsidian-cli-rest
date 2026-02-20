import type { ServerResponse } from 'node:http'
import type { ApiErrorResponse, ApiSuccessResponse } from '../domain/api-response'

/**
 * Send a JSON success response.
 */
export function sendSuccess(
    res: ServerResponse,
    data: Omit<ApiSuccessResponse, 'ok'>,
    enableCors: boolean
): void {
    const body: ApiSuccessResponse = { ok: true, ...data }
    sendJson(res, 200, body, enableCors)
}

/**
 * Send a JSON error response.
 */
export function sendError(
    res: ServerResponse,
    statusCode: number,
    error: string,
    enableCors: boolean,
    extra?: Partial<ApiErrorResponse>
): void {
    const body: ApiErrorResponse = { ok: false, error, ...extra }
    sendJson(res, statusCode, body, enableCors)
}

/**
 * Send a JSON response with the given status code.
 */
function sendJson(
    res: ServerResponse,
    statusCode: number,
    body: unknown,
    enableCors: boolean
): void {
    setCorsHeaders(res, enableCors)
    res.writeHead(statusCode, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(body))
}

/**
 * Set CORS headers if enabled.
 */
export function setCorsHeaders(res: ServerResponse, enableCors: boolean): void {
    if (enableCors) {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    }
}

/**
 * Handle CORS preflight (OPTIONS) requests.
 * Returns true if the request was handled, false otherwise.
 */
export function handleCorsPreflightIfNeeded(
    res: ServerResponse,
    method: string,
    enableCors: boolean
): boolean {
    if (method === 'OPTIONS' && enableCors) {
        setCorsHeaders(res, true)
        res.writeHead(204)
        res.end()
        return true
    }
    return false
}
