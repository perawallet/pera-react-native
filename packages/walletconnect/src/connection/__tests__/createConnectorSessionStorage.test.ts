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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createWalletConnectConnector } from '../createConnector'

// `../../constants` re-exports signing limits from this package, whose
// import chain pulls in react-native-mmkv (unavailable under jsdom) — same
// workaround as `createConnector.test.ts` and `sessionOutcome.test.ts`.
vi.mock('@perawallet/wallet-core-signing', () => ({
    MAX_DATA_SIGN_REQUESTS: 10,
    MAX_TRANSACTION_SIGN_REQUESTS: 64,
    ARC60_MAX_REQUEST_BYTES: 64 * 1024,
}))

// Deliberately does NOT mock '@perawallet/walletconnect' the way
// createConnector.test.ts does — this suite exists specifically to exercise
// the real SDK's own session-storage read path (`this.session = opts.session
// || this._getStorageSession()`, run unconditionally in the constructor),
// which only the real class has. Constructing the real class from a `uri`
// does not open a live socket in jsdom (no DNS/WebSocket happens
// synchronously), so this is safe to run without network mocking.
const WALLETCONNECT_STORAGE_KEY = 'walletconnect'

describe('createWalletConnectConnector — session storage isolation', () => {
    beforeEach(() => {
        window.localStorage.clear()
    })

    it('never adopts a stale session left in window.localStorage by a prior pairing', () => {
        // Reproduces the exact state the SDK's own default `SessionStorage`
        // would leave behind after some earlier connector called
        // `approveSession` (which internally calls `_setStorageSession()`)
        // while that default was in effect — seeded directly here so the
        // test never depends on a live transport.
        window.localStorage.setItem(
            WALLETCONNECT_STORAGE_KEY,
            JSON.stringify({
                connected: true,
                accounts: ['ATTACKER'],
                chainId: 4160,
                bridge: 'https://bridge-stale.example',
                key: 'stale-key',
                clientId: 'client-STALE',
                clientMeta: null,
                peerId: 'peer-STALE',
                peerMeta: null,
                handshakeId: 1,
                handshakeTopic: 'topic-stale',
            }),
        )

        const connector = createWalletConnectConnector({
            uri: 'wc:topic-fresh@1?bridge=https%3A%2F%2Fbridge-fresh.example&key=00',
        })

        expect(connector.clientId).not.toBe('client-STALE')
        expect(connector.session.handshakeTopic).toBe('topic-fresh')
        expect(connector.session.bridge).toBe('https://bridge-fresh.example')
        expect(connector.session.connected).toBe(false)
    })

    it('produces two distinct clientIds and handshake topics across two sequential pairings, even with a stale third session sitting in storage', () => {
        window.localStorage.setItem(
            WALLETCONNECT_STORAGE_KEY,
            JSON.stringify({
                connected: true,
                accounts: ['ATTACKER'],
                chainId: 4160,
                bridge: 'https://bridge-stale.example',
                key: 'stale-key',
                clientId: 'client-STALE',
                clientMeta: null,
                peerId: 'peer-STALE',
                peerMeta: null,
                handshakeId: 1,
                handshakeTopic: 'topic-stale',
            }),
        )

        const connectorA = createWalletConnectConnector({
            uri: 'wc:topic-a@1?bridge=https%3A%2F%2Fbridge-a.example&key=00',
        })
        const connectorB = createWalletConnectConnector({
            uri: 'wc:topic-b@1?bridge=https%3A%2F%2Fbridge-b.example&key=01',
        })

        expect(connectorA.clientId).not.toBe(connectorB.clientId)
        expect(connectorA.session.handshakeTopic).toBe('topic-a')
        expect(connectorB.session.handshakeTopic).toBe('topic-b')
        expect(connectorA.session.bridge).toBe('https://bridge-a.example')
        expect(connectorB.session.bridge).toBe('https://bridge-b.example')
    })
})
