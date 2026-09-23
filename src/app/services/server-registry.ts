/**
 * Where the running HTTP server is recorded, so that the next plugin instance
 * can find a server its predecessor left behind.
 *
 * Obsidian re-evaluates main.js on every plugin reload, so module state starts
 * empty in each new instance; the record lives on the window, under a
 * Symbol.for key that is the same across reloads. It carries whether the
 * owning instance is still alive: only a dead owner's server is an orphan. A
 * live owner's server is never touched, so an instance can never stop the
 * server of the instance that replaced it.
 */
export interface StoppableServer {
    readonly isRunning: boolean
    stop(): Promise<void>
}

interface ServerRecord {
    server: StoppableServer
    ownerAlive: () => boolean
}

const SERVER_KEY = Symbol.for('cli-rest-mcp/http-server')

type Host = Record<symbol, ServerRecord | undefined>

const hostOf = (host: object): Host => host as Host

/** The server currently recorded, if any. */
export function registeredServer(host: object = window): StoppableServer | undefined {
    return hostOf(host)[SERVER_KEY]?.server
}

export function registerServer(
    server: StoppableServer,
    ownerAlive: () => boolean,
    host: object = window
): void {
    hostOf(host)[SERVER_KEY] = { server, ownerAlive }
}

/** Clears the record, but only if it still points at `server`. */
export function unregisterServer(server: StoppableServer, host: object = window): void {
    if (hostOf(host)[SERVER_KEY]?.server === server) {
        hostOf(host)[SERVER_KEY] = undefined
    }
}

/**
 * Stops and forgets a server whose owning instance is gone. A server whose
 * owner is still alive is left alone. Returns true when a running orphan was
 * stopped.
 */
export async function stopOrphanedServer(host: object = window): Promise<boolean> {
    const record = hostOf(host)[SERVER_KEY]
    if (!record || record.ownerAlive()) {
        return false
    }
    unregisterServer(record.server, host)
    if (!record.server.isRunning) {
        return false
    }
    await record.server.stop()
    return true
}
