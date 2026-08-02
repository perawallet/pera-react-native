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
import { logger, Networks } from '@perawallet/wallet-core-shared'
import { WC_CONTROL_SCOPE } from '@perawallet/wallet-extension-platform-chrome'
import {
    __resetRegistryForTests,
    type WalletConnectConnection,
} from '@perawallet/wallet-core-walletconnect'
import { startWcHost, type WcApprovalRequest, type WcHostDeps } from '../wcHost'

// The repo-wide unit-test setup stubs '@perawallet/wallet-core-walletconnect'
// down to a handful of hook exports (it exists to keep integration tests off
// the real WC socket). This host needs the real registry + gate functions
// (registerConnector, getConnector, ensureConnectorReady,
// setConnectorHandlerBinder, isChainIdAcceptable, gateSignTxnRequest, …), so
// this file opts back into the real module — same pattern as
// bindHeadlessHandlers.test.ts.
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

/**
 * Minimal `WalletConnectConnection` fixture for revival tests — only the
 * fields `reviveStoredSessions` actually reads (`clientId`,
 * `session.clientId`). The real type's `session` is `IWalletConnectSession`,
 * which carries several fields these tests have no use for.
 */
const makeStoredConnection = (fields: {
    clientId?: string
    session?: { clientId?: string; peerId?: string; chainId?: number }
}): WalletConnectConnection => fields as unknown as WalletConnectConnection

const makeConnector = (
    clientId: string,
    overrides: { connected?: boolean } = {},
) => {
    const listeners = new Map<string, Listener>()
    return {
        clientId,
        chainId: 416_001,
        version: 1,
        bridge: 'https://bridge.example',
        session: { peerId: 'peer-1', chainId: 416_001 },
        connected: overrides.connected ?? true,
        // `ensureConnectorReady` (exercised for real by the delivery tests
        // below) reads this private-by-convention field to decide whether
        // the socket is already open. Without it the fast path is skipped
        // and the registry falls back to `recreateConnector`, whose
        // `waitForSocketOpen` polls `_transport.connected` on the
        // recreated connector until it flips true or the delivery timeout
        // elapses — `@perawallet/walletconnect` is aliased to
        // `walletconnect-client-stub.ts` in this project's vitest config,
        // so no real socket ever opens to flip it.
        _transport: { connected: true },
        listeners,
        on: vi.fn((event: string, listener: Listener) =>
            listeners.set(event, listener),
        ),
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

describe('startWcHost', () => {
    let created: ReturnType<typeof makeConnector>[]
    let requestApproval: ReturnType<
        typeof vi.fn<(input: WcApprovalRequest) => Promise<void>>
    >
    let persistConnection: ReturnType<
        typeof vi.fn<WcHostDeps['persistConnection']>
    >
    let removeConnection: ReturnType<
        typeof vi.fn<WcHostDeps['removeConnection']>
    >
    let sendPairOutcome: ReturnType<typeof vi.fn<WcHostDeps['sendPairOutcome']>>

    const start = (
        overrides: {
            storedConnections?: () => WalletConnectConnection[]
            createConnector?: WcHostDeps['createConnector']
        } = {},
    ) => {
        created = []
        requestApproval = vi.fn(() => Promise.resolve())
        persistConnection = vi.fn()
        removeConnection = vi.fn()
        sendPairOutcome = vi.fn(() => Promise.resolve())
        return startWcHost({
            network: () => Networks.mainnet,
            knownAddresses: () => ['AAAA', 'BBBB'],
            storedConnections: overrides.storedConnections ?? (() => []),
            requestApproval,
            persistConnection,
            removeConnection,
            sendPairOutcome,
            createConnector:
                overrides.createConnector ??
                (options => {
                    // Revive call sites pass the persisted session through;
                    // deriving the id from it (instead of always minting a
                    // counter-based one) lets revive tests assert the
                    // adopted connector matches the stored connection.
                    const clientId =
                        (options.session as { clientId?: string } | undefined)
                            ?.clientId ?? `client-${created.length + 1}`
                    const connector = makeConnector(clientId)
                    created.push(connector)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    return connector as any
                }),
        })
    }

    beforeEach(() => {
        vi.clearAllMocks()
        __resetRegistryForTests()
    })

    it('pairs on a pair control message and adopts the connector', () => {
        const host = start()

        const handled = host.handleControlMessage({
            scope: WC_CONTROL_SCOPE,
            kind: 'pair',
            uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
        })

        expect(handled).toBe(true)
        expect(created).toHaveLength(1)
        expect(created[0].on).toHaveBeenCalledWith(
            'session_request',
            expect.any(Function),
        )
    })

    it('requests a wc-connect approval when the dApp sends session_request', async () => {
        const host = start()
        host.handleControlMessage({
            scope: WC_CONTROL_SCOPE,
            kind: 'pair',
            uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
        })

        created[0].emit('session_request', null, {
            params: [
                {
                    peerMeta: { name: 'dApp', url: 'https://dapp.example' },
                    chainId: 416_001,
                },
            ],
        })

        expect(requestApproval).toHaveBeenCalledWith(
            expect.objectContaining({
                kind: 'wc-connect',
                clientId: 'client-1',
                chainId: 416_001,
            }),
        )
    })

    it('requests a wc-sign approval for a gate-passing request', () => {
        // The gate reads the *persisted* session chainId, not the live
        // connector's — so a signable request needs a stored record already
        // approved for this network, mirroring what a real approve-session
        // control message would have written before any dApp can send
        // algo_signTxn at all.
        const host = start({
            storedConnections: () => [
                makeStoredConnection({
                    clientId: 'client-1',
                    session: { clientId: 'client-1', chainId: 416_001 },
                }),
            ],
        })
        host.handleControlMessage({
            scope: WC_CONTROL_SCOPE,
            kind: 'pair',
            uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
        })

        created[0].emit('algo_signTxn', null, {
            id: 9,
            params: [[{ txn: 'dHhu', signers: ['AAAA'] }]],
        })

        expect(requestApproval).toHaveBeenCalledWith(
            expect.objectContaining({
                kind: 'wc-sign',
                wcRequestId: 9,
                method: 'algo_signTxn',
            }),
        )
    })

    it('does not request approval for a gate-failing request', () => {
        const host = start({
            storedConnections: () => [
                makeStoredConnection({
                    clientId: 'client-1',
                    session: { clientId: 'client-1', chainId: 416_001 },
                }),
            ],
        })
        host.handleControlMessage({
            scope: WC_CONTROL_SCOPE,
            kind: 'pair',
            uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
        })

        created[0].emit('algo_signTxn', null, {
            id: 10,
            params: [[{ txn: 'dHhu', signers: ['ZZZZ'] }]],
        })

        expect(requestApproval).not.toHaveBeenCalled()
        expect(created[0].rejectRequest).toHaveBeenCalled()
    })

    describe('sign-request gate reads the persisted session, not the live connector', () => {
        it('rejects a sign request after a wc_sessionUpdate-style spoof of the live connector.chainId, because the persisted record says otherwise', () => {
            // Persisted record: this session was approved for testnet — the
            // wrong network under this suite's `network: () => mainnet`.
            const host = start({
                storedConnections: () => [
                    makeStoredConnection({
                        clientId: 'client-1',
                        session: { clientId: 'client-1', chainId: 416_002 },
                    }),
                ],
            })
            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'pair',
                uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
            })

            // A `wc_sessionUpdate {approved:true, chainId:4160}` the dApp
            // peer can send unauthenticated (WC v1's
            // `_handleSessionResponse` applies it with no check) would land
            // here — 4160 is AlgorandChainId.all, the wildcard that
            // `isChainIdAcceptable` always accepts.
            created[0].chainId = 4160

            created[0].emit('algo_signTxn', null, {
                id: 30,
                params: [[{ txn: 'dHhu', signers: ['AAAA'] }]],
            })

            expect(created[0].rejectRequest).toHaveBeenCalledWith(
                expect.objectContaining({ id: 30 }),
            )
            expect(requestApproval).not.toHaveBeenCalled()
        })

        // Symmetric to the algo_signTxn spoof test above — algo_signData is
        // gated through its own `sessionChainId` lookup in
        // `bindHeadlessHandlers.ts`, wired through this host's own
        // `storedConnections`-backed `sessionChainId`, so it needs its own
        // coverage against the same spoofed-chainId scenario.
        it('rejects an algo_signData request after a wc_sessionUpdate-style spoof of the live connector.chainId, because the persisted record says otherwise', () => {
            const host = start({
                storedConnections: () => [
                    makeStoredConnection({
                        clientId: 'client-1',
                        session: { clientId: 'client-1', chainId: 416_002 },
                    }),
                ],
            })
            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'pair',
                uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
            })

            created[0].chainId = 4160

            created[0].emit('algo_signData', null, {
                id: 31,
                // A payload shape that otherwise passes every other check in
                // `gateSignDataRequest` (mirrors the fixture in
                // `algoSignDataGateApprovalParity.test.ts`) — so the only
                // thing that can make this test pass is the chainId check
                // itself, not an unrelated schema rejection.
                params: {
                    data: 'ZGF0YQ==',
                    signer: 'AAAA',
                    domain: 'example.com',
                    authenticatorData: 'ZGF0YQ==',
                    metadata: { scope: 1, encoding: 'base64' },
                },
            })

            expect(created[0].rejectRequest).toHaveBeenCalledWith(
                expect.objectContaining({ id: 31 }),
            )
            expect(requestApproval).not.toHaveBeenCalled()
        })
    })

    it('ignores a message from another scope', () => {
        const host = start()
        expect(
            host.handleControlMessage({
                scope: 'pera-db-control',
                kind: 'pair',
            }),
        ).toBe(false)
    })

    it('delivers an approved result to the connector', async () => {
        const host = start()
        host.handleControlMessage({
            scope: WC_CONTROL_SCOPE,
            kind: 'pair',
            uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
        })

        host.handleControlMessage({
            scope: WC_CONTROL_SCOPE,
            kind: 'deliver',
            clientId: 'client-1',
            wcRequestId: 9,
            outcome: { ok: true, result: ['c3R4bg=='] },
        })

        await vi.waitFor(() => {
            expect(created[0].approveRequest).toHaveBeenCalledWith({
                id: 9,
                result: ['c3R4bg=='],
            })
        })
    })

    it('delivers a rejection to the connector', async () => {
        const host = start()
        host.handleControlMessage({
            scope: WC_CONTROL_SCOPE,
            kind: 'pair',
            uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
        })

        host.handleControlMessage({
            scope: WC_CONTROL_SCOPE,
            kind: 'deliver',
            clientId: 'client-1',
            wcRequestId: 9,
            outcome: { ok: false, message: 'declined' },
        })

        await vi.waitFor(() => {
            expect(created[0].rejectRequest).toHaveBeenCalledWith(
                expect.objectContaining({ id: 9 }),
            )
        })
    })

    describe('reviveStoredSessions', () => {
        it('adopts a persisted connection: creates, registers and binds handlers', () => {
            const host = start({
                storedConnections: () => [
                    makeStoredConnection({
                        clientId: 'stored-1',
                        session: { clientId: 'stored-1', peerId: 'peer-1' },
                    }),
                ],
            })

            host.reviveStoredSessions()

            expect(created).toHaveLength(1)
            expect(created[0].clientId).toBe('stored-1')
            expect(created[0].on).toHaveBeenCalledWith(
                'session_request',
                expect.any(Function),
            )
        })

        it('skips a connection with no clientId', () => {
            const host = start({
                storedConnections: () => [
                    makeStoredConnection({ session: { peerId: 'peer-1' } }),
                ],
            })

            host.reviveStoredSessions()

            expect(created).toHaveLength(0)
        })

        it('skips a connection whose connector is already registered', () => {
            const host = start({
                storedConnections: () => [
                    makeStoredConnection({
                        clientId: 'stored-1',
                        session: { clientId: 'stored-1', peerId: 'peer-1' },
                    }),
                ],
            })

            host.reviveStoredSessions()
            expect(created).toHaveLength(1)

            // Second sweep for the same still-registered connection must
            // not create another connector for it.
            host.reviveStoredSessions()
            expect(created).toHaveLength(1)
        })

        it('keeps processing remaining connections after one fails to revive', () => {
            const host = start({
                storedConnections: () => [
                    makeStoredConnection({
                        clientId: 'bad-1',
                        session: { clientId: 'bad-1', peerId: 'peer-1' },
                    }),
                    makeStoredConnection({
                        clientId: 'good-1',
                        session: { clientId: 'good-1', peerId: 'peer-1' },
                    }),
                ],
                createConnector: options => {
                    const clientId = (
                        options.session as { clientId?: string } | undefined
                    )?.clientId
                    if (clientId === 'bad-1') {
                        throw new Error('revive boom')
                    }
                    const connector = makeConnector(clientId as string)
                    created.push(connector)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    return connector as any
                },
            })

            expect(() => host.reviveStoredSessions()).not.toThrow()

            expect(created).toHaveLength(1)
            expect(created[0].clientId).toBe('good-1')
        })
    })

    describe('disconnect control message', () => {
        it('kills the session when the connector is connected', async () => {
            const host = start()
            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'pair',
                uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
            })

            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'disconnect',
                clientId: 'client-1',
            })

            await vi.waitFor(() => {
                expect(created[0].killSession).toHaveBeenCalledWith({
                    message: 'User disconnected',
                })
            })
            expect(created[0].transportClose).not.toHaveBeenCalled()
        })

        it('does not kill the session when the connector is not connected', async () => {
            const host = start({
                createConnector: () => {
                    const connector = makeConnector(
                        `client-${created.length + 1}`,
                        { connected: false },
                    )
                    created.push(connector)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    return connector as any
                },
            })
            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'pair',
                uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
            })

            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'disconnect',
                clientId: 'client-1',
            })

            await vi.waitFor(() => {
                expect(created[0].transportClose).toHaveBeenCalled()
            })
            expect(created[0].killSession).not.toHaveBeenCalled()
        })
    })

    it('handles a reconnect-all control message without throwing', () => {
        const host = start()
        host.handleControlMessage({
            scope: WC_CONTROL_SCOPE,
            kind: 'pair',
            uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
        })

        expect(
            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'reconnect-all',
            }),
        ).toBe(true)
    })

    it('swallows and logs a deliver for an unknown clientId', async () => {
        const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {})
        const host = start()

        expect(() =>
            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'deliver',
                clientId: 'ghost',
                wcRequestId: 1,
                outcome: { ok: true, result: [] },
            }),
        ).not.toThrow()

        await vi.waitFor(() => {
            expect(warnSpy).toHaveBeenCalledWith(
                '[wc-host] delivery failed',
                expect.objectContaining({ clientId: 'ghost' }),
            )
        })
        warnSpy.mockRestore()
    })

    describe('approve-session / reject-session control messages', () => {
        it('approves the handshake on the right connector with the right accounts and chainId', async () => {
            const host = start()
            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'pair',
                uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
            })

            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'approve-session',
                clientId: 'client-1',
                approvedAddresses: ['AAAA', 'BBBB'],
                chainId: 416_001,
            })

            await vi.waitFor(() => {
                expect(created[0].approveSession).toHaveBeenCalledWith({
                    chainId: 416_001,
                    accounts: ['AAAA', 'BBBB'],
                })
            })
        })

        it('rejects the handshake on the right connector', async () => {
            const host = start()
            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'pair',
                uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
            })

            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'reject-session',
                clientId: 'client-1',
            })

            await vi.waitFor(() => {
                expect(created[0].rejectSession).toHaveBeenCalledWith()
            })
        })

        // Since the gate trusts the persisted record as the sole source of
        // truth for chain acceptability, `approveSession` is the
        // one place that record gets written — worth asserting the
        // invariant here too, defensively, rather than trusting every
        // upstream caller (bindHeadlessHandlers' own network-mismatch
        // rejection) to have already guaranteed it.
        it('rejects the handshake instead of approving it when chainId is not acceptable on the active network', async () => {
            const errorSpy = vi
                .spyOn(logger, 'error')
                .mockImplementation(() => {})
            const host = start()
            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'pair',
                uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
            })

            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'approve-session',
                clientId: 'client-1',
                approvedAddresses: ['AAAA'],
                // 416_002 is testnet; this suite's `network` fixture is
                // mainnet.
                chainId: 416_002,
            })

            await vi.waitFor(() => {
                expect(created[0].rejectSession).toHaveBeenCalled()
            })
            expect(created[0].approveSession).not.toHaveBeenCalled()
            expect(persistConnection).not.toHaveBeenCalled()
            errorSpy.mockRestore()
        })

        it('logs (does not throw) when approve-session cannot reach a connector', async () => {
            const errorSpy = vi
                .spyOn(logger, 'error')
                .mockImplementation(() => {})
            const host = start()

            expect(() =>
                host.handleControlMessage({
                    scope: WC_CONTROL_SCOPE,
                    kind: 'approve-session',
                    clientId: 'ghost',
                    approvedAddresses: ['AAAA'],
                    chainId: 416_001,
                }),
            ).not.toThrow()

            await vi.waitFor(() => {
                expect(errorSpy).toHaveBeenCalledWith(
                    '[wc-host] approve-session failed',
                    expect.objectContaining({ clientId: 'ghost' }),
                )
            })
            errorSpy.mockRestore()
        })

        it('swallows and logs when reject-session cannot reach a connector', async () => {
            const warnSpy = vi
                .spyOn(logger, 'warn')
                .mockImplementation(() => {})
            const host = start()

            expect(() =>
                host.handleControlMessage({
                    scope: WC_CONTROL_SCOPE,
                    kind: 'reject-session',
                    clientId: 'ghost',
                }),
            ).not.toThrow()

            await vi.waitFor(() => {
                expect(warnSpy).toHaveBeenCalledWith(
                    '[wc-host] reject-session delivery failed',
                    expect.objectContaining({ clientId: 'ghost' }),
                )
            })
            warnSpy.mockRestore()
        })
    })

    describe('session persistence', () => {
        it('persists a record with exactly the documented top-level and session fields — no socket handles', async () => {
            const host = start()
            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'pair',
                uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
            })

            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'approve-session',
                clientId: 'client-1',
                approvedAddresses: ['AAAA'],
                chainId: 416_001,
            })

            await vi.waitFor(() => {
                expect(persistConnection).toHaveBeenCalledTimes(1)
            })

            const persisted = persistConnection.mock
                .calls[0][0] as unknown as Record<string, unknown>
            // Pins the exact contract `buildApprovedConnection` promises:
            // only these named fields, never a spread of the live connector
            // (which would carry `_transport`/`_socket`/`_eventManager`
            // handles into the store). A fixture-shaped `session` object
            // could never have those keys regardless of what the
            // production code does, so an allowlist on the actual keys is
            // the assertion that pins something real.
            expect(Object.keys(persisted).sort()).toEqual(
                [
                    'bridge',
                    'clientId',
                    'connected',
                    'createdAt',
                    'lastActiveAt',
                    'session',
                    'version',
                ].sort(),
            )
            expect(persisted.clientId).toBe('client-1')

            const session = persisted.session as Record<string, unknown>
            expect(Object.keys(session).sort()).toEqual(
                ['chainId', 'clientId', 'peerId', 'permissions'].sort(),
            )
        })

        it('persists the permissions carried by the triggering session_request, not an empty fallback', async () => {
            const host = start()
            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'pair',
                uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
            })

            created[0].emit('session_request', null, {
                params: [
                    {
                        peerMeta: {
                            name: 'dApp',
                            url: 'https://dapp.example',
                        },
                        chainId: 416_001,
                        permissions: ['algo_signTxn'],
                    },
                ],
            })

            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'approve-session',
                clientId: 'client-1',
                approvedAddresses: ['AAAA'],
                chainId: 416_001,
            })

            await vi.waitFor(() => {
                expect(persistConnection).toHaveBeenCalledTimes(1)
            })

            const persisted = persistConnection.mock
                .calls[0][0] as WalletConnectConnection
            expect(
                (persisted.session as { permissions?: string[] })?.permissions,
            ).toEqual(['algo_signTxn'])
        })

        it('persists nothing when approve-session cannot reach a connector (revival timeout)', async () => {
            const errorSpy = vi
                .spyOn(logger, 'error')
                .mockImplementation(() => {})
            const host = start()

            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'approve-session',
                clientId: 'ghost',
                approvedAddresses: ['AAAA'],
                chainId: 416_001,
            })

            await vi.waitFor(() => {
                expect(errorSpy).toHaveBeenCalledWith(
                    '[wc-host] approve-session failed',
                    expect.objectContaining({ clientId: 'ghost' }),
                )
            })
            expect(persistConnection).not.toHaveBeenCalled()
            errorSpy.mockRestore()
        })

        it('removes the persisted record on a disconnect control message', async () => {
            const host = start()
            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'pair',
                uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
            })

            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'disconnect',
                clientId: 'client-1',
            })

            await vi.waitFor(() => {
                expect(removeConnection).toHaveBeenCalledWith('client-1')
            })
        })

        it('removes the persisted record when the peer disconnects', () => {
            const host = start()
            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'pair',
                uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
            })

            created[0].emit('disconnect', null)

            expect(removeConnection).toHaveBeenCalledWith('client-1')
        })

        it('removes the persisted record on reject-session, even though the fake rejectSession emits no disconnect event', async () => {
            // `makeConnector`'s `rejectSession` is a bare `vi.fn()` — it
            // never emits `disconnect`, so `onDisconnect`'s removal never
            // fires here. The only thing that can remove the record on this
            // path is `rejectSession` calling `deps.removeConnection`
            // itself.
            const host = start()
            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'pair',
                uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
            })

            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'reject-session',
                clientId: 'client-1',
            })

            await vi.waitFor(() => {
                expect(removeConnection).toHaveBeenCalledWith('client-1')
            })
        })
    })

    describe('approve-session address authorization', () => {
        it('approves the handshake with only the addresses that intersect the wallet accounts', async () => {
            const host = start()
            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'pair',
                uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
            })

            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'approve-session',
                clientId: 'client-1',
                // 'AAAA' and 'BBBB' are the only addresses `knownAddresses`
                // returns for this suite's `start()` fixture — 'ZZZZ' is
                // caller-chosen and must never reach the connector.
                approvedAddresses: ['AAAA', 'ZZZZ'],
                chainId: 416_001,
            })

            await vi.waitFor(() => {
                expect(created[0].approveSession).toHaveBeenCalledWith({
                    chainId: 416_001,
                    accounts: ['AAAA'],
                })
            })
        })

        it('rejects the handshake (does not approve) when no approved address intersects the wallet accounts', async () => {
            const errorSpy = vi
                .spyOn(logger, 'error')
                .mockImplementation(() => {})
            const host = start()
            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'pair',
                uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
            })

            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'approve-session',
                clientId: 'client-1',
                approvedAddresses: ['ZZZZ'],
                chainId: 416_001,
            })

            await vi.waitFor(() => {
                expect(created[0].rejectSession).toHaveBeenCalledWith()
            })
            expect(created[0].approveSession).not.toHaveBeenCalled()
            expect(persistConnection).not.toHaveBeenCalled()
            errorSpy.mockRestore()
        })

        it('never persists a connection when the address intersection is empty', async () => {
            const errorSpy = vi
                .spyOn(logger, 'error')
                .mockImplementation(() => {})
            const host = start()
            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'pair',
                uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
            })

            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'approve-session',
                clientId: 'client-1',
                approvedAddresses: ['ZZZZ'],
                chainId: 416_001,
            })

            await vi.waitFor(() => {
                expect(created[0].rejectSession).toHaveBeenCalled()
            })
            expect(persistConnection).not.toHaveBeenCalled()
            errorSpy.mockRestore()
        })

        it('clears the in-flight connect guard on an empty-intersection rejection, so the clientId can pair again', async () => {
            const errorSpy = vi
                .spyOn(logger, 'error')
                .mockImplementation(() => {})
            const host = start()
            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'pair',
                uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
            })

            created[0].emit('session_request', null, {
                params: [
                    {
                        peerMeta: {
                            name: 'dApp',
                            url: 'https://dapp.example',
                        },
                        chainId: 416_001,
                    },
                ],
            })
            expect(requestApproval).toHaveBeenCalledTimes(1)

            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'approve-session',
                clientId: 'client-1',
                approvedAddresses: ['ZZZZ'],
                chainId: 416_001,
            })

            await vi.waitFor(() => {
                expect(created[0].rejectSession).toHaveBeenCalled()
            })

            created[0].emit('session_request', null, {
                params: [
                    {
                        peerMeta: {
                            name: 'dApp',
                            url: 'https://dapp.example',
                        },
                        chainId: 416_001,
                    },
                ],
            })

            expect(requestApproval).toHaveBeenCalledTimes(2)
            errorSpy.mockRestore()
        })
    })

    describe('connect approval in-flight guard', () => {
        const emitSessionRequest = (
            connector: ReturnType<typeof makeConnector>,
        ): void =>
            connector.emit('session_request', null, {
                params: [
                    {
                        peerMeta: {
                            name: 'dApp',
                            url: 'https://dapp.example',
                        },
                        chainId: 416_001,
                    },
                ],
            })

        it('drops a second session_request on the same connector while the first connect approval is pending', () => {
            const host = start()
            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'pair',
                uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
            })

            emitSessionRequest(created[0])
            emitSessionRequest(created[0])

            expect(requestApproval).toHaveBeenCalledTimes(1)
        })

        it('requests approval again for a later session_request once approve-session clears the guard', () => {
            const host = start()
            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'pair',
                uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
            })

            emitSessionRequest(created[0])
            expect(requestApproval).toHaveBeenCalledTimes(1)

            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'approve-session',
                clientId: 'client-1',
                approvedAddresses: ['AAAA'],
                chainId: 416_001,
            })

            emitSessionRequest(created[0])

            expect(requestApproval).toHaveBeenCalledTimes(2)
        })

        it('requests approval again for a later session_request once reject-session clears the guard', () => {
            const host = start()
            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'pair',
                uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
            })

            emitSessionRequest(created[0])
            expect(requestApproval).toHaveBeenCalledTimes(1)

            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'reject-session',
                clientId: 'client-1',
            })

            emitSessionRequest(created[0])

            expect(requestApproval).toHaveBeenCalledTimes(2)
        })

        it('requests approval again for a later session_request once the session is dropped via disconnect', () => {
            const host = start()
            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'pair',
                uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
            })

            emitSessionRequest(created[0])
            expect(requestApproval).toHaveBeenCalledTimes(1)

            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'disconnect',
                clientId: 'client-1',
            })

            emitSessionRequest(created[0])

            expect(requestApproval).toHaveBeenCalledTimes(2)
        })

        it('tracks the in-flight guard per clientId, not globally', () => {
            const host = start()
            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'pair',
                uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
            })
            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'pair',
                uri: 'wc:topic@2?bridge=https%3A%2F%2Fb&key=01',
            })

            emitSessionRequest(created[0])
            emitSessionRequest(created[1])

            expect(requestApproval).toHaveBeenCalledTimes(2)
            expect(requestApproval).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({ clientId: 'client-1' }),
            )
            expect(requestApproval).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({ clientId: 'client-2' }),
            )
        })
    })

    describe('pair-outcome correlation', () => {
        it('reports a session outcome once a session_request lands for the correlated pair', () => {
            const host = start()
            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'pair',
                uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
                correlationId: 'corr-1',
            })

            created[0].emit('session_request', null, {
                params: [
                    {
                        peerMeta: { name: 'dApp', url: 'https://dapp.example' },
                        chainId: 416_001,
                    },
                ],
            })

            expect(sendPairOutcome).toHaveBeenCalledWith({
                correlationId: 'corr-1',
                outcome: { type: 'session' },
            })
        })

        it('reports an error outcome when createConnector throws', () => {
            const host = start({
                createConnector: () => {
                    throw new Error('dead bridge')
                },
            })

            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'pair',
                uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
                correlationId: 'corr-1',
            })

            expect(sendPairOutcome).toHaveBeenCalledWith({
                correlationId: 'corr-1',
                outcome: { type: 'error', reason: 'dead bridge' },
            })
        })

        it('reports an error outcome for a session_request rejected as the wrong network', () => {
            const host = start()
            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'pair',
                uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
                correlationId: 'corr-1',
            })

            created[0].emit('session_request', null, {
                params: [{ peerMeta: {}, chainId: 416_002 }],
            })

            expect(sendPairOutcome).toHaveBeenCalledWith({
                correlationId: 'corr-1',
                outcome: { type: 'error', reason: 'network-mismatch' },
            })
        })

        it('raises a user-facing notice naming both networks, so the click does not silently do nothing', () => {
            // The dApp's SDK tears its own connect modal down as soon as the
            // handshake is rejected, so without this surface the user sees the
            // modal vanish and nothing else — the exact field report this
            // exists to fix.
            const host = start()
            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'pair',
                uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
            })

            created[0].emit('session_request', null, {
                params: [
                    {
                        peerMeta: { url: 'https://dapp.example/path' },
                        chainId: 416_002,
                    },
                ],
            })

            expect(requestApproval).toHaveBeenCalledWith({
                kind: 'wc-error',
                clientId: 'client-1',
                reason: 'network-mismatch',
                origin: 'https://dapp.example',
                requestedChainId: 416_002,
                activeNetwork: Networks.mainnet,
            })
        })

        it('keeps at most one notice open, so a page cannot spam approval windows by pairing on the wrong network', async () => {
            // A page can drive `pair` at will (the content channel is
            // page-visible and the SW only proves the sender is an http(s)
            // tab), so the guard is what stops a hostile page opening windows
            // in a loop.
            let releaseFirst: (() => void) | undefined
            const host = start()
            requestApproval.mockImplementation(
                () =>
                    new Promise<void>(resolve => {
                        releaseFirst = resolve
                    }),
            )

            const pairOnWrongNetwork = (): void => {
                host.handleControlMessage({
                    scope: WC_CONTROL_SCOPE,
                    kind: 'pair',
                    uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
                })
                created[created.length - 1].emit('session_request', null, {
                    params: [{ peerMeta: {}, chainId: 416_002 }],
                })
            }

            pairOnWrongNetwork()
            pairOnWrongNetwork()
            pairOnWrongNetwork()

            expect(requestApproval).toHaveBeenCalledTimes(1)

            // Dismissing the open notice re-arms it for the next genuine
            // mismatch — the guard must not be a one-shot latch.
            releaseFirst?.()
            await vi.waitFor(() => {
                pairOnWrongNetwork()
                expect(requestApproval).toHaveBeenCalledTimes(2)
            })
        })

        it('never reports an outcome for a pair call with no correlationId', () => {
            const host = start()
            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'pair',
                uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
            })

            created[0].emit('session_request', null, {
                params: [
                    {
                        peerMeta: { name: 'dApp', url: 'https://dapp.example' },
                        chainId: 416_001,
                    },
                ],
            })

            expect(sendPairOutcome).not.toHaveBeenCalled()
        })

        it('resolves the correlation exactly once, so a duplicate session_request on the same connector reports nothing further', () => {
            const host = start()
            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'pair',
                uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
                correlationId: 'corr-1',
            })

            const emitSessionRequest = () =>
                created[0].emit('session_request', null, {
                    params: [
                        {
                            peerMeta: {
                                name: 'dApp',
                                url: 'https://dapp.example',
                            },
                            chainId: 416_001,
                        },
                    ],
                })

            emitSessionRequest()
            emitSessionRequest()

            expect(sendPairOutcome).toHaveBeenCalledTimes(1)
        })

        it('cleans up the correlation mapping on disconnect so a later reuse of the clientId cannot resolve a stale correlationId', () => {
            const host = start()
            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'pair',
                uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
                correlationId: 'corr-1',
            })

            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'disconnect',
                clientId: 'client-1',
            })

            // The connector disconnected before ever firing session_request
            // — if the mapping leaked, a later session_request on a
            // recreated connector reusing this clientId would wrongly
            // resolve the old correlationId. Simulate that reuse directly.
            created[0].emit('session_request', null, {
                params: [
                    {
                        peerMeta: { name: 'dApp', url: 'https://dapp.example' },
                        chainId: 416_001,
                    },
                ],
            })

            expect(sendPairOutcome).not.toHaveBeenCalled()
        })

        // A dead WC v1 bridge produces no `session_request` and no
        // `disconnect` — none of the paths above ever run for it. Proves
        // the correlation entry is cleaned up by its OWN timer in that case,
        // rather than lingering for the rest of the offscreen document's
        // (session-long) lifetime.
        it("cleans up the correlation via its own cleanup timer when the bridge never fires session_request or disconnect (dead/404'd bridge)", () => {
            vi.useFakeTimers()
            try {
                const host = start()
                host.handleControlMessage({
                    scope: WC_CONTROL_SCOPE,
                    kind: 'pair',
                    uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
                    correlationId: 'corr-1',
                })

                // Nothing ever fires on the connector. Advance past the
                // caller's own outcome-wait budget (8s) plus this host's
                // cleanup slack — long after any caller listening for
                // `corr-1` has already given up and settled as `timeout`.
                vi.advanceTimersByTime(10_001)

                // A session_request landing on this (recreated,
                // clientId-reusing) connector after the cleanup timer fired
                // must not resolve the now-stale correlationId — that would
                // report an outcome to a caller long gone.
                created[0].emit('session_request', null, {
                    params: [
                        {
                            peerMeta: {
                                name: 'dApp',
                                url: 'https://dapp.example',
                            },
                            chainId: 416_001,
                        },
                    ],
                })

                expect(sendPairOutcome).not.toHaveBeenCalled()
            } finally {
                vi.useRealTimers()
            }
        })

        it('still resolves normally when session_request lands before the cleanup timer’s own (longer) budget elapses', () => {
            vi.useFakeTimers()
            try {
                const host = start()
                host.handleControlMessage({
                    scope: WC_CONTROL_SCOPE,
                    kind: 'pair',
                    uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
                    correlationId: 'corr-1',
                })

                // Well past a caller's own 8s wait but before this host's
                // 8s + 2s slack cleanup fires — the entry must still be
                // live here.
                vi.advanceTimersByTime(9000)

                created[0].emit('session_request', null, {
                    params: [
                        {
                            peerMeta: {
                                name: 'dApp',
                                url: 'https://dapp.example',
                            },
                            chainId: 416_001,
                        },
                    ],
                })

                expect(sendPairOutcome).toHaveBeenCalledWith({
                    correlationId: 'corr-1',
                    outcome: { type: 'session' },
                })
            } finally {
                vi.useRealTimers()
            }
        })

        it('cancels the cleanup timer once a session_request resolves the correlation, leaving no stray timer behind', () => {
            vi.useFakeTimers()
            try {
                const host = start()
                host.handleControlMessage({
                    scope: WC_CONTROL_SCOPE,
                    kind: 'pair',
                    uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
                    correlationId: 'corr-1',
                })

                created[0].emit('session_request', null, {
                    params: [
                        {
                            peerMeta: {
                                name: 'dApp',
                                url: 'https://dapp.example',
                            },
                            chainId: 416_001,
                        },
                    ],
                })
                sendPairOutcome.mockClear()

                // If the cleanup timer weren't cancelled on resolution, it
                // would still be pending here — firing it must not call
                // sendPairOutcome again (the map entry it targets is
                // already gone either way, but a stray unfired timer would
                // itself be the leak this fix closes).
                expect(vi.getTimerCount()).toBe(0)
                vi.advanceTimersByTime(10_001)
                expect(sendPairOutcome).not.toHaveBeenCalled()
            } finally {
                vi.useRealTimers()
            }
        })

        // Defensive-code guard, not a live scenario: real `clientId`s are
        // fresh SDK uuids, so two `pair()` calls never actually share one
        // once the no-op session-storage fix (`createConnector.ts`) is in
        // place — this fixture forces every connector to report the same
        // `clientId` specifically to drive `armPairingCorrelation` through
        // a state it can no longer reach naturally, so the re-arm-clears-
        // the-old-timer guard doesn't silently rot unexercised.
        it('clears the previous cleanup timer when a clientId is re-armed with a new correlationId, so the stale timer cannot delete the fresh entry', () => {
            vi.useFakeTimers()
            try {
                const host = start({
                    createConnector: () => {
                        // Every connector this fixture creates reports the
                        // same clientId, forcing the otherwise-unreachable
                        // re-arm case this test exists to cover (see the
                        // block comment above).
                        const connector = makeConnector('client-1')
                        created.push(connector)
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        return connector as any
                    },
                })

                host.handleControlMessage({
                    scope: WC_CONTROL_SCOPE,
                    kind: 'pair',
                    uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
                    correlationId: 'corr-1',
                })
                vi.advanceTimersByTime(1)
                host.handleControlMessage({
                    scope: WC_CONTROL_SCOPE,
                    kind: 'pair',
                    uri: 'wc:topic@2?bridge=https%3A%2F%2Fb&key=01',
                    correlationId: 'corr-2',
                })

                // Lands right at corr-1's ORIGINAL cleanup deadline (armed
                // at t=0, budget+slack=10000ms) — one tick before corr-2's
                // own (armed at t=1). Without the fix, corr-1's stray timer
                // fires here and deletes the map entry, which by now holds
                // corr-2's correlation.
                vi.advanceTimersByTime(9999)

                created[1].emit('session_request', null, {
                    params: [
                        {
                            peerMeta: {
                                name: 'dApp',
                                url: 'https://dapp.example',
                            },
                            chainId: 416_001,
                        },
                    ],
                })

                expect(sendPairOutcome).toHaveBeenCalledWith({
                    correlationId: 'corr-2',
                    outcome: { type: 'session' },
                })
            } finally {
                vi.useRealTimers()
            }
        })
    })

    describe('requester origin', () => {
        it('forwards the verified requester origin on the wc-connect approval', () => {
            const host = start()
            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'pair',
                uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
                correlationId: 'corr-1',
                requesterOrigin: 'https://dapp.example',
            })

            created[0].emit('session_request', null, {
                params: [
                    {
                        peerMeta: { name: 'dApp', url: 'https://peer.example' },
                        chainId: 416_001,
                    },
                ],
            })

            expect(requestApproval).toHaveBeenCalledWith(
                expect.objectContaining({
                    kind: 'wc-connect',
                    requesterOrigin: 'https://dapp.example',
                }),
            )
        })

        it('omits the requester origin for a pairing with none', () => {
            const host = start()
            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'pair',
                uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
                correlationId: 'corr-2',
            })

            created[0].emit('session_request', null, {
                params: [{ peerMeta: {}, chainId: 416_001 }],
            })

            const request = requestApproval.mock.calls[0][0] as {
                requesterOrigin?: string
            }
            expect(request.requesterOrigin).toBeUndefined()
        })

        // Cross-pairing isolation: reproduces the reviewer's empirical repro
        // for finding I1 verbatim — pairing B's peer combined with pairing
        // A's "verified" requester would be rendered to the user as trusted
        // information about the WRONG pairing. Forces the `clientId`
        // collision the fix guards against via a `createConnector` fixture
        // that (unrealistically, but per `armPairingCorrelation`'s own doc
        // comment on why this is normally unreachable) hands out the same
        // `clientId` to two different `pair()` calls.
        it('never leaks pairing A’s requesterOrigin into pairing B’s approval when their clientIds collide', () => {
            const host = start({
                createConnector: () => {
                    const connector = makeConnector('client-fixed')
                    created.push(connector)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    return connector as any
                },
            })

            // Pairing A: armed with a browser-verified requesterOrigin. Its
            // own session_request never fires — e.g. a dApp that shows the
            // QR modal but is closed before scanning — so its map entry is
            // still live when pairing B reuses the clientId below.
            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'pair',
                uri: 'wc:topic@1?bridge=https%3A%2F%2Fb&key=00',
                requesterOrigin: 'https://evil.example',
            })

            // Pairing B: reuses the colliding clientId and carries NEITHER
            // correlationId nor requesterOrigin — the exact precondition
            // finding I1 identifies as skipping the pre-fix conditional
            // clear.
            host.handleControlMessage({
                scope: WC_CONTROL_SCOPE,
                kind: 'pair',
                uri: 'wc:topic@2?bridge=https%3A%2F%2Fb&key=01',
            })

            created[1].emit('session_request', null, {
                params: [
                    {
                        peerMeta: {
                            name: 'dApp',
                            url: 'https://second.example',
                        },
                        chainId: 416_001,
                    },
                ],
            })

            expect(requestApproval).toHaveBeenCalledWith(
                expect.objectContaining({
                    kind: 'wc-connect',
                    clientId: 'client-fixed',
                    origin: 'https://second.example',
                }),
            )
            const request = requestApproval.mock.calls[
                requestApproval.mock.calls.length - 1
            ][0] as { requesterOrigin?: string }
            expect(request.requesterOrigin).toBeUndefined()
        })
    })
})
