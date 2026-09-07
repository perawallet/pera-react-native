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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { AppState } from 'react-native'
import {
    memoryStore,
    runHandlerContractTests,
} from '@perawallet/wallet-core-connections/testing'
import type {
    Connection,
    ConnectionId,
    ConnectionOrigin,
} from '@perawallet/wallet-extension-connections'
import {
    createConnectionRegistry,
    type ConnectionErrorScope,
    type ConnectionHandlerContext,
    type ConnectionProposal,
    type InboundMessage,
    type RawInboundMessage,
} from '@perawallet/wallet-core-connections'
import { createWalletConnectV1Handler } from '../handler'
import type { WalletConnectV1SessionKeyStore } from '../secrets'
import {
    __resetRegistryForTests,
    getConnector,
} from '../../connection/connectorRegistry'
import { toPeer } from '../../shared/peer'

// Spied, not replaced: the point is proving the handler reaches the one
// shared implementation rather than carrying its own.
vi.mock('../../shared/peer', { spy: true })

// Backs the kms mock; only the default-store test reaches it.
const secrets = vi.hoisted(() => new Map<string, Uint8Array>())

// The injected store every other test uses, so a test can seed or read a key.
const keys = new Map<string, string>()
const sessionKeys: WalletConnectV1SessionKeyStore = {
    commit: vi.fn(async (clientId: string, key: string) => {
        if (!keys.has(clientId)) keys.set(clientId, key)
        return `wc1-session-key:${clientId}`
    }),
    has: clientId => keys.has(clientId),
    read: async clientId => keys.get(clientId) ?? null,
    remove: async clientId => void keys.delete(clientId),
}

vi.mock('@perawallet/wallet-core-kms', () => ({
    commitSecret: vi.fn(
        async ({ id, bytes }: { id: string; bytes: Uint8Array }) => {
            secrets.set(id, new Uint8Array(bytes))
        },
    ),
    hasSecret: vi.fn((id: string) => secrets.has(id)),
    withSecret: vi.fn(
        async (id: string, handler: (bytes: Uint8Array) => unknown) => {
            const stored = secrets.get(id)
            return stored ? handler(stored) : null
        },
    ),
    removeSecret: vi.fn(async (id: string) => void secrets.delete(id)),
    // `./secrets` zeroes its own encoded buffer after committing.
    zeroBytes: vi.fn((bytes: Uint8Array) => bytes.fill(0)),
}))

// Same stand-in as validation/__tests__/inboundRequestGate.test.ts and
// connection/__tests__/connectorRegistry.test.ts: the signing barrel drags in
// RN-only deps (react-native-mmkv) that don't resolve under jsdom, and the
// handler reaches it through `../shared/schema`. Real limits and a faithful
// ARC-60 wire shape, so the gate assertions still mean something.
vi.mock('@perawallet/wallet-core-signing', () => ({
    MAX_DATA_SIGN_REQUESTS: 1000,
    MAX_TRANSACTION_SIGN_REQUESTS: 1000,
    ARC60_MAX_REQUEST_BYTES: 64 * 1024,
    arc60WireSchema: z.object({
        data: z.string(),
        signer: z.string(),
        domain: z.string(),
        authenticatorData: z.string(),
        requestId: z.string().optional(),
        hdPath: z.string().optional(),
        metadata: z.object({
            scope: z.number().int(),
            encoding: z.string(),
        }),
    }),
    assertArc60RequestWithinLimits: vi.fn(),
}))

// The connector registry's zustand stores persist through the provider, whose
// keystore migration ledger imports react-native-mmkv at module scope — same
// stand-in as connection/__tests__/connectorRegistry.test.ts.
vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        keyValueStorage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
        },
    }),
}))

// react-native ships untranspiled Flow, so every spec in this package that
// reaches it has to stand one in (see utils/__tests__/app-state.spec.ts).
// `initialize` starts the foreground reconnect sweep, which subscribes to
// AppState.
vi.mock('react-native', () => ({
    AppState: {
        currentState: 'active',
        addEventListener: vi.fn(() => ({ remove: vi.fn() })),
    },
    Platform: { OS: 'android' },
}))

/**
 * A stand-in for the v1 client. Real one opens a bridge WebSocket in its
 * constructor, so the behavioural tests drive it through `emit` instead —
 * `createWalletConnectConnector`, the connector registry, the readiness check
 * and the handler's own wiring all stay real.
 */
const wc = vi.hoisted(() => {
    type WcListener = (error: Error | null, payload: unknown) => void

    class FakeConnector {
        static instances: FakeConnector[] = []

        readonly version = 1
        clientId = 'client-1'
        bridge = 'https://b.example'
        key = 'a-session-key'
        connected = false
        peerId = 'peer-1'
        peerMeta: unknown = null
        handshakeId = 0
        handshakeTopic = 'handshake-topic'
        accounts: string[] = []
        chainId = 0
        // The registry's only real socket-state signal (`_transport.connected`).
        _transport = { connected: true }

        readonly listeners = new Map<string, WcListener>()
        approveSession = vi.fn()
        // Mirrors the SDK: throws on a connected session, fires 'disconnect'
        // synchronously, and never closes the transport.
        rejectSession = vi.fn((_options?: { message?: string }) => {
            if (this.connected) throw new Error('Session currently connected')
            this.emit('disconnect', null, {
                params: [{ message: 'Session Rejected' }],
            })
        })
        approveRequest = vi.fn()
        rejectRequest = vi.fn()
        killSession = vi.fn(async () => {})
        transportClose = vi.fn()

        readonly options: {
            uri?: string
            session?: { clientId?: string; bridge?: string }
        }

        constructor(options: {
            uri?: string
            session?: { clientId?: string; bridge?: string }
        }) {
            // The real v1 client throws synchronously on a malformed bridge.
            if (options.session?.bridge === 'not-a-bridge') {
                throw new Error('Missing or invalid bridge url')
            }
            this.options = options
            if (options.session?.clientId) {
                this.clientId = options.session.clientId
            }
            FakeConnector.instances.push(this)
        }

        get session() {
            return {
                connected: this.connected,
                accounts: this.accounts,
                chainId: this.chainId,
                bridge: this.bridge,
                key: this.key,
                clientId: this.clientId,
                clientMeta: null,
                peerId: this.peerId,
                peerMeta: this.peerMeta,
                handshakeId: this.handshakeId,
                handshakeTopic: this.handshakeTopic,
            }
        }

        on(event: string, callback: WcListener): void {
            this.listeners.set(event, callback)
        }

        off(event: string): void {
            this.listeners.delete(event)
        }

        emit(event: string, error: Error | null, payload: unknown): void {
            this.listeners.get(event)?.(error, payload)
        }
    }

    return { FakeConnector }
})

vi.mock('@perawallet/walletconnect', () => ({ default: wc.FakeConnector }))

const V1_URI =
    'wc:8a5e5bdc-a0e4-4702-ba63-8f1a5655744f@1?bridge=https%3A%2F%2Fb.example&key=41791102999c339c844880b23950704cc43aa840f3739e365323cda4dfa89e7a'

// `getNetwork` is a required constructor argument (no store-reading
// default — see handler.ts), so every call site in this file supplies one.
const testGetNetwork = () => 'mainnet' as const

const SIGN_TXN_FRAME = { id: 7, params: [[{ txn: 'dHhu' }]] }

/** For the contract suite, whose `propose` takes an optional pairing id. */
const requireConnectorFor = (clientId?: string) => {
    if (clientId === undefined) {
        throw new Error('the v1 handler always pairs before it proposes')
    }
    return connectorFor(clientId)
}

const connectorFor = (clientId: string) => {
    const connector = wc.FakeConnector.instances.find(
        instance => instance.clientId === clientId,
    )
    if (!connector) throw new Error(`no connector for ${clientId}`)
    return connector
}

describe('walletconnect v1 handler contract', () => {
    beforeEach(() => {
        keys.clear()
        wc.FakeConnector.instances.length = 0
        __resetRegistryForTests()
    })

    runHandlerContractTests(
        'walletconnect-v1',
        () =>
            createWalletConnectV1Handler({
                getNetwork: testGetNetwork,
                sessionKeys,
            }),
        {
            uri: {
                valid: V1_URI,
                foreign: 'wc:topic@2?relay-protocol=irn&symKey=beef',
                secret: '41791102999c339c844880b23950704cc43aa840f3739e365323cda4dfa89e7a',
            },
            peer: {
                // v1 always pairs first, so the suite always has an id to
                // hand back here; the optional parameter is for the kinds
                // that surface a proposal without one.
                propose: pairingId =>
                    requireConnectorFor(pairingId).emit(
                        'session_request',
                        null,
                        {
                            id: 42,
                            params: [
                                {
                                    peerMeta: { name: 'Contract dApp' },
                                    chainId: 4160,
                                    permissions: ['algo_signTxn'],
                                },
                            ],
                        },
                    ),
                request: connectionId => {
                    const connector = connectorFor(connectionId)
                    // The real client flips this inside approveSession, which
                    // is a spy here.
                    connector.connected = true
                    connector.emit('algo_signTxn', null, SIGN_TXN_FRAME)
                },
                // A dead socket with no peer to recreate against: revival
                // fails instead of waiting out the delivery timeout.
                setReachable: (connectionId, isReachable) => {
                    const connector = connectorFor(connectionId)
                    connector._transport.connected = isReachable
                    connector.peerId = isReachable ? 'peer-1' : ''
                },
            },
        },
    )
})

describe('walletconnect v1 handler specifics', () => {
    it('declines a v1 URI with no bridge — the v1 client throws on those', () => {
        expect(
            createWalletConnectV1Handler({
                getNetwork: testGetNetwork,
                sessionKeys,
            }).canHandleUri('wc:topic@1?key=beef'),
        ).toBe(false)
    })

    it('reports the topic and bridge origin but never the key', () => {
        const described = createWalletConnectV1Handler({
            getNetwork: testGetNetwork,
            sessionKeys,
        }).describeUri(V1_URI)

        expect(described).toEqual({
            topic: '8a5e5bdc-a0e4-4702-ba63-8f1a5655744f',
            bridgeOrigin: 'https://b.example',
        })
    })

    it('treats the 4160 wildcard as matching every network', () => {
        const handler = createWalletConnectV1Handler({
            getNetwork: testGetNetwork,
            sessionKeys,
        })
        const connection = {
            id: 'c1',
            kind: 'walletconnect-v1' as const,
            name: 'Peer',
            peer: { name: 'Peer' },
            accounts: [],
            secretRef: 'wc1-session-key:c1',
            status: 'active' as const,
            createdAt: 0,
            lastActiveAt: 0,
            metadata: {
                bridge: 'https://b.example',
                handshakeTopic: 't',
                peerId: 'p',
                chainId: 4160,
            },
        }

        expect(handler.matchesNetwork(connection, 'mainnet')).toBe(true)
        expect(handler.matchesNetwork(connection, 'testnet')).toBe(true)
    })

    it('binds a specific chainId to exactly one network', () => {
        const handler = createWalletConnectV1Handler({
            getNetwork: testGetNetwork,
            sessionKeys,
        })
        const connection = {
            id: 'c1',
            kind: 'walletconnect-v1' as const,
            name: 'Peer',
            peer: { name: 'Peer' },
            accounts: [],
            secretRef: 'wc1-session-key:c1',
            status: 'active' as const,
            createdAt: 0,
            lastActiveAt: 0,
            metadata: {
                bridge: 'https://b.example',
                handshakeTopic: 't',
                peerId: 'p',
                chainId: 416_002,
            },
        }

        expect(handler.matchesNetwork(connection, 'testnet')).toBe(true)
        expect(handler.matchesNetwork(connection, 'mainnet')).toBe(false)
    })

    it('covers every Network member, not just mainnet and testnet', () => {
        // `Network` has four members. A two-branch mainnet/testnet mapping
        // silently mislabels betanet and custom, which is why matchesNetwork
        // delegates to the exhaustive EXPECTED_CHAIN_ID_BY_NETWORK record.
        const handler = createWalletConnectV1Handler({
            getNetwork: testGetNetwork,
            sessionKeys,
        })
        const at = (chainId: number) => ({
            id: 'c1',
            kind: 'walletconnect-v1' as const,
            name: 'Peer',
            peer: { name: 'Peer' },
            accounts: [],
            secretRef: 'wc1-session-key:c1',
            status: 'active' as const,
            createdAt: 0,
            lastActiveAt: 0,
            metadata: {
                bridge: 'https://b.example',
                handshakeTopic: 't',
                peerId: 'p',
                chainId,
            },
        })

        expect(handler.matchesNetwork(at(416_003), 'betanet')).toBe(true)
        expect(handler.matchesNetwork(at(416_003), 'mainnet')).toBe(false)
        // `custom` (LocalNet/fnet) borrows TestNet's id — see expectedChainId.ts.
        expect(handler.matchesNetwork(at(416_002), 'custom')).toBe(true)
    })

    it('rejects a request whose chain id is missing rather than guessing', () => {
        const handler = createWalletConnectV1Handler({
            getNetwork: testGetNetwork,
            sessionKeys,
        })
        const connection = {
            id: 'c1',
            kind: 'walletconnect-v1' as const,
            name: 'Peer',
            peer: { name: 'Peer' },
            accounts: [],
            secretRef: 'wc1-session-key:c1',
            status: 'active' as const,
            createdAt: 0,
            lastActiveAt: 0,
            metadata: {
                bridge: 'https://b.example',
                handshakeTopic: 't',
                peerId: 'p',
                chainId: undefined as unknown as number,
            },
        }

        expect(handler.matchesNetwork(connection, 'mainnet')).toBe(false)
    })
})

describe('walletconnect v1 handler behaviour', () => {
    const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0))

    const SEEDED: Connection = {
        id: 'c1',
        kind: 'walletconnect-v1',
        name: 'Tinyman',
        peer: { name: 'Tinyman', url: 'https://tinyman.org' },
        accounts: ['AAAA'],
        secretRef: 'wc1-session-key:c1',
        status: 'active',
        createdAt: 1,
        lastActiveAt: 1,
        metadata: {
            bridge: 'https://b.example',
            handshakeTopic: 'handshake-topic',
            peerId: 'peer-1',
            chainId: 416_001,
        },
    }

    const handshake = (chainId: number, id = 42) => ({
        id,
        params: [
            {
                peerMeta: {
                    name: 'Tinyman',
                    url: 'https://tinyman.org',
                    description: 'AMM',
                    icons: [],
                },
                chainId,
                permissions: ['algo_signTxn'],
            },
        ],
    })

    const setup = async (seed: Connection[] = []) => {
        const store = memoryStore(seed)
        const onProposal = vi.fn<(proposal: ConnectionProposal) => void>()
        const onMessage = vi.fn<(message: RawInboundMessage) => void>()
        const onDisconnected = vi.fn<(id: ConnectionId) => void>()
        const onError =
            vi.fn<(error: Error, scope?: ConnectionErrorScope) => void>()
        const context: ConnectionHandlerContext = {
            store,
            onProposal,
            onMessage,
            onDisconnected,
            onError,
        }
        const handler = createWalletConnectV1Handler({
            getNetwork: testGetNetwork,
            sessionKeys,
        })
        await handler.initialize(context)
        return {
            handler,
            records: () => store.list(),
            onProposal,
            onMessage,
            onDisconnected,
            onError,
        }
    }

    /** `setup`, then the restore the registry would run next. */
    const setupRestored = async (seed: Connection[]) => {
        const harness = await setup(seed)
        await harness.handler.restore()
        return harness
    }

    const lastConnector = () => {
        const connector = wc.FakeConnector.instances.at(-1)
        if (!connector) throw new Error('no connector was constructed')
        return connector
    }

    /** Pairs, delivers a handshake and approves it for `accounts`. */
    const connect = async (accounts: string[] = ['AAAA']) => {
        const harness = await setup()
        await harness.handler.pair(V1_URI)
        const connector = lastConnector()
        connector.emit('session_request', null, handshake(4160))
        await flush()
        const proposal = harness.onProposal.mock.calls[0][0]
        await proposal.approve(accounts)
        // The real client flips this inside approveSession, which is a spy here.
        connector.connected = true
        return { ...harness, connector, proposal }
    }

    const asRequest = (message: RawInboundMessage) => {
        if (message.kind !== 'request') {
            throw new Error('expected a request message')
        }
        return message
    }

    beforeEach(() => {
        secrets.clear()
        keys.clear()
        wc.FakeConnector.instances.length = 0
        __resetRegistryForTests()
        vi.clearAllMocks()
    })

    it('pairs by registering a connector with the dApp handlers bound', async () => {
        const { handler } = await setup()

        await handler.pair(V1_URI)

        const connector = lastConnector()
        expect(connector.options.uri).toBe(V1_URI)
        expect(getConnector(connector.clientId) as unknown).toBe(connector)
        expect([...connector.listeners.keys()].sort()).toEqual([
            'algo_signData',
            'algo_signTxn',
            'disconnect',
            'error',
            'session_request',
            'transport_error',
        ])
    })

    it('expands the 4160 wildcard into every network on the proposal', async () => {
        const { handler, onProposal } = await setup()
        await handler.pair(V1_URI)

        lastConnector().emit('session_request', null, handshake(4160))
        await flush()

        const proposal = onProposal.mock.calls[0][0]
        expect(proposal.kind).toBe('walletconnect-v1')
        expect(proposal.peer).toEqual({
            name: 'Tinyman',
            url: 'https://tinyman.org',
            description: 'AMM',
            icons: [],
        })
        expect([...proposal.requested.networks].sort()).toEqual([
            'betanet',
            'custom',
            'mainnet',
            'testnet',
        ])
    })

    it('survives hostile peerMeta instead of unwinding out of the socket listener', async () => {
        // `peerMeta` is whatever the peer put on the wire. A numeric `name`
        // used to throw out of `handleSessionRequest`, so the dApp got no
        // `rejectSession` and the user got no sheet; non-string `icons` were
        // persisted onto the record and reached an image `uri`.
        const { handler, onProposal } = await setup()
        await handler.pair(V1_URI)

        lastConnector().emit('session_request', null, {
            id: 42,
            params: [
                {
                    peerMeta: {
                        name: 42,
                        url: 'https://hostile.example',
                        description: { evil: true },
                        icons: ['https://hostile.example/i.png', 7, null, {}],
                    },
                    chainId: 4160,
                    permissions: ['algo_signTxn'],
                },
            ],
        })
        await flush()

        expect(onProposal).toHaveBeenCalledTimes(1)
        expect(onProposal.mock.calls[0][0].peer).toEqual({
            name: 'https://hostile.example',
            url: 'https://hostile.example',
            icons: ['https://hostile.example/i.png'],
        })
    })

    it('names a peer with nothing usable rather than refusing the handshake', async () => {
        const { handler, onProposal } = await setup()
        await handler.pair(V1_URI)

        lastConnector().emit('session_request', null, {
            id: 42,
            params: [
                {
                    peerMeta: { name: 42, url: 99, icons: 'not-an-array' },
                    chainId: 4160,
                    permissions: ['algo_signTxn'],
                },
            ],
        })
        await flush()

        expect(onProposal.mock.calls[0][0].peer).toEqual({
            name: 'Unknown dApp',
        })
    })

    it('rejects a handshake for another network rather than proposing it', async () => {
        const { handler, onProposal, onError } = await setup()
        await handler.pair(V1_URI)
        const connector = lastConnector()

        // The network store stands in at mainnet; 416_002 is TestNet.
        connector.emit('session_request', null, handshake(416_002))
        await flush()

        expect(connector.rejectSession).toHaveBeenCalled()
        expect(onProposal).not.toHaveBeenCalled()
        expect(onError).toHaveBeenCalled()
    })

    it('persists an approved session and moves its key into the session key store', async () => {
        const { connector, records } = await connect(['AAAA', 'BBBB'])

        const [record] = await records()
        expect(record).toMatchObject({
            id: connector.clientId,
            kind: 'walletconnect-v1',
            name: 'Tinyman',
            accounts: ['AAAA', 'BBBB'],
            secretRef: `wc1-session-key:${connector.clientId}`,
            status: 'active',
            metadata: {
                bridge: 'https://b.example',
                handshakeTopic: 'handshake-topic',
                peerId: 'peer-1',
                chainId: 4160,
                handshakeId: 42,
            },
        })
        expect(connector.approveSession).toHaveBeenCalledWith({
            chainId: 4160,
            accounts: ['AAAA', 'BBBB'],
        })
        // The record is UI-safe by construction — the key lives only in the
        // session key store, behind `secretRef`.
        expect(JSON.stringify(record)).not.toContain('a-session-key')
        expect(sessionKeys.has(connector.clientId)).toBe(true)
        expect(sessionKeys.commit).toHaveBeenCalledWith(
            connector.clientId,
            'a-session-key',
        )
    })

    it('stores session keys in the keystore when no store is injected', async () => {
        const store = memoryStore()
        const onProposal = vi.fn<(proposal: ConnectionProposal) => void>()
        const handler = createWalletConnectV1Handler({
            getNetwork: testGetNetwork,
        })
        await handler.initialize({
            store,
            onProposal,
            onMessage: vi.fn(),
            onDisconnected: vi.fn(),
            onError: vi.fn(),
        })
        await handler.pair(V1_URI)
        const connector = lastConnector()
        connector.emit('session_request', null, handshake(4160))
        await flush()

        await onProposal.mock.calls[0][0].approve(['AAAA'])

        expect(secrets.has(`wc1-session-key:${connector.clientId}`)).toBe(true)
        expect(keys.size).toBe(0)
    })

    it('refuses to approve a proposal that has already expired', async () => {
        const { handler, onProposal } = await setup()
        await handler.pair(V1_URI)
        lastConnector().emit('session_request', null, handshake(4160))
        await flush()
        const proposal = onProposal.mock.calls[0][0]
        // Spying on Date.now rather than installing fake timers: `flush`
        // below relies on a real setTimeout.
        const now = vi
            .spyOn(Date, 'now')
            .mockReturnValue(proposal.expiresAt + 1)

        await expect(proposal.approve(['AAAA'])).rejects.toThrow()

        expect(lastConnector().approveSession).not.toHaveBeenCalled()
        now.mockRestore()
    })

    it('stamps the approved accounts onto every inbound request', async () => {
        // Two accounts, neither of which is this file's default, so the
        // assertion cannot be satisfied by a hardcoded list. This is THE
        // security property of the design, so its test should be the least
        // ambiguous in the file rather than the most.
        const { connector, onMessage } = await connect(['BBBB', 'CCCC'])

        connector.emit('algo_signTxn', null, {
            id: 7,
            params: [[{ txn: 'dHhu' }]],
        })
        await flush()

        const message = asRequest(onMessage.mock.calls[0][0])
        expect(message.connectionId).toBe(connector.clientId)
        expect(message.correlationId).toBe('7')
        // The property that stops a session approved for A signing for B.
        expect(message.authorizedAccounts).toEqual(['BBBB', 'CCCC'])
        expect(message.rawOperation).toEqual({
            type: 'sign-transactions',
            params: [{ txn: 'dHhu' }],
        })
    })

    // The connections settings list sorts on `lastActiveAt`; nothing bumped it
    // after approval, so the order was frozen at approval time forever.
    it('advances the stored lastActiveAt when a request arrives', async () => {
        const { connector, records } = await connect()
        const approvedAt = (await records())[0].lastActiveAt
        const now = vi.spyOn(Date, 'now').mockReturnValue(approvedAt + 60_000)

        connector.emit('algo_signTxn', null, {
            id: 7,
            params: [[{ txn: 'dHhu' }]],
        })
        await flush()

        expect((await records())[0].lastActiveAt).toBe(approvedAt + 60_000)
        now.mockRestore()
    })

    it('stamps the connection peer identity onto every inbound request', async () => {
        // A distinctive peer identity, not the file's 'Tinyman' default, so a
        // mutant that hardcodes or drops `peer` cannot survive. This becomes
        // the anti-spoofing `sourceMetadata` shown on the signing sheet —
        // stamped from the approved session snapshot, not re-read from the
        // live connector.
        const { handler, onProposal, onMessage } = await setup()
        await handler.pair(V1_URI)
        const connector = lastConnector()

        connector.emit('session_request', null, {
            id: 42,
            params: [
                {
                    peerMeta: {
                        name: 'Distinctive V1 Dapp',
                        url: 'https://distinctive-v1-dapp.example',
                        description: 'A distinctive test dapp',
                        icons: ['https://distinctive-v1-dapp.example/icon.png'],
                    },
                    chainId: 4160,
                    permissions: ['algo_signTxn'],
                },
            ],
        })
        await flush()
        const proposal = onProposal.mock.calls[0][0]
        await proposal.approve(['AAAA'])
        connector.connected = true

        connector.emit('algo_signTxn', null, {
            id: 7,
            params: [[{ txn: 'dHhu' }]],
        })
        await flush()

        const message = asRequest(onMessage.mock.calls[0][0])
        expect(message.peer).toEqual({
            name: 'Distinctive V1 Dapp',
            url: 'https://distinctive-v1-dapp.example',
            description: 'A distinctive test dapp',
            icons: ['https://distinctive-v1-dapp.example/icon.png'],
        })
    })

    it('forwards the legacy arbitrary-data list, which the ARC-60 gate alone would refuse', async () => {
        const { connector, onMessage } = await connect()

        connector.emit('algo_signData', null, {
            id: 8,
            params: [{ data: 'ZGF0YQ==', signer: 'AAAA', chainId: 4160 }],
        })
        await flush()

        const message = asRequest(onMessage.mock.calls[0][0])
        expect(message.rawOperation.type).toBe('sign-data')
        expect(message.rawOperation.params).toEqual([
            { data: 'ZGF0YQ==', signer: 'AAAA', chainId: 4160 },
        ])
    })

    it('rejects a legacy sign-data item whose own chainId names a different network, even though the session chain id is acceptable', async () => {
        // Session approved with the 4160 wildcard (acceptable on any
        // network), but this item claims TestNet's chain id while the
        // network store stands in at mainnet — the per-item check must
        // catch what the session-level check alone would miss.
        const { connector, onMessage, onError } = await connect()

        connector.emit('algo_signData', null, {
            id: 11,
            params: [{ data: 'ZGF0YQ==', signer: 'AAAA', chainId: 416_002 }],
        })
        await flush()

        expect(onMessage).not.toHaveBeenCalled()
        expect(connector.rejectRequest).toHaveBeenCalledWith(
            expect.objectContaining({ id: 11 }),
        )
        expect(onError).toHaveBeenCalled()
    })

    it('does not restore inside initialize; the registry runs restore', async () => {
        keys.set('c1', 'restored-key')

        await setup([SEEDED])

        expect(wc.FakeConnector.instances).toHaveLength(0)
        expect(getConnector('c1')).toBeUndefined()
    })

    it('rejects respond when the peer is unreachable, and delivers on the retry', async () => {
        // Driven through a real registry: the once-only guard lives there,
        // and this proves the handler's delivery failure releases it rather
        // than consuming the one answer.
        const registry = createConnectionRegistry({ store: memoryStore() })
        registry.register(
            createWalletConnectV1Handler({
                getNetwork: testGetNetwork,
                sessionKeys,
            }),
        )
        const onProposal = vi.fn<(proposal: ConnectionProposal) => void>()
        const onMessage = vi.fn<(message: InboundMessage) => void>()
        registry.subscribeToProposals(onProposal)
        registry.subscribeToMessages(onMessage)
        await registry.initialize()
        await registry.pair(V1_URI)
        const connector = lastConnector()
        connector.emit('session_request', null, handshake(4160))
        await flush()
        await onProposal.mock.calls[0][0].approve(['AAAA'])
        connector.connected = true
        connector.emit('algo_signTxn', null, {
            id: 7,
            params: [[{ txn: 'dHhu' }]],
        })
        await flush()
        const message = onMessage.mock.calls[0][0]
        if (message.kind !== 'request') throw new Error('expected a request')

        // A dead socket with no peer to recreate against: the revival fails.
        connector._transport.connected = false
        connector.peerId = ''
        await expect(
            message.respond({ type: 'sign-transactions', signed: ['c2ln'] }),
        ).rejects.toThrow()
        expect(connector.approveRequest).not.toHaveBeenCalled()

        connector._transport.connected = true
        await message.respond({ type: 'sign-transactions', signed: ['c2ln'] })

        expect(connector.approveRequest).toHaveBeenCalledTimes(1)
        await registry.teardown()
    })

    it('rejects a request that belongs to no stored session instead of forwarding it', async () => {
        const { handler, onMessage } = await setup()
        await handler.pair(V1_URI)
        const connector = lastConnector()

        connector.emit('algo_signTxn', null, {
            id: 9,
            params: [[{ txn: 'dHhu' }]],
        })
        await flush()

        expect(onMessage).not.toHaveBeenCalled()
        expect(connector.rejectRequest).toHaveBeenCalledWith(
            expect.objectContaining({ id: 9 }),
        )
    })

    it('rebuilds a stored session from its stored session key', async () => {
        keys.set('c1', 'restored-key')

        const { handler } = await setup([SEEDED])
        const restored = await handler.restore()

        expect(restored).toHaveLength(1)
        expect(restored[0].status).toBe('active')
        expect(getConnector('c1')).toBeDefined()
        expect(wc.FakeConnector.instances).toHaveLength(1)
        expect(wc.FakeConnector.instances[0].options.session).toMatchObject({
            clientId: 'c1',
            key: 'restored-key',
            bridge: 'https://b.example',
            peerId: 'peer-1',
        })
    })

    it('rebinds a surviving connector when the handler is remounted', async () => {
        // `teardown` deliberately leaves sockets alive and the connector
        // registry is module-global, so a remount (`ConnectionsProvider`, or
        // StrictMode's mount/unmount/mount) leaves live connectors holding the
        // previous instance's closures — whose context is null. Unrepaired, an
        // inbound request is answered to nobody and reported to nobody.
        keys.set('c1', 'restored-key')
        const first = await setupRestored([SEEDED])
        const connector = lastConnector()
        connector.connected = true
        await first.handler.teardown()

        const second = await setupRestored([SEEDED])

        // The socket survived, so nothing was rebuilt — only rebound.
        expect(wc.FakeConnector.instances).toHaveLength(1)

        connector.emit('algo_signTxn', null, {
            id: 5,
            params: [[{ txn: 'dHhu' }]],
        })
        await flush()

        // Unrebound, this is silent: the stale closure throws in
        // `requireContext()` and bottoms out at a no-op `context?.onError`.
        expect(second.onMessage).toHaveBeenCalledTimes(1)
        const message = asRequest(second.onMessage.mock.calls[0][0])
        expect(message.correlationId).toBe('5')
        expect(message.authorizedAccounts).toEqual(['AAAA'])
    })

    it('reports a session whose key is gone as inactive rather than dropping it', async () => {
        const { handler, records } = await setup([SEEDED])

        const restored = await handler.restore()

        // Dropping it would make the dApp vanish from settings while its
        // unusable record stayed on disk.
        expect(restored).toHaveLength(1)
        expect(restored[0].status).toBe('inactive')
        expect((await records())[0].status).toBe('inactive')
        expect(wc.FakeConnector.instances).toHaveLength(0)
    })

    it('reports a session whose connector could not be rebuilt as inactive', async () => {
        // Settings renders `status` as the user-visible Connected badge, so
        // leaving `active` on a session with no socket makes the list lie.
        keys.set('c1', 'restored-key')
        const broken: Connection = {
            ...SEEDED,
            metadata: { ...SEEDED.metadata, bridge: 'not-a-bridge' },
        }

        const { handler, records, onError } = await setup([broken])
        const restored = await handler.restore()

        expect(onError).toHaveBeenCalled()
        expect(restored[0].status).toBe('inactive')
        expect((await records())[0].status).toBe('inactive')
    })

    it('disconnecting kills the session and clears the key, connector and record', async () => {
        keys.set('c1', 'restored-key')
        const { handler, records } = await setupRestored([SEEDED])
        const connector = lastConnector()
        connector.connected = true

        await handler.disconnect('c1')

        expect(connector.killSession).toHaveBeenCalled()
        expect(getConnector('c1')).toBeUndefined()
        expect(sessionKeys.has('c1')).toBe(false)
        expect(await records()).toEqual([])
    })

    it('routes a peer-initiated disconnect through the registry', async () => {
        keys.set('c1', 'restored-key')
        const { onDisconnected } = await setupRestored([SEEDED])

        lastConnector().emit('disconnect', null, null)
        await flush()

        expect(onDisconnected).toHaveBeenCalledWith('c1')
        expect(getConnector('c1')).toBeUndefined()
        expect(sessionKeys.has('c1')).toBe(false)
    })

    it('ignores the bridge replaying the handshake it already approved', async () => {
        const { connector, onProposal, onError } = await connect()
        onProposal.mockClear()

        connector.emit('session_request', null, handshake(4160, 42))
        await flush()

        expect(onProposal).not.toHaveBeenCalled()
        expect(onError).not.toHaveBeenCalled()
    })

    it('never lets a listener reject into the SDK, which has nowhere to put it', async () => {
        // A frame that arrives before initialize (or after teardown) makes the
        // handler's context lookup throw. Unguarded, that rejects inside the
        // connector's own listener and escapes as an unhandled rejection —
        // which vitest fails the file for, so this test is the guard.
        const handler = createWalletConnectV1Handler({
            getNetwork: testGetNetwork,
            sessionKeys,
        })
        await handler.pair(V1_URI)

        lastConnector().emit('algo_signTxn', null, {
            id: 3,
            params: [[{ txn: 'dHhu' }]],
        })

        await expect(flush()).resolves.toBeUndefined()
    })

    it('refuses a fresh handshake on a settled session', async () => {
        const { connector, onProposal, onError } = await connect()
        onProposal.mockClear()

        // A different id is a peerMeta-overwrite attempt, not a replay.
        connector.emit('session_request', null, handshake(4160, 99))
        await flush()

        expect(onProposal).not.toHaveBeenCalled()
        expect(onError).toHaveBeenCalled()
    })

    it('writes the origin handed to pair onto the approved record', async () => {
        const origin: ConnectionOrigin = {
            source: 'external-browser',
            browserName: 'safari',
        }
        const { handler, onProposal, records } = await setup()
        await handler.pair(V1_URI, { origin })
        lastConnector().emit('session_request', null, handshake(4160))
        await flush()

        const connection = await onProposal.mock.calls[0][0].approve(['AAAA'])

        expect(connection.origin).toEqual(origin)
        expect((await records())[0].origin).toEqual(origin)
    })

    it('approves without an origin when pair was given none', async () => {
        const { connector, records } = await connect()

        expect(connector.approveSession).toHaveBeenCalled()
        expect((await records())[0]).not.toHaveProperty('origin')
    })

    it('abandonPairing tears down a pairing that never produced a session', async () => {
        const { handler, onProposal } = await setup()
        const pairingId = await handler.pair(V1_URI)
        const connector = lastConnector()

        handler.abandonPairing(pairingId)
        connector.emit('session_request', null, handshake(4160))
        await flush()

        expect(connector.transportClose).toHaveBeenCalled()
        expect(getConnector(pairingId)).toBeUndefined()
        expect(onProposal).not.toHaveBeenCalled()
    })

    it('scopes a pairing-phase failure to the pairing id', async () => {
        const { handler, onError } = await setup()
        const pairingId = await handler.pair(V1_URI)

        // The network store stands in at mainnet; 416_002 is TestNet.
        lastConnector().emit('session_request', null, handshake(416_002))
        await flush()

        expect(onError).toHaveBeenCalledTimes(1)
        expect(onError.mock.calls[0][1]).toEqual({ pairingId })
    })

    it('scopes a failure on an approved session to the connection id', async () => {
        const { connector, onError } = await connect()

        // No request id: the frame can only be dropped and reported.
        connector.emit('algo_signTxn', null, { params: [[{ txn: 'dHhu' }]] })
        await flush()

        expect(onError).toHaveBeenCalledTimes(1)
        expect(onError.mock.calls[0][1]).toEqual({
            connectionId: connector.clientId,
        })
    })

    it('networksFor expands the 4160 wildcard and pins an explicit chain id', () => {
        const registry = createConnectionRegistry({ store: memoryStore() })
        registry.register(
            createWalletConnectV1Handler({
                getNetwork: testGetNetwork,
                sessionKeys,
            }),
        )
        const at = (chainId: number): Connection => ({
            ...SEEDED,
            metadata: { ...SEEDED.metadata, chainId },
        })

        expect([...registry.networksFor(at(4160))].sort()).toEqual([
            'betanet',
            'custom',
            'mainnet',
            'testnet',
        ])
        expect(registry.networksFor(at(416_001))).toEqual(['mainnet'])
    })

    it('networksFor is empty, not a throw, for an own-kind record with no metadata', () => {
        // `restore()` already proves malformed own-kind records reach the
        // store; `matchesNetwork` must not be the place they blow up.
        const registry = createConnectionRegistry({ store: memoryStore() })
        registry.register(
            createWalletConnectV1Handler({
                getNetwork: testGetNetwork,
                sessionKeys,
            }),
        )
        const { metadata: _metadata, ...noMetadata } = SEEDED

        expect(registry.networksFor(noMetadata)).toEqual([])
    })

    it('reads the peer through the shared toPeer', async () => {
        const { handler } = await setup()
        await handler.pair(V1_URI)

        lastConnector().emit('session_request', null, handshake(4160))
        await flush()

        expect(toPeer).toHaveBeenCalledTimes(1)
    })

    it('declining a proposal closes the pairing socket instead of leaking it', async () => {
        // The SDK's `rejectSession` fires 'disconnect' synchronously and
        // leaves the transport open; the disconnect listener forgets the
        // connector before any lookup-based teardown can find it.
        const { handler, onProposal } = await setup()
        const pairingId = await handler.pair(V1_URI)
        const connector = lastConnector()
        connector.emit('session_request', null, handshake(4160))
        await flush()

        await onProposal.mock.calls[0][0].reject('nope')

        expect(connector.rejectSession).toHaveBeenCalledWith({
            message: 'nope',
        })
        expect(connector.transportClose).toHaveBeenCalledTimes(1)
        expect(connector.listeners.size).toBe(0)
        expect(getConnector(pairingId)).toBeUndefined()
    })

    it('closes the pairing socket after rejecting a handshake for another network', async () => {
        const { handler, onProposal } = await setup()
        const pairingId = await handler.pair(V1_URI)
        const connector = lastConnector()

        connector.emit('session_request', null, handshake(416_002))
        await flush()

        expect(onProposal).not.toHaveBeenCalled()
        expect(connector.transportClose).toHaveBeenCalledTimes(1)
        expect(connector.listeners.size).toBe(0)
        expect(getConnector(pairingId)).toBeUndefined()
    })

    it('builds one connector per session when restore runs concurrently', async () => {
        keys.set('c1', 'restored-key')
        const { handler } = await setup([SEEDED])

        await Promise.all([handler.restore(), handler.restore()])

        expect(wc.FakeConnector.instances).toHaveLength(1)
        expect(getConnector('c1') as unknown).toBe(
            wc.FakeConnector.instances[0],
        )
    })

    it('re-initialising without a teardown replaces the sweep instead of stacking it', async () => {
        const handler = createWalletConnectV1Handler({
            getNetwork: testGetNetwork,
            sessionKeys,
        })
        const context: ConnectionHandlerContext = {
            store: memoryStore(),
            onProposal: vi.fn(),
            onMessage: vi.fn(),
            onDisconnected: vi.fn(),
            onError: vi.fn(),
        }

        await handler.initialize(context)
        await handler.initialize(context)
        await handler.teardown()

        const subscriptions = vi.mocked(AppState.addEventListener).mock.results
        expect(subscriptions).toHaveLength(2)
        for (const subscription of subscriptions) {
            expect(subscription.value.remove).toHaveBeenCalledTimes(1)
        }
    })

    it('marks a revived session active again', async () => {
        // Settings renders `status` as the Connected badge; a session that
        // was inactive on the last boot and has a socket now must say so.
        keys.set('c1', 'restored-key')
        const { handler, records } = await setup([
            { ...SEEDED, status: 'inactive' },
        ])

        const restored = await handler.restore()

        expect(restored[0].status).toBe('active')
        expect((await records())[0].status).toBe('active')
    })

    it('whitelists the requested permissions against the methods the wallet supports', async () => {
        const { handler, onProposal, records } = await setup()
        await handler.pair(V1_URI)

        lastConnector().emit('session_request', null, {
            id: 42,
            params: [
                {
                    peerMeta: { name: 'Tinyman' },
                    chainId: 4160,
                    permissions: ['algo_signTxn', 'eth_sendTransaction', 7],
                },
            ],
        })
        await flush()

        const proposal = onProposal.mock.calls[0][0]
        expect(proposal.requested.methods).toEqual(['algo_signTxn'])
        await proposal.approve(['AAAA'])
        expect((await records())[0].metadata?.permissions).toEqual([
            'algo_signTxn',
        ])
    })

    it('forgets a pending origin on teardown', async () => {
        const origin: ConnectionOrigin = {
            source: 'external-browser',
            browserName: 'safari',
        }
        const first = await setup()
        await first.handler.pair(V1_URI, { origin })
        await first.handler.teardown()
        const onProposal = vi.fn<(proposal: ConnectionProposal) => void>()
        await first.handler.initialize({
            store: memoryStore(),
            onProposal,
            onMessage: vi.fn(),
            onDisconnected: vi.fn(),
            onError: vi.fn(),
        })

        // The connector outlives the teardown and is still bound to this
        // handler, so the handshake still proposes — just without an origin.
        lastConnector().emit('session_request', null, handshake(4160))
        await flush()
        const connection = await onProposal.mock.calls[0][0].approve(['AAAA'])

        expect(connection).not.toHaveProperty('origin')
    })

    it('keeps a stored origin when the same client re-pairs without one', async () => {
        const origin: ConnectionOrigin = {
            source: 'external-browser',
            browserName: 'safari',
        }
        const { handler, onProposal, records } = await setup()
        await handler.pair(V1_URI, { origin })
        lastConnector().emit('session_request', null, handshake(4160))
        await flush()
        await onProposal.mock.calls[0][0].approve(['AAAA'])

        // The fake hands out the same clientId, so this is a re-approval of
        // the stored record rather than a second session.
        await handler.pair(V1_URI)
        lastConnector().emit('session_request', null, handshake(4160, 43))
        await flush()
        const connection = await onProposal.mock.calls[1][0].approve(['AAAA'])

        expect(connection.origin).toEqual(origin)
        expect((await records())[0].origin).toEqual(origin)
    })
})
