import { describe, expect, test } from 'bun:test'
import { ServerController, type StartableServer } from './server-controller'
import { registerServer, registeredServer } from './server-registry'

/** A fake server whose bind can be held open to model a start in flight. */
const makeServer = (options: { holdStart?: boolean } = {}) => {
    let releaseStart: () => void = () => {}
    const startGate = options.holdStart
        ? new Promise<void>((resolve) => {
              releaseStart = resolve
          })
        : Promise.resolve()
    const server = {
        isRunning: false,
        starts: 0,
        stops: 0,
        async start(): Promise<void> {
            server.starts += 1
            await startGate
            server.isRunning = true
        },
        stop(): Promise<void> {
            server.stops += 1
            server.isRunning = false
            return Promise.resolve()
        }
    }
    return { server, releaseStart: () => releaseStart() }
}

type FakeServer = ReturnType<typeof makeServer>['server'] & StartableServer

describe('ServerController', () => {
    test('start binds, records the server and returns it', async () => {
        const host = {}
        const controller = new ServerController<FakeServer>(host)
        const { server } = makeServer()
        expect(await controller.start(() => server)).toBe(server)
        expect(server.isRunning).toBe(true)
        expect(controller.server).toBe(server)
        expect(registeredServer(host)).toBe(server)
    })

    test('a bind that completes after dispose is stopped at once and never recorded', async () => {
        const host = {}
        const controller = new ServerController<FakeServer>(host)
        const { server, releaseStart } = makeServer({ holdStart: true })
        const starting = controller.start(() => server)
        for (let tick = 0; server.starts === 0 && tick < 100; tick += 1) {
            await Promise.resolve()
        }
        expect(server.starts).toBe(1) // the bind is in flight
        await controller.dispose() // unload now
        releaseStart()
        expect(await starting).toBe(null)
        expect(server.isRunning).toBe(false)
        expect(server.stops).toBe(1)
        expect(controller.server).toBe(null)
        expect(registeredServer(host)).toBeUndefined()
    })

    test("an unloaded instance's late start cannot stop the live instance's server", async () => {
        // The failure seen in the vault: instance A is unloaded while its
        // auto-start still retries; instance B starts; A's retry must neither
        // stop B's server nor replace B's record.
        const host = {}
        const a = new ServerController<FakeServer>(host)
        await a.dispose()
        const b = new ServerController<FakeServer>(host)
        const { server: bServer } = makeServer()
        await b.start(() => bServer)

        const { server: aServer } = makeServer()
        expect(await a.start(() => aServer)).toBe(null)
        expect(aServer.starts).toBe(0)
        expect(bServer.isRunning).toBe(true)
        expect(bServer.stops).toBe(0)
        expect(registeredServer(host)).toBe(bServer)
    })

    test('a server left running by a dead owner is stopped before the new one binds', async () => {
        const host = {}
        const { server: orphan } = makeServer()
        await orphan.start()
        registerServer(orphan, () => false, host)

        const controller = new ServerController<FakeServer>(host)
        const { server } = makeServer()
        await controller.start(() => server)
        expect(orphan.isRunning).toBe(false)
        expect(orphan.stops).toBe(1)
        expect(registeredServer(host)).toBe(server)
    })

    test('a start disposed before it could bind creates no server at all', async () => {
        const host = {}
        const controller = new ServerController<FakeServer>(host)
        const { server } = makeServer()
        const starting = controller.start(() => server)
        await controller.dispose()
        expect(await starting).toBe(null)
        expect(server.starts).toBe(0)
        expect(registeredServer(host)).toBeUndefined()
    })

    test("a live instance's server is never stopped by another live instance", async () => {
        // Two loaded copies sharing the window (a dev build installed under
        // another plugin id, say): neither may stop the other's server.
        const host = {}
        const first = new ServerController<FakeServer>(host)
        const { server: firstServer } = makeServer()
        await first.start(() => firstServer)

        const second = new ServerController<FakeServer>(host)
        const { server: secondServer } = makeServer()
        await second.start(() => secondServer)
        expect(firstServer.isRunning).toBe(true)
        expect(firstServer.stops).toBe(0)
    })

    test('restarting stops the previous server of the same instance first', async () => {
        const host = {}
        const controller = new ServerController<FakeServer>(host)
        const { server: first } = makeServer()
        const { server: second } = makeServer()
        await controller.start(() => first)
        await controller.start(() => second)
        expect(first.isRunning).toBe(false)
        expect(second.isRunning).toBe(true)
        expect(registeredServer(host)).toBe(second)
    })

    test('stop and dispose clear the record', async () => {
        const host = {}
        const controller = new ServerController<FakeServer>(host)
        const { server } = makeServer()
        await controller.start(() => server)
        await controller.dispose()
        expect(server.isRunning).toBe(false)
        expect(registeredServer(host)).toBeUndefined()
        expect(controller.isDisposed).toBe(true)
    })
})
