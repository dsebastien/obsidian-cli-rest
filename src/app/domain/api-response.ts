export interface ApiSuccessResponse {
    ok: true
    command: string
    exitCode: number
    stdout: string
    stderr: string
    duration: number
}

export interface ApiErrorResponse {
    ok: false
    error: string
    command?: string
    exitCode?: number
    stdout?: string
    stderr?: string
    duration?: number
}

export type ApiResponse = ApiSuccessResponse | ApiErrorResponse
