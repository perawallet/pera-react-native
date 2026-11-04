/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { createHash } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { Duplex } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Core } from '@walletconnect/core'

const HANDSHAKE_DELAY_MS = 300
const CONNECT_TIMEOUT_MS = 100
const REASON = 'Unauthorized: origin not allowed'

// A relay that is slower to upgrade than core's connect timeout, then refuses
// the origin with 3000, as Reown's relay does for a bundle id off the allowlist.
const startRefusingRelay = async () => {
    const sockets: Duplex[] = []
    let closesSent = 0
    const server: Server = createServer()
    server.on('upgrade', (request, socket) => {
        sockets.push(socket)
        setTimeout(() => {
            const accept = createHash('sha1')
                .update(
                    `${request.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`,
                )
                .digest('base64')
            socket.write(
                'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\n' +
                    `Connection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`,
            )
            const payload = Buffer.concat([
                Buffer.from([0x0b, 0xb8]),
                Buffer.from(REASON),
            ])
            socket.write(
                Buffer.concat([Buffer.from([0x88, payload.length]), payload]),
            )
            closesSent += 1
        }, HANDSHAKE_DELAY_MS)
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    return {
        url: `ws://127.0.0.1:${(server.address() as AddressInfo).port}`,
        closesSent: () => closesSent,
        stop: () => {
            for (const socket of sockets) socket.destroy()
            server.close()
        },
    }
}

const createMemoryStorage = () => {
    const entries = new Map<string, unknown>()
    return {
        getKeys: async () => [...entries.keys()],
        getEntries: async () => [...entries.entries()],
        getItem: async (key: string) => entries.get(key),
        setItem: async (key: string, value: unknown) => {
            entries.set(key, value)
        },
        removeItem: async (key: string) => {
            entries.delete(key)
        },
    }
}

describe('relay refusing the origin', () => {
    const cleanups: (() => unknown)[] = []

    afterEach(async () => {
        for (const cleanup of cleanups.splice(0)) await cleanup()
    })

    // The throw lands in a socket callback, outside the test's own frames, so
    // vitest is what catches it: it fails the run with an unhandled error.
    it('does not throw when a timed-out attempt is refused with 3000', async () => {
        const relay = await startRefusingRelay()
        cleanups.push(relay.stop)
        process.env.DISABLE_GLOBAL_CORE = 'true'
        cleanups.push(() => delete process.env.DISABLE_GLOBAL_CORE)
        const core = new Core({
            projectId: 'test',
            relayUrl: relay.url,
            storage: createMemoryStorage(),
            logger: 'silent',
        })
        // Not on IRelayer's type; read on every connect attempt. Lowered so
        // each attempt times out while the relay is still upgrading, which is
        // what leaves the previous attempt's socket without listeners.
        ;(
            core.relayer as unknown as { connectTimeout: number }
        ).connectTimeout = CONNECT_TIMEOUT_MS
        await core.start()
        cleanups.push(() => core.relayer.transportClose().catch(() => {}))

        void core.relayer.subscribe('a'.repeat(64)).catch(() => {})

        await vi.waitFor(() => expect(relay.closesSent()).toBeGreaterThan(1), {
            timeout: 5000,
        })
        // Lets the refused sockets' close events reach the client.
        await new Promise(resolve => setTimeout(resolve, 200))
    })
})
