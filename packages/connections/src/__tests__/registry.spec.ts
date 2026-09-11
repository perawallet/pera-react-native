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
import { createConnectionRegistry } from '../registry'
import type { ConnectionHandler, ConnectionHandlerContext } from '../handler'
import type {
    ConnectionProposal,
    InboundMessage,
    RawInboundMessage,
    WalletOperationResult,
} from '../models'
import type {
    Connection,
    ConnectionOrigin,
    ConnectionStoreAPI,
} from '@perawallet/wallet-extension-connections'
import { memoryStore } from '../testing/handler-contract'

/** A handler with no URI: the origin-identified `'dapp'` shape. */
const makeOriginHandler = (
    kind: string,
    overrides: Partial<ConnectionHandler> = {},
): ConnectionHandler => ({
    kind,
    initialize: vi.fn(async () => {}),
    teardown: vi.fn(async () => {}),
    disconnect: vi.fn(async () => {}),
    disconnectAll: vi.fn(async () => {}),
    restore: vi.fn(async () => []),
    matchesNetwork: vi.fn(() => true),
    methodsFor: vi.fn(() => []),
    ...overrides,
})

/** The `ConnectionHandlerContext` a handler's `initialize` spy was handed. */
const capturedContext = (
    handler: ConnectionHandler,
): ConnectionHandlerContext => vi.mocked(handler.initialize).mock.calls[0][0]

/** A URI-pairing handler claiming `${kind}:` URIs. */
const makeHandler = (
    kind: string,
    overrides: Partial<ConnectionHandler> = {},
): ConnectionHandler =>
    makeOriginHandler(kind, {
        canHandleUri: vi.fn((uri: string) => uri.startsWith(`${kind}:`)),
        pair: vi.fn(async () => `${kind}-pairing`),
        abandonPairing: vi.fn(),
        describeUri: vi.fn(() => ({ topic: null })),
        ...overrides,
    })

const ORIGIN: ConnectionOrigin = {
    source: 'external-browser',
    browserName: 'safari',
}

const makeConnection = (overrides: Partial<Connection> = {}): Connection => ({
    id: 'c1',
    kind: 'alpha',
    name: 'Peer',
    peer: { name: 'Peer' },
    accounts: [],
    status: 'active',
    createdAt: 0,
    lastActiveAt: 0,
    ...overrides,
})

const makeProposal = (
    overrides: Partial<ConnectionProposal> = {},
): ConnectionProposal => ({
    kind: 'alpha',
    proposalId: 'p1',
    peer: { name: 'Peer' },
    requested: { networks: ['mainnet'], methods: ['algo_signTxn'] },
    expiresAt: Date.now() + 60_000,
    approve: vi.fn(async () => makeConnection()),
    reject: vi.fn(async () => {}),
    ...overrides,
})

type RawRequestMessage = Extract<RawInboundMessage, { kind: 'request' }>

const makeRawRequest = (options?: {
    params?: unknown
    respond?: RawRequestMessage['respond']
    reject?: RawRequestMessage['reject']
}): RawInboundMessage => ({
    kind: 'request',
    connectionId: 'c1',
    correlationId: '1',
    sourceType: 'walletconnect',
    authorizedAccounts: ['AAAA'],
    peer: { name: 'Test dApp' },
    rawOperation: {
        type: 'sign-transactions',
        params: options?.params ?? [{ txn: 'base64==' }],
    },
    respond: options?.respond ?? vi.fn(async () => {}),
    reject: options?.reject ?? vi.fn(async () => {}),
})

const SIGNED: WalletOperationResult = {
    type: 'sign-transactions',
    signed: ['c2ln'],
}

const invalidRawRequest = (): RawInboundMessage =>
    makeRawRequest({ params: [{}] })

describe('createConnectionRegistry', () => {
    let store: ConnectionStoreAPI

    beforeEach(() => {
        store = memoryStore()
    })

    /** Registers one handler, initializes the registry, and hands back the context it captured. */
    const setupRegistry = async (): Promise<{
        registry: ReturnType<typeof createConnectionRegistry>
        ctx: ConnectionHandlerContext
    }> => {
        const registry = createConnectionRegistry({ store })
        let capturedCtx: ConnectionHandlerContext | undefined
        registry.register(
            makeHandler('alpha', {
                initialize: vi.fn(async ctx => {
                    capturedCtx = ctx
                }),
            }),
        )
        await registry.initialize()
        if (!capturedCtx) throw new Error('handler context was not captured')
        return { registry, ctx: capturedCtx }
    }

    it('routes a URI to the handler that claims it', async () => {
        const alpha = makeHandler('alpha')
        const beta = makeHandler('beta')
        const registry = createConnectionRegistry({ store })
        registry.register(alpha)
        registry.register(beta)
        await registry.initialize()

        await registry.pair('beta:xyz')

        expect(beta.pair).toHaveBeenCalledWith('beta:xyz', undefined)
        expect(alpha.pair).not.toHaveBeenCalled()
    })

    describe('pair', () => {
        it('skips a handler that declares no URI pairing', async () => {
            const dapp = makeOriginHandler('dapp')
            const beta = makeHandler('beta')
            const registry = createConnectionRegistry({ store })
            registry.register(dapp)
            registry.register(beta)
            await registry.initialize()

            await expect(registry.pair('beta:xyz')).resolves.toBe(
                'beta-pairing',
            )

            expect(beta.pair).toHaveBeenCalledTimes(1)
        })

        it('throws no-handler when only URI-less handlers are registered', async () => {
            const registry = createConnectionRegistry({ store })
            registry.register(makeOriginHandler('dapp'))
            await registry.initialize()

            await expect(registry.pair('beta:xyz')).rejects.toMatchObject({
                code: 'no-handler',
            })
        })

        it('refuses a pairing before initialize, so the caller can say so rather than strand a connector', async () => {
            const beta = makeHandler('beta')
            const registry = createConnectionRegistry({ store })
            registry.register(beta)

            await expect(registry.pair('beta:xyz')).rejects.toMatchObject({
                code: 'not-initialized',
            })

            expect(beta.pair).not.toHaveBeenCalled()
        })

        it('waits out an in-flight initialize rather than refusing a cold-start deep link', async () => {
            let releaseBoot: () => void = () => {}
            const booted = new Promise<void>(resolve => {
                releaseBoot = resolve
            })
            const beta = makeHandler('beta', {
                initialize: vi.fn(async () => booted),
            })
            const registry = createConnectionRegistry({ store })
            registry.register(beta)

            const initializing = registry.initialize()
            const pairing = registry.pair('beta:xyz')
            expect(beta.pair).not.toHaveBeenCalled()

            releaseBoot()
            await initializing

            await expect(pairing).resolves.toBe('beta-pairing')
        })

        it('refuses a pairing after teardown', async () => {
            const beta = makeHandler('beta')
            const registry = createConnectionRegistry({ store })
            registry.register(beta)
            await registry.initialize()
            await registry.teardown()

            await expect(registry.pair('beta:xyz')).rejects.toMatchObject({
                code: 'not-initialized',
            })
        })

        it('forwards the pairing options to the claiming handler', async () => {
            const beta = makeHandler('beta')
            const registry = createConnectionRegistry({ store })
            registry.register(beta)
            await registry.initialize()

            await registry.pair('beta:xyz', { origin: ORIGIN })

            expect(beta.pair).toHaveBeenCalledWith('beta:xyz', {
                origin: ORIGIN,
            })
        })
    })

    describe('abandonPairing', () => {
        it('reaches the handler that issued the pairing id and no other', async () => {
            const alpha = makeHandler('alpha')
            const beta = makeHandler('beta')
            const registry = createConnectionRegistry({ store })
            registry.register(alpha)
            registry.register(beta)
            await registry.initialize()
            const pairingId = await registry.pair('beta:xyz')

            registry.abandonPairing(pairingId)

            expect(beta.abandonPairing).toHaveBeenCalledWith(pairingId)
            expect(alpha.abandonPairing).not.toHaveBeenCalled()
        })

        it('routes a pairing id once, then forgets it', async () => {
            const beta = makeHandler('beta')
            const registry = createConnectionRegistry({ store })
            registry.register(beta)
            await registry.initialize()
            const pairingId = await registry.pair('beta:xyz')

            registry.abandonPairing(pairingId)
            registry.abandonPairing(pairingId)

            expect(beta.abandonPairing).toHaveBeenCalledTimes(1)
        })

        it('stops routing a pairing id once its proposal is approved', async () => {
            // `pairings` is only the routing table for `abandonPairing`; a
            // settled proposal is the end of its pairing, so an entry that is
            // never pruned grows for the life of the process.
            const beta = makeHandler('beta')
            const registry = createConnectionRegistry({ store })
            registry.register(beta)
            const proposals: ConnectionProposal[] = []
            registry.subscribeToProposals(proposal => proposals.push(proposal))
            await registry.initialize()
            const pairingId = await registry.pair('beta:xyz')
            capturedContext(beta).onProposal(makeProposal({ pairingId }))

            await proposals[0].approve(['AAAA'])
            registry.abandonPairing(pairingId)

            expect(beta.abandonPairing).not.toHaveBeenCalled()
        })

        it('stops routing a pairing id once its proposal is rejected', async () => {
            const beta = makeHandler('beta')
            const registry = createConnectionRegistry({ store })
            registry.register(beta)
            const proposals: ConnectionProposal[] = []
            registry.subscribeToProposals(proposal => proposals.push(proposal))
            await registry.initialize()
            const pairingId = await registry.pair('beta:xyz')
            capturedContext(beta).onProposal(makeProposal({ pairingId }))

            await proposals[0].reject('declined')
            registry.abandonPairing(pairingId)

            expect(beta.abandonPairing).not.toHaveBeenCalled()
        })

        it('is a no-op for a pairing id no handler issued', () => {
            const beta = makeHandler('beta')
            const registry = createConnectionRegistry({ store })
            registry.register(beta)

            expect(() => registry.abandonPairing('never-issued')).not.toThrow()

            expect(beta.abandonPairing).not.toHaveBeenCalled()
        })

        it('tolerates a handler that declares no abandonPairing', async () => {
            const beta = makeHandler('beta', { abandonPairing: undefined })
            const registry = createConnectionRegistry({ store })
            registry.register(beta)
            await registry.initialize()
            const pairingId = await registry.pair('beta:xyz')

            expect(() => registry.abandonPairing(pairingId)).not.toThrow()
        })
    })

    describe('describeUri', () => {
        it('delegates to the handler that claims the URI', () => {
            const alpha = makeHandler('alpha')
            const beta = makeHandler('beta', {
                describeUri: vi.fn(() => ({ topic: 'xyz', relay: null })),
            })
            const registry = createConnectionRegistry({ store })
            registry.register(alpha)
            registry.register(beta)

            expect(registry.describeUri('beta:xyz')).toEqual({
                topic: 'xyz',
                relay: null,
            })
            expect(alpha.describeUri).not.toHaveBeenCalled()
        })

        it('returns an empty record, never the URI, when no handler claims it', () => {
            const registry = createConnectionRegistry({ store })
            registry.register(makeHandler('alpha'))
            registry.register(makeOriginHandler('dapp'))

            const described = registry.describeUri('gamma:topic?key=secret')

            expect(described).toEqual({})
            expect(JSON.stringify(described)).not.toContain('secret')
        })
    })

    describe('networksFor', () => {
        it('returns exactly the networks the kind handler accepts', () => {
            const beta = makeHandler('beta', {
                matchesNetwork: vi.fn(
                    (_connection: Connection, network: string) =>
                        network === 'mainnet' || network === 'custom',
                ),
            })
            const registry = createConnectionRegistry({ store })
            registry.register(makeHandler('alpha'))
            registry.register(beta)

            const networks = registry.networksFor(
                makeConnection({ id: 'b1', kind: 'beta' }),
            )

            expect(networks).toEqual(['mainnet', 'custom'])
        })

        it('yields every network for a handler that accepts them all', () => {
            const registry = createConnectionRegistry({ store })
            registry.register(makeHandler('alpha'))

            expect([...registry.networksFor(makeConnection())].sort()).toEqual([
                'betanet',
                'custom',
                'mainnet',
                'testnet',
            ])
        })

        it('is empty for a kind with no registered handler', () => {
            const registry = createConnectionRegistry({ store })
            registry.register(makeHandler('alpha'))

            expect(
                registry.networksFor(makeConnection({ kind: 'beta' })),
            ).toEqual([])
        })
    })

    describe('methodsFor', () => {
        it('returns what the kind handler reports', () => {
            const registry = createConnectionRegistry({ store })
            registry.register(
                makeHandler('alpha', {
                    methodsFor: vi.fn(() => ['algo_signTxn']),
                }),
            )

            expect(registry.methodsFor(makeConnection())).toEqual([
                'algo_signTxn',
            ])
        })

        it('is empty for a kind with no registered handler', () => {
            const registry = createConnectionRegistry({ store })
            registry.register(makeHandler('alpha'))

            expect(
                registry.methodsFor(makeConnection({ kind: 'beta' })),
            ).toEqual([])
        })
    })

    it('throws typed, translatable copy when no handler claims the URI', async () => {
        // The app toasts `resolveErrorCopy(error)`, which falls back to
        // untranslated English for anything without a `messageKey`.
        const registry = createConnectionRegistry({ store })
        registry.register(makeHandler('alpha'))
        await registry.initialize()

        await expect(registry.pair('beta:xyz')).rejects.toMatchObject({
            message: expect.stringMatching(/No connection handler/),
            code: 'no-handler',
            metadata: { messageKey: 'errors.connections.no_handler' },
        })
    })

    it('routes disconnect by the connection kind, never by guesswork', async () => {
        const alpha = makeHandler('alpha')
        const beta = makeHandler('beta')
        const registry = createConnectionRegistry({ store })
        registry.register(alpha)
        registry.register(beta)
        await store.upsert({
            id: 'c1',
            kind: 'beta',
            name: 'Peer',
            peer: { name: 'Peer' },
            accounts: [],
            status: 'active',
            createdAt: 0,
            lastActiveAt: 0,
        })

        await registry.disconnect('c1')

        expect(beta.disconnect).toHaveBeenCalledWith('c1')
        expect(alpha.disconnect).not.toHaveBeenCalled()
    })

    it('disconnectAll sweeps every handler even when one fails', async () => {
        const alpha = makeHandler('alpha', {
            disconnectAll: vi.fn(async () => {
                throw new Error('peer unreachable')
            }),
        })
        const beta = makeHandler('beta')
        const registry = createConnectionRegistry({ store })
        registry.register(alpha)
        registry.register(beta)

        await registry.disconnectAll()

        expect(beta.disconnectAll).toHaveBeenCalled()
    })

    it('tears down every handler even when one fails', async () => {
        const alpha = makeHandler('alpha', {
            teardown: vi.fn(async () => {
                throw new Error('socket already closed')
            }),
        })
        const beta = makeHandler('beta')
        const registry = createConnectionRegistry({ store })
        registry.register(alpha)
        registry.register(beta)

        await registry.teardown()

        expect(beta.teardown).toHaveBeenCalled()
    })

    describe('register', () => {
        it('refuses a second handler for the same kind', () => {
            const registry = createConnectionRegistry({ store })
            registry.register(makeHandler('alpha'))

            expect(() => registry.register(makeHandler('alpha'))).toThrow(
                expect.objectContaining({ code: 'duplicate-kind' }),
            )
        })

        it('refuses a handler once initialize has started', async () => {
            const registry = createConnectionRegistry({ store })
            registry.register(makeHandler('alpha'))
            await registry.initialize()

            expect(() => registry.register(makeHandler('beta'))).toThrow(
                expect.objectContaining({ code: 'already-initialized' }),
            )
        })

        it('accepts a handler again only once teardown has settled', async () => {
            // Registered mid-teardown, a handler would be torn down without
            // ever initialising.
            let releaseTeardown: () => void = () => {}
            const alpha = makeHandler('alpha', {
                teardown: vi.fn(
                    () =>
                        new Promise<void>(resolve => {
                            releaseTeardown = resolve
                        }),
                ),
            })
            const registry = createConnectionRegistry({ store })
            registry.register(alpha)
            await registry.initialize()

            const teardown = registry.teardown()
            expect(() => registry.register(makeHandler('beta'))).toThrow(
                expect.objectContaining({ code: 'already-initialized' }),
            )
            // Let the chained teardown start so the handler's deferred
            // promise (and its release) exists before it is released.
            await new Promise(resolve => setTimeout(resolve, 0))

            releaseTeardown()
            await teardown
            expect(() => registry.register(makeHandler('beta'))).not.toThrow()
        })

        it('stays live across teardown → initialize → teardown fired together', async () => {
            // The first teardown settling must not read the second one's
            // cleared state and go quiet while the queued initialize is
            // still pending.
            const releases: Array<() => void> = []
            const alpha = makeHandler('alpha', {
                teardown: vi.fn(
                    () =>
                        new Promise<void>(resolve => {
                            releases.push(resolve)
                        }),
                ),
            })
            const registry = createConnectionRegistry({ store })
            registry.register(alpha)
            await registry.initialize()

            const first = registry.teardown()
            const reinitialize = registry.initialize()
            const second = registry.teardown()
            await new Promise(resolve => setTimeout(resolve, 0))
            releases[0]()
            await first
            await new Promise(resolve => setTimeout(resolve, 0))

            expect(() => registry.register(makeHandler('beta'))).toThrow(
                expect.objectContaining({ code: 'already-initialized' }),
            )

            releases[1]()
            await Promise.all([reinitialize, second])
            expect(alpha.initialize).toHaveBeenCalledTimes(2)
            expect(() => registry.register(makeHandler('beta'))).not.toThrow()
        })
    })

    describe('initialize', () => {
        it('initialises and restores the other handlers when one initialize rejects, and reports the failure', async () => {
            const alpha = makeHandler('alpha')
            const beta = makeHandler('beta', {
                initialize: vi.fn(async () => {
                    throw new Error('relay init failed')
                }),
            })
            const registry = createConnectionRegistry({ store })
            registry.register(alpha)
            registry.register(beta)
            const onError = vi.fn()
            registry.subscribeToErrors(onError)

            await expect(registry.initialize()).resolves.toBeUndefined()

            expect(alpha.initialize).toHaveBeenCalledTimes(1)
            expect(alpha.restore).toHaveBeenCalledTimes(1)
            expect(beta.restore).not.toHaveBeenCalled()
            expect(onError).toHaveBeenCalledTimes(1)
            expect(onError.mock.calls[0][0]).toMatchObject({
                message: 'relay init failed',
            })
        })

        it('reports a rejecting restore without touching that kind in the store', async () => {
            const stale = makeConnection({ id: 'a1', kind: 'alpha' })
            await store.upsert(stale)
            const alpha = makeHandler('alpha', {
                restore: vi.fn(async () => {
                    throw new Error('relay unreachable')
                }),
            })
            const registry = createConnectionRegistry({ store })
            registry.register(alpha)
            const onError = vi.fn()
            registry.subscribeToErrors(onError)

            await registry.initialize()

            expect(await store.get('a1')).toEqual(stale)
            expect(onError).toHaveBeenCalledTimes(1)
        })

        it('runs each handler initialize once when called twice concurrently', async () => {
            const alpha = makeHandler('alpha')
            const registry = createConnectionRegistry({ store })
            registry.register(alpha)

            const first = registry.initialize()
            const second = registry.initialize()
            await Promise.all([first, second])

            expect(second).toBe(first)
            expect(alpha.initialize).toHaveBeenCalledTimes(1)
            expect(alpha.restore).toHaveBeenCalledTimes(1)
        })

        it('waits for an in-flight teardown before initialising again', async () => {
            let releaseTeardown: () => void = () => {}
            const alpha = makeHandler('alpha', {
                teardown: vi.fn(
                    () =>
                        new Promise<void>(resolve => {
                            releaseTeardown = resolve
                        }),
                ),
            })
            const registry = createConnectionRegistry({ store })
            registry.register(alpha)
            await registry.initialize()

            const teardown = registry.teardown()
            const reinitialize = registry.initialize()
            await new Promise(resolve => setTimeout(resolve, 0))
            expect(alpha.initialize).toHaveBeenCalledTimes(1)

            releaseTeardown()
            await Promise.all([teardown, reinitialize])

            expect(alpha.initialize).toHaveBeenCalledTimes(2)
        })

        it('waits for an in-flight initialize before tearing down', async () => {
            let releaseInitialize: () => void = () => {}
            const alpha = makeHandler('alpha', {
                initialize: vi.fn(
                    () =>
                        new Promise<void>(resolve => {
                            releaseInitialize = resolve
                        }),
                ),
            })
            const registry = createConnectionRegistry({ store })
            registry.register(alpha)

            const initialize = registry.initialize()
            const teardown = registry.teardown()
            await new Promise(resolve => setTimeout(resolve, 0))
            expect(alpha.teardown).not.toHaveBeenCalled()

            releaseInitialize()
            await Promise.all([initialize, teardown])

            expect(alpha.teardown).toHaveBeenCalledTimes(1)
        })

        describe('reconciliation', () => {
            it('removes stored records of a kind that its handler no longer reports', async () => {
                const a = makeConnection({ id: 'a', kind: 'alpha' })
                const b = makeConnection({ id: 'b', kind: 'alpha' })
                await store.upsert(a)
                await store.upsert(b)
                const alpha = makeHandler('alpha', {
                    restore: vi.fn(async () => [a]),
                })
                const registry = createConnectionRegistry({ store })
                registry.register(alpha)

                await registry.initialize()

                expect(await store.get('a')).toEqual(a)
                expect(await store.get('b')).toBeUndefined()
            })

            it('never removes a record of another kind', async () => {
                const foreign = makeConnection({ id: 'y', kind: 'beta' })
                await store.upsert(foreign)
                await store.upsert(makeConnection({ id: 'a', kind: 'alpha' }))
                const alpha = makeHandler('alpha', {
                    restore: vi.fn(async () => []),
                })
                const registry = createConnectionRegistry({ store })
                registry.register(alpha)

                await registry.initialize()

                expect(await store.get('y')).toEqual(foreign)
                expect(await store.get('a')).toBeUndefined()
            })

            it('upserts what the handler reports before initialize resolves', async () => {
                const revived = makeConnection({
                    id: 'a',
                    kind: 'alpha',
                    status: 'inactive',
                })
                const alpha = makeHandler('alpha', {
                    restore: vi.fn(async () => [revived]),
                })
                const registry = createConnectionRegistry({ store })
                registry.register(alpha)

                await registry.initialize()

                expect(await store.get('a')).toEqual(revived)
            })
        })
    })

    it('forwards proposals from a handler to subscribers', async () => {
        const registry = createConnectionRegistry({ store })
        let emit: ((p: ConnectionProposal) => void) | undefined
        registry.register(
            makeHandler('alpha', {
                initialize: vi.fn(async ctx => {
                    emit = ctx.onProposal
                }),
            }),
        )
        const seen = vi.fn()
        registry.subscribeToProposals(seen)

        await registry.initialize()
        const proposal = makeProposal()
        emit?.(proposal)

        expect(seen).toHaveBeenCalledWith(proposal)
    })

    describe('onMessage — the validation boundary', () => {
        it('never forwards an invalid message to message subscribers', async () => {
            const { ctx, registry } = await setupRegistry()
            const seen = vi.fn()
            registry.subscribeToMessages(seen)

            ctx.onMessage(invalidRawRequest())

            expect(seen).not.toHaveBeenCalled()
        })

        it('forwards a valid message to message subscribers', async () => {
            const { ctx, registry } = await setupRegistry()
            const seen = vi.fn()
            registry.subscribeToMessages(seen)

            ctx.onMessage(makeRawRequest())

            expect(seen).toHaveBeenCalledTimes(1)
            const [message] = seen.mock.calls[0]
            expect(message.kind).toBe('request')
            if (message.kind === 'request') {
                expect(message.operation).toEqual({
                    type: 'sign-transactions',
                    group: [{ txn: 'base64==' }],
                })
            }
        })

        it('reaches raw.reject with the validation error on a failed validation', async () => {
            const { ctx } = await setupRegistry()
            const raw = invalidRawRequest()

            ctx.onMessage(raw)

            if (raw.kind !== 'request') throw new Error('expected a request')
            expect(raw.reject).toHaveBeenCalledTimes(1)
            const [error] = vi.mocked(raw.reject).mock.calls[0]
            expect(error).toBeInstanceOf(Error)
            expect(error.message).toMatch(/txn/)
        })

        it('notifies error subscribers on a validation failure', async () => {
            const { ctx, registry } = await setupRegistry()
            const onError = vi.fn()
            registry.subscribeToErrors(onError)

            ctx.onMessage(invalidRawRequest())

            expect(onError).toHaveBeenCalledTimes(1)
            expect(onError.mock.calls[0][0]).toBeInstanceOf(Error)
            expect(onError.mock.calls[0][1]).toEqual({ connectionId: 'c1' })
        })

        it('gives the validation failure translatable copy', async () => {
            // The peer gets the field-path breadcrumb in `message`; the user
            // gets `messageKey`, because `message` is developer English.
            const { ctx, registry } = await setupRegistry()
            const onError = vi.fn()
            registry.subscribeToErrors(onError)

            ctx.onMessage(invalidRawRequest())

            expect(onError.mock.calls[0][0]).toMatchObject({
                code: 'invalid-payload',
                metadata: { messageKey: 'errors.connections.invalid_payload' },
            })
        })

        it('swallows a reject that rejects, without throwing out of onMessage', async () => {
            const { ctx } = await setupRegistry()
            const raw = makeRawRequest({
                params: [{}],
                reject: vi.fn(async () => {
                    throw new Error('peer gone')
                }),
            })

            expect(() => ctx.onMessage(raw)).not.toThrow()
            // Let the rejected promise's `.catch` handler settle so it isn't
            // left as an unhandled rejection past the end of the test.
            await new Promise(resolve => setTimeout(resolve, 0))
        })

        it('swallows a reject that throws synchronously', async () => {
            const { ctx } = await setupRegistry()
            const raw = makeRawRequest({
                params: [{}],
                reject: vi.fn(() => {
                    throw new Error('sync boom')
                }),
            })

            expect(() => ctx.onMessage(raw)).not.toThrow()
        })

        it('keeps notifying remaining message subscribers when one throws', async () => {
            const { ctx, registry } = await setupRegistry()
            const throwing = vi.fn(() => {
                throw new Error('subscriber boom')
            })
            const next = vi.fn()
            registry.subscribeToMessages(throwing)
            registry.subscribeToMessages(next)

            expect(() => ctx.onMessage(makeRawRequest())).not.toThrow()

            expect(throwing).toHaveBeenCalled()
            expect(next).toHaveBeenCalled()
        })

        it('stops notifying a message subscriber after it unsubscribes', async () => {
            const { ctx, registry } = await setupRegistry()
            const seen = vi.fn()
            const unsubscribe = registry.subscribeToMessages(seen)
            unsubscribe()

            ctx.onMessage(makeRawRequest())

            expect(seen).not.toHaveBeenCalled()
        })

        describe('with no message subscriber', () => {
            it('rejects the request to the peer instead of dropping it', async () => {
                const { ctx } = await setupRegistry()
                const raw = makeRawRequest()

                ctx.onMessage(raw)

                if (raw.kind !== 'request')
                    throw new Error('expected a request')
                expect(raw.reject).toHaveBeenCalledTimes(1)
                expect(vi.mocked(raw.reject).mock.calls[0][0]).toMatchObject({
                    code: 'no-subscriber',
                })
            })

            it('reports the dropped request through onError', async () => {
                const { ctx, registry } = await setupRegistry()
                const onError = vi.fn()
                registry.subscribeToErrors(onError)

                ctx.onMessage(makeRawRequest())

                expect(onError).toHaveBeenCalledTimes(1)
                expect(onError.mock.calls[0][0]).toMatchObject({
                    code: 'no-subscriber',
                })
                expect(onError.mock.calls[0][1]).toEqual({ connectionId: 'c1' })
            })
        })

        describe('once-only answering', () => {
            type RequestMessage = Extract<InboundMessage, { kind: 'request' }>

            const deliver = async (
                raw: RawInboundMessage,
            ): Promise<{
                message: RequestMessage
                onError: ReturnType<typeof vi.fn>
            }> => {
                const { ctx, registry } = await setupRegistry()
                const onError = vi.fn()
                registry.subscribeToErrors(onError)
                let received: InboundMessage | undefined
                registry.subscribeToMessages(message => {
                    received = message
                })
                ctx.onMessage(raw)
                if (received?.kind !== 'request') {
                    throw new Error('expected a validated request')
                }
                return { message: received, onError }
            }

            it('rejects a second respond with a typed error the user never sees', async () => {
                // A double answer is a wallet programming error: the caller
                // gets the rejection, the log gets the line, and the error
                // channel — which feeds the user toast — stays quiet.
                const raw = makeRawRequest()
                const { message, onError } = await deliver(raw)

                await message.respond(SIGNED)
                await expect(message.respond(SIGNED)).rejects.toMatchObject({
                    code: 'already-answered',
                    metadata: {
                        messageKey: 'errors.connections.already_answered',
                    },
                })

                if (raw.kind !== 'request')
                    throw new Error('expected a request')
                expect(raw.respond).toHaveBeenCalledTimes(1)
                expect(onError).not.toHaveBeenCalled()
            })

            it('rejects a reject after a respond', async () => {
                const raw = makeRawRequest()
                const { message } = await deliver(raw)

                await message.respond(SIGNED)
                await expect(
                    message.reject(new Error('too late')),
                ).rejects.toMatchObject({ code: 'already-answered' })

                if (raw.kind !== 'request')
                    throw new Error('expected a request')
                expect(raw.reject).not.toHaveBeenCalled()
            })

            it('leaves the request answerable when delivery fails', async () => {
                // The signing pipeline retries on exactly this rejection, so
                // a failed delivery must not consume the one answer.
                const respond = vi
                    .fn<RequestMessage['respond']>()
                    .mockRejectedValueOnce(new Error('socket closed'))
                    .mockResolvedValueOnce(undefined)
                const { message } = await deliver(makeRawRequest({ respond }))

                await expect(message.respond(SIGNED)).rejects.toThrow(
                    'socket closed',
                )
                await expect(message.respond(SIGNED)).resolves.toBeUndefined()

                expect(respond).toHaveBeenCalledTimes(2)
            })
        })
    })

    describe('onRequestExpired', () => {
        it('fans the expiry out on the message channel as its own kind', async () => {
            // The subscriber holding the request open (the signing adapter)
            // is the one that has to let go of it.
            const { ctx, registry } = await setupRegistry()
            const seen = vi.fn()
            registry.subscribeToMessages(seen)

            ctx.onRequestExpired('c1', '7')

            expect(seen).toHaveBeenCalledWith({
                kind: 'request-expired',
                connectionId: 'c1',
                correlationId: '7',
            })
        })

        it('survives a throwing subscriber', async () => {
            const { ctx, registry } = await setupRegistry()
            registry.subscribeToMessages(() => {
                throw new Error('listener bug')
            })
            const seen = vi.fn()
            registry.subscribeToMessages(seen)

            expect(() => ctx.onRequestExpired('c1', '7')).not.toThrow()
            expect(seen).toHaveBeenCalledTimes(1)
        })
    })

    describe('onDisconnected', () => {
        it('reports a failed store.remove through emitError instead of an unhandled rejection', async () => {
            store.remove = vi.fn(async () => {
                throw new Error('storage write failed')
            })
            const { ctx, registry } = await setupRegistry()
            const onError = vi.fn()
            registry.subscribeToErrors(onError)

            expect(() => ctx.onDisconnected('c1')).not.toThrow()
            await new Promise(resolve => setTimeout(resolve, 0))

            expect(onError).toHaveBeenCalledTimes(1)
            expect(onError.mock.calls[0][0]).toBeInstanceOf(Error)
            expect(onError.mock.calls[0][1]).toEqual({ connectionId: 'c1' })
        })
    })
})
