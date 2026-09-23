import {
    registerServer,
    stopOrphanedServer,
    unregisterServer,
    type StoppableServer
} from './server-registry'

export interface StartableServer extends StoppableServer {
    start(): Promise<void>
}

/**
 * Owns one plugin instance's HTTP server across its lifecycle.
 *
 * Obsidian cannot await onunload, and the plugin's auto-start runs in the
 * background with retries, so a start can still be in flight when the
 * instance is unloaded. Every step of start therefore re-checks `disposed`:
 * a disposed controller never stops another server, never records one, and
 * stops at once a server whose bind completes after dispose. Without that,
 * an unloaded instance could bind the port with its stale settings (its API
 * key included) after the next instance had started, and keep it while the
 * plugin was disabled.
 */
export class ServerController<S extends StartableServer> {
    private current: S | null = null
    private disposed = false

    constructor(private readonly host: object = window) {}

    get server(): S | null {
        return this.current
    }

    get isDisposed(): boolean {
        return this.disposed
    }

    /** Starts a server from `create`; null when disposed before it could run. */
    async start(create: () => S): Promise<S | null> {
        await this.stop()
        if (this.disposed) {
            return null
        }
        await stopOrphanedServer(this.host)
        if (this.disposed) {
            return null
        }
        const server = create()
        await server.start()
        if (this.disposed) {
            await server.stop()
            return null
        }
        this.current = server
        registerServer(server, () => !this.disposed, this.host)
        return server
    }

    async stop(): Promise<void> {
        const server = this.current
        if (!server) {
            return
        }
        this.current = null
        await server.stop()
        unregisterServer(server, this.host)
    }

    /** Called on unload: nothing this controller does afterwards binds or records. */
    dispose(): Promise<void> {
        this.disposed = true
        return this.stop()
    }
}
