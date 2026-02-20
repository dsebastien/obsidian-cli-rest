import type { HttpMethod } from './http-method'

export interface CliCommandDefinition {
    command: string
    httpMethod: HttpMethod
    category: string
    dangerous: boolean
    description: string
}
