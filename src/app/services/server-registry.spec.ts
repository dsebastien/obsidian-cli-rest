import { describe, expect, test } from 'bun:test'
import {
    registerServer,
    registeredServer,
    stopOrphanedServer,
    unregisterServer,
    type StoppableServer
} from './server-registry'

export const fakeServer = (running = true): StoppableServer & { stops: number } => {
    const server = {
        isRunning: running,
        stops: 0,
        stop(): Promise<void> {
            server.stops += 1
            server.isRunning = false
            return Promise.resolve()
        }
    }
    return server
}

const alive = () => true
const dead = () => false

describe('server registry', () => {
    test('the record uses a registry-wide symbol, which a re-evaluated module finds again', () => {
        // Each plugin reload re-evaluates main.js, so a fresh module computes
        // its key again: Symbol.for returns the same symbol, a plain Symbol
        // would not.
        const host: Record<symbol, { server: unknown } | undefined> = {}
        const fromOldInstance = fakeServer()
        registerServer(fromOldInstance, dead, host)
        expect(host[Symbol.for('cli-rest-mcp/http-server')]?.server).toBe(fromOldInstance)
        expect(registeredServer(host)).toBe(fromOldInstance)
    })

    test('a running server whose owner is gone is stopped and forgotten', async () => {
        const host = {}
        const orphan = fakeServer()
        registerServer(orphan, dead, host)
        expect(await stopOrphanedServer(host)).toBe(true)
        expect(orphan.stops).toBe(1)
        expect(registeredServer(host)).toBeUndefined()
    })

    test('a server whose owner is alive is never touched', async () => {
        const host = {}
        const live = fakeServer()
        registerServer(live, alive, host)
        expect(await stopOrphanedServer(host)).toBe(false)
        expect(live.stops).toBe(0)
        expect(registeredServer(host)).toBe(live)
    })

    test('a dead owner whose server already stopped is forgotten without a second stop', async () => {
        const host = {}
        const stopped = fakeServer(false)
        registerServer(stopped, dead, host)
        expect(await stopOrphanedServer(host)).toBe(false)
        expect(stopped.stops).toBe(0)
        expect(registeredServer(host)).toBeUndefined()
    })

    test('nothing recorded means nothing to stop', async () => {
        expect(await stopOrphanedServer({})).toBe(false)
    })

    test('unregistering a server that was replaced leaves the newer record alone', () => {
        const host = {}
        const older = fakeServer()
        const newer = fakeServer()
        registerServer(older, alive, host)
        registerServer(newer, alive, host)
        unregisterServer(older, host)
        expect(registeredServer(host)).toBe(newer)
        unregisterServer(newer, host)
        expect(registeredServer(host)).toBeUndefined()
    })
})
