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
import { Networks } from '@perawallet/wallet-core-shared'
import { bindHeadlessHandlers } from '../bindHeadlessHandlers'

// The repo-wide unit-test setup stubs '@perawallet/wallet-core-walletconnect'
// down to a handful of hook exports (it exists to keep integration tests off
// the real WC socket). This binder needs the real pure helpers
// (isChainIdAcceptable, gateSignTxnRequest, gateSignDataRequest,
// ALL_PERMISSIONS), so this file opts back into the real module instead of
// editing the shared mock.
vi.mock('@perawallet/wallet-core-walletconnect', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-walletconnect')
        >()
    return actual
})

// The repo-wide stub of '@perawallet/wallet-core-shared' is also missing
// `utf8ByteLength`/`decodeFromBase64`, which the real gate's ARC-60 size
// check (`assertArc60RequestWithinLimits`, exercised by the algo_signData
// spoof test below) needs. Opt back into the real module here too — same
// reasoning as `algoSignDataGateApprovalParity.test.ts`.
vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return actual
})

type Listener = (error: Error | null, payload?: unknown) => void

const makeConnector = () => {
    const listeners = new Map<string, Listener>()
    return {
        clientId: 'client-1',
        chainId: 416_001,
        version: 1,
        bridge: 'https://bridge.example',
        connected: true,
        session: undefined,
        listeners,
        on: vi.fn((event: string, listener: Listener) => {
            listeners.set(event, listener)
        }),
        off: vi.fn(),
        approveSession: vi.fn(),
        rejectSession: vi.fn(),
        killSession: vi.fn(() => Promise.resolve()),
        rejectRequest: vi.fn(),
        approveRequest: vi.fn(),
        transportClose: vi.fn(),
        emit: (event: string, error: Error | null, payload?: unknown) =>
            listeners.get(event)?.(error, payload),
    }
}

const makeDeps = () => ({
    network: () => Networks.mainnet,
    knownAddresses: () => ['AAAA'],
    // Default: as if a session for this connector was already approved and
    // persisted for mainnet — the normal state by the time a dApp can send
    // algo_signTxn/algo_signData at all.
    sessionChainId: vi.fn((_clientId: string): number | undefined => 416_001),
    onSessionRequest: vi.fn(),
    onSignRequest: vi.fn(),
    onDisconnect: vi.fn(),
    onNetworkMismatch: vi.fn(),
})

describe('bindHeadlessHandlers', () => {
    let connector: ReturnType<typeof makeConnector>
    let deps: ReturnType<typeof makeDeps>

    beforeEach(() => {
        connector = makeConnector()
        deps = makeDeps()
        bindHeadlessHandlers(connector, deps)
    })

    it('forwards an acceptable session_request', () => {
        connector.emit('session_request', null, {
            params: [
                {
                    peerMeta: { name: 'dApp' },
                    chainId: 416_001,
                    permissions: ['algo_signTxn'],
                },
            ],
        })

        expect(deps.onSessionRequest).toHaveBeenCalledWith({
            clientId: 'client-1',
            chainId: 416_001,
            permissions: ['algo_signTxn'],
            peerMeta: { name: 'dApp' },
        })
    })

    it('rejects a session_request for the wrong network without forwarding', () => {
        connector.emit('session_request', null, {
            params: [{ peerMeta: {}, chainId: 416_002 }],
        })

        expect(connector.rejectSession).toHaveBeenCalled()
        expect(deps.onSessionRequest).not.toHaveBeenCalled()
    })

    it('reports the network mismatch with the details the host needs to resolve a pair-outcome AND name both networks to the user', () => {
        const peerMeta = { url: 'https://dapp.example', name: 'dApp' }
        connector.emit('session_request', null, {
            params: [{ peerMeta, chainId: 416_002 }],
        })

        // chainId and peerMeta ride along because the host also raises a
        // user-facing notice for this case, which names the chain that was
        // asked for and the app that asked.
        expect(deps.onNetworkMismatch).toHaveBeenCalledWith({
            clientId: 'client-1',
            chainId: 416_002,
            peerMeta,
        })
    })

    it('forwards a gate-passing algo_signTxn request', () => {
        connector.emit('algo_signTxn', null, {
            id: 7,
            params: [[{ txn: 'dHhu', signers: ['AAAA'] }]],
        })

        expect(deps.onSignRequest).toHaveBeenCalledWith({
            clientId: 'client-1',
            wcRequestId: 7,
            method: 'algo_signTxn',
            payload: { id: 7, params: [[{ txn: 'dHhu', signers: ['AAAA'] }]] },
        })
    })

    it('rejects a gate-failing algo_signTxn without opening anything', () => {
        connector.emit('algo_signTxn', null, {
            id: 8,
            params: [[{ txn: 'dHhu', signers: ['ZZZZ'] }]],
        })

        expect(connector.rejectRequest).toHaveBeenCalledWith(
            expect.objectContaining({ id: 8 }),
        )
        expect(deps.onSignRequest).not.toHaveBeenCalled()
    })

    it('rejects an algo_signTxn when there is no persisted session chainId for this clientId (pre-handshake), without forwarding', () => {
        const unapprovedConnector = makeConnector()
        const unapprovedDeps = makeDeps()
        unapprovedDeps.sessionChainId = vi.fn(() => undefined)
        bindHeadlessHandlers(unapprovedConnector, unapprovedDeps)

        unapprovedConnector.emit('algo_signTxn', null, {
            id: 9,
            params: [[{ txn: 'dHhu', signers: ['AAAA'] }]],
        })

        expect(unapprovedConnector.rejectRequest).toHaveBeenCalledWith(
            expect.objectContaining({ id: 9 }),
        )
        expect(unapprovedDeps.onSignRequest).not.toHaveBeenCalled()
    })

    // The gate must read the *persisted* session record
    // (`deps.sessionChainId`), never the live connector's mutable `chainId`
    // field. WC v1's `wc_sessionUpdate` lets the dApp peer rewrite a
    // connected connector's `chainId` with no authorization — a spoofed
    // update setting it to `4160` (AlgorandChainId.all, the wildcard) would
    // make `isChainIdAcceptable` accept every network if this gate ever
    // consulted the live value. Nothing rewrites the persisted record on
    // that message, so it stays the ground truth.
    it('rejects a sign request using the persisted session chainId even after the live connector.chainId is spoofed to the wildcard', () => {
        const spoofedDeps = makeDeps()
        // Persisted record says this session was approved for testnet — the
        // wrong network while `deps.network()` reports mainnet.
        spoofedDeps.sessionChainId = vi.fn(() => 416_002)
        bindHeadlessHandlers(connector, spoofedDeps)
        // A `wc_sessionUpdate {approved:true, chainId:4160}` from the dApp
        // peer would land here — always-acceptable if the gate read this.
        connector.chainId = 4160

        connector.emit('algo_signTxn', null, {
            id: 20,
            params: [[{ txn: 'dHhu', signers: ['AAAA'] }]],
        })

        expect(connector.rejectRequest).toHaveBeenCalledWith(
            expect.objectContaining({ id: 20 }),
        )
        expect(spoofedDeps.onSignRequest).not.toHaveBeenCalled()
    })

    // Symmetric to the algo_signTxn spoof test above: algo_signData goes
    // through its own `deps.sessionChainId(connector.clientId)` call site in
    // `bindHeadlessHandlers.ts`, so it needs its own pin against the same
    // wc_sessionUpdate spoof — reverting only that call site back to
    // `connector.chainId` would otherwise leave this class of request
    // unguarded while every other test in this suite stayed green.
    it('rejects an algo_signData request using the persisted session chainId even after the live connector.chainId is spoofed to the wildcard', () => {
        const spoofedDeps = makeDeps()
        // Persisted record says this session was approved for testnet — the
        // wrong network while `deps.network()` reports mainnet.
        spoofedDeps.sessionChainId = vi.fn(() => 416_002)
        bindHeadlessHandlers(connector, spoofedDeps)
        // A `wc_sessionUpdate {approved:true, chainId:4160}` from the dApp
        // peer would land here — always-acceptable if the gate read this.
        connector.chainId = 4160

        connector.emit('algo_signData', null, {
            id: 21,
            // A payload shape that otherwise passes every other check in
            // `gateSignDataRequest` (mirrors the fixture in
            // `algoSignDataGateApprovalParity.test.ts`) — so the only thing
            // that can make this test pass is the chainId check itself, not
            // an unrelated schema rejection.
            params: {
                data: 'ZGF0YQ==',
                signer: 'AAAA',
                domain: 'example.com',
                authenticatorData: 'ZGF0YQ==',
                metadata: { scope: 1, encoding: 'base64' },
            },
        })

        expect(connector.rejectRequest).toHaveBeenCalledWith(
            expect.objectContaining({ id: 21 }),
        )
        expect(spoofedDeps.onSignRequest).not.toHaveBeenCalled()
    })

    it('drops an algo_signTxn with no numeric request id instead of calling rejectRequest', () => {
        expect(() => {
            connector.emit('algo_signTxn', null, {
                params: [[{ txn: 'dHhu', signers: ['AAAA'] }]],
            })
        }).not.toThrow()

        expect(connector.rejectRequest).not.toHaveBeenCalled()
        expect(deps.onSignRequest).not.toHaveBeenCalled()
    })

    it('reports a disconnect', () => {
        connector.emit('disconnect', null)
        expect(deps.onDisconnect).toHaveBeenCalledWith('client-1')
    })

    it('clears previous listeners so re-binding is safe', () => {
        expect(connector.off).toHaveBeenCalledWith('algo_signTxn')
        expect(connector.off).toHaveBeenCalledWith('session_request')
    })
})
