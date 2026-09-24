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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import WalletConnect from '@perawallet/walletconnect'

// Regression tests for the pnpm patch on @perawallet/walletconnect's
// SocketTransport. Unpatched, `close()` only closes the OPEN socket: a
// transport still connecting (`_nextSocket` pending, or its 1s retry timer
// armed) resurrects itself forever, so every teardown of a not-yet-open
// connector (abandonPairing, recreateConnector) leaked an immortal ~1s
// reconnect loop that starved fresh pairing sockets until app restart.
// These tests exercise the REAL SDK against a stubbed WebSocket — do not
// mock '@perawallet/walletconnect' here.

class FakeSocket {
    static instances: FakeSocket[] = []
    onopen: (() => void) | null = null
    onclose: (() => void) | null = null
    onerror: ((event?: unknown) => void) | null = null
    onmessage: ((event?: unknown) => void) | null = null
    readyState = 0
    constructor(public url: string) {
        FakeSocket.instances.push(this)
    }
    send(): void {}
    close(): void {
        this.readyState = 3
        this.onclose?.()
    }
    /** Bridge accepted the connection. */
    open(): void {
        this.readyState = 1
        this.onopen?.()
    }
}

const CLIENT_META = {
    name: 'Pera Wallet',
    description: 'test',
    url: 'https://perawallet.app',
    icons: [],
}

const PAIRING_URI =
    'wc:11e14bd1-1a1a-4bc2-9c3d-0e5b1c1e14bd@1?bridge=https%3A%2F%2Fbridge.example.org&key=aa11'

const newPairingConnector = (): WalletConnect =>
    new WalletConnect({ uri: PAIRING_URI, clientMeta: CLIENT_META })

describe('SocketTransport close (pnpm patch regression)', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        FakeSocket.instances = []
        vi.stubGlobal('WebSocket', FakeSocket)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.useRealTimers()
    })

    it('stops the reconnect loop of a transport whose socket never opened', async () => {
        const connector = newPairingConnector()
        expect(FakeSocket.instances.length).toBe(1)

        // Dead bridge: the connect attempt fails, arming the 1s retry.
        FakeSocket.instances[0].close()

        connector.transportClose()

        const socketsAtClose = FakeSocket.instances.length
        await vi.advanceTimersByTimeAsync(60_000)

        expect(FakeSocket.instances.length).toBe(socketsAtClose)
    })

    it('stops the reconnect loop of a transport closed mid-connect', async () => {
        const connector = newPairingConnector()

        // No close event at all: the socket just hangs in CONNECTING, so
        // only the transport's own 10s connect timeout would recycle it.
        connector.transportClose()

        const socketsAtClose = FakeSocket.instances.length
        await vi.advanceTimersByTimeAsync(60_000)

        expect(FakeSocket.instances.length).toBe(socketsAtClose)
    })

    it('still reconnects a transport that was NOT closed', async () => {
        newPairingConnector()
        FakeSocket.instances[0].close()

        await vi.advanceTimersByTimeAsync(60_000)

        // Guard against overshooting with the fix: an un-closed transport
        // must keep trying to reach the bridge.
        expect(FakeSocket.instances.length).toBeGreaterThan(1)
    })

    it('backs off exponentially between reconnect attempts to a dead bridge', async () => {
        newPairingConnector()
        FakeSocket.instances[0].close()

        // First retry after 1s.
        await vi.advanceTimersByTimeAsync(1000)
        expect(FakeSocket.instances.length).toBe(2)
        FakeSocket.instances[1].close()

        // Second retry backs off to 2s: nothing new after only 1s.
        await vi.advanceTimersByTimeAsync(1000)
        expect(FakeSocket.instances.length).toBe(2)
        await vi.advanceTimersByTimeAsync(1000)
        expect(FakeSocket.instances.length).toBe(3)
        FakeSocket.instances[2].close()

        // Third retry backs off to 4s.
        await vi.advanceTimersByTimeAsync(3000)
        expect(FakeSocket.instances.length).toBe(3)
        await vi.advanceTimersByTimeAsync(1000)
        expect(FakeSocket.instances.length).toBe(4)
    })

    it('a successful open resets the reconnect backoff', async () => {
        newPairingConnector()
        FakeSocket.instances[0].close()
        await vi.advanceTimersByTimeAsync(1000)
        FakeSocket.instances[1].close()
        await vi.advanceTimersByTimeAsync(2000)
        expect(FakeSocket.instances.length).toBe(3)

        // Bridge comes back, then the live socket drops: the next retry
        // must be back at 1s, not the escalated delay.
        FakeSocket.instances[2].open()
        FakeSocket.instances[2].close()
        await vi.advanceTimersByTimeAsync(1000)
        expect(FakeSocket.instances.length).toBe(4)
    })

    it('a closed transport ignores later send-triggered socket creation', async () => {
        const connector = newPairingConnector()
        FakeSocket.instances[0].close()
        connector.transportClose()
        const socketsAtClose = FakeSocket.instances.length

        // approveSession/sendCustomRequest paths call _socketSend, which
        // recreates the socket when it is not open — a closed transport
        // must swallow that instead of resurrecting.
        ;(
            connector as unknown as {
                _transport: {
                    send: (m: string, t: string, s: boolean) => void
                }
            }
        )._transport.send('{}', 'topic', true)
        await vi.advanceTimersByTimeAsync(60_000)

        expect(FakeSocket.instances.length).toBe(socketsAtClose)
    })
})
