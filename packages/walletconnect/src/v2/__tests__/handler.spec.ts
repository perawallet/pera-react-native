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

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { MemoryKeyValueStorage } from '@perawallet/wallet-extension-platform'
import { memoryStore } from '@perawallet/wallet-core-connections/testing'
import {
    createConnectionRegistry,
    type ConnectionErrorScope,
    type ConnectionHandlerContext,
    type ConnectionProposal,
    type InboundMessage,
    type RawInboundMessage,
    type WalletOperationResult,
} from '@perawallet/wallet-core-connections'
import type {
    Connection,
    ConnectionOrigin,
} from '@perawallet/wallet-extension-connections'
import { logger, Networks } from '@perawallet/wallet-core-shared'
import type {
    WalletKitEvent,
    WalletKitFactory,
    WalletKitSession,
    WalletKitSessionProposal,
} from '../client'
import {
    isWalletConnectV2Connection,
    WALLET_CONNECT_V2_KIND,
} from '../connection'
import { createWalletConnectV2Handler } from '../handler'
import {
    ADDRESS,
    createFakeWalletKit,
    flush,
    MAINNET_CHAIN_ID,
    makeProposal,
    makeRequest,
    makeSession,
    OTHER_ADDRESS,
    OTHER_TOPIC,
    PAIRING_TOPIC,
    PROPOSAL_ID,
    REQUEST_ID,
    SYM_KEY,
    TESTNET_CHAIN_ID,
    TOPIC,
    TXN_GROUP,
    V1_URI,
    V2_URI,
    type FakeWalletKit,
    type RequestOverrides,
} from './fakeWalletKit'

// Same stand-in as the v1 handler spec: the connections barrel reaches the
// provider, whose keystore migration ledger imports react-native-mmkv at
// module scope and has no JS fallback under jsdom.
vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        keyValueStorage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
        },
    }),
}))

const PROJECT_ID = 'a-reown-project-id'
const NEXT_PROPOSAL_ID = 1702
const SIGN_DATA_PARAMS = {
    data: 'dGVzdA==',
    signer: ADDRESS,
    domain: 'dapp.example',
    authenticationData: 'YXV0aA==',
}
const ORIGIN: ConnectionOrigin = {
    source: 'external-browser',
    browserName: 'safari',
}

/** Everything the handler binds; asserted exhaustively in both directions. */
const EXPECTED_BOUND_EVENTS: WalletKitEvent[] = [
    'proposal_expire',
    'session_delete',
    'session_proposal',
    'session_request',
]

/** A second proposal on the same pairing, which needs an id of its own. */
const makeNextProposal = (): WalletKitSessionProposal => {
    const base = makeProposal()
    return {
        ...base,
        id: NEXT_PROPOSAL_ID,
        params: { ...base.params, id: NEXT_PROPOSAL_ID },
    }
}

const makeContext = (store = memoryStore()) => ({
    store,
    onProposal: vi.fn<ConnectionHandlerContext['onProposal']>(),
    onMessage: vi.fn<ConnectionHandlerContext['onMessage']>(),
    onDisconnected: vi.fn<ConnectionHandlerContext['onDisconnected']>(),
    onError: vi.fn<ConnectionHandlerContext['onError']>(),
})

const makeHandler = (
    overrides: {
        projectId?: string
        walletKit?: FakeWalletKit
        createWalletKit?: Mock<WalletKitFactory>
    } = {},
) => {
    const walletKit = overrides.walletKit ?? createFakeWalletKit()
    const createWalletKit =
        overrides.createWalletKit ??
        vi.fn<WalletKitFactory>(async () => walletKit)
    const keyValueStorage = new MemoryKeyValueStorage()
    const handler = createWalletConnectV2Handler({
        getNetwork: () => Networks.mainnet,
        projectId: overrides.projectId ?? PROJECT_ID,
        keyValueStorage,
        createWalletKit,
    })
    return { handler, walletKit, createWalletKit, keyValueStorage }
}

const storedV2Record = (overrides: Partial<Connection> = {}): Connection => ({
    id: TOPIC,
    kind: WALLET_CONNECT_V2_KIND,
    name: 'Stored dApp',
    peer: { name: 'Stored dApp' },
    accounts: [ADDRESS],
    status: 'active',
    createdAt: 1_700_000_000_000,
    lastActiveAt: 1_700_000_500_000,
    metadata: {
        topic: TOPIC,
        chains: [MAINNET_CHAIN_ID],
        methods: ['algo_signTxn'],
        expiry: 1_700_000_900,
    },
    ...overrides,
})

beforeEach(() => {
    vi.restoreAllMocks()
})

describe('initialize', () => {
    it('binds every WalletKit event and writes no record', async () => {
        // A live session, or "writes no record" passes on an empty relay
        // without proving initialize stayed out of the store.
        const { handler, walletKit, createWalletKit } = makeHandler({
            walletKit: createFakeWalletKit({ [TOPIC]: makeSession() }),
        })
        const context = makeContext()

        await handler.initialize(context)

        expect(createWalletKit).toHaveBeenCalledWith({
            projectId: PROJECT_ID,
            storage: expect.anything(),
        })
        expect(walletKit.boundEvents()).toEqual(EXPECTED_BOUND_EVENTS)
        // The registry calls restore() next and reconciles from it; a record
        // written here would be one restore() has not claimed.
        expect(await context.store.list()).toEqual([])
    })

    it('routes a peer hang-up to onDisconnected', async () => {
        const { handler, walletKit } = makeHandler()
        const context = makeContext()
        await handler.initialize(context)

        walletKit.emit('session_delete', { id: 1, topic: TOPIC })

        expect(context.onDisconnected).toHaveBeenCalledWith(TOPIC)
    })

    // Not reported: an unscoped error reaches the app's toast, and an
    // unconfigured build would show one on every launch.
    it('logs, and neither throws nor reports, when the project id is empty', async () => {
        const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
        const { handler, createWalletKit } = makeHandler({ projectId: '' })
        const context = makeContext()

        await expect(handler.initialize(context)).resolves.toBeUndefined()

        expect(createWalletKit).not.toHaveBeenCalled()
        expect(context.onError).not.toHaveBeenCalled()
        expect(warn).toHaveBeenCalledTimes(1)
    })

    it('refuses to pair while unavailable, so the user hears about it when it matters', async () => {
        vi.spyOn(logger, 'warn').mockImplementation(() => {})
        const { handler } = makeHandler({ projectId: '' })
        await handler.initialize(makeContext())

        await expect(handler.pair(V2_URI)).rejects.toThrow(/unavailable/)
    })

    it('claims no connections at all when v2 is unavailable', async () => {
        const { handler } = makeHandler({ projectId: '' })
        await handler.initialize(makeContext(memoryStore([storedV2Record()])))

        expect(await handler.restore()).toEqual([])
    })
})

describe('restore', () => {
    it('maps an active session to a well-formed record keyed by topic', async () => {
        const walletKit = createFakeWalletKit({ [TOPIC]: makeSession() })
        const { handler } = makeHandler({ walletKit })
        await handler.initialize(makeContext())

        const [record, ...rest] = await handler.restore()

        expect(rest).toEqual([])
        expect(record.id).toBe(TOPIC)
        expect(isWalletConnectV2Connection(record)).toBe(true)
        expect(record).toMatchObject({
            kind: WALLET_CONNECT_V2_KIND,
            name: 'Test dApp',
            peer: {
                name: 'Test dApp',
                url: 'https://dapp.example',
                description: 'A dApp',
                icons: ['https://dapp.example/icon.png'],
            },
            accounts: [ADDRESS],
            status: 'active',
            metadata: {
                topic: TOPIC,
                chains: [MAINNET_CHAIN_ID],
                methods: ['algo_signTxn'],
                expiry: 1_800_000_000,
            },
        })
    })

    it('reports timestamps in milliseconds while the expiry stays in seconds', async () => {
        const walletKit = createFakeWalletKit({ [TOPIC]: makeSession() })
        const { handler } = makeHandler({ walletKit })
        await handler.initialize(makeContext())
        const before = Date.now()

        const [record] = await handler.restore()

        expect(record.createdAt).toBeGreaterThanOrEqual(before)
        expect(record.lastActiveAt).toBeGreaterThanOrEqual(before)
        // Seconds, as the metadata type documents; a ms value here would put
        // every session ~55 millennia into the future.
        expect(record.metadata.expiry).toBe(1_800_000_000)
    })

    it('carries origin and createdAt from the stored record of the same id', async () => {
        const walletKit = createFakeWalletKit({ [TOPIC]: makeSession() })
        const { handler } = makeHandler({ walletKit })
        const stored = storedV2Record({
            origin: { source: 'external-browser', browserName: 'safari' },
        })
        await handler.initialize(makeContext(memoryStore([stored])))

        const [record] = await handler.restore()

        expect(record.origin).toEqual({
            source: 'external-browser',
            browserName: 'safari',
        })
        expect(record.createdAt).toBe(stored.createdAt)
        expect(record.lastActiveAt).toBe(stored.lastActiveAt)
    })

    it('strips the CAIP-10 prefix off every approved account', async () => {
        const walletKit = createFakeWalletKit({
            [TOPIC]: makeSession({
                namespaces: {
                    algorand: {
                        chains: [MAINNET_CHAIN_ID],
                        accounts: [
                            `${MAINNET_CHAIN_ID}:${ADDRESS}`,
                            `${MAINNET_CHAIN_ID}:${OTHER_ADDRESS}`,
                        ],
                        methods: ['algo_signTxn'],
                        events: [],
                    },
                },
            }),
        })
        const { handler } = makeHandler({ walletKit })
        await handler.initialize(makeContext())

        const [record] = await handler.restore()

        expect(record.accounts).toEqual([ADDRESS, OTHER_ADDRESS])
    })

    it('derives the chains from the accounts when the namespace omits them', async () => {
        const walletKit = createFakeWalletKit({
            [TOPIC]: makeSession({
                namespaces: {
                    algorand: {
                        accounts: [`${MAINNET_CHAIN_ID}:${ADDRESS}`],
                        methods: ['algo_signTxn'],
                        events: [],
                    },
                },
            }),
        })
        const { handler } = makeHandler({ walletKit })
        await handler.initialize(makeContext())

        const [record] = await handler.restore()

        expect(record.metadata.chains).toEqual([MAINNET_CHAIN_ID])
    })

    it('derives the chains from the accounts when the namespace declares none', async () => {
        // An empty array is representable and defeats `??`: left as `[]` the
        // record matches no network at all, so `networksFor` reports none.
        const walletKit = createFakeWalletKit({
            [TOPIC]: makeSession({
                namespaces: {
                    algorand: {
                        chains: [],
                        accounts: [`${MAINNET_CHAIN_ID}:${ADDRESS}`],
                        methods: ['algo_signTxn'],
                        events: [],
                    },
                },
            }),
        })
        const { handler } = makeHandler({ walletKit })
        await handler.initialize(makeContext())

        const [record] = await handler.restore()

        expect(record.metadata.chains).toEqual([MAINNET_CHAIN_ID])
        expect(handler.matchesNetwork(record, Networks.mainnet)).toBe(true)
    })

    it('drops a foreign-namespace account listed under algorand', async () => {
        // The namespace key does not constrain its members, and `accounts` is
        // what gates signing.
        const walletKit = createFakeWalletKit({
            [TOPIC]: makeSession({
                namespaces: {
                    algorand: {
                        chains: [MAINNET_CHAIN_ID],
                        accounts: [
                            'eip155:1:0xdeadbeef',
                            `${MAINNET_CHAIN_ID}:${ADDRESS}`,
                        ],
                        methods: ['algo_signTxn'],
                        events: [],
                    },
                },
            }),
        })
        const { handler } = makeHandler({ walletKit })
        await handler.initialize(makeContext())

        const [record] = await handler.restore()

        expect(record.accounts).toEqual([ADDRESS])
    })

    it('omits a session with no algorand namespace', async () => {
        const walletKit = createFakeWalletKit({
            [TOPIC]: makeSession({
                namespaces: {
                    eip155: {
                        accounts: ['eip155:1:0xabc'],
                        methods: ['eth_sign'],
                        events: [],
                    },
                },
            }),
        })
        const { handler } = makeHandler({ walletKit })
        await handler.initialize(makeContext())

        expect(await handler.restore()).toEqual([])
    })

    it('omits a session whose approved accounts are all unparsable', async () => {
        const walletKit = createFakeWalletKit({
            [TOPIC]: makeSession({
                namespaces: {
                    algorand: {
                        chains: [MAINNET_CHAIN_ID],
                        accounts: [MAINNET_CHAIN_ID],
                        methods: ['algo_signTxn'],
                        events: [],
                    },
                },
            }),
        })
        const { handler } = makeHandler({ walletKit })
        await handler.initialize(makeContext())

        expect(await handler.restore()).toEqual([])
    })
})

describe('reconciliation through the registry', () => {
    it('removes a stored v2 record WalletKit no longer holds', async () => {
        const walletKit = createFakeWalletKit({
            [OTHER_TOPIC]: makeSession({ topic: OTHER_TOPIC }),
        })
        const { handler } = makeHandler({ walletKit })
        const store = memoryStore([storedV2Record()])
        const registry = createConnectionRegistry({ store })
        registry.register(handler)

        await registry.initialize()

        const remaining = await store.list()
        expect(remaining.map(({ id }) => id)).toEqual([OTHER_TOPIC])
    })

    it('leaves another kind alone while pruning its own', async () => {
        const { handler } = makeHandler()
        const v1Record: Connection = {
            ...storedV2Record({ id: 'v1-connection' }),
            kind: 'walletconnect-v1',
        }
        const store = memoryStore([storedV2Record(), v1Record])
        const registry = createConnectionRegistry({ store })
        registry.register(handler)

        await registry.initialize()

        expect((await store.list()).map(({ id }) => id)).toEqual([
            'v1-connection',
        ])
    })
})

describe('teardown', () => {
    it('unbinds every event and closes the relay transport', async () => {
        const { handler, walletKit } = makeHandler()
        await handler.initialize(makeContext())

        await handler.teardown()

        expect(walletKit.boundEvents()).toEqual([])
        expect(walletKit.transportClose).toHaveBeenCalledTimes(1)
    })

    it('survives a transport that refuses to close', async () => {
        const walletKit = createFakeWalletKit()
        walletKit.transportClose.mockRejectedValue(new Error('socket stuck'))
        const { handler } = makeHandler({ walletKit })
        await handler.initialize(makeContext())

        await expect(handler.teardown()).resolves.toBeUndefined()
    })

    it('drops the client, so a torn-down handler claims nothing', async () => {
        const walletKit = createFakeWalletKit({ [TOPIC]: makeSession() })
        const { handler } = makeHandler({ walletKit })
        await handler.initialize(makeContext())
        expect((await handler.restore()).map(({ id }) => id)).toEqual([TOPIC])

        await handler.teardown()

        expect(await handler.restore()).toEqual([])
    })

    it('rebuilds the client on the next initialize', async () => {
        const first = createFakeWalletKit()
        const second = createFakeWalletKit({ [TOPIC]: makeSession() })
        const createWalletKit = vi
            .fn<WalletKitFactory>()
            .mockResolvedValueOnce(first)
            .mockResolvedValueOnce(second)
        const { handler } = makeHandler({ createWalletKit })

        await handler.initialize(makeContext())
        await handler.teardown()
        await handler.initialize(makeContext())

        expect(createWalletKit).toHaveBeenCalledTimes(2)
        expect(second.boundEvents()).toEqual(EXPECTED_BOUND_EVENTS)
        expect((await handler.restore()).map(({ id }) => id)).toEqual([TOPIC])
    })

    it('does nothing when v2 never came up', async () => {
        const { handler, walletKit } = makeHandler({ projectId: '' })
        await handler.initialize(makeContext())

        await expect(handler.teardown()).resolves.toBeUndefined()
        expect(walletKit.transportClose).not.toHaveBeenCalled()
    })

    // The registry `allSettled`s teardown over every handler, including ones
    // whose `initialize` it never reached.
    it('resolves before any initialize', async () => {
        const { handler } = makeHandler()

        await expect(handler.teardown()).resolves.toBeUndefined()
    })

    it('releases the previous client when initialize runs twice', async () => {
        // Otherwise the old client keeps its listeners and its relay socket,
        // and every inbound frame arrives twice.
        const first = createFakeWalletKit()
        const second = createFakeWalletKit()
        const createWalletKit = vi
            .fn<WalletKitFactory>()
            .mockResolvedValueOnce(first)
            .mockResolvedValueOnce(second)
        const { handler } = makeHandler({ createWalletKit })

        await handler.initialize(makeContext())
        await handler.initialize(makeContext())

        expect(first.boundEvents()).toEqual([])
        expect(first.transportClose).toHaveBeenCalledTimes(1)
        expect(second.boundEvents()).toEqual(EXPECTED_BOUND_EVENTS)
    })
})

/**
 * A live session whose peer AND approved account both differ from the stored
 * record, so a message sourced from the session instead of the record fails on
 * either field rather than only on the peer.
 */
const makeDivergentSession = (): WalletKitSession =>
    makeSession({
        namespaces: {
            algorand: {
                chains: [MAINNET_CHAIN_ID],
                accounts: [`${MAINNET_CHAIN_ID}:${OTHER_ADDRESS}`],
                methods: ['algo_signTxn'],
                events: [],
            },
        },
    })

/**
 * A live session and a stored record for it, driven through the handler and a
 * fake context: the raw message is what the registry's validator receives, so
 * these assertions have to see it before validation.
 */
const openSession = async (
    options: { walletKit?: FakeWalletKit; seed?: Connection[] } = {},
) => {
    const walletKit =
        options.walletKit ??
        createFakeWalletKit({ [TOPIC]: makeDivergentSession() })
    const { handler } = makeHandler({ walletKit })
    const store = memoryStore(options.seed ?? [storedV2Record()])
    const context = makeContext(store)
    await handler.initialize(context)

    const request = async (overrides: RequestOverrides = {}): Promise<void> => {
        walletKit.emit('session_request', makeRequest(overrides))
        await flush()
    }

    const requireRequest = (): Extract<
        RawInboundMessage,
        { kind: 'request' }
    > => {
        const message = context.onMessage.mock.calls.at(-1)?.[0]
        if (!message || message.kind !== 'request') {
            throw new Error('no raw request reached the registry')
        }
        return message
    }

    return { handler, walletKit, store, context, request, requireRequest }
}

describe('session requests', () => {
    it('emits a raw message carrying the stored record, with the params untouched', async () => {
        const { request, requireRequest, context } = await openSession()

        await request()

        const message = requireRequest()
        expect(message).toMatchObject({
            connectionId: TOPIC,
            correlationId: String(REQUEST_ID),
            sourceType: 'walletconnect',
            // From the RECORD, not the session: these become ARC-0001's
            // `authorizedAddresses` and the sheet's anti-spoofing identity.
            // The session names a different peer and a different account, so
            // sourcing either from it fails here.
            authorizedAccounts: [ADDRESS],
            peer: { name: 'Stored dApp' },
            rawOperation: { type: 'sign-transactions' },
        })
        // The ARC-0001 group with its JSON-RPC envelope off and every slot as
        // the dApp sent it: a copy of the schema here would strip the `msig`
        // the resolver answers 4200 for.
        expect(message.rawOperation.params).toEqual(TXN_GROUP)
        expect(context.onError).not.toHaveBeenCalled()
    })

    it('maps the data method to a sign-data operation, params and all', async () => {
        const { request, requireRequest } = await openSession()

        await request({ method: 'algo_signData', params: SIGN_DATA_PARAMS })

        const message = requireRequest()
        expect(message.rawOperation.type).toBe('sign-data')
        expect(message.rawOperation.params).toEqual(SIGN_DATA_PARAMS)
    })

    it('refuses a request for a topic it holds no record for', async () => {
        const { request, walletKit, context } = await openSession({ seed: [] })

        await request()

        expect(context.onMessage).not.toHaveBeenCalled()
        expect(walletKit.respondSessionRequest).toHaveBeenCalledWith({
            topic: TOPIC,
            response: {
                id: REQUEST_ID,
                jsonrpc: '2.0',
                error: expect.objectContaining({ code: 6000 }),
            },
        })
        expect(context.onError).toHaveBeenCalledWith(
            expect.any(Error),
            expect.objectContaining({ connectionId: TOPIC }),
        )
    })

    it('refuses a request on a chain that is not the active network', async () => {
        // The session is approved for every chain the dApp asked for; the
        // active network is what decides which one may sign.
        const { request, walletKit, context } = await openSession()

        await request({ chainId: TESTNET_CHAIN_ID })

        expect(context.onMessage).not.toHaveBeenCalled()
        expect(walletKit.respondSessionRequest).toHaveBeenCalledWith({
            topic: TOPIC,
            response: {
                id: REQUEST_ID,
                jsonrpc: '2.0',
                error: expect.objectContaining({ code: 5100 }),
            },
        })
        expect(context.onError).toHaveBeenCalledWith(
            expect.any(Error),
            expect.objectContaining({ connectionId: TOPIC }),
        )
    })

    it('refuses a method it does not serve', async () => {
        const { request, walletKit, context } = await openSession()

        await request({ method: 'algo_getAccounts' })

        expect(context.onMessage).not.toHaveBeenCalled()
        expect(walletKit.respondSessionRequest).toHaveBeenCalledWith({
            topic: TOPIC,
            response: {
                id: REQUEST_ID,
                jsonrpc: '2.0',
                error: expect.objectContaining({ code: 5101 }),
            },
        })
        expect(context.onError).toHaveBeenCalledWith(
            expect.any(Error),
            expect.objectContaining({ connectionId: TOPIC }),
        )
    })

    it('stamps the stored record with the request time', async () => {
        // The settings list sorts on `lastActiveAt`, so without this it stays
        // in approval order for the life of the session.
        const stored = storedV2Record()
        const { request, store } = await openSession({ seed: [stored] })

        await request()

        const after = await store.get(TOPIC)
        expect(after?.lastActiveAt).toBeGreaterThan(stored.lastActiveAt)
        // A full record, not a patch: a partial upsert makes the row fail its
        // own guard and vanish from every read.
        expect(after).toEqual({
            ...stored,
            lastActiveAt: after?.lastActiveAt,
        })
    })

    it('sends the slot-ordered result back to the peer', async () => {
        const { request, requireRequest, walletKit } = await openSession()
        await request()

        await requireRequest().respond({
            type: 'sign-transactions',
            signed: ['c2lnbmVk', null],
        })

        expect(walletKit.respondSessionRequest).toHaveBeenCalledWith({
            topic: TOPIC,
            response: {
                id: REQUEST_ID,
                jsonrpc: '2.0',
                result: ['c2lnbmVk', null],
            },
        })
    })

    it('sends a rejection to the peer as a JSON-RPC error', async () => {
        const { request, requireRequest, walletKit } = await openSession()
        await request()

        await requireRequest().reject(new Error('user declined'))

        expect(walletKit.respondSessionRequest).toHaveBeenCalledWith({
            topic: TOPIC,
            response: {
                id: REQUEST_ID,
                jsonrpc: '2.0',
                error: { code: -32_000, message: 'user declined' },
            },
        })
    })

    it('rejects respond when the response never lands, leaving the request answerable', async () => {
        // The rejection is how the signing pipeline learns nothing reached the
        // peer; the registry's once-only guard releases on it so a retry can
        // still answer.
        const walletKit = createFakeWalletKit({ [TOPIC]: makeSession() })
        walletKit.respondSessionRequest.mockRejectedValueOnce(
            new Error('relay down'),
        )
        const { handler } = makeHandler({ walletKit })
        const store = memoryStore([storedV2Record()])
        const registry = createConnectionRegistry({ store })
        registry.register(handler)
        const messages: InboundMessage[] = []
        registry.subscribeToMessages(message => void messages.push(message))
        await registry.initialize()

        walletKit.emit('session_request', makeRequest())
        await flush()

        const message = messages.at(-1)
        if (!message || message.kind !== 'request') {
            throw new Error('no validated request reached the subscriber')
        }
        const result: WalletOperationResult = {
            type: 'sign-transactions',
            signed: ['c2lnbmVk', null],
        }
        await expect(message.respond(result)).rejects.toThrow(/relay down/)
        await expect(message.respond(result)).resolves.toBeUndefined()
        expect(walletKit.respondSessionRequest).toHaveBeenCalledTimes(2)
        await registry.teardown()
    })
})

describe('disconnecting', () => {
    it('tells the peer and removes the record', async () => {
        const { handler, walletKit, store } = await openSession()

        await handler.disconnect(TOPIC)

        expect(walletKit.disconnectSession).toHaveBeenCalledWith({
            topic: TOPIC,
            reason: expect.objectContaining({ code: 6000 }),
        })
        expect(await store.list()).toEqual([])
    })

    it('removes the record even when the peer is unreachable', async () => {
        const walletKit = createFakeWalletKit({ [TOPIC]: makeSession() })
        walletKit.disconnectSession.mockRejectedValue(new Error('relay down'))
        const { handler, store } = await openSession({ walletKit })

        await expect(handler.disconnect(TOPIC)).resolves.toBeUndefined()

        expect(await store.list()).toEqual([])
    })

    it('sweeps its own kind and leaves another kind alone', async () => {
        const v1Record: Connection = {
            ...storedV2Record({ id: 'v1-connection' }),
            kind: 'walletconnect-v1',
        }
        const walletKit = createFakeWalletKit({
            [TOPIC]: makeSession(),
            [OTHER_TOPIC]: makeSession({ topic: OTHER_TOPIC }),
        })
        // One unreachable peer must not abort the sweep.
        walletKit.disconnectSession.mockRejectedValueOnce(
            new Error('relay down'),
        )
        const { handler, store } = await openSession({
            walletKit,
            seed: [
                storedV2Record(),
                storedV2Record({ id: OTHER_TOPIC }),
                v1Record,
            ],
        })

        await handler.disconnectAll()

        expect((await store.list()).map(({ id }) => id)).toEqual([
            'v1-connection',
        ])
    })

    it('removes the record when the peer hangs up', async () => {
        const walletKit = createFakeWalletKit({ [TOPIC]: makeSession() })
        const { handler } = makeHandler({ walletKit })
        const store = memoryStore([storedV2Record()])
        const registry = createConnectionRegistry({ store })
        registry.register(handler)
        await registry.initialize()

        walletKit.emit('session_delete', { id: 1, topic: TOPIC })
        await flush()

        expect(await store.list()).toEqual([])
        await registry.teardown()
    })
})

describe('mid-run session expiry', () => {
    it('treats an expired session topic like a peer hang-up', async () => {
        // WalletKit forwards no `session_expire`, so a session that expires
        // while the app is open would otherwise sit in settings as active
        // until the next restore().
        const { walletKit, context } = await openSession()

        walletKit.emitExpired(`topic:${TOPIC}`)
        await flush()

        expect(context.onDisconnected).toHaveBeenCalledWith(TOPIC)
    })

    it('ignores an expiry that names no session of its own', async () => {
        const { walletKit, context } = await openSession()

        walletKit.emitExpired(`topic:${PAIRING_TOPIC}`)
        walletKit.emitExpired(`id:${REQUEST_ID}`)
        await flush()

        expect(context.onDisconnected).not.toHaveBeenCalled()
    })

    it('unbinds the expirer on teardown', async () => {
        const { handler, walletKit, context } = await openSession()
        expect(walletKit.expirerListenerCount()).toBe(1)

        await handler.teardown()
        walletKit.emitExpired(`topic:${TOPIC}`)
        await flush()

        expect(walletKit.expirerListenerCount()).toBe(0)
        expect(context.onDisconnected).not.toHaveBeenCalled()
    })
})

/** The URI trio plus `abandonPairing`, narrowed off the optional members. */
const uriPairing = (
    handler: ReturnType<typeof createWalletConnectV2Handler>,
) => {
    const { canHandleUri, pair, describeUri, abandonPairing } = handler
    if (!canHandleUri || !pair || !describeUri || !abandonPairing) {
        throw new Error('the v2 handler declares no URI pairing')
    }
    return { canHandleUri, pair, describeUri, abandonPairing }
}

describe('URI pairing', () => {
    it('claims a v2 pairing URI and declines a v1 one', () => {
        const { canHandleUri } = uriPairing(makeHandler().handler)

        expect(canHandleUri(V2_URI)).toBe(true)
        expect(canHandleUri(V1_URI)).toBe(false)
    })

    it('refuses to pair a v1 URI rather than resolving silently', async () => {
        const { handler, walletKit } = makeHandler()
        await handler.initialize(makeContext())

        await expect(uriPairing(handler).pair(V1_URI)).rejects.toThrow()
        expect(walletKit.pair).not.toHaveBeenCalled()
    })

    it('resolves with the pairing topic, which is not the session topic', async () => {
        const { handler, walletKit } = makeHandler()
        await handler.initialize(makeContext())

        await expect(uriPairing(handler).pair(V2_URI)).resolves.toBe(
            PAIRING_TOPIC,
        )

        expect(walletKit.pair).toHaveBeenCalledWith({ uri: V2_URI })
    })

    it('describes a URI without its symKey', () => {
        const { describeUri } = uriPairing(makeHandler().handler)

        const described = describeUri(V2_URI)

        expect(JSON.stringify(described)).not.toContain('symKey')
        expect(JSON.stringify(described)).not.toContain(SYM_KEY)
        expect(described).toEqual({
            version: '2',
            topic: PAIRING_TOPIC,
            relay: 'irn',
        })
    })
})

type OpenProposalOptions = {
    walletKit?: FakeWalletKit
    seed?: Connection[]
    origin?: ConnectionOrigin
    proposal?: WalletKitSessionProposal
}

/**
 * Pairs through the registry and hands back everything the assertions need.
 * The registry is the subject on purpose: the proposal invariants are what a
 * caller sees, not what the handler happens to hold.
 */
const openPairing = async (options: OpenProposalOptions = {}) => {
    const walletKit = options.walletKit ?? createFakeWalletKit()
    const { handler } = makeHandler({ walletKit })
    const store = memoryStore(options.seed ?? [])
    const registry = createConnectionRegistry({ store })
    registry.register(handler)
    const proposals: ConnectionProposal[] = []
    registry.subscribeToProposals(next => void proposals.push(next))
    const errors: { error: Error; scope?: ConnectionErrorScope }[] = []
    registry.subscribeToErrors(
        (error, scope) =>
            void errors.push({
                error,
                scope,
            }),
    )
    await registry.initialize()

    const pairingId = await registry.pair(
        V2_URI,
        options.origin ? { origin: options.origin } : undefined,
    )

    const propose = async (
        proposal: WalletKitSessionProposal = makeProposal(),
    ): Promise<void> => {
        walletKit.emit('session_proposal', proposal)
        await flush()
    }

    const requireProposal = (): ConnectionProposal => {
        const proposal = proposals.at(-1)
        if (!proposal) throw new Error('the peer proposal never arrived')
        return proposal
    }

    return {
        handler,
        walletKit,
        store,
        registry,
        pairingId,
        proposals,
        errors,
        propose,
        requireProposal,
    }
}

const openProposal = async (options: OpenProposalOptions = {}) => {
    const opened = await openPairing(options)
    await opened.propose(options.proposal)
    return opened
}

describe('session proposals', () => {
    it('carries the pairing topic and the networks the CAIP-2 chains name', async () => {
        const { pairingId, requireProposal, registry } = await openProposal()

        const proposal = requireProposal()

        expect(proposal.kind).toBe(WALLET_CONNECT_V2_KIND)
        expect(proposal.pairingId).toBe(PAIRING_TOPIC)
        expect(proposal.pairingId).toBe(pairingId)
        expect(proposal.requested.networks).toEqual([Networks.mainnet])
        expect(proposal.requested.methods).toEqual(['algo_signTxn'])
        expect(proposal.peer.name).toBe('Test dApp')
        // The proposal reports SECONDS; every other expiry here is ms.
        expect(proposal.expiresAt).toBe(1_800_000_000_000)
        await registry.teardown()
    })

    it('maps the optional namespaces back to networks alongside the required ones', async () => {
        const { requireProposal, registry } = await openProposal({
            proposal: makeProposal({
                optionalNamespaces: {
                    algorand: {
                        chains: [TESTNET_CHAIN_ID, 'eip155:1'],
                        methods: ['algo_signData', 'eth_sign'],
                        events: [],
                    },
                },
            }),
        })

        const proposal = requireProposal()

        expect(proposal.requested.networks).toEqual([
            Networks.mainnet,
            Networks.testnet,
        ])
        // `eth_sign` is not a method this wallet implements.
        expect(proposal.requested.methods).toEqual([
            'algo_signTxn',
            'algo_signData',
        ])
        await registry.teardown()
    })

    it('rejects a proposal for chains it has no network for, and never surfaces it', async () => {
        const { proposals, walletKit, errors, registry } = await openProposal({
            proposal: makeProposal({
                requiredNamespaces: {
                    algorand: {
                        chains: [`algorand:${'z'.repeat(32)}`],
                        methods: ['algo_signTxn'],
                        events: [],
                    },
                },
            }),
        })

        expect(proposals).toEqual([])
        expect(walletKit.rejectSession).toHaveBeenCalledWith({
            id: PROPOSAL_ID,
            reason: expect.objectContaining({ code: expect.any(Number) }),
        })
        expect(errors.at(-1)?.scope).toEqual({ pairingId: PAIRING_TOPIC })
        await registry.teardown()
    })

    it('rejects a proposal requiring a method Pera does not serve', async () => {
        // `algo_getAccounts` is v1's own third permission and has no v2
        // equivalent; shown, it would fail under Connect with a raw library
        // error no retry can fix.
        const { proposals, walletKit, errors, registry } = await openProposal({
            proposal: makeProposal({
                requiredNamespaces: {
                    algorand: {
                        chains: [MAINNET_CHAIN_ID],
                        methods: ['algo_signTxn', 'algo_getAccounts'],
                        events: [],
                    },
                },
            }),
        })

        expect(proposals).toEqual([])
        expect(walletKit.rejectSession).toHaveBeenCalledWith({
            id: PROPOSAL_ID,
            reason: expect.objectContaining({ code: 5101 }),
        })
        expect(errors.at(-1)?.scope).toEqual({ pairingId: PAIRING_TOPIC })
        // Same teardown a user rejection gets: a live pairing lets a
        // persistent dApp re-propose into an error toast from nowhere.
        expect(walletKit.pairingDisconnect).toHaveBeenCalledWith({
            topic: PAIRING_TOPIC,
        })
        await registry.teardown()
    })

    it('clears the pairing origin when it screens a proposal out', async () => {
        const { walletKit, propose, requireProposal, registry } =
            await openProposal({
                origin: ORIGIN,
                proposal: makeProposal({
                    requiredNamespaces: {
                        algorand: {
                            chains: [MAINNET_CHAIN_ID],
                            methods: ['algo_getAccounts'],
                            events: [],
                        },
                    },
                }),
            })
        walletKit.approveSession.mockImplementationOnce(
            async ({ namespaces }) =>
                makeSession({ topic: OTHER_TOPIC, namespaces }),
        )

        await propose()
        const connection = await requireProposal().approve([ADDRESS])

        expect(connection.origin).toBeUndefined()
        await registry.teardown()
    })

    it('rejects a proposal naming no chain it can serve, and tears the pairing down', async () => {
        // Screening only sees the REQUIRED namespaces, so a proposal that
        // asks for everything optionally reaches the network resolution and
        // dies there.
        const { proposals, walletKit, errors, registry } = await openProposal({
            proposal: makeProposal({
                requiredNamespaces: {},
                optionalNamespaces: {},
            }),
        })

        expect(proposals).toEqual([])
        expect(walletKit.rejectSession).toHaveBeenCalledWith({
            id: PROPOSAL_ID,
            reason: expect.objectContaining({ code: expect.any(Number) }),
        })
        expect(errors.at(-1)?.scope).toEqual({ pairingId: PAIRING_TOPIC })
        expect(walletKit.pairingDisconnect).toHaveBeenCalledWith({
            topic: PAIRING_TOPIC,
        })
        await registry.teardown()
    })

    it('rejects a proposal requiring an unknown chain beside a known one', async () => {
        const { proposals, walletKit, registry } = await openProposal({
            proposal: makeProposal({
                requiredNamespaces: {
                    algorand: {
                        chains: [
                            MAINNET_CHAIN_ID,
                            `algorand:${'z'.repeat(32)}`,
                        ],
                        methods: ['algo_signTxn'],
                        events: [],
                    },
                },
            }),
        })

        expect(proposals).toEqual([])
        expect(walletKit.rejectSession).toHaveBeenCalledWith({
            id: PROPOSAL_ID,
            reason: expect.objectContaining({ code: 5100 }),
        })
        await registry.teardown()
    })

    it('rejects a proposal requiring a namespace outside algorand', async () => {
        const { proposals, walletKit, registry } = await openProposal({
            proposal: makeProposal({
                requiredNamespaces: {
                    algorand: {
                        chains: [MAINNET_CHAIN_ID],
                        methods: ['algo_signTxn'],
                        events: [],
                    },
                    eip155: {
                        chains: ['eip155:1'],
                        methods: ['eth_sign'],
                        events: [],
                    },
                },
            }),
        })

        expect(proposals).toEqual([])
        expect(walletKit.rejectSession).toHaveBeenCalledWith({
            id: PROPOSAL_ID,
            reason: expect.objectContaining({ code: 5104 }),
        })
        await registry.teardown()
    })

    it('approves a proposal that requires accountsChanged', async () => {
        // Pera never emits it, but refusing every dApp that lists a standard
        // session event is the worse trade: v1 notifies nothing either.
        const { walletKit, requireProposal, registry } = await openProposal({
            proposal: makeProposal({
                requiredNamespaces: {
                    algorand: {
                        chains: [MAINNET_CHAIN_ID],
                        methods: ['algo_signTxn'],
                        events: ['accountsChanged'],
                    },
                },
            }),
        })

        await requireProposal().approve([ADDRESS])

        expect(walletKit.approveSession).toHaveBeenCalledWith({
            id: PROPOSAL_ID,
            namespaces: {
                algorand: {
                    chains: [MAINNET_CHAIN_ID],
                    methods: ['algo_signTxn'],
                    events: ['accountsChanged'],
                    accounts: [`${MAINNET_CHAIN_ID}:${ADDRESS}`],
                },
            },
        })
        await registry.teardown()
    })

    it('settles the proposal on proposal_expire rather than leaving it pending', async () => {
        const { walletKit, requireProposal, errors, registry } =
            await openProposal()
        const proposal = requireProposal()

        walletKit.emit('proposal_expire', { id: PROPOSAL_ID })

        expect(errors.at(-1)?.scope).toEqual({ pairingId: PAIRING_TOPIC })
        await expect(proposal.approve([ADDRESS])).rejects.toThrow()
        // The pairing goes with it: a second proposal on a pairing whose
        // origin has been cleared would approve with no origin at all.
        expect(walletKit.pairingDisconnect).toHaveBeenCalledWith({
            topic: PAIRING_TOPIC,
        })
        await registry.teardown()
    })
})

describe('approving a proposal', () => {
    it('writes a full record keyed by the SESSION topic, with the pairing origin', async () => {
        const { store, walletKit, requireProposal, registry } =
            await openProposal({ origin: ORIGIN })

        const connection = await requireProposal().approve([ADDRESS])

        expect(connection.id).toBe(TOPIC)
        expect(connection.origin).toEqual(ORIGIN)
        expect(isWalletConnectV2Connection(connection)).toBe(true)
        const stored = await store.get(TOPIC)
        expect(stored).toEqual(connection)
        expect(walletKit.approveSession).toHaveBeenCalledWith({
            id: PROPOSAL_ID,
            namespaces: {
                algorand: {
                    chains: [MAINNET_CHAIN_ID],
                    methods: ['algo_signTxn'],
                    events: [],
                    accounts: [`${MAINNET_CHAIN_ID}:${ADDRESS}`],
                },
            },
        })
        await registry.teardown()
    })

    it('approves every selected address on every approved chain', async () => {
        const { walletKit, requireProposal, registry } = await openProposal({
            proposal: makeProposal({
                requiredNamespaces: {
                    algorand: {
                        chains: [MAINNET_CHAIN_ID, TESTNET_CHAIN_ID],
                        methods: ['algo_signTxn', 'algo_signData'],
                        events: [],
                    },
                },
            }),
        })

        await requireProposal().approve([ADDRESS, OTHER_ADDRESS])

        expect(walletKit.approveSession).toHaveBeenCalledWith({
            id: PROPOSAL_ID,
            namespaces: {
                algorand: {
                    chains: [MAINNET_CHAIN_ID, TESTNET_CHAIN_ID],
                    methods: ['algo_signTxn', 'algo_signData'],
                    events: [],
                    accounts: [
                        `${MAINNET_CHAIN_ID}:${ADDRESS}`,
                        `${MAINNET_CHAIN_ID}:${OTHER_ADDRESS}`,
                        `${TESTNET_CHAIN_ID}:${ADDRESS}`,
                        `${TESTNET_CHAIN_ID}:${OTHER_ADDRESS}`,
                    ],
                },
            },
        })
        await registry.teardown()
    })

    it('carries the stored origin and createdAt when the same dApp re-approves', async () => {
        // The session is live too, or reconciliation prunes the record before
        // the re-approval can carry anything off it.
        const stored = storedV2Record({ origin: ORIGIN })
        const { requireProposal, registry } = await openProposal({
            seed: [stored],
            walletKit: createFakeWalletKit({ [TOPIC]: makeSession() }),
        })

        const connection = await requireProposal().approve([ADDRESS])

        expect(connection.origin).toEqual(ORIGIN)
        expect(connection.createdAt).toBe(stored.createdAt)
        await registry.teardown()
    })

    it('refuses a second approve or reject on one proposal', async () => {
        const { requireProposal, registry } = await openProposal()
        const proposal = requireProposal()

        await proposal.approve([ADDRESS])

        await expect(proposal.approve([ADDRESS])).rejects.toThrow()
        await expect(proposal.reject()).rejects.toThrow()
        await registry.teardown()
    })

    it('leaves the proposal answerable when the approval fails, so Connect can be retried', async () => {
        const walletKit = createFakeWalletKit()
        walletKit.approveSession.mockRejectedValueOnce(new Error('relay down'))
        const { requireProposal, errors, registry } = await openProposal({
            walletKit,
        })
        const proposal = requireProposal()

        await expect(proposal.approve([ADDRESS])).rejects.toThrow(/relay down/)

        expect(errors.at(-1)?.scope).toEqual({ pairingId: PAIRING_TOPIC })
        const connection = await proposal.approve([ADDRESS])
        expect(connection.id).toBe(TOPIC)
        await registry.teardown()
    })

    it('disconnects a session it settled but could not record', async () => {
        // Otherwise the dApp holds a live session the wallet has no row for:
        // invisible in settings, and unanswerable when it sends a request.
        const walletKit = createFakeWalletKit()
        walletKit.approveSession.mockResolvedValueOnce(
            makeSession({
                namespaces: {
                    eip155: {
                        accounts: ['eip155:1:0xabc'],
                        methods: ['eth_sign'],
                        events: [],
                    },
                },
            }),
        )
        const { requireProposal, store, registry } = await openProposal({
            walletKit,
        })
        const proposal = requireProposal()

        await expect(proposal.approve([ADDRESS])).rejects.toThrow()

        expect(walletKit.disconnectSession).toHaveBeenCalledWith({
            topic: TOPIC,
            reason: expect.objectContaining({ code: expect.any(Number) }),
        })
        expect(await store.list()).toEqual([])
        // Still answerable: the failure was the wallet's, not the user's.
        await expect(proposal.approve([ADDRESS])).resolves.toMatchObject({
            id: TOPIC,
        })
        await registry.teardown()
    })

    it('refuses an approval with no accounts without consuming the proposal', async () => {
        const { requireProposal, walletKit, registry } = await openProposal()
        const proposal = requireProposal()

        await expect(proposal.approve([])).rejects.toThrow()

        expect(walletKit.approveSession).not.toHaveBeenCalled()
        await expect(proposal.approve([ADDRESS])).resolves.toMatchObject({
            id: TOPIC,
        })
        await registry.teardown()
    })

    it('clears the pairing origin once a session is approved', async () => {
        const walletKit = createFakeWalletKit()
        const { propose, requireProposal, registry } = await openProposal({
            walletKit,
            origin: ORIGIN,
        })
        const first = await requireProposal().approve([ADDRESS])
        expect(first.origin).toEqual(ORIGIN)

        // A second session on the same pairing has no origin of its own, and
        // no stored record to carry one off either.
        walletKit.approveSession.mockImplementationOnce(
            async ({ namespaces }) =>
                makeSession({ topic: OTHER_TOPIC, namespaces }),
        )
        await propose(makeNextProposal())
        const second = await requireProposal().approve([ADDRESS])

        expect(second.id).toBe(OTHER_TOPIC)
        expect(second.origin).toBeUndefined()
        await registry.teardown()
    })

    it('clears the pairing origin when the proposal expires', async () => {
        const { walletKit, propose, requireProposal, registry } =
            await openProposal({ origin: ORIGIN })

        walletKit.emit('proposal_expire', { id: PROPOSAL_ID })

        await propose(makeNextProposal())
        const connection = await requireProposal().approve([ADDRESS])
        expect(connection.origin).toBeUndefined()
        await registry.teardown()
    })
})

describe('rejecting a proposal', () => {
    it('tells the peer and writes nothing', async () => {
        const { store, walletKit, requireProposal, registry } =
            await openProposal({ origin: ORIGIN })

        await requireProposal().reject('No thanks')

        expect(walletKit.rejectSession).toHaveBeenCalledWith({
            id: PROPOSAL_ID,
            reason: expect.objectContaining({ message: 'No thanks' }),
        })
        expect(walletKit.approveSession).not.toHaveBeenCalled()
        expect(await store.list()).toEqual([])
        await registry.teardown()
    })

    it('clears the origin, so the next proposal on that pairing approves without one', async () => {
        const { propose, requireProposal, registry } = await openProposal({
            origin: ORIGIN,
        })
        await requireProposal().reject()

        await propose()
        const connection = await requireProposal().approve([ADDRESS])

        expect(connection.origin).toBeUndefined()
        await registry.teardown()
    })

    it('expires the pairing, so a persistent dApp cannot re-propose', async () => {
        const { walletKit, requireProposal, registry } = await openProposal()

        await requireProposal().reject()

        expect(walletKit.pairingDisconnect).toHaveBeenCalledWith({
            topic: PAIRING_TOPIC,
        })
        await registry.teardown()
    })

    it('survives a relay that will not expire the pairing', async () => {
        const walletKit = createFakeWalletKit()
        walletKit.pairingDisconnect.mockRejectedValue(new Error('relay down'))
        const { requireProposal, registry } = await openProposal({ walletKit })

        await expect(requireProposal().reject()).resolves.toBeUndefined()
        await registry.teardown()
    })
})

describe('abandonPairing', () => {
    it('expires the pairing and drops a proposal that arrives afterwards', async () => {
        const { walletKit, proposals, registry, pairingId, propose } =
            await openPairing()

        registry.abandonPairing(pairingId)
        await propose()

        expect(walletKit.pairingDisconnect).toHaveBeenCalledWith({
            topic: PAIRING_TOPIC,
        })
        // A pairing the user gave up on must not pop a sheet from nowhere.
        expect(proposals).toEqual([])
        await registry.teardown()
    })

    it('clears the origin, so a re-pairing without one approves without one', async () => {
        const { registry, pairingId, propose, requireProposal } =
            await openPairing({ origin: ORIGIN })
        registry.abandonPairing(pairingId)

        await registry.pair(V2_URI)
        await propose()
        const connection = await requireProposal().approve([ADDRESS])

        expect(connection.origin).toBeUndefined()
        await registry.teardown()
    })
})

describe('origin bookkeeping', () => {
    it('drops a stale origin when the same pairing is re-paired without one', async () => {
        const { registry, propose, requireProposal } = await openPairing({
            origin: ORIGIN,
        })

        await registry.pair(V2_URI)

        await propose()
        const connection = await requireProposal().approve([ADDRESS])
        expect(connection.origin).toBeUndefined()
        await registry.teardown()
    })

    it('forgets pending origins on teardown', async () => {
        const { handler, walletKit } = makeHandler()
        await handler.initialize(makeContext())
        await uriPairing(handler).pair(V2_URI, { origin: ORIGIN })
        await handler.teardown()

        const next = makeContext()
        await handler.initialize(next)
        walletKit.emit('session_proposal', makeProposal())
        await flush()

        const proposal = next.onProposal.mock.calls.at(-1)?.[0]
        if (!proposal) throw new Error('the peer proposal never arrived')
        const connection = await proposal.approve([ADDRESS])
        expect(connection.origin).toBeUndefined()
        await handler.teardown()
    })
})

describe('matchesNetwork', () => {
    it('accepts the network whose CAIP-2 id the session was approved for', async () => {
        const walletKit = createFakeWalletKit({ [TOPIC]: makeSession() })
        const { handler } = makeHandler({ walletKit })
        await handler.initialize(makeContext())
        const [record] = await handler.restore()

        expect(handler.matchesNetwork(record, Networks.mainnet)).toBe(true)
        expect(handler.matchesNetwork(record, Networks.testnet)).toBe(false)
        // `custom` has no CAIP-2 identity, so no session can claim it.
        expect(handler.matchesNetwork(record, Networks.custom)).toBe(false)
    })
})
