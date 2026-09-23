/**
 * Test-only helper: parse a JSON response body captured from a mock
 * `ServerResponse` into the production API response types. Never import this
 * from production code.
 */
import type { ApiResponse } from '../src/app/domain/api-response'

export function parseApiResponse<T extends ApiResponse = ApiResponse>(raw: string): T {
    return JSON.parse(raw) as T
}
